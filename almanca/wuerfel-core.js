// "Würfeln und konjugieren" lövhə oyunu — UI-sız hissə (ayrıca test edilir).
// 1-ci zər → şəxs (1 = ich … 6 = sie/Sie), 2-ci zər → neçə xana irəli. Xanadakı feli şəxsə görə yaz.
// Hər yeni oyunda lövhəyə kitabın A1.1 fellərindən (wuerfel-verbs.js) 16 fel düşür: qaydalı, qaydasız, ayrılan.

import { ALL_VERBS } from './wuerfel-verbs.js';

export const VERBS = ALL_VERBS;

// Lövhə: 0 = START/ZIEL, 1–19 xanalar, 20 = ZIEL (bir dövrə). Fel xanaları oyuna görə dəyişir.
export const GOAL = 20;
export const BOARD = [
  { t: 'start' },
  { t: 'verb' }, { t: 'verb' }, { t: 'verb' }, { t: 'verb' },
  { t: 'joker' },
  { t: 'verb' }, { t: 'verb' }, { t: 'verb' }, { t: 'verb' },
  { t: 'again' },
  { t: 'verb' }, { t: 'verb' }, { t: 'verb' }, { t: 'verb' },
  { t: 'pause' },
  { t: 'verb' }, { t: 'verb' }, { t: 'verb' }, { t: 'verb' },
];
export const VERB_CELLS = BOARD.map((c, i) => (c.t === 'verb' ? i : -1)).filter((i) => i >= 0); // 16 xana
// Kitabdakı vərəqin felləri (köhnə yadda saxlanmış oyunlar üçün)
export const SHEET_VERBS = ['heißen', 'hören', 'lernen', 'spielen', 'arbeiten', 'sprechen', 'trinken', 'wohnen', 'nehmen', 'kommen', 'geben', 'bestellen', 'leben', 'fragen', 'antworten', 'arbeiten'];
/** i-ci xanadakı fel (verbs: oyunun 16 feli) */
export const verbAt = (verbs, i) => verbs[VERB_CELLS.indexOf(i)];

// Zər → şəxs. 3 və 6-da bir neçə əvəzlik düzdür.
export const PERSONS = [
  { die: 1, label: 'ich', ok: ['ich'], az: 'mən' },
  { die: 2, label: 'du', ok: ['du'], az: 'sən' },
  { die: 3, label: 'er / sie / es', ok: ['er', 'sie', 'es'], az: 'o' },
  { die: 4, label: 'wir', ok: ['wir'], az: 'biz' },
  { die: 5, label: 'ihr', ok: ['ihr'], az: 'siz (dostlar)' },
  { die: 6, label: 'sie / Sie', ok: ['sie'], az: 'onlar / Siz' },
];

export const kindOf = (verb) => (VERBS[verb].sep ? 'sep' : VERBS[verb].irr ? 'irr' : 'reg');
export const formOf = (verb, die) => VERBS[verb].f[die - 1];
/** Nümunə düzgün cavab: "wir wohnen", "ich stehe auf" */
export const answerOf = (verb, die) => `${PERSONS[die - 1].ok[0]} ${formOf(verb, die)}`;

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[.,!?;:"„“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const fold = (s) => norm(s).replace(/ä|ae/g, 'a').replace(/ö|oe/g, 'o').replace(/ü|ue/g, 'u');

/**
 * Cavabı yoxla: əvəzlik + fel (cümlənin qalanı ola bilər: "wir wohnen in Baku", "ich stehe um 7 Uhr auf").
 * @returns {{ ok: boolean, why?: 'pron'|'form'|'noPron'|'empty'|'sep', note?: 'uml' }}
 */
export function checkAnswer(input, verb, die) {
  const words = norm(input).split(' ').filter(Boolean);
  if (!words.length) return { ok: false, why: 'empty' };
  const V = VERBS[verb];
  const P = PERSONS[die - 1];
  const sep = V.sep || '';
  const forms = [formOf(verb, die), ...((V.alt && V.alt[die - 1]) || []).map((x) => (sep ? `${x} ${sep}` : x))];
  const stems = forms.map((f) => (sep ? f.slice(0, -(sep.length + 1)) : f));
  // yalnız fel yazılıbsa
  if (words.length === 1 || (sep && words.length === 2 && fold(words[1]) === fold(sep))) {
    return { ok: false, why: stems.some((s) => fold(s) === fold(words[0])) ? 'noPron' : 'form' };
  }
  // sual forması da olar: "wohnst du …"
  let w = words;
  if (!P.ok.includes(w[0]) && P.ok.includes(w[1])) w = [w[1], w[0], ...w.slice(2)];
  if (!P.ok.includes(w[0])) return { ok: false, why: 'pron' };
  const vrb = w[1];
  // ayrılan fel bir yerdə yazılıb: "ich aufstehe"
  if (sep && fold(vrb).startsWith(fold(sep)) && stems.some((s) => fold(vrb) === fold(sep + s))) return { ok: false, why: 'sep' };
  let i = stems.findIndex((s) => norm(s) === vrb);
  let note;
  // ümlautsuz yazılış yalnız məsdərdə də ümlaut olanda bağışlanır (hören → "hoert");
  // fahren → fährt kimi kök dəyişəndə ümlaut qaydanın özüdür, ona görə yox
  const base = sep ? verb.slice(sep.length) : verb;
  if (i < 0 && /[äöü]/.test(base)) {
    i = stems.findIndex((s) => fold(s) === fold(vrb));
    if (i >= 0) note = 'uml';
  }
  if (i < 0) return { ok: false, why: 'form' };
  if (sep && fold(w[w.length - 1]) !== fold(sep)) return { ok: false, why: 'sep' };
  return note ? { ok: true, note } : { ok: true };
}

const ENDS = ['-e', '-st', '-t', '-en', '-t', '-en'];
/** Səhvin azərbaycanca izahı */
export function explain(verb, die) {
  const V = VERBS[verb];
  const f = V.f;
  const P = PERSONS[die - 1];
  const sep = V.sep || '';
  const base = sep ? verb.slice(sep.length) : verb;
  const stemOf = (x) => (sep ? x.slice(0, -(sep.length + 1)) : x);
  const parts = [`${P.label} → ${answerOf(verb, die)}.`];
  if (['sein', 'haben', 'können', 'mögen', 'möchten', 'wissen', 'tun'].includes(base)) {
    parts.push(`"${base}" xüsusi feldir, formalarını əzbərlə: ich ${stemOf(f[0])}, du ${stemOf(f[1])}, er ${stemOf(f[2])}, wir ${stemOf(f[3])}, ihr ${stemOf(f[4])}, sie ${stemOf(f[5])}.`);
  } else {
    parts.push(`Sonluq: ${P.ok[0]} ${ENDS[die - 1]}.`);
    if (V.irr && (die === 2 || die === 3)) parts.push(`"${base}" qaydasızdır — du və er/sie/es-də kök dəyişir: du ${stemOf(f[1])}, er ${stemOf(f[2])}.`);
    else if (/(t|d)en$/.test(base) || /[^lrhmn aeiouäöü][mn]en$/.test(base)) {
      if ([2, 3, 5].includes(die)) parts.push(`Kök -${base.slice(-3, -2)} ilə bitir, arada -e- gəlir: du ${stemOf(f[1])}, er ${stemOf(f[2])}.`);
    } else if (/(s|ß|z|x)en$/.test(base) && die === 2) parts.push(`Kök s-səsi ilə bitir: du ${stemOf(f[1])} (-st yox, yalnız -t).`);
  }
  if (sep) parts.push(`Ayrılan feldir: "${sep}" hissəsi cümlənin sonuna gedir: ${answerOf(verb, die)}.`);
  return `${parts.join(' ')} (${V.az})`;
}

// Müəllimin tipik səhvləri (şagird yoxlasın deyə). Heç vaxt düzgün cavab olmur.
export function wrongForm(verb, die, rnd = Math.random) {
  const V = VERBS[verb];
  const sep = V.sep || '';
  const base = sep ? verb.slice(sep.length) : verb;
  const stemOf = (x) => (sep ? x.slice(0, -(sep.length + 1)) : x);
  const f = V.f.map(stemOf);
  const right = f[die - 1];
  const stem = base.replace(/en$/, '').replace(/n$/, '');
  const cands = new Set([stem + ['t', 't', 'st', 't', 'en', 't'][die - 1], stem + ['en', 't', 'en', 't', 'st', 'e'][die - 1], ...f.filter((x) => x !== right)]);
  if (V.irr && (die === 2 || die === 3)) cands.add(stem + (die === 2 ? 'st' : 't')); // kök dəyişməyib: "du sprechst"
  const list = [...cands].filter((x) => x && x !== right && !((V.alt && V.alt[die - 1]) || []).includes(x));
  let w = list[Math.floor(rnd() * list.length)];
  if (sep) {
    // ayrılan feldə ən çox edilən səhv: bir yerdə yazmaq ("ich aufstehe")
    return rnd() < 0.5 ? sep + right : `${w} ${sep}`;
  }
  return w;
}

export const rollDie = (rnd = Math.random) => 1 + Math.floor(rnd() * 6);

/** Hərəkət: yeni mövqe (ZIEL-ə çatdısa GOAL) */
export const moveTo = (pos, steps) => Math.min(GOAL, pos + steps);

function shuffle(a, rnd) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/**
 * Yeni oyun üçün 16 fel: ~5 qaydasız, ~4 ayrılan, qalanı qaydalı. Az işlənənlər əvvəl seçilir.
 * @param {Record<string, number>} used hər felin neçə oyunda olduğu
 */
export function pickVerbs(used = {}, rnd = Math.random) {
  const all = Object.keys(VERBS);
  const by = (k) => shuffle(all.filter((v) => kindOf(v) === k), rnd).sort((a, b) => (used[a] || 0) - (used[b] || 0));
  const want = { irr: 5, sep: 4, reg: VERB_CELLS.length - 9 };
  const out = [...by('irr').slice(0, want.irr), ...by('sep').slice(0, want.sep), ...by('reg').slice(0, want.reg)];
  return shuffle(out, rnd);
}
