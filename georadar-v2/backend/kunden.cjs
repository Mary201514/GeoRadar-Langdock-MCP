'use strict';
// GeoRadar – Bestandskundenliste: Laden für angemeldete Nutzer, semantische Suche, Embeddings über die Langdock-API (EU).
class KundenError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}

const MODELL='text-embedding-ada-002',DIM=1536;

function supabaseConfig(){return {url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY};}
function langdockConfig(){return {key:process.env.LANGDOCK_API_KEY,region:process.env.LANGDOCK_REGION||'eu',base:process.env.LANGDOCK_API_BASE||'https://api.langdock.com'};}

function createKunden({fetchImpl=(...a)=>fetch(...a),getConfig=supabaseConfig,getLangdock=langdockConfig}={}){
  function sb(){
    const c=getConfig();let u;try{u=new URL(c.url);}catch{}
    if(!u||u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||typeof c.key!=='string'||c.key.length<32||c.key.startsWith('sb_publishable_'))throw new KundenError(503,'STORAGE_NOT_CONFIGURED','Supabase ist serverseitig nicht eingerichtet.');
    return {origin:u.origin,key:c.key};
  }
  async function rest(path,options={}){
    const c=sb();let r;
    try{r=await fetchImpl(c.origin+'/rest/v1/'+path,{...options,redirect:'error',signal:AbortSignal.timeout(20000),headers:{apikey:c.key,...(c.key.startsWith('eyJ')?{Authorization:'Bearer '+c.key}:{}),'Content-Type':'application/json',...options.headers}});}
    catch{throw new KundenError(502,'STORAGE_UNREACHABLE','Supabase ist nicht erreichbar.');}
    if(!r.ok){let pg;try{pg=(await r.json()).code;}catch{}if(['42P01','PGRST205','PGRST202','42883'].includes(pg))throw new KundenError(503,'KUNDEN_SCHEMA_MISSING','Die Kundentabelle fehlt. Bitte die SQL-Teile „Bestandskunden“ ausführen.');throw new KundenError(502,'STORAGE_REQUEST_FAILED','Supabase hat die Anfrage abgelehnt.');}
    const t=await r.text();return t?JSON.parse(t):null;
  }
  const rpc=(name,args)=>rest('rpc/'+name,{method:'POST',body:JSON.stringify(args)});

  function langdock(){
    const c=getLangdock();
    if(typeof c.key!=='string'||c.key.length<16||/\s/.test(c.key))throw new KundenError(503,'EMBEDDINGS_NOT_CONFIGURED','LANGDOCK_API_KEY ist serverseitig nicht gesetzt (Langdock-API-Key mit Embedding-Berechtigung).');
    if(!/^[a-z]{2,8}$/.test(c.region))throw new KundenError(503,'EMBEDDINGS_NOT_CONFIGURED','LANGDOCK_REGION ist ungültig.');
    return c;
  }
  async function embed(texts){
    const c=langdock();let r;
    try{r=await fetchImpl(c.base.replace(/\/$/,'')+'/openai/'+c.region+'/v1/embeddings',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+c.key,'Content-Type':'application/json'},body:JSON.stringify({model:MODELL,input:texts,encoding_format:'float'})});}
    catch{throw new KundenError(502,'EMBEDDINGS_UNREACHABLE','Die Langdock-API ist nicht erreichbar.');}
    let data;try{data=await r.json();}catch{data=null;}
    if(r.status===401||r.status===403)throw new KundenError(503,'EMBEDDINGS_NOT_CONFIGURED','Langdock lehnt den API-Key ab (Embedding-Berechtigung prüfen).');
    if(r.status===429)throw new KundenError(429,'EMBEDDINGS_RATE_LIMIT','Langdock-Limit erreicht. Bitte kurz warten und erneut aufrufen.');
    if(!r.ok||!Array.isArray(data?.data))throw new KundenError(502,'EMBEDDINGS_FAILED','Langdock lieferte keine Embeddings.');
    const out=data.data.slice().sort((a,b)=>a.index-b.index).map(d=>d.embedding);
    if(out.length!==texts.length||out.some(v=>!Array.isArray(v)||v.length!==DIM||v.some(x=>!Number.isFinite(x))))throw new KundenError(502,'EMBEDDINGS_FAILED','Unerwartetes Embedding-Format (erwartet '+DIM+' Werte).');
    return out;
  }
  const vec=v=>'['+v.join(',')+']';

  return {
    MODELL,DIM,
    // Alle Kunden im GeoRadar-Format (nur nach Anmeldung aufrufen)
    async alle(){
      const out=[];
      for(let offset=0;offset<20000;offset+=1000){
        const rows=await rest('georadar_kunden?'+new URLSearchParams({select:'record',order:'id.asc',limit:'1000',offset:String(offset)}));
        out.push(...rows.map(r=>r.record));if(rows.length<1000)break;
      }
      return out;
    },
    async suchen({suchtext,anzahl=15,mit_fiktiven=false}={}){
      if(typeof suchtext!=='string'||!suchtext.trim()||suchtext.length>500)throw new KundenError(400,'INVALID_QUERY','suchtext: 1–500 Zeichen.');
      const n=Math.min(Math.max(Number.isInteger(anzahl)?anzahl:15,1),100);
      let semantisch=[],hinweis;
      try{const [v]=await embed([suchtext.trim()]);semantisch=await rpc('georadar_kunden_suche',{abfrage:vec(v),anzahl:n,mit_fiktiven:mit_fiktiven===true});}
      catch(e){if(!(e instanceof KundenError)||!/^EMBEDDINGS_/.test(e.code))throw e;hinweis=e.message+' Es wurde nur die Volltextsuche verwendet (Wortstämme, keine Bedeutung): für Bedeutungssuche mehrere Suchen mit Synonymen, Namensteilen und Orten durchführen.';}
      const volltext=await rpc('georadar_kunden_volltext',{suchtext:suchtext.trim(),anzahl:n,mit_fiktiven:mit_fiktiven===true}).catch(()=>[]);
      // Volltext verknüpft Wörter mit UND. Reicht das nicht, zusätzlich jedes Wort einzeln (ODER) – Treffer mit allen Wörtern bleiben vorn.
      const woerter=suchtext.trim().replace(/["()]/g,' ').split(/\s+/).filter(w=>w.length>1&&!/^(or|oder|und|and|in|im|am|an|bei|der|die|das|von|für|gmbh|ag|kg|co|mbh)$/i.test(w));
      if(volltext.length<n&&woerter.length>1){
        const breit=await rpc('georadar_kunden_volltext',{suchtext:woerter.join(' or '),anzahl:n,mit_fiktiven:mit_fiktiven===true}).catch(()=>[]);
        for(const r of breit)if(!volltext.some(v=>v.id===r.id))volltext.push({...r,teiltreffer:true});
      }
      if(!semantisch.length&&!hinweis)hinweis='Embeddings sind noch nicht eingerichtet – Ergebnis nur aus der Volltextsuche (Wortstämme, keine Bedeutung). Für Bedeutungssuche mehrere Suchen mit Synonymen, Namensteilen und Orten durchführen.';
      const seen=new Set(),treffer=[];
      for(const r of semantisch){seen.add(r.id);treffer.push({...r,aehnlichkeit:Math.round(r.aehnlichkeit*1000)/1000,quelle:'semantisch'+(volltext.some(v=>v.id===r.id)?' + Volltext':'')});}
      for(const r of volltext)if(!seen.has(r.id)&&treffer.length<n+5){treffer.push({...r,rang:undefined,teiltreffer:undefined,aehnlichkeit:null,quelle:r.teiltreffer?'Volltext (einzelne Begriffe)':'Volltext'});seen.add(r.id);}
      // Gespeicherte (ungefähre) Positionen mitliefern, damit Karten ohne erneute Adresssuche entstehen.
      if(treffer.length){try{
        const pos=await rest('georadar_kunden?'+new URLSearchParams({select:'id,lon,lat',id:'in.('+treffer.map(t=>'"'+String(t.id).replace(/["\\]/g,'')+'"').join(',')+')'}));
        const byId=new Map((pos||[]).map(p=>[p.id,p]));
        for(const t of treffer){const p=byId.get(t.id);if(p&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)){t.lon=p.lon;t.lat=p.lat;}}
      }catch{}}
      return {suchtext:suchtext.trim(),anzahl:treffer.length,treffer,positionen:'lon/lat sind ungefähre Positionen (PLZ-Gebiet bzw. Ortsmitte), locationAccuracy approximate',hinweis};
    },
    async embeddingsAktualisieren({budgetMs=40000,batch=96}={}){
      const start=Date.now();let geschrieben=0,runden=0;
      while(Date.now()-start<budgetMs){
        const offen=await rpc('georadar_kunden_ohne_embedding',{anzahl:batch});
        if(!offen.length)break;
        const vecs=await embed(offen.map(o=>o.such_text));
        geschrieben+=await rpc('georadar_kunden_embeddings_setzen',{daten:offen.map((o,i)=>({id:o.id,embedding:vecs[i],modell:'langdock:'+MODELL,hash:o.hash}))});
        runden++;
      }
      const rest_=(await rpc('georadar_kunden_ohne_embedding',{anzahl:500})).length;
      return {modell:MODELL,geschrieben,offen:rest_,naechster_schritt:rest_?'Noch '+rest_+(rest_===500?'+':'')+' Kunden ohne Embedding. Werkzeug erneut aufrufen.':undefined};
    }
  };
}

module.exports={createKunden,KundenError};
