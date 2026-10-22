/* Jack's supplied lists load before live-sync captures its rebuild base. */
(()=>{
 'use strict';
 const season=window.ZYNFL_2026;
 const week6=['Jack','Liam','Chuck','Akhil','Santi','Isaac','Leo','Mitchell','Tina','Quinn','Nick','Brock'];
 season.jackRankings??={};
 season.jackRankings[6]=week6.slice();
 if(season.weeks?.[6])season.weeks[6].jackRankings=week6.slice();
})();
