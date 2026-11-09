'use strict';
// Test-Doubles für GeoRadar 4 (Supabase-REST der Kartentabellen, SerpApi, OpenRouteService). Nie im Produktivcode geladen.
function fakeMapsSupabase(){
  const maps=[],points=[],cache=new Map(),calls=[];let seq=0;
  const json=(body,status=200,headers={})=>new Response(body===null?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
  const val=(p,k)=>{const v=p.get(k);return v?v.replace(/^eq\./,''):null;};
  async function fetchImpl(url,options={}){
    const u=new URL(url),method=options.method||'GET',table=u.pathname.replace('/rest/v1/',''),p=u.searchParams;calls.push({table,method});
    if(!options.headers?.apikey)return json({message:'no key'},401);
    if(table==='georadar_maps'){
      if(method==='POST'){const row=JSON.parse(options.body);if(maps.some(m=>m.share_key===row.share_key))return json({code:'23505'},409);const saved={id:'00000000-0000-4000-8000-'+String(++seq).padStart(12,'0'),description:null,...row,created_at:'2026-11-09T09:00:00Z',updated_at:'2026-11-09T09:00:00Z'};maps.push(saved);return json([saved],201);}
      if(method==='PATCH'){const m=maps.find(m=>m.id===val(p,'id'));if(m)Object.assign(m,JSON.parse(options.body));return json(null,204);}
      const id=val(p,'id'),key=val(p,'share_key');return json(maps.filter(m=>(id&&m.id===id)||(key&&m.share_key===key)).slice(0,1));
    }
    if(table==='georadar_map_points'){
      const mapId=val(p,'map_id');
      if(method==='HEAD'){const n=points.filter(x=>x.map_id===mapId).length;return new Response(null,{status:200,headers:{'content-range':'0-0/'+n}});}
      if(method==='DELETE'){for(let i=points.length-1;i>=0;i--)if(points[i].map_id===mapId)points.splice(i,1);return json(null,204);}
      if(method==='POST'){for(const row of JSON.parse(options.body)){const i=points.findIndex(x=>x.map_id===row.map_id&&x.point_id===row.point_id);if(i>=0)points[i]={...points[i],...row};else points.push({...row,created_at:new Date(Date.UTC(2026,10,9,9,0,0,points.length)).toISOString()});}return json(null,201);}
      const status=val(p,'geocode_status'),limit=Number(p.get('limit')||1000),offset=Number(p.get('offset')||0);
      return json(points.filter(x=>x.map_id===mapId&&(!status||x.geocode_status===status)).slice(offset,offset+limit).map(x=>({point_id:x.point_id,record:x.record,geocode_status:x.geocode_status})));
    }
    if(table==='georadar_geocode_cache'){
      if(method==='POST'){for(const row of JSON.parse(options.body))cache.set(row.query_hash,row);return json(null,201);}
      const list=(p.get('query_hash')||'').replace(/^in\.\(|\)$/g,'').split(',');return json(list.filter(h=>cache.has(h)).map(h=>cache.get(h)));
    }
    return json({code:'PGRST205'},404);
  }
  return {fetchImpl,maps,points,cache,calls,getConfig:()=>({url:'https://example-test.supabase.co',key:'sb_secret_'+'x'.repeat(40)})};
}
function fakeSerpApi(places){
  const calls=[];
  async function fetchImpl(url){const q=new URL(url).searchParams.get('q');calls.push(q);const hit=Object.entries(places).find(([k])=>q.toLowerCase().includes(k.toLowerCase()));
    if(!hit)return Response.json({error:"Google hasn't returned any results for this query."});
    const [lon,lat,address,many]=hit[1];
    return Response.json(many?{local_results:[{gps_coordinates:{latitude:lat,longitude:lon},address},{gps_coordinates:{latitude:lat+0.1,longitude:lon}}]}:{place_results:{gps_coordinates:{latitude:lat,longitude:lon},address}});}
  return {fetchImpl,calls};
}
function fakeOrs(){
  const calls=[];
  async function fetchImpl(url,options){const path=new URL(url).pathname,body=JSON.parse(options.body);calls.push({path,body});
    if(path==='/optimization'){// umgekehrte Reihenfolge als "Optimierung"
      return Response.json({routes:[{steps:[{type:'start'},...body.jobs.slice().reverse().map(j=>({type:'job',job:j.id})),{type:'end'}]}],unassigned:[]});}
    const c=body.coordinates;return Response.json({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'LineString',coordinates:c},properties:{summary:{distance:1000*(c.length-1),duration:600*(c.length-1)},segments:c.slice(1).map(()=>({distance:1000,duration:600}))}}]});}
  return {fetchImpl,calls};
}
module.exports={fakeMapsSupabase,fakeSerpApi,fakeOrs};
