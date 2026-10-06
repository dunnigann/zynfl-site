/* 2026 NFL fantasy season scoring through Week 4. All players, including free agents.
   Yahoo default half-PPR scoring; verified against the supplied Yahoo roster snapshots.
   Complete-league cross-check: FantasyPros 2026 season stats by position, as of 2026-10-06:
   https://www.fantasypros.com/nfl/stats/rb.php?scoring=HALF&year=2026
   (substitute qb, wr, te, k, dst for rb). Published totals are rounded to tenths.
   Ownership is deliberately resolved at render time from the Week 4 ZYNFL roster. */
(() => {
  const rows={
    QB:[['Josh Allen','BUF',115.0],['Brock Purdy','SF',101.5],['Bryce Young','CAR',92.6],['Tyler Shough','NO',88.3],['Jared Goff','DET',86.1],['Patrick Mahomes','KC',85.6],['Kirk Cousins','LV',82.8],['Dak Prescott','DAL',82.2],['Lamar Jackson','BAL',80.1],['Joe Burrow','CIN',79.7]],
    RB:[['Jahmyr Gibbs','DET',105.0],['Kenneth Walker III','KC',104.1],['Bijan Robinson','ATL',98.4],['Derrick Henry','BAL',87.3],['Jonathan Taylor','IND',81.2],['Kyren Williams','LAR',79.2],['Javonte Williams','DAL',74.3],['Chuba Hubbard','CAR',74.0],['Christian McCaffrey','SF',66.0],['Ashton Jeanty','LV',64.4]],
    WR:[['Jaxon Smith-Njigba','SEA',100.7],['CeeDee Lamb','DAL',93.7],['Amon-Ra St. Brown','DET',75.8],['Chris Olave','NO',72.6],['Christian Watson','GB',67.1],['Davante Adams','LAR',62.0],['Tetairoa McMillan','CAR',61.5],['Tee Higgins','CIN',58.6],['Zay Flowers','BAL',58.2],['Garrett Wilson','NYJ',51.0]],
    TE:[['George Kittle','SF',56.4],['Trey McBride','ARI',52.7],['Juwan Johnson','NO',49.7],['Sam LaPorta','DET',45.8],['Travis Kelce','KC',44.6],['Isaiah Likely','NYG',42.0],['Harold Fannin Jr.','CLE',41.8],['Brock Bowers','LV',40.2],['Mike Gesicki','CIN',39.0],['Dalton Kincaid','BUF',38.5]],
    K:[['Spencer Shrader','IND',54],['Will Reichard','MIN',52],['Evan McPherson','CIN',47],['Matt Gay','LV',46],['Ryan Fitzgerald','CAR',42],['Chase McLaughlin','TB',41],['Brandon Aubrey','DAL',41],['Tyler Loop','BAL',40],['Chad Ryland','ARI',39],['Jake Bates','DET',39]],
    DEF:[['Minnesota Vikings','MIN',50],['Jacksonville Jaguars','JAC',39],['Las Vegas Raiders','LV',38],['Pittsburgh Steelers','PIT',37],['Cincinnati Bengals','CIN',36],['Seattle Seahawks','SEA',35],['Chicago Bears','CHI',32],['New England Patriots','NE',31],['Carolina Panthers','CAR',30],['New York Giants','NYG',29]]
  };
  const norm=s=>String(s).toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
  const season=window.ZYNFL_2026, last=Number(season.week), weekRows=w=>w===1?season.players.filter(p=>!/^w\d+-/.test(p.id)):(season.weeks[String(w)]?.players||[]);
  const out={updated:'2026-10-06',week:last};
  for(const [pos,list] of Object.entries(rows))out[pos]=list.map(([name,nfl,reported])=>{
    const weekly=Array.from({length:last},(_,i)=>weekRows(i+1).find(p=>p.position===pos&&(pos==='DEF'?p.nfl===nfl:norm(p.name)===norm(name))));
    const archived=weekly.length===last&&weekly.every(p=>p?.points!=null)?weekly.reduce((sum,p)=>sum+Number(p.points),0):null;
    return {name,nfl,position:pos,points:archived!=null&&Math.abs(archived-reported)<.16?Math.round(archived*100)/100:reported};
  });
  out.FLEX=[...out.RB,...out.WR,...out.TE].sort((a,b)=>b.points-a.points).slice(0,10);
  window.ZYNFL_2026_LEADERS=out;
})();
