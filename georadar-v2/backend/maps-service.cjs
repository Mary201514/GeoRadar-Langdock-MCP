'use strict';
// GeoRadar 4 – Ablauf für geteilte Karten: anlegen, Punkte per Bulk speichern, Adressen suchen, PLZ zuordnen.
const D=require('../dist/data-model.js');
const {createMapsStore,MapsError,MAX_POINTS_PER_MAP}=require('./maps-store.cjs');
const {createGeocoder,GeocodeError,addressQuery,queryHash}=require('./geocode.cjs');
const plz=require('./plz-lookup.cjs');

const MAX_POINTS_PER_CALL=500;
const COORD_SOURCE='Adresssuche Google Maps (SerpApi)';

function applyPostalCode(r){
  if(r.country!=='Deutschland'||!Number.isFinite(r.lon))return r;
  const found=plz.postalCodeAt(r.lon,r.lat);
  if(!found)return r;
  if(!r.postalCode||r.postalCode.length===2){r.postalCode=found;delete r.postalPrefix;r.geocodeNote=[r.geocodeNote,'PLZ aus Position ermittelt'].filter(Boolean).join(' · ');}
  else if(r.postalCode!==found){r.needsReview=true;r.geocodeNote=[r.geocodeNote,'Position liegt im PLZ-Gebiet '+found+', angegeben ist '+r.postalCode].filter(Boolean).join(' · ');}
  return r;
}
function initialStatus(r){
  if(Number.isFinite(r.lon)&&Number.isFinite(r.lat))return 'ok';
  return addressQuery(r)?'pending':'none';
}

function createMapsService({store=createMapsStore(),geocoder=createGeocoder(),now=()=>Date.now()}={}){
  async function geocodePending(map,{budgetMs=18000,concurrency=4}={}){
    const started=now(),pending=await store.listPoints(map.mapId,{status:'pending'});
    if(!pending.length)return {processed:0,remaining:0};
    const items=pending.map(p=>{const r=p.record,query=addressQuery(r);return {pointId:p.point_id,record:r,query,hash:query?queryHash(query):null};});
    const cache=await store.cacheGet([...new Set(items.filter(i=>i.hash).map(i=>i.hash))]);
    const updates=[],cacheRows=[];let stop=null;
    const finish=(item,result)=>{
      const r={...item.record};
      if(result.status==='ok'){r.lon=result.lon;r.lat=result.lat;r.locationAccuracy='approximate';r.coordinateSource=COORD_SOURCE;if(result.formatted_address)r.formattedAddress=result.formatted_address;if(result.ambiguous){r.needsReview=true;r.geocodeNote=[r.geocodeNote,'Mehrere Treffer, erster übernommen'].filter(Boolean).join(' · ');}applyPostalCode(r);}
      else r.geocodeNote=[r.geocodeNote,'Adresse nicht gefunden: '+item.query].filter(Boolean).join(' · ');
      updates.push({pointId:item.pointId,record:r,geocodeStatus:result.status==='ok'?'ok':'not_found'});
    };
    const misses=[];
    for(const item of items){if(!item.query){updates.push({pointId:item.pointId,record:item.record,geocodeStatus:'none'});continue;}const hit=cache.get(item.hash);if(hit)finish(item,hit);else misses.push(item);}
    // Gleiche Adresse nur einmal abfragen
    const byHash=new Map();for(const item of misses){if(!byHash.has(item.hash))byHash.set(item.hash,[]);byHash.get(item.hash).push(item);}
    const queue=[...byHash.values()];
    async function worker(){
      while(queue.length&&!stop){
        if(now()-started>budgetMs)return;
        const group=queue.shift(),item=group[0];
        try{const result=await geocoder.lookup(item.query,{country:item.record.country});cacheRows.push({query_hash:item.hash,query:item.query.slice(0,1000),status:result.status,lon:result.lon??null,lat:result.lat??null,formatted_address:result.formatted_address??null,source:'serpapi:google_maps'});for(const g of group)finish(g,result);}
        catch(e){stop=e;queue.unshift(group);}
      }
    }
    await Promise.all(Array.from({length:concurrency},worker));
    await store.cachePut(cacheRows);
    await store.upsertPoints(map.mapId,updates);
    const remaining=queue.reduce((n,g)=>n+g.length,0);
    return {processed:updates.length,remaining,error:stop?{code:stop instanceof GeocodeError?stop.code:'GEOCODING_FAILED',message:stop.message}:null};
  }

  async function summary(map){
    const rows=await store.listPoints(map.mapId);
    const s={gesamt:rows.length,mit_position:0,adresse_offen:0,nicht_gefunden:0,ohne_adresse:0,zu_pruefen:0};
    const notFound=[];
    for(const row of rows){
      const r=row.record;
      if(row.geocode_status==='pending')s.adresse_offen++;
      else if(Number.isFinite(r.lon))s.mit_position++;
      else if(row.geocode_status==='not_found'){s.nicht_gefunden++;if(notFound.length<20)notFound.push({id:r.id,name:r.name,suche:addressQuery(r)});}
      else s.ohne_adresse++;
      if(r.needsReview)s.zu_pruefen++;
    }
    return {stats:s,notFound};
  }

  return {
    async createMap(args={}){
      const map=await store.createMap({title:args.titel??args.title,description:args.beschreibung??args.description});
      return {karten_id:map.mapId,url:map.url,titel:map.title};
    },
    async addPoints(args={}){
      const map=await store.getMapById(args.karten_id);
      const mode=args.modus??'ergaenzen';
      if(!['ergaenzen','ersetzen'].includes(mode))throw new MapsError(400,'INVALID_MODE','modus muss ergaenzen oder ersetzen sein.');
      const input=args.punkte??[];
      if(!Array.isArray(input))throw new MapsError(400,'INVALID_POINTS','punkte muss eine Liste sein.');
      if(input.length>MAX_POINTS_PER_CALL)throw new MapsError(400,'TOO_MANY_POINTS','Höchstens '+MAX_POINTS_PER_CALL+' Punkte pro Aufruf. Bitte in mehreren Aufrufen mit modus ergaenzen senden.');
      let saved=0;
      if(input.length||mode==='ersetzen'){
        let data;
        try{data=D.validate({records:input.map(p=>p&&typeof p==='object'&&!Array.isArray(p)?{country:'DE',...p}:p)});}
        catch(e){throw new MapsError(400,'INVALID_POINTS',e.message);}
        if(mode==='ergaenzen'){const existing=await store.countPoints(map.mapId);if(existing+data.records.length>MAX_POINTS_PER_MAP)throw new MapsError(400,'MAP_FULL','Eine Karte fasst höchstens '+MAX_POINTS_PER_MAP+' Punkte.');}
        const rows=data.records.map(r=>{const status=initialStatus(r);if(status==='ok'){r.coordinateSource=r.coordinateSource||'Vom Agenten übergeben';applyPostalCode(r);}return {pointId:r.id,record:r,geocodeStatus:status};});
        if(mode==='ersetzen')await store.deleteAllPoints(map.mapId);
        await store.upsertPoints(map.mapId,rows);saved=rows.length;
      }
      let geocoding={processed:0,remaining:0,error:null};
      if(geocoder.configured())geocoding=await geocodePending(map,{budgetMs:args.zeitbudget_ms??18000});
      else{const {stats}=await summary(map);if(stats.adresse_offen)geocoding.error={code:'GEOCODING_NOT_CONFIGURED',message:'SERPAPI_KEY fehlt; Adressen bleiben offen.'};}
      await store.touchMap(map.mapId);
      const {stats,notFound}=await summary(map);
      return {karten_id:map.mapId,url:map.url,titel:map.title,modus:mode,gespeichert:saved,...stats,nicht_gefunden_beispiele:notFound,geocoding_fehler:geocoding.error||undefined,
        naechster_schritt:stats.adresse_offen?'Es sind noch '+stats.adresse_offen+' Adressen offen. punkte_hinzufuegen erneut mit dieser karten_id und leerer punkte-Liste aufrufen, bis adresse_offen 0 ist.':undefined};
    },
    async loadByKey(key){
      const map=await store.getMapByKey(key),rows=await store.listPoints(map.mapId);
      return {titel:map.title,beschreibung:map.description,aktualisiert:map.updatedAt,records:rows.map(r=>r.record),offen:rows.filter(r=>r.geocode_status==='pending').length};
    },
    async pointsByKey(key){const map=await store.getMapByKey(key);return (await store.listPoints(map.mapId)).map(r=>r.record);},
    geocodePending
  };
}

module.exports={createMapsService,applyPostalCode,MAX_POINTS_PER_CALL};
