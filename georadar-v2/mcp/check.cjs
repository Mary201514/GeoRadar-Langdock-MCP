'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const D=require('../dist/data-model.js'),{handle,createServer,URI}=require('./server.cjs');
const base={id:'TEST-ONLY-1',name:'Technischer Testdatensatz, kein reales Unternehmen',country:'DE',lon:13.405,lat:52.52};
function call(method,params){return handle({jsonrpc:'2.0',id:1,method,params}).result;}
async function main(){
  assert.equal(D.validate({records:[{...base,category:'Bestandskunde'}]}).records[0].status,'existing');
  for(const status of Object.keys(D.statuses))assert.equal(D.validate({records:[{...base,status}]}).records[0].status,status);
  const missing=D.validate({records:[{id:'MISSING',name:'Test ohne Position',country:'AT'}]});assert.equal(D.summarize(missing.records).unlocated,1);
  const territories=[{code:'GD',personnelNumber:'2',rules:[{country:'DE',prefixes:['88','89']}]}];assert.equal(D.validate({records:[],territories}).territories[0].code,'GD');
  assert.throws(()=>D.validate({records:[],territories:[{code:'CO',personnelNumber:'93',rules:[{country:'AT',prefixes:['88046']}]}]}));
  assert.throws(()=>D.validate({records:[{...base,country:'__proto__'}]}));
  for(const row of [{...base,lat:null},{...base,lon:'13.4'},{...base,lon:0},{...base,status:'green'},{...base,postalCode:10115},{...base,country:'FR'},{...base,leadScore:101},{...base,locationAccuracy:'verified-by-ai'}])assert.throws(()=>D.validate({records:[row]}));
  assert.throws(()=>D.validate({records:[base,base]}));assert.throws(()=>D.validate({records:Array(10001).fill(base)}));
  const large=D.validate({records:Array.from({length:10000},(_,i)=>({...base,id:String(i)}))});assert.equal(large.records.length,10000);
  assert.equal(call('initialize',{protocolVersion:'2025-03-26'}).serverInfo.version,'2.0.0');
  assert.equal(call('tools/list').tools[0].name,'show_georadar_map');
  const data=call('tools/call',{name:'show_georadar_map',arguments:{records:[{...base,status:'priority'}]}});assert.equal(data.structuredContent.summary.priority,1);
  assert.equal(call('tools/call',{name:'show_georadar_map',arguments:{records:[{}]}}).isError,true);
  assert.equal(call('tools/call',{name:'show_georadar_map',arguments:{records:[]}}).structuredContent.records.length,0);
  const resource=call('resources/read',{uri:URI}).contents[0];assert(resource.text.includes('window.GEORADAR_STYLE='));assert(resource.text.includes('company-points'));assert(!resource.text.includes('src="maplibre-gl.js"'));assert(!resource.text.includes('href="style.css"'));
  assert(resource._meta.ui.csp.connectDomains.includes('https://tiles.openfreemap.org'));
  // Actual bridge script in an isolated host model: foreign messages are rejected.
  let listener,timer,dispatched=[],outgoing=[],parent={postMessage:m=>outgoing.push(m)},status={};
  const context={crypto:require('node:crypto').webcrypto,setTimeout:f=>{timer=f;return 1;},clearTimeout:()=>{},CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}},document:{getElementById:()=>status,dispatchEvent:e=>dispatched.push(e)},window:{parent,addEventListener:(type,f)=>listener=f}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/mcp-bridge.js'),'utf8'),context);
  const id=outgoing[0].id;
  listener({source:{},origin:'https://attacker.invalid',data:{jsonrpc:'2.0',id,result:{protocolVersion:'2026-01-26'}}});assert.equal(outgoing.length,1);
  listener({source:parent,origin:'https://host.invalid',data:{jsonrpc:'2.0',id,result:{protocolVersion:'2026-01-26'}}});assert(outgoing.some(m=>m.method==='ui/notifications/initialized'));
  listener({source:parent,origin:'https://attacker.invalid',data:{jsonrpc:'2.0',method:'ui/notifications/tool-result',params:data}});assert.equal(dispatched.length,0);
  listener({source:parent,origin:'https://host.invalid',data:{jsonrpc:'2.0',method:'ui/notifications/tool-result',params:data}});assert.equal(dispatched[0].detail.structuredContent.records[0].status,'priority');
  // HTTP transport and authentication: no browser automation here.
  const server=createServer({token:'test-only-token-not-a-production-secret'});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{const url='http://127.0.0.1:'+server.address().port+'/mcp',body=JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'show_georadar_map',arguments:{records:[base]}}});
    assert.equal((await fetch(url,{method:'POST',body})).status,401);
    const headers={'Authorization':'Bearer test-only-token-not-a-production-secret','Content-Type':'application/json'};
    const response=await fetch(url,{method:'POST',headers,body});assert.equal(response.status,200);assert.equal((await response.json()).result.structuredContent.records.length,1);
    assert.equal((await fetch(url,{method:'POST',headers:{...headers,Origin:'https://attacker.invalid'},body})).status,403);
    assert.equal((await fetch(url,{method:'POST',headers,body:'{broken'})).status,400);
    assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})})).status,202);
  }finally{await new Promise(r=>server.close(r));}
  console.log('OK: statuses, legacy category, missing/invalid coordinates, IDs, PLZ, 10k records, bundled MCP resource, handshake/origin validation, HTTP authentication, invalid JSON and empty results.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
