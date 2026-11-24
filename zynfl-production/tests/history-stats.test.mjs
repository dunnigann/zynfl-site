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
 assert.equal(prior.coverage[0].lastLineupWeek,11);
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

test('PF lists use the actual championship field and regular-season points',()=>{
 const all=forScope('all',[],snapshot);
 assert.deepEqual(all.missedTopPF.map(t=>[t.year,t.owner,t.pfRank,t.pf]),[[2025,'Daniel',6,147316],[2024,'Nick',6,150228]]);
 assert.deepEqual(all.qualifiedBottomPF.map(t=>[t.year,t.owner,t.pfRank,t.pf,t.seed]),[[2025,'Rick',7,145876,2],[2024,'Jack',7,148976,5]]);
 assert.deepEqual(forScope(2024,[],snapshot).missedTopPF.map(t=>t.owner),['Nick']);
 const season=load(2025);
 const g=season.games.find(g=>g.week===17&&g.aOwner==='Leo');
 g.aScore=10000;
 assert.deepEqual(summarize(season).missedTopPF,snapshot[2025].missedTopPF,'playoff points do not enter the PF rankings');
 const before={...season,league:{...season.league,finished:false,currentWeek:14}};
 assert.equal(summarize(before).coverage[0].fieldReady,false,'do not guess the field while the regular season is still open');
 const playoffs={...before,league:{...before.league,currentWeek:15},games:season.games.filter(g=>g.week<=15)};
 assert.deepEqual(summarize(playoffs).qualifiedBottomPF,snapshot[2025].qualifiedBottomPF,'include Rick even though he has an opening playoff bye');
 const pending=structuredClone(playoffs);
 pending.games.find(g=>g.week===14).complete=false;
 assert.equal(summarize(pending).coverage[0].fieldReady,false,'do not rank partial regular-season scores');
});

test('accolades use the last playoff roster, stable player IDs and a 3/2/1 podium',()=>{
 const all=forScope('all',[],snapshot);
 assert.deepEqual(all.accolades.map(p=>[p.name,p.points]),[
  ['Bijan Robinson',5],['DJ Moore',5],['James Cook III',5],['Baker Mayfield',4],['Jahmyr Gibbs',4]
 ]);
 assert.deepEqual(all.accolades[0].finishes.map(f=>[f.year,f.owner,f.place]),[[2025,'Quinn',2],[2024,'Chuck',1]]);
 assert.deepEqual(forScope(2026,[],snapshot).accolades,[]);
 const fixture=load(2025);
 const [gold,silver,bronze]=[1,2,3].map(i=>fixture.teams.find(t=>t.rank===i));
 fixture.weeks[10].players.push({playerId:'early-only',name:'Earlier roster member',slot:'BN',owner:gold.owner,points:1});
 fixture.weeks[17].players.push(
  {playerId:'bench',name:'Verified bench player',slot:'BN',owner:silver.owner,points:0},
  {playerId:'ir',name:'Verified IR player',slot:'IR',owner:bronze.owner,points:0}
 );
 const {finishes,coverage}=summarize(fixture);
 assert.ok(coverage[0].podiumReady);
 assert(!finishes.some(f=>f.playerId==='early-only'));
 assert.equal(finishes.find(f=>f.playerId==='bench').place,2);
 assert.equal(finishes.find(f=>f.playerId==='ir').place,3);
 delete fixture.rosterFinal['17:'+bronze.id];
 assert.equal(summarize(fixture).coverage[0].podiumReady,false);
 assert.deepEqual(forScope(2025,[fixture],snapshot).accolades,forScope(2025,[],snapshot).accolades,'an unverified refresh keeps the archived podium roster');
});
