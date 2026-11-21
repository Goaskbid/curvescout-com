/* CurveScout clean-up after every update (r72, owner 2026-11-21: "after the next update is finished add a repo clean up
   process"). Run by .github/workflows/cs-upload.yml right after a deploy (and on its 6-hourly run). It only STAGES
   deletions with git rm; the workflow commits them as "Clean-up after deploy". What it removes:
     1. files a release asked to remove: ops/remove.txt, one path per line (the list itself goes too, so it acts once)
     2. leftovers of uploads and editors anywhere: .DS_Store, Thumbs.db, desktop.ini, __MACOSX/, *.orig, *.rej, *.bak,
        *.tmp, *.swp, *~ and stray zips below the root (root zips are the deploy step's own business)
     3. sitemap parts (sitemap-*.xml) that neither sitemap.xml nor robots.txt lists any more
   Never touched, whatever a list says: the site's core files, the workflows and scripts (.github/), the live data
   (data/live/), the Cloudflare sources (cloudflare/), ops/autopilot-status.json, anything outside the repository.
   Workflow files cannot be removed by GitHub's own token anyway; old disabled copies are only reported.
   node .github/scripts/after-deploy.mjs [--dry-run]   prints what it removes; exit 0 always (a clean-up never blocks a deploy) */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const DRY = process.argv.includes('--dry-run');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 << 20 });
const CORE = new Set(['index.html', 'app.js', 'sw.js', '404.html', 'robots.txt', 'sitemap.xml', 'ads.txt', 'CNAME', '.nojekyll', 'config.js', 'styles.css', 'manifest.webmanifest', 'release-manifest.json', 'ops/autopilot-status.json']);
const PROTECT = p => CORE.has(p) || /^(\.github|data\/live|cloudflare)\//.test(p) || p === 'ops/remove.txt';
const JUNK = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$|(^|\/)__MACOSX\/|\.(orig|rej|bak|tmp|swp)$|~$/i;
const out = { manifest: [], junk: [], sitemaps: [], refused: [], workflowsDisabled: [] };
try {
  const tracked = git('ls-files', '-z').split('\0').filter(Boolean); const has = new Set(tracked);
  const rm = new Set();
  /* 1. what a release asked for */
  if (has.has('ops/remove.txt')) {
    for (let l of fs.readFileSync('ops/remove.txt', 'utf8').split(/\r?\n/)) { l = l.replace(/#.*$/, '').trim().replace(/^\.?\//, ''); if (!l) continue;
      const norm = path.posix.normalize(l);
      if (norm.startsWith('..') || path.isAbsolute(l) || /[*?[\]]/.test(l) || PROTECT(norm)) { out.refused.push(l); continue; }
      const hits = has.has(norm) ? [norm] : tracked.filter(f => f.startsWith(norm.replace(/\/?$/, '/')));   /* a folder: everything in it */
      for (const f of hits) { if (PROTECT(f)) out.refused.push(f); else { rm.add(f); out.manifest.push(f); } } }
    rm.add('ops/remove.txt'); }
  /* 2. upload and editor leftovers */
  for (const f of tracked) if (!PROTECT(f) && (JUNK.test(f) || (/\.zip$/i.test(f) && f.includes('/')))) { rm.add(f); out.junk.push(f); }
  /* 3. sitemap parts nobody lists */
  const listed = new Set(); for (const f of ['sitemap.xml', 'robots.txt']) { try { for (const m of fs.readFileSync(f, 'utf8').matchAll(/https?:\/\/[^\s<"]+\/(sitemap[^\s<"/]*\.xml)/g)) listed.add(m[1]); } catch (e) {} }
  if (listed.size) for (const f of tracked) if (/^sitemap-[^/]+\.xml$/.test(f) && !listed.has(f)) { rm.add(f); out.sitemaps.push(f); }
  /* reported only: old workflow copies (GitHub's token cannot remove workflow files) */
  out.workflowsDisabled = tracked.filter(f => /^\.github\/workflows\/cs-autopilot.*\.yml$/.test(f));
  if (rm.size && !DRY) { const list = [...rm]; for (let i = 0; i < list.length; i += 500) git('rm', '-q', '--cached', '--', ...list.slice(i, i + 500)); for (const f of list) { try { fs.rmSync(f, { force: true }); } catch (e) {} } }
  console.log((DRY ? 'would remove ' : 'removed ') + rm.size + ' file(s): ' + out.manifest.length + ' listed by a release, ' + out.junk.length + ' leftovers, ' + out.sitemaps.length + ' unlisted sitemap parts' + (out.refused.length ? '; refused (protected or not a plain path): ' + out.refused.join(', ') : ''));
  for (const f of [...rm].slice(0, 60)) console.log('  - ' + f);
  if (out.workflowsDisabled.length) console.log('old workflow copies still in the repository (switched off, remove them by hand if ever wanted): ' + out.workflowsDisabled.join(', '));
} catch (e) { console.log('clean-up skipped: ' + String(e && e.message || e).slice(0, 200)); }
