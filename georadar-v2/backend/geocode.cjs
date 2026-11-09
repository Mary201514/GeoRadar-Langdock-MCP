'use strict';
// GeoRadar 4 – Adresssuche über SerpApi (Google-Maps-Suche). Ergebnisse werden im Supabase-Cache gehalten.
const crypto=require('node:crypto');

class GeocodeError extends Error{constructor(code,message){super(message);this.code=code;}}

function addressQuery(r){
  const country=r.country==='Österreich'?'Österreich':'Deutschland';
  if(r.address)return /deutschland|germany|österreich|austria/i.test(r.address)?r.address:r.address+', '+country;
  const line=[r.street,[r.postalCode&&r.postalCode.length>=4?r.postalCode:'',r.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  if(!line||(!r.street&&!(r.postalCode&&r.postalCode.length>=4)&&!r.city))return null;
  // Ohne Straße: Firmenname hilft Google, den Standort zu finden.
  return (r.street?'':r.name+', ')+line+', '+country;
}
function normalizeQuery(q){return q.normalize('NFC').toLocaleLowerCase('de').replace(/\s+/g,' ').replace(/\s*,\s*/g,', ').trim();}
function queryHash(q){return crypto.createHash('sha256').update(normalizeQuery(q)).digest('hex');}

const BOUNDS={minLon:5,maxLon:18,minLat:46,maxLat:56};
function inBounds(lon,lat){return Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=BOUNDS.minLon&&lon<=BOUNDS.maxLon&&lat>=BOUNDS.minLat&&lat<=BOUNDS.maxLat;}

function createGeocoder({fetchImpl=(...args)=>fetch(...args),getKey=()=>process.env.SERPAPI_KEY}={}){
  function key(){const k=getKey();if(typeof k!=='string'||k.length<16||/\s/.test(k))throw new GeocodeError('GEOCODING_NOT_CONFIGURED','SERPAPI_KEY ist serverseitig nicht gesetzt. Adressen können nicht gesucht werden.');return k;}
  async function lookup(query,{country='Deutschland'}={}){
    const params=new URLSearchParams({engine:'google_maps',type:'search',q:query,hl:'de',gl:country==='Österreich'?'at':'de',api_key:key()});
    let response;
    try{response=await fetchImpl('https://serpapi.com/search.json?'+params,{redirect:'error',signal:AbortSignal.timeout(20000)});}
    catch{throw new GeocodeError('GEOCODING_UNREACHABLE','SerpApi ist nicht erreichbar.');}
    let data;try{data=await response.json();}catch{data=null;}
    if(response.status===401||response.status===403)throw new GeocodeError('GEOCODING_NOT_CONFIGURED','SerpApi lehnt den Schlüssel ab.');
    if(response.status===429)throw new GeocodeError('GEOCODING_RATE_LIMIT','SerpApi-Kontingent oder Rate-Limit erreicht.');
    if(!data)throw new GeocodeError('GEOCODING_FAILED','Ungültige Antwort von SerpApi.');
    if(data.error){if(/hasn't returned any results|no results/i.test(data.error))return {status:'not_found'};if(/run out of searches|plan|limit/i.test(data.error))throw new GeocodeError('GEOCODING_RATE_LIMIT','SerpApi: '+data.error);throw new GeocodeError('GEOCODING_FAILED','SerpApi: '+data.error);}
    const place=data.place_results;
    let hit=place?.gps_coordinates?{lat:place.gps_coordinates.latitude,lon:place.gps_coordinates.longitude,address:place.address}:null,ambiguous=false;
    if(!hit&&Array.isArray(data.local_results)&&data.local_results[0]?.gps_coordinates){const first=data.local_results[0];hit={lat:first.gps_coordinates.latitude,lon:first.gps_coordinates.longitude,address:first.address};ambiguous=data.local_results.length>1;}
    if(!hit||!inBounds(Number(hit.lon),Number(hit.lat)))return {status:'not_found'};
    return {status:'ok',lon:Number(hit.lon),lat:Number(hit.lat),formatted_address:typeof hit.address==='string'?hit.address.slice(0,500):null,ambiguous};
  }
  return {lookup,configured(){try{key();return true;}catch{return false;}}};
}

module.exports={createGeocoder,GeocodeError,addressQuery,normalizeQuery,queryHash,inBounds};
