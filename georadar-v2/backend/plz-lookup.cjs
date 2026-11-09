'use strict';
// GeoRadar 4 – ermittelt die 5-stellige PLZ zu einer Koordinate (Punkt-in-Fläche) aus dist/plz/plz5-0.geojson bis plz5-9.geojson.
const fs=require('node:fs'),path=require('node:path');

let index=null;
const CELL=0.25; // Raster in Grad für die Vorauswahl

function load(files=[0,1,2,3,4,5,6,7,8,9].map(d=>'plz5-'+d+'.geojson').map(f=>path.resolve(__dirname,'../dist/plz',f))){
  if(index)return index;
  const data={features:files.flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8')).features)};
  const grid=new Map(),features=[];
  for(const f of data.features){
    if(!f.geometry)continue;
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const poly of polys)for(const [x,y] of poly[0]){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
    const item={plz:f.properties.plz,polys,bbox:[minX,minY,maxX,maxY]};features.push(item);
    for(let gx=Math.floor(minX/CELL);gx<=Math.floor(maxX/CELL);gx++)for(let gy=Math.floor(minY/CELL);gy<=Math.floor(maxY/CELL);gy++){const k=gx+':'+gy;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(item);}
  }
  index={grid,count:features.length};return index;
}
function inRing(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
function inPolygon(x,y,poly){if(!inRing(x,y,poly[0]))return false;for(let h=1;h<poly.length;h++)if(inRing(x,y,poly[h]))return false;return true;}
function postalCodeAt(lon,lat){
  if(!Number.isFinite(lon)||!Number.isFinite(lat))return null;
  const {grid}=load(),cell=grid.get(Math.floor(lon/CELL)+':'+Math.floor(lat/CELL))||[];
  for(const f of cell){const [a,b,c,d]=f.bbox;if(lon<a||lon>c||lat<b||lat>d)continue;for(const poly of f.polys)if(inPolygon(lon,lat,poly))return f.plz;}
  return null;
}
module.exports={postalCodeAt,load};
