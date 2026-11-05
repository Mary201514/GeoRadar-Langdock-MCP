(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./data-model.js'));else root.GeoRadarImport=factory(root.GeoRadarData);})(typeof globalThis!=='undefined'?globalThis:this,function(D){
 'use strict';
 const key=v=>String(v).trim().toLocaleLowerCase('de').replace(/[\s_\-]/g,'');
 const columns={id:'id',kundennummer:'customerNumber',customernumber:'customerNumber',name:'name',firma:'name',unternehmen:'name',firmenname:'name',country:'country',land:'country',status:'status',kundenstatus:'status',vertreter:'salesRep',salesrep:'salesRep',personalnummer:'personnelNumber',personnelnumber:'personnelNumber',plz:'postalCode',postleitzahl:'postalCode',postalcode:'postalCode',postalprefix:'postalPrefix',plzpräfix:'postalPrefix',ort:'city',city:'city',straße:'street',strasse:'street',street:'street',branche:'industry',industry:'industry',produkt:'product',produkte:'product',product:'product',lon:'lon',longitude:'lon',längengrad:'lon',lat:'lat',latitude:'lat',breitengrad:'lat',leadscore:'leadScore',umsatz:'revenue',revenue:'revenue',website:'website',isfictional:'isFictional',fiktiv:'isFictional',notes:'notes',notizen:'notes',locationaccuracy:'locationAccuracy'};
 function csv(text){
   text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0],delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':first.includes('\t')?'\t':',';
   const rows=[];let row=[],cell='',quoted=false;
   for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}else cell+=c;}
   if(quoted)throw Error('CSV enthält ein nicht geschlossenes Anführungszeichen.');row.push(cell);if(row.some(v=>v!==''))rows.push(row);return rows;
 }
 function fromRows(rows){
   if(rows.length<2)throw Error('Eine Kopfzeile und mindestens ein Unternehmen sind erforderlich.');if(rows.length>10001)throw Error('Maximal 10.000 Unternehmen.');
   const fields=rows[0].map(v=>columns[key(v)]||null);if(!fields.includes('name')||!fields.includes('country'))throw Error('Spalten Firma/Name und Land/country sind erforderlich.');
   if(fields.filter(Boolean).some((f,i,all)=>all.indexOf(f)!==i))throw Error('Mehrere Spalten sind demselben Feld zugeordnet.');
   const records=rows.slice(1).filter(row=>row.some(v=>String(v??'').trim())).map((row,i)=>{
     const r={};fields.forEach((field,j)=>{if(!field||row[j]===undefined||row[j]===null||row[j]==='')return;const v=String(row[j]).trim();
       if(['lon','lat','leadScore','revenue'].includes(field)){const n=Number(v.replace(',','.'));if(!Number.isFinite(n))throw Error('Zeile '+(i+2)+': ungültige Zahl in '+field);r[field]=n;}
       else if(field==='isFictional'){if(!/^(true|false|ja|nein|1|0)$/i.test(v))throw Error('Ungültige Dummy-Kennzeichnung.');r[field]=/^(true|ja|1)$/i.test(v);}else r[field]=v;
     });
     r.id=r.id||r.customerNumber||'IMPORT-'+(i+1);return r;
   });
   return D.validate({records});
 }
 async function read(file){
   if(file.size>5*1024*1024)throw Error('Maximal 5 MB pro Datei.');const extension=file.name.split('.').pop().toLowerCase();
   if(extension==='json')return D.validate(JSON.parse(await file.text()));
   if(['csv','tsv'].includes(extension))return fromRows(csv(await file.text()));
   if(extension==='xlsx'){
     if(!globalThis.XLSX)throw Error('Excel-Lesebibliothek ist nicht verfügbar.');
     const workbook=globalThis.XLSX.read(await file.arrayBuffer(),{type:'array',cellText:true,cellFormula:false,sheetRows:10002});
     const name=workbook.SheetNames[0];if(!name)throw Error('Excel-Datei enthält kein Tabellenblatt.');
     return fromRows(globalThis.XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,raw:false,defval:''}));
   }
   throw Error('Unterstützt werden JSON, UTF-8-CSV/TSV und Excel .xlsx.');
 }
 return {csv,fromRows,read};
});
