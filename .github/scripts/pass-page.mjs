/* CurveScout pass status page (r88, owner 2026-11-24: "this stuff all needs to make its way into google - we need to be
 * found"). Writes passes/status.html - a crawlable page with every pass a live source covers and what that source reports,
 * judged by the SAME policy the app and the pass pages use (assets/pass-policy.js, run here in a sandbox). Called by
 * pass-status.mjs after each feed read (it stages the page so the feed commit carries it) and once at release build time.
 * usage: node .github/scripts/pass-page.mjs [site-root] */
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { execFileSync } from 'node:child_process';
const E = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = n => String(n).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pass';
const hm = ms => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const clean = x => String(x || '').replace(/https?:\/\/\S+/gi, '').replace(/Nähere Infos unter:?/gi, '').replace(/&#x?[0-9a-f]+;/gi, ' ').replace(/\s+/g, ' ').replace(/[\s.]+$/, '').slice(0, 220);
export function render(root = '.', now = Date.now()) {
  const pol = fs.readFileSync(path.join(root, 'assets/pass-policy.js'), 'utf8'), box = { window: {}, Number, Date, Math, isFinite };
  vm.createContext(box); vm.runInContext(pol, box); const P = box.window.CSPassPolicy; if (!P) throw Error('pass policy missing');
  const live = JSON.parse(fs.readFileSync(path.join(root, 'data/live/passes.json'), 'utf8'));
  const passes = (JSON.parse(fs.readFileSync(path.join(root, 'data/passes.json'), 'utf8')).passes || []);
  const seen = {}; for (const p of passes) { const s = slug(p.n); seen[s] = (seen[s] || 0) + 1; p.slug = seen[s] === 1 ? s : s + '-' + seen[s]; }
  const cov = live.coverage || [], inCov = p => cov.some(g => g.bbox && p.at[0] >= g.bbox[0] && p.at[0] <= g.bbox[2] && p.at[1] >= g.bbox[1] && p.at[1] <= g.bbox[3]);
  const fresh = P.fresh(live, now), chk = P.instant(live.checked || live.updated || ''), src = (live.sources || []).map(s => s.name).join(', ') || 'the live feed';
  const rows = passes.filter(inCov).map(p => { const st = (live.passes || {})[p.n.toLowerCase()], ph = fresh ? P.phase(st, fresh, now) : 'stale'; return { p, st, ph }; });
  const rank = { closed: 0, restricted: 1, scheduled: 2, 'schedule-started': 3, ended: 4, none: 5 };
  rows.sort((a, b) => (rank[a.ph] ?? 6) - (rank[b.ph] ?? 6) || (b.p.alt || 0) - (a.p.alt || 0));
  const lab = { closed: 'Closed', restricted: 'Restricted', scheduled: 'Scheduled', 'schedule-started': 'Planned, not confirmed', ended: 'Report ended', none: 'No report', stale: 'No current status', invalid: 'Unreadable report' };
  const line = r => '<tr><td><a href="/passes/' + r.p.slug + '.html">' + E(r.p.n) + '</a>' + (r.p.alt ? '<br><span class="k">' + r.p.alt.toLocaleString('en') + ' m</span>' : '') + '</td><td><span class="tag ' + r.ph + '">' + E(lab[r.ph] || r.ph) + '</span></td><td>' +
    (r.st && ['closed', 'restricted', 'scheduled', 'schedule-started'].includes(r.ph) ? E(clean(r.st.text)) + (r.st.since ? ' <span class="k">from ' + hm(P.instant(r.st.since)) + '</span>' : '') + (r.st.until ? ' <span class="k">until ' + hm(P.instant(r.st.until)) + '</span>' : '')
      : r.ph === 'ended' ? 'The last report ended ' + hm(P.instant(r.st.until)) + '. No current report - not a confirmation that the road is open.' : r.ph === 'none' ? 'No closure or restriction reported.' : 'No status shown.') + '</td></tr>';
  const n = rows.filter(r => ['closed', 'restricted'].includes(r.ph)).length, title = 'Mountain pass status today: closures and restrictions (South Tyrol)';
  const desc = fresh ? (n ? n + ' pass' + (n === 1 ? '' : 'es') + ' with a current closure or restriction' : 'No current closure or restriction reported') + ' on ' + rows.length + ' mountain passes, as reported by ' + src + ', checked ' + hm(chk) + '.' : 'Mountain pass status from the open South Tyrol traffic feed - currently not up to date.';
  const ld = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', '@id': 'https://curvescout.com/passes/status.html#page', url: 'https://curvescout.com/passes/status.html', name: title, description: desc, dateModified: isFinite(chk) ? new Date(chk).toISOString() : undefined, inLanguage: 'en', isPartOf: { '@id': 'https://curvescout.com/#website' } },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'CurveScout', item: 'https://curvescout.com/' }, { '@type': 'ListItem', position: 2, name: 'Mountain passes', item: 'https://curvescout.com/passes/' }, { '@type': 'ListItem', position: 3, name: 'Pass status today', item: 'https://curvescout.com/passes/status.html' }] }] };
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + E(title) + '</title><meta name="description" content="' + E(desc) + '"><link rel="canonical" href="https://curvescout.com/passes/status.html"><meta name="robots" content="index,follow"><meta property="og:title" content="' + E(title) + '"><meta property="og:description" content="' + E(desc) + '"><link rel="icon" href="/assets/curvescout-mark-192.png"><link rel="stylesheet" href="/assets/seo-plan.css?v=e4948ab4ac87">' +
    '<style>table{width:100%;border-collapse:collapse;font-size:15px}td,th{text-align:left;padding:9px 8px;border-bottom:1px solid #2a2e35;vertical-align:top}th{color:#aab3bd}.k{color:#aab3bd;font-size:13px}.tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:13px;font-weight:700;background:#2a2e35;color:#fff;white-space:nowrap}.tag.closed{background:#5a1f1c;color:#ffd3cf}.tag.restricted,.tag.scheduled{background:#5a3d12;color:#ffe2b8}.wrapT{overflow-x:visible}</style>' +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script></head><body class="cs-seo"><header class="top"><div class="wrap"><a class="brand" href="/">Curve<span>Scout</span></a><nav aria-label="Main navigation"><a href="/read/index.html">Roadbooks</a><a href="/passes/">Mountain passes</a><a href="/guides/">Plan a ride</a><a href="/calendar/">Road calendars</a></nav></div></header>' +
    '<main id="main" class="wrap"><section class="hero"><p class="eyebrow">CURVESCOUT / MOUNTAIN PASSES / STATUS TODAY</p><h1>Mountain pass status today</h1><p class="stand">' + E(desc) + ' This page is rewritten every time CurveScout reads the feed (several times a day).</p></section>' +
    '<section class="prose"><h2>How to read it</h2><p>"Closed" and "Restricted" are what the open traffic feed of South Tyrol reports for a pass right now. "Scheduled" starts later. "Report ended" means the last report has run out - that is not a confirmation that the road is open. Outside South Tyrol CurveScout has no live source yet, so those passes are not listed here; their pages give height, season and the rides that cross them. The signs on the road always decide.</p></section>' +
    '<table><thead><tr><th>Pass</th><th>Status</th><th>What the feed reports</th></tr></thead><tbody>' + rows.map(line).join('') + '</tbody></table>' +
    '<p><a href="/passes/">All 388 mountain passes</a> · <a href="/guides/pass-openings-versus-riding-season/">Pass openings and riding season</a></p></main>' +
    '<footer><div class="wrap"><p class="small">Status from ' + E(src) + ' (open data), judged by the same rules as the CurveScout app. Published by CurveScout.</p></div></footer></body></html>';
  fs.mkdirSync(path.join(root, 'passes'), { recursive: true }); const f = path.join(root, 'passes/status.html');
  const old = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; if (old !== html) fs.writeFileSync(f, html); return { rows: rows.length, current: n, changed: old !== html };
}
export function renderAndStage(root = '.') { const r = render(root); if (r.changed) { try { execFileSync('git', ['add', 'passes/status.html'], { cwd: root, stdio: 'ignore' }); } catch (e) {} } return r; }
if (import.meta.url === 'file://' + process.argv[1]) console.log(JSON.stringify(render(process.argv[2] || '.')));
