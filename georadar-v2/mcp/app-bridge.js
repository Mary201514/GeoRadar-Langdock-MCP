'use strict';
(() => {
  const status=document.getElementById('bridge-state');
  if(window.parent===window){status.textContent='MCP-App ohne Host · JSON-Import bereit';return;}
  const id='georadar-initialize-'+crypto.randomUUID();let connected=false,hostOrigin,input,hasResult=false;
  const send=message=>window.parent.postMessage(message,hostOrigin&&hostOrigin!=='null'?hostOrigin:'*');
  const timer=setTimeout(()=>{if(!connected)status.textContent='Keine MCP-Host-Verbindung · Verbindung in Langdock neu laden';},10000);
  function accept(payload){
    try{const data=window.GeoRadarData.validate(payload);document.dispatchEvent(new CustomEvent('georadar:tool-result',{detail:{structuredContent:data}}));return true;}
    catch{status.textContent='MCP-Daten ungültig · records mit id, name, country und optional lon/lat erforderlich';return false;}
  }
  function resultPayload(result){
    if(result?.structuredContent)return result.structuredContent;
    for(const c of result?.content||[]){if(c.type==='text'&&typeof c.text==='string'){try{const data=JSON.parse(c.text);if(Array.isArray(data?.records))return data;}catch{}}}
  }
  document.addEventListener('securitypolicyviolation',e=>{
    if(!/worker-src|connect-src|script-src|img-src/.test(e.effectiveDirective))return;
    const warning=document.getElementById('map-warning');if(!warning)return;
    const message=e.blockedURI==='blob'||e.blockedURI?.startsWith('blob:')?'Langdock blockiert einen benötigten Blob-Worker. Die App-Sandbox muss worker-src blob: und connect-src blob: erlauben.':'Langdock blockiert Kartenressourcen ('+e.effectiveDirective+'). tiles.openfreemap.org muss in der App-Sandbox freigegeben sein.';
    warning.hidden=false;let text=warning.querySelector('[data-mcp-csp]');if(!text){text=document.createElement('p');text.dataset.mcpCsp='true';warning.append(text);}text.textContent=message;
  });
  window.addEventListener('message',event=>{
    if(event.source!==window.parent)return;const m=event.data;if(!m||m.jsonrpc!=='2.0')return;
    if(!connected){if(m.id!==id)return;if(m.error||m.result?.protocolVersion!=='2026-01-26'){clearTimeout(timer);status.textContent='MCP-Initialisierung nicht unterstützt';return;}connected=true;hostOrigin=event.origin;clearTimeout(timer);send({jsonrpc:'2.0',method:'ui/notifications/initialized'});status.textContent='MCP-Host verbunden · wartet auf Unternehmensdaten';send({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height:900}});return;}
    if(event.origin!==hostOrigin)return;
    if(m.method==='ui/notifications/tool-input'){input=m.params?.arguments;hasResult=false;if(Array.isArray(input?.records))accept(input);}
    if(m.method==='ui/notifications/tool-result'){
      if(m.params?.isError){document.dispatchEvent(new CustomEvent('georadar:tool-result',{detail:m.params}));return;}
      const payload=resultPayload(m.params);if(payload){hasResult=accept(payload);}else if(!hasResult&&Array.isArray(input?.records)){hasResult=accept(input);}else if(!hasResult){status.textContent='MCP-Ergebnis ohne Unternehmensdaten · vollständige Werkzeugargumente erforderlich';}
    }
    // Partial streamed arguments are deliberately ignored; never replace data with partial JSON.
    if(m.method==='ui/notifications/tool-cancelled')status.textContent='MCP-Aufruf abgebrochen · aktuelle Ansicht bleibt erhalten';
    if((m.method==='ping'||m.method==='ui/resource-teardown')&&m.id!==undefined)send({jsonrpc:'2.0',id:m.id,result:{}});
  });
  status.textContent='MCP-Host wird verbunden …';send({jsonrpc:'2.0',id,method:'ui/initialize',params:{protocolVersion:'2026-01-26',appInfo:{name:'mangold-georadar',version:'2.1.0'},appCapabilities:{}}});
})();
