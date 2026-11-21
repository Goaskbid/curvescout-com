/* CurveScout live pass status - run by .github/workflows/cs-upload.yml every 6 hours and after each deploy, until the
 * Cloudflare scheduled job (cloudflare/passes-cron.mjs, every 3 hours) takes over (no keys, no accounts).
 * Source: Open Data Hub DATEX II feed (NOI Techpark / Autonomous Province of Bozen/Bolzano, South Tyrol), open data.
 * Reads every provider the feed lists, keeps road closures and restrictions, matches them to the passes in
 * data/passes.json by distance (4 km of the summit) or by name, and writes data/live/passes.json. The file is rewritten
 * only when the reported status changes, so an unchanged feed makes no commit and no Pages rebuild.
 * usage: node .github/scripts/pass-status.mjs [--dry] */
import fs from 'node:fs';
import { collect, records, match } from './pass-core.mjs';
export { records, match };
const OUT = 'data/live/passes.json', DRY = process.argv.includes('--dry');
/* r61: when the feed cannot be read, say so in the file (no live claims, coverage empty) - only when that changes */
function writeState(body) {
  let old = null; try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
  const strip = o => JSON.stringify({ ...o, updated: undefined });
  if (old && strip(old) === strip(body)) { console.log('unchanged'); return; }
  if (DRY) { console.log(JSON.stringify(body).slice(0, 400)); return; }
  fs.mkdirSync('data/live', { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), ...body }, null, 1)); console.log('written');
}
const down = why => writeState({ feed: 'unavailable', reason: why, sources: [], coverage: [], passes: {} });
async function main() {
  /* r69: never write while a site upload is waiting to be deployed. The autopilot's upload run and this job start on the
     same push; if this one saved first, the deploy could not save and was lost (r65, r66, r68). The pass status is
     simply refreshed on the next run, after the deploy. */
  const waiting = fs.readdirSync('.').filter(f => /\.zip$/i.test(f)).concat(fs.existsSync('inbox') ? fs.readdirSync('inbox').filter(f => /\.zip$/i.test(f)) : []);
  if (waiting.length) { console.log('site upload waiting (' + waiting.join(', ') + '): pass status left unchanged this run'); return; }
  const passes = JSON.parse(fs.readFileSync('data/passes.json', 'utf8')).passes || [];
  writeState(await collect(passes));
}
if (import.meta.url === 'file://' + process.argv[1]) main();
