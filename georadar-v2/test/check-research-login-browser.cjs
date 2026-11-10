'use strict';
// Browser-Test: /KENNUNG einer echten Recherche zeigt Anmeldehinweis, nach Anmeldung die Firmen (Testdoubles, keine echten Firmen).
const assert=require('node:assert/strict'),path=require('node:path');
function playwright(){for(const p of ['playwright','/opt/npm-tools/node_modules/playwright',path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')]){try{return require(p);}catch{}}throw Error('Playwright nicht gefunden');}
const {chromium}=playwright();
const {createPreviewServer}=require('../serve.cjs');
const {createStore}=require('../backend/research-store.cjs');
const {fakeSupabase}=require('./fake-supabase.cjs');
(async()=>{
  const runs=fakeSupabase(),store=createStore({fetchImpl:runs.fetchImpl,getConfig:()=>({url:'https://contract-test.supabase.co',key:'sb_secret_'+'r'.repeat(40)})});
  await store.save({code:'WEBTEST',title:'Testrecherche',research:{mode:'research',query:'Funktionstest'},records:[1,2,3].map(i=>({id:'R'+i,name:'Testwerk '+i,country:'DE',postalCode:'8804'+i,city:'Friedrichshafen',lon:9.45+i*0.03,lat:47.66,locationAccuracy:'approximate',status:'prospect',isFictional:false,needsReview:true,sources:[{url:'https://example.invalid/'+i,title:'Testquelle'}]}))});
  let signedIn=false;
  const web={user:async()=>{if(!signedIn){const e=Error('Bitte anmelden.');e.status=401;throw e;}return {id:'u1',email:'test@example.com'};},
    auth:async req=>{if(req.method==='POST'){const b=await req.json();if(b.action==='login'){signedIn=true;return Response.json({user:{id:'u1',email:b.email}});}signedIn=false;return Response.json({ok:true});}return signedIn?Response.json({user:{id:'u1',email:'test@example.com'}}):Response.json({error:'LOGIN_REQUIRED'},{status:401});},
    views:async()=>signedIn?Response.json({items:[]}):Response.json({error:'LOGIN_REQUIRED'},{status:401})};
  const server=createPreviewServer({web,store,kunden:{alle:async()=>[]}}).listen(4402,'127.0.0.1');
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1400,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:4402/WEBTEST');
    await page.waitForFunction(()=>/Anmeldung erforderlich/.test(document.getElementById('bridge-state')?.textContent||''),null,{timeout:30000});
    assert.equal(await page.textContent('#company-total'),'0');
    await page.getByRole('button',{name:'Anmelden'}).first().click();
    await page.fill('#web-email','test@example.com');await page.fill('#web-password','geheim-123456');await page.click('#web-login-submit');
    await page.waitForFunction(()=>/3 Unternehmen geladen/.test(document.getElementById('bridge-state')?.textContent||''),null,{timeout:30000});
    assert.equal(await page.textContent('#company-total'),'3');
    assert.ok((await page.locator('#bridge-state + p').textContent()).includes('nur nach Anmeldung'));
    assert.deepEqual(errors.filter(e=>!/openfreemap|Failed to fetch|NetworkError/.test(e)),[]);
    console.log('PASS: echte Recherche erst nach Anmeldung sichtbar, dann 3 Firmen auf der Karte.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
