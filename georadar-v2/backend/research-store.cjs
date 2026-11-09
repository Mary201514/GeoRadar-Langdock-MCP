'use strict';
const crypto=require('node:crypto'),D=require('../dist/data-model.js');
const TABLE='georadar_research_runs';
class ResearchError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
function identifier(value){
 if(typeof value!=='string')throw new ResearchError(400,'INVALID_CODE','Eine Kennung als Text ist erforderlich, z. B. AB382.');
 const code=value.trim().toUpperCase();
 if(!/^[A-Z][A-Z0-9-]{2,31}$/.test(code)||['API','MCP','ASSETS','DIST','LICENSES','STATIC'].includes(code))throw new ResearchError(400,'INVALID_CODE','Kennung: 3–32 Zeichen, beginnt mit einem Buchstaben, danach Buchstaben, Ziffern oder Bindestriche.');
 return code;
}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
function normalize(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ResearchError(400,'INVALID_PAYLOAD','Ein Objekt mit code und records ist erforderlich.');
 const code=identifier(input.code),title=input.title===undefined?'Recherche '+code:input.title;
 if(typeof title!=='string'||!title.trim()||title.length>160)throw new ResearchError(400,'INVALID_TITLE','Titel: 1–160 Zeichen.');
 let data;try{data=D.validate(input);}catch(e){throw new ResearchError(400,'INVALID_RECORDS',e.message);}
 const payload={schema:data.schema,records:data.records,...(data.territories?{territories:data.territories}:{})};
 if(input.research!==undefined){
  const r=input.research;if(!r||typeof r!=='object'||Array.isArray(r))throw new ResearchError(400,'INVALID_RESEARCH','research muss ein Objekt sein.');
  const metadata={};for(const key of ['query','notes','generatedAt'])if(r[key]!==undefined){if(typeof r[key]!=='string'||r[key].length>(key==='generatedAt'?80:8000))throw new ResearchError(400,'INVALID_RESEARCH','Ungültige Recherche-Metadaten.');metadata[key]=r[key].trim();}
  if(r.mode!==undefined){if(!['dummy','research'].includes(r.mode))throw new ResearchError(400,'INVALID_RESEARCH','research.mode muss dummy oder research sein.');metadata.mode=r.mode;}
  if(r.generatedAt&&!Number.isFinite(Date.parse(r.generatedAt)))throw new ResearchError(400,'INVALID_RESEARCH','generatedAt muss ein gültiger ISO-Zeitpunkt sein.');
  payload.research=metadata;
 }
 if(payload.research?.mode==='dummy'&&payload.records.some(r=>r.isFictional!==true))throw new ResearchError(400,'DUMMY_LABEL_REQUIRED','Im Dummy-Modus muss jeder Datensatz ausdrücklich isFictional: true enthalten.');
 if(Buffer.byteLength(JSON.stringify(payload))>1800000)throw new ResearchError(413,'PAYLOAD_TOO_LARGE','Ergebnisse sind zu groß; Recherche bitte aufteilen.');
 const normalizedTitle=title.trim(),digest=crypto.createHash('sha256').update(canonical({title:normalizedTitle,payload})).digest('hex');
 return {code,title:normalizedTitle,payload,digest};
}
function createStore({fetchImpl=(...args)=>fetch(...args),getConfig=()=>({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY}),baseUrl='https://mangold-georadar.vercel.app'}={}){
 function config(){const c=getConfig();let u;try{u=new URL(c.url);}catch{}if(!u||u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.username||u.password||u.search||u.hash||u.port||!['','/'].includes(u.pathname)||typeof c.key!=='string'||c.key.length<32||/\s/.test(c.key)||c.key.startsWith('sb_publishable_'))throw new ResearchError(503,'STORAGE_NOT_CONFIGURED','Supabase ist noch nicht serverseitig eingerichtet. SUPABASE_URL und SUPABASE_SECRET_KEY für Production setzen und SQL-Migration ausführen.');return {origin:u.origin,key:c.key};}
 async function request(path,options={}){const c=config();let response;try{response=await fetchImpl(c.origin+'/rest/v1/'+path,{...options,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:c.key,...(c.key.startsWith('eyJ')?{Authorization:'Bearer '+c.key}:{}),'Content-Type':'application/json',...options.headers}});}catch{throw new ResearchError(502,'STORAGE_UNREACHABLE','Supabase konnte nicht erreicht werden.');}return response;}
 async function failure(response){let pgCode;try{pgCode=(await response.json()).code;}catch{}if(['42P01','PGRST205'].includes(pgCode))throw new ResearchError(503,'STORAGE_SCHEMA_MISSING','Die Supabase-Tabelle fehlt. Bitte die mitgelieferte SQL-Migration ausführen.');throw new ResearchError(502,'STORAGE_REQUEST_FAILED','Supabase hat den Zugriff abgelehnt oder die Anfrage konnte nicht verarbeitet werden.');}
 function output(row,created){return {code:row.code,title:row.title,createdAt:row.created_at,mapUrl:baseUrl+'/'+encodeURIComponent(row.code),data:row.payload,...(created===undefined?{}:{created}),persisted:true,publiclyReadable:row.payload?.research?.mode==='dummy'&&row.payload.records.every(r=>r.isFictional===true)};}
 async function readRow(code){const q=new URLSearchParams({code:'eq.'+code,select:'code,title,payload,digest,created_at',limit:'1'});const r=await request(TABLE+'?'+q);if(!r.ok)return failure(r);let rows;try{rows=await r.json();}catch{throw new ResearchError(502,'STORAGE_INVALID_RESPONSE','Ungültige Antwort der Datenbank.');}if(!Array.isArray(rows))throw new ResearchError(502,'STORAGE_INVALID_RESPONSE','Ungültige Antwort der Datenbank.');return rows[0]||null;}
 return {
  async save(input){const data=normalize(input);const r=await request(TABLE,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});if(r.status===409){const old=await readRow(data.code);if(old&&old.digest===data.digest)return output(old,false);throw new ResearchError(409,'CODE_EXISTS','Diese Kennung ist bereits mit anderen Ergebnissen belegt. Bitte eine neue Kennung wählen; vorhandene Daten bleiben unverändert.');}if(!r.ok)return failure(r);let rows;try{rows=await r.json();}catch{}if(!Array.isArray(rows)||!rows[0]||rows[0].code!==data.code)throw new ResearchError(502,'STORAGE_INVALID_RESPONSE','Speicherung wurde nicht mit einem Datensatz bestätigt.');return output(rows[0],true);},
  async load(value){const code=identifier(value),row=await readRow(code);if(!row)throw new ResearchError(404,'NOT_FOUND','Für diese Kennung wurden keine Ergebnisse gefunden.');return output(row);}
 };
}
module.exports={createStore,identifier,normalize,ResearchError,TABLE};
