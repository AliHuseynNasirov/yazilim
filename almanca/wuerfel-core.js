// "Würfeln und konjugieren" lövhə oyunu — UI-sız hissə (ayrıca test edilir).
// 1-ci zər → şəxs (1 = ich … 6 = sie/Sie), 2-ci zər → neçə xana irəli. Xanadakı feli şəxsə görə yaz.

// Formalar sırası: ich, du, er/sie/es, wir, ihr, sie/Sie
export const VERBS = {
  heißen: { az: 'adlanmaq', f: ['heiße', 'heißt', 'heißt', 'heißen', 'heißt', 'heißen'] },
  hören: { az: 'dinləmək', f: ['höre', 'hörst', 'hört', 'hören', 'hört', 'hören'] },
  lernen: { az: 'öyrənmək', f: ['lerne', 'lernst', 'lernt', 'lernen', 'lernt', 'lernen'] },
  spielen: { az: 'oynamaq', f: ['spiele', 'spielst', 'spielt', 'spielen', 'spielt', 'spielen'] },
  arbeiten: { az: 'işləmək', f: ['arbeite', 'arbeitest', 'arbeitet', 'arbeiten', 'arbeitet', 'arbeiten'] },
  sprechen: { az: 'danışmaq', f: ['spreche', 'sprichst', 'spricht', 'sprechen', 'sprecht', 'sprechen'] },
  trinken: { az: 'içmək', f: ['trinke', 'trinkst', 'trinkt', 'trinken', 'trinkt', 'trinken'] },
  wohnen: { az: 'yaşamaq', f: ['wohne', 'wohnst', 'wohnt', 'wohnen', 'wohnt', 'wohnen'] },
  nehmen: { az: 'götürmək', f: ['nehme', 'nimmst', 'nimmt', 'nehmen', 'nehmt', 'nehmen'] },
  kommen: { az: 'gəlmək', f: ['komme', 'kommst', 'kommt', 'kommen', 'kommt', 'kommen'] },
  geben: { az: 'vermək', f: ['gebe', 'gibst', 'gibt', 'geben', 'gebt', 'geben'] },
  bestellen: { az: 'sifariş etmək', f: ['bestelle', 'bestellst', 'bestellt', 'bestellen', 'bestellt', 'bestellen'] },
  leben: { az: 'yaşamaq', f: ['lebe', 'lebst', 'lebt', 'leben', 'lebt', 'leben'] },
  fragen: { az: 'soruşmaq', f: ['frage', 'fragst', 'fragt', 'fragen', 'fragt', 'fragen'] },
  antworten: { az: 'cavab vermək', f: ['antworte', 'antwortest', 'antwortet', 'antworten', 'antwortet', 'antworten'] },
};

// Lövhə: 0 = START/ZIEL, 1–19 xanalar, 20 = ZIEL (bir dövrə)
export const GOAL = 20;
export const BOARD = [
  { t: 'start' },
  { t: 'verb', v: 'heißen' },
  { t: 'verb', v: 'hören' },
  { t: 'verb', v: 'lernen' },
  { t: 'verb', v: 'spielen' },
  { t: 'joker' },
  { t: 'verb', v: 'arbeiten' },
  { t: 'verb', v: 'sprechen' },
  { t: 'verb', v: 'trinken' },
  { t: 'verb', v: 'wohnen' },
  { t: 'again' },
  { t: 'verb', v: 'nehmen' },
  { t: 'verb', v: 'kommen' },
  { t: 'verb', v: 'geben' },
  { t: 'verb', v: 'bestellen' },
  { t: 'pause' },
  { t: 'verb', v: 'leben' },
  { t: 'verb', v: 'fragen' },
  { t: 'verb', v: 'antworten' },
  { t: 'verb', v: 'arbeiten' },
];

// Zər → şəxs. 3 və 6-da bir neçə əvəzlik düzdür.
export const PERSONS = [
  { die: 1, label: 'ich', ok: ['ich'], az: 'mən' },
  { die: 2, label: 'du', ok: ['du'], az: 'sən' },
  { die: 3, label: 'er / sie / es', ok: ['er', 'sie', 'es'], az: 'o' },
  { die: 4, label: 'wir', ok: ['wir'], az: 'biz' },
  { die: 5, label: 'ihr', ok: ['ihr'], az: 'siz (dostlar)' },
  { die: 6, label: 'sie / Sie', ok: ['sie'], az: 'onlar / Siz' },
];

export const formOf = (verb, die) => VERBS[verb].f[die - 1];
/** Nümunə düzgün cavab: "wir wohnen" (3 → "er wohnt", 6 → "sie wohnen") */
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
 * Cavabı yoxla: əvəzlik + fel forması (cümlənin qalanı ola bilər: "wir wohnen in Baku").
 * @returns {{ ok: boolean, why?: 'pron'|'form'|'noPron'|'empty', note?: 'uml' }}
 */
export function checkAnswer(input, verb, die) {
  const words = norm(input).split(' ').filter(Boolean);
  if (!words.length) return { ok: false, why: 'empty' };
  const P = PERSONS[die - 1];
  const form = formOf(verb, die);
  const fw = fold(form);
  // yalnız fel yazılıbsa
  if (words.length === 1) return { ok: false, why: fold(words[0]) === fw ? 'noPron' : 'form' };
  // sual forması da olar: "wohnst du"
  let pron = words[0];
  let vrb = words[1];
  if (!P.ok.includes(pron) && P.ok.includes(words[1])) [pron, vrb] = [words[1], words[0]];
  if (!P.ok.includes(pron)) return { ok: false, why: 'pron' };
  if (vrb === norm(form)) return { ok: true };
  if (fold(vrb) === fw) return { ok: true, note: 'uml' };
  return { ok: false, why: 'form' };
}

/** Səhv səbəbinin azərbaycanca izahı */
export function explain(verb, die) {
  const v = VERBS[verb];
  const form = formOf(verb, die);
  const P = PERSONS[die - 1];
  const ends = ['-e', '-st', '-t', '-en', '-t', '-en'][die - 1];
  let s = `${P.label} → ${ends}: ${P.ok[0]} ${form}.`;
  if (verb === 'sprechen' && (die === 2 || die === 3)) s += ' "sprechen" qaydasızdır: e → i (du sprichst, er spricht).';
  else if (verb === 'nehmen' && (die === 2 || die === 3)) s += ' "nehmen" qaydasızdır: du nimmst, er nimmt.';
  else if (verb === 'geben' && (die === 2 || die === 3)) s += ' "geben" qaydasızdır: e → i (du gibst, er gibt).';
  else if (verb === 'heißen' && die === 2) s += ' Kök "heiß" artıq s-səsi ilə bitir: du heißt (-st yox).';
  else if ((verb === 'arbeiten' || verb === 'antworten') && [2, 3, 5].includes(die)) s += ' Kök -t ilə bitir, arada -e- gəlir: du arbeitest, er arbeitet.';
  return `${s} (${v.az})`;
}

// Müəllimin tipik səhvləri (şagird yoxlasın deyə)
export function wrongForm(verb, die, rnd = Math.random) {
  const f = VERBS[verb].f;
  const right = f[die - 1];
  const stem = verb.replace(/en$/, '').replace(/n$/, '');
  const cands = new Set([
    stem + ['t', 't', 'st', 't', 'en', 't'][die - 1],
    stem + ['en', 't', 'en', 't', 'st', 'e'][die - 1],
    ...f.filter((x) => x !== right),
  ]);
  if (verb === 'sprechen') cands.add(['sprich', 'sprechst', 'sprecht', 'sprichen', 'sprichst', 'sprichen'][die - 1]);
  if (verb === 'heißen' && die === 2) cands.add('heißst');
  if (verb === 'arbeiten') cands.add(['arbeit', 'arbeitst', 'arbeitt', 'arbeitn', 'arbeitt', 'arbeitn'][die - 1]);
  const list = [...cands].filter((x) => x && x !== right);
  return list[Math.floor(rnd() * list.length)];
}

export const rollDie = (rnd = Math.random) => 1 + Math.floor(rnd() * 6);

/** Hərəkət: yeni mövqe (ZIEL-ə çatdısa GOAL) */
export const moveTo = (pos, steps) => Math.min(GOAL, pos + steps);
