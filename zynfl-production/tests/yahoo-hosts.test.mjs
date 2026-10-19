import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../src/worker.mjs', import.meta.url), 'utf8'))
  .replace("import { SeasonCache } from './yahoo-cache.mjs';", `import { SeasonCache } from '${new URL('../src/yahoo-cache.mjs', import.meta.url).href}';`)
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('both website addresses serve live public data while owner and OAuth routes retain their canonical origin', async () => {
  const calls = [];
  const connection = {
    status: async () => ({ connected: true, connectedAt: 'saved', refresh_token: 'private' }),
    publicSeason: async year => { calls.push(year); return { year, live: true }; },
    nflWeek: async week => ({ week, games: [] })
  };
  const env = {
    ASSETS: { fetch: async () => new Response('current website') },
    YAHOO_CLIENT_ID: 'client', YAHOO_CLIENT_SECRET: 'secret', YAHOO_SETUP_TOKEN: 'owner-key',
    YAHOO_CONNECTION: { getByName: name => { assert.equal(name, 'zynfl-owner'); return connection; } }
  };
  for (const origin of ['https://zynfl.com', 'https://www.zynfl.com']) {
    for (const year of [2024, 2025, 2026]) {
      const response = await worker.fetch(new Request(`${origin}/api/yahoo/season/${year}`), env);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { year, live: true });
    }
    assert.deepEqual(await (await worker.fetch(new Request(`${origin}/api/yahoo/nfl?week=6`), env)).json(), { week: 6, games: [] });
    const status = await (await worker.fetch(new Request(`${origin}/api/yahoo/status`), env)).json();
    assert.deepEqual(status, { credentialsReady: true, connected: true, connectedAt: 'saved' });
    assert.equal((await worker.fetch(new Request(`${origin}/api/yahoo/season/2026`, { method: 'POST' }), env)).status, 405);
  }
  assert.deepEqual(calls, [2024, 2025, 2026, 2024, 2025, 2026]);
  for (const path of ['/auth/yahoo/start?setup=owner-key', '/auth/yahoo/callback?code=unused&state=unused', '/api/yahoo/refresh?setup=owner-key', '/api/yahoo/diagnostics?setup=owner-key']) {
    assert.equal((await worker.fetch(new Request(`https://www.zynfl.com${path}`), env)).status, 400);
  }
  assert.equal((await worker.fetch(new Request('https://zynfl.com/api/yahoo/diagnostics'), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://unrelated.example/api/yahoo/season/2026'), env)).status, 400);
});

