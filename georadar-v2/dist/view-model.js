(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./data-model.js'),require('./analysis-model.js'));else root.GeoRadarViewModel=factory(root.GeoRadarData,root.GeoRadarAnalysisModel);})(typeof globalThis!=='undefined'?globalThis:this,function(D,A){
 'use strict';
 const filterDefaults={country:'both',status:'all',search:'',postal:'',representatives:['all']};
 const layers=['countries','states','districts','places','roads','water','company-layer','office-layer','postal-labels','postal-polygons','territory-CO','territory-SR','territory-SH','territory-GK','territory-GD'];
 function validate(input){
  if(!input||input.schema!=='mangold-georadar/saved-view/v1')throw Error('Unbekanntes Ansichtsformat.');
  const view=input.view;if(!view||!Array.isArray(view.center)||view.center.length!==2||!view.center.every(Number.isFinite)||view.center[0]<-180||view.center[0]>180||view.center[1]<-85||view.center[1]>85)throw Error('Ungültiger Kartenausschnitt.');
  for(const [field,min,max] of [['zoom',0,22],['bearing',-360,360],['pitch',0,85]])if(!Number.isFinite(view[field])||view[field]<min||view[field]>max)throw Error('Ungültiger Kartenwert: '+field);
  const f={...filterDefaults,...input.filters};if(!['both','de','at'].includes(f.country)||!['all',...Object.keys(D.statuses)].includes(f.status)||!Array.isArray(f.representatives)||!f.representatives.length||f.representatives.some(c=>!['all','unassigned','CO','SR','SH','GK','GD'].includes(c)))throw Error('Ungültige Filter.');
  for(const k of ['search','postal'])if(typeof f[k]!=='string'||f[k].length>1500)throw Error('Ungültiger Suchfilter.');
  const selected=input.analyses||[];if(!Array.isArray(selected)||selected.some(id=>!A.types.some(t=>t.id===id&&t.available)))throw Error('Nicht verfügbare Auswertung.');
  const visible={};for(const k of layers)if(input.layers?.[k]!==undefined){if(typeof input.layers[k]!=='boolean')throw Error('Ungültige Ebene.');visible[k]=input.layers[k];}
  const result={schema:input.schema,view:{center:[...view.center],zoom:view.zoom,bearing:view.bearing,pitch:view.pitch},filters:{country:f.country,status:f.status,search:f.search,postal:f.postal,representatives:[...new Set(f.representatives)]},layers:visible,analyses:[...new Set(selected)],analysisActive:input.analysisActive===true};
  if(input.territories!==undefined)result.territories=D.validateTerritories(input.territories);
  if(input.source?.savedViewId){if(typeof input.source.savedViewId!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.source.savedViewId))throw Error('Ungültige private Quellenkennung.');result.source={savedViewId:input.source.savedViewId};}
  else if(input.source?.code){if(!/^[A-Z][A-Z0-9-]{2,31}$/.test(input.source.code))throw Error('Ungültige Recherchekennung.');result.source={code:input.source.code};}
  if(result.source&&input.source.createdAt&&Number.isFinite(Date.parse(input.source.createdAt)))result.source.createdAt=input.source.createdAt;
  return result;
 }
 function normalizeSave(input){
  if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>160||!['view','research'].includes(input.kind))throw Error('Name (1–160 Zeichen) und Speicherart sind erforderlich.');
  const result={name:input.name.trim(),kind:input.kind,view:validate(input.view)};
  if(input.kind==='research'){if(!input.dataset)throw Error('Rechercheergebnisse fehlen.');const d=D.validate(input.dataset);result.dataset={schema:d.schema,records:d.records,...(d.territories?{territories:d.territories}:{})};}
  if(JSON.stringify(result).length>1900000)throw Error('Gespeicherte Auswertung ist zu groß.');return result;
 }
 return {validate,normalizeSave,layers};
});
