// "Anmeldung" rol oyunu — UI-sız hissə: şəxslər, formalar və cavabların yoxlanması (ayrıca test edilir).
//
// Rolle A: öz forması Francis Hayatou, boş forma — Zoe haqqında.
// Rolle B: öz forması Zoe Smith,     boş forma — Francis haqqında.
// Boş formalarda bəzi xanalar artıq yazılıb (şəkildəki kimi): Zoe → Vorname + "Leipzig"; Francis → Vorname + ", Kamerun".

import { germanNumber } from './numbers-core.js';

export const PEOPLE = {
  francis: {
    vorname: 'Francis',
    name: 'Hayatou',
    street: 'Goethestr. 12',
    city: '04229 Leipzig',
    handy: '0162 2081430',
    herkunft: 'Douala, Kamerun',
    sprachen: ['Kamtok', 'Französisch'],
    // boş formada (bu şəxs haqqında) artıq yazılanlar
    pre: { vorname: true, herkunftSuffix: ', Kamerun' },
  },
  zoe: {
    vorname: 'Zoe',
    name: 'Smith',
    street: 'Uferstr. 23',
    city: 'Leipzig',
    handy: '0162-2084453',
    herkunft: 'Auckland, Neuseeland',
    sprachen: ['Französisch', 'Englisch'],
    pre: { vorname: true, city: true },
  },
};

export const ROLES = {
  A: { own: 'francis', other: 'zoe' },
  B: { own: 'zoe', other: 'francis' },
};

// Sual veriləcək hissələr (sıra ilə)
export const SLOTS = [
  { key: 'name', label: 'Name', az: 'soyad', q: 'Wie ist dein Name?', a: 'Mein Name ist …' },
  { key: 'adresse', label: 'Adresse', az: 'ünvan', q: 'Wie ist deine Adresse?', a: 'Meine Adresse ist …' },
  { key: 'handy', label: 'Handynummer', az: 'mobil nömrə', q: 'Wie ist deine Handynummer?', a: 'Meine Handynummer ist …' },
  { key: 'herkunft', label: 'Herkunft', az: 'haradan', q: 'Woher kommst du?', a: 'Ich komme aus …' },
  { key: 'sprachen', label: 'Sprachen', az: 'dillər', q: 'Welche Sprachen sprichst du?', a: 'Ich spreche …' },
];

/** Bu şəxs haqqında boş formada doldurulacaq xanalar: [{ key, slot, label, expected, suffix? }] */
export function fillInputs(pk) {
  const p = PEOPLE[pk];
  const out = [
    { key: 'name', slot: 'name', label: 'Name', expected: p.name },
    { key: 'street', slot: 'adresse', label: 'Adresse', expected: p.street },
  ];
  if (!p.pre.city) out.push({ key: 'city', slot: 'adresse', label: '', expected: p.city });
  out.push({ key: 'handy', slot: 'handy', label: 'Handynummer', expected: p.handy });
  out.push({
    key: 'herkunft',
    slot: 'herkunft',
    label: 'Herkunft',
    expected: p.pre.herkunftSuffix ? p.herkunft.replace(p.pre.herkunftSuffix, '') : p.herkunft,
    suffix: p.pre.herkunftSuffix || '',
  });
  out.push({ key: 'sprachen', slot: 'sprachen', label: 'Sprachen', expected: p.sprachen.join(', ') });
  return out;
}

// ---------- normallaşdırma ----------
export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/strasse\b|str\.|str\b/g, 'str')
    .replace(/[^a-z0-9]+/g, '');
}

// Almanca rəqəm sözləri → rəqəm ("null eins sechs zwei" → "0162", "zwölf" → "12")
const NUMWORDS = (() => {
  const m = new Map();
  for (let n = 0; n <= 100; n++) m.set(norm(germanNumber(n)), String(n));
  m.set('ein', '1');
  m.set('zwo', '2');
  return m;
})();
export function wordsToDigits(text) {
  return String(text || '')
    .split(/(\s+|,|-|\/)/)
    .map((w) => {
      const n = NUMWORDS.get(norm(w));
      return n !== undefined && /[a-zäöüß]/i.test(w) ? n : w;
    })
    .join('');
}
export const digitsOf = (text) => wordsToDigits(text).replace(/\D/g, '');

function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const words = (t) => (String(t || '').match(/[\p{L}]+/gu) || []).map(norm).filter(Boolean);
const STOP = new Set(['und', 'ich', 'spreche', 'sprache', 'sprachen', 'meine', 'mein', 'auch', 'ein', 'bisschen']);
const LANGS = ['kamtok', 'franzosisch', 'englisch', 'deutsch', 'spanisch', 'russisch', 'turkisch', 'italienisch', 'arabisch', 'chinesisch', 'aserbaidschanisch'];

/**
 * Şagirdin YAZDIĞI xananı yoxla (dəqiq yazılış lazımdır, ümlautsuz yazmağa icazə var).
 * @returns {boolean}
 */
export function checkTyped(pk, key, value) {
  const p = PEOPLE[pk];
  const v = String(value || '').trim();
  if (!v) return false;
  switch (key) {
    case 'name':
      return norm(v) === norm(p.name) || norm(v) === norm(`${p.vorname} ${p.name}`);
    case 'street': {
      const n = norm(v);
      const st = norm(p.street);
      // bütün ünvanı bir xanaya yazıbsa da qəbul et
      return n === st || n === st + norm(p.city) || (p.pre.city && n === st + 'leipzig');
    }
    case 'city':
      return digitsOf(v) === digitsOf(p.city) && norm(v).includes('leipzig');
    case 'handy':
      return digitsOf(v) === digitsOf(p.handy);
    case 'herkunft': {
      const need = words(p.pre.herkunftSuffix ? p.herkunft.replace(p.pre.herkunftSuffix, '') : p.herkunft);
      const got = words(v);
      return need.every((w) => got.includes(w)) && got.every((w) => need.includes(w) || words(p.herkunft).includes(w));
    }
    case 'sprachen': {
      const need = p.sprachen.map(norm);
      const got = words(v).filter((w) => !STOP.has(w));
      return need.every((w) => got.includes(w)) && got.every((w) => need.includes(w));
    }
  }
  return false;
}

/**
 * Müəllimin EŞİTDİYİNİ yoxla (şagird öz formasından düz deyibmi). Ad üçün kiçik yazılış fərqinə icazə var.
 * @returns {{ ok: boolean, missing?: string }}
 */
export function checkHeard(pk, slot, value) {
  const p = PEOPLE[pk];
  const v = String(value || '');
  const ws = words(v);
  switch (slot) {
    case 'name': {
      const t = norm(p.name);
      return { ok: ws.some((w) => w === t || (w.length >= 4 && lev(w, t) <= 2)) };
    }
    case 'adresse': {
      const streetWord = norm(p.street.replace(/str\..*/i, ''));
      const num = p.street.match(/\d+/)[0];
      const hasStreet = ws.some((w) => w.startsWith(streetWord.slice(0, 4)) && lev(w.replace(/str.*$/, ''), streetWord) <= 2);
      const digits = digitsOf(v);
      const hasNum = digits.startsWith(num) || new RegExp(`(^|\\D)${num}(\\D|$)`).test(wordsToDigits(v));
      if (!hasStreet || !hasNum) return { ok: false, missing: 'street' };
      if (!p.pre.city) {
        const plz = digitsOf(p.city);
        if (!digits.includes(plz)) return { ok: false, missing: 'plz' };
      }
      return { ok: true };
    }
    case 'handy':
      return { ok: digitsOf(v) === digitsOf(p.handy) };
    case 'herkunft': {
      const need = words(p.pre.herkunftSuffix ? p.herkunft.replace(p.pre.herkunftSuffix, '') : p.herkunft);
      return { ok: need.every((n) => ws.some((w) => w === n || (w.length >= 5 && lev(w, n) <= 1))) };
    }
    case 'sprachen': {
      const need = p.sprachen.map(norm);
      const got = ws.filter((w) => LANGS.includes(w) || need.some((n) => lev(w, n) <= 1));
      const fixed = got.map((w) => need.find((n) => lev(w, n) <= 1) || w);
      return { ok: need.every((n) => fixed.includes(n)) && fixed.every((w) => need.includes(w)) };
    }
  }
  return { ok: false };
}

/** Şəxsin formasındakı dəyər (müəllimin cavabı / düzgün cavab göstərmək üçün) */
export function slotValue(pk, slot) {
  const p = PEOPLE[pk];
  if (slot === 'adresse') return `${p.street}, ${p.city}`;
  if (slot === 'sprachen') return p.sprachen.join(', ');
  return p[slot];
}

/** Yeni oyun: rol və kimin başladığı təsadüfi */
export function newGame(rnd = Math.random) {
  return { role: rnd() < 0.5 ? 'A' : 'B', starter: rnd() < 0.5 ? 'learner' : 'teacher' };
}
