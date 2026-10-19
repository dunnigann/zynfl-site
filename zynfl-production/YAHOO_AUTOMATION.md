# ZYNFL Yahoo automation

Deployed to https://zynfl.com on October 16, 2026. The existing Yahoo connection and Durable Object namespace are retained.

## What refreshes

The browser loads the sanitized 2024, 2025, and 2026 league snapshots and checks 2026 every 60 seconds while visible. Returning to the tab checks again. The shared server cache refreshes stale current-season data in the background, so a visitor usually sees a manager's lineup change within about 1–2 minutes, subject to Yahoo publishing it. Every visitor shares the same upstream work.

A Cloudflare cron runs every five minutes, including when nobody visits. It refreshes the current season, scoring leaders, and recent final rosters. Historical seasons receive slower correction sweeps. The worker stops requests for an hour after a Yahoo 429 or 999 rejection, keeps the last good snapshot, and resumes automatically. It does not ask visitors to sign into Yahoo.

Yahoo supplies standings, the full fantasy schedule, selected lineup positions, weekly player scores, season scoring leaders, draft results, settings, and paginated transactions. ESPN supplies NFL scoreboard results. Private Yahoo account metadata and OAuth tokens never enter the public snapshots.

The site derives weekly factual recaps, analyst performance rankings, manager records, player starts and starter points, draft contributions, optimal lineups, awards, records, and rivalry belts from these shared inputs. Jack's published rankings stay editorial and are never generated under his name. The playoff predictor simulates the remaining regular-season schedule 5,000 times using observed scoring averages and variability.

## Metric definitions

- A finished fantasy matchup counts once. A bye, eliminated week, or unfinished game does not create career starts, points, wins, losses, or rivalry results.
- A player start means selection in a starting fantasy slot in a finished fantasy matchup. It does not assert an NFL appearance; a manager can start an injured player or a player on bye.
- Player starter points count only those fantasy starts. Bench and IR history are tracked separately. Negative scores are retained.
- Optimal lineups fill QB, 2 RB, 2 WR, TE, FLEX, K, DEF using that week's roster. IR is excluded. One player cannot fill two slots. Available legal slots are filled before points are maximized, including negative scores.
- Lineup efficiency is the mean weekly actual score divided by the best legal lineup score. Career display averages the season efficiencies. Missed points sum the difference between legal optimal and actual scores. Any official score adjustment is preserved.
- Standings PF/PA and regular records use the regular season. Lineup and positional production awards include completed championship and consolation games.
- A roster move is a successful add, drop, or paired add/drop event. Paired add/drop is one move. Trades are shown separately. Commissioner log entries and vetoed trades are excluded from completed-move counts. Yahoo's own `number_of_moves` can differ because standalone drops and league transaction events have different counting rules.
- FAAB spent is the sum of successful acquisition bids; waiver wins include $0 claims. Losing bid histories are not supplied by this feed.
- The Nick Special counts starter points during the stint following a successful waiver acquisition, divided by total FAAB spent. It does not credit points earned before the claim or after a later transfer.
- All-Time awards choose a single-season card, never sum a manager's career. Unfinished seasons do not qualify for season rate awards or Fewest seasonal totals. Tied custom season awards identify their co-winners.
- Yahoo can return current NFL club/name metadata for old player IDs. Historical transaction cards omit NFL club labels to avoid presenting current affiliations as historical facts.

## Maintenance

No weekly file upload is needed. If Yahoo authorization is revoked, the owner must reconnect once; the saved snapshots remain available. A new annual Yahoo league requires its league key, team-to-manager mapping, and initial snapshot to be configured. This deployment covers the three requested leagues:

| Season | Yahoo league key |
|---|---|
| 2024 | 449.l.1118810 |
| 2025 | 461.l.518801 |
| 2026 | 470.l.800556 |

The GitHub connector returned `403 Resource not accessible by integration`, so the deployed changes have not been pushed to GitHub. Upload the patch's `zynfl-production` folder into the repository root, retaining its folder structure. The Cloudflare deployment command now checks for the new Yahoo files and runs the tests before deployment. That prevents an older repository upload from removing the live integration; uploading this patch satisfies the guard automatically.

## Verification and development

Use Node 22.13 or newer.

```sh
node --test tests/*.test.mjs
npx wrangler deploy --dry-run
npx wrangler deploy
```

The original OAuth tests cover private-route authorization, token rotation, safe diagnostics, and callback state validation. Data tests cover signed scores, legal lineup selection, idempotence, official placements, no current-week career inflation, large-history persistence, and playoff probability allocation.

Owner-only backfill utilities accept `YAHOO_SETUP_TOKEN` through the environment and a private raw-data directory. Never commit raw Yahoo responses or credentials. Public snapshots contain only league display data.

The machine-readable comparison report is `/data/yahoo-audit.json`. It is the October 16 baseline audit; it is not relabelled as a fresh audit on every visit. Source snapshots continue refreshing independently.
