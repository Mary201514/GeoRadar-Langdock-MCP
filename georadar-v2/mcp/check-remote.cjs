// Credentials are accepted via hidden stdin only. No secret is printed or persisted.
'use strict';
const assert=require('node:assert/strict');
async function readInput(){process.stdin.setEncoding('utf8');if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdout.write('Ready for private test configuration on stdin (hidden).\n');return new Promise(resolve=>{let value='';process.stdin.on('data',part=>{if(part.includes('\u0003'))process.exit(130);value+=part;if(/[\r\n]/.test(value)){if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();resolve(JSON.parse(value.trim()));}});});}
let currentCheck='deployment access';
async function main(){
  const config=await readInput(),base=new URL(config.url);assert.equal(base.protocol,'https:');assert(base.hostname.endsWith('.vercel.app'));
  const cookies=new Map();
  async function send(url,options={}){
    for(let i=0;i<5;i++){
      const response=await fetch(url,{...options,redirect:'manual',headers:{...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{}),...options.headers},signal:AbortSignal.timeout(30000)});
      for(const value of response.headers.getSetCookie?.()||[]){const pair=value.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));}
      if(![301,302,303,307,308].includes(response.status))return response;
      const next=new URL(response.headers.get('location'),url);if(next.origin!==base.origin)throw Error('Vercel protection redirected outside the deployment; access is not configured.');
      if(options.method==='POST'&&[301,302,303].includes(response.status))throw Error('Unexpected redirect of MCP POST');url=next;
    }throw Error('Too many redirects');
  }
  // A short-lived deployment-scoped share link authorizes the test client only.
  if(config.share){const exchange=new URL('/',base);exchange.searchParams.set('_vercel_share',config.share);const response=await send(exchange);if(response.status!==200)throw Error('Could not authenticate the deployment test client ('+response.status+').');}
  const endpoint=new URL('/mcp',base),auth=config.token?'Bearer '+config.token:undefined;
  const checks=[];
  async function check(name,fn){currentCheck=name;await fn();checks.push(name);}
  async function call(method,params={},extra={}){return send(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(auth?{Authorization:auth}:{}),...extra},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});}
  await check('Missing Bearer returns 401',async()=>{const r=await call('tools/list',{}, {Authorization:''});assert.equal(r.status,401);assert.match(r.headers.get('www-authenticate'),/^Bearer/);assert.equal((await r.json()).error,'Unauthorized');});
  await check('Wrong Bearer returns 401',async()=>assert.equal((await call('tools/list',{}, {Authorization:'Bearer invalid-test-value'})).status,401));
  if(config.token){
    await check('Authenticated GET returns 405 (optional SSE not offered)',async()=>assert.equal((await send(endpoint,{headers:{Authorization:auth}})).status,405));
    await check('MCP initialize negotiates protocol',async()=>{const r=await call('initialize',{protocolVersion:'2025-06-18',capabilities:{extensions:{'io.modelcontextprotocol/ui':{mimeTypes:['text/html;profile=mcp-app']}}},clientInfo:{name:'GeoRadar-deployment-test',version:'1'}});assert.equal(r.status,200);assert.equal((await r.json()).result.protocolVersion,'2025-06-18');});
    await check('Initialized notification returns empty 202',async()=>{const r=await send(endpoint,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})});assert.equal(r.status,202);assert.equal(await r.text(),'');});
    await check('show_georadar_map is discoverable',async()=>{const r=await call('tools/list');assert.equal(r.status,200);assert.equal((await r.json()).result.tools[0].name,'show_georadar_map');});
    await check('MCP App resource is discoverable and bundled',async()=>{const list=await (await call('resources/list')).json();const uri=list.result.resources[0].uri;const resource=(await (await call('resources/read',{uri})).json()).result.contents[0];assert.equal(resource.mimeType,'text/html;profile=mcp-app');assert(resource.text.includes('GEORADAR_CONTEXT_MASK'));assert(resource.text.includes('company-points'));assert(resource.text.includes('ui/initialize'));assert(!resource.text.includes('src="maplibre-gl.js"'));});
    await check('Structured dummy data reaches tool result',async()=>{const records=['existing','prospect','priority','unknown'].map((status,i)=>({id:'TECHNICAL-TEST-'+i,name:'TECHNISCHER TESTDATENSATZ – kein reales Unternehmen',country:'DE',status,...(i===3?{}:{lon:13.405,lat:52.52,locationAccuracy:'approximate'})}));const r=await (await call('tools/call',{name:'show_georadar_map',arguments:{records}})).json();assert.equal(r.result.structuredContent.summary.total,4);assert.equal(r.result.structuredContent.summary.unlocated,1);for(const status of ['existing','prospect','priority','unknown'])assert.equal(r.result.structuredContent.summary[status],1);});
    await check('Invalid company is rejected',async()=>assert.equal((await (await call('tools/call',{name:'show_georadar_map',arguments:{records:[{}]}})).json()).result.isError,true));
    await check('Foreign Origin returns 403',async()=>assert.equal((await call('ping',{}, {Origin:'https://attacker.invalid'})).status,403));
    await check('Wrong Content-Type returns 415',async()=>assert.equal((await call('ping',{}, {'Content-Type':'text/plain'})).status,415));
    await check('Unsupported protocol returns 400',async()=>assert.equal((await call('ping',{}, {'MCP-Protocol-Version':'unsupported'})).status,400));
    await check('Malformed JSON returns 400',async()=>{const r=await send(endpoint,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:'{broken'});assert.equal(r.status,400);});
  }
  await check('Existing map remains available',async()=>{const r=await send(new URL('/',base));assert.equal(r.status,200);assert((await r.text()).includes('GEORADAR'));});
  console.log(JSON.stringify({url:base.origin,passed:checks.length,checks},null,2));
}
main().catch(error=>{console.error(JSON.stringify({failed:currentCheck,code:error.code||error.cause?.code||null,actual:typeof error.actual==='number'?error.actual:undefined,expected:typeof error.expected==='number'?error.expected:undefined}));process.exitCode=1;});
