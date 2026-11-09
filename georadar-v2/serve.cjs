'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createResearchApi}=require('./backend/research-api.cjs'),{createStore}=require('./backend/research-store.cjs');
const {createTransport}=require('./mcp/transport.cjs'),{handle}=require('./mcp/server.cjs');
const {createPrivateViews}=require('./backend/private-views.cjs');
const {createMapsApi}=require('./backend/maps-api.cjs');
const root=path.resolve(__dirname,'dist');
const mime={'.geojson':'application/geo+json','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
function createPreviewServer({store=createStore(),getToken=()=>process.env.GEORADAR_TOKEN,web=createPrivateViews(),maps=null,mapsService}={}){
 const api=createResearchApi({store,getToken}),mcp=createTransport({getToken,dispatch:m=>handle(m,{store,...(mapsService?{mapsService}:{})})}),mapsApi=maps||createMapsApi(mapsService?{service:mapsService}:{});
 return http.createServer(async(req,res)=>{
  let pathname,url;try{url=new URL(req.url,'http://'+req.headers.host);pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
  if(['/api/research','/mcp','/api/auth','/api/views','/api/karte','/api/route'].includes(pathname)){
   try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const response=await (pathname==='/api/karte'?mapsApi.karte:pathname==='/api/route'?mapsApi.route:pathname==='/mcp'?mcp:pathname==='/api/auth'?web.auth:pathname==='/api/views'?web.views:api)(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{if(!res.headersSent)res.writeHead(500);res.end();}return;
  }
  const shared=/^\/k\/[A-Za-z0-9_-]{22,64}$/.test(pathname);
  const view=/^\/[A-Za-z][A-Za-z0-9-]{2,31}\/?$/.test(pathname)&&!['API','MCP','ASSETS','DIST','LICENSES','STATIC'].includes(pathname.replace(/\//g,'').toUpperCase());
  if(view&&pathname.endsWith('/')){res.writeHead(308,{Location:pathname.slice(0,-1)+url.search}).end();return;}
  const filename=path.resolve(root,'.'+(pathname==='/'||view||shared?'/index.html':pathname));
  if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(filename,(err,data)=>{if(err){res.writeHead(404).end('Nicht gefunden');return;}res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','X-Content-Type-Options':'nosniff',...(view||shared?{'X-Robots-Tag':'noindex, nofollow','Cache-Control':'no-store'}:{})});res.end(data);});
 });
}
if(require.main===module)createPreviewServer().listen(Number(process.env.PORT||4387),'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+(process.env.PORT||4387)));
module.exports={createPreviewServer};
