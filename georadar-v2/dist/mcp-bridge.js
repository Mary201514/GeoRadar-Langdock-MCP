'use strict';
(() => {
  const status=document.getElementById('bridge-state');
  if(window.parent===window){status.textContent='Eigenständige Anwendung · JSON-Import bereit';return;}
  const id='georadar-initialize-'+crypto.randomUUID();let connected=false,hostOrigin;
  // Only the direct parent can negotiate; bind subsequent traffic to its origin.
  const send=message=>window.parent.postMessage(message,hostOrigin&&hostOrigin!=='null'?hostOrigin:'*');
  const timer=setTimeout(()=>{if(!connected)status.textContent='Keine MCP-Host-Verbindung · manueller JSON-Import verfügbar';},10000);
  window.addEventListener('message',event=>{
    if(event.source!==window.parent)return;
    const m=event.data;if(!m||m.jsonrpc!=='2.0')return;
    if(!connected){
      if(m.id!==id)return;
      if(m.error||!m.result||m.result.protocolVersion!=='2026-01-26'){clearTimeout(timer);status.textContent='MCP-Initialisierung nicht unterstützt';return;}
      connected=true;hostOrigin=event.origin;clearTimeout(timer);
      send({jsonrpc:'2.0',method:'ui/notifications/initialized'});status.textContent='MCP-Host verbunden · wartet auf Werkzeugergebnis';
      send({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height:900}});return;
    }
    if(event.origin!==hostOrigin)return;
    if(m.method==='ui/notifications/tool-result')document.dispatchEvent(new CustomEvent('georadar:tool-result',{detail:m.params}));
    if(m.method==='ui/notifications/tool-cancelled')status.textContent='MCP-Aufruf abgebrochen · bestehende Daten bleiben erhalten';
    if(m.method==='ping'&&m.id!==undefined)send({jsonrpc:'2.0',id:m.id,result:{}});
    if(m.method==='ui/resource-teardown'&&m.id!==undefined){send({jsonrpc:'2.0',id:m.id,result:{}});}
  });
  status.textContent='MCP-Host wird verbunden …';
  send({jsonrpc:'2.0',id,method:'ui/initialize',params:{protocolVersion:'2026-01-26',appInfo:{name:'mangold-georadar',version:'2.0.0'},appCapabilities:{availableDisplayModes:['inline','fullscreen']}}});
})();
