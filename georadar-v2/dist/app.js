'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const bounds = {both:[[5.80,46.30],[17.20,55.10]],de:[[5.80,47.20],[15.10,55.10]],at:[[9.45,46.30],[17.20,49.10]]};
  const names = {both:'Deutschland & Österreich',de:'Deutschland',at:'Österreich'};
  const groups = {countries:[],states:[],districts:[],places:[],roads:[],water:[]};
  let map, ready = false, activePopup, latestQuery = '';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dialog = $('information');
  for (const id of ['info','source-info']) $(id).onclick = () => dialog.showModal();
  $('close-info').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) {const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();} });
  function warn(message) { $('map-warning').hidden=false; $('map-warning').querySelector('span').textContent=message; $('load-state').hidden=true; $('map-status').textContent='◌ Kartenverbindung prüfen'; }
  $('retry').onclick = () => window.location.reload();
  function duration(ms=700) { return reduceMotion?0:ms; }
  function fit(area) {
    if (!map) return;
    $('country').value=area; $('area-name').textContent=names[area];
    const padding = {top:95,bottom:85,left:35,right:45};
    map.fitBounds(bounds[area],{padding,duration:duration(),bearing:0,pitch:0});
    if(activePopup)activePopup.remove();
  }
  $('country').onchange = e => fit(e.target.value);
  document.querySelectorAll('[data-area]').forEach(b => b.onclick=()=>fit(b.dataset.area));
  $('reset').onclick=()=>fit('both');
  const narrow=window.matchMedia('(max-width: 900px)');
  $('toggle-layers').setAttribute('aria-expanded',String(!narrow.matches));
  $('toggle-layers').onclick=()=>{
    const workspace=document.querySelector('.workspace');
    const visible=narrow.matches?workspace.classList.toggle('show-layers'):!workspace.classList.toggle('hide-layers');
    $('toggle-layers').setAttribute('aria-expanded',String(visible));
    if(map)map.resize();
  };
  $('toggle-sidebar').onclick=()=>{
    const hidden=document.querySelector('.workspace').classList.toggle('hide-sidebar');
    $('toggle-sidebar').setAttribute('aria-expanded',String(!hidden));
    if(map)map.resize();
  };
  $('export').onclick=()=>{
    if(!ready){warn('Die Karte ist noch nicht bereit. Bitte warten Sie, bis die Kartendaten geladen sind.');return;}
    const center=map.getCenter();
    const data={schema:'mangold-georadar/view/v1',version:2,createdAt:new Date().toISOString(),area:$('country').value,view:{center:[center.lng,center.lat],zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()},layers:{...Object.fromEntries([...document.querySelectorAll('[data-group]')].map(c=>[c.dataset.group,c.checked])),companies:$('company-layer').checked},dataSource:'OpenFreeMap / OpenMapTiles / © OpenStreetMap contributors (ODbL)',companyCount:window.GeoRadarCompanies.getSnapshot().records.length};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='Mangold-GeoRadar-Ansicht.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  function normalize(s){return String(s||'').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss');}
  function featureName(p){return p['name:de']||p.name_de||p['name:latin']||p.name||'';}
  function search(){
    const q=$('search').value.trim(); latestQuery=q;
    const container=$('search-results');container.replaceChildren();
    if(q.length<2)return;
    if(!ready){const p=document.createElement('p');p.textContent='Die Karte wird noch geladen.';container.append(p);return;}
    const features=map.querySourceFeatures('openmaptiles',{sourceLayer:'place'});
    const found=new Map();
    for(const f of features){
      const p=f.properties||{},name=featureName(p);
      if(f.geometry.type!=='Point'||!normalize(name).includes(normalize(q)))continue;
      const key=name+'|'+f.geometry.coordinates.map(v=>v.toFixed(3)).join(',');
      if(!found.has(key))found.set(key,{name,p,coords:f.geometry.coordinates});
    }
    const matches=[...found.values()].sort((a,b)=>(normalize(a.name)!==normalize(q))-(normalize(b.name)!==normalize(q))||a.name.localeCompare(b.name,'de')).slice(0,8);
    if(!matches.length){const p=document.createElement('p');p.textContent='Kein geladener Ortsname gefunden. Karte verschieben oder weiter heranzoomen. Es wird kein externer Suchdienst abgefragt.';container.append(p);return;}
    for(const result of matches){
      const b=document.createElement('button');b.textContent=result.name;
      const s=document.createElement('small');s.textContent=({city:'Stadt',town:'Stadt',village:'Gemeinde',country:'Land',state:'Bundesland',hamlet:'Ortsteil'})[result.p.class]||'Ort';b.append(s);
      b.onclick=()=>{map.flyTo({center:result.coords,zoom:result.p.class==='country'?5.5:result.p.class==='state'?7:11,duration:duration(900)});showPlace(result.name,result.coords);};
      container.append(b);
    }
  }
  let searchTimer;
  $('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,150);});
  function showPlace(name,coords){
    if(activePopup)activePopup.remove();
    const content=document.createElement('div'),title=document.createElement('b'),note=document.createElement('small');
    title.textContent=name;note.textContent='OSM-Ortsbezeichnung · kein Unternehmensstandort';content.append(title,note);
    activePopup=new maplibregl.Popup({maxWidth:'260px'}).setLngLat(coords).setDOMContent(content).addTo(map);
  }
  function applyGroups(){
    if(!ready)return;
    document.querySelectorAll('[data-group]').forEach(c=>{
      for(const id of groups[c.dataset.group])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',c.checked?'visible':'none');
    });
  }
  document.querySelectorAll('[data-group]').forEach(c=>c.addEventListener('change',applyGroups));
  function styleMap(style){
    // Retain the real OpenMapTiles geometries; only adapt paint and visibility.
    style.layers=style.layers.filter(l=>l.id!=='natural_earth'&&l.id!=='building-3d');
    delete style.sources.ne2_shaded;
    for(const l of style.layers){
      l.paint=l.paint||{};
      if(l.type==='background')l.paint['background-color']='#a9c3d3';
      if(l.type==='fill'){
        const water=l['source-layer']==='water';
        l.paint['fill-color']=water?'#709db7':l.id==='building'?'#7696ad':l['source-layer']==='landcover'?'#8bafc2':'#9bb9cb';
        if(!water)l.paint['fill-opacity']=l.id==='building'?.6:.35;
      }
      if(l['source-layer']==='waterway'&&l.type==='line')l.paint['line-color']='#5e8eac';
      if(l['source-layer']==='transportation'&&l.type==='line'){
        l.paint['line-color']=l.id.includes('casing')?'#7999af':l.id.includes('motorway')?'#d9e9f1':'#bfd2df';
      }
      if(l.type==='symbol'&&l.layout?.['text-field']){
        if(['place','water_name','waterway','poi'].includes(l['source-layer']))l.layout['text-field']=['coalesce',['get','name:de'],['get','name_de'],['get','name:latin'],['get','name']];
        l.paint['text-color']=l.id.startsWith('label_country')?'#254a66':'#35546b';
        l.paint['text-halo-color']='#c6dbe7';l.paint['text-halo-width']=1.2;
      }
      if(l.id==='boundary_2'||l.id==='boundary_disputed'){
        l.paint['line-color']='#315d7d';l.paint['line-opacity']=.95;groups.countries.push(l.id);
      }
      if(l['source-layer']==='place')groups.places.push(l.id);
      if(['transportation','transportation_name','aeroway','aerodrome_label'].includes(l['source-layer']))groups.roads.push(l.id);
      if(['water','waterway','water_name'].includes(l['source-layer']))groups.water.push(l.id);
      if(l['source-layer']==='poi')l.layout={...l.layout,visibility:'none'};
    }
    const base=style.layers.find(l=>l.id==='boundary_3');
    if(!base)throw new Error('Grenzebene im Kartenstil fehlt.');
    base.id='mangold-states';base.filter=['all',['==',['get','admin_level'],4],['!=',['get','maritime'],1],['!=',['get','disputed'],1]];
    base.minzoom=4;base.paint={'line-color':'#527a96','line-width':['interpolate',['linear'],['zoom'],4,.7,10,1.6],'line-opacity':.9};
    groups.states.push(base.id);
    const district=JSON.parse(JSON.stringify(base));district.id='mangold-districts';district.minzoom=8;district.filter=['all',['==',['get','admin_level'],6],['!=',['get','maritime'],1],['!=',['get','disputed'],1]];district.layout={visibility:'none'};district.paint={'line-color':'#6a8ba2','line-width':.8,'line-dasharray':[3,2]};
    style.layers.splice(style.layers.findIndex(l=>l.id==='boundary_2'),0,district);groups.districts.push(district.id);
    style.sources.openmaptiles.attribution='<a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>';
    if(window.GEORADAR_CONTEXT_MASK){
      style.sources['mangold-context']={type:'geojson',data:window.GEORADAR_CONTEXT_MASK,attribution:'Kontextmaske: DeutschlandGeoJSON / Flooh Perlot, Statistik Austria (CC BY 4.0)'};
      style.layers.push({id:'mangold-context-fade',type:'fill',source:'mangold-context',paint:{'fill-color':'#e5edf2','fill-opacity':['interpolate',['linear'],['zoom'],2,.48,7,.48,11,0],'fill-antialias':true}});
    }
    return style;
  }
  async function initialize(){
    if(!window.maplibregl){warn('Die Kartenbibliothek konnte nicht geladen werden. Bitte Netzwerkverbindung prüfen und neu laden.');return;}
    const timer=setTimeout(()=>warn('Die Kartendaten laden ungewöhnlich lange. Prüfen Sie Internetzugang und Freigaben für tiles.openfreemap.org.'),25000);
    try{
      let rawStyle=window.GEORADAR_STYLE;
      if(!rawStyle){const response=await fetch('base-style.json',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Kartenstil nicht verfügbar');rawStyle=await response.json();}
      const style=styleMap(rawStyle);
      map=new maplibregl.Map({container:'map',style,center:[11.5,50.7],zoom:4,minZoom:2,maxZoom:18,maxPitch:0,dragRotate:false,touchPitch:false,renderWorldCopies:false,attributionControl:false,keyboard:true});
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
      map.addControl(new maplibregl.ScaleControl({unit:'metric',maxWidth:110}),'bottom-left');
      map.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-right');
      fit('both');
      let mapError=false;
      map.on('error',e=>{mapError=true;clearTimeout(timer);warn('Kartendaten oder Beschriftungen konnten nicht vollständig geladen werden. Prüfen Sie die Verbindung zu OpenFreeMap und versuchen Sie es erneut.');console.error('GeoRadar Kartenfehler:',e.error?.message||e.error);});
      map.on('load',()=>{ready=true;applyGroups();document.dispatchEvent(new CustomEvent('georadar:map-ready',{detail:map}));});
      map.on('idle',()=>{
        if(!ready)return;
        clearTimeout(timer);$('load-state').hidden=true;
        if(!mapError){$('map-warning').hidden=true;$('map-status').textContent='● Grundkarte bereit · OpenStreetMap';}
      });
      map.on('moveend',()=>{if(latestQuery)search();});
      map.on('zoom',()=>{$('zoom-readout').textContent='ZOOM '+map.getZoom().toFixed(1);});
      map.on('mousemove',e=>{$('coordinates').textContent=e.lngLat.lat.toFixed(5)+'° N / '+e.lngLat.lng.toFixed(5)+'° E · WGS 84';});
      map.on('click',e=>{
        if(map.getLayer('company-points')&&map.queryRenderedFeatures(e.point,{layers:['company-points','company-clusters']}).length)return;
        const visible=groups.places.filter(id=>map.getLayer(id)&&map.getLayoutProperty(id,'visibility')!=='none');
        const f=visible.length?map.queryRenderedFeatures(e.point,{layers:visible})[0]:null;
        if(f?.geometry.type==='Point')showPlace(featureName(f.properties),f.geometry.coordinates);
      });
      const resizeObserver=new ResizeObserver(()=>map.resize());resizeObserver.observe($('map'));
      $('zoom-readout').textContent='ZOOM '+map.getZoom().toFixed(1);
    }catch(error){clearTimeout(timer);warn('Die interaktive Karte konnte nicht gestartet werden. WebGL und eine Internetverbindung sind erforderlich. '+error.message);}
  }
  initialize();
})();
