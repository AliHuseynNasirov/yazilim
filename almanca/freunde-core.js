// "Zwei Freunde im Restaurant" (Akkusativ): menyu (Max & Moritz), yeməklərin cinsi, cümlə yoxlamaları. DOM yoxdur — test olunur.
//
// Oyun "gibt es" və ya "haben die" forması ilə gedir (hər yeni oyunda növbə ilə dəyişir).

// ---------- menyu (kitab: Restaurant Max & Moritz) ----------
export const MENU = [
  { id: 'suppe', n: 'Tomatensuppe', full: 'Tomatensuppe mit Baguette', g: 'die', p: 450, e: '🍅', sec: 'vor', veg: true, az: 'pomidor şorbası, baget ilə', re: /\b(tomatensuppe|suppe)\b/, like: 'Die Tomatensuppe ist vegetarisch und lecker!' },
  { id: 'salat', n: 'Salat', full: 'Salat mit Käse, Tomaten und Oliven', g: 'der', p: 580, e: '🥗', sec: 'vor', veg: true, az: 'salat: pendir, pomidor və zeytun ilə', re: /\bsalat\b/, like: 'Salat ist gesund und vegetarisch!' },
  { id: 'steak', n: 'Steak', full: 'Steak mit Kartoffeln und Salat', g: 'das', p: 1580, e: '🥩', sec: 'haupt', az: 'steyk, kartof və salat ilə', re: /\bsteak\b/, like: 'Steak ist super lecker — aber teuer!' },
  { id: 'schnitzel', n: 'Schnitzel', full: 'Schnitzel mit Kartoffelsalat', g: 'das', p: 1190, e: '🍖', sec: 'haupt', pork: true, az: 'şnitsel (donuz əti), kartof salatı ilə', re: /\bschnitzel\b/, like: 'Ich liebe Schnitzel! Das ist vom Schwein.' },
  { id: 'haehnchen', n: 'Hähnchen', full: 'Hähnchen mit Gemüse', g: 'das', p: 1270, e: '🍗', sec: 'haupt', az: 'toyuq, tərəvəz ilə', re: /\b(hahnchen|huhnchen|hendl)\b/, like: 'Hähnchen mit Gemüse ist lecker und gesund!' },
  { id: 'hamburger', n: 'Hamburger', full: 'Hamburger mit Pommes Frites', g: 'der', p: 980, e: '🍔', sec: 'haupt', az: 'hamburger, kartof fri ilə', re: /\b(hamburger|burger)\b/, like: 'Ich esse gern Hamburger mit Pommes!' },
  { id: 'fisch', n: 'Fisch', full: 'Fisch mit Kartoffelsalat', g: 'der', p: 1030, e: '🐟', sec: 'haupt', az: 'balıq, kartof salatı ilə', re: /\bfisch\b/, like: 'Fisch ist gesund und lecker!' },
  { id: 'curry', n: 'Gemüsecurry', full: 'Gemüsecurry mit Tofu und Reis', g: 'das', p: 1050, e: '🍛', sec: 'haupt', veg: true, az: 'tərəvəz karrisi, tofu və düyü ilə', re: /\b(gemusecurry|curry)\b/, like: 'Das Curry ist vegetarisch und ein bisschen scharf!' },
];
// menyuda OLMAYAN yeməklər ("Nein, es gibt keine Pizza.")
export const OFF = [
  { id: 'pizza', n: 'Pizza', g: 'die', e: '🍕', az: 'pizza', re: /\bpizza\b/ },
  { id: 'doener', n: 'Döner', g: 'der', e: '🥙', az: 'dönər', re: /\b(doner|dona|donner)\b/ },
  { id: 'currywurst', n: 'Currywurst', g: 'die', e: '🌭', az: 'karri kolbasa', re: /\bcurrywurst\b/ },
  { id: 'lasagne', n: 'Lasagne', g: 'die', e: '🍝', az: 'lazanya', re: /\b(lasagne|lasagna)\b/ },
  { id: 'sushi', n: 'Sushi', g: 'das', e: '🍣', az: 'suşi', re: /\bsushi\b/ },
  { id: 'eis', n: 'Eis', g: 'das', e: '🍨', az: 'dondurma', re: /\beis\b/ },
  { id: 'kuchen', n: 'Kuchen', g: 'der', e: '🍰', az: 'tort', re: /\bkuchen\b/ },
];
// ---------- yeməyin mənşəyi və tərkibi ("Was ist das?") ----------
export const LANDS = {
  frankreich: { de: 'aus Frankreich', az: 'Fransadan', re: /frankreich/ },
  griechenland: { de: 'aus Griechenland', az: 'Yunanıstandan', re: /griechenland/ },
  argentinien: { de: 'aus Argentinien', az: 'Argentinadan', re: /argentinien/ },
  osterreich: { de: 'aus Österreich', az: 'Avstriyadan', re: /osterreich/ },
  deutschland: { de: 'aus Deutschland', az: 'Almaniyadan', re: /deutschland/ },
  usa: { de: 'aus den USA', az: 'ABŞ-dan', re: /\busa\b|amerika/, art: 'den' },
  norddeutschland: { de: 'aus Norddeutschland', az: 'Şimali Almaniyadan', re: /norddeutschland|deutschland/ },
  indien: { de: 'aus Indien', az: 'Hindistandan', re: /indien/ },
};
// land — mənşə; say — Lena-nın izahı / şagirdin nümunəsi; ing — tərkib (ən azı biri deyilməlidir)
export const ORIGIN = {
  suppe: { land: 'frankreich', say: 'Das ist eine Suppe mit Tomaten. Das Baguette ist ein Brot aus Frankreich.', zut: 'eine Suppe mit Tomaten, mit Brot', zutAz: 'pomidor şorbası, çörəklə', ing: /tomate|brot|baguette/, spez: false },
  salat: { land: 'griechenland', say: 'Das ist eine Spezialität aus Griechenland. Das ist Salat mit Käse, Tomaten und Oliven.', zut: 'mit Käse, Tomaten und Oliven', zutAz: 'pendir, pomidor və zeytunla', ing: /kase|tomate|olive/ },
  steak: { land: 'argentinien', say: 'Das ist eine Spezialität aus Argentinien. Das ist Rindfleisch mit Kartoffeln.', zut: 'Rindfleisch mit Kartoffeln', zutAz: 'mal əti, kartofla', ing: /fleisch|kartoffel/ },
  schnitzel: { land: 'osterreich', say: 'Das ist eine Spezialität aus Österreich. Das ist Schweinefleisch mit Kartoffelsalat.', zut: 'Schweinefleisch mit Kartoffelsalat', zutAz: 'donuz əti, kartof salatı ilə', ing: /fleisch|kartoffel/ },
  haehnchen: { land: 'deutschland', say: 'Das ist eine Spezialität aus Deutschland. Das ist Hähnchen mit Gemüse.', zut: 'Hähnchen mit Gemüse', zutAz: 'toyuq, tərəvəzlə', ing: /hahnchen|huhnchen|gemuse|fleisch/ },
  hamburger: { land: 'usa', say: 'Das ist eine Spezialität aus den USA. Das ist Fleisch und Brot, mit Pommes Frites.', zut: 'Fleisch und Brot, mit Pommes Frites', zutAz: 'ət və çörək, kartof fri ilə', ing: /fleisch|brot|pommes/ },
  fisch: { land: 'norddeutschland', say: 'Das ist eine Spezialität aus Norddeutschland. Das ist Fisch mit Kartoffelsalat.', zut: 'Fisch mit Kartoffelsalat', zutAz: 'balıq, kartof salatı ilə', ing: /fisch|kartoffel/ },
  curry: { land: 'indien', say: 'Das ist eine Spezialität aus Indien. Das ist Gemüse mit Tofu und Reis.', zut: 'Gemüse mit Tofu und Reis', zutAz: 'tərəvəz, tofu və düyü ilə', ing: /gemuse|tofu|reis/ },
};

export const ALL = [...OFF, ...MENU]; // OFF əvvəl: "Currywurst" "Curry" kimi tanınmasın
export const dishById = (id) => ALL.find((x) => x.id === id);
export const onMenu = (d) => MENU.includes(d);

// Akkusativ artiklları
export const ART = {
  der: { ind: 'einen', neg: 'keinen', def: 'den', nom: 'ein' },
  die: { ind: 'eine', neg: 'keine', def: 'die', nom: 'eine' },
  das: { ind: 'ein', neg: 'kein', def: 'das', nom: 'ein' },
};
export const akk = (d) => `${ART[d.g].ind} ${d.n}`; // einen Salat
export const akkNeg = (d) => `${ART[d.g].neg} ${d.n}`; // keinen Salat
export const euro = (c) => `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')} €`;

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

// ---------- forma ----------
export const FORMS = {
  gibt: { q: 'Gibt es hier', yes: 'Ja, es gibt', no: 'Nein, es gibt', az: '"Gibt es hier …?" — "Ja, es gibt …" / "Nein, es gibt kein…"' },
  haben: { q: 'Haben die hier', yes: 'Ja, die haben', no: 'Nein, die haben', az: '"Haben die hier …?" — "Ja, die haben …" / "Nein, die haben kein…"' },
};
const isGibt = (n) => /\bgibt es\b|\bes gibt\b/.test(n);
const isHaben = (n) => /\bhaben (die|sie)\b|\b(die|sie) haben\b/.test(n);

// Mətndə yemək və onun artikli
const ARTS = ['ein', 'eine', 'einen', 'einem', 'einer', 'kein', 'keine', 'keinen', 'der', 'die', 'das', 'den', 'dem'];
export function findDish(text) {
  const n = norm(text);
  const toks = n.split(' ');
  // mətndə ən əvvəl gələn yemək ("Steak mit Kartoffeln und Salat" → Steak)
  for (let i = 0; i < toks.length; i++) {
    const d = ALL.find((x) => x.re.test(toks[i]));
    if (d) {
      const prev = toks[i - 1];
      return { d, art: ARTS.includes(prev) ? prev : null };
    }
  }
  return null;
}

// artikl yoxlaması: want — 'ind' | 'neg'
function artErr(found, want) {
  const { d, art } = found;
  const good = ART[d.g][want];
  if (art === good) return null;
  if (!art) return `Artikl lazımdır: "${good} ${d.n}" (${d.g} ${d.n}).`;
  if (d.g === 'der' && art === ART.der.nom.replace('ein', want === 'neg' ? 'kein' : 'ein'))
    return `"${d.n}" — der-sözdür. Akkusativdə "${art}" yox, "${good}" olur: "${good} ${d.n}".`;
  return `"${d.n}" — ${d.g}-sözdür (${d.g} ${d.n}). Akkusativdə: "${good} ${d.n}" ("${art}" yox).`;
}

// ---------- yoxlamalar ----------
// 1) "Wie geht's dir?" → "Gut, danke! Und dir?"
export function checkHow(text) {
  const n = norm(text);
  const mood = /\b(gut|super|prima|toll|sehr gut|es geht|nicht so gut|schlecht|ganz gut|okay|ok)\b/.test(n);
  const back = /\bund dir\b|\bund du\b|wie geht s? (es )?dir|wie gehts dir/.test(n);
  if (mood && back) return { ok: true };
  if (mood) return { ok: false, az: 'Dostundan da soruş: "Und dir?" (Bəs sən?)' };
  return { ok: false, az: 'Necə olduğunu de və dostundan da soruş: "Gut, danke! Und dir?"' };
}

// 2) Şagird soruşur: "Gibt es hier eine Tomatensuppe?" / "Haben die hier eine Tomatensuppe?"
export function checkAsk(text, form) {
  const n = norm(text);
  const F = FORMS[form];
  const other = form === 'gibt' ? 'haben' : 'gibt';
  const f = findDish(text);
  const ex = `${F.q} eine Tomatensuppe?`;
  if (!f) return { ok: false, az: `Menyudan bir yemək soruş: "${ex}"` };
  const right = form === 'gibt' ? isGibt(n) : isHaben(n);
  const wrong = form === 'gibt' ? isHaben(n) : isGibt(n);
  if (!right && wrong) return { ok: false, az: `Bu oyunda "${F.q} …?" ilə soruş ("${FORMS[other].q} …?" yox). Növbəti oyunda o biri gələcək.`, dish: f.d.id };
  if (!right) return { ok: false, az: `Sual belə olur: "${F.q} ${akk(f.d)}?"`, dish: f.d.id };
  if (!/^(gibt|haben)\b/.test(n)) return { ok: false, az: `Sualda fel əvvəldə olur: "${F.q} ${akk(f.d)}?"`, dish: f.d.id };
  const e = artErr(f, 'ind');
  if (e) return { ok: false, az: e, dish: f.d.id };
  return { ok: true, dish: f.d.id };
}

// 3) Yemək haqqında fikir: "Super, ich nehme die Tomatensuppe. Ich esse gern Suppe."
const LIKE = /\b(ich nehme|ich mag|ich esse gerne?|ich liebe|ich mochte|ich bestelle|lecker|super|toll|prima|gut|vegetarisch|gesund|scharf|schmeckt)\b/;
export function checkLike(text) {
  const n = norm(text);
  if (!LIKE.test(n)) return { ok: false, az: 'Yemək haqqında fikrini de: "Super! Ich nehme die Tomatensuppe. Ich esse gern Suppe." və ya "Lecker!"' };
  // nehme / mag / esse / liebe + artikl + yemək → Akkusativ
  const m = n.match(/\b(nehme|mag|esse|liebe|mochte|bestelle) (ein|eine|einen|kein|keine|keinen|der|die|das|den)? ?(\w+)/);
  if (m && m[2]) {
    const d = ALL.find((x) => x.re.test(m[3]));
    if (d) {
      const ok = [ART[d.g].ind, ART[d.g].neg, ART[d.g].def];
      if (!ok.includes(m[2])) return { ok: false, az: `"${m[1]}" Akkusativ istəyir: "${d.g} ${d.n}" → "${ART[d.g].def} ${d.n}" / "${ART[d.g].ind} ${d.n}" ("${m[2]}" yox).` };
    }
  }
  if (/\bich (nimmst|nimmt|magst|isst|liebst)\b/.test(n)) return { ok: false, az: '"ich" ilə: ich nehme · ich mag · ich esse · ich liebe.' };
  return { ok: true, back: /was nimmst du|und du|was isst du|was mochtest du|und was nimmst/.test(n) };
}
// 4) "Und was nimmst du?"
export function checkBack(text) {
  const n = norm(text);
  if (/was nimmst du|und du\b|was isst du|was mochtest du|was nimmst denn du|und was nimmst/.test(n)) return { ok: true };
  if (/was nimmt du|was nehmst du|was nehme du/.test(n)) return { ok: false, az: '"du" ilə: "Was nimmst du?" (nehmen → du nimmst).' };
  return { ok: false, az: 'İndi dostundan soruş: "Und was nimmst du?"' };
}

// 5) Dost soruşur, şagird menyuya baxıb cavab verir
export function checkAnswer(text, dishId, form) {
  const d = dishById(dishId);
  const n = norm(text);
  const F = FORMS[form];
  const has = onMenu(d);
  const good = has ? `${F.yes} ${akk(d)}.` : `${F.no} ${akkNeg(d)}.`;
  const ja = /^ja\b/.test(n), nein = /^nein\b/.test(n);
  const neg = /\bkein(e|en)?\b|\bnicht\b/.test(n);
  if (has && (nein || (neg && !ja))) return { ok: false, az: `Menyuya bax: "${d.full}" var (${euro(d.p)}). Cavab: "${good}"` };
  if (!has && (ja || (!neg && !nein))) return { ok: false, az: `Menyuya bax: "${d.n}" yoxdur. Cavab: "${good}"` };
  const right = form === 'gibt' ? /\bes gibt\b/.test(n) : /\b(die|sie) haben\b/.test(n);
  const wrong = form === 'gibt' ? /\b(die|sie) haben\b/.test(n) : /\bes gibt\b/.test(n);
  if (!right && wrong) return { ok: false, az: `Dostun "${F.q} …?" soruşdu — eyni formada cavab ver: "${good}"` };
  if (!right) return { ok: false, az: `Tam cümlə ilə cavab ver: "${good}"` };
  const f = findDish(text);
  if (!f || f.d.id !== d.id) return { ok: false, az: `Yeməyin adını da de: "${good}"` };
  const e = artErr(f, has ? 'ind' : 'neg');
  if (e) return { ok: false, az: e };
  return { ok: true };
}
// 5a) "Was ist das?" (yeməyin nə olduğunu soruşmaq)
export function checkWhatIs(text) {
  const n = norm(text);
  if (/\bwas ist\b/.test(n)) return { ok: true };
  if (/\bwas (das|es) ist\b/.test(n)) return { ok: false, az: 'Sualda fel ikinci yerdədir: "Was ist das?"' };
  return { ok: false, az: 'Dostunun yeməyi haqqında soruş: "Was ist das?"' };
}
// 5b) Yeməyi izah etmək: "Das ist eine Spezialität aus Österreich. Das ist Schweinefleisch mit Kartoffelsalat."
export function checkExplain(text, dishId) {
  const o = ORIGIN[dishId];
  if (!o) return { ok: true };
  const n = norm(text);
  const L = LANDS[o.land];
  if (/\bein spezialitat/.test(n)) return { ok: false, az: `"die Spezialität" — die-sözdür: "eine Spezialität" ("ein" yox). Nümunə: "${o.say}"` };
  const other = Object.entries(LANDS).find(([k, x]) => k !== o.land && !(o.land === 'norddeutschland' && k === 'deutschland') && !(o.land === 'deutschland' && k === 'norddeutschland') && x.re.test(n));
  const said = n.match(/\baus (?:der |den |dem )?([a-z]+)/);
  if (!L.re.test(n)) {
    const wrong = other ? other[1].de : said ? `aus ${said[1].charAt(0).toUpperCase()}${said[1].slice(1)}` : null;
    return { ok: false, az: wrong ? `Menyuya bax: bu yemək ${L.de} (${L.az}) — "${wrong}" yox. Nümunə: "${o.say}"` : `Haradan olduğunu de: "${L.de}". Nümunə: "${o.say}"` };
  }
  if (L.art && !new RegExp(`\\baus ${L.art} `).test(n)) return { ok: false, az: `"USA" cəmdir — artikl ilə: "aus den USA". Nümunə: "${o.say}"` };
  if (!/\baus\b/.test(n)) return { ok: false, az: `Haradan? — "aus": "${L.de}". Nümunə: "${o.say}"` };
  if (!o.ing.test(n)) return { ok: false, az: `Tərkibini də de: "${o.zut}". Nümunə: "${o.say}"` };
  return { ok: true };
}

// 6) "Guten Appetit!"
export function checkBye(text) {
  const n = norm(text);
  if (/guten appetit|lass es dir schmecken|danke|dir auch/.test(n)) return { ok: true };
  return { ok: false, az: 'Yeməkdən əvvəl de: "Guten Appetit!"' };
}

// ---------- dostun (müəllimin) sözləri ----------
export const T = {
  greet: () => 'Hallo! Wie geht\'s dir?',
  menu: () => 'Mir geht\'s auch gut, danke! Schau mal, hier ist die Speisekarte. Was nimmst du?',
  yes: (d, form) => `${FORMS[form].yes} ${akk(d)}${d.full.slice(d.n.length)}.`, // Ja, es gibt eine Tomatensuppe mit Baguette.
  no: (d, form) => `${FORMS[form].no} ${akkNeg(d)}. Schau mal in die Speisekarte!`,
  ask: (d, form) => `Hmm… ${FORMS[form].q} ${akk(d)}?`,
  schade: (d, form) => `Schade! ${FORMS[form].q} ${akk(d)}?`,
  like: (d) => `Super! Dann nehme ich ${akk(d)}. ${d.like}`,
  what: () => 'Hmm, lecker! Was ist das?',
  explain: (d) => ORIGIN[d.id].say,
  bye: () => 'Danke, dir auch! Guten Appetit!',
};

// Dostun seçimləri: əvvəl (50%) menyuda olmayan, sonra menyuda olan (şagirdin yeməyindən fərqli)
export function friendPlan(rnd = Math.random, avoid = null) {
  const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
  const on = pick(MENU.filter((x) => x.id !== avoid));
  return rnd() < 0.5 ? [pick(OFF).id, on.id] : [on.id];
}
