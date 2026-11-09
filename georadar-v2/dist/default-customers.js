'use strict';
// GeoRadar – Startseite: nach der Anmeldung immer die ganze Bestandskundenliste als Punkte zeigen.
(() => {
  const params=new URLSearchParams(location.search);
  if(window.parent!==window||location.pathname!=='/'||params.has('view'))return;
  const $=id=>document.getElementById(id);
  let state='idle';
  const notice=document.createElement('div');notice.className='customer-notice';notice.setAttribute('role','status');notice.hidden=true;
  const text=document.createElement('p');text.className='micro';
  const button=document.createElement('button');button.type='button';button.className='outline';button.textContent='Anmelden';button.hidden=true;
  button.onclick=()=>$('web-login-open')?.click();
  notice.append(text,button);
  ($('bridge-state')||document.body).after(notice);
  function show(message,withLogin){notice.hidden=false;text.textContent=message;button.hidden=!withLogin;}
  async function load(){
    if(state==='loading'||state==='loaded')return;
    state='loading';show('Bestandskunden werden geladen …',false);
    try{
      const r=await fetch('/api/kunden',{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(30000)});
      let body={};try{body=await r.json();}catch{}
      if(r.status===401){state='idle';show('Die Bestandskunden werden nach der Anmeldung angezeigt.',true);return;}
      if(!r.ok)throw Error(body.message||'Bestandskunden konnten nicht geladen werden.');
      window.GeoRadarCompanies.replace({records:body.records},'Bestandskunden');
      state='loaded';
      const real=body.records.filter(x=>!x.isFictional).length;
      show(body.anzahl+' Kunden geladen ('+real+' Bestand, '+(body.anzahl-real)+' fiktive Testdatensätze). Positionen ungefähr über die PLZ; Vertreter sind Test-Zuordnungen.',false);
    }catch(e){state='idle';show(e.message,false);}
  }
  document.addEventListener('georadar:account',e=>{if(e.detail.signedIn)load();else if(state!=='loaded')show('Die Bestandskunden werden nach der Anmeldung angezeigt.',true);});
})();
