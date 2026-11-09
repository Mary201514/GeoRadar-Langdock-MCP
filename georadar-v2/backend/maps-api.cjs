'use strict';
// GeoRadar 4 – öffentliche Lese- und Routing-API für geteilte Karten. Zugriff nur mit kryptischem Link-Schlüssel.
const {createMapsService}=require('./maps-service.cjs');
const {MapsError,isShareKey}=require('./maps-store.cjs');
const {createRouter,RouteError,MANGOLD,MAX_STOPS}=require('./route.cjs');

function createMapsApi({service=createMapsService(),router=createRouter(),now=()=>Date.now()}={}){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
  const json=(status,body,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
  const fail=e=>e instanceof MapsError||e instanceof RouteError?json(e.status,{error:e.code,message:e.message}):json(500,{error:'INTERNAL_ERROR',message:'Anfrage konnte nicht verarbeitet werden.'});
  const hits=new Map();
  function limited(key){const t=now(),list=(hits.get(key)||[]).filter(x=>t-x<600000);if(list.length>=30){hits.set(key,list);return true;}list.push(t);hits.set(key,list);if(hits.size>5000)hits.clear();return false;}
  async function body(request){if(Number(request.headers.get('content-length'))>64*1024)throw new MapsError(413,'PAYLOAD_TOO_LARGE','Anfrage zu groß.');const text=await request.text();if(text.length>64*1024)throw new MapsError(413,'PAYLOAD_TOO_LARGE','Anfrage zu groß.');try{return JSON.parse(text);}catch{throw new MapsError(400,'INVALID_JSON','Ungültiges JSON.');}}
  function sameOrigin(request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin||origin===process.env.ALLOWED_ORIGIN;}

  return {
    async karte(request){
      if(request.method!=='GET')return json(405,{error:'METHOD_NOT_ALLOWED'},{Allow:'GET'});
      const key=new URL(request.url).searchParams.get('key');
      if(!isShareKey(key))return json(404,{error:'MAP_NOT_FOUND',message:'Karte nicht gefunden.'});
      try{return json(200,{...(await service.loadByKey(key)),routing:router.configured()});}catch(e){return fail(e);}
    },
    async route(request){
      if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'},{Allow:'POST'});
      if(!sameOrigin(request))return json(403,{error:'ORIGIN_NOT_ALLOWED'});
      if(!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type')||''))return json(415,{error:'CONTENT_TYPE_REQUIRED'});
      try{
        const input=await body(request);
        if(!isShareKey(input?.key))return json(404,{error:'MAP_NOT_FOUND',message:'Karte nicht gefunden.'});
        if(!Array.isArray(input.ids)||!input.ids.length||input.ids.length>MAX_STOPS||input.ids.some(id=>typeof id!=='string'))return json(400,{error:'INVALID_SELECTION',message:'1 bis '+MAX_STOPS+' Punkte auswählen.'});
        if(limited(input.key))return json(429,{error:'TOO_MANY_ROUTES',message:'Zu viele Routenberechnungen. Bitte in einigen Minuten erneut versuchen.'});
        // Koordinaten kommen ausschließlich aus der gespeicherten Karte, nicht vom Browser.
        const records=await service.pointsByKey(input.key),byId=new Map(records.map(r=>[r.id,r]));
        const stops=[...new Set(input.ids)].map(id=>byId.get(id)).filter(r=>r&&Number.isFinite(r.lon)&&Number.isFinite(r.lat)).map(r=>({id:r.id,name:r.name,coordinates:[r.lon,r.lat]}));
        if(!stops.length)return json(400,{error:'NO_STOPS',message:'Die ausgewählten Punkte haben keine Position.'});
        let start=MANGOLD,rest=stops;
        if(input.start&&input.start!=='mangold'){const s=stops.find(x=>x.id===input.start);if(!s)return json(400,{error:'INVALID_START',message:'Startpunkt muss Mangold oder einer der ausgewählten Punkte sein.'});start=s;rest=stops.filter(x=>x!==s);}
        if(!rest.length)return json(400,{error:'NO_STOPS',message:'Neben dem Start mindestens einen weiteren Punkt auswählen.'});
        const result=await router.plan({stops:rest,start,end:input.rundtour===false?null:start});
        return json(200,{...result,skipped:input.ids.length-stops.length});
      }catch(e){return fail(e);}
    }
  };
}
module.exports={createMapsApi};
