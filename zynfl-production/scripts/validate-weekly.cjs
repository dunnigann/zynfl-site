const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../public'),ctx=vm.createContext({window:{},console});
const files=['zynfl-data','season-2026-data','week-5-2026','season-sync','season-2026-leaders'];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,'assets/js',file+'.js'),'utf8'),ctx);
const z=ctx.window.ZYNFL_2026,d=ctx.window.ZYNFL_DATA,owners=Object.keys(z.teams),round=n=>Math.round(n*100)/100;
const expected={Jack:[147.78,114.64,5,0],Nick:[125.96,107.05,0,5],Chuck:[102.14,100.46,3,2],Leo:[128.24,106.41,2,3],Akhil:[107.12,98.96,3,2],Liam:[149.84,107.71,4,1],Mitchell:[119.88,117.9,3,2],Brock:[85.5,101.16,1,4],Isaac:[129.92,114.08,2,3],Santi:[139.44,118.66,3,2],Tina:[108.5,106.39,3,2],Quinn:[105.26,109.45,1,4]};
const optExpected={Jack:150.68,Nick:125.96,Chuck:113.74,Leo:140.34,Akhil:125.22,Liam:149.84,Mitchell:137.4,Brock:87,Isaac:136.62,Santi:139.44,Tina:126.5,Quinn:127.86};
assert.equal(z.week,5);assert.equal(z.weeks[5].matchups.length,6);
for(const [week,s] of Object.entries(z.weeks)){
 const rows=+week===1?z.players.filter(p=>!/^w\d+-/.test(p.id)&&p.owner):s.players;
 assert.equal(new Set(s.matchups.flat()).size,12);assert.equal(s.matchups.length,6);assert.equal(new Set(rows.map(p=>p.id)).size,rows.length);
 for(const o of owners){const roster=rows.filter(p=>p.owner===o),starters=roster.filter(p=>!['BN','IR'].includes(p.slot));assert.equal(round(starters.reduce((n,p)=>n+(p.points||0),0)),s.scores[o],`${week} ${o} points`);const best=ctx.window.ZYNFL_OPTIMAL(roster);assert(best.score>=s.scores[o]-.001);assert.equal(new Set(best.ids).size,best.ids.length);assert(best.ids.every(id=>roster.find(p=>p.id===id)?.slot!=='IR'));}
}
for(const [o,[score,projection,w,l]] of Object.entries(expected)){const roster=z.weeks[5].players.filter(p=>p.owner===o),starters=roster.filter(p=>!['BN','IR'].includes(p.slot));assert.equal(round(starters.reduce((n,p)=>n+p.projection,0)),projection,o+' projection');assert.equal(z.weeks[5].scores[o],score);assert.equal(ctx.window.ZYNFL_OPTIMAL(roster).score,optExpected[o],o+' optimal');const standing=d.standings[2026].find(x=>x.owner===o);assert.equal(standing.w,w);assert.equal(standing.l,l);assert.equal(standing.g,5);assert(d.owners[o].seasons.at(-1).lineupEff>0);}
assert.equal(d.matchups.filter(g=>g.year===2026).length,30);assert.equal(new Set(d.matchups.map(g=>[g.year,g.week,...[g.aOwner,g.bOwner].sort()].join('|'))).size,d.matchups.length);assert.equal(d.meta.games,226);assert.equal(d.meta.regularGames,198);
assert.equal(d.rivalries.find(r=>r.id==='durby').beltHolder,'Tina');assert.equal(d.rivalries.find(r=>r.id==='lion-raven').beltHolder,'Leo');
const gibbs=d.players.find(p=>p.name==='Jahmyr Gibbs');assert.equal(gibbs.starts,35);assert.equal(gibbs.history.find(h=>h.year===2026).starts,5);assert.equal(gibbs.starterPoints,709.5);
const before=JSON.stringify({owners:d.owners,players:d.players,matchups:d.matchups,awards:d.awards});vm.runInContext(fs.readFileSync(path.join(root,'assets/js/season-sync.js'),'utf8'),ctx);assert.equal(JSON.stringify({owners:d.owners,players:d.players,matchups:d.matchups,awards:d.awards}),before,'sync must not double count on rerun');
for(const pos of ['QB','RB','WR','TE','FLEX','K','DEF']){const leaders=ctx.window.ZYNFL_2026_LEADERS[pos];assert.equal(leaders.length,10);assert(leaders.every((p,i)=>!i||p.points<=leaders[i-1].points));}
const ledger=JSON.parse(fs.readFileSync(path.join(root,'data/season-2026-history.json')));assert.equal(ledger.games.length,30);assert(ledger.complete);
console.log('PASS: all 60 team scores; Week 5 projections, records and legal best lineups; career starts/points; 30 archived games; rivalry belts; scoring leaders; repeat-safe aggregation.');
