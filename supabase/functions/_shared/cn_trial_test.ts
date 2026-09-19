import { claimCommandNexusTrial, makeActivationKey } from './cn_trial.ts';
function assert(value:unknown,message='Assertion failed'){if(!value)throw new Error(message);}
function database(oldExpiry:string|null=null){
 let license:any=null;
 return {from(table:string){return {
  select(){return {eq(){return this;},async maybeSingle(){return {data:table==='command_nexus_licenses'?license:(oldExpiry?{expires_at:oldExpiry}:null),error:null};}};},
  async upsert(row:any){license??={...row,revoked_at:null};return {error:null};}
 };}};
}
Deno.test('35 characters and five dashes',()=>{
 for(let i=0;i<100;i++){const key=makeActivationKey();assert(/^[A-Z0-9]{5}(-[A-Z0-9]{5}){5}$/.test(key));assert(key.length===35);}
});
Deno.test('simultaneous claims return same winning key and preserve expiration',async()=>{
 const expiry=new Date(Date.now()+3600000).toISOString();const db=database(expiry);
 const results=await Promise.all([claimCommandNexusTrial(db,{id:'test'}),claimCommandNexusTrial(db,{id:'test'})]);
 assert(results.every(r=>r.status===200));assert(results[0].body.key===results[1].body.key);assert(results[0].body.expires_at===expiry);
});
Deno.test('expired trial cannot be reissued',async()=>{
 const result=await claimCommandNexusTrial(database(new Date(Date.now()-1000).toISOString()),{id:'test'});
 assert(result.status===409);assert(result.body.expired);
});
