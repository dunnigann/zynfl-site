/* Shared, deterministic aggregation. Final fantasy games are the only inputs to
   career starts, points, records, trophies, and rivalry belts. */
(function(root){
'use strict';
const round=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const sum=(a,f=x=>x)=>round(a.reduce((n,x)=>n+Number(f(x)||0),0));
const starter=p=>!['BN','IR','IR+'].includes(p.slot);
const record=x=>`${x.w}-${x.l}${x.t?'-'+x.t:''}`;
const slots=['QB','RB','RB','WR','WR','TE','FLEX','K','DEF'];
function optimal(roster){
 const pool=roster.filter(p=>!['IR','IR+'].includes(p.slot)&&Number.isFinite(p.points));let best={score:0,ids:[]};
 for(const flex of [null,...pool.filter(p=>['RB','WR','TE'].includes(p.position))]){
  const picks=flex?[flex]:[];
  for(const [pos,n]of [['QB',1],['RB',2],['WR',2],['TE',1],['K',1],['DEF',1]])picks.push(...pool.filter(p=>p!==flex&&p.position===pos).sort((a,b)=>b.points-a.points).slice(0,n));
  const score=sum(picks,p=>p.points);
  if(picks.length>best.ids.length||picks.length===best.ids.length&&score>best.score)best={score,ids:picks.map(p=>p.id||p.playerId)};
 }return best;
}
function gameView(g,s){
 let stage=`Week ${g.week}`,placement=null;
 if(g.playoffs){
  const a=s.teams.find(t=>t.owner===g.aOwner),b=s.teams.find(t=>t.owner===g.bOwner);
  const low=Math.min(a.rank,b.rank),high=Math.max(a.rank,b.rank);
  if(s.league.finished&&low%2===1&&high===low+1&&g.week>=s.settings.playoffStart+1){placement=low;stage=low===1?'Championship':`${low}${low===3?'rd':'th'}-place game`;}
  else stage=`${g.consolation?'Consolation':'Championship'} ${g.week===s.settings.playoffStart?'quarterfinal':'semifinal'}`;
 }
 return {...g,scope:g.playoffs?'Playoffs':'Regular Season',stage,placement,source:'Yahoo Fantasy API'};
}
function transactionsLegacy(s){
 const summary=Object.fromEntries(s.teams.map(t=>[t.owner,{transactions:0,adds:0,drops:0,waiverWins:0,faabSpent:0}])),rows=[];
 for(const t of s.transactions.filter(t=>t.status==='successful'&&['add','drop','add/drop'].includes(t.type))){
  const owners=[...new Set(t.players.flatMap(p=>[p.from,p.to]).filter(Boolean))];
  for(const owner of owners){const added=t.players.find(p=>p.to===owner&&p.action==='add'),dropped=t.players.find(p=>p.from===owner&&p.action==='drop'),waiver=added?.source==='waivers';
   const x=summary[owner];if(!x)continue;x.transactions++;if(added)x.adds++;if(dropped)x.drops++;if(waiver)x.waiverWins++;x.faabSpent+=t.faab||0;
   rows.push({id:t.id,owner,date:t.date.slice(0,10),sourceTime:new Date(t.timestamp).toLocaleString('en-US',{timeZone:'America/Chicago'}),added,dropped,method:waiver?'waiver':added?'free-agent':'drop',faab:t.faab||0,losingBids:[],timestamp:t.timestamp});
  }
 }
 return {asOf:s.updatedAt,transactions:rows.sort((a,b)=>a.timestamp-b.timestamp),summary,complete:s.transactionsComplete};
}
function build(base,seasons){
 const d=structuredClone(base.ZYNFL_DATA),z=structuredClone(base.ZYNFL_2026),latest=seasons.find(s=>s.year===2026);
 const oldPlayers=d.players;const playerMap=new Map();
 const ensure=(p)=>{let x=playerMap.get(String(p.playerId));if(!x){x={key:`id:${p.playerId}`,playerId:String(p.playerId),name:p.name,position:p.position,headshot:p.headshot||'',history:[],drafts:[],seasons:[],owners:[],starts:0,bench:0,ir:0,starterPoints:0,rosterPoints:0,avgDraft:null};playerMap.set(x.playerId,x);}if(p.headshot)x.headshot=p.headshot;return x;};
 // Preserve unverified historical aggregate rows until the entire scored season
 // is available, rather than replacing complete archive totals with partial data.
 const readyGame=(s,g)=>[g.aOwner,g.bOwner].every(owner=>{const t=s.teams.find(t=>t.owner===owner),ps=s.weeks[g.week]?.players?.filter(p=>p.owner===owner)||[];return (s.rosterFinal?.[`${g.week}:${t.id}`]||ps.every(p=>p.source==='published-snapshot'))&&ps.length>=9&&ps.every(p=>Number.isFinite(p.points));});
 const readyWeek=(s,week)=>s.games.filter(g=>g.complete&&g.week===week).every(g=>readyGame(s,g));
 const usable=new Map(seasons.map(s=>[s.year,s.year===2026||s.games.filter(g=>g.complete).every(g=>[g.aOwner,g.bOwner].every(owner=>{const rows=s.weeks[g.week]?.players?.filter(p=>p.owner===owner)||[];return rows.length>=9&&rows.every(p=>Number.isFinite(p.points));}))]));
 for(const old of oldPlayers)for(const h of old.history||[])if(!usable.get(h.year)){ensure({...old,playerId:old.playerId||old.key}).history.push({...h});}
 d.matchups=seasons.flatMap(s=>s.games.filter(g=>g.complete).map(g=>gameView(g,s)));
 d.champions=[];d.podium=[];d.wallOfShame=[];d.finalPlacements={};d.placementGames={};d.standings={};d.seasons={};d.drafts=[];d.draftDNA={};d.awards={all:{custom:[],position:[]}};
 const metrics={},legacy={};
 for(const s of seasons){
  const year=s.year,complete=s.games.filter(g=>g.complete),tx=transactionsLegacy(s);legacy[year]=tx;
  const standings=s.teams.map(t=>({rank:s.league.finished?t.seed||t.rank:t.rank,finalRank:s.league.finished?t.rank:null,teamId:t.id,owner:t.owner,team:t.name,w:t.w,l:t.l,t:t.t,pf:round(t.pf),pa:round(t.pa),g:t.w+t.l+t.t,diff:round(t.pf-t.pa)})).sort((a,b)=>a.rank-b.rank);
  d.standings[year]=standings;metrics[year]={};
  for(const team of s.teams){
   const old=d.owners[team.owner]?.seasons.find(x=>x.year===year)||{},st=standings.find(t=>t.owner===team.owner);
   const moves=tx.summary[team.owner];
   metrics[year][team.owner]={...old,...st,year,record:record(team),lineupEff:old.lineupEff??null,missed:old.missed||0,actual:0,optimal:0,opponentMissed:0,ourGuys:0,moneyball:0,waiverPoints:0,position:{},efficiencies:[],transactions:s.transactionsComplete?moves.transactions:old.transactions??null,faabSpent:s.transactionsComplete?moves.faabSpent:old.faabSpent??null,faabWins:s.transactionsComplete?moves.waiverWins:old.faabWins??null,trades:s.transactionsComplete?s.transactions.filter(t=>t.type==='trade'&&t.status==='successful'&&t.players.some(p=>p.from===team.owner||p.to===team.owner)).length:old.trades||0};
  }
  for(const w of Object.values(s.weeks))for(const p of w.players||[])ensure(p);
  if(usable.get(year)){
   for(const g of complete.filter(g=>readyWeek(s,g.week)))for(const [owner,official]of [[g.aOwner,g.aScore],[g.bOwner,g.bScore]]){
    const rows=s.weeks[g.week].players.filter(p=>p.owner===owner),m=metrics[year][owner],actual=sum(rows.filter(starter),p=>p.points),opt=optimal(rows);
    m.actual+=official;m.optimal+=Math.max(official,opt.score+official-actual);m.efficiencies.push(opt.score+official-actual>0?official/(opt.score+official-actual):1);
    for(const p of rows){
     const x=ensure(p);let h=x.history.find(h=>h.year===year&&h.owner===owner);
     if(!h){h={year,owner,team:m.team,starts:0,bench:0,ir:0,starterPoints:0,rosterPoints:0,throughWeek:0};x.history.push(h);}
     h.throughWeek=Math.max(h.throughWeek,g.week);h.rosterPoints+=p.points;
     if(starter(p)){h.starts++;h.starterPoints+=p.points;m.position[p.position]=(m.position[p.position]||0)+p.points;
      const self=s.drafts.some(x=>x.playerId===p.playerId&&x.owner===owner);m[self?'ourGuys':'moneyball']+=p.points;
      // Count production only during the waiver-acquired stint, not weeks played
      // before acquisition or after a later trade/reacquisition.
      const acquisition=s.transactions.filter(t=>t.status==='successful'&&t.timestamp<=Date.parse(g.end+'T23:59:59-06:00')&&t.players.some(x=>x.playerId===p.playerId&&(x.from===owner||x.to===owner))).sort((a,b)=>b.timestamp-a.timestamp)[0];
      if(acquisition?.players.some(x=>x.playerId===p.playerId&&x.to===owner&&x.action==='add'&&x.source==='waivers'))m.waiverPoints+=p.points;
     }else if(p.slot==='BN')h.bench++;else h.ir++;
    }
   }
   for(const m of Object.values(metrics[year])){m.actual=round(m.actual);m.optimal=round(m.optimal);m.missed=round(m.optimal-m.actual);m.lineupEff=m.efficiencies.length?m.efficiencies.reduce((n,x)=>n+x,0)/m.efficiencies.length:null;}
   for(const g of complete.filter(g=>readyWeek(s,g.week)))for(const [o,opp]of [[g.aOwner,g.bOwner],[g.bOwner,g.aOwner]]){
    const rows=s.weeks[g.week].players.filter(p=>p.owner===opp);metrics[year][o].opponentMissed+=Math.max(0,optimal(rows).score-sum(rows.filter(starter),p=>p.points));
   }
  }
  for(const pick of s.drafts){const p=ensure(pick),h=p.history.find(h=>h.year===year&&h.owner===pick.owner);const row={...pick,player:pick.name,team:metrics[year][pick.owner].team,nflTeam:pick.nfl,starts:h?.starts||0,starterPoints:round(h?.starterPoints||0)};d.drafts.push(row);p.drafts.push(row);}
  d.draftDNA[year]=s.teams.map(t=>{const picks=d.drafts.filter(p=>p.year===year&&p.owner===t.owner).sort((a,b)=>a.overall-b.overall),first=picks[0],best=picks.slice().sort((a,b)=>b.starterPoints-a.starterPoints)[0];return {owner:t.owner,team:t.name,slot:first?.overall,firstPick:first?.player,firstOverall:first?.overall,totalStarterPoints:sum(picks,p=>p.starterPoints),bestPick:best?.player,bestPickOverall:best?.overall,bestPickPoints:best?.starterPoints,firstThree:picks.slice(0,3).map(p=>p.player),positionCounts:picks.reduce((o,p)=>(o[p.position]=(o[p.position]||0)+1,o),{})};});
  if(s.league.finished){
   const ranked=s.teams.slice().sort((a,b)=>a.rank-b.rank),[gold,silver,bronze]=ranked,wall=ranked.at(-1),final=d.matchups.find(g=>g.year===year&&g.placement===1);
   const finalScore=final?`${(final.aOwner===gold.owner?final.aScore:final.bScore).toFixed(2)}–${(final.aOwner===gold.owner?final.bScore:final.aScore).toFixed(2)}`:'';
   d.finalPlacements[year]=Object.fromEntries(ranked.map(t=>[t.owner,t.rank]));d.placementGames[year]=d.matchups.filter(g=>g.year===year&&g.placement).sort((a,b)=>a.placement-b.placement);
   d.champions.push({year,owner:gold.owner,team:gold.name,record:record(gold),finalScore,runnerUp:silver.owner,bronze:bronze.owner});
   d.podium.push({year,gold:gold.owner,goldTeam:gold.name,silver:silver.owner,silverTeam:silver.name,bronze:bronze.owner,bronzeTeam:bronze.name});d.wallOfShame.push({year,owner:wall.owner,team:wall.name});
   const top=ranked.slice().sort((a,b)=>b.pf-a.pf)[0];d.seasons[year]={year,champion:gold.owner,championTeam:gold.name,runnerUp:silver.owner,runnerUpTeam:silver.name,bronze:bronze.owner,bronzeTeam:bronze.name,finalScore,wall:wall.owner,record:record(gold),topPF:top.owner,topPFValue:top.pf,standings,finalPlacements:d.finalPlacements[year]};
  }else d.seasons[year]={year,standings,champion:null};
  const ms=Object.values(metrics[year]),awards={custom:[],position:[]};
  const award=(key,title,field,detail,{min=false,format=n=>round(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),eligible=ms}={})=>{
   const sorted=eligible.filter(m=>Number.isFinite(m[field])).sort((a,b)=>(min?1:-1)*(a[field]-b[field])||a.owner.localeCompare(b.owner));let m=sorted[0];if(m){const ties=sorted.filter(x=>Math.abs(x[field]-m[field])<.000001).map(x=>x.owner);const previous=base.ZYNFL_DATA.awards[year]?.custom.find(x=>x.key===key);if(previous&&ties.includes(previous.owner))m=sorted.find(x=>x.owner===previous.owner);awards.custom.push({key,title,owner:m.owner,team:m.team,year,value:format(m[field]),numericValue:m[field],ties:ties.length>1?ties:[],detail});}
  };
  award('goat','GOAT','pf','Most regular-season Points For');award('sec-schedule','SEC Schedule','pa','Most regular-season Points Against');award('fantasy-god','Fantasy God','diff','Largest single-season PF − PA differential');award('loser','Loser','diff','Smallest single-season PF − PA differential',{min:true});
  if(usable.get(year)){
   award('coty','COTY','lineupEff','Mean weekly actual ÷ best legal lineup points in completed fantasy games',{format:n=>(n*100).toFixed(1)+'%'});award('spectator-sport','Spectator Sport','missed','Most legal-lineup points left unused');award('our-guys','“Our Guys”','ourGuys','Starter points from players drafted by that manager');award('moneyball','Moneyball','moneyball','Starter points from players not drafted by that manager');
   for(const m of ms){m.gambler=(m.position.K||0)+(m.position.DEF||0);m.nick=m.faabSpent>0?m.waiverPoints/m.faabSpent:null;}
   award('true-gambler','True Gambler','gambler','Kicker + defense starter points');award('god-s-favorite',"God's Favorite",'opponentMissed','Opponent legal-lineup points left unused');
   if(s.transactionsComplete)award('the-nick-special','The Nick Special','nick','Waiver-acquired starter points per FAAB dollar during acquired stints');
   for(const pos of ['QB','RB','WR','TE','K','DEF'])for(const min of [false,true]){const sorted=ms.slice().sort((a,b)=>(min?1:-1)*((a.position[pos]||0)-(b.position[pos]||0))||a.owner.localeCompare(b.owner));const m=sorted[0];awards.position.push({title:`${min?'Fewest':'Most'} ${pos} Points`,owner:m.owner,team:m.team,year,value:round(m.position[pos]||0).toFixed(2),numericValue:m.position[pos]||0,detail:'Starter points in completed fantasy games; byes and eliminated weeks excluded'});}
  }
  if(s.transactionsComplete){award('waiver-wire-warrior','Waiver Wire Warrior','transactions','Successful add/drop events; a paired add/drop is one move',{format:n=>String(n)});award('daddy-warbucks','Daddy Warbucks','faabSpent','FAAB spent on successful waiver claims',{format:n=>'$'+n});}
  const weekly=complete.filter(g=>!g.playoffs).flatMap(g=>[{owner:g.aOwner,team:g.aTeam,points:g.aScore,week:g.week},{owner:g.bOwner,team:g.bTeam,points:g.bScore,week:g.week}]);
  for(const min of [false,true]){const p=weekly.slice().sort((a,b)=>(min?1:-1)*(a.points-b.points))[0];if(p)awards.custom.push({key:min?'lowest-scoring-week':'highest-scoring-week',title:min?'Lowest Scoring Week':'Highest Scoring Week',...p,year,value:p.points.toFixed(2),numericValue:p.points,detail:`Week ${p.week} · regular season`});}
  // Keep clearly labelled legacy categories pending verification, never silently
  // turn missing roster or transaction coverage into zero-valued winners.
  for(const group of ['custom','position'])for(const a of base.ZYNFL_DATA.awards[year]?.[group]||[])if(!awards[group].some(x=>(x.key||x.title)===(a.key||a.title)))awards[group].push({...a,year,detail:a.detail+' · historical API verification pending'});
  d.awards[year]=awards;
 }
 for(const rows of Object.values(latest.leaders))for(const p of rows)ensure(p);
 d.players=[...playerMap.values()];
 for(const p of d.players){for(const h of p.history){h.starterPoints=round(h.starterPoints);h.rosterPoints=round(h.rosterPoints);}for(const k of ['starts','bench','ir','starterPoints','rosterPoints'])p[k]=sum(p.history,h=>h[k]);p.avgDraft=p.drafts.length?round(sum(p.drafts,x=>x.overall)/p.drafts.length):null;p.seasons=[...new Set([...p.history,...p.drafts].map(x=>x.year))].sort();p.owners=[...new Set([...p.history,...p.drafts].map(x=>x.owner))];}
 const active=latest.teams.map(t=>t.owner);d.activeOwners=active;
 for(const [name,o]of Object.entries(d.owners)){
  o.active=active.includes(name);o.seasons=seasons.map(s=>metrics[s.year][name]).filter(Boolean);o.currentTeam=latest.teams.find(t=>t.owner===name)?.name||o.currentTeam;o.aliases=[...new Set([...(o.aliases||[]),...o.seasons.map(s=>s.team)])];
  const games=d.matchups.filter(g=>g.scope==='Regular Season'&&[g.aOwner,g.bOwner].includes(name)),w=games.filter(g=>g.winner===name).length,t=games.filter(g=>!g.winner).length;o.regular={w,l:games.length-w-t,t,pct:games.length?(w+.5*t)/games.length:null};
  for(const k of ['pf','pa','missed','transactions','faabSpent','faabWins','trades'])o[k]=sum(o.seasons,s=>s[k]);
  const actual=sum(o.seasons,s=>s.actual),opt=sum(o.seasons,s=>s.optimal);o.avgLineupEff=o.seasons.filter(s=>s.lineupEff!=null).reduce((n,s)=>n+s.lineupEff,0)/(o.seasons.filter(s=>s.lineupEff!=null).length||1);
  o.titles=d.champions.filter(x=>x.owner===name).length;o.silver=d.podium.filter(x=>x.silver===name).length;o.bronze=d.podium.filter(x=>x.bronze===name).length;o.brown=d.wallOfShame.filter(x=>x.owner===name).length;o.topDrafts=d.drafts.filter(p=>p.owner===name).sort((a,b)=>b.starterPoints-a.starterPoints).slice(0,6);
 }
 for(const group of ['custom','position']){
  const keys=[...new Set(seasons.flatMap(s=>d.awards[s.year][group].map(a=>a.key||a.title)))];
  for(const key of keys){const min=key==='loser'||key==='lowest-scoring-week'||key.startsWith('Fewest');const rate=key==='coty'||key==='the-nick-special';let candidates=seasons.filter(s=>s.league.finished||(!rate&&!key.startsWith('Fewest'))).flatMap(s=>d.awards[s.year][group].filter(a=>(a.key||a.title)===key));
   const value=a=>a.numericValue??parseFloat(String(a.value).replace(/[^\d.+-]/g,''))*(key==='coty'?.01:1);candidates=candidates.filter(a=>Number.isFinite(value(a))).sort((a,b)=>(min?1:-1)*(value(a)-value(b))||a.year-b.year);
   if(candidates[0])d.awards.all[group].push({...candidates[0],detail:candidates[0].detail+' · single-season record'});
  }
 }
 const scores=d.matchups.flatMap(g=>[{g,owner:g.aOwner,team:g.aTeam,score:g.aScore,opp:g.bOwner},{g,owner:g.bOwner,team:g.bTeam,score:g.bScore,opp:g.aOwner}]).sort((a,b)=>b.score-a.score),margins=d.matchups.slice().sort((a,b)=>Math.abs(b.aScore-b.bScore)-Math.abs(a.aScore-a.bScore));
 d.records=[];for(const [title,p]of [['Highest Single-Team Score',scores[0]],['Lowest Single-Team Score',scores.at(-1)]])if(p)d.records.push({title,value:p.score.toFixed(2),owner:p.owner,team:p.team,year:p.g.year,detail:`Week ${p.g.week} vs ${p.opp}`});
 for(const [title,g]of [['Biggest Blowout',margins[0]],['Closest Game',margins.at(-1)]])if(g)d.records.push({title,value:Math.abs(g.aScore-g.bScore).toFixed(2)+' pts',owner:g.winner||'Tie',team:g.winner===g.aOwner?g.aTeam:g.bTeam,year:g.year,detail:`Week ${g.week} · ${g.aScore.toFixed(2)}–${g.bScore.toFixed(2)}`});
 for(const r of d.rivalries){const [a,b]=r.owners;r.games=d.matchups.filter(g=>[g.aOwner,g.bOwner].includes(a)&&[g.aOwner,g.bOwner].includes(b)).map(g=>({year:g.year,week:g.week,stage:`Week ${g.week}${g.playoffs?' · '+g.stage:''}`,scope:g.scope,aScore:g.aOwner===a?g.aScore:g.bScore,bScore:g.aOwner===b?g.aScore:g.bScore,aTeam:g.aOwner===a?g.aTeam:g.bTeam,bTeam:g.aOwner===b?g.aTeam:g.bTeam,winner:g.winner})).sort((a,b)=>b.year-a.year||b.week-a.week);r.beltHolder=r.games.find(g=>g.winner)?.winner||null;}
 const verifiedTrades=seasons.filter(s=>s.transactionsComplete).flatMap(s=>s.transactions.filter(t=>t.type==='trade'&&['successful','vetoed'].includes(t.status)).map(t=>{const owners=[...new Set(t.players.flatMap(p=>[p.from,p.to]).filter(Boolean))];return {id:t.id,year:s.year,status:t.status==='successful'?'Completed':t.status==='vetoed'?'Vetoed':t.status,a:owners[0],b:owners[1],players:[...new Set(t.players.map(p=>p.name))]};}));
 d.trades=[...base.ZYNFL_DATA.trades.filter(t=>!seasons.find(s=>s.year===t.year)?.transactionsComplete),...verifiedTrades];
 d.transactions2026=legacy[2026].transactions;
 d.meta={...d.meta,completedSeasons:seasons.filter(s=>s.league.finished).length,games:d.matchups.length,regularGames:d.matchups.filter(g=>!g.playoffs).length,playoffGames:d.matchups.filter(g=>g.playoffs).length,completedTrades:d.trades.filter(t=>t.status==='Completed').length,vetoedTrades:d.trades.filter(t=>t.status==='Vetoed').length,transactions:seasons.reduce((n,s)=>n+(s.transactionsComplete?s.transactions.filter(t=>t.status==='successful'&&['trade','add','drop','add/drop'].includes(t.type)).length:sum(Object.values(metrics[s.year]),m=>m.transactions)),0),fabAwards:sum(Object.values(d.owners),o=>o.faabWins),playerWeeks:sum(d.players,p=>p.starts+p.bench+p.ir),draftPicks:d.drafts.length,updatedAt:latest.updatedAt};
 Object.assign(z,seasonView(latest,z));d.meta.dataThrough=`2026 Week ${z.week} · final games${z.rosterFinalThrough<z.week?' · player stats through Week '+z.rosterFinalThrough:''}`;d.meta.transactionsAsOf=latest.transactionsUpdatedAt||latest.updatedAt;
 const leaders=structuredClone(base.ZYNFL_2026_LEADERS||{});for(const [pos,rows]of Object.entries(latest.leaders))leaders[pos]=rows.filter(p=>Number.isFinite(p.points)).sort((a,b)=>b.points-a.points).slice(0,10);leaders.FLEX=['RB','WR','TE'].flatMap(p=>leaders[p]||[]).sort((a,b)=>b.points-a.points).slice(0,10);leaders.updated=latest.leadersUpdatedAt||leaders.updated;leaders.week=z.week;
 return {ZYNFL_DATA:d,ZYNFL_2026:z,ZYNFL_2026_LEADERS:leaders,ZYNFL_LATEST_ROSTER:z.weeks[z.currentWeek]?.players||[],ZYNFL_TRANSACTIONS_2026:legacy[2026]};
}
function seasonView(s,old){
 const z={...old,teams:{...old.teams},weeks:{},year:s.year,currentWeek:s.league.currentWeek,week:Math.max(0,...s.games.filter(g=>g.complete).map(g=>g.week)),updated:s.updatedAt,players:[],futureSchedule:s.games.filter(g=>!g.playoffs).map(g=>({week:g.week,a:g.aOwner,b:g.bOwner})),injuryNotes:{}};
 for(const t of s.teams)z.teams[t.owner]={...z.teams[t.owner],name:t.name};
 for(let week=1;week<=s.league.currentWeek;week++){
  const games=s.games.filter(g=>g.week===week),complete=games.length>0&&games.every(g=>g.complete),prior=s.games.filter(g=>g.complete&&g.week<=week),rows=(s.weeks[week]?.players||[]).map(p=>({...p,id:`${s.year}-${week}-${p.owner}-${p.playerId}`,status:complete?'final':games.some(g=>g.status==='midevent')?'live':'scheduled'}));
  const scores=Object.fromEntries(games.flatMap(g=>[[g.aOwner,g.aScore],[g.bOwner,g.bScore]])),ranking=s.teams.map(t=>{const gs=prior.filter(g=>[g.aOwner,g.bOwner].includes(t.owner));const pf=sum(gs,g=>g.aOwner===t.owner?g.aScore:g.bScore),wins=gs.filter(g=>g.winner===t.owner).length;return {owner:t.owner,pf,wins,g:gs.length,score:gs.length?pf/gs.length+10*wins/gs.length:0};}).sort((a,b)=>b.score-a.score||a.owner.localeCompare(b.owner));
  const rostersFinal=games.every(g=>[g.aId,g.bId].every(id=>s.rosterFinal?.[`${week}:${id}`]));
  const wd={rostersFinal,label:`Week ${week}`,complete,matchups:games.map(g=>[g.aOwner,g.bOwner,g.aScore,g.bScore]),games,players:rows,rosters:Object.fromEntries(s.teams.map(t=>[t.owner,rows.filter(p=>p.owner===t.owner).map(p=>p.id)])),scores,recaps:{},analystRankings:ranking.map(x=>x.owner),rankReasons:Object.fromEntries(ranking.map(x=>[x.owner,x.g?`${(x.pf/x.g).toFixed(2)} points per game and ${x.wins} wins in ${x.g} completed games. Formula: points per game + 10 × win percentage.`:'No completed games yet.'])),jackRankings:old.weeks?.[week]?.jackRankings||old.jackRankings?.[week]||null,jackRankReasons:old.weeks?.[week]?.jackRankReasons||{},news:[],nflMatchups:old.weeks?.[week]?.nflMatchups||[],sourceNote:'Yahoo Fantasy API · final games only enter career records',hero:{eyebrow:`2026 SEASON · WEEK ${week}`,title:`Week ${week}.`,titleAccent:complete?'The results are in.':'Follow the action.',dek:complete?'Scores, leaders, and lineup decisions — updated from Yahoo.':'Lineups and points refresh automatically as Yahoo updates them.',reportDate:s.updatedAt},highlights:{}};
  const high=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0],close=games.slice().sort((a,b)=>Math.abs(a.aScore-a.bScore)-Math.abs(b.aScore-b.bScore))[0],star=rows.filter(p=>starter(p)&&Number.isFinite(p.points)).sort((a,b)=>b.points-a.points)[0];
  if(high)wd.highlights.highScore={value:high[1].toFixed(2),label:high[0]};if(close)wd.highlights.closest={value:Math.abs(close.aScore-close.bScore).toFixed(2),label:`${close.aOwner} vs ${close.bOwner}`};if(star)wd.highlights.player={value:star.points.toFixed(2),label:`${star.name} · ${star.owner}`};
  for(const t of s.teams){const g=games.find(g=>[g.aOwner,g.bOwner].includes(t.owner));if(!g){wd.recaps[t.owner]='No scheduled fantasy matchup this week.';continue;}const a=g.aOwner===t.owner,points=a?g.aScore:g.bScore,against=a?g.bScore:g.aScore,opponent=a?g.bOwner:g.aOwner,ps=rows.filter(p=>p.owner===t.owner),top=ps.filter(p=>starter(p)&&Number.isFinite(p.points)).sort((a,b)=>b.points-a.points)[0];
   wd.recaps[t.owner]=complete?`${t.owner} ${g.winner===t.owner?'beat':g.winner?'lost to':'tied'} ${opponent}, ${points.toFixed(2)}–${against.toFixed(2)}.${top?` ${top.name} led the starting lineup with ${top.points.toFixed(2)} points.`:''}${ps.every(p=>Number.isFinite(p.points))&&ps.length>=9?` The best legal lineup had ${Math.max(0,optimal(ps).score-sum(ps.filter(starter),p=>p.points)).toFixed(2)} additional points available.`:''}`:`${t.owner} faces ${opponent}. Current Yahoo score: ${points.toFixed(2)}–${against.toFixed(2)}. Results and lineup analysis become final when Yahoo closes the matchup.`;
  }
  z.weeks[week]=wd;z.players.push(...rows);for(const p of rows)if(p.injury)z.injuryNotes[p.name]=p.injury;
 }
 for(const t of s.teams){z.teams[t.owner].players=z.weeks[z.currentWeek]?.rosters[t.owner]||[];z.teams[t.owner].score=z.weeks[z.currentWeek]?.scores[t.owner]||0;}
 z.analystRankings=z.weeks[z.week]?.analystRankings||[];z.rankReasons=z.weeks[z.week]?.rankReasons||{};
 z.rosterFinalThrough=Math.max(0,...Object.entries(z.weeks).filter(([,w])=>w.complete&&w.rostersFinal).map(([w])=>Number(w)));
 return z;
}
function forecast(s,trials=5000){
 let state=2026+s.games.filter(g=>g.complete).length;const random=()=>{state|=0;state=state+0x6D2B79F5|0;let t=Math.imul(state^state>>>15,1|state);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
 const normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-10,random())))*Math.cos(2*Math.PI*random());
 const completed=s.games.filter(g=>g.complete&&!g.playoffs),scores=completed.flatMap(g=>[g.aScore,g.bScore]),leagueMean=scores.length?sum(scores)/scores.length:110;
 const leagueSD=scores.length>1?Math.sqrt(scores.reduce((n,x)=>n+(x-leagueMean)**2,0)/(scores.length-1)):25;
 const teams=s.teams.map(t=>{const points=completed.filter(g=>[g.aOwner,g.bOwner].includes(t.owner)).map(g=>g.aOwner===t.owner?g.aScore:g.bScore),mean=points.length?sum(points)/points.length:leagueMean;const sd=points.length>1?Math.sqrt(points.reduce((n,x)=>n+(x-mean)**2,0)/(points.length-1)):leagueSD;return {...t,mean:.67*mean+.33*leagueMean,sd:Math.max(12,.5*sd+.5*leagueSD),playoff:0,bye:0,totalSeed:0,totalWins:0};});
 const remaining=s.games.filter(g=>!g.complete&&!g.playoffs),qualifiers=s.settings.playoffTeams||6,byes=Math.max(0,2**Math.ceil(Math.log2(qualifiers))-qualifiers);
 for(let trial=0;trial<trials;trial++){
  const rows=teams.map(t=>({...t,simWins:t.w+.5*t.t,simPF:t.pf})),lookup=Object.fromEntries(rows.map(t=>[t.owner,t]));
  for(const g of remaining){const a=lookup[g.aOwner],b=lookup[g.bOwner],ap=Math.max(0,a.mean+a.sd*normal()),bp=Math.max(0,b.mean+b.sd*normal());a.simPF+=ap;b.simPF+=bp;if(ap>bp)a.simWins++;else if(bp>ap)b.simWins++;else {a.simWins+=.5;b.simWins+=.5;}}
  rows.sort((a,b)=>b.simWins-a.simWins||b.simPF-a.simPF||a.rank-b.rank);rows.forEach((r,i)=>{const t=teams.find(t=>t.owner===r.owner);if(i<qualifiers)t.playoff++;if(i<byes)t.bye++;t.totalSeed+=i+1;t.totalWins+=r.simWins;});
 }
 return teams.map(t=>({owner:t.owner,playoff:t.playoff/trials,bye:t.bye/trials,seed:t.totalSeed/trials,wins:t.totalWins/trials})).sort((a,b)=>b.playoff-a.playoff||a.seed-b.seed);
}
root.ZYNFL_YAHOO_MODEL={build,optimal,gameView,transactionsLegacy,forecast};
})(typeof window!=='undefined'?window:globalThis);
