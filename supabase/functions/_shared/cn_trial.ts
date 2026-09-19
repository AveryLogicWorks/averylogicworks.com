export function makeActivationKey(): string {
  // 120 random bits, rendered as exactly 30 letters/numbers and five dashes.
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(15)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return raw.match(/.{5}/g)!.join('-');
}

export async function claimCommandNexusTrial(admin: any, user: {id: string, email?: string}) {
  const read = () => admin.from('command_nexus_licenses').select('raw_key,expires_at,revoked_at').eq('trial_user_id',user.id).maybeSingle();
  let current = await read();
  if (current.error) throw new Error('License lookup failed');
  if (!current.data) {
    const old = await admin.from('trial_keys').select('expires_at').eq('user_id',user.id).eq('product_slug','command-nexus').maybeSingle();
    if(old.error) throw new Error('Trial eligibility lookup failed');
    const now = Date.now();
    const expiry = old.data ? Math.min(Date.parse(old.data.expires_at), now + 3*86400000) : now + 3*86400000;
    if(!Number.isFinite(expiry) || expiry <= now) return {status:409,body:{error:'You have already used this product’s free trial.',expired:true}};
    const rawKey=makeActivationKey().replaceAll('-','');
    const inserted = await admin.from('command_nexus_licenses').upsert({raw_key:rawKey,trial_user_id:user.id,tier:'trial',expires_at:new Date(expiry).toISOString()}, {onConflict:'trial_user_id',ignoreDuplicates:true});
    if(inserted.error) throw new Error('Trial issuance failed');
    // Read the winning row after a concurrent claim. Never return a losing key.
    current = await read();
    if(current.error || !current.data) throw new Error('Trial issuance lookup failed');
  }
  const license=current.data;
  if(license.revoked_at || Date.parse(license.expires_at)<=Date.now()) return {status:409,body:{error:'Your trial has expired or been revoked.',expired:true}};
  return {status:200,body:{key:license.raw_key.match(/.{5}/g).join('-'),expires_at:license.expires_at,product_slug:'command-nexus',format:'CN-35',days:3}};
}
