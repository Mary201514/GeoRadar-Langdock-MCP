const http=require('node:http');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const URI='ui://georadar/map-v1.html';
const html=fs.readFileSync(path.join(__dirname,'map.html'),'utf8');
const regions=JSON.parse(fs.readFileSync(path.join(__dirname,'regions.json'),'utf8'));
const token=process.env.GEORADAR_TOKEN;
const host=process.env.HOST||'127.0.0.1';
if(host!=='127.0.0.1'&&host!=='localhost'&&(!token||token.length<32))throw Error('Für externe Erreichbarkeit GEORADAR_TOKEN mit mindestens 32 Zeichen setzen.');
const recordSchema={type:'object',additionalProperties:false,required:['id','name','category','country','state','city','lon','lat'],properties:{id:{type:'string',minLength:1,maxLength:300},name:{type:'string',minLength:1,maxLength:300},category:{enum:['Bestandskunde','Neukunde']},country:{enum:['Deutschland','Österreich']},state:{type:'string'},city:{type:'string'},lon:{type:'number',minimum:5,maximum:18},lat:{type:'number',minimum:46,maximum:56}}};
const tool={name:'show_georadar_map',title:'GeoRadar-Karte anzeigen',description:'Zeigt Deutschland und Österreich mit Bestandskunden, potenziellen Neukunden und White-Spot-Kandidaten. Übergebe die aktuellen LeadRadar-Ergebnisse UND alle für die betrachteten Bundesländer bekannten Bestandskunden. category Neukunde bedeutet potenzieller Neukunde. Verwende belegte Ortskoordinaten; erfinde keine Kunden oder Koordinaten. Leere Regionen sind keine bestätigten White-Spots. Ohne vollständigen Kundenbestand sind White-Spots nur Kandidaten.',inputSchema:{type:'object',additionalProperties:false,required:['records'],properties:{records:{type:'array',maxItems:2000,items:recordSchema}}},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:{ui:{resourceUri:URI}}};
function validate(args){if(!args||!Array.isArray(args.records)||args.records.length>2000)throw Error('records muss ein Array mit maximal 2.000 Einträgen sein.');const ids=new Set();return args.records.map((r,i)=>{if(!r||typeof r!=='object')throw Error('Ungültiger Eintrag '+(i+1));for(const k of ['id','name','category','country','state','city'])if(typeof r[k]!=='string'||!r[k].trim()||r[k].length>300)throw Error('Pflichtfeld '+k+' in Eintrag '+(i+1)+' ungültig.');if(ids.has(r.id))throw Error('Doppelte ID '+r.id);ids.add(r.id);if(!['Bestandskunde','Neukunde'].includes(r.category)||!regions.some(f=>f.country===r.country&&f.state===r.state))throw Error('Ungültige Kategorie oder Region: '+r.id);if(!Number.isFinite(r.lon)||!Number.isFinite(r.lat)||r.lon<5||r.lon>18||r.lat<46||r.lat>56)throw Error('Ungültige Koordinaten: '+r.id);return Object.fromEntries(Object.keys(recordSchema.properties).map(k=>[k,r[k]]));});}
function handle(m){
 if(!m||m.jsonrpc!=='2.0'||typeof m.method!=='string')throw Error('Ungültige JSON-RPC-Anfrage');
 const response=result=>({jsonrpc:'2.0',id:m.id,result});
 if(m.id===undefined)return null;
 switch(m.method){
 case 'initialize':return response({protocolVersion:['2025-11-25','2025-06-18','2025-03-26'].includes(m.params?.protocolVersion)?m.params.protocolVersion:'2025-03-26',capabilities:{tools:{},resources:{}},serverInfo:{name:'georadar-langdock',version:'1.0.0'}});
 case 'ping':return response({});
 case 'tools/list':return response({tools:[tool]});
 case 'resources/list':return response({resources:[{uri:URI,name:'GeoRadar Deutschland Österreich',mimeType:'text/html;profile=mcp-app'}]});
 case 'resources/templates/list':return response({resourceTemplates:[]});
 case 'resources/read':if(m.params?.uri!==URI)throw Error('Unbekannte Ressource');return response({contents:[{uri:URI,mimeType:'text/html;profile=mcp-app',text:html,_meta:{ui:{csp:{connectDomains:[],resourceDomains:[]}}}}]});
 case 'tools/call':{
  if(m.params?.name!==tool.name)throw Error('Unbekanntes Werkzeug');
  try{const records=validate(m.params.arguments);const existing=records.filter(r=>r.category==='Bestandskunde').length;const whites=regions.filter(f=>{const rows=records.filter(r=>r.country===f.country&&r.state===f.state);return rows.some(r=>r.category==='Neukunde')&&!rows.some(r=>r.category==='Bestandskunde');}).map(f=>f.state);return response({content:[{type:'text',text:`GeoRadar: ${existing} Bestandskunden, ${records.length-existing} potenzielle Neukunden. White-Spot-Kandidaten: ${whites.join(', ')||'keine'}. Diese Bewertung gilt nur für die übergebenen Daten.`}],structuredContent:{records},_meta:{ui:{resourceUri:URI}}});}
  catch(e){return response({isError:true,content:[{type:'text',text:e.message}]});}
 }
 default:return {jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'Methode nicht unterstützt'}};
 }
}
const server=http.createServer(async(req,res)=>{
 const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(value===undefined?'':JSON.stringify(value));};
 if(req.url==='/health'){send(200,{ok:true});return;}
 if(req.url!=='/mcp'){send(404,{error:'Nicht gefunden'});return;}
 if(token){const got=Buffer.from(req.headers.authorization||''),wanted=Buffer.from('Bearer '+token);if(got.length!==wanted.length||!crypto.timingSafeEqual(got,wanted)){send(401,{error:'Unauthorized'});return;}}
 if(req.method!=='POST'){res.setHeader('Allow','POST');send(405,{error:'JSON-RPC über POST verwenden'});return;}
 const origin=req.headers.origin;if(origin&&origin!==process.env.ALLOWED_ORIGIN){send(403,{error:'Origin nicht erlaubt'});return;}
 let raw='';try{for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1500000){send(413,{error:'Anfrage zu groß'});return;}}let message;try{message=JSON.parse(raw);}catch{send(400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Ungültiges JSON'}});return;}if(Array.isArray(message)){send(400,{error:'Keine Batch-Anfragen'});return;}const out=handle(message);send(out?200:202,out||undefined);}catch(e){send(400,{jsonrpc:'2.0',id:null,error:{code:-32600,message:e.message}});}
});
if(require.main===module)server.listen(Number(process.env.PORT||8787),host,()=>console.log('GeoRadar MCP gestartet. Keine Kundendaten werden serverseitig gespeichert.'));
module.exports={server,handle,validate};
