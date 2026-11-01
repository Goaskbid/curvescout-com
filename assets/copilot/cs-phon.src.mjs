/* ---- NAMES SAID THE WAY THEY ARE SAID THERE (owner 2026-11-01: "we need phonetic wording across all languages for roads
 * and waypoints, especially in Wingman") ----
 * Every road, place, stop and sight a rider hears is marked with the language of the place it is in (mark() in
 * i18n.mjs). The voice then says it like a local:
 *   1. when the phone has a voice in that language, the name is spoken in it (speakDevice in nav.mjs);
 *   2. when it does not, the name is respelled here for the voice that is speaking, so an English voice says
 *      "Sihlseestrasse" as "Seel-zay-shtrahsse" rather than "Sill-see-strass".
 * The respelling is only ever spoken; every screen shows the real name. Rules are deliberately few and certain: the
 * sounds a foreign voice gets wrong most often (German sch/st/sp/ei/ie/z/w/v and umlauts, French silent endings and
 * ou/oi/au, Italian c/g before e and i, gli and gn, Spanish j/ll/ñ, Dutch ij/ui/oe/g, Portuguese lh/nh/ão).
 * Road abbreviations are written out in the place's own language first (Str. -> Strasse, Av. -> Avenida). */

/* the language of a country, with the regions where another one is spoken */
const CC_LANG = { de: 'de', at: 'de', li: 'de', fr: 'fr', mc: 'fr', lu: 'fr', it: 'it', sm: 'it', va: 'it', es: 'es', ad: 'ca', pt: 'pt', br: 'pt',
  nl: 'nl', gb: 'en', ie: 'en', us: 'en', au: 'en', nz: 'en', za: 'en', mx: 'es', ar: 'es', cl: 'es', co: 'es', pe: 'es', ec: 'es', bo: 'es', uy: 'es',
  py: 'es', cr: 'es', pa: 'es', gt: 'es', hn: 'es', ni: 'es', sv: 'es', do: 'es', cu: 'es', se: 'sv', no: 'no', dk: 'da', fi: 'fi', is: 'is', pl: 'pl',
  cz: 'cs', sk: 'sk', si: 'sl', hr: 'hr', ba: 'hr', rs: 'sr', me: 'sr', hu: 'hu', ro: 'ro', bg: 'bg', gr: 'el', cy: 'el', tr: 'tr', ee: 'et', lv: 'lv',
  lt: 'lt', ua: 'uk', ru: 'ru', jp: 'ja', kr: 'ko', cn: 'zh', tw: 'zh', th: 'th', vn: 'vi', id: 'id', my: 'ms', ma: 'fr', tn: 'fr', ge: 'ka', am: 'hy', al: 'sq', mk: 'mk' };
export function langOfPlace(cc, lat, lon) { cc = String(cc || '').toLowerCase();
  if (cc === 'ch') { if (lat < 46.55 && lon > 8.35) return 'it'; if (lon < 7.25 || (lon < 7.6 && lat < 46.45)) return 'fr'; return 'de'; }
  if (cc === 'it' && lat > 46.2 && lat < 47.1 && lon > 10.38 && lon < 12.48) return 'de';   /* South Tyrol: German names first */
  if (cc === 'be') return lat < 50.75 ? 'fr' : 'nl';
  if (cc === 'ca') return lon > -79.8 && lon < -57 && lat > 44.9 && lat < 62 ? 'fr' : 'en';  /* Quebec */
  if (cc === 'es' && lon > 0.15 && lat > 40.5) return 'ca';                                 /* Catalonia: Catalan names */
  return CC_LANG[cc] || ''; }

/* road words written in full before they are said */
const ABBR = {
  de: [[/\bStr\.\s?/g, 'Strasse '], [/str\.(\s|$)/g, 'strasse$1'], [/\bSt\.\s/g, 'Sankt '], [/\bPl\.\s?/g, 'Platz ']],
  fr: [[/\bAv\.\s?/g, 'Avenue '], [/\bBd\.?\s/g, 'Boulevard '], [/\bRte\.?\s/g, 'Route '], [/\bSt-/g, 'Saint-'], [/\bSte-/g, 'Sainte-'], [/\bChem\.\s?/g, 'Chemin ']],
  it: [[/\bV\.\s?/g, 'Via '], [/\bP\.zza\s?/g, 'Piazza '], [/\bS\.S\.\s?/g, 'Strada statale ']],
  es: [[/\bAv(da)?\.\s?/g, 'Avenida '], [/\bC\/\s?/g, 'Calle '], [/\bCtra\.\s?/g, 'Carretera ']],
  pt: [[/\bAv\.\s?/g, 'Avenida '], [/\bR\.\s/g, 'Rua ']],
  nl: [[/\bstr\.(\s|$)/g, 'straat$1']],
};
/* sound rules: [from-language][voice-language] -> [pattern, replacement] in order. Applied to lower case, then the first
   letter of each word is capitalised again. */
const W = '(?=[a-zäöüàâçéèêëîïôûùœ])';
const R = {
  de: {
    en: [[/(?<=[a-z])see/g, 'ZAY'], [/stra(ss|ß)e/g, 'SHTRAHSSE'], [/sch/g, 'SH'], [/\bst/g, 'SHT'], [/\bsp/g, 'SHP'], [/(eu|äu)/g, 'OY'], [/ei/g, 'EYE'], [/(ie|ih)/g, 'EE'], [/au/g, 'OW'], [/ch/g, 'KH'], [/z/g, 'TS'], [/\bv/g, 'F'], [/w/g, 'V'], [/\bj/g, 'Y'], [/ü/g, 'EW'], [/ö/g, 'ER'], [/ä/g, 'EH'], [/u/g, 'OO'], [/ß/g, 'SS']],
    fr: [[/(?<=[a-z])see/g, 'ZÉ'], [/stra(ss|ß)e/g, 'CHTRASSE'], [/sch/g, 'CH'], [/\bst/g, 'CHT'], [/\bsp/g, 'CHP'], [/(eu|äu)/g, 'OÏ'], [/ei/g, 'AÏ'], [/(ie|ih)/g, 'I'], [/u(?![eiü])/g, 'OU'], [/ü/g, 'U'], [/ö/g, 'EU'], [/ä/g, 'È'], [/z/g, 'TS'], [/\bv/g, 'F'], [/w/g, 'V'], [/\bj/g, 'Y'], [/ß/g, 'SS'], [/zé/gi, 'ZÉ']],
  },
  fr: {
    /* silent endings first, while the vowels before them are still plain letters */
    en: [[/\bles\b/g, 'LAY'], [/\bdes\b/g, 'DAY'], [/\bde\b/g, 'DUH'], [/\bdu\b/g, 'DEW'], [/\ble\b/g, 'LUH'], [/\bl'/g, 'L'], [/ets?\b/g, 'AY'], [/eaux?\b/g, 'OH'], [/ier\b/g, 'YAY'], [/\b(s|ss)aint/g, 'SAN'], [/ain\b/g, 'AN'],
      [/([aeiouy]n)[tcdgs]\b/g, '$1'], [/([aeiouy][rl]?)[sxtd]\b/g, '$1'], [/([^aeiouy\s])e\b/g, '$1'],
      [/au/g, 'OH'], [/oi/g, 'WAH'], [/ou/g, 'OO'], [/ç/g, 'S'], [/[éèê]/g, 'AY'], [/[âà]/g, 'A'], [/[ôö]/g, 'O'], [/[îï]/g, 'EE'], [/[ûù]/g, 'OO'], [/gn/g, 'NY'], [/ch/g, 'SH'], [/\bj/g, 'ZH'], [/qu/g, 'K']],
    de: [[/\bles\b/g, 'LÄ'], [/\bdes\b/g, 'DÄ'], [/\bde\b/g, 'DÖ'], [/\bdu\b/g, 'DÜ'], [/ets?\b/g, 'Ä'], [/eaux?\b/g, 'O'], [/ier\b/g, 'IE'], [/\b(s|ss)aint/g, 'SÄNG'], [/ain\b/g, 'ÄNG'],
      [/([aeiouy]n)[tcdgs]\b/g, '$1'], [/([aeiouy][rl]?)[sxtd]\b/g, '$1'],
      [/au/g, 'O'], [/oi/g, 'OA'], [/ou/g, '@'], [/u/g, 'Ü'], [/@/g, 'U'], [/ç/g, 'S'], [/[éèê]/g, 'E'], [/ch/g, 'SCH'], [/\bj/g, 'SCH'], [/qu/g, 'K']],
  },
  it: {
    en: [[/gli/g, 'LYEE'], [/gn/g, 'NY'], [/sc(?=[ei])/g, 'SH'], [/ch(?=[ei])/g, 'K'], [/c(?=[ei])/g, 'CH'], [/gh(?=[ei])/g, 'G'], [/g(?=[ei])/g, 'J'], [/zz?/g, 'TS'], [/e\b/g, 'EH']],
    de: [[/gli/g, 'LJI'], [/gn/g, 'NJ'], [/sc(?=[ei])/g, 'SCH'], [/ch(?=[ei])/g, 'K'], [/c(?=[ei])/g, 'TSCH'], [/gh(?=[ei])/g, 'G'], [/g(?=[ei])/g, 'DSCH'], [/v/g, 'W'], [/qu/g, 'KW']],
    fr: [[/gli/g, 'LI'], [/sc(?=[ei])/g, 'CH'], [/ch(?=[ei])/g, 'K'], [/c(?=[ei])/g, 'TCH'], [/gh(?=[ei])/g, 'GU'], [/g(?=[ei])/g, 'DJ'], [/u/g, 'OU'], [/zz?/g, 'DZ'], [/e\b/g, 'É']],
  },
  es: {
    en: [[/ll/g, 'Y'], [/ñ/g, 'NY'], [/j/g, 'H'], [/g(?=[ei])/g, 'H'], [/c(?=[ei])/g, 'S'], [/qu/g, 'K'], [/\bh/g, ''], [/z/g, 'S'], [/[áà]/g, 'A'], [/[éè]/g, 'E'], [/í/g, 'EE'], [/ó/g, 'O'], [/ú/g, 'OO']],
    de: [[/ll/g, 'J'], [/ñ/g, 'NJ'], [/j/g, 'CH'], [/g(?=[ei])/g, 'CH'], [/c(?=[ei])/g, 'SS'], [/qu/g, 'K'], [/\bh/g, ''], [/z/g, 'S'], [/[áéíóú]/g, m => 'aeiou'['áéíóú'.indexOf(m)]]],
    fr: [[/ll/g, 'Y'], [/ñ/g, 'GN'], [/j/g, 'KH'], [/g(?=[ei])/g, 'KH'], [/c(?=[ei])/g, 'S'], [/qu/g, 'K'], [/\bh/g, ''], [/z/g, 'S'], [/u/g, 'OU'], [/[áéíóú]/g, m => 'aéiou'['áéíóú'.indexOf(m)]]],
  },
  nl: {
    en: [[/ij/g, 'EYE'], [/ui/g, 'OW'], [/oe/g, 'OO'], [/sch/g, 'SKH'], [/aa/g, 'AH'], [/\bg/g, 'KH'], [/\bw/g, 'V'], [/\bj/g, 'Y']],
    de: [[/ij/g, 'EI'], [/ui/g, 'ÄU'], [/oe/g, 'U'], [/\bg/g, 'CH'], [/aa/g, 'A']],
    fr: [[/ij/g, 'AÏ'], [/ui/g, 'EU'], [/oe/g, 'OU'], [/sch/g, 'SKH'], [/\bg/g, 'KH'], [/\bw/g, 'V'], [/\bj/g, 'Y'], [/u/g, 'U']],
  },
  pt: {
    en: [[/ão/g, 'OWNG'], [/õe/g, 'OYNG'], [/lh/g, 'LY'], [/nh/g, 'NY'], [/ç/g, 'S'], [/\bx/g, 'SH'], [/[áâã]/g, 'A'], [/[éê]/g, 'E'], [/í/g, 'EE'], [/[óô]/g, 'O'], [/ú/g, 'OO']],
    de: [[/ão/g, 'AUNG'], [/lh/g, 'LJ'], [/nh/g, 'NJ'], [/ç/g, 'S'], [/\bx/g, 'SCH'], [/[áâã]/g, 'A'], [/[éê]/g, 'E'], [/[óô]/g, 'O']],
    fr: [[/ão/g, 'AON'], [/lh/g, 'LI'], [/ç/g, 'S'], [/\bx/g, 'CH'], [/u/g, 'OU']],
  },
  ca: { en: [[/ll/g, 'LY'], [/ny/g, 'NY'], [/\bx/g, 'SH'], [/ç/g, 'S'], [/j/g, 'ZH']], de: [[/ll/g, 'LJ'], [/\bx/g, 'SCH'], [/ç/g, 'S']], fr: [[/ll/g, 'LI'], [/ny/g, 'GN'], [/\bx/g, 'CH'], [/u/g, 'OU']] },
};
void W;
const cap = s => s.replace(/(^|[\s\-'’(])([a-zäöüàâçéèêëîïôûùœñ])/g, (m, a, b) => a + b.toUpperCase());
/* what a voice of language `voice` should be given to say `name`, a name from language `from` */
export function respell(name, from, voice) { name = String(name || ''); if (!name || !from || !voice || from === voice) return name;
  let s = name; for (const [re, to] of (ABBR[from] || [])) s = s.replace(re, to);
  const rules = R[from] && R[from][voice]; if (!rules) return s;
  /* road numbers (A13, SS38, D902) are kept as they are: voices read letters and digits well */
  return s.split(/(\b[A-Z]{1,3}\s?\d+[a-z]?\b)/).map((part, i) => { if (i % 2) return part; let t = part.toLowerCase(); for (const [re, to] of rules) t = t.replace(re, to); return cap(t.toLowerCase()); }).join('');
}
/* the voices a phone has for one language, best first; a robot voice never counts */
export function voiceFor(voices, lang) { const v = (voices || []).filter(x => (x.lang || '').slice(0, 2).toLowerCase() === lang && !/compact|espeak|robot|novelty|zarvox|whisper|trinoids|bells/i.test(x.name || ''));
  const sc = x => (/natural|neural/i.test(x.name) ? 60 : 0) + (/premium|enhanced|siri/i.test(x.name) ? 45 : 0) + (/google/i.test(x.name) ? 30 : 0) + (/online/i.test(x.name) ? 20 : 0) + (x.localService ? 3 : 0);
  return v.sort((a, b) => sc(b) - sc(a))[0] || null; }
/* a marked sentence cut into what the main voice says and what a local voice says */
export function parts(text) { const out = []; const re = /⟦([^|⟧]*)\|([a-z]*)⟧/g; let i = 0, m;
  while ((m = re.exec(text))) { if (m.index > i) out.push({ t: text.slice(i, m.index), lang: '' }); out.push({ t: m[1], lang: m[2] }); i = re.lastIndex; }
  if (i < text.length) out.push({ t: text.slice(i), lang: '' }); return out; }
