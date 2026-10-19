import fs from 'node:fs/promises';
const a=JSON.parse(await fs.readFile('public/data/yahoo-audit.json','utf8')),d=JSON.parse(await fs.readFile('/tmp/zynfl-new-model.json','utf8')).ZYNFL_DATA;
const rows=a.awards.filter(x=>x.year!=='all').map(x=>`| ${x.year} | ${x.award} | ${x.before.owner}: ${x.before.value} | ${x.after.owner}: ${x.after.value} |`).join('\n');
const draftCounts=a.drafts.reduce((m,x)=>(m[x.field]=(m[x.field]||0)+1,m),{});
const report=`# ZYNFL historical audit — October 16, 2026

All 226 completed fantasy matchup scores, their winners, regular-season standings, and final playoff placements match the previously corrected published archive. There are no remaining score or placement discrepancies in that comparison.

The API audit does identify errors or incomplete information in some bench/IR histories, transaction/FAAB statistics, draft metadata and contributions, and calculated awards. Those views are rebuilt from the verified sources in the deployed site.

## Coverage

| Season | Finished games | Scored team rosters verified | Draft picks | Yahoo transaction log entries |
|---|---:|---:|---:|---:|
${a.coverage.map(s=>`| ${s.year} | ${s.games} | ${s.verifiedRosters}/${s.requiredRosters} | ${s.draftPicks} | ${s.transactionEvents} |`).join('\n')}

The historical dataset contains 7,138 player-week roster observations. The current Week 6 rosters were also fetched; their unfinished games do not enter career starts, points, records, or rivalry belts. Transaction pagination continued until an empty/short page, so the audit is not limited to the latest 100 entries.

## Confirmed results

- 2024 champion: Chuck. Calvin finished 12th; the archive's 2024 team labelled Isaac finished 11th.
- 2025 champion: Leo. Tina won the 11th-place game and finished 11th; Isaac finished 12th.
- All 24 completed-season final placements match Yahoo's final ranks. Regular-season seeds are kept separate.
- All 36 manager-season FAAB spend totals reconcile with Yahoo’s remaining balance and the $100 starting budget.
- Every scored starting lineup sums to its official team score. There are zero unexplained score adjustments across the 452 finished team-roster observations.
- The single-game record holders and all previously published completed-game scores remain unchanged.

## Award corrections

These are season cards, calculated using the definitions below. All-Time selects one of these cards rather than summing a manager's seasons.

| Season | Award | Previously published | API-based calculation |
|---|---|---|---|
${rows}

Some differences reflect a clarified counting rule, rather than an incorrect underlying Yahoo event. Waiver Wire Warrior counts successful roster move events, including standalone drops, while completed trades are separate. The Nick Special now credits production during the waiver-acquired stint only. A partial season cannot win an All-Time rate award or a Fewest seasonal-total award.

Custom awards display tied holders where applicable. In 2024, several managers spent the full $100 FAAB budget; retaining Isaac as the primary card does not imply he was the only tied holder.

## Other changes

- The player comparison found ${a.players.length} changed bench/IR/roster-point fields across ${new Set(a.players.map(x=>x.player)).size} players. Career starter-point and start totals matched under Yahoo player identity; these changes primarily fill omitted 2026 reserve appearances. Player names can also change in Yahoo's current metadata.
- All 180 2026 draft rows had internal team IDs that represented draft slots rather than the official Yahoo team IDs. Their manager labels were already correct. Official team IDs now link draft records to rosters and transactions.
- Draft reconciliation also supplies ${draftCounts.playerId} missing/different Yahoo player IDs, recalculates ${draftCounts.starts} start-count fields and ${draftCounts.starterPoints} contribution fields, and updates ${draftCounts.player} current player-name field. This is not ${a.drafts.length} wrong draft selections; the report counts changed fields.
- The log contains 758 successful roster-move events and 14 completed trades, for 772 distinct completed events. The prior home-page total used a different manager-row count. Commissioner-only log entries and the vetoed trade do not count as completed roster moves.
- The API provides complete successful FAAB claim data, including $0 claims. Several archived manager spend/claim totals were incomplete. The detailed JSON lists all ${a.transactions.length} changed transaction-related fields.

## Definitions and limits

Lineup efficiency is the mean of weekly actual points divided by the highest-scoring legal lineup on the same roster. Missed points sum optimal minus actual points. The legal lineup is QB, 2 RB, 2 WR, TE, FLEX, K, DEF. IR players are excluded and no player can fill two slots. Negative scores and required filled slots are preserved. Positional production and lineup awards include completed playoff/consolation games; PF, PA, and regular records use regular-season games.

A fantasy start is a starting slot in a completed fantasy matchup. It does not guarantee that the player appeared in an NFL game.

One attribution remains unconfirmed: Yahoo's 2024 team 9 manager nickname is **Kole**, while the established archive associates that team with **Isaac**. The mapping is retained. The team's scores, draft, and finish are verified, but assigning those results to Isaac personally requires confirmation. Account GUIDs and private profile details were not published.

Yahoo returns current player metadata for some historical requests. Historical NFL clubs and current player-name spellings are therefore not certified as draft-day or transaction-day facts; historical transaction cards omit NFL club labels.

The owner-facing audit is a dated comparison against the saved pre-integration archive. It is not described as a new audit each time the page refreshes. Live records continue to derive from refreshed Yahoo data.

## Deployment and validation

The update is deployed to https://zynfl.com. Browser pages poll while visible every 60 seconds, and the server has a five-minute scheduled refresh. Typical lineup visibility is about 1–2 minutes after Yahoo publishes a manager's change. Yahoo rejections cause a timed pause and saved-data fallback.

Validation covers OAuth protection and refresh-token rotation, signed scores, legal lineup choices, repeatable aggregation, current-week exclusion from career stats, official placements, durable snapshot persistence, playoff probability allocation, all main page renders, and live browser checks of Transactions and current lineups. The production Yahoo connection remains authorized.

GitHub rejected source writes with 403. The patch ZIP contains the deployed source and this report. Upload its zynfl-production folder into the existing repository root. The Cloudflare build command now checks that the Yahoo integration files exist and runs tests before deployment, so an older repository upload cannot replace this integration.

Detailed field-level evidence: public/data/yahoo-audit.json in the patch, also served at https://zynfl.com/data/yahoo-audit.json.
`;
await fs.writeFile('YAHOO_AUDIT.md',report);console.log('Wrote audit report');
