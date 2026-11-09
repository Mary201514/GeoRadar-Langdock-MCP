'use strict';
// Vertragstests GeoRadar 4: karte_anlegen, punkte_hinzufuegen (Bulk, Geocoding, Cache, PLZ), /api/karte, /api/route.
const assert=require('node:assert/strict');
const {handle}=require('../mcp/server.cjs');
const {createMapsStore}=require('../backend/maps-store.cjs');
const {createGeocoder}=require('../backend/geocode.cjs');
const {createRouter}=require('../backend/route.cjs');
const {createMapsService}=require('../backend/maps-service.cjs');
const {createMapsApi}=require('../backend/maps-api.cjs');
const {fakeMapsSupabase,fakeSerpApi,fakeOrs}=require('./fake-maps.cjs');

const places={'Unter den Linden 1':[13.3969,52.5170,'Unter den Linden 1, 10117 Berlin'],'Lindauer Straße 116':[9.5085,47.6437,'Lindauer Str. 116, 88046 Friedrichshafen'],'Marienplatz 8':[11.5755,48.1374,'Marienplatz 8, 80331 München'],'Hafenstraße':[9.99,53.54,'Hafenstraße, Hamburg',true]};
function setup({serpKey='serp_test_key_1234567890',orsKey='ors_test_key_1234567890'}={}){
  const db=fakeMapsSupabase(),serp=fakeSerpApi(places),ors=fakeOrs();
  const store=createMapsStore({fetchImpl:db.fetchImpl,getConfig:db.getConfig,getBaseUrl:()=>'https://karte.example'});
  const service=createMapsService({store,geocoder:createGeocoder({fetchImpl:serp.fetchImpl,getKey:()=>serpKey})});
  const api=createMapsApi({service,router:createRouter({fetchImpl:ors.fetchImpl,getKey:()=>orsKey})});
  const call=async(name,args)=>{const r=await handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}},{mapsService:service});return r.result;};
  return {db,serp,ors,service,api,call};
}
const get=(api,key)=>api.karte(new Request('https://karte.example/api/karte?key='+encodeURIComponent(key)));
const route=(api,body,headers={})=>api.route(new Request('https://karte.example/api/route',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));
const results=[];
async function test(name,fn){try{await fn();results.push('✓ '+name);}catch(e){results.push('✗ '+name+'\n   '+e.stack.split('\n').slice(0,3).join('\n   '));process.exitCode=1;}}

(async()=>{
  await test('Werkzeuge werden gelistet',async()=>{const r=handle({jsonrpc:'2.0',id:1,method:'tools/list'});const names=r.result.tools.map(t=>t.name);for(const n of ['show_georadar_map','save_georadar_research','load_georadar_research','karte_anlegen','punkte_hinzufuegen'])assert.ok(names.includes(n),n);});

  await test('karte_anlegen liefert kryptischen Link und karten_id',async()=>{const {call,db}=setup();const r=await call('karte_anlegen',{titel:'Test Süd'});assert.equal(r.isError,undefined);assert.match(r.structuredContent.url,/^https:\/\/karte\.example\/k\/[A-Za-z0-9_-]{24}$/);assert.match(r.structuredContent.karten_id,/^[0-9a-f-]{36}$/);assert.equal(db.maps.length,1);
    const bad=await call('karte_anlegen',{titel:''});assert.equal(bad.isError,true);});

  await test('Bulk mit Adressen, Koordinaten, Cache, PLZ und Prüfhinweisen',async()=>{
    const {call,serp,db}=setup();const {karten_id,url}=(await call('karte_anlegen',{titel:'Bulk'})).structuredContent;
    const punkte=[
      {id:'p1',name:'Rathaus München',lon:11.5755,lat:48.1374,type:'Kommune',status:'existing',attributes:{Potenzial:'hoch',Einwohner:1500000,aktiv:true}},
      {id:'p2',name:'Firma Berlin',address:'Unter den Linden 1, 10117 Berlin',type:'Industrie',status:'prospect',attributes:{Potenzial:'mittel'}},
      {id:'p3',name:'Zweite Firma gleiche Adresse',address:'Unter den Linden 1, 10117 Berlin',type:'Industrie'},
      {id:'p4',name:'Mangold',street:'Lindauer Straße 116',postalCode:'88045',city:'Friedrichshafen',type:'Eigen'},
      {id:'p5',name:'Unbekannt GmbH',address:'Nirgendwostraße 99, 99999 Nirgendwo'},
      {id:'p6',name:'Nur Name'},
      {id:'p7',name:'Hafen',address:'Hafenstraße, Hamburg'}
    ];
    const r=(await call('punkte_hinzufuegen',{karten_id,punkte})).structuredContent;
    assert.equal(r.gespeichert,7);assert.equal(r.gesamt,7);assert.equal(r.mit_position,5);assert.equal(r.nicht_gefunden,1);assert.equal(r.ohne_adresse,1);assert.equal(r.adresse_offen,0);assert.equal(r.url,url);
    assert.equal(serp.calls.length,4,'gleiche Adresse nur einmal suchen');
    const rec=id=>db.points.find(p=>p.point_id===id).record;
    assert.equal(rec('p1').postalCode,'80331');assert.match(rec('p1').geocodeNote,/PLZ aus Position/);
    assert.equal(rec('p2').locationAccuracy,'approximate');assert.equal(rec('p2').postalCode,'10117');assert.equal(rec('p3').lon,rec('p2').lon);
    assert.equal(rec('p4').needsReview,true);assert.match(rec('p4').geocodeNote,/88046/);
    assert.equal(rec('p7').needsReview,true);assert.match(rec('p7').geocodeNote,/Mehrere Treffer/);
    assert.equal(r.zu_pruefen,2);assert.equal(r.nicht_gefunden_beispiele[0].id,'p5');
    // erneuter Import: alles aus dem Cache
    const before=serp.calls.length;await call('punkte_hinzufuegen',{karten_id,punkte:[{id:'p8',name:'Noch eine',address:'Unter den Linden 1, 10117 Berlin'}]});assert.equal(serp.calls.length,before);
    assert.equal(db.points.length,8);
    // ersetzen
    const rep=(await call('punkte_hinzufuegen',{karten_id,modus:'ersetzen',punkte:[{id:'x1',name:'Neu',lon:13.4,lat:52.52}]})).structuredContent;assert.equal(rep.gesamt,1);assert.equal(db.points.length,1);
  });

  await test('Zeitbudget: offene Adressen werden im nächsten Aufruf fertig gesucht',async()=>{
    const {call,service}=setup();const {karten_id}=(await call('karte_anlegen',{titel:'Budget'})).structuredContent;
    const r=await service.addPoints({karten_id,punkte:[{id:'a',name:'A',address:'Marienplatz 8, München'},{id:'b',name:'B',address:'Unter den Linden 1, Berlin'}],zeitbudget_ms:-1});
    assert.equal(r.adresse_offen,2);assert.match(r.naechster_schritt,/erneut/);
    const r2=(await call('punkte_hinzufuegen',{karten_id,punkte:[]})).structuredContent;assert.equal(r2.adresse_offen,0);assert.equal(r2.mit_position,2);assert.equal(r2.gespeichert,0);
  });

  await test('Ungültige Eingaben werden abgelehnt, nichts gespeichert',async()=>{
    const {call,db}=setup();const {karten_id}=(await call('karte_anlegen',{titel:'Fehler'})).structuredContent;
    const r=await call('punkte_hinzufuegen',{karten_id,punkte:[{id:'a',name:'A',attributes:{x:{y:1}}}]});assert.equal(r.isError,true);assert.match(r.content[0].text,/INVALID_POINTS/);assert.equal(db.points.length,0);
    const r2=await call('punkte_hinzufuegen',{karten_id:'falsch',punkte:[]});assert.equal(r2.isError,true);
    const r3=await call('punkte_hinzufuegen',{karten_id,punkte:Array.from({length:501},(_,i)=>({id:'i'+i,name:'n'}))});assert.match(r3.content[0].text,/TOO_MANY_POINTS/);
    const r4=await call('punkte_hinzufuegen',{karten_id,punkte:[{id:'d',name:'D'},{id:'d',name:'E'}]});assert.match(r4.content[0].text,/Doppelte ID/);
  });

  await test('Ohne SerpApi-Schlüssel bleiben Adressen offen, Hinweis statt Fehler',async()=>{
    const {call}=setup({serpKey:''});const {karten_id}=(await call('karte_anlegen',{titel:'Ohne Key'})).structuredContent;
    const r=(await call('punkte_hinzufuegen',{karten_id,punkte:[{id:'a',name:'A',address:'Marienplatz 8, München'}]})).structuredContent;
    assert.equal(r.adresse_offen,1);assert.equal(r.geocoding_fehler.code,'GEOCODING_NOT_CONFIGURED');
  });

  await test('/api/karte liefert Punkte nur mit gültigem Schlüssel',async()=>{
    const {call,api}=setup();const {karten_id,url}=(await call('karte_anlegen',{titel:'Lesen',beschreibung:'Test'})).structuredContent;
    await call('punkte_hinzufuegen',{karten_id,punkte:[{id:'a',name:'A',lon:11.57,lat:48.13,attributes:{Typ2:'x'}}]});
    const key=url.split('/k/')[1];const res=await get(api,key);assert.equal(res.status,200);const body=await res.json();
    assert.equal(body.titel,'Lesen');assert.equal(body.records.length,1);assert.equal(body.routing,true);assert.equal(body.karten_id,undefined);assert.equal(res.headers.get('x-robots-tag'),'noindex, nofollow');
    assert.equal((await get(api,'A'.repeat(24))).status,404);assert.equal((await get(api,'kurz')).status,404);assert.equal((await get(api,'<script>')).status,404);
  });

  await test('/api/route optimiert über OpenRouteService mit gespeicherten Koordinaten',async()=>{
    const {call,api,ors}=setup();const {karten_id,url}=(await call('karte_anlegen',{titel:'Route'})).structuredContent;const key=url.split('/k/')[1];
    await call('punkte_hinzufuegen',{karten_id,punkte:[{id:'a',name:'A',lon:9.6,lat:47.7},{id:'b',name:'B',lon:9.9,lat:48.0},{id:'c',name:'C',lon:10.0,lat:48.4},{id:'n',name:'Ohne Position'}]});
    let res=await route(api,{key,ids:['a','b','c','n'],start:'mangold',rundtour:true});assert.equal(res.status,200);let body=await res.json();
    assert.deepEqual(body.sequence.map(s=>s.id),['mangold','c','b','a','mangold']);assert.equal(body.skipped,1);assert.equal(body.segments.length,4);assert.equal(body.geometry.type,'LineString');
    assert.deepEqual(ors.calls[0].body.vehicles[0].start,[9.508511741063957,47.64373714669217]);
    res=await route(api,{key,ids:['a','b'],start:'a',rundtour:false});body=await res.json();assert.deepEqual(body.sequence.map(s=>s.id),['a','b']);assert.equal(body.optimized,false);
    assert.equal((await route(api,{key,ids:['a'],start:'zz'})).status,400);
    assert.equal((await route(api,{key,ids:['n']})).status,400);
    assert.equal((await route(api,{key:'B'.repeat(24),ids:['a']})).status,404);
    assert.equal((await route(api,{key,ids:Array.from({length:49},(_,i)=>'x'+i)})).status,400);
    assert.equal((await route(api,{key,ids:['a']},{Origin:'https://evil.example'})).status,403);
    // Browser kann keine fremden Koordinaten einschleusen
    await route(api,{key,ids:['a'],coordinates:[[0,0]]});assert.ok(!JSON.stringify(ors.calls.at(-1).body).includes('[0,0]'));
  });

  await test('Ohne ORS-Schlüssel meldet die Karte routing=false und die Route 503',async()=>{
    const {call,api}=setup({orsKey:''});const {karten_id,url}=(await call('karte_anlegen',{titel:'Ohne ORS'})).structuredContent;const key=url.split('/k/')[1];
    await call('punkte_hinzufuegen',{karten_id,punkte:[{id:'a',name:'A',lon:9.6,lat:47.7}]});
    assert.equal((await (await get(api,key)).json()).routing,false);const res=await route(api,{key,ids:['a']});assert.equal(res.status,503);assert.equal((await res.json()).error,'ROUTING_NOT_CONFIGURED');
  });

  await test('Rate-Limit für Routen je Karte',async()=>{
    const {call,api}=setup();const {karten_id,url}=(await call('karte_anlegen',{titel:'Limit'})).structuredContent;const key=url.split('/k/')[1];
    await call('punkte_hinzufuegen',{karten_id,punkte:[{id:'a',name:'A',lon:9.6,lat:47.7}]});
    let last;for(let i=0;i<31;i++)last=await route(api,{key,ids:['a']});assert.equal(last.status,429);
  });

  console.log(results.join('\n'));
})();
