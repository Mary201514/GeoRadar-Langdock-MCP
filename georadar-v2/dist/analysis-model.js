(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./representatives.js'),require('./data-model.js'));else root.GeoRadarAnalysisModel=factory(root.GeoRadarRepresentatives,root.GeoRadarData);})(typeof globalThis!=='undefined'?globalThis:this,function(R,D){
 'use strict';
 const types=Object.freeze([
  {id:'distribution',label:'Kunden- und Leadverteilung',available:true},
  {id:'white-spots',label:'White-Spot-Analyse',available:false,reason:'Vollständige Marktgrundlage und bestätigte Gebietsgrenzen fehlen.'},
  {id:'representatives',label:'Vertriebsgebiets- und Vertreteranalyse',available:true},
  {id:'industries',label:'Branchen- und Standortanalyse',available:true},
  {id:'potential',label:'Regionale Potenzialanalyse',available:false,reason:'Belastbare Markt- und Potenzialdaten fehlen.'},
  {id:'coverage',label:'Kundenabdeckung und Marktlücken',available:false,reason:'Gesamtmarkt und Zielabdeckung sind nicht definiert.'}
 ]);
 function aggregate(records,ids,configuration=[]){
   if(!Array.isArray(ids)||ids.some(id=>!types.some(t=>t.id===id&&t.available)))throw Error('Auswertung ist nicht implementiert.');
   const result={total:records.length,generatedAt:new Date().toISOString(),analyses:[...new Set(ids)],status:D.summarize(records)};
   const counts=field=>Object.entries(records.reduce((all,r)=>{const key=String(r[field]||'Nicht angegeben');all[key]=(all[key]||0)+1;return all;},Object.create(null))).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de'));
   if(ids.includes('distribution'))result.distribution={countries:counts('country'),status:Object.entries(D.statuses).map(([k,v])=>[v.label,result.status[k]])};
   if(ids.includes('representatives')){const count=Object.fromEntries(R.codes.map(c=>[c,0]));let unassigned=0;for(const r of records){const codes=R.assignment(r,configuration);if(!codes.length)unassigned++;for(const c of codes)count[c]++;}result.representatives={counts:R.definitions.map(d=>[d.code+' '+d.personnelNumber,count[d.code]]),unassigned,note:'Bestehende Zuordnungen; überlappende Gebietsregeln können mehrfach zählen. SR-/CO-PLZ-Grenzen sind noch offen.'};}
   if(ids.includes('industries'))result.industries={industries:counts('industry'),locations:counts('city'),withCoordinates:result.status.located,prefixOnly:result.status.prefixLocated,withoutPosition:result.status.unlocated};
   return result;
 }
 const exportColumns=['id','name','country','street','postalCode','postalPrefix','city','industry','product','status','salesRep','personnelNumber','leadScore','revenue','lon','lat','locationAccuracy','website','isFictional','needsReview'];
 function cell(value){let s=value===undefined||value===null?'':String(value);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function csv(records){return '\uFEFF'+[exportColumns,...records.map(r=>exportColumns.map(k=>r[k]))].map(row=>row.map(cell).join(';')).join('\r\n');}
 function summary(result){let lines=['Mangold GeoRadar · Auswertung',new Date(result.generatedAt).toLocaleString('de-DE'),result.total+' Unternehmen im aktuellen Filter','Datengrundlage: ausschließlich geladene Datensätze; keine Hochrechnung auf den Gesamtmarkt.'];
   function add(title,rows){lines.push('',title,...rows.map(([k,v])=>k+': '+v));}
   if(result.distribution){add('Kundenstatus',result.distribution.status);add('Länder',result.distribution.countries);}
   if(result.representatives){add('Vertreter',[...result.representatives.counts,['Nicht zugeordnet',result.representatives.unassigned]]);lines.push(result.representatives.note);}
   if(result.industries){add('Branchen',result.industries.industries);add('Orte',result.industries.locations);lines.push('Mit Koordinaten: '+result.industries.withCoordinates,'Nur PLZ-Präfix: '+result.industries.prefixOnly,'Ohne Kartenposition: '+result.industries.withoutPosition);}
   return lines.join('\n');
 }
 return {types,aggregate,csv,summary,exportColumns};
});
