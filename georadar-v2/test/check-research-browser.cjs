'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const {createPreviewServer}=require('../serve.cjs'),{createStore}=require('../backend/research-store.cjs'),{fakeSupabase}=require('./fake-supabase.cjs'),fixture=require('./research-fixture.cjs');
async function main(){
 const db=fakeSupabase(),token=crypto.randomBytes(32).toString('hex');
 const store=createStore({fetchImpl:db.fetchImpl,getConfig:()=>({url:'https://browser-contract.supabase.co',key:'sb_secret_'+token})});
 const server=createPreviewServer({store,getToken:()=>token});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 let browser;const errors=[];
 try{
  const rpc=async(method,params={})=>{const r=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});assert.equal(r.status,200);return r.json();};
  await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'dummy-pipeline-test',version:'1'}});
  assert((await rpc('tools/list')).result.tools.some(t=>t.name==='save_georadar_research'));
  const saved=(await rpc('tools/call',{name:'save_georadar_research',arguments:fixture})).result.structuredContent;assert.equal(saved.persisted,true);assert.equal(saved.publiclyReadable,true);assert.equal(db.rows.size,1);
  browser=await playwright.chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1450,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>document.addEventListener('georadar:map-ready',e=>window.__pipelineMap=e.detail));
  const response=await page.goto(base+'/AB382');assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.GeoRadarCompanies?.getSnapshot().records.length===4&&window.__pipelineMap?.isStyleLoaded(),undefined,{timeout:45000});
  await page.waitForFunction(()=>new Set(window.__pipelineMap.queryRenderedFeatures({layers:['company-points']}).map(f=>f.properties.id)).size===4,undefined,{timeout:20000});
  const result=await page.evaluate(()=>({title:document.title,heading:document.querySelector('h1').textContent,bridge:document.getElementById('bridge-state').textContent,count:GeoRadarCompanies.getSnapshot().records.length,records:GeoRadarCompanies.getSnapshot().records.map(r=>({id:r.id,status:r.status,sourceCount:r.sources?.length,isFictional:r.isFictional})),markers:[...new Set(window.__pipelineMap.queryRenderedFeatures({layers:['company-points']}).map(f=>f.properties.id))],colors:window.__pipelineMap.getPaintProperty('company-points','circle-color')}));
  assert.equal(result.heading,'GEORADAR');assert.match(result.bridge,/Supabase · AB382 · 4 Unternehmen geladen/);assert.equal(result.markers.length,4);assert(result.records.every(r=>r.sourceCount===1&&r.isFictional));assert.equal(errors.length,0);
  const out=path.join(__dirname,'../verification');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'research-AB382.png')});fs.writeFileSync(path.join(out,'research-pipeline-report.json'),JSON.stringify({test:'Local HTTP MCP → Supabase contract double → identifier URL → real browser map. Not a live Supabase or Langdock import test.',result,errors},null,2));console.log(JSON.stringify({test:'local full pipeline with Supabase contract double',result,errors},null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
