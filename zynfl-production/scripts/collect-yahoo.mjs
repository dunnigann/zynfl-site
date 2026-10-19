// Owner-only one-time backfill. Set YAHOO_SETUP_TOKEN in the environment.
import fs from 'node:fs/promises';
import path from 'node:path';
import {schedule, leagueMeta, find} from '../src/yahoo-data.mjs';
const directory=process.argv[2];
if(!directory || !process.env.YAHOO_SETUP_TOKEN)throw Error('Usage: YAHOO_SETUP_TOKEN=... node scripts/collect-yahoo.mjs /private/raw/directory');
await fs.mkdir(directory,{recursive:true});
const read=async name=>JSON.parse(await fs.readFile(path.join(directory,name),'utf8'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let fetched=0;
async function get(year,kind,params={},name=`${year}-${kind}.json`,fresh=false){
  const file=path.join(directory,name);
  if(!fresh){try{return await read(name);}catch{}}
  await pause(1250);
  const url=new URL(`/api/yahoo/source/${year}/${kind}`,'https://zynfl.com');
  for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
  const response=await fetch(url,{headers:{'X-ZYNFL-Setup':process.env.YAHOO_SETUP_TOKEN},signal:AbortSignal.timeout(45000)});
  const data=await response.json();
  if(!response.ok)throw Error(`${year}/${kind}: ${data.error||response.status}; stopped without retry`);
  await fs.writeFile(file,JSON.stringify(data));
  fetched++;if(fetched%10===0)console.log(`Saved ${fetched} additional responses`);
  return data;
}
for(const year of [2026,2025,2024]){
  const meta=leagueMeta(await get(year,'metadata',{},`${year}-metadata.json`,year===2026));
  await get(year,'standings',{},`${year}-standings.json`,year===2026);
  const games=schedule(await get(year,'schedule',{},`${year}-schedule.json`,year===2026),year);
  const pairs=new Set();
  for(const g of games)if(g.complete||g.week===meta.currentWeek)for(const id of [g.aId,g.bId])pairs.add(`${g.week}:${id}`);
  for(const pair of pairs){const [week,start]=pair.split(':');await get(year,'team-roster',{week,start},`${year}-roster-${week}-${start}.json`);}
  for(let start=0;start<10000;start+=100){
    const data=await get(year,'transactions',{start},`${year}-transactions${start?'-'+start:''}.json`,year===2026&&start===0);
    if(find(data,'transaction').length<100)break;
  }
  if(year===2026)for(const position of ['QB','RB','WR','TE','K','DEF'])await get(year,'players',{position},`${year}-players-${position}.json`);
  console.log(`Season ${year}: weekly rosters and transactions complete`);
}
console.log(`Completed: ${fetched} new responses`);
