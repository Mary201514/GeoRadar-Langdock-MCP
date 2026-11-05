'use strict';
(() => {
 const path=window.location.pathname;if(!/^\/[A-Za-z][A-Za-z0-9-]{2,31}\/?$/.test(path))return;
 const code=path.replace(/\//g,'').toUpperCase();if(['API','MCP','ASSETS','DIST','LICENSES','STATIC'].includes(code))return;
 const status=document.getElementById('bridge-state'),summary=document.getElementById('company-summary');
 status.textContent='Gespeicherte Recherche '+code+' wird geladen …';
 const phase=document.querySelector('.phase-tag');if(phase)phase.textContent='RECHERCHE '+code;
 const notice=document.createElement('p');notice.className='micro';notice.setAttribute('role','status');status.after(notice);
 async function load(){
  try{
   const response=await fetch('/api/research?code='+encodeURIComponent(code),{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
   const body=await response.json();if(!response.ok)throw Error(body.message||'Recherche konnte nicht geladen werden.');
   if(body.code!==code||body.persisted!==true)throw Error('Unerwartete Rechercheantwort.');
   const data=window.GeoRadarData.validate(body.data);window.GeoRadarResearchSource={code:body.code,createdAt:body.createdAt};document.dispatchEvent(new CustomEvent('georadar:research-loaded',{detail:{code,data}}));
   status.textContent='Supabase · '+code+' · '+data.records.length+' Unternehmen geladen';
   notice.textContent=body.title+' · Gespeichert: '+new Date(body.createdAt).toLocaleString('de-DE')+' · Ausschließlich fiktive Testdaten';
   document.title='GeoRadar · '+code+' · '+body.title;
  }catch(e){status.textContent='Recherche '+code+' nicht geladen';notice.textContent=e.message;if(summary)summary.textContent='Keine gespeicherten Daten übernommen. Andere Kartenfunktionen bleiben verfügbar.';}
 }
 load();
})();
