/* ---- CO-PILOT STUDIO VOICE: a neural voice that runs on the rider's own device, in a worker ----
   Model: Kokoro-82M v1.0 (Apache-2.0, hexgrad), the 8-bit ONNX export by onnx-community. Text to phonemes: our own English
   pronunciation (g2p-en.mjs: CMU Pronouncing Dictionary + rules; eSpeak NG/GPL removed 2026-11-02). Inference: ONNX Runtime Web (MIT), single
   thread, WebAssembly. The text clean-up below follows kokoro-js 1.2.1 (Apache-2.0, Joshua Lochner).
   Why a worker: one sentence takes a moment to compute; on the page that would freeze the moving map.
   Where the files come from: the runtime, its WebAssembly file and the two voice tables are on curvescout.com itself;
   the 92 MB model comes from jsDelivr (npm package kokoro-q8-shards, six pieces) and, if that fails, from the original
   on Hugging Face. Every byte is checked against the model's SHA-256 before it is used, and it is kept in the
   browser's cache so it downloads once. */
import * as ort from 'onnxruntime-web/wasm';
import { respell } from './phon.mjs';
import { phonemizeEn } from './g2p-en.mjs';   /* our own English pronunciation (CMU dictionary + rules); eSpeak NG removed 2026-11-02 */
import { localIPA } from './g2p-local.mjs';

const MODEL_SHA = 'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478', MODEL_BYTES = 92361116;
const CACHE = 'cs-studio-voice-v1';
const VOCAB = { ";": 1, ":": 2, ",": 3, ".": 4, "!": 5, "?": 6, "—": 9, "…": 10, "\"": 11, "(": 12, ")": 13, "“": 14, "”": 15, " ": 16, "̃": 17, "ʣ": 18, "ʥ": 19, "ʦ": 20, "ʨ": 21, "ᵝ": 22, "ꭧ": 23, "A": 24, "I": 25, "O": 31, "Q": 33, "S": 35, "T": 36, "W": 39, "Y": 41, "ᵊ": 42, "a": 43, "b": 44, "c": 45, "d": 46, "e": 47, "f": 48, "h": 50, "i": 51, "j": 52, "k": 53, "l": 54, "m": 55, "n": 56, "o": 57, "p": 58, "q": 59, "r": 60, "s": 61, "t": 62, "u": 63, "v": 64, "w": 65, "x": 66, "y": 67, "z": 68, "ɑ": 69, "ɐ": 70, "ɒ": 71, "æ": 72, "β": 75, "ɔ": 76, "ɕ": 77, "ç": 78, "ɖ": 80, "ð": 81, "ʤ": 82, "ə": 83, "ɚ": 85, "ɛ": 86, "ɜ": 87, "ɟ": 90, "ɡ": 92, "ɥ": 99, "ɨ": 101, "ɪ": 102, "ʝ": 103, "ɯ": 110, "ɰ": 111, "ŋ": 112, "ɳ": 113, "ɲ": 114, "ɴ": 115, "ø": 116, "ɸ": 118, "θ": 119, "œ": 120, "ɹ": 123, "ɾ": 125, "ɻ": 126, "ʁ": 128, "ɽ": 129, "ʂ": 130, "ʃ": 131, "ʈ": 132, "ʧ": 133, "ʊ": 135, "ʋ": 136, "ʌ": 138, "ɣ": 139, "ɤ": 140, "χ": 142, "ʎ": 143, "ʒ": 147, "ʔ": 148, "ˈ": 156, "ˌ": 157, "ː": 158, "ʰ": 162, "ʲ": 164, "↓": 169, "→": 171, "↗": 172, "↘": 173, "ᵻ": 177 };

/* ---- text clean-up (kokoro-js 1.2.1) ---- */
function splitNum(e) { if (e.includes('.')) return e; if (e.includes(':')) { const [a, t] = e.split(':').map(Number); return t === 0 ? a + " o'clock" : t < 10 ? a + ' oh ' + t : a + ' ' + t; }
  const a = parseInt(e.slice(0, 4), 10); if (a < 1100 || a % 1000 < 10) return e; const t = e.slice(0, 2), r = parseInt(e.slice(2, 4), 10), n = e.endsWith('s') ? 's' : '';
  if (a % 1000 >= 100 && a % 1000 <= 999) { if (r === 0) return t + ' hundred' + n; if (r < 10) return t + ' oh ' + r + n; } return t + ' ' + r + n; }
function money(e) { const a = e[0] === '$' ? 'dollar' : 'pound'; if (isNaN(Number(e.slice(1)))) return e.slice(1) + ' ' + a + 's';
  if (!e.includes('.')) return e.slice(1) + ' ' + a + (e.slice(1) === '1' ? '' : 's'); const [t, r] = e.slice(1).split('.'), n = parseInt(r.padEnd(2, '0'), 10);
  return t + ' ' + a + (t === '1' ? '' : 's') + ' and ' + n + ' ' + (e[0] === '$' ? (n === 1 ? 'cent' : 'cents') : (n === 1 ? 'penny' : 'pence')); }
function point(e) { const [a, t] = e.split('.'); return a + ' point ' + t.split('').join(' '); }
export function normalize(e) {
  return e.replace(/[‘’]/g, "'").replace(/«/g, '“').replace(/»/g, '”').replace(/[“”]/g, '"').replace(/\(/g, '«').replace(/\)/g, '»')
    .replace(/[^\S \n]/g, ' ').replace(/  +/, ' ').replace(/(?<=\n) +(?=\n)/g, '')
    .replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor').replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, 'Mister').replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, 'Miss').replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, 'Mrs')
    .replace(/\betc\.(?! [A-Z])/gi, 'etc').replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, splitNum).replace(/(?<=\d),(?=\d)/g, '')
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, money).replace(/\d*\.\d+/g, point)
    .replace(/(?<=\d)-(?=\d)/g, ' to ').replace(/(?<=\d)S/g, ' S').replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S").replace(/(?<=X')S\b/g, 's')
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, m => m.replace(/\./g, '-')).replace(/(?<=[A-Z])\.(?=[A-Z])/gi, '-').trim();
}
/* road-speak first: units and signs the model would otherwise spell out */
export function roadSpeak(t) {
  return String(t || '').replace(/(\d)\s?km\/h\b/gi, '$1 kilometres per hour').replace(/(\d)\s?km\b/g, '$1 kilometres').replace(/(\d)\s?m\b/g, '$1 metres')
    .replace(/(-?\d+)\s?°C/g, '$1 degrees').replace(/\bN(\d+)\b/g, 'N $1').replace(/\s*[⚠🌇🧭•·]\s*/gu, ' ').replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
}
const PUNCT = ';:,.!?¡¿—…"«»“”(){}[]';
const PUNCT_RE = new RegExp('(\\s*[' + PUNCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']+\\s*)+', 'g');
/* a place name marked ⟦Grindelwald|de⟧ is spoken in its own language; the rest of the sentence in English */
export async function toPhonemes(text, lang = 'a') {
  const parts = String(text).split(/(⟦[^⟧]*⟧)/); if (parts.length === 1) return toPhonemesEn(text, lang);
  const out = [];
  for (const p of parts) { if (!p) continue; const m = p.match(/^⟦([^|⟧]*)\|([a-z]*)⟧$/);
    if (m) { const ipa = localIPA(m[1], m[2]); out.push(ipa ? ipa.split('').filter(ch => VOCAB[ch] !== undefined).join('') : await toPhonemesEn(respell(m[1], m[2], 'en'), lang)); }   /* no local phonemes: the name respelled for English (phon.mjs) */
    else if (/[a-z0-9]/i.test(p)) out.push(await toPhonemesEn(p, lang)); else out.push(p.trim()); }
  return out.join(' ').replace(/\s+([,.;:!?])/g, '$1').replace(/\s+/g, ' ').trim();
}
async function toPhonemesEn(text, lang = 'a') {
  text = normalize(text); const parts = []; let last = 0;
  for (const m of text.matchAll(PUNCT_RE)) { if (last < m.index) parts.push({ p: false, t: text.slice(last, m.index) }); if (m[0].length) parts.push({ p: true, t: m[0] }); last = m.index + m[0].length; }
  if (last < text.length) parts.push({ p: false, t: text.slice(last) });
  let s = (await Promise.all(parts.map(async x => x.p ? x.t : phonemizeEn(x.t)))).join('');
  s = s.replace(/kəkˈoːɹoʊ/g, 'kˈoʊkəɹoʊ').replace(/kəkˈɔːɹəʊ/g, 'kˈəʊkəɹəʊ').replace(/ʲ/g, 'j').replace(/r/g, 'ɹ').replace(/x/g, 'k').replace(/ɬ/g, 'l')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ').replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z');
  if (lang === 'a') s = s.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
  return s.trim();
}
export function tokenize(ph) { const ids = [0]; for (const ch of ph) { const v = VOCAB[ch]; if (v !== undefined) ids.push(v); } if (ids.length > 511) ids.length = 511; ids.push(0); return ids; }
/* one sentence per call keeps every piece well inside the model's 510 tokens and lets playback start early */
export function sentences(text) { const out = []; const re = /[^.!?…]+[.!?…]+["”']?|[^.!?…]+$/g; let m;
  while ((m = re.exec(text))) { const s = m[0].trim(); if (!s) continue; if (s.length > 260) { s.split(/(?<=[,;:—])\s+/).reduce((acc, c) => { if (acc.length && (acc[acc.length - 1] + ' ' + c).length < 240) acc[acc.length - 1] += ' ' + c; else acc.push(c); return acc; }, []).forEach(x => out.push(x)); } else out.push(s); }
  return out.length ? out : [text]; }

/* ---- loading ---- */
let session = null; const voices = {}; let cfg = null;
const post = (m, t) => self.postMessage(m, t || []);
async function hex(buf) { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function cached(cache, url) { try { const r = cache && await cache.match(url); if (r) return await r.arrayBuffer(); } catch (e) {} return null; }
async function getModel() {
  let cache = null; try { cache = await caches.open(CACHE); } catch (e) {}
  const whole = await cached(cache, 'cs-studio://model');
  if (whole && whole.byteLength === MODEL_BYTES) { post({ type: 'progress', p: 1, from: 'cache' }); return whole; }
  const sources = [cfg.shards, [cfg.hfModel]].filter(s => s && s.length && s[0]);
  let lastErr = null;
  for (const urls of sources) {
    try {
      const out = new Uint8Array(MODEL_BYTES); let off = 0;
      for (const u of urls) {
        const r = await fetch(u, { mode: 'cors', credentials: 'omit' }); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u);
        const rd = r.body.getReader(); for (;;) { const { done, value } = await rd.read(); if (done) break; if (off + value.length > MODEL_BYTES) throw new Error('model larger than expected'); out.set(value, off); off += value.length; post({ type: 'progress', p: off / MODEL_BYTES }); }
      }
      if (off !== MODEL_BYTES) throw new Error('model size ' + off);
      const sha = await hex(out.buffer); if (sha !== MODEL_SHA) throw new Error('model checksum mismatch');
      try { cache && await cache.put('cs-studio://model', new Response(out.buffer.slice(0), { headers: { 'content-type': 'application/octet-stream' } })); } catch (e) {}
      return out.buffer;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('no model source');
}
async function getVoice(name) { if (voices[name]) return voices[name]; const r = await fetch(cfg.voices[name]); if (!r.ok) throw new Error('voice ' + name); const b = await r.arrayBuffer(); if (b.byteLength !== 510 * 256 * 4) throw new Error('voice size'); return (voices[name] = new Float32Array(b)); }
async function init(c) {
  cfg = c; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; /* the WebAssembly file is handed over as bytes, so no second script is loaded from a path */
  const parts = await Promise.all([].concat(c.wasm).map(async u => { const wr = await fetch(u); if (!wr.ok) throw new Error('runtime ' + wr.status); return new Uint8Array(await wr.arrayBuffer()); }));
  const bin = new Uint8Array(parts.reduce((a, b) => a + b.length, 0)); let o2 = 0; for (const b of parts) { bin.set(b, o2); o2 += b.length; } ort.env.wasm.wasmBinary = bin.buffer;   /* the runtime comes in two halves (no file over 10 MB) */ if (c.glue) ort.env.wasm.wasmPaths = { mjs: c.glue };
  const t0 = performance.now();
  const [model] = await Promise.all([getModel(), getVoice(c.defaultVoice || 'af_bella')]);
  session = await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  /* warm-up: the first run is the slow one */
  await synth('Ready.', c.defaultVoice || 'af_bella', 1);
  post({ type: 'ready', ms: Math.round(performance.now() - t0) });
}
async function synth(text, voice, speed) {
  const ids = tokenize(await toPhonemes(text)); const v = await getVoice(voice); const n = Math.min(Math.max(ids.length - 2, 0), 509);
  const feeds = { input_ids: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]), style: new ort.Tensor('float32', v.slice(n * 256, n * 256 + 256), [1, 256]), speed: new ort.Tensor('float32', [speed], [1]) };
  const out = await session.run(feeds); return out.waveform.data;
}
/* one job at a time; a newer urgent job jumps the queue */
const jobs = []; let busy = false;
async function pump() { if (busy) return; busy = true;
  /* the sentence needed soonest goes first */
  while (jobs.length) { jobs.sort((a, b) => a.due - b.due); const j = jobs.shift(); if (j.cancelled) continue;
    try { const parts = sentences(roadSpeak(j.text)); for (let i = 0; i < parts.length; i++) { if (j.cancelled) break; const t0 = performance.now(); const pcm = await synth(parts[i], j.voice, j.speed); const f = new Float32Array(pcm); post({ type: 'chunk', id: j.id, i, last: i === parts.length - 1, pcm: f, sr: 24000, ms: Math.round(performance.now() - t0) }, [f.buffer]); } }
    catch (e) { post({ type: 'error', id: j.id, error: String(e && e.message || e) }); } }
  busy = false; }
self.onmessage = async ev => { const m = ev.data || {};
  if (m.type === 'init') { try { await init(m); } catch (e) { post({ type: 'failed', error: String(e && e.message || e) }); } return; }
  if (m.type === 'say') { jobs.push({ id: m.id, text: m.text, voice: m.voice || 'af_bella', speed: m.speed || 1, due: m.due == null ? 0 : m.due }); pump(); return; }
  if (m.type === 'due') { jobs.forEach(j => { if (j.id === m.id) j.due = m.due; }); return; }
  if (m.type === 'cancel') { jobs.forEach(j => { if (!m.id || j.id === m.id) j.cancelled = true; }); return; }
};
