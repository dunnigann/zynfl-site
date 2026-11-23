/* Yahoo lineup and matchup records for the League History pages. */
(function(root){
'use strict';
const compare=(a,b)=>a.year-b.year||a.week-b.week;
const score=value=>Math.round(value*100);
const gameOrder=(a,b)=>compare(a,b)||a.aOwner.localeCompare(b.aOwner)||a.bOwner.localeCompare(b.bOwner);
const playerOrder=(a,b)=>compare(a,b)||a.owner.localeCompare(b.owner)||a.name.localeCompare(b.name)||a.playerId.localeCompare(b.playerId);
const rankPlayers=(rows,low=false)=>rows.slice().sort((a,b)=>(low?1:-1)*(a.points-b.points)||playerOrder(a,b)).slice(0,10);
const starterSlots=new Set(['QB','RB','WR','TE','K','DEF','FLEX','SUPERFLEX','W/R/T','Q/W/R/T','W/R','W/T','R/T','UTIL']);
const cache=new WeakMap();

function summarize(season){
 const {year}=season, gamesByWeek=new Map();
 for(const g of season.games){
  if(!gamesByWeek.has(g.week))gamesByWeek.set(g.week,[]);
  gamesByWeek.get(g.week).push(g);
 }
 const starters=[],bench=[],secondHigh=[],secondLow=[],margins=[],lineupGaps=[];
 let matchupWeeks=0,lineupWeeks=0,lastMatchWeek=0,lastLineupWeek=0;
 for(const [week,scheduled] of gamesByWeek){
  const final=scheduled.filter(g=>g.complete&&Number.isFinite(g.aScore)&&Number.isFinite(g.bScore));
  for(const g of final){
   const aScore=score(g.aScore),bScore=score(g.bScore);
   if(aScore===bScore)continue;
   const aWins=aScore>bScore;
   margins.push({year,week,aOwner:g.aOwner,bOwner:g.bOwner,winner:aWins?g.aOwner:g.bOwner,loser:aWins?g.bOwner:g.aOwner,winnerScore:Math.max(aScore,bScore),loserScore:Math.min(aScore,bScore),margin:Math.abs(aScore-bScore),playoffs:!!g.playoffs});
  }
  if(!final.length||final.length!==scheduled.length)continue;
  const participants=final.flatMap(g=>[{owner:g.aOwner,points:score(g.aScore),opponent:g.bOwner},{owner:g.bOwner,points:score(g.bScore),opponent:g.aOwner}]);
  if(new Set(participants.map(p=>p.owner)).size!==participants.length)continue;
  // A playoff bye does not count as a score.
  if(final.every(g=>!g.playoffs)&&season.teams?.length&&participants.length!==season.teams.length)continue;
  matchupWeeks++;lastMatchWeek=Math.max(lastMatchWeek,week);
  for(const [dest,dir] of [[secondHigh,-1],[secondLow,1]]){
   const ranked=participants.slice().sort((a,b)=>dir*(a.points-b.points)||a.owner.localeCompare(b.owner));
   const first=ranked[0],second=ranked[1];
   // Competition ranking: a tie for first means nobody is ranked second.
   if(!second||first.points===second.points)continue;
   const opponent=ranked.find(p=>p.owner===first.opponent);
   if(opponent?.points===second.points)dest.push({year,week,first,second:opponent,playoffs:final.some(g=>g.playoffs)});
  }

  const byOwner=new Map(participants.map(p=>[p.owner,[]]));
  for(const p of season.weeks?.[week]?.players||[])byOwner.get(p.owner)?.push(p);
  const verified=final.every(g=>[[g.aId,g.aOwner],[g.bId,g.bOwner]].every(([id,owner])=>{
   const rows=byOwner.get(owner);
   return rows.length>0&&(season.rosterFinal?.[week+':'+id]||rows.every(p=>p.source==='published-snapshot'))&&rows.every(p=>Number.isFinite(p.points));
  }));
  if(!verified){lineupGaps.push(week);continue;}
  lineupWeeks++;lastLineupWeek=Math.max(lastLineupWeek,week);
  for(const rows of byOwner.values()){
   const seen=new Set();
   for(const p of rows){
    const slot=String(p.slot||'').toUpperCase();
    if(seen.has(p.playerId)||!p.name||(!starterSlots.has(slot)&&slot!=='BN'))continue;
    seen.add(p.playerId);
    (slot==='BN'?bench:starters).push({year,week,owner:p.owner,name:p.name,position:p.position,slot,playerId:String(p.playerId),points:score(p.points)});
   }
  }
 }
 return {year,top:rankPlayers(starters),bottom:rankPlayers(starters,true),bench:rankPlayers(bench),secondHigh:secondHigh.sort(compare),secondLow:secondLow.sort(compare),closest:margins.slice().sort((a,b)=>a.margin-b.margin||gameOrder(a,b))[0]||null,blowout:margins.slice().sort((a,b)=>b.margin-a.margin||gameOrder(a,b))[0]||null,coverage:[{year,matchupWeeks,lineupWeeks,lastMatchWeek,lastLineupWeek,lineupGaps:lineupGaps.sort((a,b)=>a-b)}]};
}

function combine(summaries){
 const rows=key=>summaries.flatMap(s=>s[key]);
 const margins=key=>summaries.map(s=>s[key]).filter(Boolean);
 return {top:rankPlayers(rows('top')),bottom:rankPlayers(rows('bottom'),true),bench:rankPlayers(rows('bench')),secondHigh:rows('secondHigh').sort(compare),secondLow:rows('secondLow').sort(compare),closest:margins('closest').sort((a,b)=>a.margin-b.margin||gameOrder(a,b))[0]||null,blowout:margins('blowout').sort((a,b)=>b.margin-a.margin||gameOrder(a,b))[0]||null,coverage:rows('coverage').sort((a,b)=>b.year-a.year)};
}

function forScope(scope,live=root.ZYNFL_YAHOO_SEASONS,fallback=root.ZYNFL_HISTORY_SNAPSHOT){
 const years=new Map(Object.entries(fallback||{}).map(([year,row])=>[Number(year),row]));
 for(const season of live||[]){
  if(!season.weeks||!Array.isArray(season.games))continue;
  if(!cache.has(season))cache.set(season,summarize(season));
  const stats=cache.get(season),current=stats.coverage[0],saved=years.get(season.year)?.coverage[0];
  if(!saved||current.matchupWeeks>=saved.matchupWeeks){
   const prior=years.get(season.year);
   // Keep the richer archive if a temporary sync has scores but missing lineups.
   years.set(season.year,prior&&current.lineupWeeks<saved.lineupWeeks?{
    ...stats,top:prior.top,bottom:prior.bottom,bench:prior.bench,
    coverage:[{...current,lineupWeeks:saved.lineupWeeks,lastLineupWeek:saved.lastLineupWeek,lineupGaps:[...new Set([...saved.lineupGaps,...current.lineupGaps.filter(w=>w>saved.lastLineupWeek)])]}]
   }:stats);
  }
 }
 return combine(scope==='all'?[...years.values()]:[years.get(Number(scope))].filter(Boolean));
}

const api={summarize,combine,forScope};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.ZYNFL_HISTORY_STATS=api;
})(typeof window==='undefined'?globalThis:window);
