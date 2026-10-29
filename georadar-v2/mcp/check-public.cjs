'use strict';
const assert=require('node:assert/strict');
async function main(){
  const remote=process.argv[2];
  const {createTransport}=require('./transport.cjs'),{handle}=require('./server.cjs');
  const options={dispatch:handle,getToken:()=>undefined,getTestMode:()=>'public-dummy',getTestUntil:()=>'2030-01-01T00:00:00Z',now:()=>Date.parse('2026-10-29T00:00:00Z')};
  const local=createTransport(options),base=remote||'https://mangold-georadar.vercel.app';
  async function send(payload,headers={},method='POST'){
    const request=new Request(base+'/mcp',{method,headers:{'Content-Type':'application/json',Accept:'application/json',...headers},...(method==='GET'?{}:{body:typeof payload==='string'?payload:JSON.stringify(payload)})});
    return remote?fetch(request,{redirect:'error',signal:AbortSignal.timeout(30000)}):local(request);
  }
  const checks=[];async function check(name,fn){await fn();checks.push(name);}
  const call=(method,params={})=>send({jsonrpc:'2.0',id:1,method,params});
  await check('Initialize without any token',async()=>{const r=await call('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'public-dummy-test',version:'1'}});assert.equal(r.status,200);assert.equal(r.headers.get('x-georadar-mode'),'public-dummy');assert.equal((await r.json()).result.protocolVersion,'2025-06-18');});
  await check('show_georadar_map discovered with explicit dummy limits',async()=>{const r=await (await call('tools/list')).json();assert.equal(r.result.tools[0].name,'show_georadar_map');assert.match(r.result.tools[0].description,/DUMMY-TEST/);assert.equal(r.result.tools[0].inputSchema.properties.records.maxItems,100);});
  const records=['existing','prospect','priority','unknown'].map((status,i)=>({id:'DUMMY-'+i,name:'Fiktive Dummy Testfirma '+i,country:i%2?'AT':'DE',status,...(i===3?{}:{lon:13.4,lat:48.5,locationAccuracy:'approximate'})}));
  await check('Four dummy statuses and missing coordinates transferred',async()=>{const r=await (await call('tools/call',{name:'show_georadar_map',arguments:{records}})).json();assert.equal(r.result.structuredContent.summary.total,4);assert.equal(r.result.structuredContent.summary.unlocated,1);for(const s of ['existing','prospect','priority','unknown'])assert.equal(r.result.structuredContent.summary[s],1);});
  await check('Unmarked company data rejected',async()=>{const r=await (await call('tools/call',{name:'show_georadar_map',arguments:{records:[{id:'CUSTOMER-1',name:'Example company',country:'DE'}]}})).json();assert.equal(r.result.isError,true);});
  await check('More than 100 records rejected',async()=>assert.equal((await (await call('tools/call',{name:'show_georadar_map',arguments:{records:Array(101).fill(records[0])}})).json()).result.isError,true));
  await check('MCP App resource available without token',async()=>{const r=await (await call('resources/read',{uri:'ui://georadar/map-v1.html'})).json();assert.equal(r.result.contents[0].mimeType,'text/html;profile=mcp-app');assert(r.result.contents[0].text.includes('GEORADAR_CONTEXT_MASK'));});
  await check('Notifications return 202',async()=>assert.equal((await send({jsonrpc:'2.0',method:'notifications/initialized'})).status,202));
  await check('Foreign Origin rejected',async()=>assert.equal((await send({jsonrpc:'2.0',id:1,method:'ping'},{Origin:'https://attacker.invalid'})).status,403));
  await check('GET returns 405',async()=>assert.equal((await send(null,{},'GET')).status,405));
  await check('Malformed JSON rejected',async()=>assert.equal((await send('{broken')).status,400));
  if(!remote){
    await check('Expired, missing and invalid test switches restore Bearer protection',async()=>{for(const overrides of [{getTestUntil:()=>'2020-01-01'},{getTestUntil:()=>''},{getTestMode:()=>'true'}]){const handler=createTransport({...options,...overrides,getToken:()=>'x'.repeat(64)});assert.equal((await handler(new Request(base+'/mcp',{method:'POST',body:'{}'}))).status,401);}});
    await check('Expired test with missing secret fails closed',async()=>assert.equal((await createTransport({...options,getTestUntil:()=>'2020-01-01'})(new Request(base+'/mcp'))).status,503));
  }else await check('Unchanged map is publicly reachable',async()=>{const r=await fetch(base,{redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);assert((await r.text()).includes('GEORADAR'));});
  console.log(JSON.stringify({mode:remote?'public-https':'local',passed:checks.length,checks},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
