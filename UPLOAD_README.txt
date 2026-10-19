ZYNFL Yahoo Live Update — October 16, 2026

The website has already been deployed and is updating from Yahoo.

GitHub rejected the connector's write permission. To preserve this version in the repository:
1. Unzip this download.
2. Open github.com/dunnigann/zynfl-site at the repository ROOT.
3. Use Add file > Upload files and drag in the zynfl-production folder from this ZIP.
4. Commit all the files together to main.

Keep the zynfl-production folder structure. Do not upload it inside a second zynfl-production folder.

This is a one-time source update. Weekly uploads are no longer needed.

The Cloudflare build command checks for the integration files and runs the tests before deployment. Old source cannot remove the live integration. The existing Yahoo login and runtime secrets remain saved; this ZIP contains no credentials.

Read zynfl-production/YAHOO_AUDIT.md for the historical findings and zynfl-production/YAHOO_AUTOMATION.md for refresh behavior and metric definitions.

Local source commit: c7439be
