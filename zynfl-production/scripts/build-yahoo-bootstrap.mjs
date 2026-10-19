// Freeze the verified model as an immediate offline fallback. Live API updates
// rebuild it on top of the same public source data after the page opens.
import fs from 'node:fs/promises';import vm from 'node:vm';
await import('../public/assets/js/yahoo-model.js');
import {publishDueRankings} from '../src/yahoo-cache.mjs';
const c=vm.createContext({window:{},console});
for(const name of ['zynfl-data.js','adp-2026.js','media.js','season-2026-data.js','week-5-2026.js','snapshot-corrections.js','season-sync.js','archive-audit.js','season-2026-leaders.js','transactions-2026-data.js','transaction-sync.js'])vm.runInContext(await fs.readFile(`public/assets/js/${name}`,'utf8'),c);
const base=JSON.parse(JSON.stringify(c.window)),seasons=await Promise.all([2024,2025,2026].map(async y=>JSON.parse(await fs.readFile(`public/data/yahoo/${y}.json`,'utf8'))));
const inputs=JSON.parse(await fs.readFile('public/data/outlook-inputs.json','utf8'));for(const s of seasons)publishDueRankings(s,inputs);
const model=ZYNFL_YAHOO_MODEL.build(base,seasons);
const source=Object.entries(model).map(([k,v])=>`window.${k}=${JSON.stringify(v).replaceAll('<','\\u003c')};`).join('\n')+'\nwindow.ZYNFL_OPTIMAL=window.ZYNFL_YAHOO_MODEL.optimal;\n'+`window.ZYNFL_YAHOO_SEASONS=${JSON.stringify(seasons.map(({year,league,settings,teams,games,transactions,transactionsComplete,updatedAt})=>({year,league,settings,teams,games,transactions,transactionsComplete,updatedAt}))).replaceAll('<','\\u003c')};\n`;
await fs.writeFile('public/assets/js/yahoo-initial.js',source);console.log('Built verified offline fallback');
