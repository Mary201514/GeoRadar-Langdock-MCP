'use strict';
// GeoRadar 4 – dauerhaft hinterlegte PLZ-Gebiete (5-stellig, OSM/ODbL) mit Punktzahl je Gebiet.
(() => {
  const $=id=>document.getElementById(id);
  let map,loading=null,loaded=false,counted=new Set(),popup;
  const toggle=document.createElement('label');
  toggle.innerHTML='<span>PLZ-Gebiete (5-stellig)<small>Grenzen ab Zoom 6 · Nummern ab Zoom 9</small></span><input type="checkbox" id="plz-layer">';
  $('layer-controls')?.prepend(toggle);
  const box=$('plz-layer');
  const before=()=>['company-clusters','territory-site-ring','company-points'].find(id=>map.getLayer(id));
  function ensure(){
    if(loaded||loading)return loading;
    $('map-status').textContent='◌ PLZ-Gebiete werden geladen …';
    loading=Promise.resolve().then(()=>{
      map.addSource('plz5',{type:'geojson',data:{type:'FeatureCollection',features:[]},promoteId:'plz',tolerance:0.45});
      map.addSource('plz5-labels',{type:'geojson',data:'/plz/plz5-labels.geojson'});
      const b=before();
      map.addLayer({id:'plz5-fill',type:'fill',source:'plz5',minzoom:5,paint:{'fill-color':'#2387ec','fill-opacity':['case',['>',['coalesce',['feature-state','n'],0],0],['interpolate',['linear'],['feature-state','n'],1,0.12,10,0.3,50,0.45],0.0]}},b);
      map.addLayer({id:'plz5-line',type:'line',source:'plz5',minzoom:6,paint:{'line-color':'#41607a','line-opacity':['interpolate',['linear'],['zoom'],6,0.25,10,0.6],'line-width':['interpolate',['linear'],['zoom'],6,0.3,12,1.2]}},b);
      map.addLayer({id:'plz5-label',type:'symbol',source:'plz5-labels',minzoom:9,layout:{'text-field':['get','plz'],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],9,10,13,13],'text-allow-overlap':false},paint:{'text-color':'#1d3d57','text-halo-color':'#ffffff','text-halo-width':1.2}},b);
      map.on('click','plz5-fill',e=>{
        if(map.queryRenderedFeatures(e.point,{layers:['company-points','company-clusters'].filter(id=>map.getLayer(id))}).length)return;
        const f=e.features[0],plz=f.properties.plz,n=map.getFeatureState({source:'plz5',id:plz})?.n||0;
        const div=document.createElement('div'),h=document.createElement('h3'),p=document.createElement('p'),b=document.createElement('button');
        h.textContent='PLZ '+plz;p.textContent=n+(n===1?' Punkt':' Punkte')+' in den aktuellen Filtern';b.className='outline';b.textContent='Nur diese PLZ anzeigen';
        b.onclick=()=>{const s=$('company-search');if(s){s.value=plz;s.dispatchEvent(new Event('input'));}popup?.remove();};
        div.append(h,p,b);popup?.remove();popup=new maplibregl.Popup({maxWidth:'260px'}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });
      Promise.all(['/plz/plz5-nord.geojson','/plz/plz5-sued.geojson'].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error(u);return r.json();}))).then(parts=>{
        map.getSource('plz5').setData({type:'FeatureCollection',features:parts.flatMap(p=>p.features)});
        const done=()=>{if(!map.isSourceLoaded('plz5'))return;map.off('sourcedata',done);loaded=true;$('map-status').textContent='● PLZ-Gebiete geladen · © OpenStreetMap-Mitwirkende (ODbL)';updateCounts();};
        map.on('sourcedata',done);done();
      }).catch(()=>{$('map-status').textContent='◌ PLZ-Gebiete konnten nicht geladen werden';});
    });
    return loading;
  }
  function visibility(on){for(const id of ['plz5-fill','plz5-line','plz5-label'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on?'visible':'none');}
  function updateCounts(){
    if(!map||!map.getSource('plz5'))return;
    const counts=new Map();
    for(const r of window.GeoRadarCompanies?.getFilteredRecords()||[])if(r.country==='Deutschland'&&/^\d{5}$/.test(r.postalCode||''))counts.set(r.postalCode,(counts.get(r.postalCode)||0)+1);
    for(const plz of counted)if(!counts.has(plz))map.removeFeatureState({source:'plz5',id:plz},'n');
    for(const [plz,n]of counts)map.setFeatureState({source:'plz5',id:plz},{n});
    counted=new Set(counts.keys());
  }
  box.onchange=async()=>{if(!map)return;if(box.checked){await ensure();visibility(true);}else visibility(false);};
  document.addEventListener('georadar:map-ready',e=>{map=e.detail;if(window.GeoRadarSharedMap||box.checked){box.checked=true;ensure();}});
  document.addEventListener('georadar:filter-updated',()=>{if(loaded)updateCounts();});
})();
