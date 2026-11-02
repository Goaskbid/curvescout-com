/* ---- CO-PILOT RUNTIME: ONE FILE, BUILT FROM THE VENDORED 1.3.0 SOURCE ----
 * copilot/ holds the exact runtime files of the restored Co-Pilot package (1.3.0-global-safety-beta,
 * 38 modules plus the entry). The site is uploaded as flat files, so relative ES-module imports
 * across folders would break; the runtime is bundled into assets/copilot/copilot-runtime.js, which
 * the ride page imports only when the rider opens the Co-Pilot tab.
 *
 *   node tools/build-copilot.mjs            check: the bundle carries the hash of today's source
 *   ESBUILD=/path/to/esbuild node tools/build-copilot.mjs --write   rebuild the bundle
 *
 * The check needs no tools: the bundle's first line names the sha256 of every vendored source file
 * taken together, so a change to copilot/ without a rebuild fails the build.
 */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process';
const SRC = 'copilot', LIVE = 'src/copilot-live', OUT = 'assets/copilot/copilot-runtime.js';
const STUDIO = ['STUDIO-VOICE-LICENSES.txt', 'cs-studio-worker.src.mjs', 'cs-g2p-local.src.mjs', 'cs-studio-worker.js', 'cs-ort-1.bin', 'cs-ort-2.bin', 'cs-ort-glue.js', 'cs-voice-bella.bin', 'cs-voice-heart.bin', 'cs-phon.src.mjs', 'cs-build-copilot.src.mjs', 'STUDIO-VOICE-BUILD.txt', 'cs-g2p-en.src.mjs', 'cs-cmudict-LICENSE.txt'];
const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.mjs$/.test(e.name)) files.push(p); } })(SRC); (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.mjs$/.test(e.name)) files.push(p); } })(LIVE);
files.sort(); const h = crypto.createHash('sha256'); for (const f of files) { h.update(f + '\n'); h.update(fs.readFileSync(f)); } const sum = h.digest('hex');
const head = '/* CurveScout Co-Pilot live navigator | source sha256 ' + sum + ' | ' + files.length + ' modules | built by tools/build-copilot.mjs from copilot/ and src/copilot-live/ */';
if (process.argv.includes('--write')) {
  const bin = process.env.ESBUILD || 'esbuild';
  const js = execFileSync(bin, [path.join(SRC, 'entry.mjs'), '--bundle', '--format=esm', '--target=es2020', '--minify-whitespace', '--minify-syntax', '--legal-comments=none'], { encoding: 'utf8', maxBuffer: 32 << 20 });
  if (/validation-worker/.test(js)) throw new Error('unexpected worker reference');
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, head + '\n' + js);
  console.log('wrote ' + OUT + ' ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
  /* the studio voice: its worker (ONNX Runtime Web 1.22.0 + src/copilot-live/studio-worker.mjs with our own English
     pronunciation, g2p-en.mjs + the CMU dictionary), the runtime's WebAssembly and loader, and two Kokoro voice tables
     (af_bella, af_heart from kokoro-js 1.2.1). STUDIO_DEPS names a node_modules folder with onnxruntime-web@1.22.0 and
     kokoro-js@1.2.1. No GPL code since 2026-11-02: eSpeak NG (via phonemizer) was replaced by g2p-en.mjs. */
  const DEPS = process.env.STUDIO_DEPS;
  if (DEPS) {
    execFileSync(bin, [path.join(LIVE, 'studio-worker.mjs'), '--bundle', '--format=esm', '--platform=browser', '--target=es2020', '--minify', '--legal-comments=inline', '--loader:.txt=text', '--outfile=' + path.join(path.dirname(OUT), 'cs-studio-worker.js')], { env: { ...process.env, NODE_PATH: DEPS } });
    const cp = (a, b) => fs.copyFileSync(path.join(DEPS, a), path.join(path.dirname(OUT), b));
    { const w = fs.readFileSync(path.join(DEPS, 'onnxruntime-web/dist/ort-wasm-simd-threaded.wasm')), h = Math.ceil(w.length / 2); fs.writeFileSync(path.join(path.dirname(OUT), 'cs-ort-1.bin'), w.subarray(0, h)); fs.writeFileSync(path.join(path.dirname(OUT), 'cs-ort-2.bin'), w.subarray(h)); try { fs.rmSync(path.join(path.dirname(OUT), 'cs-ort.wasm')); } catch (e) {} }   /* two halves: no file over 10 MB */ cp('onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'cs-ort-glue.js');
    cp('kokoro-js/voices/af_bella.bin', 'cs-voice-bella.bin'); cp('kokoro-js/voices/af_heart.bin', 'cs-voice-heart.bin');
    /* the worker's own source next to it (GPL-3.0: the corresponding source is offered from the same place) */
    fs.copyFileSync(path.join(LIVE, 'studio-worker.mjs'), path.join(path.dirname(OUT), 'cs-studio-worker.src.mjs')); fs.copyFileSync(path.join(LIVE, 'g2p-local.mjs'), path.join(path.dirname(OUT), 'cs-g2p-local.src.mjs'));
    /* GPL-3.0 corresponding source, complete (r30 external audit: the notice named a build script that was not published):
       every module the worker is built from, this build script and the exact rebuild instructions, next to the binary */
    fs.copyFileSync(path.join(LIVE, 'phon.mjs'), path.join(path.dirname(OUT), 'cs-phon.src.mjs'));
    fs.copyFileSync('tools/build-copilot.mjs', path.join(path.dirname(OUT), 'cs-build-copilot.src.mjs'));
    fs.copyFileSync(path.join(LIVE, 'g2p-en.mjs'), path.join(path.dirname(OUT), 'cs-g2p-en.src.mjs'));
    fs.copyFileSync(path.join(LIVE, 'data/cmudict-LICENSE.txt'), path.join(path.dirname(OUT), 'cs-cmudict-LICENSE.txt'));
    try { fs.unlinkSync(path.join(path.dirname(OUT), 'cs-phonemizer-1.2.1-upstream.zip')); } catch (e) {}
    let ev = ''; try { ev = execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim(); } catch (e) {}
    fs.writeFileSync(path.join(path.dirname(OUT), 'STUDIO-VOICE-BUILD.txt'), [
      'How cs-studio-worker.js is built', '',
      'Since 2026-11-02 the studio voice contains no GPL code: English pronunciation is CurveScout\'s own (g2p-en.mjs with the',
      'CMU Pronouncing Dictionary), replacing eSpeak NG. Its sources are published here anyway, so anyone can rebuild it:',
      '  cs-studio-worker.src.mjs  = src/copilot-live/studio-worker.mjs', '  cs-g2p-en.src.mjs         = src/copilot-live/g2p-en.mjs',
      '  cs-g2p-local.src.mjs      = src/copilot-live/g2p-local.mjs', '  cs-phon.src.mjs           = src/copilot-live/phon.mjs',
      '  cs-build-copilot.src.mjs  = tools/build-copilot.mjs (this build script)',
      '  the dictionary: src/copilot-live/data/cmudict.txt, from the npm package cmu-pronouncing-dictionary@3.0.0 (licence: cs-cmudict-LICENSE.txt)', '',
      'Dependencies (npm, exact versions): onnxruntime-web@1.22.0, kokoro-js@1.2.1 (voice tables only); bundler esbuild@' + (ev || '0.24.0') + '.', '',
      'Rebuild:', '  1. put the .src.mjs files back at the paths above, and the dictionary at src/copilot-live/data/cmudict.txt',
      '  2. npm install onnxruntime-web@1.22.0 kokoro-js@1.2.1 esbuild@' + (ev || '0.24.0'),
      '  3. esbuild src/copilot-live/studio-worker.mjs --bundle --format=esm --platform=browser --target=es2020 --minify --legal-comments=inline --loader:.txt=text --outfile=cs-studio-worker.js', ''].join('\n'));   /* mapping of the eSpeak NG binary + written offer */
    const man = {}; for (const f of STUDIO) man[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(path.dirname(OUT), f))).digest('hex');
    fs.writeFileSync(path.join(LIVE, 'studio-assets.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), ort: 'onnxruntime-web 1.22.0', g2p: 'g2p-en (CMU Pronouncing Dictionary, cmu-pronouncing-dictionary 3.0.0)', voices: 'kokoro-js 1.2.1', sha256: man }, null, 1) + '\n');
    console.log('wrote studio voice files: ' + STUDIO.join(', '));
  }
}
const got = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n', 1)[0] : '';
const bad = [];
if (got !== head) bad.push('bundle is stale or missing: run ESBUILD=... node tools/build-copilot.mjs --write');
const js = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
/* no simulation in the runtime (owner 2026-10-31): the rehearsal UI must not come back */
if (/ROUTE REHEARSAL|installMobileCoPilot/.test(js)) bad.push('the 1.3.0 rehearsal UI is back in the runtime');
if (/raw\.githubusercontent|api\.github\.com/.test(js.replace(/GITHUB_IS_NOT_A_RUNTIME_DATA_BACKEND|github\\\.com\|githubusercontent\\\.com/g, ''))) bad.push('runtime references GitHub as a data backend');
if (fs.existsSync(OUT) && fs.statSync(OUT).size > 400 * 1024) bad.push('bundle over 400 KB');
/* the studio voice files are present and exactly the ones built */
try { const man = JSON.parse(fs.readFileSync(path.join(LIVE, 'studio-assets.json'), 'utf8')).sha256;
  for (const f of STUDIO) { const p = path.join(path.dirname(OUT), f); if (!fs.existsSync(p)) { bad.push('studio voice file missing: ' + f); continue; }
    if (crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') !== man[f]) bad.push('studio voice file differs from its build: ' + f);
    if (fs.statSync(p).size > 24 * 1024 * 1024) bad.push(f + ' over the 25 MB web-upload limit'); }
  if (!/kokoro-q8-shards@1\.0\.0/.test(js)) bad.push('runtime does not point at the pinned model pieces');
} catch (e) { bad.push('studio voice manifest missing: ' + e.message); }
for (const b of bad) console.log('FAIL | ' + b);
if (!bad.length) console.log('PASS | Co-Pilot runtime ' + (js.length / 1024).toFixed(0) + ' KB, ' + files.length + ' vendored modules, live navigator, no rehearsal UI');
process.exit(bad.length ? 1 : 0);
