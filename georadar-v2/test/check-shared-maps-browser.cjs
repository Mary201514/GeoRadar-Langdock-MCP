'use strict';
// Browser-Test GeoRadar 4: geteilte Karte /k/<schlüssel> mit PLZ-Ebene, Merkmalfiltern und Route (Testdoubles, Chrome headless).
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
function playwright(){for(const p of ['playwright','/opt/npm-tools/node_modules/playwright',path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')]){try{return require(p);}catch{}}throw Error('Playwright nicht gefunden');}
const {chromium}=playwright();
const {createPreviewServer}=require('../serve.cjs');
const {createMapsStore}=require('../backend/maps-store.cjs');
const {createGeocoder}=require('../backend/geocode.cjs');
const {createRouter}=require('../backend/route.cjs');
const {createMapsService}=require('../backend/maps-service.cjs');
const {createMapsApi}=require('../backend/maps-api.cjs');
const {fakeMapsSupabase,fakeSerpApi,fakeOrs}=require('./fake-maps.cjs');

(async()=>{
  const db=fakeMapsSupabase(),ors=fakeOrs();
  const store=createMapsStore({fetchImpl:db.fetchImpl,getConfig:db.getConfig,getBaseUrl:()=>'http://127.0.0.1:4399'});
  const service=createMapsService({store,geocoder:createGeocoder({fetchImpl:fakeSerpApi({}).fetchImpl,getKey:()=>'serp_test_key_1234567890'})});
  const maps=createMapsApi({service,router:createRouter({fetchImpl:ors.fetchImpl,getKey:()=>'ors_test_key_1234567890'})});
  const {karten_id,url}=await service.createMap({titel:'Kläranlagen Bodensee – Test',beschreibung:'Fiktive Testpunkte'});
  const types=['Kläranlage','Industrie','Kommune'],pot=['hoch','mittel','niedrig'];
  const punkte=Array.from({length:24},(_,i)=>({id:'t'+i,name:'Testbetrieb '+(i+1),lon:9.2+(i%6)*0.18,lat:47.76+Math.floor(i/6)*0.12,status:['existing','prospect','priority','unknown'][i%4],type:types[i%3],attributes:{Potenzial:pot[i%3],Mitarbeiter:20+i*15,Wartungsvertrag:i%2===0},isFictional:true}));
  const added=await service.addPoints({karten_id,punkte});assert.equal(added.mit_position,24);assert.ok(db.points.filter(p=>p.record.postalCode).length>=20,'PLZ für Landpunkte ermittelt');
  const server=createPreviewServer({maps,mapsService:service}).listen(4399,'127.0.0.1');
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1500,height:950}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>document.addEventListener('georadar:map-ready',e=>{window.__map=e.detail;}));
  try{
    await page.goto(url.replace('http://127.0.0.1:4399','http://127.0.0.1:4399'),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.GeoRadarSharedMap?.loaded===true,null,{timeout:30000});
    assert.match(await page.textContent('#bridge-state'),/24 Punkte geladen/);
    assert.equal(await page.textContent('#company-total'),'24');
    await page.waitForFunction(()=>window.__map&&window.__map.getSource('plz5')&&window.__map.isSourceLoaded('plz5'),null,{timeout:60000});
    await page.waitForFunction(()=>(window.__map.getFeatureState({source:'plz5',id:window.GeoRadarCompanies.getSnapshot().records.find(r=>r.postalCode).postalCode})?.n||0)>=1,null,{timeout:15000});
    // Merkmalfilter
    assert.equal(await page.isVisible('#attribute-filters'),true);
    await page.click('#attribute-filters summary');
    await page.locator('#attribute-filters label').filter({hasText:'hoch · 8'}).click();
    assert.equal(await page.textContent('#company-total'),'8');
    await page.locator('#attribute-filters label').filter({hasText:'Kläranlage · 8'}).click(); // Typ Kläranlage ∩ Potenzial hoch (i%3==0 beide)
    assert.equal(await page.textContent('#company-total'),'8');
    await page.locator('#attribute-filters label').filter({hasText:'Industrie · 8'}).click();
    assert.equal(await page.textContent('#company-total'),'8');
    await page.click('#attribute-filter-reset');assert.equal(await page.textContent('#company-total'),'24');
    // Route
    await page.locator('#attribute-filters label').filter({hasText:'hoch · 8'}).click();
    await page.click('#route-add-filtered');assert.equal(await page.textContent('#route-count'),'8');
    await page.click('#route-run');
    await page.waitForFunction(()=>document.querySelectorAll('#route-list li').length>0,null,{timeout:20000});
    assert.equal(await page.locator('#route-list li').count(),10); // Start + 8 + zurück
    assert.match(await page.textContent('#route-state'),/Optimierte Reihenfolge · 9 km/);
    assert.equal(await page.locator('#route-links a').count(),1);
    assert.ok(ors.calls.some(c=>c.path==='/optimization'));
    await page.evaluate(()=>window.__map.jumpTo({center:[9.65,47.95],zoom:9.3}));
    await page.waitForTimeout(1500);
    fs.mkdirSync(path.join(__dirname,'output'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'output','shared-map.png')});
    // Popup-Knopf „Zur Route“
    const html=await page.evaluate(()=>{const div=document.createElement('div');window.GeoRadarPopupExtras(window.GeoRadarCompanies.getSnapshot().records[0],div);return div.textContent;});
    assert.match(html,/In der Route|Zur Route/);
    // Unbekannter Schlüssel
    const p2=await browser.newPage();await p2.goto('http://127.0.0.1:4399/k/'+'Z'.repeat(24));await p2.waitForFunction(()=>/nicht geladen/.test(document.getElementById('bridge-state').textContent),null,{timeout:20000});
    assert.deepEqual(errors.filter(e=>!/tiles\.openfreemap|Failed to fetch|NetworkError/.test(e)),[]);
    console.log('PASS: geteilte Karte lädt 24 Punkte, PLZ-Flächen mit Zählung, Typ-/Merkmalfilter, Auswahl und optimierte Route, unbekannter Link mit Hinweis. Screenshot: test/output/shared-map.png');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
