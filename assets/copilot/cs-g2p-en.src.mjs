/* ---- ENGLISH PRONUNCIATION WITHOUT eSpeak (owner 2026-11-02: "Own pronunciation") ----
   The studio voice needs English text as IPA. It came from eSpeak NG (GPL) compiled to WebAssembly inside the
   phonemizer package, and the exact source of that binary could not be traced. This replaces it with our own code:
   the CMU Pronouncing Dictionary (CMU's BSD-style licence, packaged under ISC as cmu-pronouncing-dictionary) for words
   it knows, numbers spelled out, and plain letter rules for the rest. Output follows the eSpeak en-us style the voice was
   used with (stress mark before the vowel, long vowels with ː, a flapped t), using only symbols the voice knows.
   Place names marked for their own language still go through g2p-local.mjs. */
import DICT_TXT from './data/cmudict.txt';

let DICT = null;
const dict = () => { if (DICT) return DICT; DICT = new Map(); for (const line of DICT_TXT.split('\n')) { const i = line.indexOf(' '); if (i > 0) DICT.set(line.slice(0, i), line.slice(i + 1)); } return DICT; };

const VOW = { AA: 'ɑː', AE: 'æ', AH: 'ʌ', AO: 'ɔː', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɜː', EY: 'eɪ', IH: 'ɪ', IY: 'iː', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'uː' };
const CON = { B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'ɹ', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' };
const isVowel = p => /^[A-Z]{2}[0-2]$/.test(p) && VOW[p.slice(0, 2)] !== undefined;

/* ARPAbet of one word -> IPA. Stress goes right before the stressed vowel, as eSpeak writes it. */
export function arpaToIpa(arpa, lastWord) {
  const ph = arpa.trim().split(/\s+/); let out = '';
  for (let i = 0; i < ph.length; i++) { const p = ph[i];
    if (isVowel(p)) { const base = p.slice(0, 2), st = p[2];
      let v = VOW[base];
      if (st === '0') { v = base === 'AH' ? 'ə' : base === 'ER' ? 'ɚ' : base === 'IY' ? (i === ph.length - 1 ? 'i' : 'ɪ') : base === 'UW' ? 'u' : base === 'AA' ? 'ɑ' : base === 'AO' ? 'ɔ' : v; }
      if (st === '1' && base === 'ER') v = 'ɜː';
      out += (st === '1' ? 'ˈ' : st === '2' ? 'ˌ' : '') + v; continue; }
    let c = CON[p] || '';
    /* American flap: t or d between a vowel and an unstressed vowel ("better", "riding") */
    if ((p === 'T' || p === 'D') && i > 0 && i < ph.length - 1 && isVowel(ph[i - 1]) && isVowel(ph[i + 1]) && ph[i + 1][2] === '0') c = 'ɾ';
    out += c; }
  /* a one-syllable word keeps no stress mark when it is a small function word (eSpeak leaves "to", "the", "in" bare) */
  return out;
}

/* ---- numbers ---- */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function numberWords(n) { n = Math.floor(Math.abs(n));
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberWords(n % 100) : '');
  for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) if (n >= v) { const r = n % v; return numberWords(Math.floor(n / v)) + ' ' + w + (r ? ' ' + numberWords(r) : ''); }
  return String(n); }
const ORD = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
const ordinal = n => { const w = numberWords(n).split(' '); const l = w.pop(); w.push(ORD[l] || (l.endsWith('y') ? l.slice(0, -1) + 'ieth' : l + 'th')); return w.join(' '); };
export function spellNumbers(t) {
  return String(t).replace(/\b(\d+)(st|nd|rd|th)\b/gi, (m, d) => ordinal(+d))
    .replace(/\b(1[1-9]|20)(\d\d)\b(?=s?\b)/g, (m, a, b) => +m >= 1100 && +m <= 2099 && !/^0/.test(b) && b !== '00' ? numberWords(+a) + ' ' + (+b < 10 ? 'oh ' + numberWords(+b) : numberWords(+b)) : m)
    .replace(/\d+/g, d => d.length > 9 ? d.split('').map(x => ONES[+x]).join(' ') : numberWords(+d)); }

/* ---- words the dictionary does not know: letters by plain English rules ---- */
const RULES = [ // longest first; [pattern, ipa]
  ['tion', 'ʃən'], ['sion', 'ʒən'], ['ough', 'ʌf'], ['augh', 'ɔː'], ['eigh', 'eɪ'], ['igh', 'aɪ'], ['tch', 'tʃ'], ['sch', 'ʃ'], ['dge', 'dʒ'],
  ['ch', 'tʃ'], ['sh', 'ʃ'], ['th', 'θ'], ['ph', 'f'], ['wh', 'w'], ['ck', 'k'], ['ng', 'ŋ'], ['qu', 'kw'], ['gh', 'ɡ'],
  ['ee', 'iː'], ['ea', 'iː'], ['oo', 'uː'], ['ou', 'aʊ'], ['ow', 'oʊ'], ['oa', 'oʊ'], ['ai', 'eɪ'], ['ay', 'eɪ'], ['ei', 'aɪ'], ['ey', 'eɪ'], ['ie', 'iː'], ['oi', 'ɔɪ'], ['oy', 'ɔɪ'], ['au', 'ɔː'], ['aw', 'ɔː'], ['ew', 'uː'], ['ue', 'uː'],
  ['ar', 'ɑːɹ'], ['or', 'ɔːɹ'], ['er', 'ɚ'], ['ir', 'ɜː'], ['ur', 'ɜː'],
  ['a', 'æ'], ['e', 'ɛ'], ['i', 'ɪ'], ['o', 'ɑ'], ['u', 'ʌ'], ['y', 'i'],
  ['b', 'b'], ['c', 'k'], ['d', 'd'], ['f', 'f'], ['g', 'ɡ'], ['h', 'h'], ['j', 'dʒ'], ['k', 'k'], ['l', 'l'], ['m', 'm'], ['n', 'n'], ['p', 'p'], ['r', 'ɹ'], ['s', 's'], ['t', 't'], ['v', 'v'], ['w', 'w'], ['x', 'ks'], ['z', 'z'],
  ['ä', 'ɛ'], ['ö', 'ɜː'], ['ü', 'uː'], ['é', 'eɪ'], ['è', 'ɛ'], ['à', 'ɑː'], ['ô', 'oʊ'], ['ß', 's'], ['ç', 's'], ['ñ', 'nj'],
];
const VOWEL_IPA = /^(iː|uː|ɑː|ɔː|ɜː|aɪ|aʊ|eɪ|oʊ|ɔɪ|æ|ɛ|ɪ|ɑ|ʌ|ɚ|i|ə)/;
export function letterRules(w) { w = w.toLowerCase().replace(/[^a-zäöüéèàôßçñ]/g, '');
  if (!w) return ''; if (w.length > 2 && w.endsWith('e') && !/[aeiou]e$/.test(w)) w = w.slice(0, -1);   /* silent final e */
  let out = '', i = 0; while (i < w.length) { let hit = false;
    for (const [g, p] of RULES) if (w.startsWith(g, i)) { out += p; i += g.length; hit = true; break; }
    if (!hit) i++; }
  /* stress the first vowel */
  const m = out.search(/iː|uː|ɑː|ɔː|ɜː|aɪ|aʊ|eɪ|oʊ|ɔɪ|æ|ɛ|ɪ|ɑ|ʌ|ɚ/); return m >= 0 ? out.slice(0, m) + 'ˈ' + out.slice(m) : out; }
void VOWEL_IPA;

const SMALL = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'and', 'or', 'for', 'by', 'it', 'is', 'as', 'be', 'from', 'with', 'your', 'you']);
/* one word -> IPA */
/* British spellings the American dictionary lists the other way round */
const UK = { kilometre: 'kilometer', kilometres: 'kilometers', metre: 'meter', metres: 'meters', centre: 'center', centres: 'centers', litre: 'liter', litres: 'liters', colour: 'color', tyre: 'tire', tyres: 'tires', motorway: 'motor way', motorways: 'motor ways' };
export function wordIpa(word) {
  const d = dict(); let w = word.toLowerCase().replace(/[’']/g, "'");
  if (!w) return '';
  if (UK[w]) return UK[w].split(' ').map(x => wordIpa(x)).join('');
  /* an acronym or a road sign (GPS, CH, A9): its letters, as eSpeak says them */
  if (/^[A-Z]{2,4}$/.test(word)) return word.split('').map(c => arpaToIpa(d.get(c.toLowerCase()) || '')).join('');
  if (d.has(w)) { const ipa = arpaToIpa(d.get(w)); return SMALL.has(w) ? ipa.replace(/[ˈˌ]/g, '') : ipa; }
  /* possessive and plural of a known word */
  const base = w.replace(/'s$/, '').replace(/s'$/, 's');
  if (base !== w && d.has(base)) return arpaToIpa(d.get(base)) + (/[sʃʒz]$/.test(arpaToIpa(d.get(base)).replace(/[ˈˌ]/g, '')) ? 'ɪz' : /[ptkfθ]$/.test(arpaToIpa(d.get(base))) ? 's' : 'z');
  /* a compound of two known words ("Seeroad", "lakeshore") */
  for (let k = w.length - 3; k >= 3; k--) { const a = w.slice(0, k), b = w.slice(k); if (d.has(a) && d.has(b)) return arpaToIpa(d.get(a)) + arpaToIpa(d.get(b)).replace(/ˈ/g, 'ˌ'); }
  return letterRules(w);
}
/* a phrase (no punctuation) -> IPA, words separated by spaces as eSpeak returns them */
export function phonemizeEn(text) {
  const t = spellNumbers(String(text).replace(/(\d)\s*%/g, '$1 percent').replace(/[-–]/g, ' '));
  return t.split(/\s+/).filter(Boolean).map(x => wordIpa(x.replace(/^[^A-Za-z0-9äöüéèàôßçñ']+|[^A-Za-z0-9äöüéèàôßçñ']+$/g, ''))).filter(Boolean).join(' ');
}
/* for the checks: is this word answered by the dictionary (directly, as a British spelling, a possessive or a compound)? */
export function inDictionary(word) { const d = dict(), w = String(word).toLowerCase(); if (d.has(w) || UK[w] || d.has(w.replace(/'s$/, ''))) return true;
  for (let k = w.length - 3; k >= 3; k--) if (d.has(w.slice(0, k)) && d.has(w.slice(k))) return true; return false; }
