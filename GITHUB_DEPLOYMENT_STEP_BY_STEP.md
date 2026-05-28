# CurveScout.com deployment notes

This repository is ready for GitHub Pages deployment as a static website. The root contains the deployable app and a GitHub Actions workflow.

Critical files:

- `index.html`
- `styles.css`
- `app.js`
- `data/routes.js`
- `assets/curvescout-*`
- `manifest.webmanifest`
- `.github/workflows/pages.yml`
- `.nojekyll`
- `CNAME`

Run before deployment:

```bash
npm test
node scripts/build_exports.mjs
```
