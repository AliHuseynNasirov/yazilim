// "Ist das ein Kaffee? — Nein, das ist kein Kaffee. Das ist ein Espresso." — UI-sız hissə (ayrıca test edilir).
// Kafe dərsi (ein / eine, kein / keine, mein / meine). Sözlər kitabın A1.1 hissəsindəndir; şəkillər emojidir.

// g: der | das | die · grp: eyni qrupdan cüt seçilir (içki ilə içki, yemək ilə yemək …)
export const ITEMS = [
  // içkilər
  { n: 'Kaffee', g: 'der', e: '☕', az: 'qəhvə', grp: 'drink' },
  { n: 'Espresso', g: 'der', e: '☕', az: 'espresso', grp: 'drink' },
  { n: 'Cappuccino', g: 'der', e: '☕', az: 'kapuçino', grp: 'drink' },
  { n: 'Latte Macchiato', g: 'der', e: '🥛', az: 'latte makiato', grp: 'drink' },
  { n: 'Milchkaffee', g: 'der', e: '☕', az: 'südlü qəhvə', grp: 'drink' },
  { n: 'Tee', g: 'der', e: '🍵', az: 'çay', grp: 'drink' },
  { n: 'Kakao', g: 'der', e: '🍫', az: 'kakao', grp: 'drink' },
  { n: 'Apfelsaft', g: 'der', e: '🧃', az: 'alma şirəsi', grp: 'drink' },
  { n: 'Orangensaft', g: 'der', e: '🍊', az: 'portağal şirəsi', grp: 'drink' },
  { n: 'Eistee', g: 'der', e: '🧋', az: 'soyuq çay', grp: 'drink' },
  { n: 'Wasser', g: 'das', e: '💧', az: 'su', grp: 'drink' },
  { n: 'Mineralwasser', g: 'das', e: '💧', az: 'mineral su', grp: 'drink' },
  { n: 'Cola', g: 'die', e: '🥤', az: 'kola', grp: 'drink' },
  { n: 'Limonade', g: 'die', e: '🍋', az: 'limonad', grp: 'drink' },
  { n: 'Milch', g: 'die', e: '🥛', az: 'süd', grp: 'drink' },
  // yeməklər
  { n: 'Croissant', g: 'das', e: '🥐', az: 'kruassan', grp: 'food' },
  { n: 'Brötchen', g: 'das', e: '🥖', az: 'bulka', grp: 'food' },
  { n: 'Eis', g: 'das', e: '🍨', az: 'dondurma', grp: 'food' },
  { n: 'Steak', g: 'das', e: '🥩', az: 'steyk', grp: 'food' },
  { n: 'Hähnchen', g: 'das', e: '🍗', az: 'toyuq', grp: 'food' },
  { n: 'Sushi', g: 'das', e: '🍣', az: 'suşi', grp: 'food' },
  { n: 'Kuchen', g: 'der', e: '🍰', az: 'piroq, tort', grp: 'food' },
  { n: 'Käse', g: 'der', e: '🧀', az: 'pendir', grp: 'food' },
  { n: 'Salat', g: 'der', e: '🥗', az: 'salat', grp: 'food' },
  { n: 'Hamburger', g: 'der', e: '🍔', az: 'hamburger', grp: 'food' },
  { n: 'Fisch', g: 'der', e: '🐟', az: 'balıq', grp: 'food' },
  { n: 'Pizza', g: 'die', e: '🍕', az: 'pizza', grp: 'food' },
  { n: 'Suppe', g: 'die', e: '🍲', az: 'şorba', grp: 'food' },
  { n: 'Currywurst', g: 'die', e: '🌭', az: 'körili kolbasa', grp: 'food' },
  { n: 'Tomate', g: 'die', e: '🍅', az: 'pomidor', grp: 'food' },
  // əşyalar (kafedə)
  { n: 'Laptop', g: 'der', e: '💻', az: 'noutbuk', grp: 'thing' },
  { n: 'Kopfhörer', g: 'der', e: '🎧', az: 'qulaqlıq', grp: 'thing' },
  { n: 'Kuli', g: 'der', e: '🖊️', az: 'qələm', grp: 'thing' },
  { n: 'Schlüssel', g: 'der', e: '🔑', az: 'açar', grp: 'thing' },
  { n: 'Handy', g: 'das', e: '📱', az: 'mobil telefon', grp: 'thing' },
  { n: 'Portemonnaie', g: 'das', e: '👛', az: 'pul kisəsi', grp: 'thing' },
  { n: 'Buch', g: 'das', e: '📕', az: 'kitab', grp: 'thing' },
  { n: 'Heft', g: 'das', e: '📓', az: 'dəftər', grp: 'thing' },
  { n: 'Brille', g: 'die', e: '👓', az: 'eynək', grp: 'thing' },
  { n: 'Tasche', g: 'die', e: '👜', az: 'çanta', grp: 'thing' },
  { n: 'Uhr', g: 'die', e: '⌚', az: 'saat', grp: 'thing' },
];
export const findItem = (n) => ITEMS.find((x) => x.n === n);

// Kitab vərəqindəki cütlər (✗ → ✓), ilk oyunda bunlar da düşə bilər
export const SHEET_PAIRS = [['Kaffee', 'Espresso'], ['Cappuccino', 'Latte Macchiato'], ['Kaffee', 'Tee'], ['Wasser', 'Orangensaft'], ['Cappuccino', 'Espresso'], ['Cola', 'Apfelsaft']];

export const ein = (it) => (it.g === 'die' ? 'eine' : 'ein');
export const kein = (it) => (it.g === 'die' ? 'keine' : 'kein');
export const mein = (it) => (it.g === 'die' ? 'meine' : 'mein');
export const question = (x) => `Ist das ${ein(x)} ${x.n}?`;
export const answer = (x, y, withMein) => `Nein, das ist ${kein(x)} ${x.n}. Das ist ${ein(y)} ${y.n}.${withMein ? ` Und das ist ${mein(y)} ${y.n}.` : ''}`;

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[.,!?;:"„“”–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const fold = (s) => norm(s).replace(/ä|ae/g, 'a').replace(/ö|oe/g, 'o').replace(/ü|ue/g, 'u');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Şagirdin sualı: "Ist das ein Kaffee?"
 * @returns {{ ok: boolean, why?: 'order'|'art'|'noun'|'form', got?: string }}
 */
export function checkQuestion(input, x) {
  const t = fold(input);
  const n = fold(x.n);
  if (!t) return { ok: false, why: 'form' };
  if (/^das ist /.test(t)) return { ok: false, why: 'order' };
  const m = t.match(/^ist das (?:(\S+) )?(.+)$/);
  if (!m) return { ok: false, why: 'form' };
  if (m[2] !== n) return { ok: false, why: 'noun' };
  if (!m[1]) return { ok: false, why: 'art', got: '' };
  if (m[1] !== ein(x)) return { ok: false, why: 'art', got: m[1] };
  return { ok: true };
}

/**
 * Cavab: "Nein, das ist kein Kaffee. Das ist ein Espresso. (Und das ist mein Espresso.)"
 * @returns {{ ok: boolean, why?: 'nein'|'negMissing'|'negArt'|'posMissing'|'posArt'|'mein', got?: string }}
 */
export function checkAnswer(input, x, y) {
  const t = fold(input);
  const xn = fold(x.n);
  const yn = fold(y.n);
  if (!/\bnein\b/.test(t)) return { ok: false, why: 'nein' };
  const neg = t.match(new RegExp(`das ist (\\S+) ${esc(xn)}\\b`));
  if (!neg) return { ok: false, why: 'negMissing' };
  if (neg[1] !== kein(x)) return { ok: false, why: 'negArt', got: neg[1] };
  // "Das ist ein Espresso" — inkar hissəsindən sonra
  const rest = t.slice(neg.index + neg[0].length);
  const pos = rest.match(new RegExp(`das ist (\\S+) ${esc(yn)}\\b`));
  if (!pos) return { ok: false, why: 'posMissing' };
  // "Das ist ein Espresso" və ya kitabdakı kimi "Das ist mein Apfelsaft" — hər ikisi düzdür
  if (/^mein/.test(pos[1])) {
    if (pos[1] !== mein(y)) return { ok: false, why: 'mein', got: pos[1] };
  } else if (pos[1] !== ein(y)) return { ok: false, why: 'posArt', got: pos[1] };
  // "mein / meine" (könüllü) — yazılıbsa düz olmalıdır
  const my = [...rest.matchAll(new RegExp(`\\b(mein\\S*) ${esc(yn)}\\b`, 'g'))];
  for (const mm of my) if (mm[1] !== mein(y)) return { ok: false, why: 'mein', got: mm[1] };
  return { ok: true };
}

/** Azərbaycanca izah */
export function explain(why, x, y, got) {
  const art = (it) => `${it.g} ${it.n} → ${ein(it)} / ${kein(it)} / ${mein(it)}`;
  const tip = (it) => (it.g === 'die' ? 'qadın cinsi (die) — sonuna -e gəlir' : `${it.g === 'der' ? 'kişi' : 'orta'} cinsi (${it.g}) — sonluq yoxdur`);
  switch (why) {
    case 'order':
      return 'Bəli/xeyr sualında FEL əvvəldə gəlir: "Ist das …?" ("Das ist …" adi cümlədir).';
    case 'noun':
      return `Şəkildəki söz: ${x.n}.`;
    case 'art':
      return `${art(x)}. ${x.n}: ${tip(x)}.${got === 'der' || got === 'die' || got === 'das' ? ' Sualda "ein / eine" işlənir, çünki əşya ilk dəfə deyilir.' : ''}`;
    case 'nein':
      return 'Cavab "Nein" ilə başlayır, çünki şəkildəki əşya o deyil.';
    case 'negMissing':
      return `İnkar cümləsi lazımdır: "Das ist ${kein(x)} ${x.n}."`;
    case 'negArt':
      return `İnkar: ein → kein, eine → keine. ${art(x)}.`;
    case 'posMissing':
      return `Sonra nə olduğunu de: "Das ist ${ein(y)} ${y.n}."`;
    case 'posArt':
      return `${art(y)}. ${y.n}: ${tip(y)}.`;
    case 'mein':
      return `Yiyəlik: mein (der / das), meine (die). ${art(y)}.`;
    default:
      return '';
  }
}

/** Müəllimin bəzən etdiyi tipik səhv (şagird tutmalıdır) — həmişə səhv cümlə qaytarır */
export function wrongAnswer(x, y, rnd = Math.random) {
  const flip = (a) => ({ ein: 'eine', eine: 'ein', kein: 'keine', keine: 'kein' })[a];
  const r = rnd();
  if (r < 0.5) return `Nein, das ist ${flip(kein(x))} ${x.n}. Das ist ${ein(y)} ${y.n}.`;
  if (r < 0.85) return `Nein, das ist ${kein(x)} ${x.n}. Das ist ${flip(ein(y))} ${y.n}.`;
  return `Nein, das ist nicht ${x.n}. Das ist ${ein(y)} ${y.n}.`;
}

function shuffle(a, rnd) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/**
 * Yeni oyun: n raund (✗ → ✓ cütləri), soruşan növbə ilə dəyişir, birinci soruşan təsadüfi.
 * Cütlərin yarısından çoxunda cins fərqlidir (ein ↔ eine məşqi). Az işlənən sözlər əvvəl.
 */
export function newGame(n = 10, used = {}, rnd = Math.random) {
  const first = rnd() < 0.5 ? 'L' : 'T';
  const byUse = (list) => shuffle(list, rnd).sort((a, b) => (used[a.n] || 0) - (used[b.n] || 0));
  const rounds = [];
  const seen = new Set();
  const grps = shuffle(['drink', 'drink', 'food', 'food', 'thing'], rnd);
  for (let i = 0; i < n; i++) {
    const grp = grps[i % grps.length];
    const pool = byUse(ITEMS.filter((it) => it.grp === grp && !seen.has(it.n)));
    const x = pool[0] || byUse(ITEMS.filter((it) => it.grp === grp))[0];
    const wantDiff = i % 3 !== 2; // 3 raunddan 2-də cins fərqli
    const ys = pool.filter((it) => it.n !== x.n && (wantDiff ? it.g !== x.g : true));
    const y = ys[0] || pool.find((it) => it.n !== x.n) || ITEMS.find((it) => it.grp === grp && it.n !== x.n);
    seen.add(x.n);
    seen.add(y.n);
    rounds.push({ x: x.n, y: y.n, asker: i % 2 === 0 ? first : first === 'L' ? 'T' : 'L' });
  }
  return { first, rounds };
}
