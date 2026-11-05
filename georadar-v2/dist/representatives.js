(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GeoRadarRepresentatives=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const definitions=Object.freeze([
    {code:'CO',personnelNumber:'93',color:'#16A34A'},
    {code:'SR',personnelNumber:'42',color:'#F97316'},
    {code:'SH',personnelNumber:'11',color:'#7C3AED'},
    {code:'GD',personnelNumber:'2',color:'#0D9488'},
    {code:'GK',personnelNumber:'10',color:'#EAB308',allPostalAreas:true,specialties:['Pumpen','Rührwerke','Kläranlagen','Kommunen','Bäderbetriebe']}
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
  function suggest(record,configuration=[]){
    if(!['prospect','priority'].includes(record.status)||assignment(record,configuration).length||String(record.salesRep??record.Vertreter??'').trim()||String(record.personnelNumber??'').trim())return null;
    const text=[record.industry,record.product,record.notes,record.reason,record.opportunity].filter(Boolean).join(' ').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const match=/\b(pump\w*|ruhrwerk\w*|ruehrwerk\w*|klaranlag\w*|klaeranlag\w*|kommun\w*|baderbetrieb\w*|baederbetrieb\w*)/u.exec(text);
    return match?{code:'GK',personnelNumber:'10',label:'GK 10',reason:'Fachlicher Vorschlag: '+match[0]+' · alle PLZ-Gebiete. Keine automatische Zuordnung.'}:null;
  }
  return {definitions,codes,resolve,assignment,suggest};
});
