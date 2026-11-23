import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import historyStats from '../public/assets/js/history-stats.js';
const {summarize,forScope}=historyStats;

const load=year=>JSON.parse(readFileSync(new URL(`../public/data/yahoo/${year}.json`,import.meta.url)));
const {window}=runInNewContext(readFileSync(new URL('../public/assets/js/history-snapshot.js',import.meta.url),'utf8')+'\n;({window})',{window:{}});
const snapshot=JSON.parse(JSON.stringify(window.ZYNFL_HISTORY_SNAPSHOT));

test('archived Yahoo data reproduces 2024 and 2025 records and all weekly quirks',()=>{
 for(const year of [2024,2025])assert.deepEqual(summarize(load(year)),snapshot[year]);
 const all=forScope('all',[],snapshot);
 assert.deepEqual([all.top[0].name,all.top[0].points,all.top[0].year,all.top[0].week],['Josh Allen',5188,2024,14]);
 assert.deepEqual([all.bottom[0].points,all.bench[0].name,all.bench[0].points],[-400,'Bo Nix',3996]);
 assert.deepEqual([all.closest.winner,all.closest.loser,all.closest.margin],['Tina','Jack',58]);
 assert.deepEqual([all.blowout.winner,all.blowout.loser,all.blowout.margin],['Rick','Brock',10320]);
 assert.deepEqual(all.secondHigh.map(g=>[g.year,g.week,g.first.owner,g.second.owner]),[[2024,12,'Daniel','Tina'],[2025,8,'Brock','Chuck'],[2026,2,'Mitchell','Quinn']]);
 assert.deepEqual(all.secondLow.map(g=>[g.year,g.week,g.second.owner,g.first.owner]),[[2025,10,'Chuck','Nick'],[2025,12,'Rick','Brock'],[2026,7,'Nick','Mitchell'],[2026,10,'Quinn','Leo']]);
});

test('starter, bench and IR slots stay separate; playoff byes and partial weeks are not ranked',()=>{
 const fixture={
  year:2026,teams:[1,2,3,4,5,6].map(id=>({id})),rosterFinal:{},
  games:[],weeks:{}
 };
 function game(week,aId,bId,aScore,bScore,complete=true,playoffs=false){
  const aOwner='team '+aId,bOwner='team '+bId;
  fixture.games.push({week,aId,bId,aOwner,bOwner,aScore,bScore,complete,playoffs});
  for(const [id,owner] of [[aId,aOwner],[bId,bOwner]]){
   fixture.rosterFinal[week+':'+id]=true;
   const rows=(fixture.weeks[week]??={players:[]}).players;
   for(const [i,slot,points] of [[1,'QB',week===17?-3:20],[2,'BN',90],[3,'IR',99],[4,'',100]])rows.push({owner,slot,points,name:slot||'unknown slot',playerId:id+'-'+i});
  }
 }
 game(16,1,2,160,150,true,true);
 game(16,3,4,50,40,false,true);
 game(17,1,2,111.55,111.54,true,true);
 game(17,3,4,29,30,true,true);
 game(18,1,2,118,50,true,true);
 game(18,3,4,118,51,true,true);
 const stats=summarize(fixture);
 assert.deepEqual(stats.secondHigh.map(g=>g.week),[17]);
 assert.deepEqual(stats.secondLow.map(g=>g.week),[17]);
 assert.equal(stats.closest.margin,1);
 assert.equal(stats.bottom[0].points,-300);
 assert.ok(stats.top.every(x=>x.slot==='QB'&&x.week!==16));
 assert.ok(stats.bench.every(x=>x.slot==='BN'&&x.points===9000&&x.week!==16));
});

test('live extended coverage wins while older or partial snapshots cannot erase verified records',()=>{
 const stale=load(2026);
 const prior=forScope(2026,[stale],snapshot);
 assert.deepEqual(prior.top,snapshot[2026].top);
 assert.equal(prior.coverage[0].lastLineupWeek,10);
 const next=structuredClone(stale),g=next.games.find(g=>g.complete);
 g.aScore=500;
 const base={2026:summarize(stale)};
 assert.ok(forScope(2026,[next],base).blowout.margin>base[2026].blowout.margin);
 const partial=structuredClone(next);
 delete partial.rosterFinal[`${g.week}:${g.aId}`];
 const updated=forScope(2026,[partial],base);
 assert.deepEqual(updated.top,base[2026].top);
 assert.equal(updated.coverage[0].lineupWeeks,base[2026].coverage[0].lineupWeeks);
});
