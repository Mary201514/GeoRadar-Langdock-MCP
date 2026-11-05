(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GeoRadarRepresentatives=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const definitions=Object.freeze([
    {code:'CO',personnelNumber:'93',color:'#16A34A',geography:'Rechts der B30, Fahrtrichtung Friedrichshafen → Ulm; zusätzlich Vorarlberg.',boundaryConfirmed:false,specialties:['Industriekunden']},
    {code:'SR',personnelNumber:'42',color:'#F97316',geography:'Links der B30, Fahrtrichtung Friedrichshafen → Ulm.',boundaryConfirmed:false,specialties:['Industriekunden']},
    {code:'SH',personnelNumber:'11',color:'#7C3AED',geography:'Deutschland und Österreich.',specialties:['Antriebstechnik','Danfoss']},
    {code:'GD',personnelNumber:'2',color:'#0D9488',geography:'Alle PLZ-Gebiete.',allPostalAreas:true,specialties:['Flygt','Lowara','Jung','KSB','Grundfos']},
    {code:'GK',personnelNumber:'10',color:'#EAB308',geography:'Alle PLZ-Gebiete.',allPostalAreas:true,specialties:['Pumpen','Rührwerke','Kläranlagen','Kommunen','Bäderbetriebe']}
  ].map(d=>Object.freeze({...d,...(d.specialties?{specialties:Object.freeze(d.specialties)}:{})})));
  const codes=definitions.map(d=>d.code);
  function resolve(value){if(value===undefined||value===null)return null;const s=String(value).trim().toUpperCase().replace(/[·/–—_-]/g,' ').replace(/\s+/g,' ');return definitions.find(d=>s===d.code||s===d.personnelNumber||s===d.code+' '+d.personnelNumber)||null;}
  function assignment(record,configuration=[]){
    // Explicit source assignments take precedence, including unknown legacy values.
    if(String(record.salesRep??record.Vertreter??'').trim()){const d=resolve(record.salesRep??record.Vertreter);return d?[d.code]:[];}
    if(String(record.personnelNumber??'').trim())return definitions.filter(d=>String(record.personnelNumber).trim()===String(configuration.find(t=>t.code===d.code)?.personnelNumber||d.personnelNumber)).map(d=>d.code);
    const country=['DE','Deutschland'].includes(record.country)?'DE':'AT',postal=record.postalCode||record.postalPrefix||'';
    return configuration.filter(t=>t.rules?.some(rule=>rule.country===country&&rule.prefixes.some(prefix=>postal.startsWith(prefix)))).map(t=>t.code);
  }
  function suggestions(record,configuration=[]){
    if(!['prospect','priority'].includes(record.status)||assignment(record,configuration).length||String(record.salesRep??record.Vertreter??'').trim()||String(record.personnelNumber??'').trim())return [];
    const text=[record.industry,record.product,record.notes,record.reason,record.opportunity].filter(Boolean).join(' ').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const match=/\b(pump\w*|ruhrwerk\w*|ruehrwerk\w*|klaranlag\w*|klaeranlag\w*|kommun\w*|baderbetrieb\w*|baederbetrieb\w*)/u.exec(text);
    const result=[];
    function add(code,reason){const d=resolve(code);result.push({code,personnelNumber:d.personnelNumber,label:code+' '+d.personnelNumber,reason:'Fachlicher Vorschlag: '+reason+'. Keine automatische Zuordnung.'});}
    if(match)add('GK',match[0]+' · alle PLZ-Gebiete');
    if(/\b(antrieb\w*|danfoss)\b/u.test(text))add('SH','Antriebstechnik / Danfoss · Deutschland und Österreich');
    const brand=/\b(flygt|lowara|jung|ksb|grundfos)\b/u.exec(text);if(brand)add('GD','Pumpenmarke '+brand[0]+' · alle PLZ-Gebiete');
    // B30 boundaries are intentionally descriptive only. No coordinate or PLZ heuristic.
    return result;
  }
  function suggest(record,configuration=[]){return suggestions(record,configuration)[0]||null;}
  return {definitions,codes,resolve,assignment,suggest,suggestions};
});
