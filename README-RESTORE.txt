ZYNFL YAHOO BACKEND RESTORE — OCTOBER 15, 2026

The live Cloudflare backend has already been restored and tested successfully.
Yahoo returned HTTP 200 for current and historical ZYNFL league requests.
The current website files were preserved unchanged.

The connected GitHub app refused write access, so these source changes could
not be committed to the remote repository. Apply them before the next site
update; otherwise an assets-only deployment can remove the backend again.

To apply using GitHub:
1. Extract this ZIP.
2. Open https://github.com/dunnigann/zynfl-site on the main branch.
3. Choose Add file > Upload files.
4. Drag the included zynfl-production folder into the upload area so its files
   have the paths listed below. Review the four files and commit the change.
   Do not upload the ZIP itself, and do not delete any existing public files.

Files:
- zynfl-production/src/worker.mjs (new)
- zynfl-production/wrangler.jsonc (replace)
- zynfl-production/tests/yahoo-auth.test.mjs (new)
- zynfl-production/YAHOO_BACKEND.md (new)

If applying locally, copy the included zynfl-production folder into the repository
root, allowing the configuration file to be replaced. Test from zynfl-production:
  node --test tests/yahoo-auth.test.mjs
  npx wrangler deploy --dry-run
Then commit and push the four files.

The three runtime secrets are already set on Cloudflare. This ZIP contains no
real credentials. The existing saved Yahoo authorization remains in the
YahooConnection Durable Object.

Restoring the backend confirms API access; it does not make the current frontend
update automatically or complete the historical records audit.
