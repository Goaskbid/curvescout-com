/* ---- PLACE NAMES IN THEIR OWN LANGUAGE (owner 2026-10-31: "place names are shit. can we teach and ingest these in their
   phonetische Transkription") ----
   The studio voice reads English. A name like Grindelwald, Château de Chillon or Passo dello Stelvio is first written in
   IPA by the rules of its own language, and those sounds go to the voice as they are - so it says "ˈɡrɪndl̩valt", not
   "grinned-ell-wold". Rule-based and our own (no GPL dictionary); place names are regular enough for rules to work.
   Output uses only symbols the Kokoro voice knows. */
const V = 'aeiouyäöüàâéèêëîïôûùœæ';
const isV = c => !!c && V.includes(c);
/* ---- German ---- */
function deWord(w) {
  w = w.toLowerCase(); if (!w) return '';
  const pre = /^(be|ge|ver|er|zer|ent)(?=[a-zäöü]{3})/.exec(w); let out = '', i = 0, stressed = false;
  const stress = () => { if (!stressed && !(pre && i < pre[1].length)) { out += 'ˈ'; stressed = true; } };
  const at = (s) => w.startsWith(s, i);
  while (i < w.length) {
    const c = w[i], n = w[i + 1] || '', rest = w.slice(i);
    if (at('tsch')) { out += 'tʃ'; i += 4; continue; }
    if (at('sch')) { out += 'ʃ'; i += 3; continue; }
    if (i === 0 && (at('sp') || at('st'))) { out += 'ʃ' + n; i += 2; continue; }
    if (at('ch')) { const p = w[i - 1] || ''; out += i === 0 ? 'k' : /[aou]/.test(p) && !(w[i - 2] === 'e' && p === 'u') ? 'x' : 'ç'; i += 2; continue; }
    if (at('ck')) { out += 'k'; i += 2; continue; }
    if (at('ph')) { out += 'f'; i += 2; continue; }
    if (at('qu')) { out += 'kv'; i += 2; continue; }
    if (at('th')) { out += 't'; i += 2; continue; }
    if (at('tz') || c === 'z') { out += 'ts'; i += c === 'z' ? 1 : 2; continue; }
    if (at('ng')) { out += 'ŋ'; i += 2; continue; }
    if (at('nk')) { out += 'ŋk'; i += 2; continue; }
    if (at('ig') && i + 2 === w.length) { stress(); out += 'ɪç'; i += 2; continue; }
    if (at('ei') || at('ai') || at('ey') || at('ay')) { stress(); out += 'aɪ'; i += 2; continue; }
    if (at('eu') || at('äu')) { stress(); out += 'ɔɪ'; i += 2; continue; }
    if (at('au')) { stress(); out += 'aʊ'; i += 2; continue; }
    if (at('ie')) { stress(); out += 'iː'; i += 2; continue; }
    if (at('aa') || at('ah')) { stress(); out += 'aː'; i += 2; continue; }
    if (at('ee') || at('eh')) { stress(); out += 'eː'; i += 2; continue; }
    if (at('oo') || at('oh')) { stress(); out += 'oː'; i += 2; continue; }
    if (at('uh')) { stress(); out += 'uː'; i += 2; continue; }
    if (at('ih')) { stress(); out += 'iː'; i += 2; continue; }
    if (isV(c)) {
      const end = i === w.length - 1, tail = w.slice(i + 1), oneCons = /^[^aeiouyäöü][aeiouyäöü]/.test(tail) || (/^[^aeiouyäöü]$/.test(tail) && !/^[rlnmst]$/.test(tail) && w.length <= 4);
      if (c === 'e' && stressed && (end || /^(n|l|r|s|t|nd|ns|rn|rs)$/.test(tail))) { if (tail === 'r') { out += 'ɐ'; i += 2; continue; } out += 'ə'; i++; continue; }
      /* an unstressed e before l, n or r inside a compound (Grindelwald, Sustenpass) is a schwa */
      if (c === 'e' && stressed && /^[lnr][^aeiouyäöü]/.test(tail)) { out += 'ə'; i++; continue; }
      stress();
      const long = oneCons || end;
      out += ({ a: long ? 'aː' : 'a', e: long ? 'eː' : 'ɛ', i: long ? 'iː' : 'ɪ', o: long ? 'oː' : 'ɔ', u: long ? 'uː' : 'ʊ', y: 'y', ä: long ? 'ɛː' : 'ɛ', ö: long ? 'øː' : 'œ', ü: long ? 'yː' : 'y' })[c] || c; i++; continue; }
    if (c === 'r') { const p = w[i - 1] || ''; out += isV(p) && !isV(n) ? 'ɐ' : 'ʁ'; i++; continue; }
    if (c === 's') { out += (i === 0 || isV(w[i - 1])) && isV(n) ? 'z' : 's'; i += n === 's' ? 2 : 1; continue; }
    if (c === 'ß') { out += 's'; i++; continue; }
    if (c === 'v') { out += 'f'; i++; continue; }
    if (c === 'w') { out += 'v'; i++; continue; }
    if (c === 'j') { out += 'j'; i++; continue; }
    if (c === 'h') { if (i === 0 || !isV(w[i - 1])) out += 'h'; i++; continue; }
    if (c === 'c') { out += 'k'; i++; continue; }
    if (c === 'g') { out += i === w.length - 1 ? 'k' : 'ɡ'; i++; continue; }
    if (c === 'd') { out += i === w.length - 1 ? 't' : 'd'; i++; continue; }
    if (c === 'b') { out += i === w.length - 1 ? 'p' : 'b'; i++; continue; }
    if (c === n && !isV(c)) { i++; continue; }   /* doubled consonant: one sound */
    if (c === 'x') { out += 'ks'; i++; continue; }
    out += /[a-z]/.test(c) ? c : ''; i++;
  }
  return out;
}
/* ---- Italian ---- */
function itWord(w) {
  w = w.toLowerCase(); let out = '', i = 0;
  /* i before another vowel is a glide (Stelvio, Lombardia is the exception with its accent written) */
  const glide = k => w[k] === 'i' && !!w[k + 1] && 'aeiou'.includes(w[k + 1]) && k > 0;
  const vows = []; for (let k = 0; k < w.length; k++) if ('aeiouàèéìòù'.includes(w[k]) && !glide(k)) vows.push(k);
  const acc = [...w].findIndex(ch => 'àèéìòù'.includes(ch)); const sv = acc >= 0 ? acc : vows.length >= 2 ? vows[vows.length - 2] : vows[0];
  while (i < w.length) { const c = w[i], n = w[i + 1] || '', n2 = w[i + 2] || '';
    if (i === sv) out += 'ˈ';
    if (c === 'g' && n === 'l' && n2 === 'i') { out += 'ʎ'; i += 'aeiou'.includes(w[i + 3] || '') ? 3 : 2; continue; }
    if (c === 'g' && n === 'n') { out += 'ɲ'; i += 2; continue; }
    if (c === 's' && n === 'c' && /[eièé]/.test(n2)) { out += 'ʃ'; i += n2 === 'i' && 'aou'.includes(w[i + 3] || '') ? 3 : 2; continue; }
    if (c === 'c' && n === 'h') { out += 'k'; i += 2; continue; } if (c === 'g' && n === 'h') { out += 'ɡ'; i += 2; continue; }
    if (c === 'c' && /[eièé]/.test(n)) { out += 'tʃ'; i += n === 'i' && 'aou'.includes(n2) ? 2 : 1; continue; }
    if (c === 'g' && /[eièé]/.test(n)) { out += 'dʒ'; i += n === 'i' && 'aou'.includes(n2) ? 2 : 1; continue; }
    if (c === 'q' && n === 'u') { out += 'kw'; i += 2; continue; }
    if (c === 'z') { out += 'ts'; i += n === 'z' ? 2 : 1; continue; }
    if (c === 'h') { i++; continue; }
    if (c === n && !'aeiou'.includes(c)) { i++; continue; }   /* doubled consonant: said once */
    if (glide(i) && !/[cg]/.test(w[i - 1] || '')) { out += 'j'; i++; continue; }
    out += ({ 'à': 'a', 'è': 'ɛ', 'é': 'e', 'ì': 'i', 'ò': 'ɔ', 'ù': 'u', c: 'k', g: 'ɡ', r: 'r', s: 's' })[c] || (/[a-z]/.test(c) ? c : ''); i++; }
  return out;
}
/* ---- French ---- */
function frWord(w, next) {
  w = w.toLowerCase(); let out = '', i = 0;
  while (i < w.length) { const c = w[i], n = w[i + 1] || '', rest = w.slice(i), last = i === w.length - 1;
    const nasal = (re, ph) => { const m = rest.match(re); if (m && !isV(rest[m[0].length]) && rest[m[0].length] !== m[0].slice(-1)) { out += ph; i += m[0].length; return true; } return false; };
    if (rest.startsWith('eau')) { out += 'o'; i += 3; continue; }
    if (rest.startsWith('au')) { out += 'o'; i += 2; continue; }
    if (rest.startsWith('ou')) { out += 'u'; i += 2; continue; }
    if (rest.startsWith('oi')) { out += 'wa'; i += 2; continue; }
    if (nasal(/^(ain|ein|in|im|yn)/, 'ɛ̃') || nasal(/^(an|am|en|em)/, 'ɑ̃') || nasal(/^(on|om)/, 'ɔ̃') || nasal(/^un/, 'œ̃')) continue;
    if (rest.startsWith('ai') || rest.startsWith('ei')) { out += 'ɛ'; i += 2; continue; }
    if (rest.startsWith('eu') || rest.startsWith('œu')) { out += 'ø'; i += 2; continue; }
    if (rest.startsWith('ill') && i > 0 && isV(w[i - 1])) { out += 'j'; i += 3; continue; }
    if (rest.startsWith('ille')) { out += 'ij'; i += 4; continue; }
    if (rest.startsWith('ch')) { out += 'ʃ'; i += 2; continue; }
    if (rest.startsWith('gn')) { out += 'ɲ'; i += 2; continue; }
    if (rest.startsWith('qu')) { out += 'k'; i += 2; continue; }
    if (rest.startsWith('ph')) { out += 'f'; i += 2; continue; }
    if (rest.startsWith('th')) { out += 't'; i += 2; continue; }
    if ((rest === 'er' || rest === 'ez') && w.length > 2) { out += 'e'; i += 2; continue; }
    if (rest === 'et') { out += 'ɛ'; i += 2; continue; }
    if (rest === 'es' && w.length > 3) { i += 2; continue; }
    if (last && /[stdxzp]/.test(c)) { i++; continue; }
    if (last && c === 'e' && w.length > 2) { i++; continue; }
    if (c === 'c') { out += /[eiyéèê]/.test(n) ? 's' : 'k'; i++; continue; } if (c === 'ç') { out += 's'; i++; continue; }
    if (c === 'g') { out += /[eiyéèê]/.test(n) ? 'ʒ' : 'ɡ'; i++; continue; } if (c === 'j') { out += 'ʒ'; i++; continue; }
    if (c === 'h') { i++; continue; } if (c === 'r') { out += 'ʁ'; i++; continue; }
    if (c === 's') { out += isV(w[i - 1]) && isV(n) ? 'z' : 's'; i += n === 's' ? 2 : 1; continue; }
    if (c === n && !isV(c)) { i++; continue; }
    if (c === 'x') { out += 'ks'; i++; continue; }
    out += ({ 'é': 'e', 'è': 'ɛ', 'ê': 'ɛ', 'ë': 'ɛ', 'à': 'a', 'â': 'ɑ', 'î': 'i', 'ï': 'i', 'ô': 'o', 'û': 'y', 'ù': 'y', u: 'y', e: 'ə', y: 'i' })[c] || (/[a-z]/.test(c) ? c : ''); i++; }
  /* the last syllable carries the weight in French */
  const k = out.search(/[aeiouyɛɔøœɑə][̃]?[^aeiouyɛɔøœɑə]*$/); return k > 0 ? out.slice(0, k) + 'ˈ' + out.slice(k) : out;
}
const FN = { de: deWord, it: itWord, fr: frWord };
export function localIPA(name, lang) { const f = FN[lang]; if (!f) return null;
  return String(name).split(/([\s\-–'’]+)/).map((p, k, arr) => /^[\s\-–'’]+$/.test(p) ? ' ' : (/\d/.test(p) ? null : f(p, arr[k + 2]))).filter(x => x !== null).join('').replace(/\s+/g, ' ').trim(); }
