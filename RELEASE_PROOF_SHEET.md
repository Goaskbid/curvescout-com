# CurveScout.com v1.4.6

CurveScout.com is a client-facing motorcycle road-trip intelligence web app. This build is a stability repair that preserves the working search, OSM map, media loading, route candidate rail, Google/OSM/GPX handoff and technical profile while fixing the missing riding-order roadbook runtime.

## Fixed in v1.4.6

- Restored the riding-order Roadbook section.
- Added the missing `shortRoadbookText()` runtime helper that caused the roadbook render to fail in v1.4.4.
- Added `ensureRoadbookVisible()` watchdog so the inline and full roadbooks re-render if async map/media work interrupts the UI.
- Kept the stable v1.4.x search and OSM map runtime intact.
- Preserved progressive media loading, weather/ride cards, Google preview, OSM preview, GPX export and waypoint pack.

## Deployment

Upload the GitHub deployment package to a repository root and enable GitHub Pages through GitHub Actions.

Required files:

```text
index.html
app.js
styles.css
data/
assets/
manifest.webmanifest
sw.js
.nojekyll
CNAME
.github/workflows/pages.yml
```

## Validation

```bash
npm test
node --check app.js
```

Validation covers inventory size, search results, transfer model, deployment structure and roadbook runtime helpers.

## v1.4.6 roadbook polish

This patch keeps the stable search/map/media/runtime from v1.4.5 and tightens only the roadbook layer:

- compact riding-order preview;
- detailed road sections with specific, variable rider-relevant cards;
- no forced repetitive info grid on every section;
- responsive CSS to keep section text out of the image column;
- checkpoint strip remains as the exported waypoint order.
