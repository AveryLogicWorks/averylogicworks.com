// Owner-only live API authentication check. Never creates or captures a payment.
const base = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const headers: Record<string, string> = {'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin'};
  if (['https://averylogicworks.com','https://www.averylogicworks.com'].includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  else if (origin) return new Response('Forbidden', {status:403});
  headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
  headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (req.method !== 'POST') return json({error:'Method not allowed'},405);
  const authorization = req.headers.get('authorization') || '';
  if (!/^Bearer \S+$/i.test(authorization)) return json({error:'Sign in required'},401);
  try {
    const auth = await fetch(`${base}/auth/v1/user`,{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(10000)});
    if (!auth.ok) return json({error:'Sign in required'},401);
    const user = await auth.json();
    if (!user.email || user.is_anonymous) return json({error:'Forbidden'},403);
    const owner = await fetch(`${base}/rest/v1/site_admins?select=email&email=eq.${encodeURIComponent(user.email.toLowerCase())}`,{
      headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)
    });
    if (!owner.ok || !(await owner.json()).length) return json({error:'Forbidden'},403);
    const checked_at = new Date().toISOString();
    const id = Deno.env.get('PAYPAL_CLIENT_ID');
    const secret = Deno.env.get('PAYPAL_CLIENT_SECRET');
    if (!id || !secret) return json({state:'warn',label:'Live API credentials missing',checked_at});
    const response = await fetch('https://api-m.paypal.com/v1/oauth2/token',{
      method:'POST',headers:{Authorization:'Basic '+btoa(`${id}:${secret}`),'Content-Type':'application/x-www-form-urlencoded'},
      body:'grant_type=client_credentials',signal:AbortSignal.timeout(10000)
    });
    const result = await response.json().catch(() => ({}));
    const ok = response.ok && typeof result.access_token === 'string' && result.access_token.length > 0;
    return json({state:ok?'ok':'warn',label:ok?'Live API authentication verified':'Live API authentication failed',checked_at,
      scope:'API connectivity and credentials only; checkout, capture and license delivery require separate verification.'});
  } catch {
    return json({state:'unknown',label:'Check unavailable — retry',checked_at:new Date().toISOString()},503);
  }
});
