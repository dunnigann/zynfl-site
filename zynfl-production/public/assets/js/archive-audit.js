/* Playoff finishes come from scored bracket games, never the regular-season table. */
(() => {
  const d=window.ZYNFL_DATA,round=n=>Math.round(n*100)/100;
  const report={asOf:'2026-10-14',gamesChecked:0,repairs:[],seasons:{},games:[]};
  const seen=new Set();
  for(const g of d.matchups){
    const key=[g.year,g.week,...[g.aOwner,g.bOwner].sort()].join('|');
    if(seen.has(key))throw Error('Duplicate archived game: '+key);seen.add(key);
    if(!Number.isFinite(g.aScore)||!Number.isFinite(g.bScore)||g.aOwner===g.bOwner)throw Error('Invalid archived game: '+key);
    const winner=g.aScore>g.bScore?g.aOwner:g.bScore>g.aScore?g.bOwner:null;
    if(g.winner!==winner){report.repairs.push({key,field:'winner',before:g.winner,after:winner});g.winner=winner;}
    report.gamesChecked++;
  }
  d.finalPlacements={};d.placementGames={};
  for(const year of [2024,2025]){
    const regular=d.matchups.filter(g=>g.year===year&&g.scope==='Regular Season');
    const standings=d.standings[year];
    for(const s of standings){
      const games=regular.filter(g=>g.aOwner===s.owner||g.bOwner===s.owner);
      const values={w:games.filter(g=>g.winner===s.owner).length,l:games.filter(g=>g.winner&&g.winner!==s.owner).length,t:games.filter(g=>!g.winner).length,g:games.length,pf:round(games.reduce((n,g)=>n+(g.aOwner===s.owner?g.aScore:g.bScore),0)),pa:round(games.reduce((n,g)=>n+(g.aOwner===s.owner?g.bScore:g.aScore),0))};values.diff=round(values.pf-values.pa);
      for(const [field,value]of Object.entries(values)){if(Math.abs((s[field]??0)-value)>.001)report.repairs.push({year,owner:s.owner,field,before:s[field],after:value});s[field]=value;}
    }
    const seedOrder=standings.slice().sort((a,b)=>(b.w+.5*b.t)-(a.w+.5*a.t)||b.pf-a.pf);
    seedOrder.forEach((s,i)=>{if(s.rank!==i+1)report.repairs.push({year,owner:s.owner,field:'regularSeed',before:s.rank,after:i+1});s.rank=i+1;});d.standings[year]=seedOrder;
    const seeds=new Map(seedOrder.map(s=>[s.owner,s.rank]));
    const postseason=d.matchups.filter(g=>g.year===year&&g.scope!=='Regular Season');
    const classified=new Set(),lookup=(week,a,b,stage)=>{const matches=postseason.filter(g=>g.week===week&&[g.aOwner,g.bOwner].includes(a)&&[g.aOwner,g.bOwner].includes(b));if(matches.length!==1)throw Error(`${year} ${stage}: expected exactly one ${a}–${b} game`);const g=matches[0];if(!g.winner)throw Error('Bracket tie requires Yahoo tiebreak: '+year+' '+stage);g.stage=stage;classified.add(g);return g;};
    const loser=g=>g.winner===g.aOwner?g.bOwner:g.aOwner,finish={},terminal=[];
    function bracket(offset){
      const field=seedOrder.slice(offset,offset+6).map(s=>s.owner);
      const q=[lookup(15,field[2],field[5],offset?'Consolation quarterfinal':'Championship quarterfinal'),lookup(15,field[3],field[4],offset?'Consolation quarterfinal':'Championship quarterfinal')];
      const advanced=q.map(g=>g.winner).sort((a,b)=>seeds.get(a)-seeds.get(b));
      const semifinals=[lookup(16,field[0],advanced[1],offset?'Consolation semifinal':'Championship semifinal'),lookup(16,field[1],advanced[0],offset?'Consolation semifinal':'Championship semifinal')];
      const lower=lookup(16,loser(q[0]),loser(q[1]),`${offset+5}th-place game`),title=lookup(17,semifinals[0].winner,semifinals[1].winner,offset?'7th-place game':'Championship'),third=lookup(17,loser(semifinals[0]),loser(semifinals[1]),`${offset+3}${offset?'th':'rd'}-place game`);
      for(const [g,place]of [[title,offset+1],[third,offset+3],[lower,offset+5]]){finish[g.winner]=place;finish[loser(g)]=place+1;g.placement=place;terminal.push(g);}
    }
    bracket(0);bracket(6);if(classified.size!==postseason.length)throw Error('Unclassified postseason game for '+year);
    d.finalPlacements[year]=finish;d.placementGames[year]=terminal.sort((a,b)=>a.placement-b.placement);
    for(const s of seedOrder){s.finalRank=finish[s.owner];const timeline=d.owners[s.owner].seasons.find(s=>s.year===year);Object.assign(timeline,{rank:s.rank,finalRank:s.finalRank,record:`${s.w}-${s.l}${s.t?'-'+s.t:''}`,pf:s.pf,pa:s.pa,diff:s.diff});}
    const ownerAt=n=>Object.keys(finish).find(o=>finish[o]===n),teamFor=o=>seedOrder.find(s=>s.owner===o).team;
    const champion=ownerAt(1),silver=ownerAt(2),bronze=ownerAt(3),last=ownerAt(12),final=terminal.find(g=>g.placement===1);
    Object.assign(d.seasons[year],{champion,championTeam:teamFor(champion),runnerUp:silver,runnerUpTeam:teamFor(silver),bronze,bronzeTeam:teamFor(bronze),wall:last,finalPlacements:finish,standings:seedOrder,finalScore:`${Math.max(final.aScore,final.bScore).toFixed(2)}–${Math.min(final.aScore,final.bScore).toFixed(2)}`});
    const pod=d.podium.find(x=>x.year===year);Object.assign(pod,{gold:champion,goldTeam:teamFor(champion),silver,silverTeam:teamFor(silver),bronze,bronzeTeam:teamFor(bronze)});
    const shame=d.wallOfShame.find(x=>x.year===year);if(shame.owner!==last)report.repairs.push({year,field:'lastPlace',before:shame.owner,after:last});Object.assign(shame,{owner:last,team:teamFor(last)});
    report.seasons[year]={regularGames:regular.length,postseasonGames:postseason.length,finalPlacements:finish,decidingGames:terminal.map(g=>({place:g.placement,week:g.week,a:g.aOwner,aScore:g.aScore,b:g.bOwner,bScore:g.bScore,winner:g.winner}))};
  }
  for(const o of Object.values(d.owners)){o.titles=d.podium.filter(p=>p.gold===o.name).length;o.silver=d.podium.filter(p=>p.silver===o.name).length;o.bronze=d.podium.filter(p=>p.bronze===o.name).length;o.brown=d.wallOfShame.filter(p=>p.owner===o.name).length;}
  report.games=d.matchups.map(g=>({year:g.year,week:g.week,a:g.aOwner,aScore:g.aScore,b:g.bOwner,bScore:g.bScore,winner:g.winner,scope:g.scope,stage:g.stage||'Regular season',placement:g.placement||null}));
  window.ZYNFL_ARCHIVE_AUDIT=report;
})();
