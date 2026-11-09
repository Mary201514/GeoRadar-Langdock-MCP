'use strict';
// Browser-Test: Startseite zeigt Bestandskunden nur nach Anmeldung, dann alle als Punkte (synthetische Testfirmen, simulierte Anmeldung).
const assert=require('node:assert/strict'),path=require('node:path');
function playwright(){for(const p of ['playwright','/opt/npm-tools/node_modules/playwright',path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')]){try{return require(p);}catch{}}throw Error('Playwright nicht gefunden');}
const {chromium}=playwright();
const {createPreviewServer}=require('../serve.cjs');
const {createKunden}=require('../backend/kunden.cjs');
const {fakeKundenSupabase}=require('./fake-kunden.cjs');

const records=Array.from({length:1040},(_,i)=>({id:'TEST-'+String(i+1).padStart(5,'0'),name:'Testfirma '+(i+1),country:'Deutschland',postalCode:['88045','89073','78462','80331'][i%4],city:['Friedrichshafen','Ulm','Konstanz','München'][i%4],lon:[9.48,9.99,9.17,11.57][i%4]+(i%37)*0.003,lat:[47.65,48.4,47.66,48.14][i%4]+(i%41)*0.002,locationAccuracy:'approximate',status:i>=1000?'prospect':'existing',type:i%2?'Kläranlage / Abwasserbetrieb':'Industrieunternehmen',isFictional:i>=1000,attributes:{Vertriebsgebiet:'Süddeutschland'}}));

(async()=>{
  const db=fakeKundenSupabase(records);
  const kunden=createKunden({fetchImpl:db.fetchImpl,getConfig:db.getConfig});
  let signedIn=false;
  const user=async()=>{if(!signedIn){const e=Error('Bitte anmelden.');e.status=401;e.code='LOGIN_REQUIRED';throw e;}return {id:'00000000-0000-4000-8000-000000000001',email:'test@example.com'};};
  const web={
    user,
    auth:async req=>{if(req.method==='POST'){const b=await req.json();if(b.action==='login'){signedIn=true;return Response.json({user:{id:'u1',email:b.email}});}signedIn=false;return Response.json({ok:true});}
      return signedIn?Response.json({user:{id:'u1',email:'test@example.com'}}):Response.json({error:'LOGIN_REQUIRED',message:'Bitte anmelden.'},{status:401});},
    views:async()=>signedIn?Response.json({items:[]}):Response.json({error:'LOGIN_REQUIRED'},{status:401})
  };
  const server=createPreviewServer({web,kunden}).listen(4401,'127.0.0.1');
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1400,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:4401/');
    await page.waitForFunction(()=>/nach der Anmeldung/.test(document.querySelector('.customer-notice')?.textContent||''),null,{timeout:30000});
    assert.equal(await page.textContent('#company-total'),'0');
    // Anmelden über den vorhandenen Dialog
    await page.click('.customer-notice button');
    await page.fill('#web-email','test@example.com');await page.fill('#web-password','geheim-123456');
    await page.click('#web-login-submit');
    await page.waitForFunction(()=>/1040 Kunden geladen/.test(document.querySelector('.customer-notice')?.textContent||''),null,{timeout:30000});
    assert.equal(await page.textContent('#company-total'),'1040');
    assert.match(await page.textContent('.customer-notice'),/1000 Bestand, 40 fiktive/);
    // Neu laden mit bestehender Sitzung: Kunden kommen sofort
    await page.reload();
    await page.waitForFunction(()=>document.getElementById('company-total')?.textContent==='1040',null,{timeout:30000});
    // Geteilte Karten und gespeicherte Ansichten laden keine Kundenliste
    const p2=await browser.newPage();await p2.goto('http://127.0.0.1:4401/k/'+'Z'.repeat(24));await p2.waitForTimeout(3000);
    assert.equal(await p2.locator('.customer-notice').count(),0);
    assert.deepEqual(errors.filter(e=>!/openfreemap|Failed to fetch|NetworkError/.test(e)),[]);
    console.log('PASS: Startseite ohne Anmeldung leer mit Hinweis, nach Anmeldung 1.040 Kunden als Punkte, Sitzung bleibt nach Neuladen, geteilte Links unberührt.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
