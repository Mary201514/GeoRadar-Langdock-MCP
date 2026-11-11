'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const playwright=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
async function main(){
 const live=process.argv.includes('--live'),base='https://mangold-georadar.vercel.app',browser=await playwright.chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[],blockedWrites=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>document.addEventListener('georadar:map-ready',e=>window.__colorMap=e.detail));
  await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(!['GET','HEAD'].includes(req.method())){blockedWrites.push({path:url.pathname,method:req.method()});return route.abort();}
   if(!live&&url.origin===base){const files={'/':'index.html','/data-model.js':'data-model.js','/companies.js':'companies.js','/style.css':'style.css'};const file=files[url.pathname];if(file)return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(path.join(__dirname,'../dist',file))});}return route.continue();});
  assert.equal((await page.goto(base,{waitUntil:'domcontentloaded'})).status(),200);await page.waitForFunction(()=>window.__colorMap?.isStyleLoaded(),undefined,{timeout:60000});
  const records=[['DE',9.99,53.55],['DE',13.405,52.52],['AT',16.373,48.208],['AT',11.404,47.269]].map(([country,lon,lat],i)=>({id:'COLOR-DUMMY-'+i,name:'Fiktiver Farbtest '+i,country,lon,lat,locationAccuracy:'approximate',status:['existing','prospect','priority','unknown'][i],isFictional:true}));
  await page.evaluate(records=>document.dispatchEvent(new CustomEvent('georadar:tool-result',{detail:{structuredContent:{records}}})),records);await page.waitForFunction(()=>GeoRadarCompanies.getSnapshot().records.length===4);
  const state=await page.evaluate(()=>({statuses:GeoRadarData.statuses,fill:__colorMap.getPaintProperty('company-points','circle-color'),legend:getComputedStyle(document.querySelector('.legend .dot.prospect')).backgroundColor}));
  assert.equal(state.statuses.prospect.color,'#FFEA00');assert.equal(state.statuses.existing.color,'#2387ec');assert.equal(state.statuses.priority.color,'#e0444e');assert.equal(state.statuses.unknown.color,'#788592');assert(state.fill.includes('#FFEA00'));assert.equal(state.legend,'rgb(255, 234, 0)');
  await page.selectOption('#company-status','prospect');await page.waitForFunction(()=>document.querySelectorAll('#company-list button').length===1&&__colorMap.queryRenderedFeatures({layers:['company-points']}).some(f=>f.properties.id==='COLOR-DUMMY-1'));
  await page.waitForFunction(()=>{const points=__colorMap.queryRenderedFeatures({layers:['company-points']});return points.length>0&&points.every(f=>f.properties.status==='prospect');});
  const rendered=await page.evaluate(()=>[...new Set(__colorMap.queryRenderedFeatures({layers:['company-points']}).map(f=>f.properties.status))]);assert.deepEqual(rendered,['prospect']);assert.equal(errors.length,0);
  fs.mkdirSync(path.join(__dirname,'../verification'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../verification',live?'yellow-live.png':'yellow-candidate.png')});
  const report={mode:live?'actual production':'current production with only candidate color assets substituted',prospectColor:state.statuses.prospect.color,legend:state.legend,rendered,otherStatusColorsUnchanged:true,errors,blockedWrites,testData:'Four fictitious records injected only into browser memory; no database writes.'};fs.writeFileSync(path.join(__dirname,'../verification',live?'yellow-live.json':'yellow-candidate.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
