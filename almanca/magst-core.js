// "Magst du …? Isst du gern …?" (Das Leben A1, 4-cü bölmə, c): hər oyunda bir yemək, 6 cavab forması.
// DOM yoxdur — test olunur.

export const FOODS = [
  { id: 'schnitzel', n: 'Schnitzel', g: 'das', e: '🍖', az: 'şnitsel', re: 'schnitzel' },
  { id: 'haehnchen', n: 'Hähnchen', g: 'das', e: '🍗', az: 'toyuq', re: 'h(a|u)hnchen' },
  { id: 'hamburger', n: 'Hamburger', g: 'der', e: '🍔', az: 'hamburger', re: '(ham)?burger' },
  { id: 'steak', n: 'Steak', g: 'das', e: '🥩', az: 'steyk', re: 'steak' },
  { id: 'fisch', n: 'Fisch', g: 'der', e: '🐟', az: 'balıq', re: 'fisch' },
  { id: 'kaese', n: 'Käse', g: 'der', e: '🧀', az: 'pendir', re: 'kase' },
  { id: 'gemuese', n: 'Gemüse', g: 'das', e: '🥦', az: 'tərəvəz', re: 'gemuse' },
  { id: 'oliven', n: 'Oliven', g: 'pl', e: '🫒', az: 'zeytun', re: 'oliven?' },
];
export const foodById = (id) => FOODS.find((f) => f.id === id) || FOODS[0];

// 6 cavab forması (kitabdakı kimi)
export const FORMS6 = [
  { k: 'f+', pos: true, t: 'Ja, ich finde … lecker.', de: (x) => `Ja, ich finde ${x} lecker.`, az: 'Bəli, məncə … dadlıdır.' },
  { k: 'm+', pos: true, t: 'Ja, ich mag … gern.', de: (x) => `Ja, ich mag ${x} gern.`, az: 'Bəli, xoşlayıram: …' },
  { k: 'e+', pos: true, t: 'Ja, ich esse … gern.', de: (x) => `Ja, ich esse ${x} gern.`, az: 'Bəli, … yeməyi xoşlayıram.' },
  { k: 'f-', pos: false, t: 'Nein, ich finde … nicht lecker.', de: (x) => `Nein, ich finde ${x} nicht lecker.`, az: 'Xeyr, məncə … dadlı deyil.' },
  { k: 'm-', pos: false, t: 'Nein, ich mag … nicht (gern).', de: (x) => `Nein, ich mag ${x} nicht.`, az: 'Xeyr, xoşlamıram: …' },
  { k: 'e-', pos: false, t: 'Nein, ich esse … nicht (gern).', de: (x) => `Nein, ich esse ${x} nicht gern.`, az: 'Xeyr, … yeməyi xoşlamıram.' },
];
export const formByK = (k) => FORMS6.find((f) => f.k === k);

export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä|ae/g, 'a')
    .replace(/ö|oe/g, 'o')
    .replace(/ü|ue/g, 'u')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Müəllimin sualları (6 sual — növbə ilə Magst / Isst)
export function questions(food, rnd = Math.random) {
  const x = food.n;
  const a = [`Magst du ${x}?`, `Isst du gern ${x}?`, `Magst du gern ${x}?`, `Isst du ${x}?`, `Magst du ${x}?`, `Isst du gern ${x}?`];
  return rnd() < 0.5 ? a : a.map((_, i) => a[(i + 1) % a.length]);
}

// Şagirdin cavabı: hansı forma? {ok, k, az}
export function classify(text, food) {
  const n0 = norm(text);
  const ja = /^ja\b/.test(n0);
  const nein = /^nein\b/.test(n0);
  const n = n0.replace(/^(ja|nein)\b ?/, '');
  const F = `(?:(?:den|die|das) )?${food.re}`; // "den Fisch" də olar
  const G = 'gerne?';
  const hasFood = new RegExp(`\\b${food.re}\\b`).test(n);
  const ex = (k) => formByK(k).de(food.n);

  // fel səhvləri
  if (/\bich (magst|mogen|mogt|magt)\b/.test(n)) return { ok: false, az: `"ich" ilə: "ich mag" — məsələn: "${ex('m+')}"` };
  if (/\bich (isst|esst|essen|isse)\b/.test(n)) return { ok: false, az: `"ich" ilə: "ich esse" ("isst" — du / er üçündür) — məsələn: "${ex('e+')}"` };
  if (/\bich (findest|findet|finden)\b/.test(n)) return { ok: false, az: `"ich" ilə: "ich finde" — məsələn: "${ex('f+')}"` };
  if (/\bdu (magst|isst|findest)\b/.test(n)) return { ok: false, az: 'Sual "du" ilədir — cavabı "ich" ilə ver: "Ja, ich …" / "Nein, ich …".' };
  if (!hasFood) {
    const other = FOODS.find((f) => f.id !== food.id && new RegExp(`\\b${f.re}\\b`).test(n));
    return { ok: false, az: other ? `Bu oyunun yeməyi "${food.n}"-dir ("${other.n}" yox).` : `Yeməyin adını da de: "${ex('m+')}"` };
  }
  // artikl: yalnız düzgün müəyyən artikl (Akkusativ) — "den Fisch", "das Schnitzel", "die Oliven"
  const art = n.match(new RegExp(`\\b(der|die|das|den|dem|ein|eine|einen|kein|keine|keinen) ${food.re}\\b`));
  if (art) {
    const good = { der: 'den', das: 'das', pl: 'die' }[food.g];
    if (art[1] !== good) return { ok: false, az: `Artiklsız de ("${food.n}") və ya "${good} ${food.n}" (Akkusativ) — "${art[1]}" yox.` };
  }
  // nicht-in yeri
  if (new RegExp(`\\bich (mag|finde) nicht ${F}\\b`).test(n)) return { ok: false, az: `"nicht" yeməkdən sonra gəlir: "${n.includes('finde') ? ex('f-') : ex('m-')}"` };
  if (new RegExp(`\\bich esse ${F} ${G} nicht\\b`).test(n)) return { ok: false, az: `"nicht" "gern"-dən əvvəl gəlir: "${ex('e-')}"` };
  if (new RegExp(`\\bich finde ${F} lecker nicht\\b`).test(n)) return { ok: false, az: `"nicht" "lecker"-dən əvvəl gəlir: "${ex('f-')}"` };

  const neg = /\bnicht\b|\bkein/.test(n);
  let k = null;
  if (!neg) {
    if (new RegExp(`\\bich finde ${F} (sehr |super |total )?lecker\\b|\\b${F} finde ich (sehr )?lecker\\b`).test(n)) k = 'f+';
    else if (new RegExp(`\\bich mag ${F}( (sehr )?${G})?\\b|\\bich mag (sehr )?${G} ${F}\\b`).test(n)) k = 'm+';
    else if (new RegExp(`\\bich esse ${F} (sehr )?${G}\\b|\\bich esse (sehr )?${G} ${F}\\b`).test(n)) k = 'e+';
    else if (new RegExp(`\\bich esse ${F}\\b`).test(n)) return { ok: false, az: `Kitabdakı kimi "gern" əlavə et: "${ex('e+')}"` };
  } else {
    if (new RegExp(`\\bich finde ${F} nicht (so |sehr )?lecker\\b|\\b${F} finde ich nicht lecker\\b`).test(n)) k = 'f-';
    else if (new RegExp(`\\bich mag ${F} nicht( ${G})?\\b`).test(n)) k = 'm-';
    else if (new RegExp(`\\bich esse ${F} nicht( ${G})?\\b|\\bich esse nicht ${G} ${F}\\b`).test(n)) k = 'e-';
  }
  if (!k) return { ok: false, az: `Kitabdakı cavablardan biri ilə de, məsələn: "${ex('m+')}" və ya "${ex('m-')}"` };
  const f = formByK(k);
  if (f.pos && nein) return { ok: false, az: `"Nein" deyirsən, amma cümlə təsdiqdir. İnkar: "${formByK(k.replace('+', '-')).de(food.n)}"` };
  if (!f.pos && ja) return { ok: false, az: `"Ja" deyirsən, amma cümlə inkardır. Təsdiq: "${formByK(k.replace('-', '+')).de(food.n)}"` };
  return { ok: true, k };
}
