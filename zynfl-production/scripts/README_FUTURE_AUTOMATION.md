# Future automated updates

The production site is intentionally static today so it can be hosted immediately and reliably.

When you are ready to automate NFL.com, fantasy ADP, injuries, news, or Yahoo league data, add a scheduled GitHub Actions workflow that:

1. runs a Python/JavaScript fetch script,
2. writes normalized JSON into `data/`,
3. updates the site data consumed by the frontend, and
4. commits the changed files back to `main`.

Cloudflare Pages will then redeploy automatically because the GitHub repository changed.

Do not put API keys directly into the repository. Store them as GitHub Actions secrets.
