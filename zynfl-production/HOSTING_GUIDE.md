# ZYNFL Hosting Guide — Cloudflare Pages + GitHub

This repository is production-ready. The live website is inside `public/`.

## Fastest recommended setup
Use **GitHub + Cloudflare Pages Git integration**. Do not start this project with Cloudflare's drag-and-drop Direct Upload if you want easy automatic deployments later.

## 1. Create the GitHub repository
1. Sign in to GitHub.
2. Create a new repository named **`zynfl-site`**. Private is fine.
3. Do **not** pre-fill it with a README, .gitignore, or license.
4. Open the new empty repository and choose **Add file → Upload files**.
5. Drag the **contents of this extracted folder** into GitHub. GitHub supports dragging a folder, and this project is under its browser upload limits.
6. Commit directly to the `main` branch.

You should see folders/files such as:
- `public/`
- `.github/`
- `scripts/`
- `HOSTING_GUIDE.md`
- `README.md`

## 2. Deploy with Cloudflare Pages
1. Sign in to Cloudflare.
2. Open **Workers & Pages**.
3. Click **Create application**.
4. Choose the **Pages** tab.
5. Choose **Import an existing Git repository**.
6. Connect GitHub and select `zynfl-site`.
7. Use these settings:
   - Production branch: **`main`**
   - Framework preset: **None**
   - Build command: **`exit 0`**
   - Build output directory: **`public`**
8. Click **Save and Deploy**.

Cloudflare will give you a temporary address such as `zynfl.pages.dev`.

## 3. Add `zynfl.com` / `www.zynfl.com`
If the domain is available, the easiest route is to register it with Cloudflare Registrar.

Then in your Pages project:
1. Open **Custom domains**.
2. Add **`www.zynfl.com`**.
3. Also add **`zynfl.com`**.
4. Make `www.zynfl.com` the public/canonical URL and redirect the apex domain to it if desired.

Cloudflare handles HTTPS/SSL automatically.

## 4. Updating the website later
Every time `main` changes on GitHub, Cloudflare automatically rebuilds and publishes the new version.

Recommended workflow for future changes:
1. Create a branch such as `preview`.
2. Make changes there.
3. Cloudflare creates a preview deployment.
4. Approve it.
5. Merge into `main`.
6. The live site updates automatically.

## 5. Daily NFL / fantasy data later
The repo is already split so images are normal files instead of being embedded in a giant HTML document. It also includes a `public/data/` area and GitHub Actions validation.

When you want automatic NFL.com, ADP, injuries, news, or Yahoo updates, add a scheduled GitHub Action that:
1. fetches the source data,
2. writes normalized data into `public/data/` or the relevant JavaScript data file,
3. commits the changes, and
4. lets Cloudflare deploy the new commit automatically.

API keys or credentials should go in **GitHub Actions Secrets**, never directly in the repository.
