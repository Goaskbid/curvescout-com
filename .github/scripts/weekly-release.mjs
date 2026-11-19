/* CurveScout weekly release - run every Monday by .github/workflows/cs-weekly.yml (no keys, no accounts).
 * Offers the next held-back rides to search engines, best first, from data/index/release-plan.json (built and checked
 * against every crawl rule at release time). Each batch adds at most 10% to the rides already offered, so the site grows
 * at a pace search engines can judge. Each released page: robots noindex -> index, the country's sharing image.
 * Every batch is written to data/index/release-log.json and listed on /changelog.html. Not due -> no change.
 * usage: node .github/scripts/weekly-release.mjs <site> [--force] [--date YYYY-MM-DD] */
import fs from 'node:fs'; import path from 'node:path';
const S = process.argv[2] || '.', A = process.argv.slice(3);
const today = A.includes('--date') ? A[A.indexOf('--date') + 1] : new Date().toISOString().slice(0, 10);
const P = f => path.join(S, f), rd = f => fs.readFileSync(P(f), 'utf8');
const plan = JSON.parse(rd('data/index/release-plan.json')).order;
const logF = 'data/index/release-log.json'; const log = fs.existsSync(P(logF)) ? JSON.parse(rd(logF)) : { batches: [] };
const last = log.batches.length ? log.batches[log.batches.length - 1].date : null;
if (last && !A.includes('--force') && (Date.parse(today) - Date.parse(last)) / 864e5 < 6.5) { console.log('not due: last batch', last); process.exit(0); }
const NOI = /<meta name="robots" content="noindex,follow">/;
let indexed = 0; for (const f of fs.readdirSync(P('rides'))) { if (!f.endsWith('.html')) continue; const h = fs.readFileSync(P('rides/' + f), 'utf8').split('</head>')[0]; if (!/<meta[^>]+robots[^>]+noindex/.test(h)) indexed++; }
const want = Math.max(1, Math.ceil(indexed * 0.10)); const done = new Set(log.batches.flatMap(b => b.ids)); const ids = [];
for (const id of plan) {
  if (ids.length >= want) break; if (done.has(id)) continue;
  const f = 'rides/' + id + '.html'; if (!fs.existsSync(P(f))) continue;
  let t = rd(f); const head = t.split('</head>')[0];
  if (!NOI.test(head) || !head.includes('<link rel="canonical" href="https://curvescout.com/' + f + '">')) continue;
  t = t.replace(NOI, '<meta name="robots" content="index,follow">');
  const cc = (t.match(/href="\/read\/([a-z]{2})\/index.html"/) || [])[1];
  if (cc && fs.existsSync(P('assets/og/' + cc + '.png'))) {
    const url = 'https://curvescout.com/assets/og/' + cc + '.png';
    t = t.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + url + '">').replace(/<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="' + url + '">');
  }
  fs.writeFileSync(P(f), t); ids.push(id);
}
if (!ids.length) { console.log('nothing left to release'); process.exit(0); }
log.batches.push({ date: today, offeredBefore: indexed, released: ids.length, ids });
fs.writeFileSync(P(logF), JSON.stringify(log));
const ch = 'changelog.html';
if (fs.existsSync(P(ch))) {
  const li = '<li><time datetime="' + today + '">' + today + '</time> - ' + ids.length + ' more rides offered to search engines, best first (now ' + (indexed + ids.length).toLocaleString('en-US') + ').</li>';
  fs.writeFileSync(P(ch), rd(ch).replace('<ol id="csReleaseLog">', '<ol id="csReleaseLog">' + li));
}
console.log('released', ids.length, 'rides; offered before:', indexed, '; now:', indexed + ids.length);
