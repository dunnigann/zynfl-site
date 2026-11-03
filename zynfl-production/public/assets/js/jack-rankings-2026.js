/* Jack's supplied lists load before live-sync captures its rebuild base. */
(()=>{
 'use strict';
 const season=window.ZYNFL_2026;
 const editions={
  6:['Jack','Liam','Chuck','Akhil','Santi','Isaac','Leo','Mitchell','Tina','Quinn','Nick','Brock'],
  7:['Jack','Chuck','Santi','Liam','Isaac','Akhil','Tina','Quinn','Leo','Mitchell','Nick','Brock'],
  8:['Liam','Jack','Santi','Chuck','Akhil','Isaac','Tina','Quinn','Mitchell','Leo','Nick','Brock']
 };
 season.jackRankings??={};
 for(const [week,order] of Object.entries(editions)){
  season.jackRankings[week]=order.slice();
  if(season.weeks?.[week])season.weeks[week].jackRankings=order.slice();
 }
})();
