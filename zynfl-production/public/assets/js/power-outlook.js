/* Week-specific outlooks. Past editions never read later scores or rosters. */
(function(root){
'use strict';
const POS=['QB','RB','WR','TE','K','DEF'];
const round=n=>Math.round(n*100)/100;
const sum=a=>a.reduce((n,x)=>n+x,0);
const key=n=>String(n).toLowerCase().replace(/[^a-z0-9]/g,'').replace(/(iii|jr|sr)$/,'');
const eligible=p=>!['IR','IR+'].includes(p.slot);
function releaseAt(season,week){
 const end=season.games.find(g=>g.week===week)?.end;if(!end)return null;
 const t=Date.parse(end+'T12:00:00Z')+86400000;
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',hourCycle:'h23'}).format(t));
 return new Date(t+(12-hour)*3600000).toISOString();
}
function lineup(pool){
 let best={points:0,players:[]};
 for(const flex of [null,...pool.filter(p=>['RB','WR','TE'].includes(p.position))]){
  const picks=flex?[flex]:[];
  for(const [pos,n]of [['QB',1],['RB',2],['WR',2],['TE',1],['K',1],['DEF',1]])picks.push(...pool.filter(p=>p!==flex&&p.position===pos).sort((a,b)=>b.forecast-a.forecast||a.playerId.localeCompare(b.playerId)).slice(0,n));
  const points=sum(picks.map(p=>p.forecast));
  if(picks.length>best.players.length||picks.length===best.players.length&&points>best.points)best={points,players:picks};
 }
 return best;
}
function prior(player,inputs){
 const p=inputs.priors?.[key(player.name)],r=p?.positionRank;
 if(!r)return {QB:15,RB:5.5,WR:6,TE:5,K:7.5,DEF:6.5}[player.position]||5;
 if(player.position==='QB')return Math.max(11,22-.3*(r-1));
 if(player.position==='RB')return 3+17*Math.exp(-.038*(r-1));
 if(player.position==='WR')return 3+16*Math.exp(-.026*(r-1));
 if(player.position==='TE')return 3+12*Math.exp(-.065*(r-1));
 return player.position==='K'?8:7;
}
function percentile(rows,value){const below=rows.filter(x=>x<value).length,equal=rows.filter(x=>x===value).length;return (below+(equal-1)/2)/(rows.length-1||1);}
function build(season,week,inputs={},options={}){
 const asOf=releaseAt(season,week),history=new Map(),games=season.games.filter(g=>g.complete&&!g.playoffs&&g.week<=week);
 for(const [w,data]of Object.entries(season.weeks))if(Number(w)<=week&&games.some(g=>g.week===Number(w))){
  for(const p of data.players||[]){if(!Number.isFinite(p.points)||['IR','IR+'].includes(p.slot)||p.byeWeek===Number(w))continue;
   const a=history.get(p.playerId)||[];if(!a.some(x=>x.week===Number(w)))a.push({week:Number(w),points:p.points});history.set(p.playerId,a);
  }
 }
 const sourceWeek=options.rosterWeek||week,rosters=season.weeks[sourceWeek]?.players||[];
 const remaining=season.games.filter(g=>!g.playoffs&&g.week>week),futureWeeks=[...new Set(remaining.map(g=>g.week))].sort((a,b)=>a-b);
 const reconstructed=options.reconstructed!==false;
 const rows=season.teams.map(t=>{
  const played=games.filter(g=>[g.aOwner,g.bOwner].includes(t.owner)),w=played.filter(g=>g.winner===t.owner).length,ties=played.filter(g=>!g.winner).length;
  const pf=sum(played.map(g=>g.aOwner===t.owner?g.aScore:g.bScore)),pa=sum(played.map(g=>g.aOwner===t.owner?g.bScore:g.aScore));
  const roster=rosters.filter(p=>p.owner===t.owner).map(p=>{
   const stats=(history.get(p.playerId)||[]).sort((a,b)=>a.week-b.week),values=stats.map(x=>x.points),n=values.length;
   const seasonMean=n?sum(values)/n:0,recent=values.slice(-3),recentMean=recent.length?sum(recent)/recent.length:0;
   const estimate=(4*prior(p,inputs)+n*(.55*seasonMean+.45*recentMean))/(4+n);
   const override=(inputs.availability||[]).filter(x=>(x.playerId===p.playerId||key(x.name)===key(p.name))&&x.knownAfterWeek<=week).sort((a,b)=>b.knownAfterWeek-a.knownAfterWeek)[0];
   const ir=['IR','IR+'].includes(p.slot),status=reconstructed?'':p.injury;
   const available=fw=>{
    if(override?.remainingGames===0)return false;
    if(override?.returnWeek&&fw<override.returnWeek)return false;
    if(ir&&fw<week+5)return false;
    if(['O','SUSP'].includes(status)&&fw===week+1)return false;
    return p.byeWeek!==fw;
   };
   return {...p,estimate:round(estimate),available,ir};
  });
  const weekly=futureWeeks.map(fw=>({week:fw,...lineup(roster.filter(p=>p.available(fw)).map(p=>({...p,forecast:p.estimate})))}));
  const healthy=lineup(roster.filter(eligible).map(p=>({...p,forecast:p.estimate})));
  const expected=weekly.length?sum(weekly.map(x=>x.points))/weekly.length:healthy.points;
  const position=Object.fromEntries(POS.map(pos=>[pos,sum(healthy.players.filter(p=>p.position===pos).map(p=>p.forecast))]));
  const medianWeeks=played.map(g=>{const scores=games.filter(x=>x.week===g.week).flatMap(x=>[x.aScore,x.bScore]).sort((a,b)=>a-b),score=g.aOwner===t.owner?g.aScore:g.bScore,median=(scores[5]+scores[6])/2;return {week:g.week,score,median,won:g.winner===t.owner,allPlay:scores.filter(x=>x<score).length/11};});
  const last=played.at(-1),score=last?(last.aOwner===t.owner?last.aScore:last.bScore):0;
  const lastPlayers=(season.weeks[week]?.players||[]).filter(p=>p.owner===t.owner&&eligible(p)&&p.slot!=='BN').sort((a,b)=>b.points-a.points);
  return {owner:t.owner,team:t.name,w,l:played.length-w-ties,t:ties,games:played.length,pf:round(pf),pa:round(pa),ppg:round(pf/(played.length||1)),rosPoints:round(sum(weekly.map(x=>x.points))),weeklyPoints:round(expected),position,medianWins:medianWeeks.filter(x=>x.score> x.median).length,belowMedianWins:medianWeeks.filter(x=>x.won&&x.score<x.median).length,aboveMedianLosses:medianWeeks.filter(x=>!x.won&&x.score>x.median).length,allPlayExpectedWins:round(sum(medianWeeks.map(x=>x.allPlay))),lastScore:score,lastOpponent:last?(last.aOwner===t.owner?last.bOwner:last.aOwner):null,lastWon:last?.winner===t.owner,top:lastPlayers[0]?{name:lastPlayers[0].name,points:lastPlayers[0].points}:null,anchors:healthy.players.sort((a,b)=>b.estimate-a.estimate).slice(0,3).map(p=>({name:p.name,position:p.position,weeklyPoints:p.estimate})),injured:roster.filter(p=>p.ir).map(p=>p.name),players:roster.map(p=>({playerId:p.playerId,name:p.name,position:p.position,slot:p.slot,weeklyPoints:p.estimate,rosPoints:round(futureWeeks.filter(p.available).length*p.estimate)})),projectedByWeek:Object.fromEntries(weekly.map(x=>[x.week,round(x.points)]))};
 });
 const strengths=rows.map(r=>r.weeklyPoints),records=rows.map(r=>(r.w+.5*r.t)/(r.games||1));
 for(const r of rows){
  r.rosterRank=1+rows.filter(x=>x.weeklyPoints>r.weeklyPoints).length;
  r.score=round(100*(.65*percentile(strengths,r.weeklyPoints)+.35*percentile(records,(r.w+.5*r.t)/(r.games||1))));
  r.expectedFinalWins=round(r.w+.5*r.t+sum(remaining.filter(g=>[g.aOwner,g.bOwner].includes(r.owner)).map(g=>{const opponent=rows.find(x=>x.owner===(g.aOwner===r.owner?g.bOwner:g.aOwner));return 1/(1+Math.exp(((opponent?.projectedByWeek[g.week]||0)-(r.projectedByWeek[g.week]||0))/18));})));
  r.positionRanks=Object.fromEntries(POS.map(p=>[p,1+rows.filter(x=>x.position[p]>r.position[p]).length]));
 }
 rows.sort((a,b)=>b.score-a.score||b.weeklyPoints-a.weeklyPoints||a.owner.localeCompare(b.owner));
 rows.forEach((r,i)=>{r.rank=i+1;r.reason=inputs.editorial?.[week]?.[r.owner]||writeup(r,week,rows);});
 return {version:1,week,asOf,publishedAt:options.capturedAt||null,reconstructed,rosterWeek:sourceWeek,method:'65% projected legal starting-lineup strength + 35% win percentage',projectionSource:'ZYNFL roster model',rows,order:rows.map(r=>r.owner),reasons:Object.fromEntries(rows.map(r=>[r.owner,r.reason]))};
}
function writeup(r,week,rows){
 const rec=`${r.w}–${r.l}${r.t?'–'+r.t:''}`,anchor=r.anchors[0],other=r.anchors[1];
 const strongest=POS.filter(p=>!['K','DEF'].includes(p)).sort((a,b)=>r.positionRanks[a]-r.positionRanks[b]||r.position[b]-r.position[a])[0];
 const names=r.anchors.filter(p=>p.position===strongest).map(p=>p.name);
 const ppRank=1+rows.filter(x=>x.ppg>r.ppg).length;
 let opening;
 if(r.w===r.games&&r.games>1)opening=`${rec} buys ${r.owner} room to absorb a bad week, and a roster forecast ranked ${r.rosterRank} keeps the postseason outlook ${r.rosterRank<=4?'strong':'ahead of the raw scoring profile'}.`;
 else if(r.w===0&&r.games>1)opening=`At ${rec}, ${r.owner} has already used up a lot of margin for error; even a roster forecast ranked ${r.rosterRank} has to turn into wins quickly.`;
 else if(r.belowMedianWins>=2)opening=`${r.owner} is ${rec}, with ${r.belowMedianWins} wins coming in below-median scoring weeks. Those wins count in the playoff race, but repeating them will require more than friendly matchups.`;
 else if(r.aboveMedianLosses>=2)opening=`The ${rec} record undersells ${r.owner}: ${r.aboveMedianLosses} losses came with an above-median score. A ${r.rosterRank<=6?'top-half':'lower-half'} roster forecast explains why the outlook ${r.rosterRank<=6?'still has some life':'remains cautious despite that bad luck'}.`;
 else if(r.rosterRank<r.rank)opening=`The roster has more upside than the ${rec} record suggests: ${r.owner} ranks ${r.rosterRank} in projected starting strength, but the wins already lost keep this edition at No. ${r.rank}.`;
 else if(r.rosterRank>r.rank)opening=`Banked wins are doing some work here. ${r.owner}'s ${rec} start offsets a roster forecast ranked ${r.rosterRank}, although the weekly scoring floor still needs attention.`;
 else if(r.lastWon)opening=`${r.owner} leaves Week ${week} with a ${r.lastScore.toFixed(2)}-point win over ${r.lastOpponent}, bringing the record to ${rec}. The roster's No. ${r.rosterRank} forecast supports this spot.`;
 else opening=`Week ${week}'s ${r.lastScore.toFixed(2)} points against ${r.lastOpponent} left ${r.owner} at ${rec}. A No. ${r.rosterRank} forecast for the remaining lineup puts the recovery in perspective.`;
 const position=names.length?`${names.join(' and ')} ${names.length>1?'give':'gives'} this team its clearest edge at ${strongest}, where the available starters rank ${r.positionRanks[strongest]}.`:`The ${strongest} slot is the relative strength, ranked ${r.positionRanks[strongest]} among these rosters.`;
 let close;
 if(r.injured.length)close=`${r.injured.slice(0,2).join(' and ')} ${r.injured.length===1?'occupies':'occupy'} IR ${r.injured.length===1?'space':'spots'}, so the ${r.weeklyPoints.toFixed(1)}-point weekly forecast gives healthy replacements real work to do.`;
 else if(r.top&&r.top.points>=25)close=`${r.top.name}'s ${r.top.points.toFixed(2)} last week shows the ceiling; the rest-of-season estimate is ${r.weeklyPoints.toFixed(1)} per week, rather than assuming that spike repeats.`;
 else if(ppRank>r.rosterRank+2)close=`Scoring so far ranks ${ppRank}, while the available roster ranks ${r.rosterRank}; ${anchor?.name||'the leading starter'}${other?' and '+other.name:''} ${other?'need':'needs'} to close that gap.`;
 else close=`The legal starting lineup projects to ${r.rosPoints.toFixed(1)} points over the remaining regular season, with ${r.expectedFinalWins.toFixed(1)} expected total wins after accounting for the remaining opponents.`;
 return `${opening} ${position} ${close}`;
}
root.ZYNFL_OUTLOOK={build,releaseAt,lineup};
})(typeof window!=='undefined'?window:globalThis);
