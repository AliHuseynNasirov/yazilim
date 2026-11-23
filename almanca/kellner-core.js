// "Kellner und Gast" — kafe rol oyunu: UI-sız hissə (menyu, qiymətlər, sifarişin və pulun yoxlanması). Ayrıca test edilir.

import { germanNumber } from './numbers-core.js';
import { wordsToDigits } from './anmeldung-core.js';

// Menyu (sözlər kitabın A1.1 hissəsindəndir). p — sent; al — tanınma üçün əlavə yazılışlar
export const MENU = [
  { id: 'kaffee', n: 'Kaffee', g: 'der', e: '☕', p: 280, az: 'qəhvə', grp: 'drink' },
  { id: 'espresso', n: 'Espresso', g: 'der', e: '☕', p: 220, az: 'espresso', grp: 'drink' },
  { id: 'cappuccino', n: 'Cappuccino', g: 'der', e: '☕', p: 320, az: 'kapuçino', grp: 'drink', al: ['capuccino', 'kapuzino', 'cappucino'] },
  { id: 'tee', n: 'Tee', g: 'der', e: '🍵', p: 250, az: 'çay', grp: 'drink' },
  { id: 'kakao', n: 'Kakao', g: 'der', e: '🍫', p: 300, az: 'kakao', grp: 'drink' },
  { id: 'apfelsaft', n: 'Apfelsaft', g: 'der', e: '🧃', p: 270, az: 'alma şirəsi', grp: 'drink' },
  { id: 'orangensaft', n: 'Orangensaft', g: 'der', e: '🍊', p: 310, az: 'portağal şirəsi', grp: 'drink' },
  { id: 'wasser', n: 'Mineralwasser', g: 'das', e: '💧', p: 230, az: 'mineral su', grp: 'drink', al: ['wasser'] },
  { id: 'cola', n: 'Cola', g: 'die', e: '🥤', p: 290, az: 'kola', grp: 'drink', al: ['coca cola'] },
  { id: 'limonade', n: 'Limonade', g: 'die', e: '🍋', p: 290, az: 'limonad', grp: 'drink' },
  { id: 'croissant', n: 'Croissant', g: 'das', e: '🥐', p: 210, az: 'kruassan', grp: 'food', al: ['kroissant', 'croisant'] },
  { id: 'kuchen', n: 'Kuchen', g: 'der', e: '🍰', p: 350, az: 'tort', grp: 'food' },
  { id: 'suppe', n: 'Tomatensuppe', g: 'die', e: '🍅', p: 490, az: 'pomidor şorbası', grp: 'food', al: ['suppe'] },
  { id: 'salat', n: 'Salat', g: 'der', e: '🥗', p: 690, az: 'salat', grp: 'food' },
  { id: 'pizza', n: 'Pizza', g: 'die', e: '🍕', p: 850, az: 'pizza', grp: 'food' },
  { id: 'currywurst', n: 'Currywurst', g: 'die', e: '🌭', p: 720, az: 'körili kolbasa', grp: 'food', al: ['curry wurst'] },
];
export const itemById = (id) => MENU.find((x) => x.id === id);

const AKK = { der: 'einen', das: 'ein', die: 'eine' };
export const akk = (it) => AKK[it.g];

// ---------- mətn ----------
export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/€/g, ' euro ')
    .replace(/[!?;:"„“”()…–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const fold = (s) => norm(s).replace(/ä|ae/g, 'a').replace(/ö|oe/g, 'o').replace(/ü|ue/g, 'u');
const has = (t, re) => re.test(fold(t));

// ---------- pul ----------
export const euro = (c) => `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')} €`;
/** Almanca deyiliş: 460 → "vier Euro sechzig", 80 → "achtzig Cent", 1000 → "zehn Euro" */
export function euroWords(c) {
  const e = Math.floor(c / 100);
  const ct = c % 100;
  if (!e) return `${germanNumber(ct)} Cent`;
  const ew = e === 1 ? 'ein' : germanNumber(e);
  return ct ? `${ew} Euro ${germanNumber(ct)}` : `${ew} Euro`;
}

/** Danışıqdan məbləği tap (sentlə) — "vier Euro sechzig", "4,60", "4 Euro 60", "achtzig Cent" */
export function parseMoney(text) {
  let t = fold(text).replace(/\beins\b/g, 'ein');
  t = wordsToDigits(t.replace(/\bein euro\b/g, '1 euro'));
  t = t.replace(/(\d)\s*\.\s*(\d{2})\b/g, '$1,$2');
  let m = t.match(/(\d+)\s*,\s*(\d{1,2})/);
  if (m) return Number(m[1]) * 100 + Number(m[2].padEnd(2, '0'));
  m = t.match(/(\d+)\s*euro\s*(?:und\s*)?(\d{1,2})\b(?!\s*euro)/);
  if (m) return Number(m[1]) * 100 + Number(m[2]);
  m = t.match(/(\d+)\s*euro/);
  if (m) return Number(m[1]) * 100;
  m = t.match(/(\d+)\s*cent/);
  if (m) return Number(m[1]);
  return null;
}

// ---------- sifariş ----------
const NUMS = { zwei: 2, drei: 3, vier: 4, '2': 2, '3': 3, '4': 4 };
/**
 * Sifarişi tap və Akkusativ artiklını yoxla: "Ich möchte einen Kaffee und ein Croissant."
 * @returns {{ items: {id, qty}[], errors: {id, got, want}[] }}
 */
export function parseOrder(text) {
  const t = fold(text);
  const words = t.replace(/[.,]/g, ' ').split(' ').filter(Boolean);
  const items = [];
  const errors = [];
  const keys = MENU.flatMap((it) => [it.n, ...(it.al || [])].map((k) => ({ it, k: fold(k).split(' ') })));
  keys.sort((a, b) => b.k.length - a.k.length || b.k.join(' ').length - a.k.join(' ').length);
  const used = new Set();
  for (let i = 0; i < words.length; i++) {
    for (const { it, k } of keys) {
      if (used.has(i)) break;
      if (k.every((w, j) => words[i + j] === w || (j === k.length - 1 && words[i + j] === `${w}s`))) {
        for (let j = 0; j < k.length; j++) used.add(i + j);
        let qty = 1;
        let art = words[i - 1];
        if (NUMS[art]) {
          qty = NUMS[art];
          art = '';
        }
        const ex = items.find((x) => x.id === it.id);
        if (ex) ex.qty += qty;
        else items.push({ id: it.id, qty });
        if (['ein', 'eine', 'einen', 'einem', 'einer', 'der', 'die', 'das', 'den'].includes(art) && art !== akk(it)) errors.push({ id: it.id, got: art, want: akk(it) });
        break;
      }
    }
  }
  return { items, errors };
}
export const orderTotal = (order) => order.reduce((s, x) => s + itemById(x.id).p * x.qty, 0);
/** "einen Kaffee und ein Croissant" / "zwei Tee" */
export function orderPhrase(order) {
  const parts = order.map((x) => {
    const it = itemById(x.id);
    return x.qty > 1 ? `${germanNumber(x.qty)} ${it.n}` : `${akk(it)} ${it.n}`;
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}` : parts[0] || '';
}

/** Müəllim-müştəri üçün təsadüfi sifariş: 1 içki + (çox vaxt) 1 yemək */
export function randomOrder(rnd = Math.random) {
  const pick = (grp) => {
    const l = MENU.filter((x) => x.grp === grp);
    return l[Math.floor(rnd() * l.length)];
  };
  const o = [{ id: pick('drink').id, qty: 1 }];
  if (rnd() < 0.75) o.push({ id: pick('food').id, qty: 1 });
  return o;
}
/** Müştərinin verdiyi pul: hesabdan böyük ən yaxın əskinas (bəzən bir pillə böyük) — qalıq həmişə olsun */
export function payAmount(total, rnd = Math.random) {
  const notes = [500, 1000, 2000, 5000];
  const ok = notes.filter((n) => n > total);
  return ok[rnd() < 0.7 || ok.length < 2 ? 0 : 1];
}

// ---------- şagirdin cümlələrinin yoxlanması (hər addım üçün) ----------
// Hər biri: { ok, why?, az? }  — az: azərbaycanca izah (səhv olanda)
export const CHECK = {
  // Müştəri (şagird)
  order(text) {
    const { items, errors } = parseOrder(text);
    if (!items.length) return { ok: false, why: 'noItem', az: 'Menyudan bir şey sifariş et.' };
    if (errors.length) {
      const e = errors[0];
      const it = itemById(e.id);
      return { ok: false, why: 'art', items, az: `"${it.n}" — ${it.g} ${it.n}. Sifarişdə (Akkusativ): ${akk(it)} ${it.n} ("${e.got}" yox).` };
    }
    return { ok: true, items };
  },
  noThanks(text) {
    const { items, errors } = parseOrder(text);
    if (items.length && !errors.length && !has(text, /\bnein\b/)) return { ok: true, more: true, items };
    if (has(text, /\bnein\b/) && has(text, /\bdanke\b/)) return { ok: true };
    if (has(text, /\bnein\b/)) return { ok: false, why: 'polite', az: 'Nəzakətlə de: "Nein, danke."' };
    return { ok: false, why: 'noThanks', az: 'Başqa heç nə istəmirsənsə, de: "Nein, danke."' };
  },
  // ctx.form: bu oyunda qiyməti "Was macht das?" (macht) və ya "Was kostet das?" (kostet) ilə soruşmaq
  pay(text, ctx = {}) {
    const wantPay = has(text, /\b(be)?zahlen\b|\brechnung\b/);
    const askPrice = has(text, /was macht das|wie ?viel (kostet|macht)|was kostet/);
    if (!ctx.form) {
      if (wantPay && askPrice) return { ok: true };
      if (wantPay) return { ok: false, why: 'price', az: 'Qiyməti də soruş: "Was macht das?" və ya "Wie viel kostet das?"' };
      if (askPrice) return { ok: false, why: 'zahlen', az: 'Əvvəl ödəmək istədiyini de: "Ich möchte bitte zahlen."' };
      return { ok: false, why: 'pay', az: 'De: "Ich möchte bitte zahlen. Was macht das?"' };
    }
    const f = ctx.form;
    const other = f === 'macht' ? 'kostet' : 'macht';
    const full = `"Ich möchte bitte zahlen. Die Rechnung, bitte. Was ${f} das?"`;
    if (!has(text, /\b(be)?zahlen\b/)) return { ok: false, why: 'zahlen', az: `Əvvəl ödəmək istədiyini de: "Ich möchte bitte zahlen." Sonra hesabı istə və qiyməti soruş: ${full}` };
    if (!has(text, /\brechnung\b/)) return { ok: false, why: 'rechnung', az: `Hesabı da istə: "Die Rechnung, bitte." Hamısı birlikdə: ${full}` };
    if (!has(text, new RegExp(`was ${f} das|wie ?viel ${f}`))) {
      if (has(text, new RegExp(`was ${other} das|wie ?viel ${other}`))) return { ok: false, why: 'form', az: `Bu oyunda qiyməti "Was ${f} das?" ilə soruş ("Was ${other} das?" yox). Növbəti oyunda o biri gələcək.` };
      return { ok: false, why: 'price', az: `Qiyməti də soruş: "Was ${f} das?" Hamısı birlikdə: ${full}` };
    }
    return { ok: true };
  },
  // nağd və ya kart
  payMethod(text) {
    const bar = has(text, /\bbar\b|\bbargeld\b/);
    const karte = has(text, /\b(kredit|ec ?|bank)?karte\b/);
    if (bar && !karte) return { ok: true, val: 'bar' };
    if (karte && !bar) return { ok: true, val: 'karte' };
    if (bar && karte) return { ok: false, why: 'both', az: 'Birini seç: "Bar, bitte." (nağd) və ya "Mit Karte, bitte." (kartla).' };
    return { ok: false, why: 'method', az: 'Cavab ver: "Bar, bitte." (nağd) və ya "Mit Karte, bitte." (kartla).' };
  },
  askMethod(text) {
    if (has(text, /\bbar\b/) && has(text, /\bkarte\b/)) return { ok: true };
    return { ok: false, why: 'askMethod', az: 'Soruş: "Zahlen Sie bar oder mit Karte?" (nağd, yoxsa kartla?)' };
  },
  cardDevice(text) {
    if (has(text, /karten ?gerat|\bgerat\b|kartenleser|lesegerat|terminal/)) return { ok: true };
    return { ok: false, why: 'card', az: 'Kart aparatını ver: "Hier ist das Kartengerät."' };
  },
  together(text) {
    if (has(text, /\bzusammen\b/)) return { ok: true, val: 'zusammen' };
    if (has(text, /\bgetrennt\b/)) return { ok: true, val: 'getrennt' };
    return { ok: false, why: 'tog', az: 'Cavab ver: "Zusammen, bitte." və ya "Getrennt, bitte."' };
  },
  give(text, ctx) {
    const c = parseMoney(text);
    if (c == null) return { ok: false, why: 'noMoney', az: `Pulu ver və məbləği de: "Hier sind ${euroWords(payAmount(ctx.total))}."` };
    if (c < ctx.total) return { ok: false, why: 'less', az: `Bu, azdır: hesab ${euroWords(ctx.total)} (${euro(ctx.total)}) edir. Daha çox ver.` };
    return { ok: true, val: c };
  },
  keepChange(text) {
    if (has(text, /stimmt so/)) return { ok: true };
    if (has(text, /\bdanke\b/)) return { ok: true };
    return { ok: false, why: 'stimmt', az: 'De: "Stimmt so, danke!"' };
  },
  bye(text) {
    if (has(text, /wiedersehen|tschuss|tschuess|schonen tag|bis bald/)) return { ok: true };
    return { ok: false, why: 'bye', az: 'Vidalaş: "Auf Wiedersehen!" və ya "Tschüss!"' };
  },
  // Ofisiant (şagird)
  askOrder(text) {
    if (has(text, /was mochten sie|was darf es sein|was hatten sie gern|was nehmen sie|was mochtest du/)) return { ok: true };
    if (has(text, /\bmochten\b/)) return { ok: false, why: 'askOrder', az: 'Sual belə qurulur: "Was möchten Sie?" (fel 2-ci yerdə, "Sie" — rəsmi).' };
    return { ok: false, why: 'askOrder', az: 'Salam ver və soruş: "Guten Tag! Was möchten Sie?"' };
  },
  askMore(text) {
    if (has(text, /noch etwas|sonst noch|noch was|noch einen wunsch/)) return { ok: true };
    return { ok: false, why: 'askMore', az: 'Soruş: "Möchten Sie noch etwas?" və ya "Möchten Sie sonst noch etwas?"' };
  },
  price(text, ctx) {
    const f = ctx.form || 'macht';
    const c = parseMoney(text);
    if (c == null) return { ok: false, why: 'noPrice', az: `Qiyməti de: "Das ${f} ${euroWords(ctx.total)}."` };
    if (c !== ctx.total) return { ok: false, why: 'wrongPrice', az: `Qiymət düz deyil (${euro(c)}). Hesaba bax: ${euro(ctx.total)} — "Das ${f} ${euroWords(ctx.total)}."` };
    // müştəri hansı feli işlətdisə (macht / kostet), cavabda da o olmalıdır
    if (ctx.form && !has(text, new RegExp(`\\b${f}\\b`))) return { ok: false, why: 'form', az: `Müştəri "Was ${f} das?" soruşdu — cavabda da "${f}" işlət: "Das ${f} ${euroWords(ctx.total)}."` };
    return { ok: true };
  },
  askTogether(text) {
    if (has(text, /zusammen/) && has(text, /getrennt/)) return { ok: true };
    return { ok: false, why: 'askTog', az: 'Soruş: "Zusammen oder getrennt?"' };
  },
  change(text, ctx) {
    const want = ctx.paid - ctx.total;
    const c = parseMoney(text);
    if (c === want && has(text, /zuruck|zurueck|bitte|danke/)) return { ok: true };
    if (c === want) return { ok: false, why: 'zurueck', az: `Qalığı belə qaytar: "${euroWords(want)} zurück."` };
    if (c == null) return { ok: false, why: 'noChange', az: `Qalığı de: ${euro(ctx.paid)} − ${euro(ctx.total)} = ${euro(want)} → "${euroWords(want)} zurück."` };
    return { ok: false, why: 'wrongChange', az: `Qalıq düz deyil: ${euro(ctx.paid)} − ${euro(ctx.total)} = ${euro(want)} → "${euroWords(want)} zurück."` };
  },
  byeWaiter(text) {
    if (has(text, /wiedersehen|tschuss|tschuess|schonen tag|danke/)) return { ok: true };
    return { ok: false, why: 'bye', az: 'Təşəkkür et və vidalaş: "Vielen Dank! Auf Wiedersehen!"' };
  },
};
