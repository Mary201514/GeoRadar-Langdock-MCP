'use strict';
// Test-Doubles: Supabase-REST/RPC der Kundentabelle und Langdock-Embeddings. Nie im Produktivcode geladen.
const crypto=require('node:crypto');
const md5=s=>crypto.createHash('md5').update(s).digest('hex');

function suchText(r){return [r.name,r.postalCode+' '+r.city+', '+r.country,r.type,...Object.values(r.attributes||{}).filter(v=>typeof v==='string'),r.notes].filter(Boolean).join('. ');}

function fakeKundenSupabase(records){
  const rows=records.map(r=>({id:r.id,record:r,ist_fiktiv:!!r.isFictional,firmenname:r.name,plz:r.postalCode,ort:r.city,land:r.country,vertreter:r.salesRep||r.attributes?.['Vertreter (Test-Zuordnung)']||null,kundenstatus:r.status,such_text:suchText(r),embedding:null,hash:null}));
  const calls=[];
  const json=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json'}});
  const cos=(a,b)=>{let d=0,x=0,y=0;for(let i=0;i<a.length;i++){d+=a[i]*b[i];x+=a[i]*a[i];y+=b[i]*b[i];}return d/Math.sqrt(x*y||1);};
  const pub=r=>({id:r.id,firmenname:r.firmenname,plz:r.plz,ort:r.ort,land:r.land,vertreter:r.vertreter,kundenstatus:r.kundenstatus,ist_fiktiv:r.ist_fiktiv});
  async function fetchImpl(url,options={}){
    const u=new URL(url),path=u.pathname.replace('/rest/v1/','');calls.push(path);
    if(!options.headers?.apikey)return json({message:'no key'},401);
    if(path==='georadar_kunden'&&u.searchParams.get('id')){const ids=u.searchParams.get('id').replace(/^in\.\(|\)$/g,'').split(',').map(x=>x.replace(/^"|"$/g,''));return json(rows.filter(r=>ids.includes(r.id)).map(r=>({id:r.id,lon:r.record.lon??null,lat:r.record.lat??null})));}
    if(path==='georadar_kunden'){const o=Number(u.searchParams.get('offset')||0),l=Number(u.searchParams.get('limit')||1000);return json(rows.slice(o,o+l).map(r=>({record:r.record})));}
    const a=options.body?JSON.parse(options.body):{};
    if(path==='rpc/georadar_kunden_ohne_embedding')return json(rows.filter(r=>!r.embedding||r.hash!==md5(r.such_text)).slice(0,a.anzahl).map(r=>({id:r.id,such_text:r.such_text,hash:md5(r.such_text)})));
    if(path==='rpc/georadar_kunden_embeddings_setzen'){let n=0;for(const e of a.daten){const r=rows.find(x=>x.id===e.id);if(r&&md5(r.such_text)===e.hash){r.embedding=e.embedding;r.hash=e.hash;n++;}}return json(n);}
    if(path==='rpc/georadar_kunden_suche'){const v=JSON.parse(a.abfrage);return json(rows.filter(r=>r.embedding&&(a.mit_fiktiven||!r.ist_fiktiv)).map(r=>({...pub(r),aehnlichkeit:cos(v,r.embedding)})).sort((x,y)=>y.aehnlichkeit-x.aehnlichkeit).slice(0,a.anzahl));}
    if(path==='rpc/georadar_kunden_volltext'){const alt=a.suchtext.toLowerCase().split(/\s+or\s+/).map(x=>x.split(/\s+/));return json(rows.filter(r=>(a.mit_fiktiven||!r.ist_fiktiv)&&alt.some(w=>w.every(t=>r.such_text.toLowerCase().includes(t)))).slice(0,a.anzahl).map(r=>({...pub(r),rang:0.1})));}
    return json({code:'PGRST205'},404);
  }
  return {fetchImpl,rows,calls,getConfig:()=>({url:'https://kunden-test.supabase.co',key:'sb_secret_'+'k'.repeat(40)})};
}

// Deterministische "Embeddings": Wort-Hashing auf 1536 Dimensionen (gemeinsame Wörter = ähnlich)
function fakeLangdock({dims=1536,status=200}={}){
  const calls=[];
  const vec=t=>{const v=new Array(dims).fill(0);for(const w of t.toLowerCase().match(/[a-zäöüß]{4,}/g)||[]){const h=crypto.createHash('sha1').update(w.slice(0,7)).digest();v[h.readUInt16BE(0)%dims]+=1;}v[0]+=0.01;return v;};
  async function fetchImpl(url,options){
    const b=JSON.parse(options.body);calls.push({url,model:b.model,n:b.input.length,auth:options.headers.Authorization});
    if(status!==200)return new Response('{}',{status});
    return Response.json({data:b.input.map((t,i)=>({index:i,embedding:vec(t)}))});
  }
  return {fetchImpl,calls};
}
module.exports={fakeKundenSupabase,fakeLangdock,suchText};
