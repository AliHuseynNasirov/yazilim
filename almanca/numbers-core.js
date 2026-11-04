// Rəqəm dinləmə məşqi — UI-sız hissə (ayrıca test edilir).

const ONES = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const TEENS = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

// 0–99
function under100(n) {
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (!o) return TENS[t];
  return (o === 1 ? 'ein' : ONES[o]) + 'und' + TENS[t];
}

/** Rəqəmin almanca yazılışı (0–1000): 47 → "siebenundvierzig" */
export function germanNumber(n) {
  if (n === 1000) return 'tausend';
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = (h === 1 ? '' : ONES[h]) + 'hundert';
  if (!rest) return head;
  return head + (rest === 1 ? 'eins' : under100(rest));
}

/** Azərbaycanca kiçik izah: 25 → "fünf (5) + und + zwanzig (20): almanca əvvəl tək, sonra onluq deyilir" */
export function numberHint(n) {
  const r = n % 100;
  if (r > 20 && r % 10) {
    const o = r % 10;
    const t = r - o;
    return `${o === 1 ? 'ein' : ONES[o]} (${o}) + und + ${TENS[t / 10]} (${t}): almancada əvvəl TƏK, sonra ONLUQ deyilir.`;
  }
  if (r >= 13 && r <= 19) return `${TEENS[r - 10]}: ${r - 10} + zehn (10) → ${r}.`;
  return '';
}

/** Səhv rəqəmlərin yeri dəyişibmi (25 ↔ 52) */
export const isSwapped = (got, n) => {
  const s = String(n);
  return s.length === 2 && s[1] !== '0' && got === s[1] + s[0] && s[0] !== s[1];
};

export const RANGES = {
  small: { min: 0, max: 20, label: '0–20' },
  mid: { min: 0, max: 100, label: '0–100' },
  big: { min: 100, max: 1000, label: '100–1000' },
};

function shuffle(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Təsadüfi rəqəmlər siyahısı. Bütün rəqəmlər bir dəfə gəlmədən təkrar yoxdur;
 * eyni rəqəm ard-arda gəlmir.
 */
export function makeRound(count, range, rnd = Math.random) {
  const { min, max } = range;
  const pool = [];
  for (let i = min; i <= max; i++) pool.push(i);
  const out = [];
  while (out.length < count) {
    const bag = shuffle([...pool], rnd);
    if (out.length && bag[0] === out[out.length - 1]) bag.push(bag.shift());
    out.push(...bag);
  }
  return out.slice(0, count);
}
