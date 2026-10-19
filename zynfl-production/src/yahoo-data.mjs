// Only these three ZYNFL leagues may be published. Account/manager credentials
// and private Yahoo metadata never enter a public snapshot.
export const LEAGUES = { 2024: '449.l.1118810', 2025: '461.l.518801', 2026: '470.l.800556' };
export const OWNERS = {
  2024: { 1:'Tina',2:'Quinn',3:'Chuck',4:'Calvin',5:'Daniel',6:'Rick',7:'Brock',8:'Liam',9:'Isaac',10:'Jack',11:'Nick',12:'Santi' },
  2025: { 1:'Tina',2:'Quinn',3:'Chuck',4:'Leo',5:'Daniel',6:'Rick',7:'Brock',8:'Liam',9:'Isaac',10:'Jack',11:'Nick',12:'Santi' },
  2026: { 1:'Tina',2:'Quinn',3:'Chuck',4:'Leo',5:'Akhil',6:'Mitchell',7:'Brock',8:'Liam',9:'Isaac',10:'Jack',11:'Nick',12:'Santi' }
};
export const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export function find(root, key) {
  if (!root || typeof root !== 'object') return [];
  const out = [];
  for (const [k,v] of Object.entries(root)) {
    if (k === key) out.push(v);
    else out.push(...find(v,key));
  }
  return out;
}
export function flat(value) {
  return Array.isArray(value) ? Object.assign({}, ...value.map(flat)) : value && typeof value === 'object' ? value : {};
}
const number = v => v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
const str = v => String(v ?? '').replace(/[\u0000-\u001f\u007f<>\"]/g,'').slice(0,200);
const nfl = v => { const x = str(v).toUpperCase(); return ({JAC:'JAX',WSH:'WAS',AZ:'ARI',LA:'LAR'}[x] || x); };
const safeURL = v => { try { const u=new URL(v); return u.protocol==='https:' ? u.href : ''; } catch { return ''; } };
const teamId = key => Number(String(key).split('.').at(-1));
export function ownerFor(year,key) { const o=OWNERS[year]?.[teamId(key)]; if(!o)throw new Error('unknown_yahoo_team'); return o; }

export function leagueMeta(payload) {
  const m=flat(find(payload,'league')[0]);
  return { year:Number(m.season), key:m.league_key, name:str(m.name), currentWeek:Number(m.current_week), startWeek:Number(m.start_week), endWeek:Number(m.end_week), startDate:m.start_date, endDate:m.end_date, finished:Number(m.is_finished)===1, teamCount:Number(m.num_teams) };
}
export function leagueSettings(payload) {
  const s=flat(find(payload,'settings')[0]);
  return { playoffStart:Number(s.playoff_start_week), playoffTeams:Number(s.num_playoff_teams), consolationTeams:Number(s.num_playoff_consolation_teams), reseed:!!Number(s.uses_playoff_reseeding), rosterPositions:find(s,'roster_position').map(p=>({position:p.position,count:Number(p.count),starting:!!Number(p.is_starting_position)})) };
}
export function teamRecord(raw,year) {
  const t=flat(raw),s=t.team_standings||{},out=s.outcome_totals||{};
  return { id:Number(t.team_id), key:t.team_key, owner:ownerFor(year,t.team_key), name:str(t.name), rank:number(s.rank), seed:number(s.playoff_seed), w:Number(out.wins||0), l:Number(out.losses||0), t:Number(out.ties||0), pf:number(s.points_for), pa:number(s.points_against), moves:Number(t.number_of_moves||0), trades:Number(t.number_of_trades||0), faabBalance:number(t.faab_balance), score:number(t.team_points?.total), projected:number(t.team_projected_points?.total) };
}
export function standings(payload,year) { return find(payload,'team').map(t=>teamRecord(t,year)); }
export function schedule(payload,year) {
  const games=new Map();
  for(const raw of find(payload,'matchup')) {
    const m=flat(raw),teams=find(m,'team').map(t=>teamRecord(t,year));
    if(teams.length!==2)continue; // A playoff bye is not a played game.
    const [a,b]=teams,week=Number(m.week),id=`${year}:${week}:${[a.id,b.id].sort((x,y)=>x-y).join('-')}`;
    const status=m.status||'preevent',complete=status==='postevent';
    games.set(id,{id,year,week,start:m.week_start,end:m.week_end,status,complete,playoffs:Number(m.is_playoffs)===1,consolation:Number(m.is_consolation)===1,aId:a.id,bId:b.id,aOwner:a.owner,bOwner:b.owner,aTeam:a.name,bTeam:b.name,aScore:a.score,bScore:b.score,aProjected:a.projected,bProjected:b.projected,winner:complete?(m.winner_team_key?ownerFor(year,m.winner_team_key):null):null,tied:!!Number(m.is_tied)});
  }
  return [...games.values()].sort((a,b)=>a.week-b.week||a.aId-b.aId);
}
export function playerRecord(raw,year,week=null,owner=null) {
  const p=flat(raw),selected=flat(p.selected_position),position=str(p.primary_position||p.display_position),slot=str(selected.position||'');
  return { playerId:String(p.player_id),playerKey:p.player_key,name:str(p.name?.full),position,nfl:nfl(p.editorial_team_abbr),headshot:safeURL(p.headshot?.url||p.image_url),eligible:(p.eligible_positions||[]).map(x=>x.position),byeWeek:number(p.bye_weeks?.week),injury:str(p.status||''),slot:slot==='W/R/T'?'FLEX':slot,owner,year,week,points:number(p.player_points?.total),projection:number(p.player_projected_points?.total),stats:Object.fromEntries(find(p.player_stats,'stat').map(s=>[s.stat_id,number(s.value)])) };
}
export function roster(payload,year,week) {
  const team=flat(find(payload,'team')[0]),owner=ownerFor(year,team.team_key);
  return find(team.roster,'player').map(p=>playerRecord(p,year,week,owner));
}
export function playerStats(payload,year) { return find(payload,'player').map(p=>playerRecord(p,year)); }
export function drafts(payload,year) { return find(payload,'draft_result').map(p=>({year,overall:Number(p.pick),round:Number(p.round),pick:(Number(p.pick)-1)%12+1,owner:ownerFor(year,p.team_key),teamId:teamId(p.team_key),playerId:String(p.player_key).split('.').at(-1),cost:number(p.cost)})); }
export function transactions(payload,year,games) {
  const weeks=[...new Map(games.map(g=>[g.week,{week:g.week,start:g.start,end:g.end}])).values()].sort((a,b)=>a.week-b.week);
  return find(payload,'transaction').map(raw=>{
    const t=flat(raw),timestamp=Number(t.timestamp)*1000;
    const date=new Date(timestamp).toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
    // Fantasy weeks begin Tuesday after the previous matchup ends. Moves before
    // the first scoring week remain preseason; dates use the league's timezone.
    let week=0;
    for(const w of weeks) { const prev=weeks.find(x=>x.week===w.week-1); if(date>=(prev?new Date(Date.parse(prev.end+'T12:00:00Z')+86400000).toISOString().slice(0,10):w.start)) week=w.week; }
    const players=find(t.players,'player').map(raw=>{
      const p=flat(raw),x=flat(p.transaction_data);
      return {...playerRecord(raw,year),action:x.type,source:x.source_type,destination:x.destination_type,from:x.source_team_key?ownerFor(year,x.source_team_key):null,to:x.destination_team_key?ownerFor(year,x.destination_team_key):null};
    });
    return {id:t.transaction_key,year,type:t.type,status:t.status,timestamp,date:new Date(timestamp).toISOString(),week,faab:number(t.faab_bid),players};
  });
}

export function validateSeason(season,{requireRosters=true}={}) {
  const {year,league,teams,games,weeks}=season;
  if(league.key!==LEAGUES[year]||teams.length!==12||new Set(teams.map(t=>t.id)).size!==12)throw new Error('incomplete_league');
  if(new Set(games.map(g=>g.id)).size!==games.length)throw new Error('duplicate_matchup');
  for(const g of games.filter(g=>g.complete)){
    if(!Number.isFinite(g.aScore)||!Number.isFinite(g.bScore))throw new Error('missing_final_score');
    if(requireRosters)for(const owner of [g.aOwner,g.bOwner]){
      const ps=weeks[g.week]?.players?.filter(p=>p.owner===owner)||[];
      if(ps.length<9||ps.some(p=>!Number.isFinite(p.points)))throw new Error(`incomplete_roster_${year}_${g.week}_${owner}`);
    }
  }
  return season;
}
