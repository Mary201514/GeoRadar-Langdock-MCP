'use strict';
// GeoRadar 4 – optimale Reihenfolge und Fahrtroute über OpenRouteService (VROOM-Optimierung + Directions).
class RouteError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}

const MANGOLD={id:'mangold',name:'Mangold, Friedrichshafen',coordinates:[9.508511741063957,47.64373714669217]};
const MAX_STOPS=48; // ORS: höchstens 50 Wegpunkte inkl. Start und Ziel

function createRouter({fetchImpl=(...args)=>fetch(...args),getKey=()=>process.env.ORS_API_KEY}={}){
  function key(){const k=getKey();if(typeof k!=='string'||k.length<16||/\s/.test(k))throw new RouteError(503,'ROUTING_NOT_CONFIGURED','Routing ist noch nicht eingerichtet (ORS_API_KEY fehlt).');return k;}
  async function call(path,body){
    let response;
    try{response=await fetchImpl('https://api.openrouteservice.org'+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(25000),headers:{Authorization:key(),'Content-Type':'application/json',Accept:'application/json, application/geo+json'},body:JSON.stringify(body)});}
    catch(e){if(e instanceof RouteError)throw e;throw new RouteError(502,'ROUTING_UNREACHABLE','OpenRouteService ist nicht erreichbar.');}
    let data;try{data=await response.json();}catch{data=null;}
    if(response.status===401||response.status===403)throw new RouteError(503,'ROUTING_NOT_CONFIGURED','OpenRouteService lehnt den Schlüssel ab.');
    if(response.status===429)throw new RouteError(429,'ROUTING_RATE_LIMIT','Tageskontingent von OpenRouteService erreicht. Bitte später erneut versuchen.');
    if(!response.ok||!data){const msg=data?.error?.message||data?.error||'';throw new RouteError(422,'ROUTING_FAILED','Route konnte nicht berechnet werden'+(msg?': '+String(msg).slice(0,200):'.'));}
    return data;
  }
  async function plan({stops,start,end}){
    if(!Array.isArray(stops)||stops.length<1)throw new RouteError(400,'NO_STOPS','Mindestens einen Punkt mit Position auswählen.');
    if(stops.length>MAX_STOPS)throw new RouteError(400,'TOO_MANY_STOPS','Höchstens '+MAX_STOPS+' Stopps pro Route.');
    let order=stops.map((_,i)=>i);
    if(stops.length>1){
      const opt=await call('/optimization',{jobs:stops.map((s,i)=>({id:i+1,location:s.coordinates})),vehicles:[{id:1,profile:'driving-car',start:start.coordinates,...(end?{end:end.coordinates}:{})}]});
      const steps=opt?.routes?.[0]?.steps;if(!Array.isArray(steps))throw new RouteError(422,'ROUTING_FAILED','Optimierung lieferte keine Reihenfolge.');
      order=steps.filter(s=>s.type==='job').map(s=>s.job-1);
      const unassigned=(opt.unassigned||[]).map(u=>u.id-1);order.push(...unassigned.filter(i=>!order.includes(i)));
    }
    const sequence=[start,...order.map(i=>stops[i]),...(end?[end]:[])];
    const dir=await call('/v2/directions/driving-car/geojson',{coordinates:sequence.map(s=>s.coordinates),instructions:false,units:'m',radiuses:sequence.map(()=>2000)});
    const feature=dir?.features?.[0];if(!feature?.geometry)throw new RouteError(422,'ROUTING_FAILED','Keine Fahrtroute erhalten.');
    const segments=(feature.properties?.segments||[]).map(s=>({distance_m:Math.round(s.distance||0),duration_s:Math.round(s.duration||0)}));
    return {geometry:feature.geometry,distance_m:Math.round(feature.properties?.summary?.distance||0),duration_s:Math.round(feature.properties?.summary?.duration||0),sequence:sequence.map(s=>({id:s.id,name:s.name,coordinates:s.coordinates})),segments,optimized:stops.length>1};
  }
  return {plan,configured(){try{key();return true;}catch{return false;}}};
}

module.exports={createRouter,RouteError,MANGOLD,MAX_STOPS};
