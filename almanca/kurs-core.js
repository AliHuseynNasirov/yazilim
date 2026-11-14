// Kitab üzrə kurs (A1.1) — UI-sız hissə: cavabların yoxlanması, çalışmaların qurulması, irəliləyiş.
// Ayrıca test edilir (node). Məlumat: ./kurs/*.js

export const PASS = 0.8; // bölmə testini keçmək üçün
export const PARTS = [
  { key: 'vocab', icon: '🗂️', title: 'Sözlər' },
  { key: 'gram', icon: '📐', title: 'Qrammatika' },
  { key: 'listen', icon: '🎧', title: 'Dinləmə' },
  { key: 'read', icon: '📖', title: 'Oxu' },
  { key: 'write', icon: '✍️', title: 'Yazı' },
  { key: 'speak', icon: '🎙️', title: 'Danışıq' },
  { key: 'phon', icon: '👄', title: 'Tələffüz' },
  { key: 'test', icon: '🏁', title: 'Bölmə testi' },
];

// ---------- mətnin normallaşdırılması ----------
const PUNCT = /[.,!?;:"„“”‚‘’'`´()…–—\-/]+/g;
export function normAns(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// ümlautsuz yazılış: ä = ae = a
export function fold(s) {
  return normAns(s)
    .replace(/ä|ae/g, 'a')
    .replace(/ö|oe/g, 'o')
    .replace(/ü|ue/g, 'u');
}
const stripP = (s) => String(s || '').replace(PUNCT, ' ').replace(/\s+/g, ' ').trim();

/**
 * Yazılan cavabı yoxla.
 * @returns {{ ok: boolean, note?: 'uml'|'case', best: string }}
 */
export function checkTyped(input, answers) {
  const list = [].concat(answers || []).filter(Boolean);
  const n = normAns(input);
  if (!n) return { ok: false, best: list[0] || '' };
  for (const a of list) {
    if (normAns(a) === n) {
      // böyük/kiçik hərf: ilk hərfdən başqa fərq varsa xatırlat
      const u = stripP(input);
      const c = stripP(a);
      const same = u.slice(1) === c.slice(1) && u[0].toLowerCase() === c[0].toLowerCase();
      return same ? { ok: true, best: a } : { ok: true, note: 'case', best: a };
    }
  }
  const f = fold(input);
  for (const a of list) if (fold(a) === f) return { ok: true, note: 'uml', best: a };
  return { ok: false, best: list[0] || '' };
}

/** Sərbəst yazı: hər qrupdan ən azı bir ifadə olmalıdır. @returns {{ ok, missing: string[] }} */
export function checkWriting(input, must) {
  const f = ' ' + fold(input) + ' ';
  const missing = [];
  for (const g of must || []) {
    const alts = [].concat(g.a || g);
    if (!alts.some((x) => f.includes(fold(x)))) missing.push(g.l || alts[0]);
  }
  return { ok: !missing.length && fold(input).length > 0, missing };
}

// ---------- təsadüfi ----------
export function shuffle(a, rnd = Math.random) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export const sample = (a, n, rnd = Math.random) => shuffle(a, rnd).slice(0, n);

// ---------- sözlər ----------
/** 'der Kurs, -e' → { head:'der Kurs', art:'der', noun:'Kurs', pl:'-e' } ; 'kommen' → { head:'kommen' } */
export function parseWord(de) {
  const [h, ...rest] = String(de).split(',');
  const head = h.trim();
  const m = head.match(/^(der|die|das)\s+(.+)$/);
  return { head, art: m ? m[1] : '', noun: m ? m[2] : '', pl: rest.join(',').trim() };
}
/** Bölmənin bütün sözləri düz siyahı kimi: [{ de, az, ex, g (qrup), i }] */
export function words(unit) {
  const out = [];
  for (const grp of unit.vocab || []) for (const w of grp.w) out.push({ de: w[0], az: w[1], ex: w[2] || '', g: grp.g, i: out.length });
  return out;
}

/** Bir söz üçün çalışma (növ təsadüfi və ya verilmiş) */
export function wordItem(unit, w, kind, rnd = Math.random) {
  const all = words(unit);
  const p = parseWord(w.de);
  const others = all.filter((x) => x.i !== w.i && x.az !== w.az);
  const kinds = ['de-az', 'az-de', 'hear', 'type'];
  if (p.art && !/\(Pl\.\)/.test(w.de)) kinds.push('art');
  const k = kind || kinds[Math.floor(rnd() * kinds.length)];
  const base = { src: 'vocab', wi: w.i };
  if (k === 'art') return { ...base, t: 'mc', q: `___ ${p.noun}`, sub: w.az, opts: [p.art, ...['der', 'die', 'das'].filter((x) => x !== p.art)], say: p.head, noShuffle: true, fixedOrder: ['der', 'die', 'das'] };
  if (k === 'az-de') return { ...base, t: 'mc', q: w.az, opts: [p.head, ...sample(others, 3, rnd).map((x) => parseWord(x.de).head)], say: p.head };
  if (k === 'hear') return { ...base, t: 'lmc', say: p.head, q: 'Eşitdiyin sözün mənası hansıdır?', opts: [w.az, ...sample(others, 3, rnd).map((x) => x.az)], reveal: p.head };
  if (k === 'type') {
    const a = [p.head];
    if (p.art) a.push(p.noun);
    return { ...base, t: 'tr', az: w.az, a, hint: p.art ? 'artikl ilə yaz' : '', needArt: p.art || '' };
  }
  return { ...base, t: 'mc', q: p.head, opts: [w.az, ...sample(others, 3, rnd).map((x) => x.az)], say: p.head, autoSay: true };
}

/** Söz testi: ən zəif bilinən sözlərdən n çalışma. stats: { [wi]: [ok, bad] } */
export function vocabSession(unit, stats = {}, n = 12, rnd = Math.random) {
  const all = words(unit);
  const score = (w) => {
    const s = stats[w.i] || [0, 0];
    return s[0] - s[1] * 1.5 + rnd() * 0.9;
  };
  return [...all].sort((a, b) => score(a) - score(b)).slice(0, n).map((w) => wordItem(unit, w, null, rnd));
}
export const wordKnown = (s) => !!s && s[0] >= 2 && s[0] > s[1];

// ---------- hissələrin çalışmaları ----------
/** Bölmənin bir hissəsindəki bütün çalışmalar (sabit sıra, hər birinin id-si var) */
export function partItems(unit, part, sub) {
  let list = [];
  if (part === 'gram') list = (unit.grammar[sub] || {}).items || [];
  else if (part === 'listen') list = unit.listening || [];
  else if (part === 'read') list = ((unit.reading || [])[sub] || {}).items || [];
  else if (part === 'write') list = unit.writing || [];
  else if (part === 'phon') list = (unit.phon || {}).items || [];
  return list.map((it, i) => ({ ...it, id: i }));
}
/** İrəliləyiş açarı: 'gram.0', 'listen', 'read.1' … */
export const partKey = (part, sub) => (sub === undefined || sub === null || sub === '' ? part : `${part}.${sub}`);

/** Növbəti seans: hələ düz cavablanmamış çalışmalar əvvəl; n ədəd */
export function nextSession(items, doneIds = [], n = 10, rnd = Math.random) {
  const done = new Set(doneIds);
  const fresh = items.filter((x) => !done.has(x.id));
  const old = shuffle(items.filter((x) => done.has(x.id)), rnd);
  return [...fresh, ...old].slice(0, Math.min(n, items.length));
}

/** Hissənin irəliləyişi 0..1 */
export function partProgress(unit, prog = {}, part) {
  const ratio = (items, key) => (items.length ? Math.min(1, new Set(prog[key] || []).size / items.length) : 1);
  if (part === 'vocab') {
    const all = words(unit);
    const st = prog.vocab || {};
    return all.length ? all.filter((w) => wordKnown(st[w.i])).length / all.length : 1;
  }
  if (part === 'gram') {
    const g = unit.grammar || [];
    return g.length ? g.reduce((s, _, i) => s + ratio(partItems(unit, 'gram', i), partKey('gram', i)), 0) / g.length : 1;
  }
  if (part === 'read') {
    const r = unit.reading || [];
    return r.length ? r.reduce((s, _, i) => s + ratio(partItems(unit, 'read', i), partKey('read', i)), 0) / r.length : 1;
  }
  if (part === 'speak') {
    const ids = unit.speaking || [];
    const d = prog.__done || {};
    return ids.length ? ids.filter((id) => d[id]).length / ids.length : 1;
  }
  if (part === 'test') return prog.test && prog.test.passed ? 1 : 0;
  return ratio(partItems(unit, part), part);
}
export function unitProgress(unit, prog = {}) {
  const parts = PARTS.filter((p) => hasPart(unit, p.key));
  return parts.reduce((s, p) => s + partProgress(unit, prog, p.key), 0) / (parts.length || 1);
}
export function hasPart(unit, key) {
  if (key === 'test') return true;
  if (unit.review) return false;
  if (key === 'vocab') return !!(unit.vocab && unit.vocab.length);
  if (key === 'gram') return !!(unit.grammar && unit.grammar.length);
  if (key === 'listen') return !!(unit.listening && unit.listening.length);
  if (key === 'read') return !!(unit.reading && unit.reading.length);
  if (key === 'write') return !!(unit.writing && unit.writing.length);
  if (key === 'speak') return !!(unit.speaking && unit.speaking.length);
  if (key === 'phon') return !!(unit.phon && unit.phon.items && unit.phon.items.length);
  return false;
}

// ---------- bölmə testi ----------
const tagged = (list, src) => list.map((x) => ({ ...x, src }));
/** Bir bölmədən test üçün çalışma hovuzu */
function pool(unit, rnd) {
  const gram = (unit.grammar || []).flatMap((g, i) => tagged(partItems(unit, 'gram', i), 'gram'));
  const listen = tagged(partItems(unit, 'listen'), 'listen').filter((x) => x.t !== 'rep');
  const write = tagged(partItems(unit, 'write'), 'write').filter((x) => x.t !== 'wr');
  const read = (unit.reading || []).flatMap((r, i) => tagged(partItems(unit, 'read', i), 'read').map((x) => ({ ...x, text: r.text, textTitle: r.title })));
  const vocab = sample(words(unit), 12, rnd).map((w) => wordItem(unit, w, null, rnd));
  return { gram, listen, write, read, vocab };
}
/**
 * Test: bir və ya bir neçə bölmədən n çalışma (təxminən: 30% söz, 35% qrammatika, 15% dinləmə, 20% yazı/oxu).
 */
export function buildTest(units, n = 20, rnd = Math.random) {
  const pools = units.map((u) => pool(u, rnd));
  const all = (k) => shuffle(pools.flatMap((p) => p[k]), rnd);
  const want = { vocab: Math.round(n * 0.3), gram: Math.round(n * 0.35), listen: Math.round(n * 0.15) };
  want.rest = n - want.vocab - want.gram - want.listen;
  const out = [...all('vocab').slice(0, want.vocab), ...all('gram').slice(0, want.gram), ...all('listen').slice(0, want.listen), ...shuffle([...all('write'), ...all('read')], rnd).slice(0, want.rest)];
  // çatışmırsa qrammatikadan tamamla
  const extra = all('gram').filter((x) => !out.includes(x));
  while (out.length < n && extra.length) out.push(extra.pop());
  return shuffle(out, rnd).map((x, i) => ({ ...x, id: i }));
}

// ---------- məlumatın yoxlanması (testlər üçün) ----------
export function validateUnit(u) {
  const errs = [];
  const bad = (m) => errs.push(`${u.id}: ${m}`);
  if (!u.id || !u.title) bad('id/title yoxdur');
  if (u.review) return errs;
  const ws = words(u);
  if (ws.length < 20) bad(`söz azdır (${ws.length})`);
  const seen = new Set();
  for (const w of ws) {
    if (!w.de || !w.az) bad(`söz natamam: ${JSON.stringify(w)}`);
    const h = parseWord(w.de).head;
    if (seen.has(h)) bad(`söz təkrarlanır: ${h}`);
    seen.add(h);
  }
  const chk = (it, where) => {
    const w = `${where} #${it.id}`;
    if (it.t === 'mc' || it.t === 'lmc') {
      if (!Array.isArray(it.opts) || it.opts.length < 2) bad(`${w}: variant azdır`);
      else if (new Set(it.opts).size !== it.opts.length) bad(`${w}: variant təkrarlanır (${it.opts.join(' | ')})`);
      if (it.t === 'mc' && !it.q) bad(`${w}: sual yoxdur`);
      if (it.t === 'lmc' && !it.say) bad(`${w}: səs mətni yoxdur`);
    } else if (it.t === 'gap') {
      if (!it.q || !it.q.includes('___')) bad(`${w}: boşluq (___) yoxdur`);
      if (!it.a || !it.a.length) bad(`${w}: cavab yoxdur`);
    } else if (it.t === 'tr') {
      if (!it.az || !it.a || !it.a.length) bad(`${w}: tərcümə natamamdır`);
    } else if (it.t === 'ord') {
      if (!it.s || it.s.trim().split(/\s+/).length < 2) bad(`${w}: cümlə qısadır`);
    } else if (it.t === 'dict' || it.t === 'rep') {
      if (!it.de) bad(`${w}: mətn yoxdur`);
    } else if (it.t === 'pair') {
      if (!it.say || !it.other || it.say === it.other) bad(`${w}: cütlük səhvdir`);
    } else if (it.t === 'wr') {
      if (!it.task || !it.model) bad(`${w}: tapşırıq/nümunə yoxdur`);
      else if (!checkWriting(it.model, it.must).ok) bad(`${w}: nümunə cavab öz yoxlamasından keçmir`);
    } else bad(`${w}: naməlum növ ${it.t}`);
  };
  (u.grammar || []).forEach((g, i) => {
    if (!g.title || !g.html) bad(`qrammatika ${i}: başlıq/izah yoxdur`);
    const items = partItems(u, 'gram', i);
    if (items.length < 8) bad(`qrammatika ${i}: çalışma azdır (${items.length})`);
    items.forEach((it) => chk(it, `gram.${i}`));
  });
  for (const part of ['listen', 'write', 'phon']) partItems(u, part).forEach((it) => chk(it, part));
  (u.reading || []).forEach((r, i) => {
    if (!r.title || !r.text) bad(`oxu ${i}: mətn yoxdur`);
    partItems(u, 'read', i).forEach((it) => chk(it, `read.${i}`));
  });
  if (!(u.grammar || []).length) bad('qrammatika yoxdur');
  if (partItems(u, 'listen').length < 8) bad('dinləmə azdır');
  if (partItems(u, 'write').length < 8) bad('yazı azdır');
  if (!(u.reading || []).length) bad('oxu yoxdur');
  if (!u.phon) bad('tələffüz yoxdur');
  return errs;
}
