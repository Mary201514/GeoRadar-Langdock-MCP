'use strict';
const http=require('node:http'),crypto=require('node:crypto');
const D=require('../dist/data-model.js'),{bundle}=require('./bundle.cjs');
const {createStore,ResearchError}=require('../backend/research-store.cjs'),defaultStore=createStore();
const URI='ui://georadar/map-v4.html',MIME='text/html;profile=mcp-app';
const html=bundle();
const uiMeta={ui:{prefersBorder:true,csp:{connectDomains:['https://tiles.openfreemap.org','blob:'],resourceDomains:['https://tiles.openfreemap.org','blob:','data:']}}};
const fields={id:{type:'string',minLength:1,maxLength:300},name:{type:'string',minLength:1,maxLength:300},country:{enum:['Deutschland','Österreich','DE','AT']},status:{enum:['existing','prospect','priority','unknown','Bestandskunde','Neukunde','Potenzieller Neukunde','Besonders interessant','Status ungeklärt']},category:{enum:['Bestandskunde','Neukunde']},lon:{type:['number','null'],minimum:5,maximum:18},lat:{type:['number','null'],minimum:46,maximum:56},locationAccuracy:{enum:['exact','approximate','unknown']},leadScore:{type:'number',minimum:0,maximum:100},revenue:{type:'number',minimum:0}};
for(const field of ['customerNumber','street','postalCode','postalPrefix','city','state','district','industry','product','potential','contact','notes','relationships','coordinateSource','personnelNumber','salesRep'])fields[field]={type:'string',maxLength:4000};
for(const field of ['reason','opportunity'])fields[field]={type:'string',maxLength:4000};
fields.website={type:'string',maxLength:2000,description:'Öffentliche http/https-Unternehmenswebsite, keine Zugangsdaten.'};
fields.sources={type:'array',maxItems:20,items:{type:'object',required:['url'],properties:{url:{type:'string',maxLength:2000},title:{type:'string',maxLength:300}}}};
fields.isFictional={type:'boolean',description:'Im Dummy-Modus zwingend true. Niemals reale Firmen als fiktiv kennzeichnen.'};
fields.needsReview={type:'boolean'};
fields.postalPrefix={type:'string',pattern:'^[0-9]{2}$',description:'Zweistelliges PLZ-Präfix; ohne Firmenkoordinaten nur ein schematischer Gebietspunkt nach GeoNames.'};
const tool={name:'show_georadar_map',title:'Mangold GeoRadar – Firmen auf Karte anzeigen',description:'Zeigt übergebene Unternehmen auf der echten MapLibre-Karte für Deutschland und Österreich. Status existing=blau/Bestandskunde, prospect=weiß/potenziell, priority=rot/besonders interessant, unknown=grau/ungeklärt. Jede Übergabe ersetzt den gesamten Bestand. Nur belegte Koordinaten übergeben; ohne Koordinaten wird ein zweistelliges postalPrefix oder eine zweistellige postalCode als schematischer PLZ-Gebietspunkt nach GeoNames angezeigt, ausdrücklich kein Firmenstandort. Ohne passende Referenz bleibt die Firma in der Liste. locationAccuracy exact nur bei geprüftem Firmenstandort, sonst approximate oder unknown. Kein automatisches Geocoding und keine erfundenen Marktpotenziale. Alte category Bestandskunde/Neukunde wird unterstützt.',inputSchema:{type:'object',required:['records'],properties:{schema:{const:'mangold-georadar/companies/v1'},records:{type:'array',maxItems:10000,items:{type:'object',required:['id','name','country'],properties:fields}}}},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:{ui:{resourceUri:URI}}};
tool.inputSchema.properties.territories={type:'array',maxItems:5,description:'Optionale vollständige Gebietszuordnung. Ohne Angabe bleiben die aktuellen Gebiete bestehen. Standard-Personalnummern CO=93, SR=42, SH=11, GD=2, GK=10; PLZ noch nicht zugeordnet.',items:{type:'object',required:['code','personnelNumber','rules'],properties:{code:{enum:['CO','SR','SH','GD','GK']},personnelNumber:{type:'string',maxLength:100},rules:{type:'array',maxItems:2,items:{type:'object',required:['country','prefixes'],properties:{country:{enum:['DE','AT']},prefixes:{type:'array',maxItems:200,items:{type:'string',pattern:'^[0-9]{1,5}$'}}}}}}}};
const codeSchema={type:'string',pattern:'^[A-Za-z][A-Za-z0-9-]{2,31}$',description:'Selbst gewählte eindeutige Recherchekennung, z. B. AB382. Kein Passwort.'};
const researchSchema={type:'object',required:['mode'],properties:{mode:{enum:['dummy','research']},query:{type:'string',maxLength:8000},notes:{type:'string',maxLength:8000},generatedAt:{type:'string',format:'date-time'}}};
const saveTool={name:'save_georadar_research',title:'GeoRadar-Recherche unter Kennung speichern',description:'Speichert geprüfte records mit Titel, Quellen und Recherche-Metadaten dauerhaft in Supabase unter einer selbst gewählten Kennung und liefert die Karten-URL. Gleiche Kennung mit gleichem Inhalt ist wiederholbar; anderer Inhalt überschreibt nichts und meldet CODE_EXISTS. Öffentliche Ergebnislinks sind derzeit ausschließlich für research.mode=dummy und isFictional=true bei allen records freigegeben. Niemals Speicherung ohne erfolgreiche Werkzeugantwort behaupten.',inputSchema:{type:'object',required:['code','records','research'],properties:{...tool.inputSchema.properties,code:codeSchema,title:{type:'string',maxLength:160},research:researchSchema}},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
const loadTool={name:'load_georadar_research',title:'Gespeicherte GeoRadar-Recherche laden',description:'Lädt genau eine bekannte Recherchekennung aus Supabase über die geschützte MCP-Verbindung; kein Auflisten aller Kennungen.',inputSchema:{type:'object',required:['code'],properties:{code:codeSchema}},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:{ui:{resourceUri:URI}}};
function handle(m,dependencies={}){
  if(!m||m.jsonrpc!=='2.0'||typeof m.method!=='string')return {jsonrpc:'2.0',id:m?.id??null,error:{code:-32600,message:'Ungültige JSON-RPC-Anfrage'}};
  if(m.id===undefined)return null;
  const ok=result=>({jsonrpc:'2.0',id:m.id,result});
  switch(m.method){
    case 'initialize':return ok({protocolVersion:['2025-11-25','2025-06-18','2025-03-26'].includes(m.params?.protocolVersion)?m.params.protocolVersion:'2025-03-26',capabilities:{tools:{},resources:{},extensions:{'io.modelcontextprotocol/ui':{mimeTypes:[MIME]}}},serverInfo:{name:'georadar-langdock',version:'2.0.0'}});
    case 'ping':return ok({});
    case 'tools/list':return ok({tools:[tool,saveTool,loadTool]});
    case 'resources/list':return ok({resources:[{uri:URI,name:'Mangold GeoRadar MapLibre',mimeType:MIME,_meta:uiMeta}]});
    case 'resources/templates/list':return ok({resourceTemplates:[]});
    case 'resources/read':if(![URI,'ui://georadar/map-v1.html','ui://georadar/map-v2.html','ui://georadar/map-v3.html'].includes(m.params?.uri))return {jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'Unbekannte Ressource'}};return ok({contents:[{uri:m.params.uri,mimeType:MIME,text:html,_meta:uiMeta}]});
    case 'tools/call':{
      const store=dependencies.store||defaultStore;
      const failed=e=>ok({isError:true,content:[{type:'text',text:e instanceof ResearchError?e.code+': '+e.message:'Speicherung oder Laden nicht bestätigt. Bitte Verbindung prüfen.'}]});
      if(m.params?.name===saveTool.name)return store.save(m.params.arguments).then(saved=>{const {data,...receipt}=saved;return ok({content:[{type:'text',text:'In Supabase gespeichert: '+saved.code+' · '+data.records.length+' Unternehmen. '+(saved.publiclyReadable?'Öffentlicher Dummy-Link: '+saved.mapUrl:'Keine öffentliche Freigabe: echte Recherchedaten sind nur über die geschützte MCP-Verbindung lesbar.')},{type:'text',text:JSON.stringify({...receipt,recordCount:data.records.length})}],structuredContent:{...receipt,recordCount:data.records.length}});}).catch(failed);
      if(m.params?.name===loadTool.name)return store.load(m.params.arguments?.code).then(saved=>ok({content:[{type:'text',text:'Recherche '+saved.code+' aus Supabase geladen.'},{type:'text',text:JSON.stringify(saved.data)}],structuredContent:{...saved.data,summary:D.summarize(saved.data.records),code:saved.code,title:saved.title},_meta:{ui:{resourceUri:URI}}})).catch(failed);
      if(m.params?.name!==tool.name)return {jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'Unbekanntes Werkzeug'}};
      try{const data=D.validate(m.params.arguments),summary=D.summarize(data.records);return ok({content:[{type:'text',text:`GeoRadar: ${summary.total} Unternehmen, ${summary.located} mit Koordinaten, ${summary.prefixLocated} als schematischer PLZ-Gebietspunkt, ${summary.unlocated} ohne Kartenposition. Bestandskunden: ${summary.existing}; potenzielle Neukunden: ${summary.prospect}; besonders interessant: ${summary.priority}; ungeklärt: ${summary.unknown}. Positionen werden gemäß übergebener Genauigkeit gekennzeichnet. Keine White-Spot-Bewertung.`},{type:'text',text:JSON.stringify({schema:data.schema,records:data.records,...(data.territories?{territories:data.territories}:{})})}],structuredContent:{schema:data.schema,records:data.records,...(data.territories?{territories:data.territories}:{}),summary,warnings:data.warnings.slice(0,50),warningCount:data.warnings.length},_meta:{ui:{resourceUri:URI}}});}catch(error){return ok({isError:true,content:[{type:'text',text:error.message}]});}
    }
    default:return {jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'Methode nicht unterstützt'}};
  }
}
function createServer(options={}){
  const token=options.token??process.env.GEORADAR_TOKEN;
  return http.createServer(async(req,res)=>{
    const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data===undefined?'':JSON.stringify(data));};
    if(req.url==='/health'){send(200,{ok:true,version:'2.0.0'});return;}
    if(req.url!=='/mcp'){send(404,{error:'Nicht gefunden'});return;}
    if(token){const a=Buffer.from(req.headers.authorization||''),b=Buffer.from('Bearer '+token);if(a.length!==b.length||!crypto.timingSafeEqual(a,b)){send(401,{error:'Unauthorized'});return;}}
    if(req.headers.origin&&req.headers.origin!==process.env.ALLOWED_ORIGIN){send(403,{error:'Origin nicht erlaubt'});return;}
    if(req.method!=='POST'){res.setHeader('Allow','POST');send(405,{error:'JSON-RPC via POST'});return;}
    try{
      const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>6*1024*1024){send(413,{error:'Anfrage zu groß (maximal 6 MB inklusive JSON-RPC).'});return;}chunks.push(chunk);}
      let m;try{m=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{send(400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Ungültiges JSON'}});return;}
      if(Array.isArray(m)){send(400,{error:'Batch-Anfragen werden nicht unterstützt'});return;}
      const result=await handle(m);send(result?200:202,result??undefined);
    }catch{if(!res.headersSent)send(400,{error:'Anfrage konnte nicht verarbeitet werden'});}
  });
}
function start(){const host=process.env.HOST||'127.0.0.1';if(!['127.0.0.1','localhost','::1'].includes(host)&&(!process.env.GEORADAR_TOKEN||process.env.GEORADAR_TOKEN.length<32))throw Error('Für externe Erreichbarkeit GEORADAR_TOKEN mit mindestens 32 Zeichen setzen.');return createServer().listen(Number(process.env.PORT||8787),host,()=>console.log('Mangold GeoRadar MCP v2 bereit. Keine Unternehmensdaten werden gespeichert.'));}
if(require.main===module)start();
module.exports={createServer,handle,tool,saveTool,loadTool,URI,start};
