import fs from 'node:fs/promises';
import path from 'node:path';
import * as Y from '../src/yahoo-data.mjs';
import {compactPlayer,coverage} from '../src/yahoo-cache.mjs';
const root=process.argv[2];if(!root)throw Error('Pass private raw-data directory');
const names=await fs.readdir(root),read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
const baseline=await read('baseline.json'),d=baseline.ZYNFL_DATA,z=baseline.ZYNFL_2026;
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
const players=new Map();
for(const name of names.filter(n=>/roster|players|transactions/.test(n)&&n.endsWith('.json'))){
 const raw=await read(name);for(const r of Y.find(raw,'player')){const p=Y.playerRecord(r,Number(name.slice(0,4)));if(p.playerId!=='undefined'&&p.name)players.set(p.playerId,compactPlayer(p));}
}
const byName=new Map([...players.values()].map(p=>[norm(p.name),p]));
await fs.mkdir('public/data/yahoo',{recursive:true});
for(const year of [2024,2025,2026]){
 const get=kind=>read(`${year}-${kind}.json`),league=Y.leagueMeta(await get('metadata'));
 const s={schema:1,year,league,settings:Y.leagueSettings(await get('settings')),teams:Y.standings(await get('standings'),year),games:Y.schedule(await get('schedule'),year),weeks:{},rosterVerified:{},rosterFinal:{},drafts:[],transactions:[],transactionsComplete:false,transactionCursor:0,leaders:{},updatedAt:(await fs.stat(path.join(root,`${year}-metadata.json`))).mtime.toISOString(),checkedAt:null};
 s.coreUpdatedAt=s.updatedAt;
 for(const name of names.filter(n=>new RegExp(`^${year}-roster-\\d+-\\d+\\.json$`).test(n))){
   const [,w,t]=name.match(/roster-(\d+)-(\d+)/),ps=Y.roster(await read(name),year,Number(w)).map(compactPlayer);
   s.weeks[w]??={players:[]};s.weeks[w].players.push(...ps);s.rosterVerified[`${w}:${t}`]=(await fs.stat(path.join(root,name))).mtime.toISOString();
 }
 // Keep the already published current-season rows as a labelled fallback until
 // each scored Yahoo roster is verified. No historical aggregate is fabricated.
 if(year===2026){
   for(const [week,wd]of Object.entries(z.weeks)){
     s.weeks[week]??={players:[]};const legacy=Number(week)===1?z.players.filter(p=>p.owner&&!/^w\d+-/.test(String(p.id))):wd.players||[];
     for(const t of s.teams)if(!s.rosterVerified[`${week}:${t.id}`])for(const p of legacy.filter(p=>p.owner===t.owner)){
       const ref=byName.get(norm(p.name))||[...players.values()].find(x=>x.position==='DEF'&&x.nfl===p.nfl&&p.position==='DEF');
       s.weeks[week].players.push({...compactPlayer(ref||{}),...p,playerId:ref?.playerId||`legacy-${norm(p.name)}`,year,week:Number(week),source:'published-snapshot'});
     }
   }
   const currentFile=`${year}-rosters-${league.currentWeek}.json`;
   if(names.includes(currentFile))for(const r of Y.find(await read(currentFile),'team')){
     const t=Y.flat(r),id=Number(t.team_id),owner=Y.ownerFor(year,t.team_key),week=league.currentWeek;
     if(!s.rosterVerified[`${week}:${id}`]){s.weeks[week]??={players:[]};s.weeks[week].players.push(...Y.find(t.roster,'player').map(p=>({...compactPlayer(Y.playerRecord(p,year,week,owner)),source:'yahoo-lineup-points-pending'})));}
   }
 }
 s.drafts=Y.drafts(await get('draft'),year).map(p=>{const ref=players.get(p.playerId),old=d.drafts.find(x=>x.year===year&&String(x.playerId)===p.playerId);return {...p,name:ref?.name||old?.player||`Yahoo player ${p.playerId}`,position:ref?.position||old?.position||'',nfl:ref?.nfl||old?.nflTeam||'',headshot:ref?.headshot||''};});
 for(let start=0;start<10000;start+=100){const name=`${year}-transactions${start?'-'+start:''}.json`;if(!names.includes(name)){s.transactionCursor=start;break;}
   const rows=Y.transactions(await read(name),year,s.games).map(t=>({...t,players:t.players.map(compactPlayer)}));s.transactions.push(...rows);
   if(rows.length<100){s.transactionsComplete=true;break;}}
 s.transactions=[...new Map(s.transactions.map(t=>[t.id,t])).values()].sort((a,b)=>b.timestamp-a.timestamp);
 if(year===2026)for(const pos of ['QB','RB','WR','TE','K','DEF']){const name=`${year}-players-${pos}.json`;if(names.includes(name))s.leaders[pos]=Y.playerStats(await read(name),year).map(compactPlayer);}
 for(const g of s.games.filter(g=>g.complete))for(const id of [g.aId,g.bId])if(s.rosterVerified[`${g.week}:${id}`])s.rosterFinal[`${g.week}:${id}`]=true;
 s.configurationUpdatedAt=s.coreUpdatedAt;
 s.transactionsUpdatedAt=(await fs.stat(path.join(root,`${year}-transactions.json`))).mtime.toISOString();
 if(year===2026){s.leadersUpdatedAt=(await fs.stat(path.join(root,'2026-players-DEF.json'))).mtime.toISOString();s.updatedAt=[s.updatedAt,s.transactionsUpdatedAt,...Object.values(s.rosterVerified)].sort().at(-1);}
 s.coverage=coverage(s);Y.validateSeason(s,{requireRosters:s.coverage.rostersComplete});
 await fs.writeFile(`public/data/yahoo/${year}.json`,JSON.stringify(s));
 console.log(year,JSON.stringify(s.coverage),'transactions',s.transactions.length,'size',JSON.stringify(s).length);
}
