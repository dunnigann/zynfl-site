/* The existing archive is an immediate offline fallback. Successful API reads
   are applied together; repeated refreshes always rebuild from the same base. */
(()=>{
 const base=structuredClone({ZYNFL_DATA:window.ZYNFL_DATA,ZYNFL_2026:window.ZYNFL_2026,ZYNFL_2026_LEADERS:window.ZYNFL_2026_LEADERS});
 const seasons=new Map();let busy=false,applied=false,revision='',lastArchive=0,pendingView=false;
 async function get(year){const r=await fetch(`/api/yahoo/season/${year}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Yahoo data is temporarily unavailable');const s=await r.json();if(s.year!==year||s.schema!==1||s.teams?.length!==12||!Array.isArray(s.games)||!s.weeks)throw Error('Incomplete Yahoo response');return s;}
 function refreshView(){
  if(!document.getElementById('modalBackdrop').hidden||document.querySelector('dialog[open]')||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){pendingView=true;return;}pendingView=false;
  const x=scrollX,y=scrollY,open=[...app.querySelectorAll('details')].map((e,i)=>e.open?i:null).filter(i=>i!=null);
  go((location.hash||'#home').slice(1),{preserveScroll:true});open.forEach(i=>{const el=app.querySelectorAll('details')[i];if(el)el.open=true;});window.scrollTo(x,y);
 }
 async function sync(){
  if(busy||document.hidden)return;busy=true;
  try{
   const years=!applied||Date.now()-lastArchive>3600000?[2024,2025,2026]:[2026];
   const results=await Promise.allSettled(years.map(get));
   results.forEach((r,i)=>{if(r.status==='fulfilled')seasons.set(years[i],r.value);});
   if(seasons.size!==3)throw Error('Some Yahoo history is temporarily unavailable');
   const all=[...seasons.values()].sort((a,b)=>a.year-b.year),latest=seasons.get(2026),key=all.map(s=>`${s.updatedAt}:${s.coverage?.verifiedRosters}:${s.transactions.length}:${Object.keys(s.powerRankings||{}).length}`).join('|');
   window.ZYNFL_YAHOO_SEASONS=all;
   if(key!==revision){
    const model=window.ZYNFL_YAHOO_MODEL.build(base,all);
    for(const [name,value]of Object.entries(model)){if(value&&!Array.isArray(value)&&window[name]&&!Array.isArray(window[name]))Object.assign(window[name],value);else window[name]=value;}
    PLAYOFF_FINISH=D.finalPlacements;window.ZYNFL_OPTIMAL=window.ZYNFL_YAHOO_MODEL.optimal;
    if(!applied){const page=(location.hash||'#home').slice(1);zState.week=page==='matchups'?(Z26.currentWeek||Z26.week):Z26.week||Z26.currentWeek;}
    revision=key;refreshView();
   }
   document.getElementById('footerMeta').textContent=`Records through ${D.meta.dataThrough}`;
   applied=true;if(years.length===3&&results.every(r=>r.status==='fulfilled'))lastArchive=Date.now();
  }catch(error){console.warn('ZYNFL live update delayed; retrying automatically.');}
  finally{busy=false;}
 }
 document.addEventListener('focusout',()=>{if(pendingView)setTimeout(refreshView,0);});document.addEventListener('click',()=>{if(pendingView)setTimeout(refreshView,0);});
 sync();setInterval(sync,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});window.addEventListener('focus',sync);
})();
