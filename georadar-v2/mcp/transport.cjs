'use strict';
const crypto=require('node:crypto');
const PROTOCOLS=['2025-11-25','2025-06-18','2025-03-26'];
const MAX_BODY=2*1024*1024;
function createTransport({dispatch,getToken=()=>process.env.GEORADAR_TOKEN,getAllowedOrigin=()=>process.env.ALLOWED_ORIGIN,getTestMode=()=>process.env.GEORADAR_TEST_MODE,getTestUntil=()=>process.env.GEORADAR_TEST_UNTIL,now=()=>Date.now()}={}){
  if(typeof dispatch!=='function')throw Error('MCP dispatch is required');
  return async function transport(request){
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Authorization, Origin'};
    const json=(status,body,extra={})=>new Response(body===undefined?null:JSON.stringify(body),{status,headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json; charset=utf-8'}),...extra}});
    // Public access requires explicit, time-limited dummy mode. Expiry restores Bearer auth.
    const until=Date.parse(getTestUntil()||'');
    const publicDummy=getTestMode()==='public-dummy'&&Number.isFinite(until)&&now()<until;
    if(publicDummy)headers['X-GeoRadar-Mode']='public-dummy';
    if(!publicDummy){
    // No fallback token: a missing or weak server secret closes the endpoint.
    const token=getToken();
    const configurationIssue=typeof token!=='string'||!token?'missing':token.length<32?'too_short':token.length>512?'too_long':/\s/.test(token)?'whitespace':null;
    if(configurationIssue){console.error('GeoRadar MCP configuration: '+configurationIssue);return json(503,{error:'MCP_NOT_CONFIGURED',message:'GEORADAR_TOKEN muss serverseitig als geheimer Wert mit mindestens 32 Zeichen konfiguriert sein.'});}
    const auth=request.headers.get('authorization')||'',match=/^Bearer ([^\s]+)$/i.exec(auth);
    const provided=match?.[1]||'';
    const hash=value=>crypto.createHash('sha256').update(value).digest();
    if(!match||provided.length>512||!crypto.timingSafeEqual(hash(provided),hash(token)))return json(401,{error:'Unauthorized'},{'WWW-Authenticate':'Bearer realm="Mangold GeoRadar"'});
    }
    const origin=request.headers.get('origin');
    if(origin){const allowed=new Set([new URL(request.url).origin,'https://mangold-georadar.vercel.app']);const configured=getAllowedOrigin();if(configured)allowed.add(configured);if(!allowed.has(origin))return json(403,{error:'Origin not allowed'});}
    // SSE GET is optional in Streamable HTTP. This stateless server responds via JSON POST.
    if(request.method!=='POST')return json(405,{error:'Method not allowed. Use JSON-RPC via POST.'},{Allow:'POST'});
    if(!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type')||''))return json(415,{error:'Content-Type must be application/json'});
    const accept=request.headers.get('accept');if(accept&&!/application\/json|\*\/\*/i.test(accept))return json(406,{error:'The client must accept application/json'});
    const protocol=request.headers.get('mcp-protocol-version');if(protocol&&!PROTOCOLS.includes(protocol))return json(400,{error:'Unsupported MCP-Protocol-Version'});
    const size=Number(request.headers.get('content-length'));if(Number.isFinite(size)&&size>MAX_BODY)return json(413,{error:'MCP body exceeds 2 MiB'});
    let message;
    try{
      const reader=request.body?.getReader();const chunks=[];let bytes=0;
      if(reader){try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>MAX_BODY){await reader.cancel();return json(413,{error:'MCP body exceeds 2 MiB'});}chunks.push(Buffer.from(part.value));}}finally{reader.releaseLock();}}
      message=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }catch{return json(400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});}
    if(!message||Array.isArray(message)||typeof message!=='object'||message.jsonrpc!=='2.0')return json(400,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'One JSON-RPC 2.0 object is required'}});
    const hasId=Object.hasOwn(message,'id');
    if(hasId&&(typeof message.id!=='string'&&!(typeof message.id==='number'&&Number.isFinite(message.id))))return json(400,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request id'}});
    // Stateless servers do not issue requests, but acknowledge valid client responses.
    if(!Object.hasOwn(message,'method')&&hasId&&(Object.hasOwn(message,'result')||Object.hasOwn(message,'error')))return json(202);
    if(typeof message.method!=='string'||!message.method)return json(400,{jsonrpc:'2.0',id:hasId?message.id:null,error:{code:-32600,message:'Invalid method'}});
    if(message.params!==undefined&&(message.params===null||Array.isArray(message.params)||typeof message.params!=='object'))return json(400,{jsonrpc:'2.0',id:hasId?message.id:null,error:{code:-32602,message:'params must be an object'}});
    if(!hasId)return json(202);
    try{
      if(message.method==='initialize'){
        const p=message.params;if(!p||typeof p.protocolVersion!=='string'||!p.capabilities||typeof p.capabilities!=='object'||!p.clientInfo||typeof p.clientInfo.name!=='string'||typeof p.clientInfo.version!=='string')return json(200,{jsonrpc:'2.0',id:message.id,error:{code:-32602,message:'initialize requires protocolVersion, capabilities and clientInfo'}});
      }
      if(publicDummy&&message.method==='tools/call'){
        const records=message.params?.arguments?.records;
        if(!Array.isArray(records)||records.length>100||records.some(r=>!r||typeof r.id!=='string'||!/^(?:DUMMY-|TEST-|TECHNICAL-TEST-)/i.test(r.id)||typeof r.name!=='string'||!/(?:dummy|test|fiktiv)/i.test(r.name))){
          return json(200,{jsonrpc:'2.0',id:message.id,result:{isError:true,content:[{type:'text',text:'Öffentlicher Dummy-Test: höchstens 100 Datensätze; jede ID muss mit DUMMY- oder TEST- beginnen und jeder Firmenname Dummy, Test oder Fiktiv enthalten. Keine echten Kunden- oder ERP-Daten übergeben.'}]}});
        }
      }
      let result=await dispatch(message);
      if(publicDummy&&message.method==='tools/list'&&result?.result?.tools){
        result=structuredClone(result);
        for(const tool of result.result.tools){tool.description='ÖFFENTLICHER DUMMY-TEST, zeitlich begrenzt. Maximal 100 ausschließlich fiktive Datensätze. IDs beginnen mit DUMMY- oder TEST-; Firmennamen enthalten Dummy, Test oder Fiktiv. Keine echten Kunden- oder ERP-Daten. '+tool.description;if(tool.inputSchema?.properties?.records)tool.inputSchema.properties.records.maxItems=100;}
      }
      // Explicitly cap serialized responses below Vercel's request/response limit.
      if(Buffer.byteLength(JSON.stringify(result))>4*1024*1024)return json(413,{error:'MCP result exceeds 4 MiB. Reduce the dataset.'});
      return json(200,result);
    }catch{console.error('GeoRadar MCP dispatch failed');return json(500,{jsonrpc:'2.0',id:message.id,error:{code:-32603,message:'Internal MCP error'}});}
  };
}
module.exports={createTransport,PROTOCOLS,MAX_BODY};
