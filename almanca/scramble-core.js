// Sual cümləsi qurma məşqi — generator (UI-sız, ayrıca test edilə bilər).
// Şablon + söz kombinasiyalarından yüzlərlə DÜZGÜN A1.1 sual cümləsi yaranır:
//   W-Frage:   Sual sözü + FEL + şəxs + (qalan)?      "Wo wohnst du?"
//   Satzfrage: FEL + şəxs + (qalan)?                 "Wohnst du in Berlin?"

// Şəxslər (sualda): əvəzlik, azərbaycanca
export const PERSONS = {
  du: { pron: 'du', az: 'sən' },
  er: { pron: 'er', az: 'o (kişi)' },
  sie: { pron: 'sie', az: 'o (qadın)' },
  ihr: { pron: 'ihr', az: 'siz' },
  Sie: { pron: 'Sie', az: 'Siz (hörmət)' },
};
export const P_ALL = ['du', 'er', 'sie', 'ihr', 'Sie'];

// Fellər: hər şəxs üçün forma + azərbaycanca məna
export const VERBS = {
  wohnen: { az: 'yaşamaq', f: { du: 'wohnst', er: 'wohnt', sie: 'wohnt', ihr: 'wohnt', Sie: 'wohnen' } },
  kommen: { az: 'gəlmək', f: { du: 'kommst', er: 'kommt', sie: 'kommt', ihr: 'kommt', Sie: 'kommen' } },
  heißen: { az: 'adlanmaq', f: { du: 'heißt', er: 'heißt', sie: 'heißt', ihr: 'heißt', Sie: 'heißen' } },
  sein: { az: 'olmaq', f: { du: 'bist', er: 'ist', sie: 'ist', ihr: 'seid', Sie: 'sind' } },
  lernen: { az: 'öyrənmək', f: { du: 'lernst', er: 'lernt', sie: 'lernt', ihr: 'lernt', Sie: 'lernen' } },
  trinken: { az: 'içmək', f: { du: 'trinkst', er: 'trinkt', sie: 'trinkt', ihr: 'trinkt', Sie: 'trinken' } },
  essen: { az: 'yemək', f: { du: 'isst', er: 'isst', sie: 'isst', ihr: 'esst', Sie: 'essen' } },
  spielen: { az: 'oynamaq', f: { du: 'spielst', er: 'spielt', sie: 'spielt', ihr: 'spielt', Sie: 'spielen' } },
  hören: { az: 'dinləmək', f: { du: 'hörst', er: 'hört', sie: 'hört', ihr: 'hört', Sie: 'hören' } },
  sprechen: { az: 'danışmaq', f: { du: 'sprichst', er: 'spricht', sie: 'spricht', ihr: 'sprecht', Sie: 'sprechen' } },
  machen: { az: 'etmək', f: { du: 'machst', er: 'macht', sie: 'macht', ihr: 'macht', Sie: 'machen' } },
  arbeiten: { az: 'işləmək', f: { du: 'arbeitest', er: 'arbeitet', sie: 'arbeitet', ihr: 'arbeitet', Sie: 'arbeiten' } },
  haben: { az: 'malik olmaq (var)', f: { du: 'hast', er: 'hat', sie: 'hat', ihr: 'habt', Sie: 'haben' } },
};

// Sözlərin azərbaycanca tərcüməsi (fellər və əvəzliklər ayrıca)
export const DICT = {
  wo: 'harada', woher: 'haradan', wie: 'necə', was: 'nə', wann: 'nə vaxt', welche: 'hansı', viele: 'çox (wie viele = neçə)',
  lange: 'uzun (wie lange = nə qədər)', beruf: 'peşə (von Beruf = peşəcə)', von: '-dan/-dən', jetzt: 'indi',
  morgen: 'səhər', nach: '(nach Hause = evə)', sport: 'idman',
  alt: 'yaşlı (wie alt = neçə yaş)', sprachen: 'dillər', geschwister: 'bacı-qardaş', zeit: 'vaxt', gern: 'xoşlayaraq, məmnuniyyətlə',
  am: '-da/-də (gündə)', wochenende: 'həftə sonu', in: '-da/-də (içində)', aus: '-dan/-dən', heute: 'bu gün', ein: 'bir',
  auto: 'maşın', kinder: 'uşaqlar', verheiratet: 'evli', müde: 'yorğun', zu: '(zu Hause = evdə)', hause: 'ev',
  fußball: 'futbol', tennis: 'tennis', basketball: 'basketbol', gitarre: 'gitara', kaffee: 'qəhvə', tee: 'çay', wasser: 'su',
  saft: 'meyvə şirəsi', musik: 'musiqi', pizza: 'pizza', obst: 'meyvə', brot: 'çörək',
  deutsch: 'alman dili', englisch: 'ingilis dili', spanisch: 'ispan dili', russisch: 'rus dili', türkisch: 'türk dili',
  berlin: 'Berlin', hamburg: 'Hamburq', wien: 'Vyana', baku: 'Bakı', münchen: 'Münhen', köln: 'Köln', paris: 'Paris', london: 'London',
  deutschland: 'Almaniya', spanien: 'İspaniya', italien: 'İtaliya', polen: 'Polşa', russland: 'Rusiya', china: 'Çin',
  aserbaidschan: 'Azərbaycan', österreich: 'Avstriya',
  anna: 'Anna (ad)', leyla: 'Leyla (ad)', maria: 'Maria (ad)', ali: 'Əli (ad)', max: 'Maks (ad)', thomas: 'Tomas (ad)',
};

const CITIES = ['Berlin', 'Hamburg', 'Wien', 'Baku', 'München', 'Köln', 'Paris', 'London'];
const COUNTRIES = ['Deutschland', 'Spanien', 'Italien', 'Polen', 'Russland', 'China', 'Aserbaidschan', 'Österreich'];
const LANGS = ['Deutsch', 'Englisch', 'Spanisch', 'Russisch', 'Türkisch'];
const SPORTS = ['Fußball', 'Tennis', 'Basketball', 'Gitarre'];
const DRINKS = ['Kaffee', 'Tee', 'Wasser', 'Saft'];
const FOODS = ['Pizza', 'Obst', 'Brot'];
const MALE = ['Ali', 'Max', 'Thomas'];
const FEMALE = ['Anna', 'Leyla', 'Maria'];

// W-Frage şablonları: [sual sözü(ləri)], fel, [fel+şəxsdən sonrakı sözlər], adlar da subyekt ola bilərmi
const W = [
  [['Wo'], 'wohnen', [], true],
  [['Woher'], 'kommen', [], true],
  [['Wie'], 'heißen', [], false],
  [['Wie', 'alt'], 'sein', [], true],
  [['Was'], 'sein', ['von', 'Beruf'], true],
  [['Wo'], 'sein', ['jetzt'], true],
  [['Was'], 'lernen', [], true],
  [['Wo'], 'lernen', ['Deutsch'], true],
  [['Wann'], 'lernen', ['Deutsch'], true],
  [['Wie', 'lange'], 'lernen', ['Deutsch'], true],
  [['Was'], 'trinken', ['gern'], true],
  [['Was'], 'trinken', ['am', 'Morgen'], true],
  [['Was'], 'essen', ['gern'], true],
  [['Wo'], 'essen', ['heute'], true],
  [['Was'], 'spielen', ['gern'], true],
  [['Wann'], 'spielen', ['Fußball'], true],
  [['Wo'], 'spielen', ['Tennis'], true],
  [['Was'], 'hören', ['gern'], true],
  [['Welche', 'Musik'], 'hören', ['gern'], true],
  [['Welche', 'Sprachen'], 'sprechen', [], true],
  [['Was'], 'machen', ['am', 'Wochenende'], true],
  [['Was'], 'machen', ['heute'], true],
  [['Wo'], 'arbeiten', [], true],
  [['Wann'], 'arbeiten', [], true],
  [['Wann'], 'kommen', ['nach', 'Hause'], true],
  [['Wie', 'viele', 'Geschwister'], 'haben', [], true],
  [['Wann'], 'haben', ['Zeit'], true],
];

// Satzfrage şablonları: fel, [sonrakı sözlər variantları], adlar da subyekt ola bilərmi
const S = [
  ['wohnen', CITIES.map((c) => ['in', c]), true],
  ['kommen', COUNTRIES.map((c) => ['aus', c]), true],
  ['sein', CITIES.map((c) => ['aus', c]), true],
  ['arbeiten', CITIES.map((c) => ['in', c]), true],
  ['arbeiten', [['heute'], ['am', 'Wochenende']], true],
  ['sprechen', LANGS.map((l) => [l]), true],
  ['lernen', LANGS.map((l) => [l]), true],
  ['haben', [['Kinder'], ['heute', 'Zeit'], ['ein', 'Auto']], true],
  ['sein', [['verheiratet'], ['müde'], ['zu', 'Hause']], true],
  ['spielen', SPORTS.map((x) => ['gern', x]), true],
  ['trinken', DRINKS.map((x) => ['gern', x]), true],
  ['essen', FOODS.map((x) => ['gern', x]), true],
  ['hören', [['gern', 'Musik']], true],
  ['machen', [['heute', 'Sport']], true],
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Subyektlər: əvəzliklər + (er/sie üçün) adlar
function subjects(names) {
  const out = P_ALL.map((p) => ({ person: p, subj: PERSONS[p].pron }));
  if (names) {
    for (const n of MALE) out.push({ person: 'er', subj: n });
    for (const n of FEMALE) out.push({ person: 'sie', subj: n });
  }
  return out;
}

/** Bütün mümkün sualları qur: [{ id, type: 'w'|'s', words, alts, verb, person, subj }] */
export function allQuestions() {
  const out = [];
  for (const [qw, verb, rest, names] of W) {
    for (const { person, subj } of subjects(names)) {
      out.push({ type: 'w', words: [...qw, VERBS[verb].f[person], subj, ...rest], alts: [], verb, person, subj });
    }
  }
  for (const [verb, variants, names] of S) {
    for (const rest of variants) {
      for (const { person, subj } of subjects(names)) {
        const head = [cap(VERBS[verb].f[person]), subj];
        // "Trinkst du gern Kaffee?" = "Trinkst du Kaffee gern?" (hər ikisi düzgündür)
        const alts = rest.length === 2 && rest[0] === 'gern' ? [[...head, rest[1], 'gern']] : [];
        out.push({ type: 's', words: [...head, ...rest], alts, verb, person, subj });
      }
    }
  }
  // "Heißt du Ali?" — kişi adları du/er/Sie, qadın adları du/sie/Sie ilə
  for (const [names, persons] of [[MALE, ['du', 'er', 'Sie']], [FEMALE, ['du', 'sie', 'Sie']]]) {
    for (const n of names) {
      for (const p of persons) {
        const subj = PERSONS[p].pron;
        out.push({ type: 's', words: [cap(VERBS.heißen.f[p]), subj, n], alts: [], verb: 'heißen', person: p, subj });
      }
    }
  }
  return out.map((q) => ({ ...q, id: q.words.join(' ') + '?' }));
}

/** Sözün azərbaycanca izahı (fel → "yaşamaq · sən", əvəzlik → "sən", ad → "Anna (ad)") */
export function translate(word, q) {
  const lw = word.toLowerCase();
  const v = VERBS[q.verb];
  const isPron = q.subj === PERSONS[q.person].pron;
  if (v && Object.values(v.f).includes(lw) && lw !== q.subj.toLowerCase()) {
    return `${v.az} · ${isPron ? PERSONS[q.person].az : 'o'}`;
  }
  if (word === q.subj && isPron) return PERSONS[q.person].az;
  return DICT[lw] || '';
}

function shuffle(a, rnd = Math.random) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// Eyni feldən çox sual düşməsin: əvvəl hər feldən ən çox `max` sual, sonra qalanlar
function spread(list, k, max = 2) {
  const seen = new Map();
  const res = [];
  for (const q of list) {
    if (res.length === k) break;
    const c = seen.get(q.verb) || 0;
    if (c >= max) continue;
    seen.set(q.verb, c + 1);
    res.push(q);
  }
  for (const q of list) if (res.length < k && !res.includes(q)) res.push(q);
  return res;
}

/** Sözləri qarışdır (düzgün sıra ilə eyni olmasın). İlk söz kiçik hərflə — ipucu olmasın. */
export function makeTiles(q, rnd = Math.random) {
  const tiles = q.words.map((w, i) => ({ w: i === 0 ? w.toLowerCase() : w, i }));
  let order;
  let guard = 0;
  do order = shuffle(tiles, rnd);
  while (order.length > 1 && order.every((t, k) => t.i === k) && ++guard < 50);
  return order;
}

/**
 * Yeni tur: n sual (yarısı W-Frage, yarısı Satzfrage), əvvəllər verilməyənlərdən.
 * Bir növün bütün sualları bitəndə yalnız həmin növün yaddaşı sıfırlanır.
 * @param {string[]} used əvvəllər verilmiş sualların id-ləri
 * @returns {{ items: object[], used: string[] }}
 */
export function newRound(n, used = [], rnd = Math.random) {
  const all = allQuestions();
  const usedSet = new Set(used);
  const want = { w: Math.ceil(n / 2), s: Math.floor(n / 2) };
  let keep = [...used];
  const picked = [];
  for (const t of ['w', 's']) {
    const ofType = all.filter((q) => q.type === t);
    let fresh = ofType.filter((q) => !usedSet.has(q.id));
    if (fresh.length < want[t]) {
      const ids = new Set(ofType.map((q) => q.id));
      keep = keep.filter((id) => !ids.has(id));
      fresh = ofType;
    }
    picked.push(...spread(shuffle(fresh, rnd), want[t]));
  }
  const items = shuffle(picked, rnd).map((q) => ({ ...q, tiles: makeTiles(q, rnd) }));
  return { items, used: [...keep, ...items.map((q) => q.id)] };
}

/** Cavabı yoxla: seçilmiş sözlərin sırası düzgün sıra ilə eynidirmi */
export function isCorrect(q, chosenWords) {
  const norm = (a) => a.map((w) => w.toLowerCase()).join(' ');
  const got = norm(chosenWords);
  return [q.words, ...(q.alts || [])].some((ws) => norm(ws) === got);
}

export const RULE_AZ = {
  w: 'W-Frage: sual sözü + FEL + şəxs + qalan hissə. Nümunə: "Wo wohnst du?"',
  s: 'Satzfrage (bəli/xeyr sualı): FEL əvvəldə + şəxs + qalan hissə. Nümunə: "Wohnst du in Berlin?"',
};
