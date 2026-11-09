'use strict';
// Vertragstests Bestandskundenliste: Laden nach Anmeldung, Embeddings über Langdock, semantische + Volltextsuche, MCP-Werkzeuge.
// Nur synthetische Testfirmen – keine echten Kundendaten im Repository.
const assert=require('node:assert/strict');
const {createKunden}=require('../backend/kunden.cjs');
const {createKundenApi}=require('../backend/kunden-api.cjs');
const {handle}=require('../mcp/server.cjs');
const {fakeKundenSupabase,fakeLangdock}=require('./fake-kunden.cjs');

function synth(n=1040){
  const typen=['Kläranlage / Abwasserbetrieb','Industrieunternehmen','Kommune / kommunaler Betrieb','Pumpenunternehmen','Bäderbetrieb'];
  const orte=[['88045','Friedrichshafen',9.48,47.65],['89073','Ulm',9.99,48.4],['78462','Konstanz',9.17,47.66],['80331','München',11.57,48.14],['6900','Bregenz',9.74,47.5]];
  return Array.from({length:n},(_,i)=>{const [plz,ort,lon,lat]=orte[i%5],typ=typen[i%5],fikt=i>=n-40;
    return {id:'TEST-'+String(i+1).padStart(5,'0'),name:(fikt?'Fiktiv ':'Testfirma ')+(i+1)+' '+typ.split(' ')[0],country:plz.length===4?'Österreich':'Deutschland',postalCode:plz,city:ort,lon,lat,locationAccuracy:'approximate',status:fikt?'prospect':'existing',type:typ,isFictional:fikt,attributes:{Vertriebsgebiet:i%2?'Süddeutschland':'Österreich','Vertreter (Test-Zuordnung)':i%3?'GD 2':'SR 42'}};});
}
function setup({langdockKey='ld_test_key_1234567890',status=200,dims=1536}={}){
  const records=synth(),db=fakeKundenSupabase(records),ld=fakeLangdock({status,dims});
  const fetchImpl=(url,o)=>String(url).includes('langdock')?ld.fetchImpl(url,o):db.fetchImpl(url,o);
  const kunden=createKunden({fetchImpl,getConfig:db.getConfig,getLangdock:()=>({key:langdockKey,region:'eu',base:'https://api.langdock.com'})});
  return {records,db,ld,kunden};
}
const results=[];
async function test(name,fn){try{await fn();results.push('✓ '+name);}catch(e){results.push('✗ '+name+'\n   '+e.stack.split('\n').slice(0,3).join('\n   '));process.exitCode=1;}}

(async()=>{
  await test('alle() lädt alle Sätze seitenweise (1.000 + 40)',async()=>{const {kunden,db}=setup();const r=await kunden.alle();assert.equal(r.length,1040);assert.equal(db.calls.filter(c=>c==='georadar_kunden').length,2);});

  await test('Embeddings: Langdock EU, ada-002, in Paketen; zweiter Lauf schreibt nichts; geänderter Text wird erneuert',async()=>{
    const {kunden,ld,db}=setup();
    const r=await kunden.embeddingsAktualisieren();assert.equal(r.geschrieben,1040);assert.equal(r.offen,0);
    assert.ok(ld.calls.every(c=>c.url==='https://api.langdock.com/openai/eu/v1/embeddings'&&c.model==='text-embedding-ada-002'&&c.auth==='Bearer ld_test_key_1234567890'&&c.n<=96));
    assert.equal((await kunden.embeddingsAktualisieren()).geschrieben,0);
    db.rows[5].such_text+=' Neue Bemerkung';assert.equal((await kunden.embeddingsAktualisieren()).geschrieben,1);
  });

  await test('Zeitbudget: Teilfortschritt und Hinweis auf erneuten Aufruf',async()=>{const {kunden}=setup();const r=await kunden.embeddingsAktualisieren({budgetMs:-1});assert.equal(r.geschrieben,0);assert.ok(r.offen>0);assert.match(r.naechster_schritt,/erneut/);});

  await test('Semantische Suche + Volltext, fiktive nur auf Wunsch',async()=>{
    const {kunden}=setup();await kunden.embeddingsAktualisieren();
    const r=await kunden.suchen({suchtext:'Kläranlage Abwasserbetrieb',anzahl:10});
    assert.equal(r.treffer.length>=10,true);assert.ok(r.treffer.slice(0,10).every(t=>/Kläranlage/.test(t.firmenname)));
    assert.ok(r.treffer[0].aehnlichkeit>0.5);assert.match(r.treffer[0].quelle,/semantisch/);
    assert.ok(r.treffer.every(t=>!t.ist_fiktiv));
    const f=await kunden.suchen({suchtext:'Fiktiv Kläranlage',anzahl:5,mit_fiktiven:true});assert.ok(f.treffer.some(t=>t.ist_fiktiv));
  });

  await test('Ohne Langdock-Key: nur Volltext mit Hinweis, kein Abbruch',async()=>{
    const {kunden}=setup({langdockKey:''});const r=await kunden.suchen({suchtext:'Ulm'});
    assert.ok(r.anzahl>0);assert.ok(r.treffer.every(t=>t.quelle==='Volltext'));assert.match(r.hinweis,/LANGDOCK_API_KEY/);
    await assert.rejects(kunden.embeddingsAktualisieren(),e=>e.code==='EMBEDDINGS_NOT_CONFIGURED');
  });

  await test('Langdock-Fehler: 401, Rate-Limit, falsche Dimension',async()=>{
    await assert.rejects(setup({status:401}).kunden.embeddingsAktualisieren(),e=>e.code==='EMBEDDINGS_NOT_CONFIGURED');
    await assert.rejects(setup({status:429}).kunden.embeddingsAktualisieren(),e=>e.code==='EMBEDDINGS_RATE_LIMIT');
    await assert.rejects(setup({dims:768}).kunden.embeddingsAktualisieren(),e=>e.code==='EMBEDDINGS_FAILED');
  });

  await test('Eingaben werden geprüft',async()=>{const {kunden}=setup();await assert.rejects(kunden.suchen({suchtext:''}),e=>e.code==='INVALID_QUERY');await assert.rejects(kunden.suchen({suchtext:'x'.repeat(501)}),e=>e.code==='INVALID_QUERY');});

  await test('MCP: kunden_suchen und kunden_embeddings_aktualisieren',async()=>{
    const {kunden}=setup();const names=handle({jsonrpc:'2.0',id:1,method:'tools/list'}).result.tools.map(t=>t.name);
    assert.ok(names.includes('kunden_suchen')&&names.includes('kunden_embeddings_aktualisieren'));
    const call=async(name,args)=>(await handle({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}},{kunden})).result;
    const e=await call('kunden_embeddings_aktualisieren',{});assert.match(e.content[0].text,/1040 Embeddings geschrieben/);
    const s=await call('kunden_suchen',{suchtext:'Bäderbetrieb Konstanz',anzahl:3});assert.equal(s.isError,undefined);assert.match(s.content[0].text,/Konstanz/);
    const bad=await call('kunden_suchen',{suchtext:''});assert.equal(bad.isError,true);
  });

  await test('/api/kunden: ohne Anmeldung 401, mit Anmeldung alle Kunden',async()=>{
    const {kunden}=setup();
    const nein=createKundenApi({views:{user:async()=>{const e=Error('Bitte anmelden.');e.status=401;e.code='LOGIN_REQUIRED';throw e;}},kunden});
    const r1=await nein(new Request('https://x.example/api/kunden'));assert.equal(r1.status,401);assert.equal((await r1.json()).records,undefined);
    const ja=createKundenApi({views:{user:async()=>({id:'u1',email:'test@example.com'})},kunden});
    const r2=await ja(new Request('https://x.example/api/kunden'));assert.equal(r2.status,200);const b=await r2.json();assert.equal(b.anzahl,1040);assert.equal(r2.headers.get('cache-control'),'private, no-store');
  });

  console.log(results.join('\n'));
})();
