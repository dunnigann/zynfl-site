/* The exact seed guide and the simulation are separate views of the same Yahoo schedule. */
const playoffWorkerUrl='assets/js/playoff-scenarios.js?v=20261124-postseason';
const playoffView={teamId:null,seed:null,route:null,key:null,forecast:null,paths:new Map()};
let playoffWorker,playoffRequest=0;
const playoffInflight=new Map();

function playoffModel(){
 const snapshot=window.ZYNFL_PLAYOFF_SNAPSHOT,scenarios=window.ZYNFL_PLAYOFF_SCENARIOS;
 const ordered=[
  window.ZYNFL_PLAYOFF_LIVE,
  window.ZYNFL_YAHOO_SEASONS?.find(s=>s.year===2026),
  snapshot
 ].filter(Boolean).sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0));
 const leagueWeek=scenarios.seedGuideWeek(ordered.find(s=>s!==snapshot),snapshot);
 for(const season of ordered){
  const model=scenarios.prepare(season);
  if(model)return leagueWeek===model.currentWeek?model:
   {...model,currentWeek:leagueWeek,stamp:model.stamp+':week-'+leagueWeek};
 }
 return null;
}
function calculatePlayoffPaths(model,teamId){
 const key=`${model.stamp}:${teamId}`;
 if(playoffView.paths.has(key))return playoffView.paths.get(key);
 const result=new Promise((resolve,reject)=>{
  // The same solver runs directly when workers are unavailable.
  const direct=()=>setTimeout(()=>{try{resolve(window.ZYNFL_PLAYOFF_SCENARIOS.buildPaths(model,teamId));}catch(error){reject(error);}},0);
  try{
   if(!playoffWorker){
    playoffWorker=new Worker(playoffWorkerUrl);
    playoffWorker.onmessage=({data})=>{
     const done=playoffInflight.get(data.request);
     if(!done)return;
     playoffInflight.delete(data.request);
     data.error?done():done(data.paths);
    };
    playoffWorker.onerror=()=>{
     playoffWorker.terminate();playoffWorker=null;
     for(const done of playoffInflight.values())done();
     playoffInflight.clear();
    };
   }
   const request=++playoffRequest;
   playoffInflight.set(request,paths=>paths?resolve(paths):direct());
   try{playoffWorker.postMessage({request,model,teamId});}
   catch{playoffInflight.delete(request);direct();}
  }catch{direct();}
 });
 playoffView.paths.set(key,result);
 result.catch(()=>playoffView.paths.delete(key));
 return result;
}
const spPoints=cents=>(Math.abs(cents)/100).toFixed(2);
const spTeam=(model,id)=>model.teams.find(t=>t.id===id);
const spOwner=(model,id)=>zEsc(spTeam(model,id)?.owner||'Unknown team');
const spOwners=(model,ids)=>new Intl.ListFormat('en',{style:'long',type:'conjunction'}).format(ids.map(id=>spOwner(model,id)));
const spRecord=t=>`${t.w}–${t.l}${t.t?`–${t.t}`:''}`;
const spBracket=(model,seed)=>seed<=model.byes?'First-round bye':seed<=model.qualifiers?'Championship bracket':'Consolation bracket';

function spMargin(r,direction=1){
 const gap=direction*r.gap,tieOnly=direction===1?r.tieAheadOnly:r.tieBehindOnly;
 if(tieOnly)return 'Must tie on season points and win the most recent matchup score tiebreaker.';
 if(gap<=0)return `Outscore by at least <strong>${spPoints(1-gap)} pts</strong> the rest of the way.`;
 if(gap===1)return 'Match or beat their scoring the rest of the way.';
 return `Can be outscored by up to <strong>${spPoints(gap-1)} pts</strong> the rest of the way and stay ahead.`;
}
function spOutcomes(model,games,selfId=null){
 return `<ul class="sp-outcomes">${games.map(g=>{
  const rival=g.a===selfId?g.b:g.a,loser=g.winner===g.a?g.b:g.a;
  const text=selfId===null?(g.winner===null?`${spOwner(model,g.a)} and ${spOwner(model,g.b)} tie`:`${spOwner(model,g.winner)} beats ${spOwner(model,loser)}`):
   `${g.winner===null?'Tie':g.winner===selfId?'Beat':'Lose to'} ${spOwner(model,rival)}`;
  return `<li><span>Week ${g.week}</span><strong>${text}</strong></li>`;
 }).join('')}</ul>`;
}
function spRankConditions(model,team,path){
 const {gate,record}=path,owner=zEsc(team.owner),locked=gate.locked.length,rivals=gate.rivals.length;
 const already=locked?`<p class="sp-context">${spOwners(model,gate.locked)} ${locked===1?'is':'are'} already ahead given these results.</p>`:'';
 if(!rivals)return `${already}<p>These results alone secure this seed.</p>`;
 const direction=gate.extra===0?1:gate.extra===rivals?-1:0;
 const headline=direction===1?`Keep the teams below behind ${owner}.`:direction===-1?`All ${rivals} ${rivals===1?'team needs':'teams need'} to finish ahead of ${owner}.`:
  `Exactly <strong>${gate.extra} of the ${rivals}</strong> teams below must finish ahead of ${owner}.`;
 const details=gate.rivals.map(r=>{
  let line;
  if(direction===1){
   line=r.lower&&r.higher?`Finish ${record} or worse.`:r.higher&&!r.lower?(r.room===0&&r.open>0?`Must lose all ${r.open} remaining ${r.open===1?'game':'games'}.`:`Cannot finish better than ${record}.`):r.lower?`Can only catch ${owner} by matching ${record}.`:`Finishes tied at ${record} given these results.`;
  }else if(direction===-1){
   line=r.higher?`Finish ahead of ${record} or win the tiebreaker.`:`Must reach ${record} to have a chance on points.`;
  }else line=r.higher?`Can finish above ${record} on record.`:`Can only pass ${owner} by matching ${record}.`;
  const points=r.tied&&r.points?` <span class="sp-margin">If records tie: ${direction===-1?`${spOwner(model,r.id)} needs the edge. `:direction===0?`For ${owner} to stay ahead: `:''}${spMargin(r,direction||1)}</span>`:'';
  return `<li><strong>${spOwner(model,r.id)}</strong><div>${line}${points}</div></li>`;
 }).join('');
 return `${already}<p>${headline}</p><ul class="sp-rivals">${details}</ul>`;
}
function spExample(model,path,team){
 const tie=path.points,cases=tie?`<div class="sp-example-points"><p>${zEsc(team.owner)} must finish ahead of <strong>${tie.ahead}</strong> and behind <strong>${tie.behind}</strong> of these teams on the points tiebreaker: ${spOwners(model,tie.rivals.map(r=>r.id))}.</p></div>`:'';
 if(!path.help.length&&!cases)return '';
 const others=path.help.length?spOutcomes(model,path.help):'<p>No other matchup results are required for this example.</p>';
 return `<details class="sp-example"><summary>One set of results that works</summary><div>${others}${cases}<p class="sp-context">Unlisted matchups can go either way for this example.</p></div></details>`;
}

function drawPlayoffSeed(model,team,seeds,inside){
 const result=seeds.find(x=>x.seed===playoffView.seed)||seeds[0];
 playoffView.seed=result.seed;
 const path=result.paths.find(x=>x.route===playoffView.route)||result.paths[0];
 playoffView.route=path.route;
 inside.querySelectorAll('[data-playoff-seed]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.playoffSeed)===result.seed)));
 inside.querySelector('.sp-path').innerHTML=`<div class="sp-path-top"><div><span class="sp-tag">${spBracket(model,result.seed)}</span><h3>Seed ${result.seed}</h3></div>${result.paths.length>1?`<label class="sp-select-label"><span>Remaining results</span><select class="sp-select" id="sp-finish">${result.paths.map(p=>`<option value="${p.route}" ${p.route===path.route?'selected':''}>${p.finish} · ${p.own.map((g,i)=>`W${g.week} ${({W:'Win',L:'Loss',T:'Tie'})[p.route[i]]}`).join(', ')}</option>`).join('')}</select></label>`:''}</div>
 <div class="sp-plan"><section><h4>${zEsc(team.owner)}’s games</h4>${path.own.length?spOutcomes(model,path.own,team.id):'<p>Regular season complete.</p>'}<p class="sp-finish">Final record <strong>${path.record}</strong></p></section><section><h4>Around the league</h4>${spRankConditions(model,team,path)}</section></div>${spExample(model,path,team)}`;
 inside.querySelector('#sp-finish')?.addEventListener('change',event=>{
  playoffView.route=event.target.value;drawPlayoffSeed(model,team,seeds,inside);
  inside.querySelector('#sp-finish')?.focus({preventScroll:true});
 });
}

async function drawPlayoffGuide(model,inside){
 const team=spTeam(model,playoffView.teamId);
 if(!team)return;
 inside.setAttribute('aria-busy','true');
 inside.innerHTML='<p class="sp-state" role="status">Calculating possible seeds…</p>';
 try{
  const result=await calculatePlayoffPaths(model,team.id);
  if(!inside.isConnected||playoffView.teamId!==team.id||inside.dataset.team!==String(team.id))return;
  if(!result){inside.innerHTML='<p class="sp-state">Waiting for Yahoo to finalize the previous week.</p>';return;}
  if(result.eliminated){inside.innerHTML='<p class="sp-state sp-eliminated"><strong>Eliminated</strong></p>';return;}
  inside.innerHTML=`<div class="sp-seed-picker"><div class="sp-seed-label"><strong>Possible seeds</strong>${result.clinched?'<span class="sp-clinched">Playoff spot clinched</span>':''}</div><div class="sp-seed-buttons" role="group" aria-label="Choose a possible seed">${result.seeds.map(({seed})=>`<button type="button" aria-pressed="false" aria-label="Seed ${seed}, ${spBracket(model,seed).toLowerCase()}" data-playoff-seed="${seed}" class="${seed<=model.qualifiers?'sp-in-bracket':''}">${seed}</button>`).join('')}</div></div><div class="sp-path"></div>`;
  const wanted=playoffView.seed,defaultSeed=result.seeds.some(x=>x.seed===team.standing)?team.standing:result.seeds[0].seed;
  if(!result.seeds.some(x=>x.seed===wanted))playoffView.seed=defaultSeed;
  inside.querySelectorAll('[data-playoff-seed]').forEach(b=>b.onclick=()=>{
   if(Number(b.dataset.playoffSeed)!==playoffView.seed)playoffView.route=null;
   playoffView.seed=Number(b.dataset.playoffSeed);drawPlayoffSeed(model,team,result.seeds,inside);
  });
  drawPlayoffSeed(model,team,result.seeds,inside);
 }catch{
  if(inside.isConnected&&inside.dataset.team===String(team.id))inside.innerHTML='<p class="sp-state">Seed paths couldn’t be calculated. Refresh to try again.</p>';
 }finally{
  if(inside.dataset.team===String(team.id))inside.setAttribute('aria-busy','false');
 }
}

function spForecast(model){
 if(playoffView.forecast)return playoffView.forecast;
 const games=model.completed.concat(model.remaining.map(g=>({...g,aOwner:model.teams[g.a].owner,bOwner:model.teams[g.b].owner,complete:false,playoffs:false})));
 playoffView.forecast=window.ZYNFL_YAHOO_MODEL.forecast({teams:model.teams.map(t=>({...t,pf:t.pf/100,rank:t.standing})),games,settings:{playoffTeams:model.qualifiers}});
 return playoffView.forecast;
}
function spProbability(value,label){
 const percentage=Math.max(0,Math.min(100,value*100));
 return `<div class="sp-probability"><span>${percentage.toFixed(1)}%</span><span class="sp-probability-track" role="progressbar" aria-label="${zEsc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage.toFixed(1)}"><i style="width:${percentage}%"></i></span></div>`;
}
function renderPlayoffPredictor(){
 document.body.dataset.seasonYear=2026;
 const model=playoffModel();
 if(!model){app.innerHTML=`<div class="page sp-page">${pageHeader('Playoff Predictor')}<div class="wrap"><p class="sp-state" role="status">Waiting for Yahoo standings and the regular-season schedule.</p></div></div>`;return;}
 if(playoffView.key===model.stamp&&app.querySelector('.sp-page .sp-layout'))return;
 if(playoffView.key!==model.stamp){
  playoffView.key=model.stamp;playoffView.forecast=null;playoffView.paths.clear();
 }
 if(!spTeam(model,playoffView.teamId))playoffView.teamId=(model.order.find(t=>t.owner==='Quinn')||model.order[0]).id;
 const forecast=spForecast(model),showGuide=window.ZYNFL_PLAYOFF_SCENARIOS.showSeedScenarios(model.currentWeek);
 app.innerHTML=`<div class="page sp-page">${pageHeader('Playoff Predictor')}
 <div class="wrap sp-layout">
  ${showGuide?`<section class="sp-block" aria-labelledby="sp-guide-heading">
   <div class="sp-section-top"><div><h2 id="sp-guide-heading">Seed scenarios</h2><p class="sp-context">${model.year} · Results through Week ${model.through}${model.remaining.length?` · ${model.through+1===model.end?`Week ${model.end}`:`Weeks ${model.through+1}–${model.end}`} left`:''}</p></div>
    <label class="sp-select-label"><span>Team</span><select id="sp-team" class="sp-select">${model.order.map(t=>`<option value="${t.id}" ${t.id===playoffView.teamId?'selected':''}>${zEsc(t.name||t.owner)} · ${zEsc(t.owner)}</option>`).join('')}</select></label></div>
   <div id="sp-team-current" class="sp-team-current"></div>
   <div id="sp-guide"></div>
   <details class="sp-method"><summary>Seeding rules</summary><p>The top ${model.qualifiers} make the championship bracket${model.byes?` and the top ${model.byes} get a bye`:''}. Paths use the remaining Yahoo schedule, including the possibility of a tied game. Teams rank by win percentage (a tie is half a win), then season points. If season points are exactly tied, newer weekly scores decide first. Unfinished games are open outcomes.</p></details>
  </section>`:''}
  <section class="sp-block sp-forecast" aria-labelledby="sp-forecast-heading">
   <div class="sp-section-top"><h2 id="sp-forecast-heading">Playoff odds</h2></div>
   <div class="sp-table-wrap"><table aria-label="Playoff odds by team"><thead><tr><th scope="col">Team</th><th scope="col">Playoffs</th><th scope="col">First-round bye</th><th scope="col">Expected seed</th><th scope="col">Expected wins</th></tr></thead>
    <tbody>${forecast.map(r=>{
     const team=model.teams.find(t=>t.owner===r.owner);
     return `<tr><th scope="row"><strong>${zEsc(team.name||r.owner)}</strong><small>${zEsc(r.owner)}</small></th><td>${spProbability(r.playoff,`${r.owner} playoff odds`)}</td><td>${spProbability(r.bye,`${r.owner} first-round bye odds`)}</td><td>${r.seed.toFixed(1)}</td><td>${r.wins.toFixed(1)}</td></tr>`;
    }).join('')}</tbody></table></div>
   <details class="sp-method"><summary>How the odds are estimated</summary><p>5,000 simulations use the ${model.remaining.length} remaining matchups, each team’s scoring average and its week-to-week scoring variation. These are estimates.${showGuide?' The seed scenarios above are calculated from the schedule.':''}</p></details>
  </section>
 </div></div>`;
 if(!showGuide)return;
 const pick=document.getElementById('sp-team'),guide=document.getElementById('sp-guide');
 function teamChange(){
  guide.dataset.team=String(playoffView.teamId);
  const t=spTeam(model,playoffView.teamId);
  document.getElementById('sp-team-current').innerHTML=`<span>Current seed <strong>${t.standing}</strong></span><span>Record <strong>${spRecord(t)}</strong></span><span>Points for <strong>${spPoints(t.pf)}</strong></span>`;
  if(!model.available||model.through<model.currentWeek-1){guide.innerHTML='<p class="sp-state">Waiting for Yahoo to finalize the previous week.</p>';return;}
  drawPlayoffGuide(model,guide);
 }
 pick.addEventListener('change',()=>{playoffView.teamId=Number(pick.value);playoffView.seed=null;playoffView.route=null;teamChange();});teamChange();
}
