'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const playwright=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const XLSX=require('../dist/xlsx.mini.min.js'),{createPreviewServer}=require('../serve.cjs'),R=require('../dist/representatives.js');
const locations=[[9.99,53.55],[13.405,52.52],[16.373,48.208],[11.404,47.269],[9.18,48.78],[7.0,50.0]];
const records=R.definitions.map((d,i)=>({id:d.code,name:'Fiktiv '+d.code,country:i===2||i===3?'AT':'DE',lon:locations[i][0],lat:locations[i][1],salesRep:d.code+' '+d.personnelNumber,personnelNumber:d.personnelNumber,postalCode:i===2?'1010':i===3?'6020':'88046',status:['existing','prospect','priority','unknown','priority'][i],isFictional:true}));
records.push({id:'NONE',name:'Fiktiv ohne Vertreter',country:'DE',lon:7,lat:50,postalCode:'01067',status:'prospect',product:'Pumpen',isFictional:true});
async function main(){
 const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[],errors=[];
 try{
  browser=await playwright.chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1550,height:1050}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>document.addEventListener('georadar:map-ready',e=>window.__gkmap=e.detail));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.__gkmap?.isStyleLoaded());
  assert.deepEqual(await page.locator('#territory-filter').evaluate(e=>Array.from(e.selectedOptions,o=>o.value)),['all']);
  assert.equal(await page.locator('#territory-filter').getAttribute('multiple'),'');assert.match(await page.locator('#representative-legend').innerText(),/GK 10/);
  await page.evaluate(records=>document.dispatchEvent(new CustomEvent('georadar:tool-result',{detail:{structuredContent:{records}}})),records);
  async function expectIds(ids){
    await page.waitForFunction(ids=>{const a=GeoRadarCompanies.getFilteredRecords().map(r=>r.id).sort();return JSON.stringify(a)===JSON.stringify([...ids].sort());},ids);
    await page.waitForFunction(ids=>JSON.stringify([...new Set(window.__gkmap.queryRenderedFeatures({layers:['company-points']}).map(f=>f.properties.id))].sort())===JSON.stringify([...ids].sort()),ids,{timeout:15000});
    assert.equal(await page.locator('#company-list button').count(),ids.length);assert.equal(await page.locator('#company-total').innerText(),String(ids.length));assert.match(await page.locator('#footer-data-count').innerText(),new RegExp('^'+ids.length+' / '));
  }
  await expectIds(records.map(r=>r.id));checks.push('default all representatives, six records and five legend entries');
  await page.evaluate(()=>GeoRadarTerritories.setConfiguration(GeoRadarTerritories.getConfiguration().filter(t=>t.code!=='GK')));assert.equal(await page.locator('#person-GK').inputValue(),'10');assert.equal(await page.evaluate(()=>GeoRadarTerritories.getConfiguration().length),5);checks.push('legacy four-representative configuration retains GK 10 default without changing existing records');
  for(const d of R.definitions){await page.selectOption('#territory-filter',d.code);await expectIds([d.code]);}
  const ring=await page.evaluate(()=>({paint:__gkmap.getPaintProperty('territory-site-ring','circle-stroke-color'),points:__gkmap.queryRenderedFeatures({layers:['territory-site-ring']}).map(f=>f.properties.repCode),fill:__gkmap.getPaintProperty('company-points','circle-color')}));
  assert(ring.points.includes('GK'));assert(ring.paint.includes('#EAB308'));assert(ring.fill.includes('#2387ec')&&ring.fill.includes('#ffffff')&&ring.fill.includes('#e0444e')&&ring.fill.includes('#788592'));checks.push('each old representative and GK individually filter markers, list and counts; yellow ring with original status fills');
  await page.selectOption('#territory-filter',['CO','GK']);await expectIds(['CO','GK']);await page.selectOption('#company-status','priority');await expectIds(['GK']);await page.selectOption('#company-status','all');
  await page.selectOption('#territory-filter',['GK','unassigned']);await expectIds(['GK','NONE']);assert.match(await page.locator('#company-list').innerText(),/Fachlicher Vorschlag: GK 10/);
  await page.fill('#postal-prefix','01');await expectIds(['NONE']);await page.fill('#postal-prefix','');
  await page.selectOption('#territory-filter','all');await page.selectOption('#country','at');await expectIds(['SH','GD']);await page.selectOption('#country','both');
  await page.selectOption('#territory-filter','GK');await page.locator('#territory-GK').uncheck();await page.waitForFunction(()=>!__gkmap.queryRenderedFeatures({layers:['territory-site-ring']}).length);await expectIds(['GK']);await page.locator('#territory-GK').check();
  checks.push('multi-select, unassigned, status/country/PLZ combinations, ring toggle without reassignment');
  const snapshot=await page.evaluate(()=>GeoRadarCompanies.getSnapshot().records);for(const original of records){const r=snapshot.find(r=>r.id===original.id);assert.equal(r.salesRep,original.salesRep);assert.equal(r.personnelNumber,original.personnelNumber);}
  await page.selectOption('#territory-filter','all');
  await page.locator('#company-import').click();await page.locator('#company-file').setInputFiles({name:'gk-dummy.csv',mimeType:'text/csv',buffer:Buffer.from('ID;Firma;Land;PLZ;Vertreter;Status;lon;lat\nCSV-GK;Fiktive CSV-Firma;DE;01067;GK 10;existing;13.7;51.05','utf8')});
  await page.waitForFunction(()=>document.getElementById('company-json').value.includes('CSV-GK'));await page.locator('#company-apply').click();await expectIds(['CSV-GK']);assert.equal((await page.evaluate(()=>GeoRadarCompanies.getSnapshot().records[0])).postalCode,'01067');
  const sheet=XLSX.utils.aoa_to_sheet([['ID','Firma','Land','PLZ','Vertreter','Status','lon','lat'],['XLSX-GK','Fiktive Excel-Firma','DE',1067,'GK 10','priority',13.7,51.05]]);sheet.D2.z='00000';const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheet,'Dummy');
  await page.locator('#company-import').click();await page.locator('#company-file').setInputFiles({name:'gk-dummy.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}))});
  await page.waitForFunction(()=>document.getElementById('company-json').value.includes('XLSX-GK'));await page.locator('#company-apply').click();await expectIds(['XLSX-GK']);assert.equal((await page.evaluate(()=>GeoRadarCompanies.getSnapshot().records[0])).postalCode,'01067');
  await page.selectOption('#territory-filter','GK');await expectIds(['XLSX-GK']);checks.push('real CSV and XLSX file upload with Vertreter GK 10 and formatted leading-zero PLZ');
  await page.locator('#company-import').click();await page.locator('#company-file').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('Firma;Land\nFehler;XX')});await page.waitForFunction(()=>document.getElementById('company-import-feedback').textContent.startsWith('Nicht eingelesen:'));assert.equal(await page.evaluate(()=>GeoRadarCompanies.getSnapshot().records[0].id),'XLSX-GK');await page.locator('#company-import-close').click();checks.push('invalid import preserves previous data');
  // Restore the mixed fixture for a reviewable screenshot.
  await page.selectOption('#territory-filter','all');await page.evaluate(records=>document.dispatchEvent(new CustomEvent('georadar:tool-result',{detail:{structuredContent:{records}}})),records);await expectIds(records.map(r=>r.id));
  await page.locator('#territory-filter').scrollIntoViewIfNeeded();fs.mkdirSync(path.join(__dirname,'../verification'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../verification/gk10-preview.png')});
  assert.equal(errors.length,0);const report={checks,errors,ring,test:'Isolated local preview with fictitious records, real MapLibre/OpenFreeMap, CSV and XLSX. No production or database writes.'};fs.writeFileSync(path.join(__dirname,'../verification/gk10-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
