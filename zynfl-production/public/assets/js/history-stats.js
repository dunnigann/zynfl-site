/* Yahoo lineup, matchup and postseason records for the League History pages. */
(function(root){
'use strict';
const compare=(a,b)=>a.year-b.year||a.week-b.week;
const score=value=>Math.round(value*100);
const gameOrder=(a,b)=>compare(a,b)||a.aOwner.localeCompare(b.aOwner)||a.bOwner.localeCompare(b.bOwner);
const playerOrder=(a,b)=>compare(a,b)||a.owner.localeCompare(b.owner)||a.name.localeCompare(b.name)||a.playerId.localeCompare(b.playerId);
const rankPlayers=(rows,low=false)=>rows.slice().sort((a,b)=>(low?1:-1)*(a.points-b.points)||playerOrder(a,b)).slice(0,10);
const starterSlots=new Set(['QB','RB','WR','TE','K','DEF','FLEX','SUPERFLEX','W/R/T','Q/W/R/T','W/R','W/T','R/T','UTIL']);
const cache=new WeakMap();

function playoffScoring(season,gamesByWeek){
 const {year,league,settings,teams=[]}=season,none={fieldReady:false,missedTopPF:[],qualifiedBottomPF:[]};
 const start=Number(league?.startWeek),playoffStart=Number(settings?.playoffStart),cut=Number(settings?.playoffTeams);
 if(teams.length!==12||cut!==6||!Number.isInteger(start)||!Number.isInteger(playoffStart)||playoffStart<=start)return none;
 if(!league.finished&&!(Number(league.currentWeek)>=playoffStart))return none;
 const points=new Map(teams.map(t=>[t.id,[]]));
 if(points.size!==teams.length)return none;
 for(let week=start;week<playoffStart;week++){
  const games=gamesByWeek.get(week)||[],seen=new Set();
  for(const g of games){
   if(!g.complete||g.playoffs)return none;
   for(const [id,pf] of [[g.aId,g.aScore],[g.bId,g.bScore]]){
    if(!points.has(id)||seen.has(id)||!Number.isFinite(pf))return none;
    points.get(id).unshift(score(pf));seen.add(id);
   }
  }
  if(seen.size!==teams.length)return none;
 }
 // The opening championship round has byes. Use Yahoo's seeds for those
 // teams, with the bracket itself taking precedence once all six appear.
 const bracket=season.games.filter(g=>g.week>=playoffStart&&g.playoffs);
 if(!league.finished&&!bracket.length)return none;
 const participants=consolation=>new Set(bracket.filter(g=>Boolean(g.consolation)===consolation).flatMap(g=>[g.aId,g.bId]));
 const championship=participants(false),consolation=participants(true);
 if(championship.size>cut||[...championship].some(id=>!points.has(id)||consolation.has(id)))return none;
 const seeded=teams.filter(t=>Number.isInteger(t.seed)&&t.seed>=1&&t.seed<=cut);
 const seedsMatch=seeded.length===cut&&new Set(seeded.map(t=>t.seed)).size===cut&&
  [...championship].every(id=>seeded.some(t=>t.id===id))&&seeded.every(t=>!consolation.has(t.id));
 const qualifiers=championship.size===cut?championship:seedsMatch?new Set(seeded.map(t=>t.id)):null;
 if(!qualifiers)return none;
 function recentFirst(a,b){
  const recentA=points.get(a.id),recentB=points.get(b.id);
  for(let i=0;i<recentA.length;i++)if(recentA[i]!==recentB[i])return recentB[i]-recentA[i];
  return a.id-b.id;
 }
 const ranked=teams.map(t=>({...t,pf:points.get(t.id).reduce((total,pf)=>total+pf,0)}))
  .sort((a,b)=>b.pf-a.pf||recentFirst(a,b)).map((t,i)=>({
   id:t.id,year,owner:t.owner,team:t.name,pf:t.pf,pfRank:i+1,seed:seedsMatch&&qualifiers.has(t.id)?t.seed:null
  }));
 return {fieldReady:true,
  missedTopPF:ranked.slice(0,cut).filter(t=>!qualifiers.has(t.id)),
  qualifiedBottomPF:ranked.slice(cut).filter(t=>qualifiers.has(t.id))
 };
}

function podiumRosters(season,gamesByWeek){
 const {year,league,teams=[]}=season,none={podiumReady:false,finishes:[]};
 if(!league?.finished)return none;
 const week=Number(league.endWeek),podium=[1,2,3].map(place=>teams.filter(t=>t.rank===place));
 if(podium.some(m=>m.length!==1))return none;
 const [first,second,third]=podium.map(m=>m[0]);
 const final=(gamesByWeek.get(week)||[]).filter(g=>g.playoffs&&!g.consolation&&g.complete&&Number.isFinite(g.aScore)&&Number.isFinite(g.bScore));
 const played=(g,id)=>g.aId===id||g.bId===id;
 if(!final.some(g=>played(g,first.id)&&played(g,second.id))||!final.some(g=>played(g,third.id)))return none;
 const players=new Map();
 for(const [i,t] of [first,second,third].entries()){
  const roster=(season.weeks?.[week]?.players||[]).filter(p=>p.owner===t.owner);
  if(!roster.length||(!season.rosterFinal?.[week+':'+t.id]&&!roster.every(p=>p.source==='published-snapshot'))||
   roster.some(p=>p.playerId==null||String(p.playerId)===''||!p.name))return none;
  for(const p of roster){
   const playerId=String(p.playerId);
   if(!players.has(playerId))players.set(playerId,{playerId,name:p.name,position:p.position||'',year,owner:t.owner,place:i+1});
  }
 }
 return {podiumReady:true,finishes:[...players.values()]};
}

function rankAccolades(finishes){
 const players=new Map();
 for(const f of finishes){
  if(!players.has(f.playerId))players.set(f.playerId,{playerId:f.playerId,name:f.name,position:f.position,byYear:new Map()});
  const player=players.get(f.playerId),prior=player.byYear.get(f.year);
  if(!prior||f.place<prior.place)player.byYear.set(f.year,f);
 }
 const ranked=[...players.values()].map(({playerId,name,position,byYear})=>{
  const finishes=[...byYear.values()].sort((a,b)=>b.year-a.year);
  const medals=[1,2,3].map(p=>finishes.filter(f=>f.place===p).length);
  return {playerId,name,position,points:3*medals[0]+2*medals[1]+medals[2],medals,finishes};
 });
 return ranked.sort((a,b)=>b.points-a.points||b.medals[0]-a.medals[0]||b.medals[1]-a.medals[1]||
  b.medals[2]-a.medals[2]||a.name.localeCompare(b.name)||a.playerId.localeCompare(b.playerId)).slice(0,5);
}

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
 const {fieldReady,missedTopPF,qualifiedBottomPF}=playoffScoring(season,gamesByWeek);
 const {podiumReady,finishes}=podiumRosters(season,gamesByWeek);
 return {year,top:rankPlayers(starters),bottom:rankPlayers(starters,true),bench:rankPlayers(bench),secondHigh:secondHigh.sort(compare),secondLow:secondLow.sort(compare),closest:margins.slice().sort((a,b)=>a.margin-b.margin||gameOrder(a,b))[0]||null,blowout:margins.slice().sort((a,b)=>b.margin-a.margin||gameOrder(a,b))[0]||null,missedTopPF,qualifiedBottomPF,finishes,coverage:[{year,matchupWeeks,lineupWeeks,lastMatchWeek,lastLineupWeek,lineupGaps:lineupGaps.sort((a,b)=>a-b),fieldReady,podiumReady}]};
}

function combine(summaries){
 const rows=key=>summaries.flatMap(s=>s[key]||[]);
 const margins=key=>summaries.map(s=>s[key]).filter(Boolean);
 return {top:rankPlayers(rows('top')),bottom:rankPlayers(rows('bottom'),true),bench:rankPlayers(rows('bench')),secondHigh:rows('secondHigh').sort(compare),secondLow:rows('secondLow').sort(compare),closest:margins('closest').sort((a,b)=>a.margin-b.margin||gameOrder(a,b))[0]||null,blowout:margins('blowout').sort((a,b)=>b.margin-a.margin||gameOrder(a,b))[0]||null,missedTopPF:rows('missedTopPF').sort((a,b)=>b.year-a.year||a.pfRank-b.pfRank),qualifiedBottomPF:rows('qualifiedBottomPF').sort((a,b)=>b.year-a.year||a.pfRank-b.pfRank),accolades:rankAccolades(rows('finishes')),coverage:rows('coverage').sort((a,b)=>b.year-a.year)};
}

function forScope(scope,live=root.ZYNFL_YAHOO_SEASONS,fallback=root.ZYNFL_HISTORY_SNAPSHOT){
 const years=new Map(Object.entries(fallback||{}).map(([year,row])=>[Number(year),row]));
 for(const season of live||[]){
  if(!season.weeks||!Array.isArray(season.games))continue;
  if(!cache.has(season))cache.set(season,summarize(season));
  const stats=cache.get(season),current=stats.coverage[0],prior=years.get(season.year),saved=prior?.coverage[0];
  if(!saved){years.set(season.year,stats);continue;}
  const useLive=current.matchupWeeks>=saved.matchupWeeks,liveLineups=useLive&&current.lineupWeeks>=saved.lineupWeeks;
  const field=current.fieldReady?stats:prior,podium=current.podiumReady?stats:prior;
  // A partial Yahoo refresh must not erase verified lineups or podium rosters.
  const coverage={...(useLive?current:saved),fieldReady:field.coverage[0].fieldReady,podiumReady:podium.coverage[0].podiumReady};
  if(useLive&&!liveLineups)Object.assign(coverage,{lineupWeeks:saved.lineupWeeks,lastLineupWeek:saved.lastLineupWeek,
   lineupGaps:[...new Set([...saved.lineupGaps,...current.lineupGaps.filter(w=>w>saved.lastLineupWeek)])]});
  years.set(season.year,{...(useLive?stats:prior),top:liveLineups?stats.top:prior.top,bottom:liveLineups?stats.bottom:prior.bottom,
   bench:liveLineups?stats.bench:prior.bench,missedTopPF:field.missedTopPF,qualifiedBottomPF:field.qualifiedBottomPF,
   finishes:podium.finishes,coverage:[coverage]});
 }
 return combine(scope==='all'?[...years.values()]:[years.get(Number(scope))].filter(Boolean));
}

const api={summarize,combine,forScope};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.ZYNFL_HISTORY_STATS=api;
})(typeof window==='undefined'?globalThis:window);
