const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root=path.resolve(__dirname,'../public');
const sandbox={window:{ZYNFL_YAHOO_MODEL:{}},structuredClone};
vm.createContext(sandbox);
for(const f of ['yahoo-model.js','yahoo-initial.js','jack-rankings-2026.js','manager-locations.js','home-globe.js'])vm.runInContext(fs.readFileSync(path.join(root,'assets/js',f),'utf8'),sandbox);
const {ZYNFL_HOME:home,ZYNFL_DATA:D,ZYNFL_2026:Z,ZYNFL_MANAGER_LOCATIONS:locations}=sandbox.window;
const before=JSON.stringify({D,Z});
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};freeze(D);freeze(Z);
test('all twelve supplied managers map to valid city/country centers',()=>{assert.equal(Object.keys(locations).length,12);for(const owner of D.activeOwners){assert.ok(locations[owner],owner);assert.ok(Math.abs(locations[owner].lat)<=90);assert.ok(Math.abs(locations[owner].lon)<=180);}assert.equal(locations.Isaac.precision,'country');assert.equal(locations.Chuck.lat,locations.Mitchell.lat);assert.equal(locations.Quinn.lon,locations.Nick.lon);assert.equal(locations.Calvin,undefined);});
test('current card data and six matchup connections match source exactly',()=>{const m=home.model(D,Z,2026);assert.equal(m.rows.length,12);assert.equal(m.week,Z.currentWeek);assert.equal(m.games.length,6);for(const row of m.rows)assert.equal(row,D.standings[2026].find(r=>r.owner===row.owner));assert.equal(m.games,Z.weeks[m.week].games);assert.equal(m.champion.owner,'Leo');assert.equal(m.champion.year,2025);assert.equal(m.ranking[0],'6');assert.equal(m.ranking[1].jackRankings[0],'Jack');});
test('historical seasons use their own champions, playoff finishes and scores',()=>{for(const [year,owner]of [[2024,'Chuck'],[2025,'Leo']]){const m=home.model(D,Z,year);assert.equal(m.champion.owner,owner);assert.equal(m.current,false);assert.equal(m.ranking,undefined);assert.ok(m.games.every(g=>g.year===year&&g.complete));assert.equal(m.rows.find(r=>r.owner===owner).finalRank,1);}assert.equal(home.model(D,Z,2025).rows.find(r=>r.owner==='Tina').finalRank,11);});
test('future/current teams never borrow unavailable rankings',()=>{const m=home.model(D,{...Z,weeks:{},currentWeek:9},2026);assert.equal(m.ranking,undefined);assert.equal(m.games.length,0);});
test('only co-located managers cluster, even when separate cities overlap on screen',()=>{
 const points=Object.entries(locations).map(([owner,l])=>({owner,lat:l.lat,lon:l.lon,x:100,y:100}));
 const groups=home.clusters(points);assert.equal(groups.length,9);
 const group=owner=>groups.find(g=>g.members.some(p=>p.owner===owner));
 assert.equal(group('Jack').members.length,1);assert.equal(group('Liam').members.length,1);assert.equal(group('Brock').members.length,1);assert.equal(group('Santi').members.length,1);
 assert.deepEqual(Array.from(group('Quinn').members,p=>p.owner),['Nick','Quinn']);assert.deepEqual(Array.from(group('Chuck').members,p=>p.owner),['Akhil','Chuck','Mitchell']);
 assert.equal(groups.flatMap(g=>g.members).length,12);assert.equal(home.clusters([]).length,0);
});
test('nearby city markers spread without changing geographic anchors or source points',()=>{
 for(const width of [305,375,900,1340]){
  const points=Object.entries(locations).map(([owner,l])=>({owner,lat:l.lat,lon:l.lon,x:width/2,y:230})),copy=JSON.stringify(points);
  const groups=home.clusters(points),spread=home.spreadBeacons(groups,width,480);assert.equal(spread.length,9);
  for(const n of spread){assert.equal(n.anchorX,width/2);assert.equal(n.anchorY,230);assert.ok(n.x>=27&&n.x<=width-27);assert.ok(n.y>=29&&n.y<=425);}
  for(let i=0;i<spread.length;i++)for(let j=i+1;j<spread.length;j++)assert.ok(Math.hypot(spread[i].x-spread[j].x,spread[i].y-spread[j].y)>=(width<600?48:54));
  assert.equal(JSON.stringify(points),copy);
 }
});
test('homepage adapters leave every existing league data value unchanged',()=>{assert.equal(JSON.stringify({D,Z}),before);});
test('bundled geography has valid coordinates and real coastline detail',()=>{const g=JSON.parse(fs.readFileSync(path.join(root,'assets/globe/earth-land.json')));assert.ok(g.dots.length>2500);assert.ok(g.coasts.length>50);for(const [lon,lat]of g.dots)assert.ok(Math.abs(lon)<=180&&Math.abs(lat)<=90);});

test('Week 6 supplied rankings survive repeated Yahoo rebuilds and only update Jack’s lists',()=>{
 const expected=['Jack','Liam','Chuck','Akhil','Santi','Isaac','Leo','Mitchell','Tina','Quinn','Nick','Brock'];
 assert.deepEqual(Array.from(Z.weeks[6].jackRankings),expected);
 const seasons=[2024,2025,2026].map(y=>JSON.parse(fs.readFileSync(path.join(root,'data/yahoo',y+'.json'))));
 for(let refresh=0;refresh<2;refresh++){
  const rebuilt=sandbox.window.ZYNFL_YAHOO_MODEL.build({ZYNFL_DATA:D,ZYNFL_2026:Z},seasons);
  assert.deepEqual(Array.from(rebuilt.ZYNFL_2026.weeks[6].jackRankings),expected);
  assert.equal(home.model(rebuilt.ZYNFL_DATA,rebuilt.ZYNFL_2026,2026).ranking[0],'6');
 }
 const prior=JSON.parse(JSON.stringify(Z.weeks[5].jackRankings));
 assert.deepEqual(expected.map((owner,i)=>prior.indexOf(owner)-i),[0,0,0,2,0,1,3,-4,0,-2,0,0]);
 const fresh={window:{ZYNFL_YAHOO_MODEL:{}}};vm.createContext(fresh);
 for(const name of ['yahoo-initial.js','jack-rankings-2026.js'])vm.runInContext(fs.readFileSync(path.join(root,'assets/js',name),'utf8'),fresh);
 const clean=JSON.parse(JSON.stringify(fresh.window.ZYNFL_2026));delete clean.jackRankings[6];clean.weeks[6].jackRankings=null;
 const original={window:{ZYNFL_YAHOO_MODEL:{}}};vm.createContext(original);vm.runInContext(fs.readFileSync(path.join(root,'assets/js/yahoo-initial.js'),'utf8'),original);
 assert.deepEqual(clean,JSON.parse(JSON.stringify(original.window.ZYNFL_2026)));
});
