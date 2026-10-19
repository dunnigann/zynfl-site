import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {publishDueRankings} from '../src/yahoo-cache.mjs';
import * as Y from '../src/yahoo-data.mjs';
const model=globalThis.ZYNFL_OUTLOOK;
const season=JSON.parse(await fs.readFile(new URL('../public/data/yahoo/2026.json',import.meta.url),'utf8'));
const inputs=JSON.parse(await fs.readFile(new URL('../public/data/outlook-inputs.json',import.meta.url),'utf8'));

test('historical outlooks exclude later results, rosters and current injury labels',()=>{
 const a=model.build(season,2,inputs),copy=structuredClone(season);
 for(const g of copy.games)if(g.week>2){g.complete=true;g.aScore=999;g.bScore=-10;g.winner=g.bOwner;}
 for(const [week,data]of Object.entries(copy.weeks)){
  if(Number(week)>2)data.players=[];
  else for(const p of data.players)p.injury='IR';
 }
 assert.deepEqual(model.build(copy,2,inputs),a);
 assert.equal(new Set(a.order).size,12);
});

test('dated season-ending availability and banked wins both affect outlooks',()=>{
 const data=structuredClone(inputs);delete data.editorial;
 const before=model.build(season,2,data),injured=structuredClone(data);
 const jack=before.rows.find(r=>r.owner==='Jack'),star=jack.players.find(p=>p.name==='Jahmyr Gibbs');
 injured.availability=[{playerId:star.playerId,knownAfterWeek:2,remainingGames:0}];
 const after=model.build(season,2,injured).rows.find(r=>r.owner==='Jack');
 assert.ok(after.rosPoints<jack.rosPoints);
 assert.equal(after.players.find(p=>p.playerId===star.playerId).rosPoints,0);
 assert.deepEqual(model.build(season,1,injured),model.build(season,1,data));
 const changed=structuredClone(season);for(const g of changed.games.filter(g=>g.week<=2&&[g.aOwner,g.bOwner].includes('Jack')))g.winner=g.aOwner==='Jack'?g.bOwner:g.aOwner;
 const losing=model.build(changed,2,data).rows.find(r=>r.owner==='Jack');
 assert.equal(losing.rosPoints,jack.rosPoints);assert.ok(losing.score<jack.score);
});

test('Tuesday publication waits for final player data and freezes each published edition',()=>{
 const s=structuredClone(season),release=Date.parse(model.releaseAt(s,6));
 assert.equal(new Date(release).toISOString(),'2026-10-20T17:00:00.000Z');
 for(const g of s.games.filter(g=>g.week===6))g.complete=true;
 s.updatedAt=new Date(release).toISOString();s.lastError=null;
 publishDueRankings(s,inputs,release-1);assert.ok(s.powerRankings[5]);assert.equal(s.powerRankings[6],undefined);
 publishDueRankings(s,inputs,release);assert.equal(s.powerRankings[6],undefined);
 for(const t of s.teams)s.rosterFinal[`6:${t.id}`]=true;
 publishDueRankings(s,inputs,release);assert.equal(s.powerRankings[6].reconstructed,false);
 const frozen=structuredClone(s.powerRankings[6]);
 for(const p of s.weeks[6].players)p.points=999;
 publishDueRankings(s,inputs,release+3600000);assert.deepEqual(s.powerRankings[6],frozen);
});

test('each rebuilt edition has twelve distinct editorial entries and legal forecast lineups',()=>{
 for(let week=1;week<=5;week++){
  const edition=model.build(season,week,inputs);
  assert.equal(new Set(Object.values(edition.reasons)).size,12);
  assert.ok(edition.rows.every(r=>r.reason.length>200&&Number.isFinite(r.rosPoints)));
  for(const owner of season.teams.map(t=>t.owner)){
   const roster=season.weeks[week].players.filter(p=>p.owner===owner).map(p=>({...p,forecast:10}));
   const best=model.lineup(roster);assert.equal(best.players.length,9);assert.equal(new Set(best.players.map(p=>p.playerId)).size,9);
   assert.equal(best.players.filter(p=>p.position==='QB').length,1);
  }
 }
});

test('Yahoo win probability preserves exact zero and one and rejects missing values',()=>{
 const team=prob=>[[{team_id:'10'},{team_key:'470.l.800556.t.10'},{name:'Jack'}],prob===undefined?{}:{win_probability:prob}];
 assert.equal(Y.teamRecord(team(0),2026).winProbability,0);
 assert.equal(Y.teamRecord(team(1),2026).winProbability,1);
 assert.equal(Y.teamRecord(team(.37),2026).winProbability,.37);
 assert.equal(Y.teamRecord(team(undefined),2026).winProbability,null);
 assert.equal(Y.teamRecord(team(2),2026).winProbability,null);
});
