import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as Y from '../src/yahoo-data.mjs';
import {coverage,SeasonCache} from '../src/yahoo-cache.mjs';
import {DatabaseSync} from 'node:sqlite';
await import('../public/assets/js/yahoo-model.js');
const model=globalThis.ZYNFL_YAHOO_MODEL;
const scripts=['zynfl-data.js','adp-2026.js','media.js','season-2026-data.js','week-5-2026.js','snapshot-corrections.js','season-sync.js','archive-audit.js','season-2026-leaders.js','transactions-2026-data.js','transaction-sync.js'];
const context=vm.createContext({window:{},console});
for(const name of scripts)vm.runInContext(await fs.readFile(new URL(`../public/assets/js/${name}`,import.meta.url),'utf8'),context);
const base=JSON.parse(JSON.stringify(context.window));
const seasons=await Promise.all([2024,2025,2026].map(async y=>JSON.parse(await fs.readFile(new URL(`../public/data/yahoo/${y}.json`,import.meta.url),'utf8'))));

test('source normalization preserves negative scores, positions, and stable Yahoo identity',()=>{
 const p=Y.playerRecord([[{player_id:'123'},{player_key:'470.p.123'},{name:{full:'<Test> Player'}},{primary_position:'RB'},{eligible_positions:[{position:'RB'},{position:'W/R/T'}]}],{selected_position:[{position:'W/R/T'}]},{player_points:{total:'-1.5'}}],2026,6,'Jack');
 assert.equal(p.points,-1.5);assert.equal(p.slot,'FLEX');assert.equal(p.name,'Test Player');assert.equal(p.playerId,'123');assert.equal(p.projection,null);
 assert.throws(()=>Y.ownerFor(2026,'470.l.1.t.99'),/unknown_yahoo_team/);
});

test('legal optimizer fills the league slots, excludes IR, retains negative scores, and never duplicates flex',()=>{
 const roster=[['QB',-2],['RB',5],['RB',4],['WR',3],['WR',2],['TE',1],['RB',6],['K',-1],['DEF',-3],['QB',100,'IR']].map(([position,points,slot],i)=>({id:String(i),position,points,slot:slot||'BN'}));
 const best=model.optimal(roster);assert.equal(best.ids.length,9);assert.equal(new Set(best.ids).size,9);assert.equal(best.score,15);assert.ok(!best.ids.includes('9'));
});

test('full rebuild is idempotent, uses official placements, and excludes future games from stats',()=>{
 const a=model.build(base,seasons),b=model.build(base,seasons);assert.deepEqual(a,b);
 assert.equal(a.ZYNFL_DATA.matchups.length,seasons.flatMap(s=>s.games.filter(g=>g.complete)).length);
 assert.equal(a.ZYNFL_DATA.finalPlacements[2024].Calvin,12);assert.equal(a.ZYNFL_DATA.finalPlacements[2025].Tina,11);assert.equal(a.ZYNFL_DATA.finalPlacements[2025].Isaac,12);
 assert.ok(a.ZYNFL_DATA.matchups.every(g=>g.complete));
 const starts=a.ZYNFL_DATA.players.reduce((n,p)=>n+p.starts,0);assert.ok(starts<=a.ZYNFL_DATA.matchups.length*18);
 const all=a.ZYNFL_DATA.awards.all;
 for(const group of ['custom','position'])for(const award of all[group])assert.ok(a.ZYNFL_DATA.awards[award.year][group].some(x=>(x.key||x.title)===(award.key||award.title)&&x.value===award.value&&x.owner===award.owner));
});

test('a current lineup change changes ownership and displayed slot without adding career starts',()=>{
 const changed=structuredClone(seasons),s=changed.find(s=>s.year===2026),week=s.league.currentWeek;
 const before=model.build(base,seasons),p=s.weeks[week].players.find(p=>p.owner==='Jack');p.slot=p.slot==='BN'?'FLEX':'BN';
 const after=model.build(base,changed);assert.equal(after.ZYNFL_LATEST_ROSTER.find(x=>x.playerId===p.playerId).slot,p.slot);
 assert.deepEqual(after.ZYNFL_DATA.players.map(p=>[p.playerId,p.starts,p.starterPoints]),before.ZYNFL_DATA.players.map(p=>[p.playerId,p.starts,p.starterPoints]));
});

test('cache persists large histories atomically and reloads across object restarts',async()=>{
 const db=new DatabaseSync(':memory:'),values=new Map([['yahooBlockedUntil',Date.now()+600000]]),pending=[];
 const ctx={storage:{get:async k=>values.get(k),put:async(k,v)=>values.set(k,v),sql:{exec:(query,...args)=>{const rows=db.prepare(query).all(...args);return {toArray:()=>rows};}},transactionSync:fn=>{db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},waitUntil:p=>pending.push(p)};
 const connection={ctx,env:{ASSETS:{fetch:async request=>new Response(await fs.readFile(new URL('../public'+new URL(request.url).pathname,import.meta.url),'utf8'))}}};
 const cache=new SeasonCache(connection),s=await cache.load(2024);assert.equal(s.games.length,98);assert.deepEqual(coverage(s),s.coverage);
 const restored=await new SeasonCache(connection).load(2024);assert.deepEqual(restored,s);db.close();
});

test('playoff forecasts are reproducible and allocate exactly six places and two byes',()=>{
 const s=seasons.find(s=>s.year===2026),a=model.forecast(s,1000),b=model.forecast(s,1000);assert.deepEqual(a,b);
 assert.ok(Math.abs(a.reduce((n,t)=>n+t.playoff,0)-6)<1e-9);assert.ok(Math.abs(a.reduce((n,t)=>n+t.bye,0)-2)<1e-9);
});

test('a just-finished week waits for all final rosters before adding career starts',()=>{
 const copy=structuredClone(seasons),s=copy.find(s=>s.year===2026),week=s.league.currentWeek;
 for(const g of s.games.filter(g=>g.week===week))g.complete=true;
 s.rosterFinal[`${week}:1`]=true;
 const before=model.build(base,seasons),partial=model.build(base,copy),count=m=>m.ZYNFL_DATA.players.reduce((n,p)=>n+p.starts,0);
 assert.equal(count(partial),count(before));
 for(const t of s.teams)s.rosterFinal[`${week}:${t.id}`]=true;
 assert.ok(count(model.build(base,copy))>count(before));
});
