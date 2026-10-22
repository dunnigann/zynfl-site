ZYNFL globe refinement + Jack Week 6 rankings

Changes
- Enlarged, borderless globe as the main homepage scene.
- Same-city grouping only. Dallas, Austin, DC and Princeton remain separate.
- Nearby markers spread apart with lines to their real geographic anchors.
- Introduction reads ZYNFL / est 2024. Legend and filler copy removed.
- Existing manager profiles and team cards retained.
- Jack Week 6 rankings added exactly as supplied, with Week 5 movement arrows.
- Rankings persist through automatic Yahoo refreshes.

Publish through your existing GitHub / Cloudflare workflow
1. Extract this ZIP.
2. Open https://github.com/dunnigann/zynfl-site on the main branch.
3. At the repository root, choose Add file > Upload files.
4. Drag the extracted zynfl-production folder into the upload area.
   Preserve its folder structure and replace the matching files. Do not upload
   the ZIP, README or homepage-refinement.patch as website files.
5. Commit the changes to main. Your existing Cloudflare Workers Builds workflow
   should deploy the commit. Check the Cloudflare build result before assuming
   the live site has updated.
6. Reload zynfl.com. For rankings, choose 2026 Season > Power Rankings > Week 6
   and Jack's rankings.

Alternative for a local checkout
From the repository root, run:
  git apply --check homepage-refinement.patch
  git apply homepage-refinement.patch
Then commit and push to main using your normal GitHub credentials.

Validation
27 automated tests passed: 9 homepage/rankings tests and 18 existing tests.
Desktop and mobile at 320px/390px were inspected in the browser. Separate
city beacons, NYC selection, profile navigation and Week 6 arrows work.
Yahoo rebuild tests confirm the manual ranking list survives refreshes.

Deployment status
The patch is committed locally. GitHub connector writes are blocked with
403 Resource not accessible by integration. No remote commit or deployment
was made by this update. No additional location configuration is required.

Base repository commit: 6efe12e5139c176883ffff919a09dbfc8d6855af
Local result: f05692b56c0e7120c55dc6a9af6f9a2c3dd16a92
