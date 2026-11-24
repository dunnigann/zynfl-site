import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import scenario from '../public/assets/js/playoff-scenarios.js';

const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/js/playoff-2026-snapshot.js',import.meta.url),'utf8'),ctx);
const season=JSON.parse(JSON.stringify(ctx.window.ZYNFL_PLAYOFF_SNAPSHOT));
const model=scenario.prepare(season);
const search=owner=>scenario.buildPaths(model,model.teams.find(x=>x.owner===owner).id);
const ids=n=>Array.from({length:n},(_,i)=>i+1);
const scores=(week,aId,bId,aScore,bScore)=>({week,aId,bId,aScore,bScore,complete:aScore!==undefined&&bScore!==undefined,
 winner:aScore===bScore?null:aScore>bScore?String(aId):String(bId),tied:aScore===bScore});
const fixture=(n,stop,games)=>({
 year:2026,league:{startWeek:1,currentWeek:stop},
 teams:ids(n).map(id=>({id,rank:id,name:'Team '+id,owner:String(id)})),
 settings:{playoffTeams:Math.floor(n/2),playoffStart:stop+1},games
});

test('Week 12 paths match an exhaustive win/loss enumeration for every seed and team',()=>{
 assert.equal(model.through,11);
 assert.equal(model.end,14);
 assert.equal(model.remaining.length,18);
 assert.equal(model.qualifiers,6);
 const expected=model.teams.map(()=>0),wins=new Int8Array(model.teams.length);
 for(let mask=0;mask<2**model.remaining.length;mask++){
  for(let i=0;i<wins.length;i++)wins[i]=model.teams[i].w;
  for(let i=0;i<model.remaining.length;i++){
   const {a,b}=model.remaining[i];wins[mask&(1<<i)?a:b]++;
  }
  for(let i=0;i<wins.length;i++){
   let earlier=0,equal=0;
   for(let j=0;j<wins.length;j++)if(i!==j){
    if(wins[j]>wins[i])earlier++;
    if(wins[j]===wins[i])equal++;
   }
   // Each team in this schedule plays distinct opponents, so it can gain
   // or lose an arbitrary points advantage independent of every record tie.
   for(let s=earlier;s<=earlier+equal;s++)expected[i]|=1<<s;
  }
 }
 for(const team of model.teams){
  const actual=search(team.owner).seeds.reduce((m,x)=>m|(1<<(x.seed-1)),0);
  assert.equal(actual,expected[team.i],team.owner);
 }
 const quinn=search('Quinn'),three=quinn.seeds.find(x=>x.seed===3).paths[0];
 assert.deepEqual(quinn.seeds.map(x=>x.seed),[3,4,5,6,7,8,9,10,11,12]);
 assert.deepEqual(three.own.map(g=>g.week),[12,13,14]);
 assert(three.own.every(g=>g.winner===2),'Quinn must win out on his No. 3 path');
 assert.equal(three.gate.extra,0);
 assert.equal(three.gate.rivals.find(r=>r.id===9).gap,-2668);
 assert.equal(search('Nick').eliminated,true);
 assert.equal(search('Jack').clinched,true);
});

test('each example leaves unlisted games free without changing its record or PF conditions',()=>{
 const quinn=search('Quinn'),target=model.teams.find(t=>t.owner==='Quinn');
 for(const seed of [3,6,9]){
  const path=quinn.seeds.find(x=>x.seed===seed).paths[0];
  const known=new Map([...path.own,...path.help].map(g=>[g.week+':'+g.a+':'+g.b,g.winner]));
  const original=model.teams.map(x=>x.units);
  function dfs(index,counts){
   if(index===model.remaining.length){
    const record=counts[target.i];
    const better=model.teams.filter(t=>counts[t.i]>record).length;
    const tied=model.teams.filter(t=>t.i!==target.i&&counts[t.i]===record).map(t=>t.id).sort();
    assert.deepEqual(tied,(path.points?.rivals||[]).map(t=>t.id).sort());
    assert.equal(seed,better+1+(path.points?.behind||0));
    return;
   }
   const g=model.remaining[index],a=model.teams[g.a].id,b=model.teams[g.b].id,id=g.week+':'+a+':'+b;
   for(const winner of known.has(id)?[known.get(id)]:[null,a,b]){
    const p=winner==null?1:winner===a?2:0;
    counts[g.a]+=p;counts[g.b]+=2-p;dfs(index+1,counts);counts[g.a]-=p;counts[g.b]-=2-p;
   }
  }
  dfs(0,original);
 }
});

test('a one-cent head-to-head win can clinch the last-week PF tiebreak',()=>{
 const s=fixture(2,2,[scores(1,1,2,100,100.01),scores(2,1,2)]);
 const m=scenario.prepare(s),result=scenario.buildPaths(m,1);
 assert.deepEqual(result.seeds.map(x=>[x.seed,x.paths.map(r=>r.finish)]),[[1,['1–0']],[2,['0–1']]]);
 const done=scenario.prepare({...s,games:[scores(1,1,2,100,100.01),scores(2,1,2,100.01,100)]});
 assert.deepEqual(done.order.map(x=>x.id),[1,2]);
 assert.deepEqual(scenario.buildPaths(done,1).seeds.map(x=>x.seed),[1]);
});

test('completed ties count as half a win and incomplete weeks do not leak live scores',()=>{
 const partial=fixture(4,2,[scores(1,1,2,80,80),scores(1,3,4,100,110),scores(2,1,4,140,60),scores(2,2,3)]);
 const m=scenario.prepare(partial);
 assert.equal(m.through,1);
 assert.deepEqual(m.teams.map(t=>[t.w,t.l,t.t,t.pf]),[[0,0,1,8000],[0,0,1,8000],[0,1,0,10000],[1,0,0,11000]]);
 assert.equal(m.remaining.length,2);
 assert.equal(scenario.prepare({...partial,games:partial.games.slice(0,-1)}),null);
});
