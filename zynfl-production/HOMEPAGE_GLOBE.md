# ZYNFL immersive globe homepage

Only `#home` is redesigned. The Week 6 update adds Jack’s supplied ranking list. All other render functions,
routes, league statistics, Yahoo integration and the Cloudflare Worker configuration
are unchanged.

## Files

- `public/assets/js/home-globe.js`: isolated spherical canvas renderer, read-only data adapter,
  co-located manager grouping, team cards, archive selector, matchup arcs and activity.
- `public/assets/css/home-globe.css`: styles scoped to `.zg-home`.
- `public/assets/js/manager-locations.js`: present-day manager location mapping.
- `public/assets/globe/earth-land.json`: bundled Natural Earth public-domain coastline
  and sampled land points. Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson
  Terms: https://www.naturalearthdata.com/about/terms-of-use/
- `public/index.html`: loads the homepage assets.
- `public/assets/js/app.js`: replaces only `renderHome` and adds disposal at navigation.
- `scripts/test-home-globe.cjs`: source-backed adapter, location and clustering checks.

## Configuration

All 12 current managers use the locations Jack supplied on October 21, 2026.
Coordinates represent city centers, not personal addresses. Isaac is located at
an approximate center of Taiwan; provide a city if a more precise marker is wanted.
Edit `manager-locations.js` using the exact manager key and `{label,lat,lon}`.
Historical managers without supplied locations remain selectable with an unmapped
label. Historical season views intentionally use **present-day locations**.
No API keys, external map services, package installation or hosting changes required.

## Data semantics

Cards read `ZYNFL_DATA.standings[year]`. Current records and standings use the
existing Yahoo model. Archive cards distinguish regular seed from playoff finish.
Power ranking is the latest available **Jack** edition in `ZYNFL_2026.weeks`, labeled
with its actual week. It is unavailable in historical seasons unless supported by
the data adapter. No ranking or statistic is guessed.
The current gold beacon represents the latest completed champion. Historical gold
beacons represent that season's champion. Championship buttons open the existing
championship-lineup view; manager buttons open existing manager profiles.
Current matchup arcs use the source current week; historical arcs use the last
archived week. Status and scores come directly from the source, without guessing
whether an old snapshot is final. Recent transactions come from the existing
transaction model. The footer discloses the snapshot update date.
The existing Yahoo refresh re-mounts the homepage with updated data and preserves
its selected season, manager, orientation, zoom and motion preference.

## Interaction and accessibility

Drag to rotate, pinch or +/− to zoom, Ctrl+wheel for optional wheel zoom. Normal
wheel scrolling remains available. Arrow keys rotate a focused globe. Beacons are
buttons with accessible manager names. Managers at the same geographic coordinates
share a single button and expose individual controls. Separate cities never merge,
even when projected close together. Nearby buttons spread apart with leader lines
to their exact geographic anchors. The full
manager list is always available, including the far side of the globe.
Reduced-motion preference disables automatic rotation and traveling arc particles.
Pause freezes all motion; explicit rotation and zoom still work. Rendering is capped
at 30 fps, pixel ratio at 2, and stops when hidden, offscreen or on another route.
Geometry is loaded only on the homepage and cached in memory; all assets are local.
If map geometry fails, beacons and cards remain available; if Canvas is unavailable,
the manager list and all data panels remain usable.

## Validation and publishing

Run `node --test scripts/test-home-globe.cjs` from `zynfl-production/`.
Run `node --check public/assets/js/home-globe.js` for syntax validation.
The existing Cloudflare Workers Builds integration deploys pushes to `main`.
Keep `wrangler.jsonc`, Worker bindings, cron triggers and secrets unchanged.

## Immersive layout revision

The introduction is reduced to `ZYNFL / est 2024`. The enlarged globe fills the
homepage scene without a frame or legend; the team card floats above it on desktop.
On mobile the card follows the globe. Zoom out to see the entire Earth.
City grouping preserves Dallas, Austin, Washington DC and Princeton as separate
beacons. Only exact co-locations such as NYC and Chicago share a beacon.

## Jack’s Week 6 rankings

`public/assets/js/jack-rankings-2026.js` supplies Jack’s exact Week 6 order. It loads
after `yahoo-initial.js` and before `yahoo-live.js` captures the refresh base. The
existing Yahoo rebuild preserves those manual lists across automatic refreshes.
No scores, records, analyst rankings or prior Jack editions are changed. Existing
movement arrows compare Week 6 with Week 5, and homepage cards use the new edition.

Validation: 9 homepage/rankings tests and 18 existing suite tests pass. Desktop and
320px/390px iframe layouts, separated city beacons, NYC picker, Week 6 order and
movement arrows were checked in the browser. No horizontal mobile overflow.
