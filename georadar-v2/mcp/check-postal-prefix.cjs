'use strict';
const assert=require('node:assert/strict'),D=require('../dist/data-model.js');
const row=(country,postalCode,extra={})=>({id:'TEST-'+country,name:'Fiktive Präfix-Testfirma',country,postalCode,...extra});
for(const country of ['DE','AT']){
 const r=D.validate({records:[row(country,'10')]}).records[0],p=D.position(r);
 assert.equal(r.postalPrefix,'10');assert.equal(r.lon,undefined);assert.equal(r.locationAccuracy,'unknown');assert.equal(p.isPrefix,true);assert.equal(p.coordinates.length,2);assert.match(D.postalLabel(r),/PLZ-Präfix 10/);
 assert.deepEqual(D.validate({records:[r]}).records,[r]);
}
assert.equal(D.position(D.validate({records:[row('DE','88')]}).records[0]).isPrefix,true);
const explicit=D.validate({records:[{id:'TEST-EXPLICIT',name:'Fiktiv',country:'AT',postalPrefix:'68'}]}).records[0];assert.equal(D.position(explicit).isPrefix,true);
const exact=D.validate({records:[row('DE','88',{lon:9.5,lat:47.6,locationAccuracy:'exact'})]}).records[0];assert.equal(D.position(exact).isPrefix,false);assert.deepEqual(D.position(exact).coordinates,[9.5,47.6]);
assert.equal(D.position(D.validate({records:[row('DE','00')]}).records[0]),null);
for(const p of ['8','888','88A','8888'])assert.throws(()=>D.validate({records:[row('DE',p)]}));
assert.throws(()=>D.validate({records:[row('DE','88',{postalPrefix:'89'})]}));
assert.throws(()=>D.validate({records:[row('AT','1010',{postalPrefix:'68'})]}));
assert.throws(()=>D.validate({records:[row('DE',88)]}));
const summary=D.summarize([exact,explicit,{id:'NONE',status:'unknown'}]);assert.equal(summary.located,1);assert.equal(summary.prefixLocated,1);assert.equal(summary.unlocated,1);
const server=require('./server.cjs'),result=server.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'show_georadar_map',arguments:{records:[row('DE','88'),{...row('AT','10'),status:'priority'}]}}}).result;assert.equal(result.structuredContent.summary.prefixLocated,2);assert(result.content[0].text.includes('PLZ-Gebietspunkt'));
console.log('PASS: DE/AT two-digit and explicit prefixes, leading zeros/missing references, coordinate priority, round-trip, conflicting/invalid values, summary and MCP transfer.');
