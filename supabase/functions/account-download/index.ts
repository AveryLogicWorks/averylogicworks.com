import { createHandler } from './handler.mjs';

const base = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminHeaders = { apikey: key, Authorization: `Bearer ${key}` };
Deno.serve(createHandler({
  async authenticate(token: string) {
    const response = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000)
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error('Authentication unavailable');
    return response.json();
  },
  openFile(filename: string) {
    return fetch(`${base}/storage/v1/object/authenticated/software-downloads/${encodeURIComponent(filename)}`, {
      headers: adminHeaders, redirect: 'error', signal: AbortSignal.timeout(120000)
    });
  },
  async recordDownload(record: Record<string, string>) {
    const response = await fetch(`${base}/rest/v1/downloads`, {
      method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(record), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Download audit unavailable');
    await response.body?.cancel();
  }
}));
