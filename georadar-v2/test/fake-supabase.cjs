'use strict';
// Contract test double only. Never loaded by production code and never a runtime fallback.
function fakeSupabase(){
 const rows=new Map(),calls=[];
 async function fetchImpl(url,options={}){
  const u=new URL(url);calls.push({path:u.pathname,method:options.method||'GET'});
  if(u.pathname!=='/rest/v1/georadar_research_runs')return Response.json({code:'PGRST205'},{status:404});
  if(options.method==='POST'){const row=JSON.parse(options.body);if(rows.has(row.code))return Response.json({code:'23505'},{status:409});const saved={...row,created_at:'2026-11-02T12:00:01Z'};rows.set(row.code,saved);return Response.json([saved],{status:201});}
  const code=(u.searchParams.get('code')||'').replace(/^eq\./,'');return Response.json(rows.has(code)?[rows.get(code)]:[]);
 }
 return {rows,calls,fetchImpl};
}
module.exports={fakeSupabase};
