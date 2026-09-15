/* ZYNFL 2026 prototype. Screenshot scores are a fixed, reviewable snapshot. */
const Z26=window.ZYNFL_2026;
const zState={mode:'zynfl',match:0,rankView:'analyst'};
const zEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const zPts=n=>n==null?'Unavailable':Number(n).toFixed(2);
const zPlayer=id=>Z26.players.find(p=>p.id===id);
const zRoster=o=>Z26.teams[o].players.map(zPlayer);
const zScore=p=>p.status==='projected'?p.projection:p.points;
const zTotal=o=>zRoster(o).filter(p=>p.slot!=='BN'&&p.slot!=='IR').reduce((s,p)=>s+(zScore(p)??0),0);
const zOpponent=o=>Z26.matchups.find(g=>g.includes(o)).find(x=>x!==o);
const zRecord=o=>zTotal(o)===zTotal(zOpponent(o))?'0–0–1':zTotal(o)>zTotal(zOpponent(o))?'1–0':'0–1';
const zInitials=n=>n.split(/\s+/).map(x=>x[0]).slice(0,2).join('');
function zPhoto(src,name,cls=''){return `<span class="z-photo ${cls}">${src?'':`<span aria-hidden="true">${zEsc(zInitials(name))}</span>`}${src?`<img src="${zEsc(src)}" alt="" loading="lazy">`:''}</span>`;}
function zWireImages(root=app){root.querySelectorAll('.z-photo img').forEach(img=>{img.addEventListener('error',()=>{const parent=img.parentElement;img.remove();parent.textContent='—';},{once:true});});}
function zWeekButtons(){return `<div class="z-weekbar" aria-label="Season week"><span>2026</span>${Array.from({length:18},(_,i)=>`<button ${i?'disabled title="Not published yet"':'aria-pressed="true" class="active"'}>W${i+1}</button>`).join('')}</div>`;}
function zBubble(p,nfl=false,compact=false){
 const score=zScore(p),size=compact?50:Math.round(42+9*Math.sqrt(Math.min(45,Math.max(0,score??0))));
 const owner=p.owner?Z26.teams[p.owner]:null;
 return `<button class="z-player ${compact?'z-compact':''}" data-z-player="${zEsc(p.id)}" style="--bubble:${size}px;--owner:${owner?.color||'#8ca0b6'}" aria-label="Open ${zEsc(p.name)} player details">${zPhoto(p.headshot,p.name,'z-player-photo')}<strong>${zEsc(p.name)}</strong>${nfl?`<em>${zEsc(owner?.name||'Not on supplied ZYNFL rosters')}</em>`:`<small>${zEsc(p.slot)} · ${zEsc(p.nfl)}</small>`}</button>`;
}
function zLine(){return `<div class="z-line" aria-label="Offensive line decoration">${['LT','LG','C','RG','RT'].map(p=>`<span class="${p==='C'?'z-center':''}" aria-hidden="true"></span>`).join('')}</div>`;}
function zFormation(rows,top,nfl){
 let qb,backs,wings;
 if(nfl){qb=rows.find(p=>p.position==='QB');backs=rows.filter(p=>['RB','FB'].includes(p.position)).slice(0,2);wings=rows.filter(p=>['WR','TE'].includes(p.position)).slice(0,4);}
 else{qb=rows.find(p=>p.slot==='QB');backs=rows.filter(p=>p.slot==='RB');wings=['WR','WR','TE','FLEX'].map((slot,i)=>slot==='WR'?rows.filter(p=>p.slot==='WR')[i]:rows.find(p=>p.slot===slot)).filter(Boolean);}
 return `<div class="z-formation ${top?'z-top':'z-bottom'}"><div class="z-backs">${backs.map(p=>zBubble(p,nfl)).join('')}</div><div class="z-qb">${qb?zBubble(qb,nfl):'<span>QB unavailable</span>'}</div><div class="z-receivers">${wings.map(p=>zBubble(p,nfl)).join('')}</div>${zLine()}${nfl?'':`<div class="z-field-specialists">${rows.filter(p=>['K','DEF'].includes(p.slot)).map(p=>zBubble(p,false,true)).join('')}</div>`}</div>`;
}
function zSideHeader(key,score,nfl,bottom=false){
 const t=nfl?Z26.nflTeams[key]:Z26.teams[key];const title=nfl?t.name:t.name;
 const photo=nfl?t.logo:teamPhoto(key);
 return `<div class="z-team-header ${bottom?'z-header-bottom':''}">${zPhoto(photo,title,nfl?'z-nfl-logo':'')}<div><span class="z-eyebrow">${nfl?key:key==='Chuck'?'Charlie (Chuck)':key==='Santi'?'Santiago (Santi)':key} ${nfl?'':'· '+zRecord(key)}</span><h2>${zEsc(title)}</h2></div><div class="z-team-score"><strong>${nfl?Math.round(score):zPts(score)}</strong><small>${nfl?'NFL final':'Week 1 points'}</small></div></div>`;
}
function renderMatchups(){
 document.body.dataset.seasonYear=2026;
 app.innerHTML=`<div class="page z-page"><section class="z-page-heading wrap"><div><div class="eyebrow">THE LEAGUE, ON THE FIELD</div><h1>Matchups<span class="z-label">Prototype</span></h1><p>Every player. Every owner. One field.</p></div><a class="z-text-link" href="#season2026" data-z-go="season2026">Read the Week 1 recap ↗</a></section><div class="wrap">${zWeekButtons()}<div class="z-match-layout"><aside class="z-sidebar"><label for="zMatchMode">Matchup view</label><select id="zMatchMode"><option value="zynfl">ZYNFL matchups</option><option value="nfl">NFL matchups</option></select><div id="zMatchList" class="z-match-list" aria-label="Choose a matchup"></div></aside><section class="z-match-main" aria-label="Selected matchup"><div class="z-field-note">Tap a player for points, projection & game log. Bigger bubbles mean more fantasy points.<span>Week 1 snapshot · September 15</span></div><div id="zField"></div></section></div></div></div>`;
 document.getElementById('zMatchMode').value=zState.mode;
 document.getElementById('zMatchMode').onchange=e=>{zState.mode=e.target.value;zState.match=0;zDrawMatchups();};
 document.querySelectorAll('[data-z-go]').forEach(b=>b.onclick=e=>{e.preventDefault();go(b.dataset.zGo);});zDrawMatchups();
}
function zDrawMatchups(){
 const nfl=zState.mode==='nfl',games=nfl?Z26.nflMatchups:Z26.matchups;
 const list=document.getElementById('zMatchList');
 list.innerHTML=games.map((g,i)=>`<button class="z-match-choice ${zState.match===i?'selected':''}" data-match="${i}" aria-pressed="${zState.match===i}"><small>WEEK 1 · FINAL</small>${[g[0],g[1]].map((key,j)=>`<span><b>${zEsc(nfl?key:key==='Chuck'?'Charlie':key==='Santi'?'Santi':key)}</b><strong>${nfl?Math.round(g[j+2]):zPts(zTotal(key))}</strong></span>`).join('')}</button>`).join('');
 list.querySelectorAll('[data-match]').forEach(b=>b.onclick=()=>{zState.match=Number(b.dataset.match);zDrawMatchups();});
 const g=games[zState.match],keys=g.slice(0,2);
 const roster=keys.map(k=>nfl?Z26.nflTeams[k].starters.map(x=>zPlayer(x.id)):zRoster(k));
 const field=document.getElementById('zField');
 field.innerHTML=`<div class="z-field-scroll" tabindex="0" aria-label="Football field; scroll horizontally on smaller screens"><div class="z-field">${zSideHeader(keys[0],nfl?g[2]:zTotal(keys[0]),nfl)}${zFormation(roster[0],true,nfl)}<div class="z-midfield"><span>ZYNFL</span><small>WEEK 01</small></div>${zFormation(roster[1],false,nfl)}${zSideHeader(keys[1],nfl?g[3]:zTotal(keys[1]),nfl,true)}</div></div>${nfl?`<div class="z-depth-note">NFL view uses a September 15 depth-chart snapshot; formations are illustrative. A depth-chart listing does not guarantee availability. Players outside the supplied screenshots have no fantasy score or projection.<div>${keys.map(k=>`<a href="${Z26.nflTeams[k].source}" target="_blank" rel="noopener noreferrer">${k} depth chart ↗</a>`).join(' · ')}</div></div><details class="z-reserves"><summary>More rostered players in this NFL game</summary><div class="z-bench-grid">${Z26.players.filter(p=>p.owner&&keys.includes(p.nfl)&&!roster.flat().some(x=>x.id===p.id)).map(p=>zBubble(p,true,true)).join('')||'<p>No additional players.</p>'}</div></details><details class="z-reserves"><summary>Owner colors</summary><div class="z-legend">${Object.entries(Z26.teams).map(([o,t])=>`<span><i style="background:${t.color}"></i>${zEsc(t.name)}</span>`).join('')}</div></details>`:keys.map((k,i)=>`<details class="z-reserves"><summary>${zEsc(k)}’s bench · ${roster[i].filter(p=>p.slot==='BN').length} players</summary><div class="z-bench-grid">${roster[i].filter(p=>p.slot==='BN').map(p=>zBubble(p,false,true)).join('')}</div></details>`).join('')}`;
 field.querySelectorAll('[data-z-player]').forEach(b=>b.onclick=()=>zOpenPlayer(b.dataset.zPlayer));zWireImages(field);
}
function zDialog(){let d=document.getElementById('zPlayerDialog');if(!d){d=document.createElement('dialog');d.id='zPlayerDialog';d.className='z-dialog';document.body.append(d);d.addEventListener('click',e=>{if(e.target===d)d.close();});}return d;}
function zOpenPlayer(id){
 const p=zPlayer(id),d=zDialog(),game=Z26.nflMatchups.find(g=>g.slice(0,2).includes(p.nfl));const opponent=game?.slice(0,2).find(t=>t!==p.nfl);
 d.innerHTML=`<button class="z-dialog-close" aria-label="Close player details">×</button><div class="z-dialog-heading">${zPhoto(p.headshot,p.name)}<div><span class="z-eyebrow">${zEsc(p.position)} · ${zEsc(p.nfl)}</span><h2 id="zDialogTitle">${zEsc(p.name)}</h2><p>${zEsc(p.owner?Z26.teams[p.owner].name:'Not on supplied ZYNFL rosters')}</p></div></div><div class="z-detail-stats"><div><strong>${zPts(zScore(p))}</strong><small>${p.status==='projected'?'Assumed points (projection)':'Fantasy points'}</small></div><div><strong>${zPts(p.projection)}</strong><small>Screenshot projection</small></div><div><strong>${p.points==null||p.projection==null?'—':(p.points-p.projection>0?'+':'')+(p.points-p.projection).toFixed(2)}</strong><small>vs. projection</small></div></div>${Z26.injuryNotes[p.name]?`<p class="z-injury">${zEsc(Z26.injuryNotes[p.name])}</p>`:''}<h3>2026 game log</h3><div class="z-table-scroll"><table class="z-log"><thead><tr><th>Week</th><th>Opponent</th><th>Lineup</th><th>Points</th><th>Projection</th><th>Status</th></tr></thead><tbody><tr><td>1</td><td>${opponent||'—'}</td><td>${zEsc(p.owner?p.slot:'—')}</td><td>${zPts(zScore(p))}</td><td>${zPts(p.projection)}</td><td>${p.status==='final'?'Final':p.status==='projected'?'Assumed':'Not supplied'}</td></tr></tbody></table></div>`;
 d.setAttribute('aria-labelledby','zDialogTitle');d.querySelector('.z-dialog-close').onclick=()=>d.close();zWireImages(d);d.showModal();
}
// Maximum possible score from supplied players in legal QB/RB/RB/WR/WR/TE/FLEX/K/DEF slots.
function zOptimal(owner){
 const pool=zRoster(owner).filter(p=>p.slot!=='IR');let best={score:-Infinity,ids:[]};
 const slots=['QB','RB','RB','WR','WR','TE','FLEX','K','DEF'];
 function visit(i,ids,score){if(i===slots.length){if(score>best.score)best={score,ids:[...ids]};return;}const slot=slots[i];for(const p of pool){if(ids.includes(p.id))continue;if(slot==='FLEX'?!['RB','WR','TE'].includes(p.position):p.position!==slot)continue;visit(i+1,[...ids,p.id],score+(zScore(p)??0));}}
 visit(0,[],0);return best;
}
function zJackOrder(){try{const v=JSON.parse(localStorage.getItem('zynfl-jack-rankings-2026-w1-published'));if(zValidOrder(v))return v;}catch{}return zValidOrder(Z26.jackRankings['1'])?Z26.jackRankings['1']:null;}
function zValidOrder(a){return Array.isArray(a)&&a.length===12&&new Set(a).size===12&&a.every(o=>Z26.teams[o]);}
function zScheduleNote(owner){
 const games=Z26.futureSchedule.filter(g=>g.week>1&&(g.a===owner||g.b===owner));
 if(!games.length)return '';
 const strength=games.reduce((s,g)=>s+Z26.analystRankings.indexOf(g.a===owner?g.b:g.a)+1,0)/games.length;
 return `Remaining opponents: average analyst rank ${strength.toFixed(1)} across ${games.length} supplied games (higher = easier).`;
}
function renderSeason2026(){
 document.body.dataset.seasonYear=2026;
 const highest=Object.keys(Z26.teams).sort((a,b)=>zTotal(b)-zTotal(a))[0];
 app.innerHTML=`<div class="page z-page"><section class="z-season-hero"><div class="wrap"><div class="eyebrow">2026 SEASON · WEEK ONE</div><h1>A new season.<br><span>Twelve different stories.</span></h1><p>Brock sets the pace. Mitchell arrives with a win. Quinn escapes by 4.66.</p><div class="z-hero-actions"><a href="#matchups" data-z-go="matchups">Explore the matchups ↗</a><span>Week 1 final scores · subject to stat corrections</span></div></div></section><div class="wrap">${zWeekButtons()}<div class="z-week-highlights"><div><small>HIGH SCORE</small><strong>${zPts(zTotal(highest))}</strong><span>${zEsc(highest)}</span></div><div><small>CLOSEST GAME</small><strong>4.66</strong><span>Quinn over Nick</span></div><div><small>BIGGEST PLAYER SCORE</small><strong>37.26</strong><span>Caleb Williams · Brock</span></div></div><section class="z-section"><div class="z-section-head"><div class="eyebrow">AROUND THE NFL</div><h2>The week's reading list.</h2><p>News that changes a ZYNFL lineup. Reports through September 15, 2026.</p></div><div class="z-news-grid">${Z26.news.map(a=>`<a class="z-news" href="${zEsc(a.url)}" target="_blank" rel="noopener noreferrer"><small>${zEsc(a.source)} · ${a.date.slice(5)}</small><h3>${zEsc(a.title)} ↗</h3><p>${zEsc(a.description)}</p><span>${a.owners.map(zEsc).join(' · ')||'League-wide'}</span></a>`).join('')}</div></section><section class="z-section"><div class="z-section-head"><div class="eyebrow">THE WEEKLY REVIEW</div><h2>How every team got here.</h2><p>Bench comparisons are hindsight, using only legal substitutions among the supplied players.</p></div><div class="z-recap-grid">${Object.keys(Z26.teams).map(o=>{const opt=zOptimal(o),missed=Math.max(0,opt.score-zTotal(o)),opp=zOpponent(o);return `<article class="z-recap" style="--owner:${Z26.teams[o].color}"><div class="z-recap-heading">${zPhoto(teamPhoto(o),o)}<div><small>${zEsc(o)} · ${zRecord(o)}</small><h3>${zEsc(Z26.teams[o].name)}</h3></div><strong>${zPts(zTotal(o))}</strong></div><div class="z-result">${zTotal(o)>zTotal(opp)?'WIN':'LOSS'} vs. ${zEsc(opp)} · ${zPts(zTotal(o))}–${zPts(zTotal(opp))}</div><p>${zEsc(Z26.recaps[o])}</p><details><summary>${missed.toFixed(2)} available bench points left</summary><p>Best legal lineup: ${zPts(opt.score)}. Same roster, no waiver additions. IR players excluded.</p><ul>${opt.ids.map(zPlayer).map(p=>`<li>${zEsc(p.name)} · ${zPts(zScore(p))}${p.slot==='BN'?' (bench)':''}</li>`).join('')}</ul></details></article>`;}).join('')}</div></section><section class="z-section" id="zPowerRankings"><div class="z-section-head"><div class="eyebrow">THE BIGGER PICTURE</div><h2>Power rankings.</h2><p>A rest-of-season opinion, informed by the opener.</p></div><div class="z-ranking-toolbar"><div class="z-toggle" role="group" aria-label="Ranking author"><button data-rank-view="analyst">Analyst rankings</button><button data-rank-view="jack">Jack's rankings</button></div><button class="z-outline" id="zEditJack">Edit Jack's rankings</button></div><div id="zRankingContent"></div><details class="z-method"><summary>What goes into these rankings?</summary><p>Editorial assessment of rest-of-season core quality, role security, injury news, usable positional depth, and Week 1 performance. This league's screenshot lineup has one QB and one regular FLEX; reserve QBs do not receive Superflex value. A single touchdown-heavy game does not establish a new baseline.</p><p>The remaining 2026 ZYNFL schedule was not supplied or found in the repository. No repeat-opponent advantage has been assumed. Once the schedule is added, opponent strength can inform the next ranking revision. Historical opponent records are not a substitute for the current roster.</p><p>Bench totals use the best legal nine-player lineup, not the sum of all bench scores. Current scores and names come from the supplied Yahoo screenshots; news and NFL depth charts have their own linked sources.</p></details></section></div></div>`;
 document.querySelectorAll('[data-z-go]').forEach(b=>b.onclick=e=>{e.preventDefault();go(b.dataset.zGo);});
 document.querySelectorAll('[data-rank-view]').forEach(b=>b.onclick=()=>{zState.rankView=b.dataset.rankView;zDrawRankings();});document.getElementById('zEditJack').onclick=zEditJack;zDrawRankings();zWireImages();
}
function zDrawRankings(){
 const jack=zState.rankView==='jack',order=jack?zJackOrder():Z26.analystRankings;
 document.querySelectorAll('[data-rank-view]').forEach(b=>{b.classList.toggle('active',b.dataset.rankView===zState.rankView);b.setAttribute('aria-pressed',b.dataset.rankView===zState.rankView);});
 document.getElementById('zRankingContent').innerHTML=order?`${jack?'<p class="z-muted">Jack’s power rankings based on my opinion. Local edits are visible only in this browser until exported and added to the site data.</p>':''}<ol class="z-ranking-list">${order.map((o,i)=>`<li><strong class="z-rank">${String(i+1).padStart(2,'0')}</strong>${zPhoto(teamPhoto(o),o)}<div><h3>${zEsc(Z26.teams[o].name)}</h3><small>${zEsc(o)} · ${zRecord(o)} · ${zPts(zTotal(o))} Week 1 points</small><p>${zEsc(jack?Z26.jackRankReasons[o]:Z26.rankReasons[o])}</p>${zScheduleNote(o)?`<p class="z-muted">${zEsc(zScheduleNote(o))}</p>`:''}</div></li>`).join('')}</ol>`:'<div class="z-empty"><h3>Jack’s rankings are coming.</h3><p>The Week 1 order has not been supplied yet. Use “Edit Jack’s rankings” to enter it.</p></div>';
 zWireImages(document.getElementById('zRankingContent'));
}
function zEditJack(){
 const d=zDialog(),order=zJackOrder()||Object.keys(Z26.teams);
 d.innerHTML=`<button class="z-dialog-close" aria-label="Close rankings editor">×</button><h2 id="zDialogTitle">Jack’s Week 1 rankings</h2><p>Choose each team once, from strongest to weakest. Save a local preview, then export the order to publish it through GitHub.</p><div class="z-rank-editor">${order.map((o,i)=>`<label>${i+1}<select data-order="${i}">${Object.entries(Z26.teams).map(([key,t])=>`<option value="${key}" ${key===o?'selected':''}>${zEsc(t.name)} · ${key}</option>`).join('')}</select></label>`).join('')}</div><p id="zRankError" role="status"></p><div class="z-editor-actions"><button id="zSaveRank" class="z-primary">Save in this browser</button><button id="zExportRank" class="z-outline">Export JSON</button><button id="zResetRank" class="z-outline">Clear local preview</button></div>`;
 d.setAttribute('aria-labelledby','zDialogTitle');d.querySelector('.z-dialog-close').onclick=()=>d.close();
 const read=()=>{const a=[...d.querySelectorAll('[data-order]')].map(x=>x.value);if(!zValidOrder(a)){d.querySelector('#zRankError').textContent='Use each team exactly once. Check for duplicates.';return null;}return a;};
 d.querySelector('#zSaveRank').onclick=()=>{const a=read();if(!a)return;try{localStorage.setItem('zynfl-jack-rankings-2026-w1-published',JSON.stringify(a));}catch{d.querySelector('#zRankError').textContent='Browser storage is unavailable. Export JSON instead.';return;}d.close();zState.rankView='jack';zDrawRankings();};
 d.querySelector('#zExportRank').onclick=()=>{const a=read();if(!a)return;const url=URL.createObjectURL(new Blob([JSON.stringify({'1':a},null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='jack-rankings-2026.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 d.querySelector('#zResetRank').onclick=()=>{try{localStorage.removeItem('zynfl-jack-rankings-2026-w1-published');}catch{}d.close();zDrawRankings();};d.showModal();
}
