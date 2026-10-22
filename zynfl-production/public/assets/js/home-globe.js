/* Homepage-only, dependency-free spherical renderer. Data is read, never mutated. */
(()=>{
'use strict';
const rad=Math.PI/180, esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const vector=(lat,lon)=>{const p=lat*rad,l=lon*rad;return [Math.cos(p)*Math.sin(l),Math.sin(p),Math.cos(p)*Math.cos(l)];};
const state={year:2026,owner:'Jack',lat:30,lon:-103,zoom:1,paused:null,arcs:true};
let dispose=()=>{},landPromise;
function land(){return landPromise||(landPromise=fetch('assets/globe/earth-land.json').then(r=>{if(!r.ok)throw Error('Map unavailable');return r.json();}).then(g=>({dots:g.dots.map(([lon,lat])=>vector(lat,lon)),coasts:g.coasts.map(p=>p.map(([lon,lat])=>vector(lat,lon)))})).catch(e=>{landPromise=null;throw e;}));}
function model(D,Z,year){
 const current=year===Number(Z.year||2026), rows=(D.standings?.[year]||[]).slice().sort((a,b)=>a.rank-b.rank);
 const champion=D.champions.filter(c=>current?c.year<year:c.year===year).sort((a,b)=>b.year-a.year)[0];
 const editions=current?Object.entries(Z.weeks||{}).filter(([,w])=>Array.isArray(w.jackRankings)&&w.jackRankings.length).sort((a,b)=>Number(b[0])-Number(a[0])):[];
 const ranking=editions[0], week=current?Number(Z.currentWeek||Z.week):Math.max(0,...D.matchups.filter(g=>g.year===year).map(g=>g.week));
 const wd=current?Z.weeks?.[week]:null;
 const games=current?(wd?.games||wd?.matchups?.map(g=>({aOwner:g[0],bOwner:g[1],aScore:g[2],bScore:g[3],complete:!!wd.complete}))||[]):D.matchups.filter(g=>g.year===year&&g.week===week).map(g=>({...g,complete:true}));
 return {rows,champion,ranking,week,games,current};
}
// Transitive screen-space clustering, independent of manager ordering.
function clusters(points,distance=45){
 const groups=[];
 for(const p of points){const touching=groups.filter(g=>g.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<distance));const merged=[p,...touching.flat()];for(const g of touching)groups.splice(groups.indexOf(g),1);groups.push(merged);}
 return groups.map(g=>({members:g.slice().sort((a,b)=>a.owner.localeCompare(b.owner)),x:g.reduce((s,p)=>s+p.x,0)/g.length,y:g.reduce((s,p)=>s+p.y,0)/g.length}));
}
function mount(root,{D,Z,profile,navigate,photo,championship}){
 dispose();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController(),signal=events.signal;
 const on=(el,type,fn,opts={})=>el.addEventListener(type,fn,{...opts,signal});
 const locations=window.ZYNFL_MANAGER_LOCATIONS||{};
 let data=model(D,Z,state.year),frame=0,last=0,dirty=true,visible=true,hover=false,pointers=new Map(),pinch=0,landData=null,dead=false;
 if(!data.rows.length){state.year=Number(Z.year||2026);data=model(D,Z,state.year);}
 if(!data.rows.some(r=>r.owner===state.owner))state.owner=data.rows[0]?.owner;
 if(state.paused===null||reduced.matches)state.paused=reduced.matches;
 const years=Object.keys(D.standings||{}).map(Number).sort((a,b)=>b-a);
 root.innerHTML=`<div class="zg-home"><div class="zg-topline"><span><i></i> THE LEAGUE, CONNECTED</span><span>EST. ${esc(D.meta.founded||2024)} <b>/</b> ZYNFL</span></div>
 <header class="zg-heading"><div><h1>One league.<br><span>A world of grudges.</span></h1><p>Different cities. Same obsession. Explore the people behind the teams.</p></div><label class="zg-season">SEASON<select id="zg-season">${years.map(y=>`<option value="${y}" ${y===state.year?'selected':''}>${y}${y===Number(Z.year||2026)?' · In season':' · Archive'}</option>`).join('')}</select></label></header>
 <div class="zg-layout"><section class="zg-atlas" aria-label="Interactive manager globe"><div class="zg-map-heading"><div><span class="zg-kicker">MANAGER ATLAS</span><strong id="zg-map-count"></strong></div><span class="zg-map-tag">DRAG TO EXPLORE ↗</span></div>
 <div class="zg-stage"><canvas id="zg-earth" tabindex="0" role="img" aria-label="Rotatable 3D Earth. Use arrow keys to rotate and plus or minus to zoom. Manager buttons follow below." aria-describedby="zg-help"></canvas><div class="zg-beacons" id="zg-beacons"></div><div class="zg-watermark" aria-hidden="true">ZYNFL</div></div>
 <div class="zg-map-footer"><div class="zg-legend"><span><i></i> Managers</span><span><i class="gold"></i> Champion</span><span><i class="line"></i> Matchup</span></div><div class="zg-controls"><button id="zg-motion" aria-pressed="${state.paused}" aria-label="Pause globe animation"></button><button id="zg-out" aria-label="Zoom out">−</button><button id="zg-in" aria-label="Zoom in">+</button><button id="zg-reset" aria-label="Reset globe view">↺</button></div></div>
 <p id="zg-help" class="zg-map-help">Drag to rotate · Pinch or use + / − to zoom · Select a beacon to explore</p><div id="zg-map-error" class="zg-map-help" role="status"></div></section>
 <aside class="zg-team-panel" aria-label="Selected team"><div id="zg-cluster" class="zg-cluster"></div><div id="zg-team" aria-live="polite" aria-atomic="true"></div></aside></div>
 <div class="zg-managers-head"><span class="zg-kicker">THE LEAGUE</span><span id="zg-location-note"></span></div><div id="zg-managers" class="zg-managers" aria-label="Choose a manager"></div>
 <div class="zg-bottom"><section class="zg-match-panel"><div class="zg-section-head"><div><span class="zg-kicker">ACROSS THE MAP</span><h2 id="zg-week-label"></h2></div><label class="zg-toggle"><input type="checkbox" id="zg-arcs" ${state.arcs?'checked':''}> Show connections</label></div><div id="zg-matchups" class="zg-matchups"></div><button class="zg-text-link" id="zg-all-matchups">Explore matchups <span>↗</span></button></section>
 <section class="zg-activity-panel"><div class="zg-section-head"><div><span class="zg-kicker">LEAGUE PULSE</span><h2 id="zg-activity-title">Recent activity</h2></div><span class="zg-pulse-dot"></span></div><div id="zg-activity"></div><button class="zg-text-link" id="zg-activity-link">All transactions <span>↗</span></button></section></div>
 <footer class="zg-footnote"><span id="zg-freshness"></span><span>Location centers are approximate.</span></footer></div>`;
 const el=id=>root.querySelector('#zg-'+id),canvas=el('earth'),ctx=canvas.getContext('2d'),stage=canvas.parentElement,beaconLayer=el('beacons');
 let width=0,height=0,radius=0,cx=0,cy=0;
 const beaconNodes=new Map();
 function motionLabel(){el('motion').disabled=reduced.matches;el('motion').textContent=state.paused?'▶':'Ⅱ';el('motion').setAttribute('aria-label',reduced.matches?'Animation disabled by reduced-motion preference':state.paused?'Resume globe animation':'Pause globe animation');el('motion').setAttribute('aria-pressed',String(state.paused));}
 function select(owner,focusMap=false){state.owner=owner;if(focusMap&&locations[owner]){state.lat=locations[owner].lat;state.lon=locations[owner].lon;state.paused=true;motionLabel();}renderCard();root.querySelectorAll('[data-zg-manager]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zgManager===owner)));wake();}
 function renderCard(){
  const row=data.rows.find(r=>r.owner===state.owner);if(!row)return;
  const loc=locations[row.owner],champ=data.champion?.owner===row.owner,rank=data.ranking?.[1].jackRankings.indexOf(row.owner),op=data.games.find(g=>[g.aOwner,g.bOwner].includes(row.owner)),opp=op&&(op.aOwner===row.owner?op.bOwner:op.aOwner),img=photo(row.owner);
  el('team').innerHTML=`<div class="zg-card-top"><span class="zg-kicker">FRANCHISE SPOTLIGHT</span><span class="zg-card-number">${String(row.rank).padStart(2,'0')}</span></div><div class="zg-person">${img?`<img src="${esc(img)}" alt="" width="60" height="60">`:`<span class="zg-avatar">${esc(row.owner.slice(0,1))}</span>`}<div><h2>${esc(row.owner)}</h2><p>${esc(loc?.label||'Location not provided')}</p></div></div><h3 class="zg-team-name">${esc(row.team)}</h3>${champ?`<button class="zg-champ" id="zg-champ">♛ ${data.champion.year} ${data.current?'DEFENDING ':''}CHAMPION ↗</button>`:'<div class="zg-card-divider"></div>'}
  <dl class="zg-stats"><div><dt>RECORD</dt><dd>${esc(row.w)}–${esc(row.l)}${row.t?`–${esc(row.t)}`:''}</dd></div><div><dt>${data.current?'STANDING':'REG. SEED'}</dt><dd>#${esc(row.rank)}</dd></div><div><dt>POWER RANK</dt><dd>${rank>=0?'#'+(rank+1):'—'}</dd></div></dl>
  <p class="zg-rank-note">${data.ranking?`Jack’s rankings · Week ${data.ranking[0]}`:'Power rankings unavailable for this season'}${!data.current&&row.finalRank?` · Final finish #${row.finalRank}`:''}</p>
  <div class="zg-opponent"><span class="zg-kicker">${data.current?'WEEK '+data.week:'FINAL WEEK '+data.week}</span><p>${opp?`<span>${esc(row.owner)}</span><small> VS </small><strong>${esc(opp)}</strong>`:'No matchup in this week'}</p></div>
  <button class="zg-profile" id="zg-profile">Open manager profile <span>↗</span></button>`;
  on(el('profile'),'click',()=>profile(row.owner));if(el('champ'))on(el('champ'),'click',()=>championship(data.champion.year));
 }
 function renderCluster(members){el('cluster').innerHTML=members.length>1?`<span>${members.length} managers in this area</span><div>${members.map(o=>`<button data-zg-cluster="${esc(o)}">${esc(o)}</button>`).join('')}</div>`:'';el('cluster').querySelectorAll('button').forEach(b=>on(b,'click',()=>select(b.dataset.zgCluster)));}
 function renderData(){
  const mapped=data.rows.filter(r=>locations[r.owner]).length;
  el('map-count').textContent=`${mapped} managers on the map`;
  el('location-note').textContent=data.current?'Select a manager or a glowing beacon':'Season stats · Present-day locations';
  el('managers').innerHTML=data.rows.map(r=>`<button data-zg-manager="${esc(r.owner)}" aria-pressed="${r.owner===state.owner}"><span class="zg-manager-dot ${data.champion?.owner===r.owner?'gold':''}"></span><span>${esc(r.owner)}</span><small>${locations[r.owner]?esc(locations[r.owner].label.split(',')[0].split(' ·')[0]):'Unmapped'}</small></button>`).join('');
  el('managers').querySelectorAll('button').forEach(b=>on(b,'click',()=>{renderCluster([]);select(b.dataset.zgManager,true);}));
  el('week-label').textContent=`${data.current?'Week':'Final week'} ${data.week} matchups`;
  el('matchups').innerHTML=data.games.length?data.games.map((g,i)=>`<button class="zg-match" data-zg-game="${i}" aria-label="Show ${esc(g.aOwner)} versus ${esc(g.bOwner)}"><span>${esc(g.aOwner)} <b>${Number.isFinite(g.aScore)?g.aScore.toFixed(2):'—'}</b></span><small>${g.complete?'FINAL':g.status==='midevent'?'IN PROGRESS':'SCHEDULED'}</small><span>${esc(g.bOwner)} <b>${Number.isFinite(g.bScore)?g.bScore.toFixed(2):'—'}</b></span></button>`).join(''):'<p>No matchups available.</p>';
  el('matchups').querySelectorAll('button').forEach(b=>on(b,'click',()=>{const g=data.games[+b.dataset.zgGame];state.arcs=true;el('arcs').checked=true;renderCluster([g.aOwner,g.bOwner]);select(g.aOwner,true);}));
  const tx=data.current?(window.ZYNFL_TRANSACTIONS_2026?.transactions||[]).slice().sort((a,b)=>(b.timestamp||Date.parse(b.date))-(a.timestamp||Date.parse(a.date))).slice(0,4):[];
  el('activity-title').textContent=tx.length?'Recent activity':'Season highlights';
  el('activity').innerHTML=tx.length?tx.map(t=>`<article class="zg-event"><span class="zg-event-icon">${t.added?'+':'−'}</span><div><strong>${esc(t.owner)}</strong><p>${t.added?'Added '+esc(t.added.name):t.dropped?'Dropped '+esc(t.dropped.name):'Roster move'}${t.added&&t.dropped?'<br><small>Dropped '+esc(t.dropped.name)+'</small>':''}</p></div><time>${esc(t.date?.slice(5,10))}</time></article>`).join(''):`${data.champion?`<article class="zg-event"><span class="zg-event-icon gold">♛</span><div><strong>${esc(data.champion.owner)} · ${data.champion.year} champion</strong><p>${esc(data.champion.team)}</p></div></article>`:''}<article class="zg-event"><span class="zg-event-icon">#</span><div><strong>${D.matchups.filter(g=>g.year===state.year).length} completed matchups</strong><p>Explore the season in the league archive.</p></div></article>`;
  el('activity-link').textContent=tx.length?'All transactions ↗':'Explore league history ↗';el('activity-link').onclick=()=>navigate(tx.length?'transactions':'history');
  el('freshness').textContent=`${data.current?'Records through '+D.meta.dataThrough:state.year+' completed season'} · Source updated ${String(D.meta.updatedAt||Z.updated||'').slice(0,10)||'date unavailable'}`;
  renderCard();renderCluster([]);dirty=true;
 }
 const project=v=>{const l=state.lon*rad,p=state.lat*rad;const x=v[0]*Math.cos(l)-v[2]*Math.sin(l),z=v[0]*Math.sin(l)+v[2]*Math.cos(l),y=v[1]*Math.cos(p)-z*Math.sin(p);return {x:cx+x*radius,y:cy-y*radius,z:v[1]*Math.sin(p)+z*Math.cos(p)};};
 function path(points,color,lineWidth=1){ctx.beginPath();let pen=false;for(const v of points){const p=project(v);if(p.z>0){if(!pen)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);pen=true;}else pen=false;}ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();}
 const grid=[];for(let lat=-60;lat<=60;lat+=30){let line=[];for(let lon=-180;lon<=180;lon+=3)line.push(vector(lat,lon));grid.push(line);}for(let lon=-180;lon<180;lon+=30){let line=[];for(let lat=-90;lat<=90;lat+=3)line.push(vector(lat,lon));grid.push(line);}
 function arc(g,time,index){
  const a=locations[g.aOwner],b=locations[g.bOwner];if(!a||!b)return;
  const av=vector(a.lat,a.lon),bv=vector(b.lat,b.lon),dot=clamp(av.reduce((n,v,i)=>n+v*bv[i],0),-1,1),angle=Math.acos(dot),same=angle<.001,points=[];
  for(let i=0;i<=64;i++){const t=i/64,h=1+Math.sin(Math.PI*t)*Math.max(.06,angle*.18);let v;if(same){v=vector(a.lat+Math.sin(t*Math.PI)*4,a.lon+Math.sin(t*2*Math.PI)*4);v=v.map(x=>x*h);}else {const s=Math.sin(angle);v=av.map((x,k)=>(x*Math.sin((1-t)*angle)+bv[k]*Math.sin(t*angle))/s*h);}points.push(v);}
  const selected=[g.aOwner,g.bOwner].includes(state.owner),color=selected?'#a3f7d4':'#3b907e';path(points,color,selected?1.8:1);
  const t=state.paused||reduced.matches?0.45:((time/3300+index*.17)%1),v=points[Math.floor(t*64)],p=project(v);
  if(p.z>0){ctx.beginPath();ctx.arc(p.x,p.y,selected?3:2,0,Math.PI*2);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;}
 }
 function draw(time){
  if(!ctx)return;ctx.clearRect(0,0,width,height);
  // Deterministic star field, subtle orbit ellipses and a lit atmosphere.
  for(let i=0;i<95;i++){const x=((i*167.39+31)%997)/997*width,y=((i*83.79+13)%601)/601*height;ctx.fillStyle=`rgba(180,213,232,${.12+(i%4)*.07})`;ctx.fillRect(x,y,i%9===0?1.7:1,i%9===0?1.7:1);}
  ctx.strokeStyle='rgba(99,170,156,.12)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(cx,cy,radius*1.2,radius*.32,-.35,0,Math.PI*2);ctx.stroke();
  const halo=ctx.createRadialGradient(cx,cy,radius*.85,cx,cy,radius*1.19);halo.addColorStop(0,'rgba(31,154,141,0)');halo.addColorStop(.65,'rgba(48,174,154,.14)');halo.addColorStop(1,'rgba(31,154,141,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
  const sea=ctx.createRadialGradient(cx-radius*.4,cy-radius*.45,radius*.05,cx,cy,radius);sea.addColorStop(0,'#143a43');sea.addColorStop(.65,'#0b222e');sea.addColorStop(1,'#030b15');ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fillStyle=sea;ctx.fill();
  grid.forEach(g=>path(g,'rgba(106,184,186,.10)'));
  if(landData){landData.coasts.forEach(c=>path(c,'rgba(104,203,177,.33)',.65));for(const v of landData.dots){const p=project(v);if(p.z<=0)continue;const light=.25+.7*p.z;ctx.fillStyle=`rgba(116,219,190,${light*.65})`;const size=1.1+1.1*p.z;ctx.fillRect(p.x-size/2,p.y-size/2,size,size);}}
  // Thin atmosphere rim, independent of any external map tiles or GPU.
  ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.strokeStyle='rgba(121,233,211,.37)';ctx.lineWidth=1;ctx.stroke();
  if(state.arcs)data.games.forEach((g,i)=>arc(g,time,i));
  const points=data.rows.filter(r=>locations[r.owner]).map(r=>{const l=locations[r.owner];return {...project(vector(l.lat,l.lon)),owner:r.owner};}).filter(p=>p.z>.08&&p.x>16&&p.x<width-16&&p.y>16&&p.y<height-16);
  const active=new Set();
  for(const group of clusters(points,width<500?32:30)){
   const owners=group.members.map(p=>p.owner),key=owners.join('|');active.add(key);
   let button=beaconNodes.get(key);if(!button){button=document.createElement('button');button.type='button';button.className='zg-beacon';button.setAttribute('aria-label',owners.length>1?`${owners.length} managers: ${owners.join(', ')}. Open cluster.`:`${owners[0]}: ${locations[owners[0]].label}. Open team.`);button.innerHTML=`<span>${owners.length>1?owners.length:''}</span><em>${owners.length>1?owners.length+' managers':esc(owners[0])}</em>`;
    on(button,'pointerenter',e=>{if(e.pointerType==='mouse'){hover=true;renderCluster(owners);select(owners.includes(state.owner)?state.owner:owners[0]);}});
    on(button,'pointerleave',()=>{hover=false;wake();});on(button,'focus',()=>{hover=true;renderCluster(owners);select(owners.includes(state.owner)?state.owner:owners[0]);});on(button,'blur',()=>{hover=false;});
    on(button,'click',()=>{state.paused=true;motionLabel();renderCluster(owners);select(owners.includes(state.owner)?state.owner:owners[0]);if(owners.length>1)el('cluster').querySelector('button')?.focus();});beaconLayer.append(button);beaconNodes.set(key,button);}
   button.classList.toggle('gold',owners.includes(data.champion?.owner));button.classList.toggle('selected',owners.includes(state.owner));button.style.left=group.x+'px';button.style.top=group.y+'px';
  }
  for(const [key,node]of beaconNodes)if(!active.has(key)){node.remove();beaconNodes.delete(key);}
 }
 function animate(time){frame=0;if(dead||document.hidden||!visible)return;const elapsed=Math.min(60,time-last||33);if(time-last<32){frame=requestAnimationFrame(animate);return;}last=time;const moving=!state.paused&&!reduced.matches&&!hover&&!pointers.size;if(moving){state.lon+=elapsed*.0018;dirty=true;}if(dirty||moving){draw(time);dirty=false;}if(moving)frame=requestAnimationFrame(animate);}
 function wake(){dirty=true;if(!frame&&!dead&&visible&&!document.hidden)frame=requestAnimationFrame(animate);}
 function resize(){width=stage.clientWidth;height=stage.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);cx=width*.5;cy=height*.5;radius=Math.min(width*.39,height*.43)*state.zoom;wake();}
 on(el('season'),'change',e=>{state.year=Number(e.target.value);data=model(D,Z,state.year);if(!data.rows.some(r=>r.owner===state.owner))state.owner=data.rows[0]?.owner;renderData();wake();});
 on(el('motion'),'click',()=>{state.paused=!state.paused;motionLabel();wake();});
 on(el('arcs'),'change',e=>{state.arcs=e.target.checked;wake();});
 function zoom(amount){state.zoom=clamp(state.zoom+amount,.7,1.8);resize();}
 on(el('in'),'click',()=>zoom(.15));on(el('out'),'click',()=>zoom(-.15));on(el('reset'),'click',()=>{state.lat=30;state.lon=-103;state.zoom=1;resize();});
 on(el('all-matchups'),'click',()=>navigate('matchups'));
 on(canvas,'keydown',e=>{const actions={ArrowLeft:()=>state.lon-=8,ArrowRight:()=>state.lon+=8,ArrowUp:()=>state.lat=clamp(state.lat+8,-75,75),ArrowDown:()=>state.lat=clamp(state.lat-8,-75,75),'+':()=>zoom(.15),'=':()=>zoom(.15),'-':()=>zoom(-.15)};if(actions[e.key]){e.preventDefault();state.paused=true;motionLabel();actions[e.key]();wake();}});
 on(canvas,'pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);pinch=0;state.paused=true;motionLabel();});
 on(canvas,'pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev)return;const dx=e.clientX-prev.x,dy=e.clientY-prev.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)zoom((d-pinch)/300);pinch=d;}else{state.lon-=dx*.3;state.lat=clamp(state.lat+dy*.3,-75,75);}wake();});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])on(canvas,type,e=>{pointers.delete(e.pointerId);pinch=0;wake();});
 // Wheel zoom is intentionally opt-in (Ctrl) so the globe never traps page scrolling.
 on(canvas,'wheel',e=>{if(e.ctrlKey){e.preventDefault();zoom(-Math.sign(e.deltaY)*.08);}},{passive:false});
 on(stage,'pointerleave',()=>{hover=false;wake();});on(stage,'focusout',()=>{hover=false;wake();});
 on(reduced,'change',()=>{if(reduced.matches)state.paused=true;motionLabel();wake();});
 on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});
 const observer=new ResizeObserver(resize);observer.observe(stage);
 const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)wake();else{cancelAnimationFrame(frame);frame=0;}},{threshold:0});intersection.observe(stage);
 renderData();motionLabel();resize();
 if(!ctx)el('map-error').textContent='Globe rendering is unavailable. All teams are accessible below.';
 land().then(g=>{if(dead)return;landData=g;wake();}).catch(()=>{if(!dead)el('map-error').textContent='Map detail could not load. Location beacons and team cards remain available.';});
 dispose=()=>{dead=true;events.abort();observer.disconnect();intersection.disconnect();cancelAnimationFrame(frame);beaconNodes.clear();};
}
window.ZYNFL_HOME={mount,destroy:()=>dispose(),model,clusters};
})();
