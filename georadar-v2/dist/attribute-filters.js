'use strict';
// GeoRadar 4 – Filter, die automatisch aus Typ und Zusatzmerkmalen der Punkte entstehen.
(() => {
  const $=id=>document.getElementById(id);
  const anchor=document.querySelector('.company-filters');if(!anchor)return;
  const box=document.createElement('details');box.id='attribute-filters';box.className='attribute-filters';box.hidden=true;
  box.innerHTML='<summary>Filter nach Typ & Merkmalen <span id="attribute-filter-count" class="micro"></span></summary><div id="attribute-filter-body"></div><button id="attribute-filter-reset" class="subtle" type="button">Alle Merkmalfilter zurücksetzen</button>';
  anchor.after(box);
  const MAX_CHOICES=40;
  let state={}; // feld -> {kind:'set',values:Set} | {kind:'range',min,max}
  const fieldValue=(r,field)=>field==='__type'?r.type:r.attributes?.[field];
  const fmt=v=>typeof v==='boolean'?(v?'ja':'nein'):String(v);

  function predicate(r){
    for(const [field,f]of Object.entries(state)){
      const v=fieldValue(r,field);
      if(f.kind==='set'){if(f.values.size&&!f.values.has(v===undefined?'__leer':fmt(v)))return false;}
      else if(f.kind==='range'){if((f.min!==null||f.max!==null)&&(typeof v!=='number'||(f.min!==null&&v<f.min)||(f.max!==null&&v>f.max)))return false;}
    }
    return true;
  }
  function changed(){
    const active=Object.values(state).filter(f=>f.kind==='set'?f.values.size:(f.min!==null||f.max!==null)).length;
    $('attribute-filter-count').textContent=active?'· '+active+' aktiv':'';
    window.GeoRadarExtraFilter=active?predicate:null;
    document.dispatchEvent(new CustomEvent('georadar:extra-filter-changed'));
  }
  function build(){
    const records=window.GeoRadarCompanies?.getSnapshot().records||[];
    const fields=new Map();
    const add=(field,v)=>{if(!fields.has(field))fields.set(field,{values:new Map(),numbers:0,missing:0});const f=fields.get(field);if(v===undefined){f.missing++;return;}if(typeof v==='number')f.numbers++;const k=fmt(v);f.values.set(k,(f.values.get(k)||0)+1);};
    for(const r of records){add('__type',r.type);for(const k of Object.keys(r.attributes||{}))if(!fields.has(k))fields.set(k,{values:new Map(),numbers:0,missing:0});}
    for(const r of records)for(const k of fields.keys())if(k!=='__type')add(k,r.attributes?.[k]);
    if(fields.get('__type')?.values.size===0)fields.delete('__type');
    const body=$('attribute-filter-body');body.replaceChildren();
    const old=state;state={};
    for(const [field,f]of fields){
      const label=field==='__type'?'Typ':field,group=document.createElement('fieldset');group.className='attribute-group';
      const legend=document.createElement('legend');legend.textContent=label;group.append(legend);
      const numeric=f.numbers>0&&f.numbers===records.length-f.missing&&f.values.size>8;
      if(numeric){
        const nums=records.map(r=>fieldValue(r,field)).filter(v=>typeof v==='number'),min=Math.min(...nums),max=Math.max(...nums);
        state[field]={kind:'range',min:old[field]?.kind==='range'?old[field].min:null,max:old[field]?.kind==='range'?old[field].max:null};
        const row=document.createElement('div');row.className='range-row';
        for(const side of ['min','max']){const input=document.createElement('input');input.type='number';input.step='any';input.placeholder=(side==='min'?'ab ':'bis ')+(side==='min'?min:max).toLocaleString('de-DE');input.setAttribute('aria-label',label+(side==='min'?' ab':' bis'));if(state[field][side]!==null)input.value=state[field][side];input.oninput=()=>{const v=input.value===''?null:Number(input.value);state[field][side]=Number.isFinite(v)?v:null;changed();};row.append(input);}
        group.append(row);
      }else if(f.values.size<=MAX_CHOICES){
        const keep=old[field]?.kind==='set'?old[field].values:new Set();state[field]={kind:'set',values:new Set([...keep].filter(v=>f.values.has(v)||v==='__leer'))};
        const entries=[...f.values.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de'));if(f.missing)entries.push(['__leer',f.missing]);
        for(const [value,count]of entries){const l=document.createElement('label'),c=document.createElement('input'),s=document.createElement('span');c.type='checkbox';c.checked=state[field].values.has(value);c.onchange=()=>{c.checked?state[field].values.add(value):state[field].values.delete(value);changed();};s.textContent=(value==='__leer'?'(ohne Angabe)':value)+' · '+count;l.append(c,s);group.append(l);}
      }else{
        const p=document.createElement('p');p.className='micro';p.textContent=f.values.size+' verschiedene Werte – über die Suche oben filtern.';group.append(p);
      }
      body.append(group);
    }
    box.hidden=fields.size===0;
    changed();
  }
  $('attribute-filter-reset').onclick=()=>{for(const f of Object.values(state)){if(f.kind==='set')f.values.clear();else{f.min=null;f.max=null;}}build();};
  document.addEventListener('georadar:companies-updated',build);
})();
