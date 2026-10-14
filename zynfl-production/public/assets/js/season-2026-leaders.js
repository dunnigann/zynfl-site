/* 2026 NFL fantasy season scoring through Week 5. All players, including free agents.
   Yahoo default half-PPR scoring; verified against the supplied Yahoo roster snapshots.
   Complete-league cross-check: FantasyPros 2026 season stats by position, as of 2026-10-14:
   https://www.fantasypros.com/nfl/stats/rb.php?scoring=HALF&year=2026
   (substitute qb, wr, te, k, dst for rb). Published totals are rounded to tenths.
   Ownership is deliberately resolved at render time from the Week 5 ZYNFL roster. */
(() => {
  const rows={
    QB:[['Josh Allen','BUF',146.5],['Brock Purdy','SF',118.7],['Jared Goff','DET',115.0],['Joe Burrow','CIN',104.3],['Dak Prescott','DAL',96.8],['Kirk Cousins','LV',96.5],['Matthew Stafford','LAR',95.0],['Drake Maye','NE',94.3],['Jordan Love','GB',93.2],['Bryce Young','CAR',92.6]],
    RB:[['Jahmyr Gibbs','DET',140.2],['Bijan Robinson','ATL',112.2],['Derrick Henry','BAL',107.8],['Kenneth Walker III','KC',104.1],['Kyren Williams','LAR',95.8],['Jonathan Taylor','IND',90.9],['Javonte Williams','DAL',87.5],['James Cook','BUF',85.8],['Jaylen Warren','PIT',83.5],['Christian McCaffrey','SF',81.8]],
    WR:[['Jaxon Smith-Njigba','SEA',121.0],['Christian Watson','GB',96.4],['CeeDee Lamb','DAL',95.6],['Amon-Ra St. Brown','DET',85.7],['Davante Adams','LAR',81.6],['Chris Olave','NO',79.2],['Garrett Wilson','NYJ',70.9],['Parker Washington','JAX',70.5],['Zay Flowers','BAL',68.8],['Ja\'Marr Chase','CIN',66.4]],
    TE:[['Trey McBride','ARI',69.8],['Isaiah Likely','NYG',68.9],['Sam LaPorta','DET',63.1],['George Kittle','SF',61.3],['Brock Bowers','LV',59.2],['Tyler Warren','IND',54.9],['Juwan Johnson','NO',53.3],['Pat Freiermuth','PIT',50.8],['Mike Gesicki','CIN',45.9],['Travis Kelce','KC',44.6]],
    K:[['Spencer Shrader','IND',75],['Will Reichard','MIN',68],['Ka\'imi Fairbairn','HOU',54],['Evan McPherson','CIN',54],['Tyler Loop','BAL',54],['Jason Myers','SEA',52],['Matt Gay','LV',52],['Dominic Zvada','NYG',51],['Jake Bates','DET',49],['Chase McLaughlin','TB',48]],
    DEF:[['Minnesota Vikings','MIN',61],['Cincinnati Bengals','CIN',45],['Seattle Seahawks','SEA',44],['Jacksonville Jaguars','JAX',41],['Denver Broncos','DEN',39],['Pittsburgh Steelers','PIT',38],['San Francisco 49ers','SF',38],['New England Patriots','NE',37],['New York Jets','NYJ',37],['Las Vegas Raiders','LV',37]]
  };
  const norm=s=>String(s).toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
  const season=window.ZYNFL_2026, last=Number(season.week), weekRows=w=>w===1?season.players.filter(p=>!/^w\d+-/.test(p.id)):(season.weeks[String(w)]?.players||[]);
  const out={updated:'2026-10-14',week:last,sources:['https://www.fantasypros.com/nfl/stats/qb.php?year=2026&scoring=HALF','https://www.fantasypros.com/nfl/stats/rb.php?year=2026&scoring=HALF','https://www.fantasypros.com/nfl/stats/wr.php?year=2026&scoring=HALF','https://www.fantasypros.com/nfl/stats/te.php?year=2026&scoring=HALF','https://www.fantasypros.com/nfl/stats/k.php?year=2026','https://www.fantasypros.com/nfl/stats/dst.php?year=2026']};
  for(const [pos,list] of Object.entries(rows))out[pos]=list.map(([name,nfl,reported])=>{
    const weekly=Array.from({length:last},(_,i)=>weekRows(i+1).find(p=>p.position===pos&&(pos==='DEF'?p.nfl===nfl:norm(p.name)===norm(name))));
    const archived=weekly.length===last&&weekly.every(p=>p?.points!=null)?weekly.reduce((sum,p)=>sum+Number(p.points),0):null;
    return {name,nfl,position:pos,points:archived!=null&&Math.abs(archived-reported)<.16?Math.round(archived*100)/100:reported};
  });
  // Preserve clickable Player Files for free agents newly entering the top ten.
  const d=window.ZYNFL_DATA;
  for(const [pos,list] of Object.entries(out))if(Array.isArray(list)&&pos!=='sources')for(const p of list){
    let archive=d.players.find(x=>x.position===pos&&(norm(x.name)===norm(p.name)||(pos==='DEF'&&norm(p.name).endsWith(norm(x.name)))));
    if(!archive){archive={key:'leader2026:'+norm(p.name),name:p.name,position:pos,playerId:null,seasons:[],owners:[],starts:0,bench:0,ir:0,starterPoints:0,rosterPoints:0,avgDraft:null,drafts:[],history:[]};d.players.push(archive);}
    archive.seasonPoints2026=p.points;
  }
  out.FLEX=[...out.RB,...out.WR,...out.TE].sort((a,b)=>b.points-a.points).slice(0,10);
  window.ZYNFL_2026_LEADERS=out;
})();
