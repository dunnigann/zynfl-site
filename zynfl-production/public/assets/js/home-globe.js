/* Homepage-only US map. Local geometry, independent portrait markers, read-only league data. */
(()=>{
'use strict';
const rad=Math.PI/180, esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Albers equal-area projection, matching the bundled state geometry.
function albers(lat,lon){const n=(Math.sin(29.5*rad)+Math.sin(45.5*rad))/2,c=Math.cos(29.5*rad)**2+2*n*Math.sin(29.5*rad),r0=Math.sqrt(c-2*n*Math.sin(23*rad))/n,r=Math.sqrt(c-2*n*Math.sin(lat*rad))/n,t=n*(lon+96)*rad;return [r*Math.sin(t),r*Math.cos(t)-r0];}
function mapPoint(lat,lon,geometry){const [x,y]=albers(lat,lon),b=geometry.bounds,scale=geometry.width/(b[2]-b[0]);return {x:(x-b[0])*scale,y:(y-b[1])*scale};}
const state={year:2026,owner:'Jack',zoom:1,panX:0,panY:0,paused:null,arcs:true};
let dispose=()=>{},mapPromise;
function geography(){return mapPromise||(mapPromise=fetch('assets/map/us-states.json').then(r=>{if(!r.ok)throw Error('Map unavailable');return r.json();}).catch(e=>{mapPromise=null;throw e;}));}
function model(D,Z,year){
 const current=year===Number(Z.year||2026), rows=(D.standings?.[year]||[]).slice().sort((a,b)=>a.rank-b.rank);
 const champion=D.champions.filter(c=>current?c.year<year:c.year===year).sort((a,b)=>b.year-a.year)[0];
 const editions=current?Object.entries(Z.weeks||{}).filter(([,w])=>Array.isArray(w.jackRankings)&&w.jackRankings.length).sort((a,b)=>Number(b[0])-Number(a[0])):[];
 const ranking=editions[0], week=current?Number(Z.currentWeek||Z.week):Math.max(0,...D.matchups.filter(g=>g.year===year).map(g=>g.week));
 const wd=current?Z.weeks?.[week]:null;
 const games=current?(wd?.games||wd?.matchups?.map(g=>({aOwner:g[0],bOwner:g[1],aScore:g[2],bScore:g[3],complete:!!wd.complete}))||[]):D.matchups.filter(g=>g.year===year&&g.week===week).map(g=>({...g,complete:true}));
 return {rows,champion,ranking,week,games,current};
}
// Every manager keeps an individual portrait. Leader lines preserve city anchors.
function layoutMarkers(points,width,height){
 const nodes=points.map(p=>({...p,anchorX:p.x,anchorY:p.y})).sort((a,b)=>a.owner.localeCompare(b.owner));
 const gapX=width<600?53:64,gapY=width<600?66:76;
 for(let pass=0;pass<220;pass++){
  let moved=false;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j];let dx=(b.x-a.x)/gapX,dy=(b.y-a.y)/gapY,d=Math.hypot(dx,dy);
   if(d>=1)continue;if(d<.001){const t=(i*7+j)*2.39996;dx=Math.cos(t)*.01;dy=Math.sin(t)*.01;d=.01;}
   const shift=(1-d)/2+.003;a.x-=dx/d*shift*gapX;a.y-=dy/d*shift*gapY;b.x+=dx/d*shift*gapX;b.y+=dy/d*shift*gapY;moved=true;
  }
  for(const n of nodes){n.x=clamp(n.x,30,width-30);n.y=clamp(n.y,35,height-104);}
  if(!moved)break;
 }
 return nodes;
}

function mount(root,{D,Z,profile,navigate,photo,championship}){
 dispose();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController(),signal=events.signal;
 const on=(el,type,fn,opts={})=>el.addEventListener(type,fn,{...opts,signal});
 const locations=window.ZYNFL_MANAGER_LOCATIONS||{};
 const portrait=owner=>locations[owner]?.photo||photo(owner);
 let data=model(D,Z,state.year),frame=0,last=0,dirty=true,visible=true,pointers=new Map(),pinch=0,mapData=null,dead=false;
 if(!data.rows.length){state.year=Number(Z.year||2026);data=model(D,Z,state.year);}
 if(!data.rows.some(r=>r.owner===state.owner))state.owner=data.rows[0]?.owner;
 if(state.paused===null||reduced.matches)state.paused=reduced.matches;
 const years=Object.keys(D.standings||{}).map(Number).sort((a,b)=>b-a);
 root.innerHTML=`<div class="zg-home">
 <header class="zg-heading"><h1>ZYNFL <span>/ est ${esc(D.meta.founded||2024)}</span></h1><label class="zg-season"><span class="zg-sr-only">Season</span><select id="zg-season" aria-label="Choose season">${years.map(y=>`<option value="${y}" ${y===state.year?'selected':''}>${y}${y===Number(Z.year||2026)?' · In season':' · Archive'}</option>`).join('')}</select></label></header>
 <div class="zg-layout"><section class="zg-atlas" aria-label="United States manager map"><span class="zg-sr-only" id="zg-map-count"></span>
 <div class="zg-stage"><canvas id="zg-earth" tabindex="0" role="img" aria-label="Interactive US map. Use arrow keys to pan and plus or minus to zoom. Each portrait opens its team card." aria-describedby="zg-help"></canvas><div class="zg-beacons" id="zg-beacons"></div></div>
 <div class="zg-map-footer"><div class="zg-controls"><button id="zg-motion" aria-pressed="${state.paused}" aria-label="Pause matchup animation"></button><button id="zg-out" aria-label="Zoom out">−</button><button id="zg-in" aria-label="Zoom in">+</button><button id="zg-reset" aria-label="Reset US map view">↺</button></div><p id="zg-help" class="zg-map-help">Drag to pan · Pinch or + / − to zoom</p></div><div id="zg-map-error" class="zg-map-help" role="status"></div></section>
 <aside class="zg-team-panel" aria-label="Selected team"><div id="zg-cluster" class="zg-cluster"></div><div id="zg-team" aria-live="polite" aria-atomic="true"></div></aside></div>
 <div class="zg-managers-head"><span class="zg-kicker">Managers</span><span id="zg-location-note"></span></div><div id="zg-managers" class="zg-managers" aria-label="Choose a manager"></div>
 <div class="zg-bottom"><section class="zg-match-panel"><div class="zg-section-head"><div><h2 id="zg-week-label"></h2></div><label class="zg-toggle"><input type="checkbox" id="zg-arcs" ${state.arcs?'checked':''}> Show connections</label></div><div id="zg-matchups" class="zg-matchups"></div><button class="zg-text-link" id="zg-all-matchups">Explore matchups <span>↗</span></button></section>
 <section class="zg-activity-panel"><div class="zg-section-head"><div><h2 id="zg-activity-title">Recent activity</h2></div><span class="zg-pulse-dot"></span></div><div id="zg-activity"></div><button class="zg-text-link" id="zg-activity-link">All transactions <span>↗</span></button></section></div>
 <footer class="zg-footnote"><span id="zg-freshness"></span><span>Location centers are approximate.</span></footer></div>`;
 const el=id=>root.querySelector('#zg-'+id),canvas=el('earth'),ctx=canvas.getContext('2d'),stage=canvas.parentElement,beaconLayer=el('beacons');
 let width=0,height=0,fit=1;
 const beaconNodes=new Map();
 function motionLabel(){el('motion').disabled=reduced.matches;el('motion').textContent=state.paused?'▶':'Ⅱ';el('motion').setAttribute('aria-label',reduced.matches?'Animation disabled by reduced-motion preference':state.paused?'Resume matchup animation':'Pause matchup animation');el('motion').setAttribute('aria-pressed',String(state.paused));}
 function select(owner,focusMap=false){state.owner=owner;if(focusMap&&locations[owner]&&mapData&&state.zoom>1){const p=mapPoint(locations[owner].lat,locations[owner].lon,mapData);state.panX=mapData.width/2-p.x;state.panY=mapData.height/2-p.y;}renderCard();root.querySelectorAll('[data-zg-manager]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zgManager===owner)));wake();}
 function renderCard(){
  const row=data.rows.find(r=>r.owner===state.owner);if(!row)return;
  const loc=locations[row.owner],champ=data.champion?.owner===row.owner,rank=data.ranking?.[1].jackRankings.indexOf(row.owner),op=data.games.find(g=>[g.aOwner,g.bOwner].includes(row.owner)),opp=op&&(op.aOwner===row.owner?op.bOwner:op.aOwner),img=portrait(row.owner);
  el('team').innerHTML=`<div class="zg-card-top"><span class="zg-kicker">TEAM</span><span class="zg-card-number">${String(row.rank).padStart(2,'0')}</span></div><div class="zg-person">${img?`<img src="${esc(img)}" alt="" width="60" height="60">`:`<span class="zg-avatar">${esc(row.owner.slice(0,1))}</span>`}<div><h2>${esc(row.owner)}</h2><p>${esc(loc?.label||'Location not provided')}</p></div></div><h3 class="zg-team-name">${esc(row.team)}</h3>${champ?`<button class="zg-champ" id="zg-champ">♛ ${data.champion.year} ${data.current?'DEFENDING ':''}CHAMPION ↗</button>`:'<div class="zg-card-divider"></div>'}
  <dl class="zg-stats"><div><dt>RECORD</dt><dd>${esc(row.w)}–${esc(row.l)}${row.t?`–${esc(row.t)}`:''}</dd></div><div><dt>${data.current?'STANDING':'REG. SEED'}</dt><dd>#${esc(row.rank)}</dd></div><div><dt>POWER RANK</dt><dd>${rank>=0?'#'+(rank+1):'—'}</dd></div></dl>
  <p class="zg-rank-note">${data.ranking?`Jack’s rankings · Week ${data.ranking[0]}`:'Power rankings unavailable for this season'}${!data.current&&row.finalRank?` · Final finish #${row.finalRank}`:''}</p>
  ${window.ZYNFL_ALLEGIANCES?.markup(row.owner,true)||''}
  <div class="zg-opponent"><span class="zg-kicker">${data.current?'WEEK '+data.week:'FINAL WEEK '+data.week}</span><p>${opp?`<span>${esc(row.owner)}</span><small> VS </small><strong>${esc(opp)}</strong>`:'No matchup in this week'}</p></div>
  <button class="zg-profile" id="zg-profile">Open manager profile <span>↗</span></button>`;
  on(el('profile'),'click',()=>profile(row.owner));if(el('champ'))on(el('champ'),'click',()=>championship(data.champion.year));
 }
 function renderCluster(members){el('cluster').innerHTML=members.length>1?`<span>${members.length} managers in this matchup</span><div>${members.map(o=>`<button data-zg-cluster="${esc(o)}">${esc(o)}</button>`).join('')}</div>`:'';el('cluster').querySelectorAll('button').forEach(b=>on(b,'click',()=>select(b.dataset.zgCluster)));}
 function renderData(){
  const mapped=data.rows.filter(r=>locations[r.owner]).length;
  el('map-count').textContent=`${mapped} managers on the map`;
  el('location-note').textContent=data.current?'Select a portrait':'Season stats · Present-day locations';
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
 const project=p=>({x:width/2+(p.x-mapData.width/2+state.panX)*fit*state.zoom,y:height*.47+(p.y-mapData.height/2+state.panY)*fit*state.zoom});
 const locationPoint=owner=>{const p=locations[owner];return p&&mapData?project(mapPoint(p.lat,p.lon,mapData)):null;};
 function polygon(rings){ctx.beginPath();for(const ring of rings){ring.forEach(([x,y],i)=>{const p=project({x,y});if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.closePath();}}
 function arc(g,time,index){
  const a=locationPoint(g.aOwner),b=locationPoint(g.bOwner);if(!a||!b)return;
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),same=d<2;
  const c={x:(a.x+b.x)/2+(same?45:-dy*.18),y:(a.y+b.y)/2+(same?-75:-Math.abs(dx)*.15-24)};
  const selected=[g.aOwner,g.bOwner].includes(state.owner),color=selected?'#b6f8d9':'#65b9aa';
  ctx.beginPath();ctx.moveTo(a.x,a.y);if(same)ctx.bezierCurveTo(a.x+55,a.y-65,a.x-55,a.y-65,a.x,a.y);else ctx.quadraticCurveTo(c.x,c.y,b.x,b.y);
  ctx.strokeStyle=selected?'rgba(172,248,216,.75)':'rgba(101,185,170,.28)';ctx.lineWidth=selected?1.8:1;ctx.stroke();
  if(!same){const t=state.paused||reduced.matches?0.45:((time/3700+index*.17)%1),u=1-t,x=u*u*a.x+2*u*t*c.x+t*t*b.x,y=u*u*a.y+2*u*t*c.y+t*t*b.y;ctx.beginPath();ctx.arc(x,y,selected?2.8:2,0,Math.PI*2);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=10;ctx.fill();ctx.shadowBlur=0;}
 }
 function draw(time){
  if(!ctx)return;ctx.clearRect(0,0,width,height);
  for(let x=15;x<width;x+=32)for(let y=15;y<height;y+=32){ctx.fillStyle='rgba(147,199,194,.09)';ctx.fillRect(x,y,1,1);}
  if(!mapData)return;
  const selectedState={Jack:'TX',Isaac:'TX',Liam:'TX',Mitchell:'IL',Chuck:'IL',Akhil:'IL',Nick:'NY',Quinn:'NY',Brock:'DC',Tina:'CA',Santi:'NJ',Leo:'MI'}[state.owner];
  for(const region of mapData.states){polygon(region.rings);ctx.fillStyle=region.code===selectedState?'#163e40':'#10242f';ctx.fill('evenodd');ctx.strokeStyle='rgba(139,209,193,.25)';ctx.lineWidth=.8;ctx.stroke();}
  if(state.arcs)data.games.forEach((g,i)=>arc(g,time,i));
  const points=data.rows.filter(r=>locations[r.owner]).map(r=>({...locationPoint(r.owner),owner:r.owner})).filter(p=>p.x>-50&&p.x<width+50&&p.y>-50&&p.y<height+50);
  const active=new Set();
  for(const p of layoutMarkers(points,width,height)){
   const owner=p.owner;active.add(owner);
   if(Math.hypot(p.x-p.anchorX,p.y-p.anchorY)>3){ctx.beginPath();ctx.moveTo(p.anchorX,p.anchorY);ctx.lineTo(p.x,p.y);ctx.strokeStyle='rgba(167,220,207,.48)';ctx.lineWidth=.8;ctx.stroke();ctx.beginPath();ctx.arc(p.anchorX,p.anchorY,2.4,0,Math.PI*2);ctx.fillStyle='#a1f2d1';ctx.fill();}
   let button=beaconNodes.get(owner);
   if(!button){button=document.createElement('button');button.type='button';button.className='zg-beacon';button.dataset.zgPortrait=owner;button.setAttribute('aria-label',`${owner}: ${locations[owner].label}. Open team.`);const img=portrait(owner);button.innerHTML=`<span class="zg-portrait">${img?`<img src="${esc(img)}" alt="" width="48" height="48" decoding="async">`:esc(owner.slice(0,1))}</span><em>${esc(owner)}</em>`;
    button.querySelector('img')?.addEventListener('error',e=>{e.target.replaceWith(document.createTextNode(owner.slice(0,1)));},{once:true});
    on(button,'pointerenter',e=>{if(e.pointerType==='mouse')select(owner);});on(button,'focus',()=>select(owner));on(button,'click',()=>{renderCluster([]);select(owner);});beaconLayer.append(button);beaconNodes.set(owner,button);
   }
   button.classList.toggle('gold',owner===data.champion?.owner);button.classList.toggle('selected',owner===state.owner);button.setAttribute('aria-pressed',String(owner===state.owner));button.style.left=p.x+'px';button.style.top=p.y+'px';
  }
  for(const [key,node]of beaconNodes)if(!active.has(key)){node.remove();beaconNodes.delete(key);}
 }
 function animate(time){frame=0;if(dead||document.hidden||!visible)return;if(time-last<32){frame=requestAnimationFrame(animate);return;}last=time;const moving=!state.paused&&!reduced.matches&&!pointers.size&&state.arcs&&data.games.length>0;if(dirty||moving){draw(time);dirty=false;}if(moving)frame=requestAnimationFrame(animate);}
 function wake(){dirty=true;if(!frame&&!dead&&visible&&!document.hidden)frame=requestAnimationFrame(animate);}
 function resize(){width=stage.clientWidth;height=stage.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);if(mapData)fit=Math.min((width-(width<600?48:75))/mapData.width,(height-145)/mapData.height);wake();}
 on(el('season'),'change',e=>{state.year=Number(e.target.value);data=model(D,Z,state.year);if(!data.rows.some(r=>r.owner===state.owner))state.owner=data.rows[0]?.owner;renderData();wake();});
 on(el('motion'),'click',()=>{state.paused=!state.paused;motionLabel();wake();});
 on(el('arcs'),'change',e=>{state.arcs=e.target.checked;wake();});
 function zoom(amount){state.zoom=clamp(state.zoom+amount,1,3);resize();}
 on(el('in'),'click',()=>zoom(.15));on(el('out'),'click',()=>zoom(-.15));on(el('reset'),'click',()=>{state.panX=0;state.panY=0;state.zoom=1;resize();});
 on(el('all-matchups'),'click',()=>navigate('matchups'));
 on(canvas,'keydown',e=>{const actions={ArrowLeft:()=>state.panX-=35/state.zoom,ArrowRight:()=>state.panX+=35/state.zoom,ArrowUp:()=>state.panY-=35/state.zoom,ArrowDown:()=>state.panY+=35/state.zoom,'+':()=>zoom(.15),'=':()=>zoom(.15),'-':()=>zoom(-.15)};if(actions[e.key]){e.preventDefault();state.paused=true;motionLabel();actions[e.key]();wake();}});
 on(canvas,'pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);pinch=0;state.paused=true;motionLabel();});
 on(canvas,'pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev)return;const dx=e.clientX-prev.x,dy=e.clientY-prev.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)zoom((d-pinch)/300);pinch=d;}else{state.panX=clamp(state.panX+dx/(fit*state.zoom),-900,900);state.panY=clamp(state.panY+dy/(fit*state.zoom),-600,600);}wake();});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])on(canvas,type,e=>{pointers.delete(e.pointerId);pinch=0;wake();});
 // Wheel zoom is intentionally opt-in (Ctrl) so the map never traps page scrolling.
 on(canvas,'wheel',e=>{if(e.ctrlKey){e.preventDefault();zoom(-Math.sign(e.deltaY)*.08);}},{passive:false});
 on(reduced,'change',()=>{if(reduced.matches)state.paused=true;motionLabel();wake();});
 on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});
 const observer=new ResizeObserver(resize);observer.observe(stage);
 const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)wake();else{cancelAnimationFrame(frame);frame=0;}},{threshold:0});intersection.observe(stage);
 renderData();motionLabel();resize();
 if(!ctx)el('map-error').textContent='Map rendering is unavailable. All teams are accessible below.';
 geography().then(g=>{if(dead)return;mapData=g;resize();}).catch(()=>{if(!dead)el('map-error').textContent='Map detail could not load. Teams remain accessible in the manager list.';});
 dispose=()=>{dead=true;events.abort();observer.disconnect();intersection.disconnect();cancelAnimationFrame(frame);beaconNodes.clear();};
}
window.ZYNFL_HOME={mount,destroy:()=>dispose(),model,layoutMarkers,mapPoint};
})();
