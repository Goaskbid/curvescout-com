# CurveScout.com v1.4.6 Release Proof Sheet

| Area | Result | Evidence |
|---|---:|---|
| Header / CurveScout brand | PASS | Existing header kept; no header rewrite in this patch. |
| Search | PASS | Search audit passed for Hannover, Hamburg, Paris, London, Tokyo, Lyon, Moscow, New York, Thalwil. |
| Candidate rail | PASS | Stable v1.4.5 runtime preserved. |
| OSM route map | PASS | Stable v1.4.5 map runtime preserved. |
| Google preview | PASS | Navigation code unchanged; aligned checkpoint chain preserved. |
| GPX export | PASS | Export code unchanged. |
| Riding-order preview | PASS | Preview restored and shortened; sections only, compact text. |
| Detailed Roadbook | PASS | Section cards restored with specific context cards. |
| Waypoint/checkpoint model | PASS | Checkpoint strip remains; checkpoint copy/export remains. |
| Road-section advice | PASS | Non-repetitive section-specific cards generated from route/section/waypoint context. |
| Pictures | PASS | Progressive media loader preserved. |
| Mobile layout | PASS | Scoped responsive overrides added for roadbook cards. |
| GitHub deployment | PASS | Package files preserved. |

## Validation command

```bash
npm test
node --check app.js
```

## Result

```text
CurveScout.com v1.4.6 validation ok: 542 road trips
Search audit ok
Deployment audit ok
Transfer audit ok: Zurich, Lucerne, Kiel, Hamburg, Berlin
Roadbook restore audit ok
```
