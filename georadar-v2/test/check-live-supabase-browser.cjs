'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const playwright=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
async function main(){
 const base='https://mangold-georadar.vercel.app';
 const response=await fetch(base+'/api/research?code=AB382');assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.persisted,true);assert.equal(saved.data.records.length,4);assert(saved.data.records.every(r=>r.isFictional===true));
 const browser=await playwright.chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>document.addEventListener('georadar:map-ready',e=>window.__liveMap=e.detail));
  assert.equal((await page.goto(base+'/AB382')).status(),200);
  await page.waitForFunction(()=>window.GeoRadarCompanies?.getSnapshot().records.length===4&&window.__liveMap?.isStyleLoaded(),undefined,{timeout:60000});
  await page.waitForFunction(()=>new Set(window.__liveMap.queryRenderedFeatures({layers:['company-points']}).map(f=>f.properties.id)).size===4,undefined,{timeout:20000});
  const result=await page.evaluate(()=>({heading:document.querySelector('h1').textContent,bridge:document.getElementById('bridge-state').textContent,records:GeoRadarCompanies.getSnapshot().records.map(r=>({id:r.id,status:r.status,isFictional:r.isFictional,sourceCount:r.sources?.length})),visibleMarkers:[...new Set(window.__liveMap.queryRenderedFeatures({layers:['company-points']}).map(f=>f.properties.id))],colors:window.__liveMap.getPaintProperty('company-points','circle-color')}));
  assert.equal(result.heading,'GEORADAR');assert.equal(new Set(result.records.map(r=>r.status)).size,4);assert.match(result.bridge,/Supabase.*AB382.*4/);assert.equal(errors.length,0);
  fs.mkdirSync(path.join(__dirname,'../verification'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../verification/live-supabase-AB382.png')});
  const report={test:'Real Supabase seeded via SQL; Vercel REST read; standalone production browser map. Langdock MCP write and embedded chat UI not tested.',result,errors};fs.writeFileSync(path.join(__dirname,'../verification/live-supabase-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
