'use strict';
(() => {
 const path=window.location.pathname;if(!/^\/[A-Za-z][A-Za-z0-9-]{2,31}\/?$/.test(path))return;
 const code=path.replace(/\//g,'').toUpperCase();if(['API','MCP','ASSETS','DIST','LICENSES','STATIC'].includes(code))return;
 const status=document.getElementById('bridge-state'),summary=document.getElementById('company-summary');
 status.textContent='Gespeicherte Recherche '+code+' wird geladen …';
 const phase=document.querySelector('.phase-tag');if(phase)phase.textContent='RECHERCHE '+code;
 const notice=document.createElement('p');notice.className='micro';notice.setAttribute('role','status');status.after(notice);
 let loaded=false,loading=false;
 const login=document.createElement('button');login.type='button';login.className='outline';login.textContent='Anmelden';login.hidden=true;notice.after(login);
 login.onclick=()=>document.getElementById('web-login-open')?.click();
 document.addEventListener('georadar:account',e=>{if(e.detail.signedIn&&!loaded&&!login.hidden)load();});
 async function load(){
  if(loading)return;loading=true;
  try{
   const response=await fetch('/api/research?code='+encodeURIComponent(code),{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
   const body=await response.json();
   if(response.status===401){status.textContent='Recherche '+code+' · Anmeldung erforderlich';notice.textContent='Diese Recherche enthält echte Firmen und ist nach der Anmeldung sichtbar.';login.hidden=false;return;}
   if(!response.ok)throw Error(body.message||'Recherche konnte nicht geladen werden.');
   login.hidden=true;loaded=true;
   if(body.code!==code||body.persisted!==true)throw Error('Unerwartete Rechercheantwort.');
   const data=window.GeoRadarData.validate(body.data);window.GeoRadarResearchSource={code:body.code,createdAt:body.createdAt};document.dispatchEvent(new CustomEvent('georadar:research-loaded',{detail:{code,data}}));
   status.textContent='Supabase · '+code+' · '+data.records.length+' Unternehmen geladen';
   notice.textContent=body.title+' · Gespeichert: '+new Date(body.createdAt).toLocaleString('de-DE')+(body.publiclyReadable?' · Ausschließlich fiktive Testdaten':' · Rechercheergebnisse, nur nach Anmeldung sichtbar');
   document.title='GeoRadar · '+code+' · '+body.title;
  }catch(e){status.textContent='Recherche '+code+' nicht geladen';login.hidden=true;notice.textContent=e.message;if(summary)summary.textContent='Keine gespeicherten Daten übernommen. Andere Kartenfunktionen bleiben verfügbar.';}
  finally{loading=false;}
 }
 load().finally(()=>{});
})();
