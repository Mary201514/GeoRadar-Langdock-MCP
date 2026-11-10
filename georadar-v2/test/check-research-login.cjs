'use strict';
// Vertragstests: Recherche-Links mit echten Firmen nach Anmeldung, Positionssuche beim Speichern (Testdoubles, keine echten Firmen).
const assert=require('node:assert/strict');
const {createStore}=require('../backend/research-store.cjs');
const {createResearchApi}=require('../backend/research-api.cjs');
const {createMapsStore}=require('../backend/maps-store.cjs');
const {createGeocoder}=require('../backend/geocode.cjs');
const {createMapsService}=require('../backend/maps-service.cjs');
const {handle}=require('../mcp/server.cjs');
const {fakeSupabase}=require('./fake-supabase.cjs');
const {fakeMapsSupabase,fakeSerpApi}=require('./fake-maps.cjs');
const fixture=require('./research-fixture.cjs');

const places={'Lindauer Straße 116':[9.5085,47.6437,'Lindauer Str. 116, 88046 Friedrichshafen'],'Marienplatz 8':[11.5755,48.1374,'Marienplatz 8, 80331 München'],'Testwerk Süd, Ulm':[9.99,48.4,'Ulm']};
function setup({serpKey='serp_test_key_1234567890'}={}){
  const runs=fakeSupabase(),store=createStore({fetchImpl:runs.fetchImpl,getConfig:()=>({url:'https://contract-test.supabase.co',key:'sb_secret_'+'r'.repeat(40)}),baseUrl:'https://georadar.example'});
  const db=fakeMapsSupabase(),serp=fakeSerpApi(places);
  const mapsService=createMapsService({store:createMapsStore({fetchImpl:db.fetchImpl,getConfig:db.getConfig}),geocoder:createGeocoder({fetchImpl:serp.fetchImpl,getKey:()=>serpKey})});
  let signedIn=false;
  const views={user:async()=>{if(!signedIn){const e=Error('Bitte anmelden.');e.status=401;throw e;}return {id:'u1',email:'test@example.com'};}};
  const api=createResearchApi({store,getToken:()=>'t'.repeat(40),views});
  const save=async args=>(await handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'save_georadar_research',arguments:args}},{store,mapsService})).result;
  return {store,api,save,serp,db,login:v=>{signedIn=v;}};
}
const get=(api,code)=>api(new Request('https://georadar.example/api/research?code='+code));
const real=(code)=>({code,title:'Testrecherche ohne echte Firmen',research:{mode:'research',query:'Funktionstest'},records:[
  {id:'R1',name:'Testwerk Nord',country:'DE',street:'Lindauer Straße 116',postalCode:'88045',city:'Friedrichshafen',status:'prospect',isFictional:false,needsReview:true,sources:[{url:'https://example.invalid/r1',title:'Testquelle'}]},
  {id:'R2',name:'Testwerk Mitte',country:'DE',street:'Marienplatz 8',city:'München',status:'priority',isFictional:false,needsReview:false,sources:[{url:'https://example.invalid/r2',title:'Testquelle'}]},
  {id:'R3',name:'Testwerk Süd',country:'DE',city:'Ulm',postalPrefix:'89',status:'prospect',isFictional:false,needsReview:true,sources:[{url:'https://example.invalid/r3',title:'Testquelle'}]},
  {id:'R4',name:'Testwerk Ohne',country:'DE',status:'unknown',isFictional:false,needsReview:true,sources:[{url:'https://example.invalid/r4',title:'Testquelle'}]},
  {id:'R5',name:'Testwerk Fern',country:'AT',street:'Nirgendweg 1',postalCode:'6900',city:'Nirgendwo',status:'prospect',isFictional:false,needsReview:true,sources:[{url:'https://example.invalid/r5',title:'Testquelle'}]}]});
const results=[];
async function test(name,fn){try{await fn();results.push('✓ '+name);}catch(e){results.push('✗ '+name+'\n   '+e.stack.split('\n').slice(0,3).join('\n   '));process.exitCode=1;}}

(async()=>{
  await test('Speichern ergänzt Positionen über Adresse/Ort, PLZ aus Position, Link mit Anmeldehinweis',async()=>{
    const {save,store}=setup();const r=await save(real('WEB1'));
    assert.equal(r.isError,undefined,JSON.stringify(r));
    const sc=r.structuredContent;assert.equal(sc.persisted,true);assert.equal(sc.publiclyReadable,false);assert.equal(sc.loginRequired,true);
    assert.equal(sc.mapUrl,'https://georadar.example/WEB1');assert.match(r.content[0].text,/Kartenlink: https:\/\/georadar\.example\/WEB1 \(sichtbar nach Anmeldung/);
    assert.equal(sc.positionen.gefunden,3);assert.equal(sc.positionen.nicht_gefunden,1);assert.equal(sc.positionen.ohne_adresse,1);assert.equal(sc.positionen.auf_karte,3);
    const data=(await store.load('WEB1')).data,by=id=>data.records.find(x=>x.id===id);
    assert.equal(by('R1').postalCode,'88045');assert.equal(by('R1').needsReview,true);assert.match(by('R1').notes,/88046/);
    assert.equal(by('R2').postalCode,'80331');assert.equal(by('R2').locationAccuracy,'approximate');
    assert.equal(by('R3').postalCode.length,5);assert.equal(by('R3').postalPrefix,undefined);
    assert.equal(by('R4').lon,undefined);assert.equal(by('R5').lon,undefined);
  });

  await test('Wiederholung mit gleichen Daten: idempotent, Adressen aus dem Cache',async()=>{
    const {save,serp}=setup();await save(real('WEB2'));const n=serp.calls.length;
    const r=await save(real('WEB2'));assert.equal(r.isError,undefined,JSON.stringify(r));assert.equal(r.structuredContent.created,false);assert.equal(serp.calls.length,n);
  });

  await test('Belegte Koordinaten bleiben unverändert, keine Suche',async()=>{
    const {save,serp,store}=setup();const a=real('WEB3');a.records[0]={...a.records[0],lon:9.4,lat:47.7,locationAccuracy:'exact'};a.records=a.records.slice(0,1);
    await save(a);assert.equal(serp.calls.length,0);const rec=(await store.load('WEB3')).data.records[0];assert.equal(rec.lon,9.4);assert.equal(rec.locationAccuracy,'exact');
  });

  await test('Ohne SERPAPI_KEY wird trotzdem gespeichert, mit Hinweis',async()=>{
    const {save}=setup({serpKey:''});const r=await save(real('WEB4'));assert.equal(r.structuredContent.persisted,true);assert.match(r.content[0].text,/SERPAPI_KEY fehlt/);assert.equal(r.structuredContent.positionen.auf_karte,0);
  });

  await test('/api/research: Dummy öffentlich, echte Recherche nur angemeldet, unbekannte Kennung verrät nichts',async()=>{
    const {save,api,login}=setup();await save(fixture);await save(real('WEB5'));
    assert.equal((await get(api,'AB382')).status,200);
    const r1=await get(api,'WEB5');assert.equal(r1.status,401);assert.equal((await r1.json()).data,undefined);
    assert.equal((await get(api,'NICHTDA')).status,401);
    login(true);
    const r2=await get(api,'WEB5');assert.equal(r2.status,200);const b=await r2.json();assert.equal(b.loginRequired,true);assert.equal(b.data.records.length,5);
    assert.equal((await get(api,'NICHTDA')).status,404);
    assert.equal((await get(api,'../x')).status,400);
  });

  console.log(results.join('\n'));
})();
