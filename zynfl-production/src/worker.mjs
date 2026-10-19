import { DurableObject } from 'cloudflare:workers';
import { SeasonCache } from './yahoo-cache.mjs';

const ORIGIN = 'https://zynfl.com';
const CALLBACK = `${ORIGIN}/auth/yahoo/callback`;
const API = 'https://fantasysports.yahooapis.com/fantasy/v2/';
const YEARS = [2024, 2025, 2026];
const encoder = new TextEncoder();
const nonce = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const cookie = (name, value, age = 600) => `${name}=${value}; Max-Age=${age}; Path=/; HttpOnly; Secure; SameSite=Lax`;
const cookieValue = (request, name) => (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1) || '';

export async function sameSecret(a, b) {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', encoder.encode(s))));
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}

async function boundedJSON(response, limit = 5_000_000) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('empty_response');
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error('response_too_large');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error('invalid_yahoo_response'); }
}

function objects(root, name, out = []) {
  if (!root || typeof root !== 'object') return out;
  for (const [key, value] of Object.entries(root)) {
    if (key === name) out.push(value);
    objects(value, name, out);
  }
  return out;
}

export function leagueMetadata(payload, year) {
  return objects(payload, 'league').map(value => {
    const data = Array.isArray(value) ? Object.assign({}, ...value.filter(x => x && typeof x === 'object' && !Array.isArray(x))) : value;
    return { year: Number(data.season || year), key: data.league_key, id: String(data.league_id || ''), name: data.name, url: data.url };
  }).filter(x => /^\d+\.l\.\d+$/.test(x.key || ''));
}

async function tokenRequest(env, fields) {
  if (!env.YAHOO_CLIENT_ID || !env.YAHOO_CLIENT_SECRET) throw new Error('credentials_missing');
  const response = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
    method: 'POST', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${btoa(`${env.YAHOO_CLIENT_ID}:${env.YAHOO_CLIENT_SECRET}`)}` },
    body: new URLSearchParams({ redirect_uri: CALLBACK, ...fields })
  });
  const data = await boundedJSON(response, 100_000);
  if (!response.ok || !data.access_token) throw new Error(`yahoo_token_${response.status}`);
  return data;
}

export class YahooConnection extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.tail = Promise.resolve();
    this.readTail = Promise.resolve();
    this.lastRead = 0;
    this.cache = null;
  }

  // A single OAuth connection is the coordination unit. Refreshes and nonce
  // consumption are serialized so concurrent visitors cannot rotate old tokens.
  async exclusive(work) {
    const result = this.tail.then(work);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async status() {
    const token = await this.ctx.storage.get('tokens');
    const leagues = await this.ctx.storage.get('leagues') || [];
    return { connected: !!token?.refresh_token, connectedAt: token?.connected_at || null, leagues };
  }

  async begin() {
    return this.exclusive(async () => {
      const state = nonce(), browser = nonce();
      const pending = await this.ctx.storage.get('pending') || {};
      const now = Date.now();
      for (const key of Object.keys(pending)) if (pending[key].expires < now) delete pending[key];
      if (Object.keys(pending).length >= 5) throw new Error('too_many_authorizations');
      pending[state] = { browser, expires: now + 600_000 };
      await this.ctx.storage.put('pending', pending);
      return { state, browser };
    });
  }

  async finish(state, browser, code) {
    return this.exclusive(async () => {
      const pending = await this.ctx.storage.get('pending') || {};
      const flow = pending[state];
      if (!flow || flow.expires < Date.now() || !await sameSecret(browser, flow.browser)) throw new Error('invalid_oauth_state');
      delete pending[state];
      await this.ctx.storage.put('pending', pending);
      const data = await tokenRequest(this.env, { grant_type: 'authorization_code', code });
      if (!data.refresh_token) throw new Error('refresh_token_missing');
      await this.ctx.storage.put('tokens', { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + Number(data.expires_in || 3600) * 1000, connected_at: new Date().toISOString() });
      await this.ctx.storage.delete('leagues');
      await this.ctx.storage.delete('selected');
      return { connected: true };
    });
  }

  async accessToken(force = false) {
    return this.exclusive(async () => {
      const old = await this.ctx.storage.get('tokens');
      if (!old?.refresh_token) throw new Error('yahoo_not_connected');
      if (!force && old.expires_at > Date.now() + 90_000) return old.access_token;
      const data = await tokenRequest(this.env, { grant_type: 'refresh_token', refresh_token: old.refresh_token });
      await this.ctx.storage.put('tokens', { ...old, access_token: data.access_token, refresh_token: data.refresh_token || old.refresh_token, expires_at: Date.now() + Number(data.expires_in || 3600) * 1000 });
      return data.access_token;
    });
  }

  async read(path) {
    const work = async () => {
      if (Number(await this.ctx.storage.get('yahooBlockedUntil') || 0) > Date.now()) throw new Error('yahoo_rate_limited');
      const delay = Math.max(0, 900 - (Date.now() - this.lastRead));
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      this.lastRead = Date.now();
      const send = async force => fetch(`${API}${path}?format=json`, {headers:{Authorization:`Bearer ${await this.accessToken(force)}`},signal:AbortSignal.timeout(20000)});
      let response = await send(false);
      if (response.status === 401) { await response.body?.cancel(); response = await send(true); }
      if (!response.ok) {
        await response.body?.cancel();
        if ([429,999].includes(response.status)) await this.ctx.storage.put('yahooBlockedUntil', Date.now()+60*60*1000);
        throw new Error(`yahoo_api_${response.status}`);
      }
      return boundedJSON(response);
    };
    const result=this.readTail.then(work);this.readTail=result.catch(()=>{});return result;
  }

  seasonCache(){return this.cache ||= new SeasonCache(this);}
  async publicSeason(year){return this.seasonCache().public(year);}
  async scheduledRefresh(){
    const cache=this.seasonCache();
    await cache.refresh(2026,{maintenance:true});
    // Historical data is resumable and gets a slow correction sweep afterward.
    const next=Number(await this.ctx.storage.get('archiveCursor')||0);
    await cache.refresh([2024,2025][next%2],{maintenance:true});
    await this.ctx.storage.put('archiveCursor',next+1);
  }

  async nflWeek(week){
    const cache=this.seasonCache(),key=`nfl:2026:${week}`,old=cache.read(key);
    if(old&&Date.now()-old.at<120000)return old.data;
    try{
      const response=await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${week}`,{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error('nfl_unavailable');
      const raw=await boundedJSON(response),alias=x=>({WSH:'WAS',JAC:'JAX'}[x]||x);
      const games=(raw.events||[]).flatMap(e=>{const c=e.competitions?.[0],teams=c?.competitors||[];if(teams.length!==2)return [];return [[alias(teams[0].team.abbreviation),alias(teams[1].team.abbreviation),Number(teams[0].score||0),Number(teams[1].score||0),e.status?.type?.completed?'FINAL':e.status?.type?.state==='in'?'LIVE':'UPCOMING',e.date]];});
      const data={games,updatedAt:new Date().toISOString(),source:'ESPN'};cache.write(key,{at:Date.now(),data});return data;
    }catch(error){if(old)return old.data;return {games:[],error:'nfl_unavailable'};}
  }

  async discover() {
    const leagues = [];
    for (const year of YEARS) {
      const payload = await this.read(`users;use_login=1/games;game_codes=nfl;seasons=${year}/leagues`);
      leagues.push(...leagueMetadata(payload, year));
    }
    const unique = [...new Map(leagues.map(x => [x.key, x])).values()];
    await this.ctx.storage.put('leagues', unique);
    const current = unique.find(x => x.year === 2026 && x.id === '800556');
    if (current) {
      const selected = { '2026': current.key };
      // Only unambiguous ZYNFL historical leagues are selected automatically.
      for (const year of [2024, 2025]) {
        const candidates = unique.filter(x => x.year === year && (/zynfl/i.test(x.name || '') || /uchicago_zynfl/i.test(x.url || '')));
        if (candidates.length === 1) selected[String(year)] = candidates[0].key;
      }
      await this.ctx.storage.put('selected', selected);
    }
    return { leagues: unique, selected: await this.ctx.storage.get('selected') || {} };
  }

  async diagnostics() {
    const access = await this.accessToken();
    const results = [];
    for (const path of ['games;game_codes=nfl;is_available=1', ...[2026, 2025, 2024].map(year => `users;use_login=1/games;game_codes=nfl;seasons=${year}/leagues`)]) {
      const response = await fetch(`${API}${path}?format=json`, { headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(20_000) });
      const data = await boundedJSON(response);
      const raw = data.error?.description || data.error?.detail || '';
      const description = typeof raw === 'string' ? raw.replaceAll(access, '[redacted]').slice(0, 2000) : '';
      results.push({ path, status: response.status, description, leagues: response.ok ? leagueMetadata(data, Number(path.match(/seasons=(\d+)/)?.[1])) : [] });
    }
    return results;
  }

  async leagueRead(year, resource, week) {
    const selected = await this.ctx.storage.get('selected') || {};
    const key = selected[String(year)];
    if (!key) throw new Error('league_not_selected');
    const resources = { metadata: '', settings: '/settings', standings: '/standings', teams: '/teams', transactions: '/transactions;start=0;count=100', draft: '/draftresults', scoreboard: `/scoreboard${week ? `;week=${week}` : ''}` };
    if (!(resource in resources)) throw new Error('invalid_resource');
    return this.read(`league/${key}${resources[resource]}`);
  }

  async sourceRead(year, kind, week, start = 0, position = 'ALL', keys = '') {
    const selected = await this.ctx.storage.get('selected') || {};
    const key = selected[String(year)];
    if (!key) throw new Error('league_not_selected');
    const resources = {
      rosters: `/teams/roster;week=${week}/players/stats;type=week;week=${week}`,
      schedule: '/teams/matchups',
      transactions: `/transactions;start=${start};count=100`,
      players: `/players;start=${start};count=25;sort=PTS${position === 'ALL' ? '' : `;position=${position}`}/stats`,
      metadata: '', settings: '/settings', standings: '/standings', draft: '/draftresults',
      scoreboard: `/scoreboard;week=${week}`
    };
    if (kind === 'player-week') {
      if (!keys || keys.split(',').length > 25 || !keys.split(',').every(k => new RegExp(`^${key.split('.')[0]}\\.p\\.\\d+$`).test(k))) throw new Error('invalid_resource');
      return this.read(`league/${key}/players;player_keys=${keys}/stats;type=week;week=${week}`);
    }
    if (kind === 'team-roster') {
      if (start < 1 || start > 12) throw new Error('invalid_resource');
      return this.read(`team/${key}.t.${start}/roster;week=${week}/players/stats;type=week;week=${week}`);
    }
    if (!(kind in resources)) throw new Error('invalid_resource');
    return this.read(`league/${key}${resources[kind]}`);
  }
}

function page(title, text, status = 200) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{background:#090e18;color:#edf3ff;font:18px/1.6 system-ui;max-width:640px;margin:12vh auto;padding:24px}h1{line-height:1.2}a{color:#a7caff}</style><h1>${title}</h1><p>${text}</p><p><a href="/">Back to ZYNFL</a></p></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" } });
}

export default {
  async scheduled(event,env,ctx){ctx.waitUntil(env.YAHOO_CONNECTION.getByName('zynfl-owner').scheduledRefresh());},
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const dynamic = url.pathname.startsWith('/auth/yahoo') || url.pathname.startsWith('/api/yahoo/');
    if (!dynamic) return env.ASSETS.fetch(request);
    if (url.origin !== ORIGIN) return json({ error: 'Use https://zynfl.com for Yahoo authorization.' }, 400);
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
    const connection = env.YAHOO_CONNECTION.getByName('zynfl-owner');
    try {
      if (url.pathname === '/api/yahoo/status') {
        const result = await connection.status();
        return json({ credentialsReady: !!(env.YAHOO_CLIENT_ID && env.YAHOO_CLIENT_SECRET), connected: result.connected, connectedAt: result.connectedAt });
      }
      if (url.pathname === '/auth/yahoo/callback') {
        if (url.searchParams.has('error')) return page('Yahoo access was not approved', 'Open the connection link again when you are ready.', 400);
        const code = url.searchParams.get('code'), state = url.searchParams.get('state');
        if (!code || !state) return page('Invalid Yahoo callback', 'Open the connection link again.', 400);
        await connection.finish(state, cookieValue(request, '__Host-yahoo-flow'), code);
        // League discovery is independently retryable if Yahoo times out.
        ctx.waitUntil(connection.discover().catch(() => console.warn(JSON.stringify({ event: 'yahoo_discovery_retry_required' }))));
        const response = page('Yahoo is connected', 'Your Yahoo connection is saved securely. The site will refresh automatically.');
        response.headers.set('Set-Cookie', cookie('__Host-yahoo-flow', '', 0));
        return response;
      }
      if(url.pathname==='/api/yahoo/nfl'){const week=Number(url.searchParams.get('week'));if(!Number.isInteger(week)||week<1||week>18)return json({error:'invalid_week'},400);return json(await connection.nflWeek(week));}
      const publicMatch=url.pathname.match(/^\/api\/yahoo\/season\/(2024|2025|2026)$/);
      if(publicMatch)return json(await connection.publicSeason(Number(publicMatch[1])));
      const authorized = await sameSecret(url.searchParams.get('setup') || request.headers.get('X-ZYNFL-Setup'), env.YAHOO_SETUP_TOKEN);
      if (!authorized) return json({ error: 'owner_authorization_required' }, 403);
      if (url.pathname === '/auth/yahoo/start') {
        if (!env.YAHOO_CLIENT_ID || !env.YAHOO_CLIENT_SECRET) return page('Yahoo credentials are missing', 'Add YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET as runtime secrets.', 503);
        const { state, browser } = await connection.begin();
        const auth = new URL('https://api.login.yahoo.com/oauth2/request_auth');
        auth.search = new URLSearchParams({ client_id: env.YAHOO_CLIENT_ID, redirect_uri: CALLBACK, response_type: 'code', state }).toString();
        return new Response(null, { status: 302, headers: { Location: auth.toString(), 'Set-Cookie': cookie('__Host-yahoo-flow', browser), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
      }
      if (url.pathname === '/api/yahoo/refresh') { await connection.scheduledRefresh(); return json({ok:true}); }
      if (url.pathname === '/api/yahoo/discover') return json(await connection.discover());
      if (url.pathname === '/api/yahoo/diagnostics') return json(await connection.diagnostics());
      const source = url.pathname.match(/^\/api\/yahoo\/source\/(2024|2025|2026)\/(metadata|settings|standings|draft|scoreboard|rosters|schedule|transactions|players|player-week|team-roster)$/);
      if (source) {
        const week = Number(url.searchParams.get('week') || 1), start = Number(url.searchParams.get('start') || 0);
        const position = url.searchParams.get('position') || 'ALL';
        if (!Number.isInteger(week) || week < 1 || week > 18 || !Number.isInteger(start) || start < 0 || start > 10000 || !['ALL','QB','RB','WR','TE','K','DEF'].includes(position)) return json({ error: 'invalid_parameters' }, 400);
        return json(await connection.sourceRead(Number(source[1]), source[2], week, start, position, url.searchParams.get('keys') || ''));
      }
      const match = url.pathname.match(/^\/api\/yahoo\/league\/(2024|2025|2026)\/(metadata|settings|standings|teams|transactions|draft|scoreboard)$/);
      if (match) {
        const week = url.searchParams.get('week');
        if (week && !/^(?:[1-9]|1[0-8])$/.test(week)) return json({ error: 'invalid_week' }, 400);
        return json(await connection.leagueRead(Number(match[1]), match[2], week));
      }
      return json({ error: 'not_found' }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      const safe = /^(?:yahoo_(?:api|token)_\d{3}|yahoo_not_connected|yahoo_rate_limited|credentials_missing|invalid_oauth_state|league_not_selected|too_many_authorizations|refresh_token_missing)$/.test(message) ? message : 'yahoo_request_failed';
      console.warn(JSON.stringify({ event: 'yahoo_request_error', error: safe }));
      if (url.pathname.startsWith('/auth/')) return page('Yahoo connection could not finish', `Connection status: ${safe}. Tell your site assistant this message.`, 502);
      return json({ error: safe }, 502);
    }
  }
};
