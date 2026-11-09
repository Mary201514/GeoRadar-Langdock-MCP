'use strict';
// GeoRadar 4 – Punkte auswählen und optimale Route über OpenRouteService berechnen (nur auf geteilten Karten).
(() => {
  const $=id=>document.getElementById(id),MAX=48;
  let map,selected=new Map(),result=null,busy=false;
  const panel=document.createElement('section');panel.id='route-planner';panel.className='route-planner';panel.hidden=true;
  panel.innerHTML='<div class="divider"></div><div class="section-heading"><h3>Route planen</h3><span id="route-count" class="empty-count">0</span></div>'+
    '<p class="micro">Punkte über das Popup auswählen („Zur Route“) oder alle gefilterten übernehmen. Höchstens '+MAX+' Stopps.</p>'+
    '<div class="company-actions"><button id="route-add-filtered" class="outline" type="button">Gefilterte übernehmen</button><button id="route-clear" class="subtle" type="button">Auswahl leeren</button></div>'+
    '<label class="field-label" for="route-start">Start</label><select id="route-start"><option value="mangold">Mangold, Friedrichshafen</option></select>'+
    '<label class="route-check"><input type="checkbox" id="route-roundtrip" checked> Rundtour – zurück zum Start</label>'+
    '<button id="route-run" class="outline route-run" type="button">Optimale Route berechnen</button>'+
    '<div id="route-state" class="micro" role="status"></div><ol id="route-list" class="route-list"></ol><div id="route-links" class="route-links"></div>';
  (document.querySelector('.sidebar-foot')||$('sidebar')).before(panel);

  const km=m=>(m/1000).toLocaleString('de-DE',{maximumFractionDigits:1})+' km';
  const time=s=>{const h=Math.floor(s/3600),m=Math.round((s%3600)/60);return (h?h+' h ':'')+m+' min';};
  function records(){return window.GeoRadarCompanies?.getSnapshot().records||[];}
  function refresh(){
    $('route-count').textContent=selected.size;
    const start=$('route-start'),value=start.value;start.replaceChildren(new Option('Mangold, Friedrichshafen','mangold'));
    for(const [id,r]of selected)start.add(new Option('Ab '+r.name,id));
    start.value=[...start.options].some(o=>o.value===value)?value:'mangold';
    $('route-run').disabled=busy||!selected.size||(start.value!=='mangold'&&selected.size<2);
    if(map?.getSource('route-selection'))map.getSource('route-selection').setData({type:'FeatureCollection',features:[...selected.values()].map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[r.lon,r.lat]},properties:{id:r.id}}))});
  }
  function toggle(r){
    if(!Number.isFinite(r.lon))return;
    if(selected.has(r.id))selected.delete(r.id);
    else{if(selected.size>=MAX){$('route-state').textContent='Höchstens '+MAX+' Stopps.';return;}selected.set(r.id,r);}
    refresh();
  }
  window.GeoRadarPopupExtras=(r,content)=>{
    if(!window.GeoRadarSharedMap?.loaded||!Number.isFinite(r.lon))return;
    const b=document.createElement('button');b.className='outline';b.type='button';
    const label=()=>{b.textContent=selected.has(r.id)?'✓ In der Route – entfernen':'+ Zur Route';};label();
    b.onclick=()=>{toggle(r);label();};content.append(b);
  };
  $('route-add-filtered').onclick=()=>{
    const list=(window.GeoRadarCompanies?.getFilteredRecords()||[]).filter(r=>Number.isFinite(r.lon));
    let added=0;for(const r of list){if(selected.size>=MAX)break;if(!selected.has(r.id)){selected.set(r.id,r);added++;}}
    $('route-state').textContent=added+' Punkte übernommen'+(list.length>added&&selected.size>=MAX?' · Grenze von '+MAX+' Stopps erreicht':'')+'.';refresh();
  };
  $('route-clear').onclick=()=>{selected.clear();clearRoute();$('route-state').textContent='';refresh();};
  $('route-start').onchange=refresh;
  function clearRoute(){result=null;$('route-list').replaceChildren();$('route-links').replaceChildren();if(map?.getSource('route-line')){map.getSource('route-line').setData({type:'FeatureCollection',features:[]});map.getSource('route-stops').setData({type:'FeatureCollection',features:[]});}}
  function googleLinks(sequence){
    const out=[],pt=s=>s.coordinates[1]+','+s.coordinates[0];
    for(let i=0;i<sequence.length-1;i+=9){const part=sequence.slice(i,Math.min(i+10,sequence.length));const p=new URLSearchParams({api:'1',origin:pt(part[0]),destination:pt(part[part.length-1]),travelmode:'driving'});if(part.length>2)p.set('waypoints',part.slice(1,-1).map(pt).join('|'));out.push({label:sequence.length>10?'Etappe '+(out.length+1):'Route in Google Maps öffnen',href:'https://www.google.com/maps/dir/?'+p});}
    return out;
  }
  function show(res){
    result=res;const list=$('route-list');list.replaceChildren();
    res.sequence.forEach((s,i)=>{const li=document.createElement('li'),b=document.createElement('b'),small=document.createElement('small');b.textContent=s.name;const seg=res.segments[i-1];small.textContent=i===0?'Start':(seg?km(seg.distance_m)+' · '+time(seg.duration_s):'');li.append(b,small);li.onclick=()=>map?.flyTo({center:s.coordinates,zoom:Math.max(map.getZoom(),11)});list.append(li);});
    const links=$('route-links');links.replaceChildren();for(const l of googleLinks(res.sequence)){const a=document.createElement('a');a.href=l.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=l.label+' ↗';links.append(a);}
    $('route-state').textContent=(res.optimized?'Optimierte Reihenfolge':'Route')+' · '+km(res.distance_m)+' · '+time(res.duration_s)+' Fahrzeit'+(res.skipped?' · '+res.skipped+' Punkte ohne Position übersprungen':'')+' · Routing © openrouteservice.org, OpenStreetMap';
    if(map){
      map.getSource('route-line').setData({type:'Feature',geometry:res.geometry,properties:{}});
      map.getSource('route-stops').setData({type:'FeatureCollection',features:res.sequence.map((s,i)=>({type:'Feature',geometry:{type:'Point',coordinates:s.coordinates},properties:{n:i===0?'S':(i===res.sequence.length-1&&$('route-roundtrip').checked&&s.id===res.sequence[0].id?'':String(i))}})).filter(f=>f.properties.n!=='')});
      const c=res.geometry.coordinates,b=c.reduce((a,p)=>[[Math.min(a[0][0],p[0]),Math.min(a[0][1],p[1])],[Math.max(a[1][0],p[0]),Math.max(a[1][1],p[1])]],[[c[0][0],c[0][1]],[c[0][0],c[0][1]]]);
      map.fitBounds(b,{padding:60,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:800});
    }
  }
  $('route-run').onclick=async()=>{
    if(busy)return;busy=true;refresh();$('route-state').textContent='Route wird berechnet …';clearRoute();
    try{
      const response=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},credentials:'omit',body:JSON.stringify({key:window.GeoRadarSharedMap.key,ids:[...selected.keys()],start:$('route-start').value,rundtour:$('route-roundtrip').checked}),signal:AbortSignal.timeout(60000)});
      let body={};try{body=await response.json();}catch{}
      if(!response.ok)throw Error(body.message||'Route konnte nicht berechnet werden.');
      show(body);
    }catch(e){$('route-state').textContent=e.name==='TimeoutError'?'Zeitüberschreitung bei der Routenberechnung.':e.message;}
    finally{busy=false;refresh();}
  };
  document.addEventListener('georadar:shared-map-loaded',e=>{
    panel.hidden=false;
    if(!e.detail.routing){$('route-run').disabled=true;$('route-state').textContent='Routing ist auf diesem Server noch nicht eingerichtet.';}
    const ids=new Set(records().map(r=>r.id));for(const id of [...selected.keys()])if(!ids.has(id))selected.delete(id);refresh();
  });
  document.addEventListener('georadar:map-ready',e=>{
    map=e.detail;
    map.addSource('route-line',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addSource('route-stops',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addSource('route-selection',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'route-line-casing',type:'line',source:'route-line',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffffff','line-width':7,'line-opacity':.9}});
    map.addLayer({id:'route-line',type:'line',source:'route-line',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#e0444e','line-width':4}});
    map.addLayer({id:'route-selection',type:'circle',source:'route-selection',paint:{'circle-radius':13,'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#e0444e','circle-stroke-width':3}});
    map.addLayer({id:'route-stops',type:'circle',source:'route-stops',paint:{'circle-radius':11,'circle-color':'#173a55','circle-stroke-color':'#ffffff','circle-stroke-width':2}});
    map.addLayer({id:'route-stop-labels',type:'symbol',source:'route-stops',layout:{'text-field':['get','n'],'text-font':['Noto Sans Bold'],'text-size':11,'text-allow-overlap':true},paint:{'text-color':'#ffffff'}});
    refresh();
  });
})();
