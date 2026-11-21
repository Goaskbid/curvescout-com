/* CurveScout live pass status - the shared core (r70). No file access, so the same code runs in the GitHub job
 * (.github/scripts/pass-status.mjs) and, after the Cloudflare move, in the scheduled Worker (cloudflare/passes-cron.mjs).
 * collect(passes, log) returns the body of data/live/passes.json, without the 'updated' stamp. */
export const BASE = 'https://datex.api.opendatahub.com';
const COVER = [{ name: 'South Tyrol', bbox: [46.21, 10.38, 47.1, 12.48] }];   /* [south, west, north, east] */
const hav = (a, b) => { const r = Math.PI / 180, x = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const get = async (u, kind) => { const r = await fetch(u, { headers: { 'User-Agent': 'CurveScout pass status (https://curvescout.com)', Accept: kind === 'xml' ? 'application/xml' : 'application/json, */*' } }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.text(); };
export function records(xml) {   /* DATEX II v2 SituationRecords -> {id, version, type, mgmt, pts, text, start, end, roads} */
  const out = []; const blocks = xml.split(/<(?:\w+:)?situationRecord\b/).slice(1);
  for (const b0 of blocks) { const head = b0.slice(0, b0.indexOf('>') + 1); const b = b0.split(/<\/(?:\w+:)?situationRecord>/)[0];
    const id = (head.match(/\bid="([^"]+)"/) || [])[1] || '', version = (head.match(/\bversion="([^"]+)"/) || [])[1] || '';
    const type = ((b.match(/xsi:type="(?:\w+:)?(\w+)"/) || [])[1] || '');
    const mgmt = ((b.match(/<(?:\w+:)?roadOrCarriagewayOrLaneManagementType>([^<]+)</) || [])[1] || '') + ' ' + ((b.match(/<(?:\w+:)?(?:roadMaintenanceType|networkManagementType|winterEquipmentManagementType|generalNetworkManagementType)>([^<]+)</) || [])[1] || '');
    const pts = []; const re = /<(?:\w+:)?latitude>([-\d.]+)<\/(?:\w+:)?latitude>\s*<(?:\w+:)?longitude>([-\d.]+)</g; let m; while ((m = re.exec(b))) pts.push([+m[1], +m[2]]);
    const roads = [...b.matchAll(/<(?:\w+:)?(?:roadName|roadNumber)>(?:\s*<[^>]+>)*\s*([^<]{2,})</g)].map(x => x[1].trim());
    const vals = [...b.matchAll(/<(?:\w+:)?value\s+lang="(\w+)"[^>]*>([^<]{3,})</g)].map(x => ({ lang: x[1], t: x[2].trim() }));
    const text = (vals.find(v => v.lang === 'en') || vals.find(v => v.lang === 'de') || vals.find(v => v.lang === 'it') || vals[0] || { t: '' }).t;
    const start = (b.match(/<(?:\w+:)?overallStartTime>([^<]+)</) || [])[1] || '', end = (b.match(/<(?:\w+:)?overallEndTime>([^<]+)</) || [])[1] || '';
    out.push({ id, version, type, mgmt: mgmt.trim(), pts, roads, text, all: norm(vals.map(v => v.t).concat(roads).join(' ')), start, end }); }
  return out; }
/* r62 (audit P0-01): a report binds to a pass only on evidence - its own road name names the pass (and it lies within
   25 km), or it sits on the pass itself (within 600 m). Negated text ("not closed", "nicht gesperrt") is no closure. A
   report that starts later is "planned", not closed. Unreadable validity times make no claim at all. */
const NEG = /\b(not|no longer|nicht|nicht mehr|non|kein|keine)\s+(closed|gesperrt|chiuso|chiusa)\b|\b(reopened|re-opened|wieder (offen|ge(o|ö)ffnet|befahrbar)|riaperto|riaperta|open again)\b/i;
const GENERIC = new Set(['pass', 'passo', 'joch', 'sattel', 'strasse', 'strada', 'road', 'mountain', 'example', 'route', 'valley', 'lake', 'col', 'colle', 'national', 'highway']);
export function match(recs, passes, now = Date.now()) {
  const res = {};
  for (const r of recs) {
    const st = r.start ? Date.parse(r.start) : NaN, en = r.end ? Date.parse(r.end) : NaN;
    if ((r.start && !Number.isFinite(st)) || (r.end && !Number.isFinite(en))) continue;
    if (Number.isFinite(en) && en < now) continue;
    const neg = NEG.test(r.all || '') || NEG.test(r.text || '');
    const mg = String(r.mgmt || '');
    const closed = /roadClosed|carriagewayClosures|closedPermanentlyForTheWinter/i.test(mg) || (!neg && /\b(gesperrt|chiuso|chiusa|closed)\b/i.test(r.all || ''));
    const restr = closed || /snowChains|winterEquipment|singleAlternateLineTraffic|laneClosures/i.test(mg) || (!neg && /\b(kettenpflicht|schneeketten|catene|winter tyres|winterreifen)\b/i.test(r.all || ''));
    if (!restr) continue;
    for (const p of passes) {
      const d = r.pts.length ? Math.min(...r.pts.map(q => hav(q, p.at))) : Infinity;
      const toks = norm(p.n).split(/[\s/(),.-]+/).filter(w => w.length >= 5 && !GENERIC.has(w));
      const named = toks.length && toks.some(w => (r.all || '').includes(w));
      /* r67 (audit V65-PRODUCER): a report that names its own road binds by proximity only when that road is this pass's
         road (its number or a name token); a report on another road beside the summit is not this pass's closure */
      const rn = norm((r.roads || []).join(' ')).replace(/\s+/g, ''), ref = norm(p.ref || '').replace(/\s+/g, '');
      const sameRoad = !(r.roads && r.roads.length) || (ref && rn.includes(ref)) || toks.some(w => norm((r.roads || []).join(' ')).includes(w));
      if (!((named && d <= 25) || (d <= 0.6 && sameRoad))) continue;
      const k = norm(p.n), cur = res[k];
      const future = Number.isFinite(st) && st > now;
      const v = { status: future ? 'planned' : closed ? 'closed' : 'restricted', text: String(r.text || '').slice(0, 240), since: r.start || '', until: r.end || '', id: r.id || '', version: r.version || '', km: Number.isFinite(d) ? Math.round(d * 10) / 10 : null };
      const rank = x => x.status === 'closed' ? 3 : x.status === 'restricted' ? 2 : 1;
      if (!cur || rank(v) > rank(cur)) res[k] = v; } }
  return res; }
export async function collect(passes, log = console.log) {
  const console = { log };
  passes = (passes || []).filter(p => Array.isArray(p.at));
  const down = why => ({ feed: 'unavailable', reason: why, sources: [], coverage: [], passes: {} });
  let disc; try { disc = await get(BASE + '/datex/2/'); } catch (e) { console.log('discovery failed:', e.message); return down('feed list could not be read (' + e.message.slice(-60) + ')'); }
  const urls = [...new Set([...disc.matchAll(/(https?:\/\/[^"'\s<>]+|\/v1\/[^"'\s<>]+)/g)].map(m => m[1].startsWith('/') ? BASE + m[1] : m[1]).filter(u => u.startsWith(BASE) && (/\/v1\//.test(u) || /\.xml(\?|$)/i.test(u))))];
  console.log('providers listed:', urls.length, '| start of the list:', disc.slice(0, 300).replace(/\s+/g, ' '));
  if (!urls.length) return down('feed list has no providers: ' + disc.slice(0, 160).replace(/\s+/g, ' '));
  const recs = []; let failed = 0; const tried = urls.slice(0, 40);
  for (const u of tried) { try { const xml = await get(u, 'xml'); const r = records(xml); recs.push(...r); console.log(u, r.length, 'records'); } catch (e) { failed++; console.log('skip', u, e.message); } }
  if (!recs.length) return down('providers listed (' + urls.length + ') but no traffic records could be read');
  const found = match(recs, passes);
  console.log('records:', recs.length, '| passes with a report:', Object.keys(found).length);
  /* r67: a partial read is said in the file - a provider that could not be read is never taken as 'no closures there' */
  return ({ feed: failed ? 'partial' : 'ok', providers: tried.length, providersFailed: failed, records: recs.length, checked: new Date().toISOString().slice(0, 16) + 'Z', validFor: '6h', sources: [{ name: 'Open Data Hub, Province of Bozen/Bolzano (South Tyrol)', url: 'https://opendatahub.com/', licence: 'open data' }], coverage: COVER, passes: found });
}
