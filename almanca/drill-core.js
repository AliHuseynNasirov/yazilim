// Fel dərsinin məntiqi (UI-sız, ayrıca test edilə bilər):
// şəxslər, sualların qurulması, cavabın yoxlanması.

import { normWord } from './checker.js';

// Şəxslər. q = sual hansı şəxslə verilir (cavab isə bu şəxslə olmalıdır)
export const PERSONS = {
  ich: { pron: 'ich', slot: 0, q: 'du', az: 'ich (mən)', ending: "'ich' ilə fel -e ilə bitir" },
  du: { pron: 'du', slot: 1, q: 'ich', az: 'du (sən)', ending: "'du' ilə fel -st ilə bitir" },
  er: { pron: 'er', slot: 2, q: 'er', az: 'er (o — kişi)', ending: "'er' ilə fel -t ilə bitir" },
  sie_sg: { pron: 'sie', slot: 2, q: 'sie_sg', az: 'sie (o — qadın)', ending: "'sie' (o) ilə fel -t ilə bitir" },
  wir: { pron: 'wir', slot: 3, q: 'ihr', az: 'wir (biz)', ending: "'wir' ilə fel -en ilə bitir" },
  ihr: { pron: 'ihr', slot: 4, q: 'wir', az: 'ihr (siz)', ending: "'ihr' ilə fel -t ilə bitir" },
  sie_pl: { pron: 'sie', slot: 5, q: 'sie_pl', az: 'sie (onlar)', ending: "'sie' (onlar) ilə fel -en ilə bitir" },
};

const PRONOUNS = ['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const STEPS = 7; // 0: təsrif, 1-3: W-Frage, 4-6: Satzfrage
export const stepKind = (step) => (step === 0 ? 'conj' : step <= 3 ? 'w' : 's');

export function formOf(v, personKey) {
  return v.forms[PERSONS[personKey].slot];
}

// Şablon: {vq}/{Vq} sual felinin forması, {pq} sual əvəzliyi, {PA}/{pa} cavab əvəzliyi, {va} cavab feli
function render(tpl, v, personKey) {
  const P = PERSONS[personKey];
  const Q = PERSONS[P.q];
  const vq = formOf(v, P.q);
  return tpl
    .replace('{Vq}', cap(vq))
    .replace('{vq}', vq)
    .replace('{pq}', Q.pron)
    .replace('{PA}', cap(P.pron))
    .replace('{pa}', P.pron)
    .replace('{va}', formOf(v, personKey));
}

/** Addımın məzmunu: sual / tapşırıq və nümunə düzgün cavab */
export function stepContent(v, step) {
  const kind = stepKind(step);
  const P = PERSONS[v.person];
  if (kind === 'conj') {
    return {
      kind,
      question: null,
      // daxildə « » — müəllimə verilən təlimatda dırnaq içində dırnaq olmasın (model çaşıb təkrarlayırdı)
      taskAz: `İndi «${v.inf}» felini «${P.pron}» ilə de.`,
      example: `${P.pron} ${formOf(v, v.person)}`,
    };
  }
  const item = kind === 'w' ? v.w[step - 1] : v.s[step - 4];
  return { kind, question: render(item.q, v, v.person), example: render(item.a, v, v.person) };
}

// Bu felin forması sayıla biləcək söz (səhv sonluqlu da): lern, lerne, lernt, lernet…
function verbToken(n, v) {
  const forms = v.forms.map(normWord);
  if (forms.includes(n)) return true;
  const stem = normWord(v.inf).replace(/e?n$/, '');
  const stems = [stem, ...(v.irregular || []).map(normWord)];
  return stems.some((st) => new RegExp(`^${st}(e|st|t|en|et|est|n)?$`).test(n));
}

/**
 * Cavabı yoxla.
 * @returns {{ok:true} | {ok:false, az:string, en:string}}
 */
export function checkAnswer(text, v, step) {
  const kind = stepKind(step);
  const P = PERSONS[v.person];
  const want = formOf(v, v.person);
  const ex = stepContent(v, step).example;
  const fail = (az, en) => ({ ok: false, az, en });

  let toks = (String(text || '').match(/\p{L}+/gu) || []).map((t) => t.toLowerCase());
  if (!toks.length) return fail('Cavab eşidilmədi. Yenidən de.', 'no answer was heard');

  if (kind === 's') {
    if (toks[0] !== 'ja' && toks[0] !== 'nein') {
      return fail(`Bəli/xeyr sualına "Ja" və ya "Nein" ilə başla: "${ex}"`, 'a yes/no question must be answered with "Ja" or "Nein" first');
    }
    toks = toks.slice(1);
  }

  const vi = toks.findIndex((t) => verbToken(normWord(t), v));
  if (vi === -1) {
    return fail(`Cavabda "${v.inf}" feli yoxdur. "${P.pron}" ilə belədir: "${P.pron} ${want}". Nümunə: "${ex}"`, `the verb "${v.inf}" is missing`);
  }
  const said = toks[vi];

  const pi = toks.findIndex((t) => t === P.pron);
  if (pi === -1) {
    const other = toks.find((t) => PRONOUNS.includes(t));
    if (other) {
      const Q = PERSONS[P.q];
      const why = kind === 'conj' ? '' : ` Sual "${Q.pron}" ilə verilib, cavab "${P.pron}" ilə olmalıdır.`;
      return fail(`Şəxs səhvdir: "${other}" yox, "${P.pron}" olmalıdır.${why} Nümunə: "${ex}"`, `wrong person: "${other}" instead of "${P.pron}"`);
    }
    return fail(`Şəxs əvəzliyi "${P.pron}" əskikdir. Nümunə: "${ex}"`, `the pronoun "${P.pron}" is missing`);
  }

  if (normWord(said) !== normWord(want)) {
    const note = (v.notes && v.notes[v.person]) || P.ending;
    return fail(`Sonluq səhvdir. ${note}: "${said}" yox, "${want}" olmalıdır.`, `wrong verb form: "${said}" instead of "${want}"`);
  }

  if (kind === 'conj') {
    if (!(pi === 0 && vi === 1)) return fail(`Əvvəl "${P.pron}", sonra fel: "${P.pron} ${want}".`, 'pronoun first, then the verb');
  } else if (vi !== 1 || !(pi === 0 || pi === 2)) {
    return fail(`Fel cümlədə 2-ci yerdə olmalıdır. Nümunə: "${ex}"`, 'the verb must be in position 2');
  }
  return { ok: true };
}
