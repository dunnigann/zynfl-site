/* Derive current/career views from immutable season history and weekly Yahoo snapshots.
   Safe to rerun: rebuilds 2026 rows instead of incrementing cached totals. */
(() => {
  const d=window.ZYNFL_DATA,z=window.ZYNFL_2026,round=n=>Math.round(n*100)/100;
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
  const team=t=>({JAC:'JAX',AZ:'ARI'}[t]||t);
  const nameKey=s=>({kedonblack:'kaelonblack'}[norm(s)]||norm(s));
  const identity=p=>p.position==='DEF'?'def:'+team(p.nfl):nameKey(p.name);
  const rows=w=>Number(w)===1?z.players.filter(p=>!/^w\d+-/.test(p.id)&&p.owner):(z.weeks[w]?.players||[]);
  // Exact legal optimizer: pick a flex candidate, then the highest scorers for each fixed position.
  // Empty slots score zero; players in IR are never available, and a player cannot occupy two slots.
  const optimal=roster=>{
    const pool=roster.filter(p=>p.slot!=='IR'&&Number.isFinite(p.points));let best={score:-Infinity,ids:[]};
    const candidates=[null,...pool.filter(p=>['RB','WR','TE'].includes(p.position))];
    for(const flex of candidates){const selected=flex?[flex]:[];
      for(const [pos,n] of [['QB',1],['RB',2],['WR',2],['TE',1],['K',1],['DEF',1]])selected.push(...pool.filter(p=>p!==flex&&p.position===pos).sort((a,b)=>b.points-a.points).slice(0,n));
      const score=selected.reduce((s,p)=>s+p.points,0);if(selected.length>best.ids.length||(selected.length===best.ids.length&&score>best.score))best={score:round(score),ids:selected.map(p=>p.id)};
    }return best;
  };
  window.ZYNFL_OPTIMAL=optimal;
  for(const week of Object.values(z.weeks))week.nflMatchups=week.nflMatchups.map(g=>[team(g[0]),team(g[1]),...g.slice(2)]);
  // Canonical final-game ledger, including all prior 2026 weeks exactly once.
  d.matchups=d.matchups.filter(g=>g.year!==2026);
  for(const [w,week] of Object.entries(z.weeks))for(const [a,b] of week.matchups){
    const as=week.scores[a],bs=week.scores[b];if(!Number.isFinite(as)||!Number.isFinite(bs))continue;
    d.matchups.push({year:2026,week:+w,aOwner:a,bOwner:b,aTeam:z.teams[a].name,bTeam:z.teams[b].name,aScore:as,bScore:bs,winner:as>bs?a:bs>as?b:null,scope:'Regular Season',source:'Archived Yahoo matchup screenshot'});
  }
  const totals={};for(const o of Object.keys(z.teams))totals[o]={owner:o,team:z.teams[o].name,w:0,l:0,t:0,pf:0,pa:0,g:0,optimal:0};
  for(const g of d.matchups.filter(g=>g.year===2026))for(const [o,other,score,against] of [[g.aOwner,g.bOwner,g.aScore,g.bScore],[g.bOwner,g.aOwner,g.bScore,g.aScore]]){
    const x=totals[o];x.g++;x.pf+=score;x.pa+=against;if(score>against)x.w++;else if(score<against)x.l++;else x.t++;
    x.optimal+=optimal(rows(g.week).filter(p=>p.owner===o)).score;
  }
  d.standings['2026']=Object.values(totals).sort((a,b)=>(b.w+.5*b.t)/b.g-(a.w+.5*a.t)/a.g||b.pf-a.pf).map((x,i)=>({...x,pf:round(x.pf),pa:round(x.pa),diff:round(x.pf-x.pa),rank:i+1}));
  for(const s of d.standings['2026']){
    const o=d.owners[s.owner],historical=o.seasons.filter(x=>x.year<2026),missed=round(Math.max(0,s.optimal-s.pf));
    const current={year:2026,team:s.team,rank:s.rank,record:`${s.w}-${s.l}${s.t?'-'+s.t:''}`,pf:s.pf,pa:s.pa,diff:s.diff,lineupEff:s.optimal?s.pf/s.optimal:null,missed,transactions:null,faabSpent:null};
    o.seasons=[...historical,current];o.currentTeam=s.team;if(!o.aliases.includes(s.team))o.aliases.push(s.team);
    const games=d.matchups.filter(g=>g.scope==='Regular Season'&&(g.aOwner===s.owner||g.bOwner===s.owner));
    const w=games.filter(g=>g.winner===s.owner).length,t=games.filter(g=>g.winner===null).length,l=games.length-w-t;
    o.regular={w,l,t,pct:games.length?(w+.5*t)/games.length:null};
    o.pf=round(o.seasons.reduce((n,x)=>n+x.pf,0));o.pa=round(o.seasons.reduce((n,x)=>n+x.pa,0));
    const efficiencies=o.seasons.map(x=>x.lineupEff).filter(Number.isFinite);o.avgLineupEff=efficiencies.length?efficiencies.reduce((a,b)=>a+b,0)/efficiencies.length:null;
    o.missed=round(o.seasons.reduce((n,x)=>n+(x.missed||0),0));
  }
  // Player histories include actual weekly starts, bench and IR; draft day is a separate fact.
  const byIdentity=new Map();
  for(const p of d.players){p.history=p.history.filter(h=>h.year<2026);const nfl=p.position==='DEF'?Object.entries(z.nflTeams).find(([,t])=>norm(t.name).endsWith(norm(p.name)))?.[0]:null;byIdentity.set(p.position==='DEF'?'def:'+team(nfl||p.name):nameKey(p.name),p);}
  for(const [w,week] of Object.entries(z.weeks))for(const p of rows(w)){
    if(!p.owner)continue;const key=identity(p);let archive=byIdentity.get(key);
    if(!archive){archive={key:'2026:'+key,name:p.name,position:p.position,playerId:null,history:[],drafts:[],avgDraft:null};d.players.push(archive);byIdentity.set(key,archive);}
    let h=archive.history.find(h=>h.year===2026&&h.owner===p.owner);
    if(!h){h={year:2026,owner:p.owner,team:z.teams[p.owner].name,starts:0,bench:0,ir:0,starterPoints:0,rosterPoints:0,throughWeek:0};archive.history.push(h);}
    h.throughWeek=+w;if(p.slot==='IR')h.ir++;else if(p.slot==='BN')h.bench++;else{h.starts++;h.starterPoints+=p.points||0;}
    h.rosterPoints+=p.points||0;
  }
  for(const p of d.players){
    for(const h of p.history){h.starterPoints=round(h.starterPoints);h.rosterPoints=round(h.rosterPoints);}
    p.starts=p.history.reduce((n,h)=>n+h.starts,0);p.bench=p.history.reduce((n,h)=>n+h.bench,0);p.ir=p.history.reduce((n,h)=>n+h.ir,0);
    p.starterPoints=round(p.history.reduce((n,h)=>n+h.starterPoints,0));p.rosterPoints=round(p.history.reduce((n,h)=>n+h.rosterPoints,0));
    p.seasons=[...new Set([...p.history.map(h=>h.year),...p.drafts.map(x=>x.year)])].sort();p.owners=[...new Set([...p.history.map(h=>h.owner),...p.drafts.map(x=>x.owner)])];
    for(const draft of p.drafts.filter(x=>x.year===2026)){const h=p.history.find(h=>h.year===2026&&h.owner===draft.owner);draft.starts=h?.starts||0;draft.starterPoints=h?.starterPoints||0;}
  }
  for(const draft of d.drafts.filter(x=>x.year===2026)){
    const archive=byIdentity.get(nameKey(draft.player));const h=archive?.history.find(h=>h.year===2026&&h.owner===draft.owner);
    draft.starts=h?.starts||0;draft.starterPoints=h?.starterPoints||0;
  }
  for(const o of Object.keys(z.teams))d.owners[o].topDrafts=d.drafts.filter(x=>x.owner===o&&x.starterPoints>0).slice().sort((a,b)=>b.starterPoints-a.starterPoints).slice(0,6);
  // Rivalry belts and meeting history are derived from the same final ledger as the matrix.
  for(const r of d.rivalries){const [a,b]=r.owners;r.games=[...r.games.filter(g=>g.year<2026),...d.matchups.filter(g=>g.year===2026&&[g.aOwner,g.bOwner].includes(a)&&[g.aOwner,g.bOwner].includes(b)).map(g=>({year:g.year,stage:`Week ${g.week}`,scope:g.scope,aScore:g.aOwner===a?g.aScore:g.bScore,bScore:g.aOwner===b?g.aScore:g.bScore,aTeam:g.aOwner===a?g.aTeam:g.bTeam,bTeam:g.aOwner===b?g.aTeam:g.bTeam,winner:g.winner}))].sort((a,b)=>b.year-a.year||Number(b.stage.split(' ')[1])-Number(a.stage.split(' ')[1]));r.beltHolder=r.games.find(g=>g.winner)?.winner||null;}
  const weekly=d.matchups.filter(g=>g.year===2026).flatMap(g=>[{owner:g.aOwner,team:g.aTeam,points:g.aScore,week:g.week},{owner:g.bOwner,team:g.bTeam,points:g.bScore,week:g.week}]);
  const award=(key,title,x,value,detail)=>({key,title,owner:x.owner,team:x.team,year:2026,value,detail});
  const highest=weekly.slice().sort((a,b)=>b.points-a.points)[0],lowest=weekly.slice().sort((a,b)=>a.points-b.points)[0];
  const pf=d.standings['2026'].slice().sort((a,b)=>b.pf-a.pf)[0],pa=d.standings['2026'].slice().sort((a,b)=>b.pa-a.pa)[0],diff=d.standings['2026'].slice().sort((a,b)=>b.diff-a.diff),efficient=d.standings['2026'].slice().sort((a,b)=>d.owners[b.owner].seasons.at(-1).lineupEff-d.owners[a.owner].seasons.at(-1).lineupEff),missed=d.standings['2026'].slice().sort((a,b)=>d.owners[b.owner].seasons.at(-1).missed-d.owners[a.owner].seasons.at(-1).missed);
  d.awards['2026']={custom:[award('highest-scoring-week','Highest Scoring Week',highest,highest.points.toFixed(2),`Week ${highest.week}`),award('lowest-scoring-week','Lowest Scoring Week',lowest,lowest.points.toFixed(2),`Week ${lowest.week}`),award('goat','GOAT',pf,pf.pf.toFixed(2),'Most regular-season Points For'),award('sec-schedule','SEC Schedule',pa,pa.pa.toFixed(2),'Most regular-season Points Against'),award('fantasy-god','Fantasy God',diff[0],'+'+diff[0].diff.toFixed(2),'Largest season PF − PA differential'),award('loser','Loser',diff.at(-1),diff.at(-1).diff.toFixed(2),'Smallest season PF − PA differential'),award('coty','COTY',efficient[0],(100*d.owners[efficient[0].owner].seasons.at(-1).lineupEff).toFixed(1)+'%','Actual points ÷ best legal lineup points'),award('spectator-sport','Spectator Sport',missed[0],d.owners[missed[0].owner].seasons.at(-1).missed.toFixed(2),'Optimal-lineup points left unused')],position:[]};
  for(const pos of ['QB','RB','WR','TE','K','DEF']){const production=Object.keys(z.teams).map(owner=>({owner,team:z.teams[owner].name,points:Object.keys(z.weeks).flatMap(rows).filter(p=>p.owner===owner&&p.position===pos&&!['BN','IR'].includes(p.slot)).reduce((n,p)=>n+(p.points||0),0)})).sort((a,b)=>b.points-a.points)[0];d.awards['2026'].position.push(award('position-'+pos,pos+' Production',production,round(production.points).toFixed(2),'Starter points through Week '+z.week));}
  // All-Time awards select an existing single-season value; unfinished 2026 totals remain labelled.
  const maximize=new Set(['goat','sec-schedule','fantasy-god','coty','spectator-sport','highest-scoring-week']);
  for(const group of ['custom','position'])for(const current of d.awards['2026'][group]){const key=current.key||current.title;const index=d.awards.all[group].findIndex(a=>(a.key||a.title)===key);if(index<0)continue;const old=d.awards.all[group][index],value=x=>parseFloat(String(x.value).replace(/,/g,''));if((maximize.has(key)||group==='position')?value(current)>value(old):key==='loser'&&value(current)<value(old))d.awards.all[group][index]={...current};}
  // Recompute single-game records across all seasons.
  const allScores=d.matchups.flatMap(g=>[{g,owner:g.aOwner,team:g.aTeam,score:g.aScore,opp:g.bOwner},{g,owner:g.bOwner,team:g.bTeam,score:g.bScore,opp:g.aOwner}]);
  const high=allScores.slice().sort((a,b)=>b.score-a.score)[0],low=allScores.slice().sort((a,b)=>a.score-b.score)[0],byMargin=d.matchups.slice().sort((a,b)=>Math.abs(b.aScore-b.bScore)-Math.abs(a.aScore-a.bScore));
  const gameRecord=(title,g)=>({title,value:Math.abs(g.aScore-g.bScore).toFixed(2)+' pts',owner:g.winner||'Tie',team:g.winner===g.aOwner?g.aTeam:g.bTeam,year:g.year,detail:`Week ${g.week} · ${Math.max(g.aScore,g.bScore).toFixed(2)}–${Math.min(g.aScore,g.bScore).toFixed(2)}`});
  d.records=[{title:'Highest Single-Team Score',value:high.score.toFixed(2),owner:high.owner,team:high.team,year:high.g.year,detail:`Week ${high.g.week} vs ${high.opp}`},{title:'Lowest Single-Team Score',value:low.score.toFixed(2),owner:low.owner,team:low.team,year:low.g.year,detail:`Week ${low.g.week} vs ${low.opp}`},gameRecord('Biggest Blowout',byMargin[0]),gameRecord('Closest Game',byMargin.at(-1))];
  d.meta.games=d.matchups.length;d.meta.regularGames=d.matchups.filter(g=>g.scope==='Regular Season').length;d.meta.playoffGames=d.meta.games-d.meta.regularGames;
  d.meta.playerWeeks=d.players.flatMap(p=>p.history).reduce((n,h)=>n+h.starts+h.bench+h.ir,0);d.meta.dataThrough=`2026 Week ${z.week}`;
  window.ZYNFL_LATEST_ROSTER=rows(z.week);
})();
