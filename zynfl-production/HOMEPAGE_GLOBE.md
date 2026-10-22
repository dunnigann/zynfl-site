# ZYNFL US manager map

The homepage now uses a flat map of the contiguous United States, with all 12
current managers represented by independent circular profile portraits. The legacy
home-globe.js / home-globe.css filenames are retained for upload compatibility.

## Scope

Only the homepage renderer and styles, the manager-location mapping, and the
allegiance section inside existing manager profiles change. Other page renderers,
Yahoo automation, scores, standings, historical placements, power rankings and
Cloudflare hosting configuration are unchanged. Jack’s Week 6 list remains intact.
The shared app.js change adds one optional allegiance section to showOwner.

## Locations and portraits

Jack is mapped to Plano, Texas (33.0198, -96.6989). Isaac is mapped to Carrollton,
Texas (32.9756, -96.8897). All other locations retain Jack’s supplied cities.
Coordinates are approximate city centers. Historical season views use this same
current location mapping; historical managers without a supplied city remain
available in the manager list and are not assigned an invented location.

Managers in Chicago, NYC and North Texas keep separate photo markers. Nearby
portraits spread apart with thin leader lines to their exact map anchors. All 12
portraits fit in the default view, including at 320px mobile width. The gold ring
continues to identify the champion from the existing league data.

The 12 map portraits use local 160px WebP crops (about 60 KB combined). Existing
full-size profile photos remain unchanged. The bundled US state geometry is about
36 KB. No new runtime package or map API is required.

## Interaction and accessibility

Drag to pan; pinch, +/− or Ctrl+wheel to zoom; arrow keys pan a focused map.
Normal page scrolling remains available. Reset restores the complete map.
Portraits are focusable buttons, labeled with the manager and city. Hover, focus
and click select the existing team card; its profile button opens the original
manager file. Every manager is also selectable from the full list below the map.

Matchup connections retain the source schedule and scores. Pause stops traveling
particles. Reduced-motion preferences disable animation. Rendering stops while
the page is hidden, the map is offscreen, or another tab is selected. Automatic
Yahoo refreshes preserve the map’s selected year, manager, pan and zoom.

## Allegiances

manager-allegiances.js contains the exact 36 entries supplied by Jack. The team
card shows compact logo badges and the full manager profile shows team names and
categories. Country and Firm are retained for Akhil; Firm is an allegiance label,
not an employment claim. No entries are invented for historical managers.

All 32 distinct logos and flags are bundled in assets/images/allegiances. See
ASSET_SOURCES.md for provenance. The map thumbnails are in
assets/images/managers/map. These images require no external request at runtime.

## Validation

27 automated tests pass: 9 homepage/data/rankings tests and 18 existing tests.
Checks cover all 12 US locations, 36 exact allegiance entries, local image paths,
city projection bounds, portrait separation across five viewport widths, source
data immutability and Week 6 ranking persistence through repeated Yahoo rebuilds.
JavaScript syntax and git diff whitespace checks pass.

Browser checks: desktop and 320px/390px mobile layouts, all 12 loaded portraits,
no mobile horizontal overflow, team cards, profile allegiance logos, mobile zoom,
keyboard pan and reset. Existing manager profiles and Week 6 rankings are retained.

Run from zynfl-production:
  node --test scripts/test-home-globe.cjs tests/*.test.mjs

## Deployment

Pushes to main use the existing Cloudflare Workers Builds workflow. No Worker,
wrangler, OAuth, secret or Yahoo binding change is required. The GitHub connector
still rejects writes with 403 Resource not accessible by integration. This update
is saved locally and supplied as a ZIP for manual upload; no remote deployment
was made by this change.

To publish, extract the update ZIP. At the repository root on main, choose
Add file > Upload files, drag in the extracted zynfl-production folder, preserve
its folder structure, and commit. Wait for the Cloudflare build to succeed, then
reload zynfl.com. The ZIP contains only this update’s changed and new files.
