import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/account-download/handler.mjs';
let opened = 0, records = [];
const dependencies = {
  authenticate: async token => token === 'valid' ? { id: 'account-1', email: 'test@example.com' } : null,
  openFile: async () => { opened++; return new Response('file'); },
  recordDownload: async record => { records.push(record); }
};
const request = (token, product = 'speakeasy') => new Request('https://example.com/?product=' + product, {
  headers: token ? { Authorization: 'Bearer ' + token } : {}
});
const handle = createHandler(dependencies);
assert.equal((await handle(request())).status, 401);
assert.equal((await handle(request('expired'))).status, 401);
assert.equal(opened, 0);
assert.equal((await handle(request('valid', '__proto__'))).status, 404);
assert.equal((await handle(request('valid', '../secret'))).status, 404);
const anonymous = createHandler({ ...dependencies, authenticate: async () => ({id:'anon',email:'x',is_anonymous:true}) });
assert.equal((await anonymous(request('valid'))).status, 401);
assert.equal(opened, 0);
const ok = await handle(request('valid'));
assert.equal(ok.status, 200); assert.equal(await ok.text(), 'file');
assert.equal(ok.headers.get('cache-control'), 'private, no-store');
assert.equal(ok.headers.get('location'), null);
assert.equal(records[0].user_id, 'account-1');
const failure = createHandler({...dependencies, recordDownload: async () => { throw Error('offline'); }});
assert.equal((await failure(request('valid'))).status, 503);
const missing = createHandler({...dependencies, openFile: async () => new Response('',{status:404})});
assert.equal((await missing(request('valid'))).status, 503);
console.log('Account-download checks passed: absent/expired/anonymous auth, path allowlist, audit failure, missing files and authenticated stream.');
