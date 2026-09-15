// Run with: node zynfl-production/scripts/validate-week1.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const pub=path.resolve(__dirname,'../public');const ctx=vm.createContext({window:{},console});
for(const file of ['season-2026-data.js','season-2026.js'])vm.runInContext(fs.readFileSync(path.join(pub,'assets/js',file),'utf8'),ctx);
const z=ctx.window.ZYNFL_2026,owners=Object.keys(z.teams),byid=new Map(z.players.map(p=>[p.id,p]));
assert.equal(owners.length,12);assert.equal(byid.size,z.players.length);assert.equal(z.matchups.flat().length,12);assert.equal(new Set(z.matchups.flat()).size,12);assert.equal(new Set(z.analystRankings).size,12);
const expected={Jack:127.8,Santi:85.8,Quinn:117.72,Nick:113.06,Tina:86.86,Brock:148.96,Chuck:126.06,Mitchell:148.66,Leo:102.56,Liam:124.4,Akhil:68.64,Isaac:105.42};
for(const o of owners){
 const roster=z.teams[o].players.map(id=>byid.get(id));assert(roster.every(p=>p&&p.owner===o));assert.equal(roster.filter(p=>p.slot!=='BN').length,9);
 const total=vm.runInContext(`zTotal(${JSON.stringify(o)})`,ctx);assert(Math.abs(total-expected[o])<1e-8,o+' total');
 const best=vm.runInContext(`zOptimal(${JSON.stringify(o)})`,ctx);assert(best.score>=total-1e-8);assert.equal(new Set(best.ids).size,9);
 console.log(o, 'score',total.toFixed(2),'best legal lineup',best.score.toFixed(2),'bench gap',(best.score-total).toFixed(2));
 assert(z.recaps[o]&&z.rankReasons[o]);
}
assert.equal(Object.keys(z.nflTeams).length,32);assert.equal(z.nflMatchups.length,16);assert.equal(new Set(z.nflMatchups.flatMap(g=>g.slice(0,2))).size,32);
for(const [t,d] of Object.entries(z.nflTeams)){assert(d.starters.some(x=>x.position==='QB'),t+' QB');assert(d.starters.some(x=>x.position==='RB'),t+' RB');assert(d.starters.every(x=>byid.has(x.id)),t+' refs');}
for(const p of z.players.filter(p=>!p.owner)){assert.equal(p.points,null);assert.equal(p.projection,null);}
assert.equal(vm.runInContext('zValidOrder(Array(12).fill("Jack"))',ctx),false);
assert.equal(vm.runInContext('zValidOrder(Z26.analystRankings)',ctx),true);
const index=fs.readFileSync(path.join(pub,'index.html'),'utf8');assert(!index.includes('data-page="season2025"'));assert(index.includes('data-page="season2026"'));assert(index.includes('data-page="matchups"'));
for(const o of ['akhil','mitchell'])assert(fs.existsSync(path.join(pub,'assets/images/managers',o+'.jpg')));
console.log('PASS: scores, legal lineup optimization, identities, all NFL matchups, unknown-score handling, ranking validation, routes, portraits.');
