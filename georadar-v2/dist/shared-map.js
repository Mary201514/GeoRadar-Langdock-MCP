'use strict';
// GeoRadar 4 – lädt eine geteilte Karte über den kryptischen Link /k/<schlüssel>.
(() => {
  const match=/^\/k\/([A-Za-z0-9_-]{22,64})\/?$/.exec(window.location.pathname);
  if(!match)return;
  const key=match[1],$=id=>document.getElementById(id);
  window.GeoRadarSharedMap={key,loaded:false};
  document.documentElement.classList.add('shared-map');
  const status=$('bridge-state'),phase=document.querySelector('.phase-tag');
  if(phase)phase.textContent='GETEILTE KARTE';
  status.textContent='Geteilte Karte wird geladen …';
  const notice=document.createElement('p');notice.className='micro shared-notice';notice.setAttribute('role','status');status.after(notice);
  async function load(){
    try{
      const response=await fetch('/api/karte?key='+encodeURIComponent(key),{headers:{Accept:'application/json'},cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(25000)});
      let body={};try{body=await response.json();}catch{}
      if(!response.ok)throw Error(response.status===404?'Diese Karte gibt es nicht (mehr). Bitte den Link prüfen.':(body.message||'Karte konnte nicht geladen werden.'));
      window.GeoRadarSharedMap={key,loaded:true,title:body.titel,routing:body.routing===true};
      window.GeoRadarCompanies.replace({records:body.records},'Geteilte Karte');
      document.title='GeoRadar · '+body.titel;
      const area=$('area-name');if(area)area.textContent=body.titel;
      status.textContent=body.records.length+' Punkte geladen';
      notice.textContent=[body.beschreibung,'Stand: '+new Date(body.aktualisiert).toLocaleString('de-DE'),body.offen?body.offen+' Adressen werden noch gesucht – Seite später neu laden.':''].filter(Boolean).join(' · ');
      document.dispatchEvent(new CustomEvent('georadar:shared-map-loaded',{detail:window.GeoRadarSharedMap}));
    }catch(e){status.textContent='Geteilte Karte nicht geladen';notice.textContent=e.message;}
  }
  // companies.js und app.js sind dann initialisiert
  if(document.readyState==='complete')load();else window.addEventListener('load',load,{once:true});
})();
