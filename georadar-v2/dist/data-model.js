(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./postal-prefixes.js'),require('./representatives.js'));else root.GeoRadarData=factory(root.GeoRadarPostalPrefixes,root.GeoRadarRepresentatives);})(typeof globalThis!=='undefined'?globalThis:this,function(P,R){
  'use strict';
  const statuses={existing:{label:'Bestandskunde',color:'#2387ec'},prospect:{label:'Potenzieller Neukunde',color:'#FFEA00'},priority:{label:'Besonders interessant',color:'#e0444e'},unknown:{label:'Status ungeklärt',color:'#788592'}};
  const aliases={Bestandskunde:'existing',Bestandskunden:'existing',Neukunde:'prospect',Neukunden:'prospect','Potenzieller Neukunde':'prospect','Besonders interessant':'priority','Status ungeklärt':'unknown'};
  const optional=['type','address','formattedAddress','geocodeNote','customerNumber','street','postalCode','postalPrefix','city','state','district','industry','product','potential','contact','notes','relationships','coordinateSource','personnelNumber','salesRep','reason','opportunity'];
  function webUrl(value){if(typeof value!=='string'||value.length>2000)throw Error('Quellen-/Website-URL muss Text mit höchstens 2.000 Zeichen sein.');let u;try{u=new URL(value);}catch{}if(!u||!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Nur http/https-URLs ohne eingebettete Zugangsdaten sind erlaubt.');return u.href;}
  function position(r){
    if(Number.isFinite(r.lon)&&Number.isFinite(r.lat))return {coordinates:[r.lon,r.lat],isPrefix:false};
    const prefix=r.postalPrefix||(/^\d{2}$/.test(r.postalCode||'')?r.postalCode:undefined);
    const ref=P?.countries?.[r.country==='Deutschland'||r.country==='DE'?'DE':'AT']?.[prefix];
    return ref?{coordinates:ref.coordinates.slice(),isPrefix:true,prefix}:null;
  }
  function attributes(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('attributes muss ein Objekt mit Merkmal: Wert sein.');
    const keys=Object.keys(value);if(keys.length>30)throw Error('Höchstens 30 Zusatzmerkmale je Punkt.');
    const out={};for(const key of keys){const k=key.trim();if(!k||k.length>60||/[\u0000-\u001f]/.test(k))throw Error('Merkmalname 1–60 Zeichen: '+key.slice(0,60));const v=value[key];if(v===null||v===undefined||v==='')continue;
      if(typeof v==='string'){if(v.length>500)throw Error('Merkmal '+k+' ist zu lang (max. 500 Zeichen).');out[k]=v.trim();}
      else if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Merkmal '+k+' ist keine gültige Zahl.');out[k]=v;}
      else if(typeof v==='boolean')out[k]=v;
      else throw Error('Merkmal '+k+' muss Text, Zahl oder true/false sein.');}
    return out;
  }
  function postalLabel(r){return r.postalPrefix&&(!r.postalCode||r.postalCode.length===2)?'PLZ-Präfix '+r.postalPrefix+'…':r.postalCode||'';}
  function validateTerritories(value){
    if(!Array.isArray(value)||value.length>R.codes.length)throw Error('territories muss eine Liste mit höchstens CO, SR, SH, GD und GK sein.');
    const codes=new Set();return value.map(t=>{if(!t||!R.codes.includes(t.code)||codes.has(t.code))throw Error('Gebietskürzel muss eindeutig CO, SR, SH, GD oder GK sein.');codes.add(t.code);if(typeof t.personnelNumber!=='string'||t.personnelNumber.length>100)throw Error('Personalnummer muss Text sein (auch leer erlaubt).');if(!Array.isArray(t.rules)||t.rules.length>2)throw Error('Gebietsregeln fehlen.');const countries=new Set();return {code:t.code,personnelNumber:t.personnelNumber.trim(),rules:t.rules.map(r=>{if(!r||!['DE','AT'].includes(r.country)||countries.has(r.country)||!Array.isArray(r.prefixes)||r.prefixes.length>200)throw Error('Gebietsregel benötigt ein eindeutiges Land und höchstens 200 PLZ-Präfixe.');countries.add(r.country);if(r.prefixes.some(p=>typeof p!=='string'||!(r.country==='DE'?/^\d{1,5}$/:/^\d{1,4}$/).test(p)))throw Error('Ungültiges PLZ-Präfix in '+t.code);return {country:r.country,prefixes:[...new Set(r.prefixes)]};})};});
  }
  function validate(payload){
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Array.isArray(payload.records))throw Error('Ein JSON-Objekt mit records als Liste ist erforderlich.');
    if(payload.schema&&payload.schema!=='mangold-georadar/companies/v1')throw Error('Unbekannte Schema-Version. Erwartet: mangold-georadar/companies/v1.');
    if(payload.records.length>10000)throw Error('Maximal 10.000 Unternehmen pro Übergabe.');
    const errors=[],warnings=[],ids=new Set(),records=[];
    for(let index=0;index<payload.records.length;index++){
      const raw=payload.records[index],prefix='Zeile '+(index+1)+': ';
      try{
        if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Datensatz muss ein Objekt sein.');
        const r={};
        for(const field of ['id','name']){if(typeof raw[field]!=='string'||!raw[field].trim()||raw[field].length>300)throw Error(field+' fehlt oder ist zu lang.');r[field]=raw[field].trim();}
        if(ids.has(r.id))throw Error('Doppelte ID: '+r.id);ids.add(r.id);
        const country=raw.country;
        const countries={DE:'Deutschland',AT:'Österreich',Deutschland:'Deutschland','Österreich':'Österreich'};
        r.country=typeof country==='string'&&Object.hasOwn(countries,country)?countries[country]:undefined;
        if(!r.country)throw Error('country muss DE, AT, Deutschland oder Österreich sein.');
        const status=raw.status??raw.category??'unknown';r.status=aliases[status]||status;
        if(!Object.hasOwn(statuses,r.status))throw Error('Unbekannter Kundenstatus.');
        for(const field of optional){if(raw[field]===undefined||raw[field]===null)continue;if(typeof raw[field]!=='string'||raw[field].length>4000)throw Error(field+' muss Text mit höchstens 4.000 Zeichen sein.');r[field]=raw[field].trim();}
        if(raw.website!==undefined&&raw.website!=='')r.website=webUrl(raw.website);
        if(raw.attributes!==undefined&&raw.attributes!==null)r.attributes=attributes(raw.attributes);
        for(const field of ['isFictional','needsReview'])if(raw[field]!==undefined){if(typeof raw[field]!=='boolean')throw Error(field+' muss true oder false sein.');r[field]=raw[field];}
        if(raw.sources!==undefined){if(!Array.isArray(raw.sources)||raw.sources.length>20)throw Error('sources muss eine Liste mit höchstens 20 Quellen sein.');r.sources=raw.sources.map(s=>{if(!s||typeof s!=='object'||Array.isArray(s))throw Error('Quelle benötigt url und optional title.');const source={url:webUrl(s.url)};if(s.title!==undefined){if(typeof s.title!=='string'||s.title.length>300)throw Error('Quellentitel ist zu lang.');source.title=s.title.trim();}return source;});}
        if(r.postalCode&&!((r.country==='Deutschland'?/^(?:\d{2}|\d{5})$/:/^(?:\d{2}|\d{4})$/).test(r.postalCode)))throw Error('PLZ muss vollständig oder als zweistelliges Präfix als Text übergeben werden.');
        if(r.postalCode?.length===2){if(r.postalPrefix&&r.postalPrefix!==r.postalCode)throw Error('PLZ und PLZ-Präfix widersprechen sich.');r.postalPrefix=r.postalCode;}
        if(r.postalPrefix&&!/^\d{2}$/.test(r.postalPrefix))throw Error('postalPrefix muss aus genau zwei Ziffern bestehen.');
        if(r.postalCode&&r.postalPrefix&&!r.postalCode.startsWith(r.postalPrefix))throw Error('PLZ und PLZ-Präfix widersprechen sich.');
        for(const field of ['leadScore','revenue'])if(raw[field]!==undefined&&raw[field]!==null){if(typeof raw[field]!=='number'||!Number.isFinite(raw[field])||raw[field]<0||(field==='leadScore'&&raw[field]>100))throw Error(field+' ist ungültig.');r[field]=raw[field];}
        const hasLon=raw.lon!==undefined&&raw.lon!==null,hasLat=raw.lat!==undefined&&raw.lat!==null;
        if(hasLon!==hasLat)throw Error('lon und lat müssen gemeinsam vorliegen oder beide fehlen.');
        if(hasLon){if(typeof raw.lon!=='number'||typeof raw.lat!=='number'||!Number.isFinite(raw.lon)||!Number.isFinite(raw.lat)||raw.lon<5||raw.lon>18||raw.lat<46||raw.lat>56)throw Error('Koordinaten liegen außerhalb des unterstützten DE/AT-Kartenausschnitts oder sind ungültig.');r.lon=raw.lon;r.lat=raw.lat;}
        r.locationAccuracy=raw.locationAccuracy??'unknown';
        if(!['exact','approximate','unknown'].includes(r.locationAccuracy))throw Error('locationAccuracy muss exact, approximate oder unknown sein.');
        if(!hasLon){r.locationAccuracy='unknown';warnings.push(prefix+(position(r)?.isPrefix?'Nur PLZ-Präfix '+r.postalPrefix+'…: schematischer Gebietspunkt nach GeoNames, kein Firmenstandort.':'Keine Koordinaten oder verfügbare Präfixreferenz: Unternehmen bleibt in der Liste, ohne Kartenmarker.'));}
        else if(r.locationAccuracy!=='exact')warnings.push(prefix+'Ungefähre oder ungeprüfte Position.');
        records.push(r);
      }catch(e){errors.push(prefix+e.message);}
    }
    if(errors.length){const e=Error(errors.slice(0,20).join('\n')+(errors.length>20?'\nWeitere Fehler: '+(errors.length-20):''));e.validationErrors=errors;throw e;}
    const result={schema:'mangold-georadar/companies/v1',records,warnings};if(payload.territories!==undefined)result.territories=validateTerritories(payload.territories);return result;
  }
  function summarize(records){const counts={existing:0,prospect:0,priority:0,unknown:0};let located=0,prefixLocated=0;for(const r of records){counts[r.status]++;if(Number.isFinite(r.lon)&&Number.isFinite(r.lat))located++;else if(position(r)?.isPrefix)prefixLocated++;}return {...counts,total:records.length,located,prefixLocated,unlocated:records.length-located-prefixLocated};}
  return {statuses,validate,summarize,validateTerritories,position,postalLabel};
});
