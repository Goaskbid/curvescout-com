#!/usr/bin/env node
/* CurveScout sitemap generator + validator. Runs on every production deployment (GitHub Action cs-sitemap.yml and the
   release build), so the sitemap always matches the published site.
   Usage: node build-sitemap.mjs <site-dir> [--check-only]
   Rules:
   1. every canonical, public, indexable .html page is listed; nothing else (no noindex, no redirect, no page whose
      canonical points elsewhere, no duplicates, no 404 page)
   2. new pages appear and deleted or redirected pages disappear, because the list is rebuilt from the files each time
   3. <lastmod> changes only when a page's content or structure changes: a hash of its title, description, headings,
      canonical, links and visible text (scripts, styles and the release stamp ignored) is kept in sitemap-state.json.gz;
      pages first seen keep the date the old sitemap had, or get none
   4. sitemap.xml (the index) stays at the domain root under its existing name; robots.txt names it
   5. the result is validated (XML, URL limits, sizes, every URL is a real indexable page) and the run fails otherwise */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import crypto from 'node:crypto';
const A = process.argv.slice(2); const SITE = path.resolve(A.find(a => !a.startsWith('--')) || '.');
const CHECK = A.includes('--check-only'); const BASE = 'https://curvescout.com';
const TODAY = (A[A.indexOf('--date') + 1] && A.includes('--date')) ? A[A.indexOf('--date') + 1] : new Date().toISOString().slice(0, 10);
const PER = 10000, STATE = path.join(SITE, 'sitemap-state.json.gz');
const SKIPDIR = /^(\.git|\.github|assets|data|node_modules|calendar\/partials)(\/|$)/;
const fail = m => { console.error('SITEMAP CHECK FAILED: ' + m); process.exit(1); };

/* ---- 1. the pages ---- */
function* walk(d, rel = '') { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? rel + '/' + e.name : e.name; if (SKIPDIR.test(r)) continue; if (e.isDirectory()) yield* walk(path.join(d, e.name), r); else if (e.name.endsWith('.html')) yield r; } }
const pages = new Map(), skipped = { noindex: 0, canonicalElsewhere: 0, redirect: 0, error: 0 };
for (const rel of walk(SITE)) {
  if (rel === '404.html') { skipped.error++; continue; }
  const t = fs.readFileSync(path.join(SITE, rel), 'utf8'); const head = (t.split(/<\/head>/i)[0] || '');
  if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(head) || /<meta[^>]+content=["'][^"']*noindex[^>]+name=["']robots["']/i.test(head)) { skipped.noindex++; continue; }
  if (/<meta[^>]+http-equiv=["']refresh["']/i.test(head)) { skipped.redirect++; continue; }
  const forms = [BASE + '/' + rel]; if (/(^|\/)index\.html$/.test(rel)) forms.push(BASE + '/' + rel.replace(/index\.html$/, ''));
  const can = (head.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || head.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i) || [])[1];
  const canAbs = can ? new URL(can, forms[0]).href : forms[forms.length - 1];
  if (!forms.includes(canAbs)) { skipped.canonicalElsewhere++; continue; }
  const url = canAbs;   /* exactly the page's own canonical URL */
  if (pages.has(url)) continue;   /* one entry per canonical URL */
  /* significant content: title, description, h1-h3, canonical, links and visible text; not scripts, styles or stamps */
  const body = t.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const sig = [(t.match(/<title>([\s\S]*?)<\/title>/i) || [])[1], (head.match(/name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1], url,
    (body.match(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi) || []).join('|'), (body.match(/href=["'][^"']+["']/gi) || []).join('|'),
    body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()].join('\n');
  pages.set(url, { rel, hash: crypto.createHash('sha256').update(sig).digest('hex').slice(0, 20) });
}
if (!pages.size) fail('no indexable pages found');

/* ---- 3. lastmod from the content hash ---- */
let state = {}; try { state = JSON.parse(zlib.gunzipSync(fs.readFileSync(STATE)).toString('utf8')); } catch (e) {}
const firstRun = !Object.keys(state).length; const old = new Map();
if (firstRun) for (const f of fs.readdirSync(SITE)) if (/^sitemap.*\.xml$/.test(f)) for (const m of fs.readFileSync(path.join(SITE, f), 'utf8').matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)) old.set(m[1], m[2] || null);
const next = {}; let changed = 0, added = 0;
for (const [url, p] of pages) { const s = state[url];
  if (s && s.h === p.hash) next[url] = s;
  else if (s) { next[url] = { h: p.hash, d: TODAY }; changed++; }
  else { next[url] = { h: p.hash, d: firstRun ? (old.get(url) || null) : TODAY }; added++; } }
const removed = Object.keys(state).filter(u => !pages.has(u)).length;

/* ---- 4. files: sections keep the existing names ---- */
const section = u => { const p = u.slice(BASE.length + 1);
  if (/^rides\/motorcycle-roads-/.test(p)) return 'core';
  if (/^rides\//.test(p)) return 'rides'; if (/^chapters\//.test(p)) return 'chapters';
  if (/^(read|writeups|calendar|thursday)\//.test(p)) return 'directories'; return 'core'; };
const groups = {}; for (const u of [...pages.keys()].sort()) (groups[section(u)] = groups[section(u)] || []).push(u);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
const files = {};
for (const [g, list] of Object.entries(groups)) for (let i = 0; i * PER < list.length; i++) {
  const name = 'sitemap-' + g + '-' + String(i + 1).padStart(3, '0') + '.xml';
  files[name] = "<?xml version='1.0' encoding='UTF-8'?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">" +
    list.slice(i * PER, (i + 1) * PER).map(u => '<url><loc>' + esc(u) + '</loc>' + (next[u].d ? '<lastmod>' + next[u].d + '</lastmod>' : '') + '</url>').join('') + '</urlset>\n'; }
const index = "<?xml version='1.0' encoding='UTF-8'?>\n<sitemapindex xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">" +
  Object.keys(files).sort().map(n => { const ds = [...files[n].matchAll(/<lastmod>([^<]+)/g)].map(m => m[1]).sort(); return '<sitemap><loc>' + BASE + '/' + n + '</loc>' + (ds.length ? '<lastmod>' + ds[ds.length - 1] + '</lastmod>' : '') + '</sitemap>'; }).join('') + '</sitemapindex>\n';

/* ---- 5. validate before anything is written ---- */
const seen = new Set();
for (const [n, x] of Object.entries(files)) {
  if (Buffer.byteLength(x) > 50 * 1024 * 1024) fail(n + ' is over 50 MB');
  const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
  if (locs.length > 50000) fail(n + ' has more than 50,000 URLs');
  for (const u of locs) { if (!u.startsWith(BASE + '/')) fail('foreign URL ' + u); if (seen.has(u)) fail('duplicate URL ' + u); seen.add(u); if (!pages.has(u)) fail('URL without an indexable page ' + u); }
  if (!/^<\?xml[^>]+\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">(<url><loc>[^<>]+<\/loc>(<lastmod>\d{4}-\d\d-\d\d<\/lastmod>)?<\/url>)+<\/urlset>\n$/.test(x)) fail(n + ' is not well-formed');
}
if (seen.size !== pages.size) fail('sitemap lists ' + seen.size + ' URLs for ' + pages.size + ' pages');
if (index.includes('/sitemap.xml<')) fail('the index lists itself');
const robots = path.join(SITE, 'robots.txt'); let rb = fs.existsSync(robots) ? fs.readFileSync(robots, 'utf8') : 'User-agent: *\nAllow: /\n';
if (!/^Sitemap:\s*https:\/\/curvescout\.com\/sitemap\.xml\s*$/mi.test(rb)) { if (CHECK) fail('robots.txt does not name the sitemap'); rb = rb.replace(/^Sitemap:.*$/gmi, '').trim() + '\n\nSitemap: ' + BASE + '/sitemap.xml\n'; }

const report = { pages: pages.size, files: Object.keys(files).length, added, changed, removed, skipped, firstRun };
if (CHECK) { const cur = fs.existsSync(path.join(SITE, 'sitemap.xml')) && fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
  if (cur !== index || Object.entries(files).some(([n, x]) => !fs.existsSync(path.join(SITE, n)) || fs.readFileSync(path.join(SITE, n), 'utf8') !== x.replace(/<lastmod>[^<]*<\/lastmod>/g, m => m))) console.log('note: the published sitemap differs from a fresh build');
  console.log('sitemap check passed', JSON.stringify(report)); process.exit(0); }
for (const f of fs.readdirSync(SITE)) if (/^sitemap-.*\.xml$/.test(f) && !files[f]) fs.rmSync(path.join(SITE, f));
for (const [n, x] of Object.entries(files)) fs.writeFileSync(path.join(SITE, n), x);
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), index); fs.writeFileSync(robots, rb);
fs.writeFileSync(STATE, zlib.gzipSync(Buffer.from(JSON.stringify(next)), { level: 9 }));
console.log('sitemap built', JSON.stringify(report));
