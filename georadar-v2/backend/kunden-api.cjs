'use strict';
// GeoRadar – /api/kunden: Bestandskunden nur für angemeldete Nutzer (Sitzung aus /api/auth).
function createKundenApi({views,kunden}){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
  const json=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  return async function GET(request){
    if(request.method!=='GET')return json(405,{error:'METHOD_NOT_ALLOWED'});
    try{await views.user(request);}catch(e){return json(e.status===503?503:401,{error:e.code||'LOGIN_REQUIRED',message:e.message||'Bitte anmelden.'});}
    try{const records=await kunden.alle();return json(200,{anzahl:records.length,records});}
    catch(e){return json(e.status||500,{error:e.code||'INTERNAL_ERROR',message:e.message||'Kundenliste konnte nicht geladen werden.'});}
  };
}
module.exports={createKundenApi};
