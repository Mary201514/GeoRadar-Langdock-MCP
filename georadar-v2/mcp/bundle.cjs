'use strict';
const fs=require('node:fs'),path=require('node:path');
const dist=path.resolve(__dirname,'../dist');
function bundle(){
  let html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
  for(const name of ['maplibre-gl.css','style.css'])html=html.replace('<link rel="stylesheet" href="'+name+'">',()=>'<style>'+fs.readFileSync(path.join(dist,name),'utf8').replace(/<\/style/gi,'<\\/style')+'</style>');
  const scripts=[];
  for(const name of ['maplibre-gl.js','context-mask.js','data-model.js','companies.js','territories.js','mcp-bridge.js','app.js']){
    html=html.replace('<script defer src="'+name+'"></script>','');
    const source=name==='mcp-bridge.js'?path.join(__dirname,'app-bridge.js'):path.join(dist,name);
    scripts.push('<script>'+fs.readFileSync(source,'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
  }
  html=html.replace('src="mangold.svg"','src="data:image/svg+xml;base64,'+fs.readFileSync(path.join(dist,'mangold.svg')).toString('base64')+'"');
  const style='<script>window.GEORADAR_STYLE='+JSON.stringify(JSON.parse(fs.readFileSync(path.join(dist,'base-style.json'),'utf8'))).replace(/</g,'\\u003c')+';</script>';
  return html.replace('</body>',()=>style+scripts.join('\n')+'</body>');
}
module.exports={bundle};
if(require.main===module){fs.writeFileSync(path.join(__dirname,'map.html'),bundle());console.log('MCP-App gebündelt: mcp/map.html');}
