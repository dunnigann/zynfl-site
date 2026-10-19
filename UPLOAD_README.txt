ZYNFL: live updates on both website addresses

The fix is already deployed to Cloudflare. It makes public Yahoo feeds work on
both https://zynfl.com and https://www.zynfl.com. Yahoo authorization and owner
operations remain restricted to https://zynfl.com.

To keep the GitHub source in sync:
1. Extract this ZIP.
2. Open https://github.com/dunnigann/zynfl-site (main branch).
3. Choose Add file > Upload files at the repository root.
4. Drag in the extracted zynfl-production folder, then commit the changes.
   Do not upload the ZIP itself or create another zynfl-production folder inside
   the existing one.

This changes only two files:
- zynfl-production/src/worker.mjs
- zynfl-production/tests/yahoo-hosts.test.mjs (new regression test)

Cloudflare's build command now requires the new test file before deployment,
so an older repository version cannot overwrite the deployed fix. The current
site continues to run while the source update is pending.

Validation: 13 tests passed; all 2024, 2025 and 2026 public season feeds returned
HTTP 200 on both hosts; the www matchup page displayed current Week 6 scores.
Local source commit: b52e52b.
