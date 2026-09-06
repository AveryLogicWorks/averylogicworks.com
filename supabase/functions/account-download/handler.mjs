// Files must be migrated to the PRIVATE software-downloads bucket before rollout.
// No public URL or signed bearer-link fallback: every transfer requires a session.
export const products = Object.freeze({
  'command-nexus': 'CommandNexus.exe',
  'speakeasy': 'Speakeasy-3-Day-Trial.zip',
  'quadrahydra': 'QuadraHydra-1.0.3-Windows.zip'
});

export function createHandler({ authenticate, openFile, recordDownload }) {
  return async function handle(req) {
    const origin = req.headers.get('origin');
    const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff' };
    if (origin && !['https://averylogicworks.com', 'https://www.averylogicworks.com'].includes(origin)) {
      return new Response('Origin not allowed', { status: 403, headers });
    }
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'POST'].includes(req.method)) return new Response('Method not allowed', { status: 405, headers });
    let bearer = req.headers.get('authorization') || '';
    if (req.method === 'POST') {
      if (!origin) return new Response('Origin required', { status: 403, headers });
      if (!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded') || Number(req.headers.get('content-length') || 0) > 8192) {
        return new Response('Invalid request', { status: 400, headers });
      }
      const body = await req.text();
      if (body.length > 8192) return new Response('Invalid request', { status: 400, headers });
      bearer = 'Bearer ' + (new URLSearchParams(body).get('access_token') || '');
    }
    if (!/^Bearer \S+$/i.test(bearer)) return new Response('Sign in required', { status: 401, headers });
    let file;
    try {
      const user = await authenticate(bearer.slice(7));
      if (!user || user.is_anonymous || !user.email || !user.id) {
        return new Response('Sign in with an account', { status: 401, headers });
      }
      const product = new URL(req.url).searchParams.get('product');
      if (!Object.hasOwn(products, product)) return new Response('Unknown product', { status: 404, headers });
      const filename = products[product];
      file = await openFile(filename);
      if (!file.ok || !file.body) {
        await file.body?.cancel();
        return new Response('Download temporarily unavailable', { status: 503, headers });
      }
      // Server-verified identity only; failure to record blocks delivery.
      // This records transfer authorization, not proof the client saved every byte.
      await recordDownload({ user_id: user.id, email: user.email, product, filename,
        downloaded_at: new Date().toISOString() });
      headers['Content-Type'] = 'application/octet-stream';
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
      return new Response(file.body, { headers });
    } catch {
      await file?.body?.cancel().catch(() => {});
      return new Response('Download temporarily unavailable. Please try again.', { status: 503, headers });
    }
  };
}
