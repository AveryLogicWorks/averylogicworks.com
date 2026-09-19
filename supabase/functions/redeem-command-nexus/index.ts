import { createClient } from 'npm:@supabase/supabase-js@2';
import { base64Url, commandNexusSigningKey } from '../_shared/cn_signing.ts';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers});
  if(req.method!=='POST') return reply({error:'Method not allowed'},405);
  try {
    if(Number(req.headers.get('content-length')||0)>2048) return reply({error:'Invalid request'},400);
    const text=await req.text();if(text.length>2048)return reply({error:'Invalid request'},400);
    const body=JSON.parse(text);
    const key=typeof body.key==='string'?body.key.replace(/[\s-]/g,'').toUpperCase():'';
    const device=typeof body.device_hash==='string'?body.device_hash:'';
    if(!/^[A-Z0-9]{30}$/.test(key)||!/^[a-f0-9]{64}$/.test(device)) return reply({error:'Invalid request'},400);
    // The high-entropy license key is the credential. No public API key grants an entitlement.
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const signing=await commandNexusSigningKey(); // Fail before binding if signing is unavailable.
    const read=()=>admin.from('command_nexus_licenses').select('id,tier,issued_at,expires_at,device_hash,revoked_at').eq('raw_key',key).maybeSingle();
    let {data:license,error}=await read();
    if(error) return reply({error:'Service unavailable'},503);
    if(!license) return reply({error:'Invalid key'},401);
    if(license.revoked_at||Date.parse(license.expires_at)<=Date.now())return reply({error:'License expired or revoked'},410);
    if(!license.device_hash){
      const bound=await admin.from('command_nexus_licenses').update({device_hash:device,first_activated_at:new Date().toISOString()}).eq('id',license.id).is('device_hash',null).is('revoked_at',null).gt('expires_at',new Date().toISOString());
      if(bound.error)return reply({error:'Service unavailable'},503);
      // Conditional UPDATE makes first activation atomic, including simultaneous requests.
      const refreshed=await read();
      if(refreshed.error||!refreshed.data)return reply({error:'Service unavailable'},503);
      license=refreshed.data;
    }
    if(license.revoked_at||Date.parse(license.expires_at)<=Date.now())return reply({error:'License expired or revoked'},410);
    if(license.device_hash!==device)return reply({error:'Key already assigned to another computer'},409);
    const claims={v:1,tier:license.tier,iat:Math.floor(Date.parse(license.issued_at)/1000),exp:Math.floor(Date.parse(license.expires_at)/1000),license_id:license.id,device_hash:device};
    const payload=new TextEncoder().encode(JSON.stringify(claims));
    const signature=new Uint8Array(await crypto.subtle.sign('Ed25519',signing.privateKey,payload));
    return reply({token:`CN1.${base64Url(payload)}.${base64Url(signature)}`});
  }catch{ return reply({error:'Activation unavailable'},503); }
});
