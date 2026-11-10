'use strict';
const crypto=require('node:crypto');
function fakePrivateStorage(){
 const sessions=[],views=[],users=[{id:'11111111-1111-4111-8111-111111111111',email:'dummy-a@example.invalid',password:'dummy-password-A',access_token:'TEST-ACCESS-A'},{id:'22222222-2222-4222-8222-222222222222',email:'dummy-b@example.invalid',password:'dummy-password-B',access_token:'TEST-ACCESS-B'}];
 const response=(status,body)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 async function fetchImpl(url,options={}){
  const u=new URL(url),headers=new Headers(options.headers),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
  if(u.pathname==='/auth/v1/token'){const user=users.find(x=>x.email===body.email&&x.password===body.password);return user?response(200,{access_token:user.access_token,refresh_token:'NEVER-PERSIST-REFRESH',expires_in:3600,user:{id:user.id,email:user.email}}):response(400,{error:'invalid_credentials'});}
  if(u.pathname==='/auth/v1/user'){const user=users.find(x=>'Bearer '+x.access_token===headers.get('authorization'));return user?response(200,{id:user.id,email:user.email}):response(401,{error:'invalid_token'});}
  const store=u.pathname.endsWith('/georadar_web_sessions')?sessions:u.pathname.endsWith('/georadar_saved_views')?views:null;if(!store)return response(404,{});
  const matches=row=>[...u.searchParams].every(([key,value])=>!value.startsWith('eq.')||String(row[key])===value.slice(3));
  if(method==='POST'){const row={...body,...(store===views?{id:crypto.randomUUID()}:{}),created_at:new Date().toISOString()};store.push(row);return headers.get('prefer')==='return=minimal'?new Response('',{status:201}):response(201,[row]);}
  if(method==='DELETE'){for(let i=store.length-1;i>=0;i--)if(matches(store[i]))store.splice(i,1);return response(204,null);}
  let selected=store.filter(matches);if(u.searchParams.get('order'))selected=selected.toSorted((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||100);selected=selected.slice(offset,offset+limit);const fields=u.searchParams.get('select')?.split(',');if(fields)selected=selected.map(r=>Object.fromEntries(fields.map(k=>[k,r[k]])));return response(200,selected);
 }
 return {fetchImpl,users,sessions,views};
}
module.exports={fakePrivateStorage};
