/* Resolve transcription errors using adjacent rosters and the supplied transaction log. */
(()=>{
 const z=window.ZYNFL_2026;
 const changes={
  'w3-quinn-12':{name:'Brian Robinson Jr.'},
  'w4-liam-14':{name:'Mike Washington Jr.',position:'RB'}
 };
 for(const p of [...z.players,...Object.values(z.weeks).flatMap(w=>w.players||[])])if(changes[p.id]){
  Object.assign(p,changes[p.id]);p.correctionSource='Player identity cross-check: adjacent weekly rosters and Yahoo transaction report supplied October 14, 2026';
  const ref=z.weeks['5'].players.find(r=>r.name===p.name);if(ref?.headshot)p.headshot=ref.headshot;
 }
})();
