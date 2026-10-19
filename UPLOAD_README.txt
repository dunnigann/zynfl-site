ZYNFL season improvements - October 18, 2026

These changes are already deployed to https://zynfl.com and https://www.zynfl.com.
Upload this source patch to keep future GitHub deployments in sync.

1. Extract this ZIP.
2. Open https://github.com/dunnigann/zynfl-site on the main branch.
3. At the repository ROOT, choose Add file > Upload files.
4. Drag in the extracted zynfl-production folder and commit the changes.
   Upload the folder contents, not the ZIP. Do not create a second nested
   zynfl-production folder.

This patch is based on main commit 6115f73, which already contains the www fix.
Source commit: 08d9524. The patch contains all changed and newly required files.

Changes:
- Rounded standings/predictor table frames; gold, silver, bronze rank badges.
- Playoff and bye probability bars.
- Rebuilt analyst outlooks for Weeks 1-5 with 60 separately written assessments.
- Rank movement indicators for both authors; Jack editor removed.
- Automatic Tuesday noon Central analyst publication, starting Week 6 on 10/20.
- Immutable dated weekly ranking snapshots.
- Transactions nested under 2026 Season.
- Mirrored matchup layout and exact current-week Yahoo win probabilities.
- Redundant Production records and Yahoo status bar removed.

Historical projection limitation:
Weeks 1-5 are labelled reconstructed estimates using the rosters and results
available through each week. The available Yahoo responses did not contain
archived player rest-of-season projections. These are not presented as old
Yahoo forecasts. Read zynfl-production/OUTLOOK_RANKINGS.md for the full method.

Validation: 18 tests passed; live browser checks completed. Cloudflare's build
command requires the new regression test and stylesheet so older source cannot
overwrite this deployment while the GitHub upload is pending.
