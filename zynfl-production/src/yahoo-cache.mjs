import * as Y from './yahoo-data.mjs';
const MINUTE=60000, HOUR=60*MINUTE, DAY=24*HOUR;
export const compactPlayer = p => {const {stats,...rest}=p;return rest;};
export function coverage(s){
  const required=new Set();
  for(const g of s.games.filter(g=>g.complete))for(const id of [g.aId,g.bId])required.add(`${g.week}:${id}`);
  const verified=[...required].filter(k=>s.rosterFinal?.[k]);
  return {requiredRosters:required.size,verifiedRosters:verified.length,rostersComplete:verified.length===required.size,transactionsComplete:!!s.transactionsComplete,draftPicks:s.drafts.length};
}
// Persist each week separately: large league histories must not exceed a single
// Durable Object KV value or SQLite binding limit. A transaction publishes atomically.
export class SeasonCache {
  constructor(connection){this.c=connection;this.memory=new Map();this.running=new Map();
    this.c.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS yahoo_public_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  }
  read(key){const row=this.c.ctx.storage.sql.exec('SELECT value FROM yahoo_public_cache WHERE key = ?',key).toArray()[0];return row?JSON.parse(row.value):null;}
  write(key,value){this.c.ctx.storage.sql.exec('INSERT INTO yahoo_public_cache (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(value));}
  async load(year){
    if(this.memory.has(year))return this.memory.get(year);
    let header=this.read(`season:${year}`),season;
    if(header){season={...header,weeks:{}};for(const w of header.weekKeys)season.weeks[w]=this.read(`week:${year}:${w}`);delete season.weekKeys;}
    else{const r=await this.c.env.ASSETS.fetch(new Request(`https://zynfl.com/data/yahoo/${year}.json`));if(!r.ok)throw Error('snapshot_unavailable');season=await r.json();Y.validateSeason(season,{requireRosters:false});this.save(season);}
    this.memory.set(year,season);return season;
  }
  save(s){s.coverage=coverage(s);const {weeks,...header}=s;this.c.ctx.storage.transactionSync(()=>{this.write(`season:${s.year}`,{...header,weekKeys:Object.keys(weeks)});for(const [w,data]of Object.entries(weeks))this.write(`week:${s.year}:${w}`,data);});this.memory.set(s.year,s);}
  async public(year){const s=await this.load(year);const blocked=Number(await this.c.ctx.storage.get('yahooBlockedUntil')||0);const stale=!!s.lastError||Date.now()-Date.parse(s.updatedAt)>(s.league.finished?7*DAY:5*MINUTE);
    if(!s.league.finished&&Date.now()-Date.parse(s.checkedAt||0)>MINUTE&&blocked<Date.now())this.c.ctx.waitUntil(this.refresh(year).catch(()=>{}));
    return {...s,sync:{state:stale?'stale':'ready',updatedAt:s.updatedAt,checkedAt:s.checkedAt||null,retryAt:blocked>Date.now()?new Date(blocked).toISOString():null,error:s.lastError||null}};
  }
  refresh(year,options={}){
    if(this.running.has(year))return this.running.get(year);
    const p=this.update(year,options).finally(()=>this.running.delete(year));this.running.set(year,p);return p;
  }
  async update(year,{maintenance=false}={}){
    const original=await this.load(year),s=structuredClone(original),now=Date.now();
    if(Number(await this.c.ctx.storage.get('yahooBlockedUntil')||0)>now)return original;
    if(!maintenance&&now-Date.parse(s.checkedAt||0)<MINUTE)return original;
    s.checkedAt=new Date().toISOString();
    let changed=false;
    const read=(kind,week=1,start=0,position='ALL')=>this.c.sourceRead(year,kind,week,start,position);
    const getRoster=async(week,teamId)=>{
      const ps=Y.roster(await read('team-roster',week,teamId),year,week).map(compactPlayer);
      if(ps.length<9||ps.some(p=>!Number.isFinite(p.points)))throw Error('incomplete_roster');
      const owner=Y.OWNERS[year][teamId],old=s.weeks[week]?.players||[];
      s.weeks[week]={...s.weeks[week],players:[...old.filter(p=>p.owner!==owner),...ps]};
      s.rosterVerified[`${week}:${teamId}`]=new Date().toISOString();s.rosterFinal ||= {};if(s.games.some(g=>g.complete&&g.week===week&&[g.aId,g.bId].includes(teamId)))s.rosterFinal[`${week}:${teamId}`]=true;changed=true;
    };
    try{
      if(!s.league.finished||now-Date.parse(s.coreUpdatedAt||0)>7*DAY){
        const league=Y.leagueMeta(await read('metadata'));
        const teams=Y.standings(await read('standings'),year),games=Y.schedule(await read('schedule'),year);
        Y.validateSeason({...s,league,teams,games},{requireRosters:false});
        Object.assign(s,{league,teams,games,coreUpdatedAt:new Date().toISOString()});changed=true;
      }
      if(!s.league.finished){
        // Scored rosters include Yahoo's exact selected positions. One refresh is
        // shared by all visitors; the read queue spaces upstream requests.
        const week=s.league.currentWeek;
        for(const t of s.teams)await getRoster(week,t.id);
      }
      // Incremental transaction paging never stops at the first 100 rows.
      if(!s.transactionsComplete||!s.league.finished||maintenance&&now-Date.parse(s.transactionsUpdatedAt||0)>7*DAY){
        const start=s.transactionsComplete?0:Number(s.transactionCursor||0);
        const raw=await read('transactions',1,start),rows=Y.transactions(raw,year,s.games).map(t=>({...t,players:t.players.map(compactPlayer)}));
        const known=new Set(s.transactions.map(t=>t.id));
        s.transactions=[...new Map([...s.transactions,...rows].map(t=>[t.id,t])).values()].sort((a,b)=>b.timestamp-a.timestamp);
        if(rows.length<100||s.transactionsComplete&&rows.some(t=>known.has(t.id))){s.transactionsComplete=true;s.transactionCursor=0;}
        else{s.transactionsComplete=false;s.transactionCursor=start+100;}
        s.transactionsUpdatedAt=new Date().toISOString();changed=true;
      }
      // Complete missing played rosters first; then sweep historical rosters for
      // stat corrections. A bounded batch resumes from its saved cursor.
      if(maintenance){
        if(now-Date.parse(s.configurationUpdatedAt||0)>7*DAY){
          s.settings=Y.leagueSettings(await read('settings'));const picks=Y.drafts(await read('draft'),year);
          if(picks.length===s.drafts.length)s.drafts=picks.map(p=>({...s.drafts.find(old=>old.playerId===p.playerId),...p}));
          s.configurationUpdatedAt=new Date().toISOString();changed=true;
        }
        const jobs=[...new Set(s.games.filter(g=>g.complete).flatMap(g=>[`${g.week}:${g.aId}`,`${g.week}:${g.bId}`]))].sort((a,b)=>Number(b.split(':')[0])-Number(a.split(':')[0]));
        const missing=jobs.filter(k=>!s.rosterFinal?.[k]);
        const old=jobs.filter(k=>now-Date.parse(s.rosterVerified[k]||0)>(s.league.finished?30*DAY:6*HOUR));
        for(const k of (missing.length?missing:old).slice(0,4)){const [w,id]=k.split(':').map(Number);await getRoster(w,id);}
        if(!s.league.finished&&now-Date.parse(s.leadersUpdatedAt||0)>5*MINUTE){
          for(const pos of ['QB','RB','WR','TE','K','DEF'])s.leaders[pos]=Y.playerStats(await read('players',1,0,pos),year).map(compactPlayer);
          s.leadersUpdatedAt=new Date().toISOString();changed=true;
        }
      }
      if(changed)s.updatedAt=new Date().toISOString();s.lastError=null;
    }catch(error){
      s.lastError=/^yahoo_(api_\d+|rate_limited|not_connected)$/.test(error.message)?error.message:'refresh_incomplete';
      // Already validated successful pieces are retained. A failed response never
      // replaces a good roster with an empty list or zeroes out a season.
      if(changed)s.updatedAt=new Date().toISOString();
    }
    this.save(s);return s;
  }
}
