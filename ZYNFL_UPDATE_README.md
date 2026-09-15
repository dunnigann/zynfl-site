# ZYNFL Week 1 update — September 15, 2026

This ZIP contains only added/changed files, with paths relative to the root of dunnigann/zynfl-site. It is an update package, not a standalone replacement for the entire repository. Your production website is in `zynfl-production/public/`.

## Upload through GitHub

1. Extract `ZYNFL_Week1_Update.zip` on your computer.
2. Open your existing `dunnigann/zynfl-site` repository at its top level (where `zynfl-production` appears).
3. Choose **Add file → Upload files**.
4. Drag the extracted **zynfl-production folder** and **ZYNFL_UPDATE_README.md** into the upload area. Do not upload the ZIP itself or add a second enclosing folder.
5. Check the file list. The HTML must be at `zynfl-production/public/index.html`, not at `public/index.html` or `zynfl-production/zynfl-production/public/index.html`.
6. Commit the update. For a preview first, upload on a new branch such as `week1-prototype`; if your Cloudflare integration supports preview deployments, inspect that preview before merging it into your production branch. To publish immediately, commit to the production branch already connected to Cloudflare.
7. In Cloudflare, open your existing project under **Workers & Pages → Deployments**. Confirm the deployment corresponds to the new commit and succeeds.
8. Open the site and refresh with Ctrl+Shift+R. Check Matchups, 2026 Season, All Seasons → 2025, and the two new portraits.

An existing Git-integrated Pages project normally deploys when its connected branch changes. No new API key, server, npm package, framework, or build step is required by this update.

If deployment paths need correcting for Pages, use **either** of these equivalent layouts:

| Setting | Option A | Option B |
| --- | --- | --- |
| Root directory | `zynfl-production` | repository root / blank |
| Build output directory | `public` | `zynfl-production/public` |
| Framework | None | None |
| Build command | `exit 0` | `exit 0` |

If the site is already deployed through Workers using the existing `wrangler.jsonc`, retain that deployment setup. This update does not modify Wrangler or migrate the host. Existing assets remain in the same public directory.

Cloudflare references: [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) and [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## Changed files

All paths below are relative to `zynfl-production/` unless otherwise stated.

| File | Purpose |
| --- | --- |
| `public/index.html` | Adds Matchups and 2026 Season navigation; removes the 2025 top-level button; loads the new files. |
| `public/assets/js/app.js` | Adds routes; makes the 2025 archive card open the full existing page; updates the 2026 archive card and stale text. |
| `public/assets/js/zynfl-data.js` | Updates current names and 2026 team labels without rewriting historical 2024–2025 team names. |
| `public/assets/js/media.js` | Registers Akhil and Mitchell portraits. |
| `public/assets/images/managers/akhil.jpg` | Supplied Akhil photo, unchanged image bytes. |
| `public/assets/images/managers/mitchell.jpg` | Supplied Mitchell photo, unchanged image bytes. |
| `public/assets/css/season-2026.css` | New layouts, field, bubbles, modals, cards, rankings and mobile rules. |
| `public/assets/js/season-2026-data.js` | Readable Week 1 snapshot: 179 rostered players, 12 teams, 32 NFL depth charts, 16 NFL games, news, recaps and rankings. |
| `public/assets/js/season-2026.js` | Matchup rendering, player details, legal lineup optimization, weekly recap page, rankings toggle and Jack’s editor. |
| `scripts/validate-week1.cjs` | Optional, dependency-free Node validation of scoring, roster identity, depth references and legal lineup calculations. |
| `ZYNFL_UPDATE_README.md` (repository root) | This upload and maintenance guide. |

## Matchups

- Dropdown at upper left selects ZYNFL or NFL matchups; sidebar selects a game.
- Opposing formations follow the notebook sketch, with offensive-line symbols and team portraits at opposite ends.
- Player bubbles show pictures, names, and consistent owner-colored outlines. NFL bubbles add the fantasy team name in italics.
- Bubble diameter increases with fantasy score; minimum size keeps zero and negative scores clickable. Unknown scores use the minimum size and are explicitly unavailable in details.
- Click/tap a player to open points, screenshot projection, difference from projection, injury notes where available, and the Week 1 game-log row. Escape or Close dismisses it.
- Kicker/defense and bench players are below the fantasy field. The NFL view includes additional rostered players below its starting formations.
- On small screens, the sidebar becomes a horizontal game list and the field scrolls horizontally to preserve names and spacing.
- Headshots use Sleeper CDN and ESPN; team defenses use NFL logos. An initial-based fallback appears if an image cannot load. The prototype does not depend on a live API call for scores or ownership.
- Jack’s team is **The Shibuya Gibbsident**, reflecting the newest screenshot, including under Brock Purdy.

## Data boundaries

The latest screenshots supersede the earlier Monday-pending ones. All 179 rostered player rows now have final points in the supplied screenshots, so no projected substitutions were needed. The source totals are:

| Matchup | Week 1 final |
| --- | --- |
| Jack – Santi | 127.80 – 85.80 |
| Quinn – Nick | 117.72 – 113.06 |
| Tina – Brock | 86.86 – 148.96 |
| Charlie/Chuck – Mitchell | 126.06 – 148.66 |
| Leo – Liam | 102.56 – 124.40 |
| Akhil – Isaac | 68.64 – 105.42 |

Yahoo warns that Week 1 stats can still be corrected. Current data is a fixed prototype snapshot, not a live Yahoo integration.

The snapshot preserves zero projections rather than inventing replacement projections. If a future snapshot has a player who has not played, set `status` to `projected`, `points` to null, and retain the projection. The bubble and team sum then use that projection, and the player dialog labels it as assumed. Update the game-level final labels as part of any future live/pending implementation.

NFL starters come from ESPN depth-chart responses accessed September 15, with the 49ers and Rams also inspected against their official charts. The field is an illustrative formation, not a claim that every listed player was active or played every snap. Links appear beneath each NFL field. Current charts can differ from the Week 1 starting lineup, particularly after injuries.

Players outside the supplied ZYNFL screenshots have unknown fantasy points and projections. The page does not manufacture game stats. The game log contains Week 1 only; there are no invented prior weeks. Not-on-roster labels refer to the supplied rosters, not an authenticated live free-agent list.

Historical career records, production, awards and head-to-head statistics remain the existing 2024–2025 archive. The 2026 snapshot is shown on the new pages. Team cards explicitly label their existing historical record totals.

## Rankings and weekly editing

The analyst order is an editorial rest-of-season assessment, not a points-for sort. It considers the core roster, usable depth in this one-QB lineup, injuries and role risk, with Week 1 treated as evidence rather than destiny. All 12 placements have written reasons.

The remaining 2026 ZYNFL schedule was not provided or present in the repository. No repeat-opponent advantage has been fabricated. `futureSchedule` supports entries such as `{"week":2,"a":"Nick","b":"Tina"}`; these are illustrative field names, not a claim that those managers meet in Week 2. Supplied schedule entries display average remaining opponent analyst rank. Reassess the editorial ranking order after entering a complete schedule.

**Jack’s rankings:**

1. On 2026 Season, click **Edit Jack’s rankings**.
2. Assign every team a unique position.
3. **Save in this browser** creates a local preview. It does not publish or change anyone else’s browser.
4. **Export JSON** downloads an object containing the Week 1 order.
5. In `public/assets/js/season-2026-data.js`, find `"jackRankings": {}` and replace the empty object with the exported object. Commit that file to publish the order to everyone.
6. **Clear local preview** removes that browser’s override and returns it to the published order.

The initial editor list is merely an input form; it is not represented as Jack’s opinion until saved. Jack’s tab starts as unpublished.

**Future weeks:** Week buttons 2–18 are visible but disabled until content is supplied. This version contains Week 1 only. Adding another week requires adding its scores/news/recaps/rankings to the data model and enabling its selection in the render code; changing the button label alone will not load a new week.

## Verification performed

- JavaScript syntax checked for the modified/new scripts.
- All 12 score totals reconciled with supplied screenshots.
- Best legal lineup calculations validated for QB/RB/RB/WR/WR/TE/FLEX/K/DEF, without double-counting a player or using IR slots.
- DOM interaction tests passed for all 6 fantasy and 16 NFL matchup selections, all 179 rostered player dialogs, the 12 recaps and ranking entries, and Jack editor save/duplicate rejection/reset.
- Full 2025 page and 2026 page routing through All Seasons checked.
- Original Home, History, Players, Teams, Rivalries, Gallery and Draft routes rendered without exceptions in the DOM tests.
- Portrait references and new asset references checked.
- **Visual browser verification is incomplete:** the available browser could not open the local preview, and a local browser download timed out. Review the Cloudflare preview on desktop and phone before treating the prototype as visually approved.

Optional local validation from the repository root:

```sh
node zynfl-production/scripts/validate-week1.cjs
```

To preview a complete checkout locally:

```sh
python -m http.server 8765 --directory zynfl-production/public
```

Then open `http://localhost:8765/#matchups` or `http://localhost:8765/#season2026` in your browser. The update ZIP alone omits unchanged assets, so apply it to the existing checkout first.

## Sources

- Scores, projections, fantasy ownership, lineups and names: six user-supplied Week 1 Yahoo screenshots, September 15, 2026.
- Portraits and formation design: user-supplied images and notebook sketch.
- Player identity/headshot mapping: [Sleeper NFL player directory](https://api.sleeper.app/v1/players/nfl); image URLs are retained per player.
- NFL depth charts: ESPN team depth-chart snapshots for all 32 teams; source links retained in `nflTeams`.
- [49ers official depth chart](https://www.49ers.com/team/depth-chart) and [Rams official depth chart](https://www.therams.com/team/depth-chart).
- News article links are retained in `news` and displayed on the Season page. Fantasy scoring follows the screenshots if an article’s scoring description differs.
