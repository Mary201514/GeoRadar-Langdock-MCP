'use strict';
// GeoRadar 4 – Speicher für geteilte Karten (Supabase REST, nur serverseitig mit Secret-Key).
const crypto=require('node:crypto');

class MapsError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}

const MAPS='georadar_maps',POINTS='georadar_map_points',CACHE='georadar_geocode_cache';
const MAX_POINTS_PER_MAP=10000;

function newShareKey(){return crypto.randomBytes(18).toString('base64url');} // 144 Bit, 24 Zeichen
function isShareKey(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{22,64}$/.test(value);}
function isUuid(value){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);}

function defaultConfig(){return {url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY};}
function defaultBaseUrl(){const v=process.env.GEORADAR_PUBLIC_URL;return typeof v==='string'&&/^https:\/\/[^/\s]+$/.test(v.replace(/\/$/,''))?v.replace(/\/$/,''):'https://mangold-georadar.vercel.app';}

function createMapsStore({fetchImpl=(...args)=>fetch(...args),getConfig=defaultConfig,getBaseUrl=defaultBaseUrl}={}){
  function config(){
    const c=getConfig();let u;try{u=new URL(c.url);}catch{}
    if(!u||u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.username||u.password||u.search||u.hash||u.port||!['','/'].includes(u.pathname)||typeof c.key!=='string'||c.key.length<32||/\s/.test(c.key)||c.key.startsWith('sb_publishable_'))
      throw new MapsError(503,'STORAGE_NOT_CONFIGURED','Supabase ist serverseitig nicht eingerichtet (SUPABASE_URL und SUPABASE_SECRET_KEY).');
    return {origin:u.origin,key:c.key};
  }
  async function request(path,options={}){
    const c=config();let response;
    try{response=await fetchImpl(c.origin+'/rest/v1/'+path,{...options,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:c.key,...(c.key.startsWith('eyJ')?{Authorization:'Bearer '+c.key}:{}),'Content-Type':'application/json',...options.headers}});}
    catch{throw new MapsError(502,'STORAGE_UNREACHABLE','Supabase konnte nicht erreicht werden.');}
    if(!response.ok){
      let pg;try{pg=(await response.json()).code;}catch{}
      if(['42P01','PGRST205'].includes(pg))throw new MapsError(503,'STORAGE_SCHEMA_MISSING','Die Tabellen für geteilte Karten fehlen. Bitte Migration 20261109_georadar_shared_maps.sql ausführen.');
      if(response.status===409||pg==='23505')throw new MapsError(409,'CONFLICT','Datensatz existiert bereits.');
      throw new MapsError(502,'STORAGE_REQUEST_FAILED','Supabase hat die Anfrage abgelehnt.');
    }
    if(response.status===204)return null;
    const text=await response.text();if(!text)return null;
    try{return JSON.parse(text);}catch{throw new MapsError(502,'STORAGE_INVALID_RESPONSE','Ungültige Antwort der Datenbank.');}
  }
  const q=params=>new URLSearchParams(params).toString();
  const url=key=>getBaseUrl()+'/k/'+key;
  const view=row=>({mapId:row.id,title:row.title,description:row.description||undefined,url:url(row.share_key),createdAt:row.created_at,updatedAt:row.updated_at});

  return {
    url,
    async createMap({title,description}={}){
      if(typeof title!=='string'||!title.trim()||title.trim().length>160)throw new MapsError(400,'INVALID_TITLE','titel: 1–160 Zeichen.');
      if(description!==undefined&&(typeof description!=='string'||description.length>2000))throw new MapsError(400,'INVALID_DESCRIPTION','beschreibung: höchstens 2.000 Zeichen.');
      for(let attempt=0;attempt<3;attempt++){
        try{const rows=await request(MAPS,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({share_key:newShareKey(),title:title.trim(),...(description?{description:description.trim()}:{})})});if(!Array.isArray(rows)||!rows[0])throw new MapsError(502,'STORAGE_INVALID_RESPONSE','Karte wurde nicht bestätigt.');return view(rows[0]);}
        catch(e){if(!(e instanceof MapsError&&e.code==='CONFLICT'))throw e;}
      }
      throw new MapsError(500,'KEY_COLLISION','Kein freier Link-Schlüssel gefunden.');
    },
    async getMapById(id){
      if(!isUuid(id))throw new MapsError(400,'INVALID_MAP_ID','karten_id muss die beim Anlegen gelieferte UUID sein.');
      const rows=await request(MAPS+'?'+q({id:'eq.'+id,select:'id,share_key,title,description,created_at,updated_at',limit:'1'}));
      if(!rows?.[0])throw new MapsError(404,'MAP_NOT_FOUND','Keine Karte mit dieser karten_id.');
      return {...view(rows[0]),shareKey:rows[0].share_key};
    },
    async getMapByKey(key){
      if(!isShareKey(key))throw new MapsError(404,'MAP_NOT_FOUND','Karte nicht gefunden.');
      const rows=await request(MAPS+'?'+q({share_key:'eq.'+key,select:'id,share_key,title,description,created_at,updated_at',limit:'1'}));
      if(!rows?.[0])throw new MapsError(404,'MAP_NOT_FOUND','Karte nicht gefunden.');
      return {...view(rows[0]),shareKey:rows[0].share_key};
    },
    async touchMap(id){await request(MAPS+'?'+q({id:'eq.'+id}),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({updated_at:new Date().toISOString()})});},
    async countPoints(mapId){
      const c=config();let response;
      try{response=await fetchImpl(c.origin+'/rest/v1/'+POINTS+'?'+q({map_id:'eq.'+mapId,select:'point_id'}),{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:c.key,...(c.key.startsWith('eyJ')?{Authorization:'Bearer '+c.key}:{}),Prefer:'count=exact',Range:'0-0'}});}
      catch{throw new MapsError(502,'STORAGE_UNREACHABLE','Supabase konnte nicht erreicht werden.');}
      const m=/\/(\d+)$/.exec(response.headers.get('content-range')||'');return m?Number(m[1]):0;
    },
    async listPoints(mapId,{status,limit=MAX_POINTS_PER_MAP}={}){
      const out=[];
      for(let offset=0;offset<limit;offset+=1000){
        const rows=await request(POINTS+'?'+q({map_id:'eq.'+mapId,select:'point_id,record,geocode_status',order:'created_at.asc,point_id.asc',limit:String(Math.min(1000,limit-offset)),offset:String(offset),...(status?{geocode_status:'eq.'+status}:{})}));
        if(!Array.isArray(rows))throw new MapsError(502,'STORAGE_INVALID_RESPONSE','Ungültige Antwort der Datenbank.');
        out.push(...rows);if(rows.length<1000)break;
      }
      return out;
    },
    async deleteAllPoints(mapId){await request(POINTS+'?'+q({map_id:'eq.'+mapId}),{method:'DELETE',headers:{Prefer:'return=minimal'}});},
    async upsertPoints(mapId,rows){
      for(let i=0;i<rows.length;i+=500){
        const chunk=rows.slice(i,i+500).map(r=>({map_id:mapId,point_id:r.pointId,record:r.record,geocode_status:r.geocodeStatus,updated_at:new Date().toISOString()}));
        await request(POINTS+'?on_conflict=map_id,point_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(chunk)});
      }
    },
    async cacheGet(hashes){
      const out=new Map();
      for(let i=0;i<hashes.length;i+=150){
        const rows=await request(CACHE+'?'+q({query_hash:'in.('+hashes.slice(i,i+150).join(',')+')',select:'query_hash,status,lon,lat,formatted_address'}));
        for(const row of rows||[])out.set(row.query_hash,row);
      }
      return out;
    },
    async cachePut(rows){
      if(!rows.length)return;
      await request(CACHE+'?on_conflict=query_hash',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
    }
  };
}

module.exports={createMapsStore,MapsError,isShareKey,isUuid,newShareKey,MAX_POINTS_PER_MAP};
