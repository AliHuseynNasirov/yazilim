// Sabit qrammatika yoxlayıcısı.
// Şagirdin dediyinin yazısında (transkripsiya) tipik A1 səhvlərini tapır:
// şəxsə görə fel sonluğu (ich heiß → ich heiße), söz sırası, yaş, ön söz, ölkə artiklı.
// Model bəzən səhvi buraxır — bu yoxlayıcı ona arxa plan dəstəyidir.

const B = '(?<![\\p{L}])'; // söz başlanğıcı (ä, ö, ü, ß daxil)
const E = '(?![\\p{L}])'; // söz sonu

function rx(body) {
  return new RegExp(B + body + E, 'iu');
}

// Fel qaydaları: [şəxs, səhv formalar (regex), düzgün forma, sahə, fel adı]
const VERBS = [
  ['ich', 'hei(?:ß|ss|s)(?:t|en|st)?', 'heiße', 'name', 'heißen'],
  ['ich', 'komm(?:st|t|en)?', 'komme', 'country', 'kommen'],
  ['ich', 'wohn(?:st|t|en)?', 'wohne', 'city', 'wohnen'],
  ['ich', '(?:sprech(?:st|t|en)?|sprich(?:st|t))', 'spreche', 'language', 'sprechen'],
  ['ich', 'lern(?:st|t|en)?', 'lerne', null, 'lernen'],
  ['ich', '(?:hab(?:en|t|st)?|hast|hat)', 'habe', null, 'haben'],
  ['ich', 'arbeit(?:est|et|en)?', 'arbeite', null, 'arbeiten'],
  ['ich', 'möcht(?:est|en)?', 'möchte', null, 'möchten'],
  ['ich', '(?:bist|ist|sind|seid)', 'bin', 'age', 'sein'],
  ['du', 'hei(?:ß|ss)(?:e|en|st)', 'heißt', null, 'heißen'],
  ['du', 'komm(?:e|t|en)', 'kommst', null, 'kommen'],
  ['du', 'wohn(?:e|t|en)', 'wohnst', null, 'wohnen'],
  ['du', '(?:sprech(?:e|st|t|en)|spricht)', 'sprichst', null, 'sprechen'],
  ['du', 'lern(?:e|t|en)', 'lernst', null, 'lernen'],
  ['du', '(?:habe|hat|haben|habst)', 'hast', null, 'haben'],
  ['du', '(?:bin|ist|sind|seid)', 'bist', null, 'sein'],
  ['du', 'möchte(?:n)?', 'möchtest', null, 'möchten'],
];

const ENDING_AZ = {
  ich: "'ich' ilə fel -e ilə bitir",
  du: "'du' ilə fel -st ilə bitir",
};

function azFor(pron, right, inf) {
  if (inf === 'sein') return `"sein" qaydasızdır: ${pron === 'ich' ? 'ich bin' : 'du bist'} olmalıdır.`;
  if (inf === 'haben') return `"haben": ${pron === 'ich' ? 'ich habe' : 'du hast'} olmalıdır.`;
  if (inf === 'sprechen' && pron === 'du') return '"sprechen" qaydasızdır: du sprichst olmalıdır.';
  if (inf === 'heißen' && pron === 'du') return "'du' ilə: du heißt (ß-dən sonra yalnız -t əlavə olunur).";
  return `${ENDING_AZ[pron]}: "${right}" olmalıdır.`;
}

// Sualda fel "du"-dan əvvəl gəlir: "Wo wohnen du?" → "Wo wohnst du?"
function invertedDuRules() {
  return VERBS.filter((v) => v[0] === 'du').map(([pron, wrong, right, field, inf]) => ({
    re: rx(`(${wrong})\\s+(du)`),
    fix: (m) => `${right} ${m[2]}`,
    key: right,
    field,
    az: azFor(pron, right, inf),
    en: `with "du" the verb "${inf}" must be "${right}"`,
  }));
}

function verbRules() {
  return VERBS.map(([pron, wrong, right, field, inf]) => ({
    re: rx(`(${pron})\\s+(${wrong})`),
    fix: (m) => `${m[1]} ${right}`,
    key: right,
    field,
    az: azFor(pron, right, inf),
    en: `with "${pron}" the verb "${inf}" must be "${right}"`,
  }));
}

// "ich" unudulub: "Komm aus …" → "Ich komme aus …" (bəli/xeyr sualı "Kommst du…?" sayılmır)
const MISSING_ICH = [
  ['komm(?:e)?', 'komme', 'country'],
  ['wohn(?:e)?', 'wohne', 'city'],
  ['(?:sprech(?:e)?|sprich)', 'spreche', 'language'],
  ['hei(?:ß|ss)(?:e)?', 'heiße', 'name'],
  ['lern(?:e)?', 'lerne', null],
  ['bin', 'bin', 'age'],
];

const RULES = [
  ...MISSING_ICH.map(([verb, right, field]) => ({
    re: new RegExp(`(?:^|(?<=[.!?,;]\\s*))(${verb})(?![\\p{L}])(?!\\s+(?:du|ich)(?![\\p{L}]))`, 'iu'),
    fix: () => `Ich ${right}`,
    key: right,
    field,
    az: `Cümlədə "ich" (mən) əskikdir: "Ich ${right} …" olmalıdır.`,
    en: `the subject "ich" is missing: it must be "Ich ${right} …"`,
  })),
  // Ön söz: "komme auf/von/nach Deutschland" → "komme aus"
  {
    re: rx('(komm\\p{L}*)\\s+(auf|von|vom|nach)'),
    fix: (m) => `${m[1]} aus`,
    key: 'aus',
    field: 'country',
    az: 'Haradan gəldiyini deyəndə "aus" işlənir: Ich komme aus …',
    en: 'with "kommen" (origin) use "aus"',
  },
  // Ön söz: "wohne auf/nach/im Hamburg" → "wohne in"
  {
    re: rx('(wohn\\p{L}*)\\s+(auf|nach|im|am|zu)'),
    fix: (m) => `${m[1]} in`,
    key: ' in',
    field: 'city',
    az: 'Harada yaşadığını deyəndə "in" işlənir: Ich wohne in …',
    en: 'with "wohnen" + city use "in"',
  },
  // Yaş: "ich habe 35 Jahre" → "ich bin 35 Jahre alt"
  {
    re: rx('(ich)\\s+(?:habe?|hab)\\s+([\\p{L}\\d-]+)\\s+jahre?(?:\\s+alt)?'),
    fix: (m) => `${m[1]} bin ${m[2]} Jahre alt`,
    key: 'bin',
    field: 'age',
    az: 'Yaş "haben" ilə yox, "sein" ilə deyilir: Ich bin … Jahre alt.',
    en: 'age is said with "sein": "Ich bin … Jahre alt", not "haben"',
  },
  // "alt" unudulub: "ich bin 35 Jahre" → "ich bin 35 Jahre alt"
  {
    re: new RegExp(`${B}(ich\\s+bin\\s+[\\p{L}\\d-]+\\s+jahre?)${E}(?!\\s+alt)`, 'iu'),
    fix: (m) => `${m[1]} alt`,
    key: 'alt',
    field: 'age',
    az: 'Sonda "alt" sözü lazımdır: Ich bin … Jahre alt.',
    en: 'the word "alt" is missing at the end: "Ich bin … Jahre alt"',
  },
  // Söz sırası: "wie alt du bist" → "wie alt bist du"
  {
    re: rx('(wie\\s+alt)\\s+du\\s+(bist|bin|ist|sind)'),
    fix: (m) => `${m[1]} bist du`,
    key: 'bist du',
    field: null,
    az: 'Sualda fel sual sözündən dərhal sonra gəlir: Wie alt bist du?',
    en: 'in W-questions the verb comes right after the question word: "Wie alt bist du?"',
  },
  // Söz sırası: "wo du wohnst" → "wo wohnst du"
  {
    re: rx('(wie|wo|woher|was|welche\\p{L}*)\\s+du\\s+(\\p{L}+st)'),
    fix: (m) => `${m[1]} ${m[2]} du`,
    key: ' du',
    field: null,
    az: 'Sualda fel sual sözündən dərhal sonra, "du" isə feldən sonra gəlir: Wo wohnst du?',
    en: 'in W-questions the verb comes right after the question word, then "du"',
  },
  // Ön söz: "ich wohne aus" → "ich wohne in"
  {
    re: rx('(ich\\s+wohne)\\s+aus'),
    fix: (m) => `${m[1]} in`,
    key: 'wohne in',
    field: 'city',
    az: 'Harada yaşayırsan — "in": Ich wohne in …',
    en: 'with "wohnen" use "in", not "aus"',
  },
  {
    re: rx('(ich\\s+komme)\\s+in'),
    fix: (m) => `${m[1]} aus`,
    key: 'komme aus',
    field: 'country',
    az: 'Haradan gəlirsən — "aus": Ich komme aus …',
    en: 'with "kommen" use "aus", not "in"',
  },
  // Ölkə artiklı
  {
    re: rx('aus\\s+(?:die\\s+|den\\s+)?(türkei|turkei)'),
    fix: () => 'aus der Türkei',
    key: 'der türkei',
    field: 'country',
    az: 'Türkei artikl ilə gəlir: aus der Türkei.',
    en: '"Türkei" needs the article: "aus der Türkei"',
  },
  {
    re: rx('aus\\s+(?:die\\s+|den\\s+)?(schweiz)'),
    fix: () => 'aus der Schweiz',
    key: 'der schweiz',
    field: 'country',
    az: 'Schweiz artikl ilə gəlir: aus der Schweiz.',
    en: '"Schweiz" needs the article: "aus der Schweiz"',
  },
  {
    re: rx('aus\\s+(?:der\\s+|die\\s+)?(usa)'),
    fix: () => 'aus den USA',
    key: 'den usa',
    field: 'country',
    az: 'USA cəmdir, artikl ilə gəlir: aus den USA.',
    en: '"USA" is plural and needs the article: "aus den USA"',
  },
  ...verbRules(),
  ...invertedDuRules(),
];

// Doğru yazılmış artikllı formaları "səhv" saymamaq üçün
const CORRECT_ARTICLE = /aus\s+der\s+(türkei|schweiz)|aus\s+den\s+usa/iu;

/**
 * Mətndəki səhvləri qaytarır.
 * @returns {{wrong:string, correct:string, az:string, en:string, key:string, field:string|null}[]}
 */
export function checkSentence(text) {
  const out = [];
  let fixed = text;
  for (const r of RULES) {
    const m = fixed.match(r.re);
    if (!m) continue;
    if (r.key.startsWith('der ') || r.key.startsWith('den ')) {
      if (CORRECT_ARTICLE.test(m[0])) continue;
    }
    const replacement = r.fix(m);
    // Böyük hərfi qoru
    const rep = m[0][0] === m[0][0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
    fixed = fixed.replace(m[0], rep);
    out.push({ wrong: m[0], correct: rep, az: r.az, en: r.en, key: r.key, field: r.field });
  }
  return out.map((e) => ({ ...e, fullWrong: text, fullCorrect: fixed }));
}

// ---------- Söz yoxlaması (kart dərsi kimi qapalı lüğətli dərslər üçün) ----------
// Lüğətdə olmayan söz deyilsə (məs. "heise", "hayse"), ən yaxın düzgün sözü təklif edir.

const NUM_1 = ['null', 'eins', 'ein', 'eine', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const NUM_UNITS = ['ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const NUM_TENS = ['zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
const NUM_TEEN = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'hundert', 'einhundert'];

const COMMON = `ja nein und oder aber hallo hi guten tag morgen abend danke bitte schön mein meine meinen name ist
ich du er sie es wir ihr auch nicht kein keine sehr gut okay ok so jetzt hier heute wie wo woher was wer welche welcher
welches alt jahre jahr aus in der die das den dem des ein eine einen von beruf tschüss entschuldigung also äh ähm hm mhm
ach oh na auf nach von vom im am um zu komm wohn sprech lern heiß heiss noch einmal langsam wiederholen karte nächste weiter fertig richtig falsch genau super prima toll bin bist sind
seid heiße heißt heißen komme kommst kommt kommen wohne wohnst wohnt wohnen spreche sprichst spricht sprechen lerne lernst
lernt lernen habe hast hat haben arbeite arbeitest arbeitet möchte möchtest`;

// ß→ss, umlaut → sadə hərf: "heiße" = "heisse"
export function normWord(w) {
  return w
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
}

// Təxmini tələffüz forması: oxşar səslənən yazılışları eyniləşdirir
function phon(n) {
  return n
    .replace(/a[iy]|e[iy]/g, 'ei')
    .replace(/o[iy]|eu|au(?=s)/g, 'eu')
    .replace(/sch/g, 'S')
    .replace(/tsch|ch/g, 'C')
    .replace(/ss|z/g, 's')
    .replace(/ph|v/g, 'f')
    .replace(/dt$|d$/g, 't')
    .replace(/k$/g, 'g')
    .replace(/(.)\1/g, '$1');
}

function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/**
 * Lüğət qurur. fieldWords: { name: [...], age: [...], ... } — sözün hansı kart sahəsinə aid olduğu.
 * @returns {{words: Map<string,string>, field: Map<string,string>}}  norm → orijinal yazılış, norm → sahə
 */
export function buildLexicon(extraWords, fieldWords = {}) {
  const words = new Map();
  const field = new Map();
  const add = (w, f) => {
    for (const part of String(w).split(/[^\p{L}]+/u)) {
      if (!part) continue;
      const n = normWord(part);
      if (!words.has(n)) words.set(n, part);
      if (f && !field.has(n)) field.set(n, f);
    }
  };
  COMMON.split(/\s+/).forEach((w) => add(w));
  [...NUM_1, ...NUM_TENS, ...NUM_TEEN].forEach((w) => add(w, 'age'));
  for (const u of NUM_UNITS) for (const t of NUM_TENS) add(`${u}und${t}`, 'age');
  extraWords.forEach((w) => add(w));
  for (const [f, list] of Object.entries(fieldWords)) list.forEach((w) => add(w, f));
  return { words, field };
}

const AZ_HINT = /[əğı]|\b(mən|sən|nə|necə|başa|düşmədim|bilmirəm|yenə|bəli|xeyr|salam|sağ ol)\b/iu;

/** Lüğətdə olmayan sözləri tapır və ən yaxın düzgün sözü təklif edir. */
export function checkWords(text, lex) {
  if (!lex || AZ_HINT.test(text)) return [];
  const tokens = text.match(/\p{L}+/gu) || [];
  const out = [];
  for (const tok of tokens) {
    const n = normWord(tok);
    if (n.length < 2 || lex.words.has(n)) continue;
    let best = null;
    let bestD = Infinity;
    const pn = phon(n);
    for (const [cand, orig] of lex.words) {
      if (Math.abs(cand.length - n.length) > 4) continue;
      const dist = lev(pn, phon(cand));
      if (dist < bestD) {
        bestD = dist;
        best = { cand, orig };
      }
    }
    const close = best && bestD <= Math.max(2, Math.floor(n.length / 3));
    const sugg = close ? best.orig : null;
    const fullCorrect = sugg ? text.replace(tok, tok[0] === tok[0].toUpperCase() ? sugg[0].toUpperCase() + sugg.slice(1) : sugg) : text;
    out.push({
      wrong: tok,
      correct: sugg || '?',
      word: true,
      key: sugg || tok,
      field: sugg ? lex.field.get(best.cand) || null : null,
      az: sugg
        ? `"${tok}" düzgün söz deyil — "${sugg}" olmalıdır. Sözü düzgün de və cümləni yenidən təkrar et.`
        : `"${tok}" sözü başa düşülmədi. Sözü aydın və düzgün de, cümləni yenidən təkrar et.`,
      en: sugg
        ? `the word "${tok}" is wrong or mispronounced; it must be "${sugg}"`
        : `the word "${tok}" is not a correct German word here`,
      fullWrong: text,
      fullCorrect,
    });
  }
  return out;
}
