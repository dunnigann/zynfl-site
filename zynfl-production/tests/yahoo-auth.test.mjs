import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../src/worker.mjs', import.meta.url), 'utf8'))
  .replace("import { SeasonCache } from './yahoo-cache.mjs';", `import { SeasonCache } from '${new URL('../src/yahoo-cache.mjs', import.meta.url).href}';`)
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }');
const { default: worker, YahooConnection } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { get: async key => data.get(key), put: async (key, value) => data.set(key, value), delete: async key => data.delete(key) };
}

test('static pages pass through, private requests require the owner, and public status excludes tokens', async () => {
  const env = {
    ASSETS: { fetch: async () => new Response('current website') },
    YAHOO_CLIENT_ID: 'client', YAHOO_CLIENT_SECRET: 'secret', YAHOO_SETUP_TOKEN: 'owner-key',
    YAHOO_CONNECTION: { getByName: () => ({ status: async () => ({ connected: true, connectedAt: 'saved', leagues: ['private'] }) }) }
  };
  assert.equal(await (await worker.fetch(new Request('https://zynfl.com/'), env)).text(), 'current website');
  assert.equal((await worker.fetch(new Request('https://zynfl.com/api/yahoo/diagnostics'), env)).status, 403);
  const response = await worker.fetch(new Request('https://zynfl.com/api/yahoo/status'), env);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { credentialsReady: true, connected: true, connectedAt: 'saved' });
});

test('simultaneous requests refresh an expired saved connection once and retain the rotated token', async t => {
  const ctx = { storage: storage({ tokens: { refresh_token: 'old-refresh', access_token: 'old-access', expires_at: 0, connected_at: 'saved' } }) };
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.login.yahoo.com/oauth2/get_token');
    assert.equal(options.body.get('refresh_token'), 'old-refresh');
    calls++;
    return Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 });
  });
  const connection = new YahooConnection(ctx, { YAHOO_CLIENT_ID: 'client', YAHOO_CLIENT_SECRET: 'secret' });
  assert.deepEqual(await Promise.all([connection.accessToken(), connection.accessToken()]), ['new-access', 'new-access']);
  assert.equal(calls, 1);
  assert.equal((await ctx.storage.get('tokens')).refresh_token, 'new-refresh');
});

test('diagnostics report Yahoo rejection without leaking the access token', async t => {
  const connection = new YahooConnection({ storage: storage({ tokens: { refresh_token: 'refresh', access_token: 'test-access', expires_at: Date.now() + 600000 } }) }, {});
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { description: 'Denied test-access' } }, { status: 403 }));
  const result = await connection.diagnostics();
  assert.equal(result.length, 4);
  assert.ok(result.every(x => x.status === 403));
  assert.ok(!JSON.stringify(result).includes('test-access'));
});

test('authorization rejects a callback without the matching browser cookie', async () => {
  const connection = new YahooConnection({ storage: storage() }, {});
  const { state } = await connection.begin();
  await assert.rejects(connection.finish(state, 'wrong-browser', 'unused'), /invalid_oauth_state/);
});

test('Yahoo throttling pauses shared reads instead of retrying for every visitor',async t=>{
 const store=storage({tokens:{refresh_token:'refresh',access_token:'access',expires_at:Date.now()+600000}}),c=new YahooConnection({storage:store},{});let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return {status:999,ok:false,body:{cancel:async()=>{}}};});
 await assert.rejects(c.read('league/470.l.800556'),/yahoo_api_999/);
 await assert.rejects(c.read('league/470.l.800556'),/yahoo_rate_limited/);
 assert.equal(calls,1);assert.ok(await store.get('yahooBlockedUntil')>Date.now());
});
