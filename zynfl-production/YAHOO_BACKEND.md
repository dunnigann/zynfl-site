# Yahoo backend

The Yahoo backend runs in the same Cloudflare Worker as the existing website.
`src/worker.mjs` and `wrangler.jsonc` must be deployed together. Do not replace
this configuration with an assets-only deployment: that removes the API routes
and runtime bindings, even though the saved Durable Object data remains.

Runtime secret bindings (values must never be committed):

- `YAHOO_CLIENT_ID`
- `YAHOO_CLIENT_SECRET`
- `YAHOO_SETUP_TOKEN`

Cloudflare build variables are separate from runtime secrets. The production
Worker needs all three secret bindings above. Keep the existing migration tag
`v1-yahoo-connection` and `YahooConnection` class name so deployments reuse the
saved connection. The singleton is named `zynfl-owner`.

Run `node --test tests/yahoo-auth.test.mjs` from this directory before deploying.
The Cloudflare build root is `zynfl-production` and deploy command is
`npx wrangler deploy`.

Public `/api/yahoo/status` confirms that credentials and saved authorization
exist. It does not prove Yahoo Fantasy API permission. To test that permission,
call `/api/yahoo/diagnostics` with `X-ZYNFL-Setup` set to the setup secret.
Inspect every Yahoo response status in the returned array, not just the
HTTP status of the diagnostics endpoint.

The backend provides OAuth login, automatic token refresh, private diagnostics,
league discovery, and private read routes. The existing frontend still uses
saved league data; automatic frontend updates and the historical audit are
separate work and are not completed by restoring this backend.
