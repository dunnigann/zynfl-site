/* Regular-season seeding for ZYNFL's balanced schedule. Half-wins and scores
   are integers so a tied game or a 0.01-point margin never rounds away. */
(function(root){
'use strict';
const cents=value=>Math.round(Number(value)*100);
const lastWeeks=3;
const one=(team,game)=>team===game.a?game.b:game.a;
const units=(team,game,result)=>team===game.a?result:2-result;

function prepare(season){
 if(!season?.teams?.length||!season.settings)return null;
 const start=Number(season.league?.startWeek||1),end=Number(season.settings.playoffStart)-1;
 const qualifiers=Number(season.settings.playoffTeams);
 const teams=season.teams.map((t,i)=>({i,id:Number(t.id),owner:t.owner,name:t.name,rank:Number(t.rank)||i+1,w:0,l:0,t:0,pf:0,recent:[]}));
 const ids=new Map(teams.map(t=>[t.id,t.i]));
 if(ids.size!==teams.length||teams.length>16||teams.length%2||!Number.isInteger(end)||end<start||!Number.isInteger(qualifiers)||qualifiers<1||qualifiers>teams.length)return null;
 const remaining=[],completed=[];
 let through=start-1;
 for(let week=start;week<=end;week++){
  const games=(season.games||[]).filter(g=>g.week===week&&!g.playoffs).map(g=>({...g,a:ids.get(Number(g.aId)),b:ids.get(Number(g.bId))}));
  if(games.length!==teams.length/2||games.some(g=>g.a==null||g.b==null)||new Set(games.flatMap(g=>[g.a,g.b])).size!==teams.length)return null;
  // Only advance the standings when the whole round is final. Otherwise all
  // teams start from the same last completed week and have the same games left.
  if(through===week-1&&games.every(g=>g.complete&&Number.isFinite(g.aScore)&&Number.isFinite(g.bScore))){
   through=week;
   for(const g of games){
    const a=teams[g.a],b=teams[g.b],ap=cents(g.aScore),bp=cents(g.bScore);
    a.pf+=ap;b.pf+=bp;a.recent.unshift(ap);b.recent.unshift(bp);
    if(g.tied||ap===bp){a.t++;b.t++;}else if(g.winner===a.owner||(!g.winner&&ap>bp)){a.w++;b.l++;}else{b.w++;a.l++;}
    completed.push(g);
   }
  }else remaining.push(...games.map(g=>({week,a:g.a,b:g.b})));
 }
 for(const t of teams)t.units=2*t.w+t.t;
 const order=teams.slice().sort((a,b)=>b.units-a.units||b.pf-a.pf||recentOrder(b,a));
 order.forEach((t,i)=>{t.standing=i+1;});
 const byes=2**Math.ceil(Math.log2(qualifiers))-qualifiers;
 const stamp=JSON.stringify([season.year,through,end,qualifiers,remaining,teams.map(t=>[t.id,t.owner,t.name,t.rank,t.units,t.pf,t.recent])]);
 return {year:season.year,teams,through,end,qualifiers,byes,remaining,completed,order,stamp,available:end-through<=lastWeeks};
}
function recentOrder(a,b){
 for(let i=0;i<a.recent.length;i++)if(a.recent[i]!==b.recent[i])return a.recent[i]-b.recent[i];
 return b.rank-a.rank||b.id-a.id;
}

function buildPaths(model,teamId){
 const {teams,remaining:games,qualifiers}=model,target=teams.findIndex(t=>t.id===Number(teamId));
 if(!model.available||target<0)return null;
 const n=teams.length,team=teams[target];
 const own=games.flatMap((g,i)=>[g.a,g.b].includes(target)?[i]:[]);
 const other=games.flatMap((g,i)=>own.includes(i)?[]:[i]);
 // A favorable result first gives readable examples without assuming those
 // results are more likely when calculating the exact set of attainable seeds.
 const choices=other.map(i=>teams[games[i].a].standing<teams[games[i].b].standing?[2,0,1]:[0,2,1]);
 const left=Array.from({length:other.length+1},()=>new Int8Array(n));
 for(let j=other.length-1;j>=0;j--){
  left[j].set(left[j+1]);left[j][games[other[j]].a]+=2;left[j][games[other[j]].b]+=2;
 }
 const result=new Int8Array(games.length);
 const bySeed=Array.from({length:n+1},()=>new Map());
 let allFound=0;
 const defaultEdge={ahead:true,behind:true,tieAheadOnly:false,tieBehindOnly:false};
 const clearMask=(lo,hi)=>(1<<hi)-(1<<(lo-1));
 const record=(w,l,t)=>`${w}–${l}${t?`–${t}`:''}`;

 function search(ties,onlyMissing){
  const selfOptions=ties?[2,0,1]:[2,0], localFound=new Map();
  function chooseOwn(j,w,l,t){
   if(j<own.length){
    const i=own[j],g=games[i];
    for(const x of selfOptions){result[i]=g.a===target?x:2-x;chooseOwn(j+1,w+(x===2),l+(x===0),t+(x===1));}
    return;
   }
   const finish=record(w,l,t),targetUnits=team.units+2*w+t;
   const route=own.map(i=>['L','T','W'][units(target,games[i],result[i])]).join('')||'final';
   const counts=Int16Array.from(teams,x=>x.units),edges=teams.map(()=>defaultEdge);
   for(const i of own){
    const g=games[i],x=result[i];counts[g.a]+=x;counts[g.b]+=2-x;
   }
   for(const rival of teams){
    const k=rival.i;
    if(k===target||!own.every(i=>one(target,games[i])===k))continue;
    // If these teams face only each other, their match margins also constrain
    // the season points tie. Everyone else has an independent scoring game.
    const values=own.map(i=>units(target,games[i],result[i]));
    const margin=values.filter(v=>v===2).length-values.filter(v=>v===0).length;
    const base=team.pf-rival.pf+margin;
    const min=values.includes(0)?-Infinity:base,max=values.includes(2)?Infinity:base;
    const newest=values.findLast(v=>v!==1),recent=newest==null?recentOrder(team,rival):newest-1;
    const exactTie=min<=0&&max>=0;
    edges[k]={ahead:max>0||(exactTie&&recent>0),behind:min<0||(exactTie&&recent<0),tieAheadOnly:max===0&&recent>0,tieBehindOnly:min===0&&recent<0};
   }
   const gate={locked:[],rivals:[]};
   for(const rival of teams){
    const k=rival.i;if(k===target)continue;
    const min=counts[k]-targetUnits,max=min+left[0][k],edge=edges[k];
    if(min>0||(min===0&&!edge.ahead)){gate.locked.push(rival.id);continue;}
    if(max<0||(max===0&&!edge.behind))continue;
    gate.rivals.push({id:rival.id,higher:max>0,lower:min<0,tied:min<=0&&max>=0,
     points:edge.behind&&edge.ahead,gap:team.pf-rival.pf,tieAheadOnly:edge.tieAheadOnly,tieBehindOnly:edge.tieBehindOnly,
     room:-min/2,open:left[0][k]/2});
   }
   const seen=new Set();
   function walk(j){
    let lo=1,hi=1,key=String.fromCharCode(j+32);
    for(let k=0;k<n;k++)if(k!==target){
     const v=counts[k]-targetUnits,max=v+left[j][k],edge=edges[k];
     if(v>0||(v===0&&!edge.ahead))lo++;
     if(max>0||(max===0&&edge.behind))hi++;
     key+=v>0?'a':max<0?'b':String.fromCharCode(v+48);
    }
    const mask=clearMask(lo,hi),found=onlyMissing?allFound:(localFound.get(route)||0);
    if((mask&~found)===0||seen.has(key))return;
    seen.add(key);
    if(j===other.length){
     const pathBase=describePath(counts,targetUnits,edges,w,l,t,lo,hi);
     for(let seed=lo;seed<=hi;seed++){
      if(found&(1<<(seed-1)))continue;
      const points=pathBase.points.length?{ahead:hi-seed,behind:seed-lo,rivals:pathBase.points}:null;
      bySeed[seed].set(route,{...pathBase,route,points,gate:{...gate,extra:seed-1-gate.locked.length}});
     }
     localFound.set(route,(localFound.get(route)||0)|mask);allFound|=mask;
     return;
    }
    const i=other[j],g=games[i];
    const irrelevant=k=>counts[k]>targetUnits||counts[k]+left[j][k]<targetUnits;
    const order=choices[j],len=irrelevant(g.a)&&irrelevant(g.b)?1:ties?3:2;
    for(let x=0;x<len;x++){
     const value=order[x];result[i]=value;counts[g.a]+=value;counts[g.b]+=2-value;
     walk(j+1);counts[g.a]-=value;counts[g.b]-=2-value;
    }
   }
   walk(0);
  }
  chooseOwn(0,0,0,0);
 }

 function describePath(final,targetUnits,edges,w,l,t,lo,hi){
  const min=Int16Array.from(final),max=Int16Array.from(final),kept=new Set(other);
  const same=k=>Math.sign(min[k]-targetUnits)===Math.sign(final[k]-targetUnits)&&Math.sign(max[k]-targetUnits)===Math.sign(final[k]-targetUnits);
  // Drop outcomes when all possible results of that game would leave the same
  // record groups, including exact record ties. Unlisted games may go either way.
  for(const i of other.slice().reverse()){
   const {a,b}=games[i],x=result[i];
   min[a]-=x;max[a]+=2-x;min[b]-=2-x;max[b]+=x;
   if(same(a)&&same(b))kept.delete(i);else{min[a]+=x;max[a]-=2-x;min[b]+=2-x;max[b]-=x;}
  }
  const outcome=i=>{const g=games[i],x=result[i];return {week:g.week,a:teams[g.a].id,b:teams[g.b].id,winner:x===1?null:teams[x===2?g.a:g.b].id};};
  const points=teams.filter(k=>k.i!==target&&final[k.i]===targetUnits&&edges[k.i].ahead&&edges[k.i].behind).map(k=>({
   id:k.id,gap:team.pf-k.pf,tieAheadOnly:edges[k.i].tieAheadOnly,tieBehindOnly:edges[k.i].tieBehindOnly
  })).sort((a,b)=>a.gap-b.gap);
  return {finish:record(w,l,t),record:record(team.w+w,team.l+l,team.t+t),own:own.map(outcome),help:[...kept].map(outcome),points,
   guaranteed:lo===hi};
 }

 search(false,false);
 // Consider exact fantasy-score ties too, without burying normal routes in
 // examples that need a drawn game. Only use one if it adds a new seed.
 search(true,true);
 const seeds=bySeed.flatMap((paths,seed)=>paths.size?[{seed,paths:[...paths.values()].sort((a,b)=>
  Number(b.guaranteed)-Number(a.guaranteed)||a.help.length-b.help.length||a.finish.localeCompare(b.finish,undefined,{numeric:true})
 )}]:[]);
 return {seeds,eliminated:!seeds.some(x=>x.seed<=qualifiers),clinched:seeds.length>0&&seeds.every(x=>x.seed<=qualifiers)};
}

const api={prepare,buildPaths};
if(typeof module==='object'&&module.exports)module.exports=api;
else if(typeof document!=='undefined')root.ZYNFL_PLAYOFF_SCENARIOS=api;
else root.onmessage=({data:{model,teamId,request}})=>{
 try{root.postMessage({request,paths:buildPaths(model,teamId)});}
 catch{root.postMessage({request,error:'Seed scenarios could not be calculated.'});}
};
})(globalThis);
