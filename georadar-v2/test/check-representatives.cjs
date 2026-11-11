'use strict';
const assert=require('node:assert/strict'),R=require('../dist/representatives.js'),D=require('../dist/data-model.js'),I=require('../dist/company-import.js'),{handle}=require('../mcp/server.cjs');
const configs=R.definitions.map(d=>({code:d.code,personnelNumber:d.personnelNumber,rules:[]}));
assert.equal(D.statuses.prospect.color,'#FFEA00');
const colors=['#16A34A','#F97316','#7C3AED','#0D9488','#EAB308'];
assert.deepEqual(R.definitions.map(d=>d.color),colors);assert.equal(D.validateTerritories(configs).length,5);
for(const d of R.definitions)for(const value of [d.code,d.personnelNumber,d.code+' '+d.personnelNumber,d.code+' · '+d.personnelNumber,d.code.toLowerCase()+' '+d.personnelNumber])assert.equal(R.resolve(value)?.code,d.code);
const payload=I.fromRows(I.csv('ID;Firma;Land;PLZ;Vertreter;Status\r\n1;"Fiktiv; Pumpe";DE;01067;GK 10;prospect\r\n2;Fiktiv AT;AT;0100;CO 93;existing'));
assert.equal(payload.records[0].postalCode,'01067');assert.equal(payload.records[1].postalCode,'0100');assert.deepEqual(payload.records.map(r=>R.assignment(r,configs)[0]),['GK','CO']);assert.equal(payload.records[0].salesRep,'GK 10');
for(const d of R.definitions){const r={salesRep:d.code+' '+d.personnelNumber,personnelNumber:d.personnelNumber};assert.deepEqual(R.assignment(r,configs),[d.code]);}
assert.deepEqual(R.assignment({salesRep:'CO 93',personnelNumber:'10'},configs),['CO']);assert.deepEqual(R.assignment({salesRep:'Alte externe Zuordnung',personnelNumber:'10'},configs),[]);
assert.deepEqual(R.assignment({country:'Deutschland',postalCode:'88046'},configs),[]);assert.deepEqual(R.assignment({country:'Österreich',postalCode:'6850'},configs),[]);
const territories=configs.map(t=>t.code==='CO'?{...t,rules:[{country:'DE',prefixes:['88']}]}:t);
assert.deepEqual(R.assignment({country:'Deutschland',postalCode:'88046'},territories),['CO']);assert.deepEqual(R.assignment({salesRep:'SR 42',country:'Deutschland',postalCode:'88046'},territories),['SR']);
for(const product of ['Pumpen','Rührwerke','Kläranlagen','Kommunen','Bäderbetriebe','Ruehrwerke']){
 const r={status:'prospect',country:'Deutschland',product};const before=JSON.stringify(r);assert.equal(R.suggest(r)?.code,'GK');assert.equal(JSON.stringify(r),before);
 assert.equal(R.suggest({...r,salesRep:'CO 93'}),null);assert.equal(R.suggest({...r,personnelNumber:'42'}),null);assert.equal(R.suggest({...r,status:'existing'}),null);
}
assert.equal(R.suggest({status:'prospect',product:'Pumpen',country:'Deutschland',postalCode:'88046'},territories),null);
assert.equal(R.suggest({status:'prospect',product:'Elektromotoren'}),null);assert.equal(R.suggest({status:'unknown',product:'Pumpen'}),null);
assert.throws(()=>I.fromRows([['Firma','Land','Vertreter','salesRep'],['Fiktiv','DE','GK','CO']]));assert.throws(()=>I.csv('Firma;Land\n"offen;DE'));
const schema=handle({jsonrpc:'2.0',id:1,method:'tools/list'}).result.tools;assert.equal(schema.length,7);assert.equal(schema[0].inputSchema.properties.territories.maxItems,5);assert(schema[0].inputSchema.properties.territories.items.properties.code.enum.includes('GK'));
console.log('PASS: five representatives, all colors and aliases, CSV/PLZ strings, assignment precedence/no redistribution, all GK specialties, suggestions without mutation, legacy territories and additive MCP schema.');
