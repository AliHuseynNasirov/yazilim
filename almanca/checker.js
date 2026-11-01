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

const RULES = [
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
  const seenFields = new Set();
  for (const r of RULES) {
    const m = fixed.match(r.re);
    if (!m) continue;
    if (r.key.startsWith('der ') || r.key.startsWith('den ')) {
      if (CORRECT_ARTICLE.test(m[0])) continue;
    }
    const field = r.field || `x${out.length}`;
    if (seenFields.has(field)) continue;
    seenFields.add(field);
    const replacement = r.fix(m);
    // Böyük hərfi qoru
    const rep = m[0][0] === m[0][0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
    fixed = fixed.replace(m[0], rep);
    out.push({ wrong: m[0], correct: rep, az: r.az, en: r.en, key: r.key, field: r.field });
  }
  return out.map((e) => ({ ...e, fullWrong: text, fullCorrect: fixed }));
}
