'use strict';
const crypto=require('node:crypto'),{createStore,ResearchError}=require('./research-store.cjs');
function createResearchApi({store=createStore(),getToken=()=>process.env.GEORADAR_TOKEN}={}){
 return async request=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
  const json=(status,body,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
  if(!['GET','POST'].includes(request.method))return json(405,{error:'METHOD_NOT_ALLOWED'},{Allow:'GET, POST'});
  // Public link reads are restricted to explicit dummy runs, even if platform protection is off.
  // No browser/database secret is embedded. Writes always require our separate Bearer token.
  if(request.method==='POST'){
   const token=getToken();if(typeof token!=='string'||token.length<32||token.length>512||/\s/.test(token))return json(503,{error:'WRITE_NOT_CONFIGURED'});
   const match=/^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization')||'');const provided=match?.[1]||'';const hash=v=>crypto.createHash('sha256').update(v).digest();if(!match||provided.length>512||!crypto.timingSafeEqual(hash(token),hash(provided)))return json(401,{error:'Unauthorized'},{'WWW-Authenticate':'Bearer realm="Mangold GeoRadar"'});
  }
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin&&origin!==process.env.ALLOWED_ORIGIN)return json(403,{error:'ORIGIN_NOT_ALLOWED'});
  try{
   if(request.method==='GET'){const code=new URL(request.url).searchParams.get('code'),result=await store.load(code);if(result.publiclyReadable!==true)return json(404,{error:'NOT_FOUND',message:'Keine öffentlich freigegebene Dummy-Recherche für diese Kennung vorhanden.'});return json(200,result);}
   if(!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type')||''))return json(415,{error:'CONTENT_TYPE_REQUIRED'});
   if(Number(request.headers.get('content-length'))>2*1024*1024)return json(413,{error:'PAYLOAD_TOO_LARGE'});
   const chunks=[];let size=0;const reader=request.body?.getReader();if(reader){try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>2*1024*1024){await reader.cancel();return json(413,{error:'PAYLOAD_TOO_LARGE'});}chunks.push(Buffer.from(p.value));}}finally{reader.releaseLock();}}
   let payload;try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(400,{error:'INVALID_JSON'});}
   const saved=await store.save(payload);const {data,...receipt}=saved;return json(saved.created?201:200,{...receipt,recordCount:data.records.length});
  }catch(e){if(e instanceof ResearchError)return json(e.status,{error:e.code,message:e.message});return json(500,{error:'INTERNAL_ERROR',message:'Recherche konnte nicht verarbeitet werden.'});}
 };
}
module.exports={createResearchApi};
