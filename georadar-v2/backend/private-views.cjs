'use strict';
const crypto=require('node:crypto'),VM=require('../dist/view-model.js');
class WebError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const fail=(status,code,message)=>{throw new WebError(status,code,message);};
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
function createPrivateViews({fetchImpl=(...a)=>fetch(...a),getConfig=()=>({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,sessionKey:process.env.GEORADAR_WEB_SESSION_KEY}),now=()=>Date.now(),randomBytes=crypto.randomBytes}={}){
 function config(){const c=getConfig();let u;try{u=new URL(c.url);}catch{}if(!u||u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.username||u.password||u.port||u.search||u.hash||!['','/'].includes(u.pathname)||typeof c.key!=='string'||c.key.length<32||/\s/.test(c.key)||c.key.startsWith('sb_publishable_')||typeof c.sessionKey!=='string'||c.sessionKey.length<32||/\s/.test(c.sessionKey))fail(503,'WEB_STORAGE_NOT_CONFIGURED','Private Speicherung ist für diese Bereitstellung noch nicht eingerichtet.');return {...c,url:u.origin};}
 function encryptionKey(){return crypto.hkdfSync('sha256',config().sessionKey,'GeoRadar web sessions v1','AES-256-GCM',32);}
 function seal(value){const iv=randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv),data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');}
 function open(value){try{const b=Buffer.from(value,'base64url'),cipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8');}catch{fail(401,'LOGIN_REQUIRED','Bitte erneut anmelden.');}}
 async function serviceRequest(path,{headers={},...options}={}){const c=config();try{return await fetchImpl(c.url+path,{...options,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:c.key,'Content-Type':'application/json',...(c.key.startsWith('eyJ')?{Authorization:'Bearer '+c.key}:{}),...headers}});}catch{fail(502,'WEB_STORAGE_UNREACHABLE','Anmeldungs- oder Speicherdienst ist vorübergehend nicht erreichbar.');}}
 async function db(path,options){const r=await serviceRequest('/rest/v1/'+path,options);if(!r.ok){let code;try{code=(await r.json()).code;}catch{}if(['42P01','PGRST205'].includes(code))fail(503,'WEB_SCHEMA_MISSING','Die private Speichertabelle fehlt.');fail(502,'WEB_STORAGE_FAILED','Private Speicherung konnte nicht verarbeitet werden.');}if(r.status===204)return null;try{return await r.json();}catch{fail(502,'WEB_STORAGE_FAILED','Ungültige Speicherantwort.');}}
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 const cookieName=request=>new URL(request.url).protocol==='https:'?'__Host-georadar_web':'georadar_web';
 function sessionId(request){const entry=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName(request)+'='));const id=entry?.slice(entry.indexOf('=')+1);return id&&/^[a-f0-9]{64}$/.test(id)?id:null;}
 function cookie(request,id,seconds){return cookieName(request)+'='+id+'; HttpOnly; Path=/; SameSite=Strict; Max-Age='+seconds+(new URL(request.url).protocol==='https:'?'; Secure':'');}
 function trustedOrigin(request){if(request.headers.get('sec-fetch-site')==='cross-site')return false;const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
 async function body(request,max=2000000){if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))fail(415,'JSON_REQUIRED','JSON erforderlich.');if(Number(request.headers.get('content-length'))>max)fail(413,'TOO_LARGE','Anfrage ist zu groß.');let size=0;const chunks=[],reader=request.body?.getReader();if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail(413,'TOO_LARGE','Anfrage ist zu groß.');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'INVALID_JSON','Ungültiges JSON.');}}
 const json=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer',...extra}});
 async function user(request){const id=sessionId(request);if(!id)fail(401,'LOGIN_REQUIRED','Bitte anmelden.');const rows=await db('georadar_web_sessions?'+new URLSearchParams({session_hash:'eq.'+hash(id),select:'owner_id,token_ciphertext,expires_at',limit:'1'}));const session=rows?.[0];if(!session||Date.parse(session.expires_at)<=now())fail(401,'LOGIN_REQUIRED','Sitzung abgelaufen. Bitte erneut anmelden.');const response=await requestAuthUser(open(session.token_ciphertext));if(!response||response.id!==session.owner_id||!uuid(response.id))fail(401,'LOGIN_REQUIRED','Bitte erneut anmelden.');return {id:response.id,email:response.email||''};}
 async function requestAuthUser(token){const r=await serviceRequest('/auth/v1/user',{headers:{Authorization:'Bearer '+token}});if(!r.ok)return null;return r.json();}
 const attempts=new Map();
 async function auth(request){
  try{
   if(!trustedOrigin(request))fail(403,'ORIGIN_NOT_ALLOWED','Zugriff von dieser Seite ist nicht erlaubt.');
   if(request.method==='GET')return json(200,{user:await user(request)});
   if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'},{Allow:'GET, POST'});
   if(request.headers.get('x-georadar-request')!=='1')fail(403,'REQUEST_HEADER_REQUIRED','Anfrage nicht erlaubt.');
   const input=await body(request,10000);
   if(input.action==='logout'){const id=sessionId(request);if(id)await db('georadar_web_sessions?'+new URLSearchParams({session_hash:'eq.'+hash(id)}),{method:'DELETE'});return json(200,{signedOut:true},{'Set-Cookie':cookie(request,'',0)});}
   if(input.action!=='login'||typeof input.email!=='string'||input.email.length>320||!input.email.includes('@')||typeof input.password!=='string'||input.password.length<1||input.password.length>1024)fail(400,'INVALID_LOGIN','E-Mail und Passwort sind erforderlich.');
   const address=input.email.trim().toLowerCase(),attempt=attempts.get(address);if(attempt&&attempt.until>now()&&attempt.count>=5)fail(429,'LOGIN_RATE_LIMIT','Zu viele Versuche. Bitte später erneut anmelden.');attempts.set(address,{count:attempt?.until>now()?attempt.count+1:1,until:now()+900000});if(attempts.size>1000)for(const [key,v]of attempts)if(v.until<now())attempts.delete(key);
   const r=await serviceRequest('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:address,password:input.password})});if(!r.ok)fail(401,'INVALID_LOGIN','Anmeldung fehlgeschlagen. E-Mail, Passwort und Kontobestätigung prüfen.');
   const token=await r.json();if(!uuid(token.user?.id)||typeof token.access_token!=='string'||token.access_token.length>7000||!Number.isFinite(token.expires_in)||token.user?.factors?.some(f=>f.status==='verified'))fail(401,'LOGIN_NOT_SUPPORTED','Dieses Konto benötigt eine zusätzliche Anmeldemethode.');
   const lifetime=Math.max(1,Math.min(3600,Math.floor(token.expires_in))),id=randomBytes(32).toString('hex');
   await db('georadar_web_sessions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({session_hash:hash(id),owner_id:token.user.id,token_ciphertext:seal(token.access_token),expires_at:new Date(now()+lifetime*1000).toISOString()})});attempts.delete(address);
   return json(200,{user:{id:token.user.id,email:token.user.email||address},expiresAt:new Date(now()+lifetime*1000).toISOString()},{'Set-Cookie':cookie(request,id,lifetime)});
  }catch(e){return error(e);}
 }
 function metadata(row,request){return {id:row.id,name:row.name,kind:row.kind,createdAt:row.created_at,recordCount:row.record_count,dataDigest:row.data_digest,url:new URL('/?view='+row.id,request.url).href,immutable:true};}
 async function views(request){
  try{
   if(!trustedOrigin(request))fail(403,'ORIGIN_NOT_ALLOWED','Zugriff von dieser Seite ist nicht erlaubt.');
   if(!['GET','POST'].includes(request.method))return json(405,{error:'METHOD_NOT_ALLOWED'},{Allow:'GET, POST'});
   const current=await user(request),url=new URL(request.url),id=url.searchParams.get('id');
   if(request.method==='GET'){
    if(id){if(!uuid(id))fail(400,'INVALID_ID','Ungültige Kennung.');const rows=await db('georadar_saved_views?'+new URLSearchParams({id:'eq.'+id,owner_id:'eq.'+current.id,select:'id,name,kind,view_config,dataset,record_count,data_digest,created_at',limit:'1'}));if(!rows?.[0])fail(404,'NOT_FOUND','Auswertung nicht gefunden oder nicht für dieses Konto freigegeben.');const row=rows[0];return json(200,{...metadata(row,request),view:row.view_config,...(row.dataset?{dataset:row.dataset}:{})});}
    const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>100000)fail(400,'INVALID_OFFSET','Ungültige Seite.');const rows=await db('georadar_saved_views?'+new URLSearchParams({owner_id:'eq.'+current.id,select:'id,name,kind,record_count,data_digest,created_at',order:'created_at.desc,id.desc',limit:'51',offset:String(offset)}));return json(200,{items:rows.slice(0,50).map(r=>metadata(r,request)),nextOffset:rows.length>50?offset+50:null});
   }
   if(request.headers.get('x-georadar-request')!=='1')fail(403,'REQUEST_HEADER_REQUIRED','Anfrage nicht erlaubt.');
   let value;try{value=VM.normalizeSave(await body(request));}catch(e){if(e instanceof WebError)throw e;fail(400,'INVALID_VIEW',e.message);}
   const digest=hash(JSON.stringify(value.dataset||{})),row={owner_id:current.id,name:value.name,kind:value.kind,view_config:value.view,dataset:value.dataset||null,record_count:value.dataset?.records.length||0,data_digest:digest};
   const rows=await db('georadar_saved_views',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});if(!rows?.[0]?.id)fail(502,'WEB_STORAGE_FAILED','Speicherung wurde nicht bestätigt.');return json(201,{...metadata(rows[0],request),persisted:true});
  }catch(e){return error(e);}
 }
 function error(e){return e instanceof WebError?json(e.status,{error:e.code,message:e.message}):json(500,{error:'WEB_INTERNAL_ERROR',message:'Die private Auswertung konnte nicht verarbeitet werden.'});}
 return {auth,views};
}
module.exports={createPrivateViews,WebError};
