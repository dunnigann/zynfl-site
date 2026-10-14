# ZYNFL Week 5 update — October 14, 2026

All six supplied Yahoo matchup screenshots are transcribed in `public/assets/js/week-5-2026.js`. The duplicate Jack–Nick screenshot is counted once. All 12 scores and screenshot projection totals reconcile.

| Game | Final |
| --- | --- |
| Jack–Nick | 147.78–125.96 |
| Chuck–Leo | 102.14–128.24 |
| Akhil–Liam | 107.12–149.84 |
| Mitchell–Brock | 119.88–85.50 |
| Isaac–Santi | 129.92–139.44 |
| Tina–Quinn | 108.50–105.26 |

`public/data/season-2026-history.json` permanently records all 30 games through Week 5. `season-sync.js` rebuilds the live archive from the weekly snapshots: standings, records, PF/PA, game counts, legal-lineup efficiency, points left unused, career starts and starter points, player roster histories, draft contributions, rivalry meetings and belts, head-to-head results, 2026 awards and single-game records. Rebuilding twice does not double count. Historic 2024–25 snapshots and playoff finishes remain intact.

The current week opens by default; Weeks 1–4 still work. Week 5 includes all lineups, bench/IR, game logs, 15 NFL finals, distinct team recaps and analyst rankings. Jack’s Week 5 rankings are unpublished. Injury labels reflect supplied IR designations. The player directory resolves current ownership from the latest roster rather than draft day. Empty lineup slots can no longer disable the legal-lineup optimizer. NFL team aliases JAC/JAX and AZ/ARI are normalized.

NFL positional scoring leaders include free agents and are refreshed through Week 5 from FantasyPros’ 2026 half-PPR tables, cross-checked with the supplied weekly snapshots. FLEX is recomputed across RB/WR/TE. Free agents appearing in the top ten have working Player Files.

Sources: [QB](https://www.fantasypros.com/nfl/stats/qb.php?year=2026&scoring=HALF), [RB](https://www.fantasypros.com/nfl/stats/rb.php?year=2026&scoring=HALF), [WR](https://www.fantasypros.com/nfl/stats/wr.php?year=2026&scoring=HALF), [TE](https://www.fantasypros.com/nfl/stats/te.php?year=2026&scoring=HALF), [K](https://www.fantasypros.com/nfl/stats/k.php?year=2026), [DST](https://www.fantasypros.com/nfl/stats/dst.php?year=2026). NFL reading links are stored with the week.

Transactions, FAAB, and trades are not in the supplied screenshots. Their existing historical totals remain explicitly labelled through 2025. No new transactions or trades are inferred from roster changes.

Validation: `node zynfl-production/scripts/validate-weekly.cjs` (or the retained `validate-week1.cjs` entry point), `python zynfl-production/scripts/validate_site.py`, JavaScript syntax, and DOM interaction checks for all routes, weekly selectors, all fantasy/NFL matchups, every Week 5 player dialog, manager files and all 70 scoring-leader cards. Pixel-level visual verification was unavailable because no local Chromium binary is installed.
