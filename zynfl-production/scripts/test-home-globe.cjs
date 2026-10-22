const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root=path.resolve(__dirname,'../public');
const sandbox={window:{ZYNFL_YAHOO_MODEL:{}},structuredClone};
vm.createContext(sandbox);
for(const f of ['yahoo-model.js','yahoo-initial.js','jack-rankings-2026.js','manager-locations.js','manager-allegiances.js','home-globe.js'])vm.runInContext(fs.readFileSync(path.join(root,'assets/js',f),'utf8'),sandbox);
const {ZYNFL_HOME:home,ZYNFL_DATA:D,ZYNFL_2026:Z,ZYNFL_MANAGER_LOCATIONS:locations}=sandbox.window;
const before=JSON.stringify({D,Z});
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};freeze(D);freeze(Z);
test('all twelve supplied managers map to the US, with Plano and Carrollton corrections',()=>{
 assert.equal(Object.keys(locations).length,12);
 for(const owner of D.activeOwners){assert.ok(locations[owner],owner);assert.ok(locations[owner].lat>25&&locations[owner].lat<49);assert.ok(locations[owner].lon>-125&&locations[owner].lon<-66);assert.ok(fs.statSync(path.join(root,locations[owner].photo)).size<15000);}
 assert.equal(locations.Jack.label,'Plano, Texas');assert.equal(locations.Isaac.label,'Carrollton, Texas');assert.equal(locations.Calvin,undefined);
});
test('current card data and six matchup connections match source exactly',()=>{const m=home.model(D,Z,2026);assert.equal(m.rows.length,12);assert.equal(m.week,Z.currentWeek);assert.equal(m.games.length,6);for(const row of m.rows)assert.equal(row,D.standings[2026].find(r=>r.owner===row.owner));assert.equal(m.games,Z.weeks[m.week].games);assert.equal(m.champion.owner,'Leo');assert.equal(m.champion.year,2025);assert.equal(m.ranking[0],'6');assert.equal(m.ranking[1].jackRankings[0],'Jack');});
test('historical seasons use their own champions, playoff finishes and scores',()=>{for(const [year,owner]of [[2024,'Chuck'],[2025,'Leo']]){const m=home.model(D,Z,year);assert.equal(m.champion.owner,owner);assert.equal(m.current,false);assert.equal(m.ranking,undefined);assert.ok(m.games.every(g=>g.year===year&&g.complete));assert.equal(m.rows.find(r=>r.owner===owner).finalRank,1);}assert.equal(home.model(D,Z,2025).rows.find(r=>r.owner==='Tina').finalRank,11);});
test('future/current teams never borrow unavailable rankings',()=>{const m=home.model(D,{...Z,weeks:{},currentWeek:9},2026);assert.equal(m.ranking,undefined);assert.equal(m.games.length,0);});
test('all twelve portraits stay separate and preserve exact map anchors at mobile and desktop widths',()=>{
 const geometry=JSON.parse(fs.readFileSync(path.join(root,'assets/map/us-states.json')));
 for(const width of [305,375,600,900,1340]){
  const height=480,fit=Math.min((width-(width<600?48:75))/geometry.width,(height-145)/geometry.height);
  const points=Object.entries(locations).map(([owner,l])=>{const p=home.mapPoint(l.lat,l.lon,geometry);return {owner,x:width/2+(p.x-geometry.width/2)*fit,y:height*.47+(p.y-geometry.height/2)*fit};});
  const copy=JSON.stringify(points),spread=home.layoutMarkers(points,width,height);assert.equal(spread.length,12);assert.equal(new Set(spread.map(p=>p.owner)).size,12);
  for(const p of spread){const a=points.find(a=>a.owner===p.owner);assert.equal(p.anchorX,a.x);assert.equal(p.anchorY,a.y);assert.ok(p.x>=30&&p.x<=width-30);assert.ok(p.y>=35&&p.y<=height-104);}
  const gapX=width<600?53:64,gapY=width<600?66:76;
  for(let i=0;i<spread.length;i++)for(let j=i+1;j<spread.length;j++)assert.ok(Math.hypot((spread[i].x-spread[j].x)/gapX,(spread[i].y-spread[j].y)/gapY)>=.99,`${width}: ${spread[i].owner}/${spread[j].owner}`);
  assert.equal(JSON.stringify(points),copy);
 }
});
test('homepage adapters leave every existing league data value unchanged',()=>{assert.equal(JSON.stringify({D,Z}),before);});
test('bundled map includes every contiguous state plus DC and all city projections are in bounds',()=>{
 const g=JSON.parse(fs.readFileSync(path.join(root,'assets/map/us-states.json')));assert.equal(g.states.length,49);assert.ok(g.states.some(s=>s.code==='DC'));assert.ok(!g.states.some(s=>['AK','HI'].includes(s.code)));
 for(const l of Object.values(locations)){const p=home.mapPoint(l.lat,l.lon,g);assert.ok(p.x>=0&&p.x<=g.width);assert.ok(p.y>=0&&p.y<=g.height);}
 for(const s of g.states)for(const ring of s.rings)for(const [x,y]of ring){assert.ok(Number.isFinite(x)&&x>=0&&x<=g.width+.01);assert.ok(Number.isFinite(y)&&y>=0&&y<=g.height+.01);}
});
test('all 36 allegiances match the supplied categories and use bundled logos',()=>{
 const a=sandbox.window.ZYNFL_ALLEGIANCES;
 const expected={Jack:['cowboys','longhorns','spurs'],Nick:['jets','rangers','longhorns'],Akhil:['browns','india','palantir'],Quinn:['broncos','warriors','giants'],Brock:['seahawks','thunder','irish'],Isaac:['saints','lsu','pelicans'],Chuck:['ravens','nuggets','avalanche'],Leo:['lions','pistons','tigers'],Santi:['jets','yankees','knicks'],Liam:['packers','bucks','badgers'],Mitchell:['bears','cubs','bulls'],Tina:['broncos','warriors','duke']};
 assert.deepEqual(JSON.parse(JSON.stringify(a.managers)),expected);assert.equal(a.catalog.india.category,'Country');assert.equal(a.catalog.palantir.category,'Firm');
 for(const [owner,keys] of Object.entries(expected)){const html=a.markup(owner);for(const key of keys){const t=a.catalog[key];assert.ok(html.includes(t.name));assert.ok(html.includes(t.category));assert.ok(fs.statSync(path.join(root,t.logo)).size>100);}}
 assert.equal(a.markup('Calvin'),'');
});

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
