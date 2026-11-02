'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const base=process.argv[2]||'https://mangold-georadar.vercel.app',checks=[];
 const send=(url,options={})=>fetch(base+url,{redirect:'error',signal:AbortSignal.timeout(30000),...options});
 const root=await send('/');assert.equal(root.status,200);assert((await root.text()).includes('<h1>GEORADAR</h1>'));checks.push('Production map HTTP 200');
 const view=await send('/AB382');assert.equal(view.status,200);assert((await view.text()).includes('saved-research.js'));checks.push('Identifier URL rewrite serves saved-data map');
 for(const url of ['/mcp','/api/research']){const r=await send(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,401);checks.push(url+' rejects unauthenticated writes');}
 const listing=await send('/api/research');assert.equal(listing.status,400);checks.push('No anonymous list-all endpoint');
 const storage=await send('/api/research?code=AB382');let body;try{body=await storage.json();}catch{throw Error('Research API did not return JSON');}
 const report={checks,storage:{status:storage.status,error:body.error||null,liveDatabaseConfirmed:storage.status===200&&body.persisted===true},note:'No secret read; no production data written by this probe. A 503 reports incomplete Supabase setup, not a successful database test.'};
 const out=path.join(__dirname,'../verification');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'research-production-readiness.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(![200,404,503].includes(storage.status))process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
