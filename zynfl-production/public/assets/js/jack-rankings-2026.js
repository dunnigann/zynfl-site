/* Jack's supplied lists load before live-sync captures its rebuild base. */
(()=>{
 'use strict';
 const season=window.ZYNFL_2026;
 const editions={
  6:['Jack','Liam','Chuck','Akhil','Santi','Isaac','Leo','Mitchell','Tina','Quinn','Nick','Brock'],
  7:['Jack','Chuck','Santi','Liam','Isaac','Akhil','Tina','Quinn','Leo','Mitchell','Nick','Brock'],
  8:['Liam','Jack','Santi','Chuck','Akhil','Isaac','Tina','Quinn','Mitchell','Leo','Nick','Brock'],
  9:['Jack','Santi','Isaac','Chuck','Akhil','Liam','Tina','Quinn','Mitchell','Brock','Nick','Leo'],
  10:['Jack','Santi','Isaac','Akhil','Chuck','Liam','Quinn','Tina','Mitchell','Brock','Nick','Leo']
 };
 const week10={
  Jack:`The team looks great, spearheaded by Gibbs, but depth is a serious problem. If KW stays out though, I think Emmett Johnson is a huge factor in a deep playoff run.`,
  Santi:`Whereas depth is a problem for Jack, it's the biggest strength for Santi. Dak is a top 3 fantasy QB, Kittle is over performing, and Golden and Collins makeup a great WR core even as Flowers struggles a bit. No one wants to see Santi round one.`,
  Isaac:`Louisiana football isn't great this season, but Isaac looks phenomenal heading into the homestretch. Healthy CMC and Bucky makeup the league's best backfield, and if the WRs can give just a bit of production, this team is deadly.`,
  Akhil:`He's doing all this despite starting the worst defenses imaginable. Nabers and Burden give a balanced WR core, but the strength is really in RB depth. Chuba and Cook have been extremely consistent, and Skatt can blow up any night. I think this is a great start for the new fantasy player.`,
  Chuck:`CeeDee and Watson makeup the best WR core in the league, and KW is a top 2 RB. The problem is he's been dealing with an injury, and with the success of Emmett Johnson, I wonder how much strain they put on him the rest of the season.`,
  Liam:`The fall from grace has been sudden, and really it's been because of injuries. Jacobs coming back was supposed to put the Cheesehead over the hump, but his injury combined with the one to Adams has left Liam relying on under performers like Coker and Mike Washington. I see a bounce back though. He has JSN after all.`,
  Quinn:`I really want to hate this team on paper, but they keep delivering. Hampton being back (maybe) is huge, because the depth on this team was already slim. The Sun God and Swift are every week blowup candidates, so if Quinn sneaks into the playoffs there may be problems.`,
  Tina:`I think this is easily the saddest team. It has championship potential if not for crippling injuries. Love, Bowers, Harvey, Puka, I mean those are some heavy hitters that are out for extended time. Hopefully Dr. Dur can slip into the top six because I'd love to see her squad at full strength.`,
  Mitchell:`Another big falloff team. Mitchell's team is just very average when Allen doesn't go nuclear. He has a great all around squad, but I don't see many players that could go for 20-30 besides Allen, and that's usually a recipe for a mid squad.`,
  Brock:`This team might be the opposite of Mitchell's, as Brock has some guys who can go for 30 any night. Javonte, the Ice Man, and Chase are top 5 at their respective positions, but starting Montgomery and DJ Moore isn't going to win you games consistently. I'd be curious if Breece being back means Brock can go on a run though. Playoffs are still possible.`,
  Nick:`This really looks like a playoff squad, and the PF show that, but this ranking takes record into account and Nick just fell too far behind. Jeanty, Bijan, and Coleman are phenomenal, but there's no receiver room to speak of and Daniels is just average this year.`,
  Leo:`Icarus flew too close to the son. The defending champion might've been a Gibbs merchant. On a real note, this team just got pretty unlucky. Many boom/bust players like Tet, Jamo, and Stevenson will do that to you. I think playoffs are technically still possible but I don't think starting Tyler Allgeier or having JT on a tanking Colts team will get you there.`
 };
 (season.jackRankReasonsByWeek??={})[10]=week10;
 if(season.weeks?.[10])season.weeks[10].jackRankReasons=week10;
 season.jackRankings??={};
 for(const [week,order] of Object.entries(editions)){
  season.jackRankings[week]=order.slice();
  if(season.weeks?.[week])season.weeks[week].jackRankings=order.slice();
 }
})();
