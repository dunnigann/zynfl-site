/* Supplied Yahoo transaction rows: one add/drop event counts once. Losing bids cost $0. */
(()=>{
 const d=window.ZYNFL_DATA,z=window.ZYNFL_2026,tx=window.ZYNFL_TRANSACTIONS_2026;
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
 const nfl=s=>({JAC:'JAX',AZ:'ARI'}[s]||s),key=p=>p.position==='DEF'?'def:'+nfl(p.nfl):norm(p.name);
 const player=p=>d.players.find(x=>x.position===p.position&&(norm(x.name)===norm(p.name)||(p.position==='DEF'&&norm(z.nflTeams[nfl(p.nfl)]?.name).endsWith(norm(x.name)))));
 d.transactions2026=tx.transactions;d.contestedAwards2026=tx.contestedAwards;
 for(const [o,s] of Object.entries(tx.summary)){
  const owner=d.owners[o],season=owner.seasons.find(s=>s.year===2026);
  Object.assign(season,{transactions:s.transactions,adds:s.adds,drops:s.drops,faabWins:s.waiverWins,faabSpent:s.faabSpent,losingBids:s.losingBids,transactionAsOf:tx.asOf});
  owner.transactions=owner.seasons.reduce((n,s)=>n+(s.transactions||0),0);owner.faabSpent=owner.seasons.reduce((n,s)=>n+(s.faabSpent||0),0);owner.faabWins=owner.seasons.reduce((n,s)=>n+(s.faabWins||0),0);
 }
 d.meta.transactions=Object.values(d.owners).reduce((n,o)=>n+o.transactions,0);d.meta.fabAwards=Object.values(d.owners).reduce((n,o)=>n+o.faabWins,0);d.meta.transactionsAsOf=tx.asOf;
 // Keep completed-week lineups immutable. Only later moves change current ownership.
 const latest=z.weeks[String(z.week)].players,byKey=new Map(latest.map(p=>[key(p),{...p}]));
 const cutoff=z.weeks[String(z.week)].rosterFinalThrough||'2026-10-12T23:59';
 for(const t of tx.transactions.filter(t=>t.date>cutoff)){
  if(t.dropped){const k=key(t.dropped),p=byKey.get(k);if(p?.owner===t.owner)byKey.delete(k);}
  if(t.added){const ref=[...z.players,...Object.values(z.weeks).flatMap(w=>w.players||[])].find(p=>key(p)===key(t.added));byKey.set(key(t.added),{...ref,...t.added,id:'current-'+key(t.added),owner:t.owner,slot:'BN',points:null,projection:null,status:'unknown',headshot:ref?.headshot||(t.added.position==='DEF'?z.nflTeams[nfl(t.added.nfl)]?.logo:''),source:'Yahoo transaction report through '+tx.asOf});}
 }
 window.ZYNFL_LATEST_ROSTER=[...byKey.values()];
 // A newly acquired free agent gets a Player File, without invented starts or game points.
 for(const p of window.ZYNFL_LATEST_ROSTER)if(!player(p))d.players.push({key:'current2026:'+key(p),name:p.name,position:p.position,playerId:null,seasons:[],owners:[],starts:0,bench:0,ir:0,starterPoints:0,rosterPoints:0,avgDraft:null,drafts:[],history:[]});
 for(const p of d.players){const current=window.ZYNFL_LATEST_ROSTER.find(x=>player(x)===p&&x.owner);if(current&&!p.owners.includes(current.owner))p.owners.push(current.owner);p.transactions2026=tx.transactions.filter(t=>[t.added,t.dropped].some(x=>x&&x.position===p.position&&(norm(x.name)===norm(p.name)||(p.position==='DEF'&&norm(z.nflTeams[nfl(x.nfl)]?.name).endsWith(norm(p.name))))));}
 const total=Object.values(tx.summary),most=Object.entries(tx.summary).sort((a,b)=>b[1].transactions-a[1].transactions)[0],spend=Object.entries(tx.summary).sort((a,b)=>b[1].faabSpent-a[1].faabSpent)[0];
 const a=(key,title,owner,value,detail)=>({key,title,owner,team:z.teams[owner].name,year:2026,value,detail:detail+' · through Oct 14'});
 d.awards['2026'].custom=d.awards['2026'].custom.filter(x=>!['waiver-wire-warrior','daddy-warbucks','the-nick-special'].includes(x.key));
 d.awards['2026'].custom.push(a('waiver-wire-warrior','Waiver Wire Warrior',most[0],String(most[1].transactions),'Most Yahoo transaction rows'),a('daddy-warbucks','Daddy Warbucks',spend[0],'$'+spend[1].faabSpent,'Most FAAB spent'));
 // Production from successful waiver pickups counts only starts after the award, excluding IR/bench.
 const pool=w=>+w===1?z.players.filter(p=>!/^w\d+-/.test(p.id)&&p.owner):z.weeks[w].players;
 const waiverProduction={};for(const o of Object.keys(z.teams))waiverProduction[o]=0;
 const dates={1:'2026-09-13T23:59',2:'2026-09-20T23:59',3:'2026-09-27T23:59',4:'2026-10-04T23:59',5:'2026-10-11T23:59'};
 for(const [w,date]of Object.entries(dates))for(const p of pool(w).filter(p=>!['BN','IR'].includes(p.slot))){
  const events=tx.transactions.filter(t=>t.date<=date&&[t.added,t.dropped].some(x=>x&&key(x)===key(p))).sort((a,b)=>b.date.localeCompare(a.date));
  const acquired=events.find(t=>t.added&&key(t.added)===key(p)&&t.owner===p.owner);
  const interrupted=acquired&&events.some(t=>t.date>acquired.date&&t.dropped&&key(t.dropped)===key(p)&&t.owner===p.owner);
  if(acquired?.method==='waiver'&&!interrupted)waiverProduction[p.owner]+=p.points||0;
 }
 const best=Object.entries(waiverProduction).filter(([o])=>tx.summary[o].faabSpent>0).map(([o,points])=>({owner:o,points,ratio:points/tx.summary[o].faabSpent})).sort((a,b)=>b.ratio-a.ratio)[0];
 if(best)d.awards['2026'].custom.push(a('the-nick-special','The Nick Special',best.owner,best.ratio.toFixed(2),'Starter points from FAAB-winning players per FAAB dollar'));
 for(const current of d.awards['2026'].custom.filter(a=>['waiver-wire-warrior','daddy-warbucks','the-nick-special'].includes(a.key))){const old=d.awards.all.custom.find(a=>a.key===current.key),value=a=>Number(a.value.replace(/[$,]/g,''));if(old&&value(current)>value(old))Object.assign(old,current);}
})();
