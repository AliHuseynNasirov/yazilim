// Kitab üzrə kurs (A1.1): ana səhifə bölməsi, bölmə səhifəsi və çalışma mühərriki.
// app.js yalnız kursHomeHtml(ctx) və renderKurs(ctx, id, sub, sub2) çağırır — köhnə dərslərə toxunmur.

import { PARTS, PASS, checkTyped, checkWriting, shuffle, parseWord, words, wordItem, vocabSession, wordKnown, partItems, partKey, nextSession, partProgress, unitProgress, hasPart, buildTest } from './kurs-core.js';
import { UNITS, findUnit } from './kurs/index.js';
import { findDialog } from './data.js';

export const KURS_CAT = { id: 'kurs', icon: '📚', title: 'Kitab üzrə kurs (A1.1)' };

// ---------- səs (brauzerin almanca səsi) ----------
let sayTimer = null;
export function stopSay() {
  clearTimeout(sayTimer);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function utter(text, rate, pitch) {
  const u = new SpeechSynthesisUtterance(String(text).replace(/___/g, ' ').replace(/–|—/g, ','));
  u.lang = 'de-DE';
  u.rate = rate;
  u.pitch = pitch;
  const de = speechSynthesis.getVoices().find((v) => v.lang && v.lang.replace('_', '-').startsWith('de'));
  if (de) u.voice = de;
  return u;
}
/** Mətn və ya sətirlər siyahısı (dialoq: səs tonu növbə ilə dəyişir) */
export function say(text, rate = 0.9) {
  if (!('speechSynthesis' in window)) return;
  stopSay();
  const lines = [].concat(text);
  lines.forEach((l, i) => speechSynthesis.speak(utter(l, rate, lines.length > 1 && i % 2 ? 0.75 : 1)));
}

// ---------- irəliləyiş ----------
const getProg = (ctx, u) => ({ ...ctx.store.get(`kurs.${u.id}`, {}), __done: ctx.store.get('done', {}) });
function setProg(ctx, u, fn) {
  const p = ctx.store.get(`kurs.${u.id}`, {});
  fn(p);
  ctx.store.set(`kurs.${u.id}`, p);
}
const passed = (ctx, u) => !!(ctx.store.get(`kurs.${u.id}`, {}).test || {}).passed;
function unlocked(ctx, i) {
  if (i <= 0) return true;
  return passed(ctx, UNITS[i - 1]) || !!ctx.store.get('kursOpen', {})[UNITS[i].id] || unlockedByProgress(ctx, i);
}
// artıq başlanmış bölmə bağlanmasın
const unlockedByProgress = (ctx, i) => Object.keys(ctx.store.get(`kurs.${UNITS[i].id}`, {})).length > 0;
const pct = (x) => Math.round(x * 100);
const unitLabel = (u) => (u.review ? u.title : u.num === 0 ? `Start · ${u.title}` : `${u.num}. ${u.title}`);

// ---------- ana səhifə bölməsi ----------
export function kursHomeHtml(ctx) {
  const { esc } = ctx;
  const totalPassed = UNITS.filter((u) => passed(ctx, u)).length;
  return `
    <section class="k-home">
      <h2>📚 Kitab üzrə kurs · A1.1</h2>
      <p class="muted small">Bölmələr kitabdakı sıra ilədir. Hər bölmədə: sözlər, qrammatika, dinləmə, oxu, yazı, danışıq, tələffüz və test. ${totalPassed}/${UNITS.length} test keçilib.</p>
      <div class="k-units">
        ${UNITS.map((u, i) => {
          const open = unlocked(ctx, i);
          const p = u.review ? (passed(ctx, u) ? 1 : 0) : unitProgress(u, getProg(ctx, u));
          const ok = passed(ctx, u);
          return `<a class="card row k-unit ${open ? '' : 'locked'} ${u.review ? 'review' : ''}" href="#/u/${u.id}" data-unit="${u.id}">
            <span class="k-ico">${u.icon}</span>
            <div>
              <b>${esc(unitLabel(u))}</b>
              <small>${esc(u.az)}</small>
              <div class="progress"><span style="width:${pct(p)}%"></span></div>
            </div>
            <span class="state">${ok ? '✅' : open ? `${pct(p)}%` : '🔒'}</span>
          </a>`;
        }).join('')}
      </div>
    </section>`;
}

// Seans səhifənin öz ünvanında açılır; "geri" eyni ünvana aparanda hashchange olmur — əl ilə çək
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href^="#/u/"]');
    if (link && link.getAttribute('href') === location.hash) {
      e.preventDefault();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  });
}

// ---------- marşrut ----------
export function renderKurs(ctx, id, sub, sub2) {
  stopSay();
  const u = findUnit(id);
  if (!u) {
    location.hash = '#/';
    return;
  }
  const i = UNITS.indexOf(u);
  if (!unlocked(ctx, i)) return renderLocked(ctx, u, i);
  if (!sub) return renderUnit(ctx, u);
  if (sub === 'test') return renderTest(ctx, u);
  if (u.review || !hasPart(u, sub)) return renderUnit(ctx, u);
  if (sub === 'vocab') return renderVocab(ctx, u, sub2);
  if (sub === 'gram') return renderGram(ctx, u, sub2);
  if (sub === 'read') return renderRead(ctx, u, sub2);
  if (sub === 'speak') return renderSpeak(ctx, u);
  return renderSimple(ctx, u, sub);
}

function renderLocked(ctx, u, i) {
  const { $app, esc, header, store } = ctx;
  const prev = UNITS[i - 1];
  $app.innerHTML = `
    ${header(`${u.icon} ${esc(unitLabel(u))}`, '#/')}
    <main>
      <div class="hero">
        <h2>🔒 Bu bölmə hələ bağlıdır</h2>
        <p>Əvvəlcə <b>${esc(unitLabel(prev))}</b> bölməsinin testini keç (ən azı ${pct(PASS)}%).</p>
        <a class="btn primary big" href="#/u/${prev.id}">← ${esc(unitLabel(prev))}</a>
        <p></p>
        <button class="btn ghost" id="kOpen">Yenə də aç</button>
      </div>
    </main>`;
  $app.querySelector('#kOpen').addEventListener('click', () => {
    const o = store.get('kursOpen', {});
    o[u.id] = 1;
    store.set('kursOpen', o);
    renderKurs(ctx, u.id);
  });
}

// ---------- bölmə səhifəsi ----------
function renderUnit(ctx, u) {
  const { $app, esc, header } = ctx;
  const prog = getProg(ctx, u);
  const t = prog.test || {};
  if (u.review) {
    $app.innerHTML = `
      ${header(`${u.icon} ${esc(u.title)}`, '#/')}
      <main>
        <div class="hero"><p>${esc(u.az)}</p>
          <p class="small muted">${u.n} sual · keçid balı ${pct(PASS)}%${t.best != null ? ` · ən yaxşı nəticən: <b>${pct(t.best)}%</b> ${t.passed ? '✅' : ''}` : ''}</p>
        </div>
        <div class="sticky-cta"><a class="btn primary big" href="#/u/${u.id}/test">🏁 Testə başla</a></div>
      </main>`;
    return;
  }
  $app.innerHTML = `
    ${header(`${u.icon} ${esc(unitLabel(u))}`, '#/')}
    <main>
      <div class="hero">
        <p><b>${esc(u.az)}</b></p>
        <ul class="k-goals">${u.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
        <div class="progress"><span style="width:${pct(unitProgress(u, prog))}%"></span></div>
        <small>Bölmə üzrə irəliləyiş: ${pct(unitProgress(u, prog))}%</small>
      </div>
      <div class="k-parts">
        ${PARTS.filter((p) => hasPart(u, p.key)).map((p) => {
          const v = partProgress(u, prog, p.key);
          const extra = p.key === 'test' && t.best != null ? ` · ${pct(t.best)}%` : '';
          return `<a class="card row k-part" href="#/u/${u.id}/${p.key}" data-part="${p.key}">
            <span class="k-ico">${p.icon}</span>
            <div><b>${p.title}</b><small>${esc(partHint(u, p.key))}${extra}</small>
              ${p.key === 'test' ? '' : `<div class="progress"><span style="width:${pct(v)}%"></span></div>`}
            </div>
            <span class="state">${v >= 1 ? '✅' : p.key === 'test' ? '›' : `${pct(v)}%`}</span>
          </a>`;
        }).join('')}
      </div>
    </main>`;
}
function partHint(u, key) {
  if (key === 'vocab') return `${words(u).length} söz: siyahı, kartlar, test`;
  if (key === 'gram') return u.grammar.map((g) => g.title).join(' · ');
  if (key === 'listen') return `${u.listening.length} çalışma: dinlə və yaz / seç`;
  if (key === 'read') return u.reading.map((r) => r.title).join(' · ');
  if (key === 'write') return `${u.writing.length} çalışma: cümlə qur, tərcümə et, mesaj yaz`;
  if (key === 'speak') return `${u.speaking.length} səsli dərs (müəllimlə)`;
  if (key === 'phon') return u.phon.title;
  return `20 sual · keçid balı ${pct(PASS)}%`;
}

// ---------- Sözlər ----------
function renderVocab(ctx, u, mode) {
  const { $app, esc, header } = ctx;
  const all = words(u);
  const stats = () => ctx.store.get(`kurs.${u.id}`, {}).vocab || {};
  const bump = (wi, ok) =>
    setProg(ctx, u, (p) => {
      p.vocab = p.vocab || {};
      const s = p.vocab[wi] || [0, 0];
      s[ok ? 0 : 1]++;
      p.vocab[wi] = s;
    });

  if (mode === 'test') {
    return runSession(ctx, {
      unit: u,
      title: `🗂️ Sözlər · ${unitLabel(u)}`,
      label: 'Sözlər',
      back: `#/u/${u.id}/vocab`,
      items: vocabSession(u, stats(), 12).map((x, i) => ({ ...x, id: i })),
      onAnswer: (it, ok) => bump(it.wi, ok),
      again: () => renderVocab(ctx, u, 'test'),
    });
  }
  if (mode === 'cards') return renderCards(ctx, u, bump);

  const st = stats();
  const known = all.filter((w) => wordKnown(st[w.i])).length;
  let gi = -1;
  $app.innerHTML = `
    ${header(`🗂️ Sözlər · ${esc(unitLabel(u))}`, `#/u/${u.id}`)}
    <main class="k-vocab">
      <div class="hero"><p>Öyrənilib: <b>${known} / ${all.length}</b> söz</p>
        <div class="progress"><span style="width:${pct(known / all.length)}%"></span></div>
        <small>Söz 2 dəfə düz cavablananda "öyrənilmiş" sayılır. İsimləri həmişə <b>artikl ilə</b> öyrən (der / die / das).</small>
      </div>
      <div class="k-two">
        <a class="btn" href="#/u/${u.id}/vocab/cards">🃏 Kartlar</a>
        <a class="btn primary" href="#/u/${u.id}/vocab/test">📝 Söz testi</a>
      </div>
      ${u.vocab.map((grp) => `
        <h3>${esc(grp.g)}</h3>
        <div class="vocab k-wlist">
          ${grp.w.map((w) => {
            gi++;
            return `<button class="word ${wordKnown(st[gi]) ? 'known' : ''}" data-say="${esc(parseWord(w[0]).head)}"><b>${esc(w[0])}</b><span>${esc(w[1])}</span></button>`;
          }).join('')}
        </div>`).join('')}
    </main>`;
  $app.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => say(b.dataset.say)));
}

function renderCards(ctx, u, bump) {
  const { $app, esc, header } = ctx;
  const st = ctx.store.get(`kurs.${u.id}`, {}).vocab || {};
  const all = words(u);
  // bilinməyənlər əvvəl
  let queue = [...shuffle(all.filter((w) => !wordKnown(st[w.i]))), ...shuffle(all.filter((w) => wordKnown(st[w.i])))];
  let pos = 0;
  let flipped = false;
  function draw() {
    if (pos >= queue.length) {
      $app.innerHTML = `${header(`🃏 Kartlar · ${esc(unitLabel(u))}`, `#/u/${u.id}/vocab`)}<main><div class="hero"><h2>🎉 Bütün kartlara baxdın</h2></div>
        <div class="sticky-cta"><a class="btn primary big" href="#/u/${u.id}/vocab/test">📝 Söz testinə keç</a></div></main>`;
      return;
    }
    const w = queue[pos];
    $app.innerHTML = `
      ${header(`🃏 Kartlar · ${esc(unitLabel(u))}`, `#/u/${u.id}/vocab`)}
      <main class="k-run">
        <div class="sc-top"><span>Kart <b>${pos + 1}</b> / ${queue.length}</span><span class="muted small">${esc(w.g)}</span></div>
        <div class="progress"><span style="width:${pct(pos / queue.length)}%"></span></div>
        <button class="k-card ${flipped ? 'flipped' : ''}" id="kCard">
          <span class="k-card-de">${esc(w.de)}</span>
          ${flipped ? `<span class="k-card-az">${esc(w.az)}</span>${w.ex ? `<span class="k-card-ex">${esc(w.ex)}</span>` : ''}` : '<span class="muted small">Tərcüməni görmək üçün toxun</span>'}
        </button>
        <div class="k-two"><button class="btn ghost" id="kSay">🔊 Dinlə</button></div>
        <div class="sticky-cta sc-cta">
          <button class="btn" id="kNo">✗ Bilmirəm</button>
          <button class="btn primary big" id="kYes">✓ Bilirəm</button>
        </div>
      </main>`;
    const head = parseWord(w.de).head;
    $app.querySelector('#kCard').addEventListener('click', () => {
      flipped = !flipped;
      draw();
    });
    $app.querySelector('#kSay').addEventListener('click', () => say(head));
    const go = (ok) => {
      bump(w.i, ok);
      if (!ok) queue.push(w);
      pos++;
      flipped = false;
      draw();
    };
    $app.querySelector('#kYes').addEventListener('click', () => go(true));
    $app.querySelector('#kNo').addEventListener('click', () => go(false));
    if (!flipped) say(head);
  }
  draw();
}

// ---------- Qrammatika ----------
function tablesHtml(esc, tables) {
  return (tables || [])
    .map(
      (t) => `<div class="table-wrap"><table>
        ${t.head ? `<thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : ''}
        <tbody>${t.rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`,
    )
    .join('');
}
function renderGram(ctx, u, idx) {
  const { $app, esc, header } = ctx;
  const prog = getProg(ctx, u);
  if (idx === undefined || !u.grammar[+idx]) {
    $app.innerHTML = `
      ${header(`📐 Qrammatika · ${esc(unitLabel(u))}`, `#/u/${u.id}`)}
      <main class="list">
        ${u.grammar.map((g, i) => {
          const items = partItems(u, 'gram', i);
          const v = Math.min(1, new Set(prog[partKey('gram', i)] || []).size / items.length);
          return `<a class="card row" href="#/u/${u.id}/gram/${i}"><div><b>${esc(g.title)}</b><small>${items.length} çalışma</small>
            <div class="progress"><span style="width:${pct(v)}%"></span></div></div><span class="state">${v >= 1 ? '✅' : `${pct(v)}%`}</span></a>`;
        }).join('')}
      </main>`;
    return;
  }
  const i = +idx;
  const g = u.grammar[i];
  const key = partKey('gram', i);
  const items = partItems(u, 'gram', i);
  $app.innerHTML = `
    ${header(`📐 ${esc(g.title)}`, `#/u/${u.id}/gram`)}
    <main class="k-gram">
      <section class="rule">
        ${g.html.map((p) => `<p>${p}</p>`).join('')}
        ${tablesHtml(esc, g.tables)}
        ${(g.tips || []).map((t) => `<p class="tip">💡 ${t}</p>`).join('')}
      </section>
      <div class="sticky-cta"><button class="btn primary big" id="kGo">✏️ Çalışmalara başla (${new Set(prog[key] || []).size}/${items.length})</button></div>
    </main>`;
  $app.querySelector('#kGo').addEventListener('click', () => startPart(ctx, u, 'gram', i, `📐 ${g.title}`, `#/u/${u.id}/gram/${i}`));
}

// ---------- Oxu ----------
function renderRead(ctx, u, idx) {
  const { $app, esc, header } = ctx;
  const prog = getProg(ctx, u);
  if (idx === undefined || !u.reading[+idx]) {
    if (u.reading.length === 1) return renderRead(ctx, u, 0);
    $app.innerHTML = `
      ${header(`📖 Oxu · ${esc(unitLabel(u))}`, `#/u/${u.id}`)}
      <main class="list">
        ${u.reading.map((r, i) => {
          const items = partItems(u, 'read', i);
          const v = Math.min(1, new Set(prog[partKey('read', i)] || []).size / items.length);
          return `<a class="card row" href="#/u/${u.id}/read/${i}"><div><b>${esc(r.title)}</b><small>${items.length} sual</small></div><span class="state">${v >= 1 ? '✅' : `${pct(v)}%`}</span></a>`;
        }).join('')}
      </main>`;
    return;
  }
  const i = +idx;
  const r = u.reading[i];
  $app.innerHTML = `
    ${header(`📖 ${esc(r.title)}`, u.reading.length === 1 ? `#/u/${u.id}` : `#/u/${u.id}/read`)}
    <main class="k-read">
      <div class="k-text">${textHtml(esc, r.text)}</div>
      <div class="k-two">
        <button class="btn ghost" id="kSay">🔊 Dinlə</button>
        ${r.az ? '<button class="btn ghost" id="kTr">🇦🇿 Tərcümə</button>' : ''}
      </div>
      ${r.az ? `<div class="k-text az" id="kAz" hidden>${textHtml(esc, r.az)}</div>` : ''}
      <div class="sticky-cta"><button class="btn primary big" id="kGo">❓ Suallara keç</button></div>
    </main>`;
  $app.querySelector('#kSay').addEventListener('click', () => say(r.text.split('\n').filter(Boolean)));
  const tr = $app.querySelector('#kTr');
  if (tr) tr.addEventListener('click', () => ($app.querySelector('#kAz').hidden = !$app.querySelector('#kAz').hidden));
  $app.querySelector('#kGo').addEventListener('click', () =>
    startPart(ctx, u, 'read', i, `📖 ${r.title}`, `#/u/${u.id}/read/${i}`, (it) => ({ ...it, text: r.text, textTitle: r.title })),
  );
}
const textHtml = (esc, t) => String(t).split('\n').map((l) => `<p>${esc(l)}</p>`).join('');

// ---------- Dinləmə / Yazı / Tələffüz ----------
const INTRO = {
  listen: ['🎧 Dinləmə', 'Tətbiq almanca deyir — sən yazırsan və ya düzgün cavabı seçirsən. 🔊 ilə yenidən, 🐢 ilə yavaş dinləyə bilərsən. Telefonun səsini aç.'],
  write: ['✍️ Yazı', 'Sözlərdən cümlə qur, azərbaycancadan almancaya çevir və qısa mesajlar yaz. İsimlər böyük hərflə yazılır; ä, ö, ü, ß hərflərinə diqqət et (klaviaturada hərfi basılı saxla).'],
};
function renderSimple(ctx, u, part) {
  const { $app, esc, header } = ctx;
  const prog = getProg(ctx, u);
  const items = partItems(u, part);
  const done = new Set(prog[part] || []).size;
  const [title, text] = part === 'phon' ? [`👄 ${u.phon.title}`, ''] : INTRO[part];
  $app.innerHTML = `
    ${header(`${esc(title)} · ${esc(unitLabel(u))}`, `#/u/${u.id}`)}
    <main class="k-gram">
      ${part === 'phon'
        ? `<section class="rule">${u.phon.html.map((p) => `<p>${p}</p>`).join('')}${tablesHtml(esc, u.phon.tables)}</section>`
        : `<div class="hero"><p>${text}</p></div>`}
      <p class="muted small">İrəliləyiş: ${Math.min(done, items.length)} / ${items.length}</p>
      <div class="sticky-cta"><button class="btn primary big" id="kGo">▶ Başla</button></div>
    </main>`;
  $app.querySelector('#kGo').addEventListener('click', () => startPart(ctx, u, part, undefined, title, `#/u/${u.id}/${part}`));
}

/** Hissənin növbəti seansı (hələ düz cavablanmamış çalışmalar əvvəl) */
function startPart(ctx, u, part, sub, title, back, map) {
  const key = partKey(part, sub);
  const all = partItems(u, part, sub);
  const doneIds = ctx.store.get(`kurs.${u.id}`, {})[key] || [];
  let items = nextSession(all, doneIds, 10);
  if (map) items = items.map(map);
  runSession(ctx, {
    unit: u,
    title,
    label: PARTS.find((p) => p.key === part).title,
    back,
    items,
    onAnswer: (it, ok) => {
      if (!ok) return;
      setProg(ctx, u, (p) => {
        const s = new Set(p[key] || []);
        s.add(it.id);
        p[key] = [...s];
      });
    },
    again: () => startPart(ctx, u, part, sub, title, back, map),
    moreLeft: () => all.length - new Set(ctx.store.get(`kurs.${u.id}`, {})[key] || []).size,
  });
}

// ---------- Danışıq ----------
function renderSpeak(ctx, u) {
  const { $app, esc, header, store } = ctx;
  const done = store.get('done', {});
  $app.innerHTML = `
    ${header(`🎙️ Danışıq · ${esc(unitLabel(u))}`, `#/u/${u.id}`)}
    <main class="list">
      <p class="muted small">Səsli dərslərdə süni intellekt müəllimi ilə danışırsan: o soruşur, düzəldir və izah edir. Bunun üçün ⚙️ Ayarlarda Gemini açarı lazımdır.</p>
      ${u.speaking.map((id) => {
        const f = findDialog(id);
        if (!f) return '';
        const d = f.dialog;
        return `<a class="card row" href="#/d/${d.id}"><div><b>${esc(d.title)}</b><small>${esc(d.situation)}</small></div><span class="state">${done[d.id] ? '✅' : '›'}</span></a>`;
      }).join('')}
    </main>`;
}

// ---------- Bölmə testi ----------
function renderTest(ctx, u) {
  const { $app, esc, header } = ctx;
  const t = ctx.store.get(`kurs.${u.id}`, {}).test || {};
  const units = u.review ? u.review.map(findUnit) : [u];
  const n = u.review ? u.n : 20;
  $app.innerHTML = `
    ${header(`🏁 Test · ${esc(unitLabel(u))}`, `#/u/${u.id}`)}
    <main>
      <div class="hero">
        <p><b>${n} sual</b>: sözlər, qrammatika, dinləmə, yazı və oxu. Keçmək üçün ən azı <b>${pct(PASS)}%</b> lazımdır.</p>
        <p class="small muted">Testdə səhv suallar təkrar verilmir. ${t.best != null ? `Ən yaxşı nəticən: <b>${pct(t.best)}%</b> ${t.passed ? '✅' : ''}` : ''}</p>
      </div>
      <div class="sticky-cta"><button class="btn primary big" id="kGo">🏁 Testə başla</button></div>
    </main>`;
  $app.querySelector('#kGo').addEventListener('click', () =>
    runSession(ctx, {
      unit: u,
      title: `🏁 Test · ${unitLabel(u)}`,
      label: 'Test',
      back: `#/u/${u.id}`,
      items: buildTest(units, n),
      test: true,
      onFinish: (score) => {
        setProg(ctx, u, (p) => {
          const old = p.test || {};
          p.test = { best: Math.max(old.best || 0, score), passed: !!old.passed || score >= PASS, ts: Date.now() };
        });
      },
      again: () => renderKurs(ctx, u.id, 'test'),
    }),
  );
}

// ---------- çalışma mühərriki ----------
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const cleanQ = (q) => String(q).replace(/\s*\([^)]*\)\s*$/, ''); // sondakı ipucunu "(kommen)" at
function correctText(it) {
  if (it.t === 'mc') return it.q.includes('___') ? cleanQ(it.q).replace('___', it.opts[0]) : it.opts[0];
  if (it.t === 'lmc') return it.opts[0];
  if (it.t === 'gap') return cleanQ(it.q).replace('___', it.a[0]);
  if (it.t === 'tr') return it.a[0];
  if (it.t === 'dict' || it.t === 'rep') return it.de;
  if (it.t === 'ord') return it.s;
  if (it.t === 'pair') return it.say;
  if (it.t === 'wr') return it.model;
  return '';
}
// düzgün cavabın almanca səsləndirilən forması (yalnız almanca olanda)
function sayText(it) {
  if (it.t === 'mc') return it.say || (it.q.includes('___') ? correctText(it) : '');
  if (it.t === 'lmc') return it.say;
  if (it.t === 'wr') return it.model;
  return correctText(it);
}

function runSession(ctx, o) {
  const { $app, esc, header, fx, confetti, saveMistake } = ctx;
  const queue = o.items.map((x) => ({ ...x }));
  const total = queue.length;
  const first = new Map(); // id → ilk cəhd düz/səhv
  const wrongList = [];
  let pos = 0;
  let cur = null;
  let answered = false;
  let chosen = []; // ord üçün
  let root = null;
  const alive = () => root && document.body.contains(root);

  function next() {
    stopSay();
    if (pos >= queue.length) return finish();
    cur = queue[pos++];
    if (typeof window !== 'undefined') window.__kursCur = cur; // testlər üçün
    answered = false;
    chosen = [];
    if ((cur.t === 'mc' || cur.t === 'lmc') && !cur._opts) cur._opts = cur.fixedOrder || shuffle(cur.opts);
    if (cur.t === 'pair' && !cur._opts) cur._opts = shuffle([cur.say, cur.other]);
    if (cur.t === 'ord' && !cur._tiles) {
      const ws = cur.s.replace(/[.?!]$/, '').split(/\s+/).map((w, i) => ({ w, i }));
      let t = shuffle(ws);
      for (let k = 0; k < 20 && ws.length > 1 && t.every((x, j) => x.i === j); k++) t = shuffle(ws);
      cur._tiles = t;
      cur._end = (cur.s.match(/[.?!]$/) || ['.'])[0];
    }
    draw();
    if (cur.t === 'lmc' || cur.t === 'dict' || cur.t === 'pair' || cur.t === 'rep' || cur.autoSay) setTimeout(() => alive() && !answered && say(cur.t === 'dict' || cur.t === 'rep' ? cur.de : cur.say), 350);
  }

  function body() {
    const it = cur;
    const dis = answered ? 'disabled' : '';
    const listenBtns = `<div class="k-listen"><button class="btn" id="kPlay">🔊 Dinlə</button><button class="btn ghost" id="kSlow">🐢 Yavaş</button></div>`;
    const textBlock = it.text ? `<details class="rule-mini k-textbox" ${first.size ? '' : 'open'}><summary>📖 ${esc(it.textTitle || 'Mətn')}</summary><div class="k-text">${textHtml(esc, it.text)}</div></details>` : '';
    if (it.t === 'mc' || it.t === 'lmc' || it.t === 'pair') {
      const opts = it._opts;
      const q = it.t === 'pair' ? 'Hansı sözü eşitdin?' : it.q;
      return `${textBlock}
        ${it.t === 'mc' ? '' : listenBtns}
        <div class="k-q">${esc(q)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</div>
        <div class="k-opts">${opts.map((x, i) => `<button class="k-opt" data-i="${i}" ${dis}>${esc(x)}</button>`).join('')}</div>`;
    }
    if (it.t === 'gap') {
      return `${textBlock}<div class="k-q">${esc(it.q)}</div>
        <input class="k-in" id="kIn" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="boşluğa düşən söz" ${dis}>`;
    }
    if (it.t === 'tr') {
      return `<div class="k-lbl">Almanca yaz${it.hint ? ` (${esc(it.hint)})` : ''}:</div><div class="k-q">${esc(it.az)}</div>
        <input class="k-in" id="kIn" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="almanca…" ${dis}>`;
    }
    if (it.t === 'dict') {
      return `${listenBtns}<div class="k-lbl">Eşitdiyini yaz:</div>
        <input class="k-in" id="kIn" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="almanca…" ${dis}>`;
    }
    if (it.t === 'rep') {
      return `${listenBtns}<div class="k-q">${esc(it.de)}${it.az ? `<small>${esc(it.az)}</small>` : ''}</div>
        <p class="muted small">Dinlə və ucadan 2–3 dəfə təkrar et. Sonra "Dedim" bas.</p>`;
    }
    if (it.t === 'ord') {
      const tile = (t, k, where) => `<button class="sc-tile" data-k="${k}" data-where="${where}" ${dis}><b>${esc(t.w)}</b></button>`;
      return `<div class="k-lbl">Sözləri düzgün sıraya qoy:</div>${it.az ? `<div class="k-q k-az">${esc(it.az)}</div>` : ''}
        <div class="sc-answer" id="scAnswer">${chosen.length ? chosen.map((k) => tile(it._tiles[k], k, 'a')).join('') : '<span class="sc-ph">Cümlə burada qurulacaq…</span>'}<span class="sc-q">${it._end}</span></div>
        <div class="sc-bank">${it._tiles.map((t, k) => (chosen.includes(k) ? '<span class="sc-slot"></span>' : tile(t, k, 'b'))).join('')}</div>`;
    }
    if (it.t === 'wr') {
      return `<div class="k-lbl">Yaz:</div><div class="k-q k-az">${esc(it.task)}</div>
        <textarea class="k-in k-area" id="kIn" rows="4" autocorrect="off" spellcheck="false" placeholder="almanca yaz…" ${dis}></textarea>`;
    }
    return '';
  }

  function draw(fbHtml = '') {
    const it = cur;
    const okN = [...first.values()].filter(Boolean).length;
    const badN = first.size - okN;
    const needCheck = ['gap', 'tr', 'dict', 'ord', 'wr'].includes(it.t);
    const keep = $app.querySelector('#kIn') ? $app.querySelector('#kIn').value : '';
    $app.innerHTML = `
      ${header(esc(o.title), o.back)}
      <main class="k-run">
        <div class="sc-top"><span>Sual <b>${Math.min(first.size + (answered ? 0 : 1), total)}</b> / ${total}${it._retry ? ' <span class="chip warn">🔁 təkrar</span>' : ''}</span><span class="sc-score">✅ ${okN} · ❌ ${badN}</span></div>
        <div class="progress"><span style="width:${pct(first.size / total)}%"></span></div>
        <div class="k-item" data-t="${it.t}">${body()}</div>
        <div id="kFb">${fbHtml}</div>
        <div class="sticky-cta sc-cta">
          ${answered
            ? '<button class="btn primary big" id="kNext">Növbəti ›</button>'
            : it.t === 'rep'
              ? '<button class="btn primary big" id="kRep">✓ Dedim</button>'
              : needCheck
                ? `${it.t === 'ord' ? '<button class="btn ghost" id="kClear">↺ Sil</button>' : '<button class="btn ghost" id="kSkip">Bilmirəm</button>'}<button class="btn primary big" id="kCheck">Yoxla</button>`
                : ''}
        </div>
      </main>`;
    root = $app.querySelector('main');
    const $in = $app.querySelector('#kIn');
    if ($in) {
      $in.value = keep;
      if (!answered) {
        $in.focus();
        $in.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && it.t !== 'wr') {
            e.preventDefault();
            check();
          }
        });
      }
    }
    const play = $app.querySelector('#kPlay');
    const src = it.t === 'dict' || it.t === 'rep' ? it.de : it.say;
    if (play) play.addEventListener('click', () => say(src));
    const slow = $app.querySelector('#kSlow');
    if (slow) slow.addEventListener('click', () => say(src, 0.6));
    $app.querySelectorAll('.k-opt').forEach((b) =>
      b.addEventListener('click', () => {
        if (answered) return;
        const pick = it._opts[+b.dataset.i];
        const right = it.t === 'pair' ? it.say : it.opts[0];
        result(pick === right, pick, { pick });
      }),
    );
    $app.querySelectorAll('.sc-tile').forEach((b) =>
      b.addEventListener('click', () => {
        if (answered) return;
        const k = +b.dataset.k;
        if (b.dataset.where === 'b') chosen.push(k);
        else chosen = chosen.filter((x) => x !== k);
        draw();
      }),
    );
    const on = (id, fn) => {
      const el = $app.querySelector(id);
      if (el) el.addEventListener('click', fn);
    };
    on('#kCheck', check);
    on('#kSkip', () => result(false, '—', {}));
    on('#kClear', () => {
      chosen = [];
      draw();
    });
    on('#kRep', () => result(true, '', { silent: true }));
    on('#kNext', next);
    on('#kSayC', () => say(sayText(it)));
    if (answered) {
      // seçilmiş variantları rənglə
      const right = it.t === 'pair' ? it.say : it.opts && it.opts[0];
      $app.querySelectorAll('.k-opt').forEach((b) => {
        const v = it._opts[+b.dataset.i];
        if (v === right) b.classList.add('ok');
        else if (v === cur._pick) b.classList.add('bad');
      });
      const ans = $app.querySelector('#scAnswer');
      if (ans) ans.classList.add(cur._ok ? 'ok' : 'bad');
      if ($in) $in.classList.add(cur._ok ? 'ok' : 'bad');
      const fb = $app.querySelector('.sc-result');
      if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: 'nearest' });
    }
  }

  function check() {
    const it = cur;
    if (answered) return;
    if (it.t === 'ord') {
      if (chosen.length !== it._tiles.length) return;
      const got = chosen.map((k) => it._tiles[k].w).join(' ');
      const r = checkTyped(got, [it.s, ...(it.alts || [])]);
      return result(r.ok, cap(got) + it._end, {});
    }
    const v = ($app.querySelector('#kIn') || {}).value || '';
    if (!v.trim()) return;
    if (it.t === 'wr') {
      const r = checkWriting(v, it.must);
      return result(r.ok, v, { missing: r.missing });
    }
    const answers = it.t === 'dict' ? [it.de, ...(it.alts || [])] : it.a;
    const r = checkTyped(v, answers);
    // artiklsız yazılıbsa: düz say, amma xatırlat
    const noArt = r.ok && it.needArt && !new RegExp(`^(der|die|das)\\s`, 'i').test(v.trim());
    result(r.ok, v, { note: noArt ? 'art' : r.note, best: r.best });
  }

  function result(ok, userAns, extra) {
    const it = cur;
    answered = true;
    cur._ok = ok;
    cur._pick = extra.pick;
    const isFirst = !first.has(it.id);
    if (isFirst) first.set(it.id, ok);
    if (!extra.silent) ok ? fx.ding() : fx.oops();
    if (o.onAnswer) o.onAnswer(it, ok);
    const correct = correctText(it);
    if (!ok) {
      if (isFirst) wrongList.push(correct);
      if (!o.test && !it._retry) queue.push({ ...it, _retry: true, _opts: null, _tiles: null, _ok: undefined, _pick: undefined });
      if (isFirst && it.src !== 'vocab' && !['lmc', 'pair', 'rep'].includes(it.t) && userAns && userAns !== '—') {
        saveMistake(KURS_CAT, { id: o.unit.id, title: `${unitLabel(o.unit)} · ${o.label}` }, { wrong: userAns, correct, explanation: it.ex || '' });
      }
    }
    const notes = {
      uml: `⚠️ Yazılışa diqqət (ä, ö, ü, ß): <b>${esc(extra.best || correct)}</b>`,
      case: `⚠️ Böyük hərfə diqqət — isimlər böyük hərflə yazılır: <b>${esc(extra.best || correct)}</b>`,
      art: `⚠️ İsmi artikl ilə öyrən: <b>${esc(correct)}</b>`,
    };
    const st = sayText(it);
    const fb = extra.silent
      ? ''
      : `<div class="sc-result ${ok ? 'ok' : 'bad'}">
          <b>${ok ? '✅ Düzgündür!' : '❌ Səhvdir.'}</b>
          ${ok && extra.note ? `<p class="small">${notes[extra.note]}</p>` : ''}
          ${it.t === 'wr' && !ok && extra.missing && extra.missing.length ? `<p class="small">Çatışmır: ${extra.missing.map((m) => `<i>${esc(m)}</i>`).join(', ')}</p>` : ''}
          ${!ok || it.t === 'wr' || it.t === 'lmc' || it.reveal ? `<div class="sc-correct">${st ? '<button class="say" id="kSayC" aria-label="Dinlə">🔊</button>' : ''}<span>${it.t === 'wr' ? '<small>Nümunə:</small> ' : ''}${esc(it.t === 'lmc' && it.reveal ? `${it.reveal} = ${correct}` : correct)}</span></div>` : ''}
          ${it.t === 'lmc' && !it.reveal && it.say ? `<p class="small">🔊 ${esc([].concat(it.say).join(' '))}</p>` : ''}
          ${it.ex ? `<p class="small">💡 ${it.ex}</p>` : ''}
          ${!ok && !o.test ? '<p class="small muted">Bu sual sonda yenidən gələcək.</p>' : ''}
        </div>`;
    if (extra.silent) return next();
    draw(fb);
    if (ok && st && !['lmc', 'pair'].includes(it.t) && !(it.t === 'mc' && !it.q.includes('___') && !it.say)) say(st);
  }

  function finish() {
    stopSay();
    const okN = [...first.values()].filter(Boolean).length;
    const score = total ? okN / total : 1;
    if (o.onFinish) o.onFinish(score);
    const pass = score >= PASS;
    const left = o.moreLeft ? o.moreLeft() : 0;
    $app.innerHTML = `
      ${header(esc(o.title), o.back)}
      <main class="k-run">
        <div class="hero sc-end">
          <h2>${o.test ? (pass ? '🏆 Test keçildi!' : '📚 Hələ keçmədi') : '🎉 Seans bitdi!'}</h2>
          <p>${o.test ? 'Nəticə' : 'İlk cəhddə düzgün'}: <b>${okN} / ${total}</b> (${pct(score)}%)</p>
          ${o.test ? `<p class="small">${pass ? 'Növbəti bölmə açıldı.' : `Keçmək üçün ${pct(PASS)}% lazımdır. Zəif yerləri təkrar et və yenidən yoxla.`}</p>` : ''}
          ${wrongList.length ? `<p class="small">Səhv etdiklərin (📒 Səhvlərim bölməsində də var):</p><ul class="sc-wrong">${wrongList.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p>Hamısı düzgün! 👏</p>'}
          ${!o.test && o.moreLeft ? `<p class="small muted">${left > 0 ? `Bu hissədə hələ ${left} çalışma qalıb.` : 'Bu hissənin bütün çalışmaları düz cavablanıb ✅'}</p>` : ''}
        </div>
        <div class="sticky-cta nm-endcta">
          <button class="btn primary big" id="kAgain">${o.test ? '🔄 Yenidən' : left > 0 || !o.moreLeft ? '▶ Davam et' : '🔁 Təkrar et'}</button>
          <a class="btn ghost" href="${o.test ? '#/' : o.back}" id="kBack">${o.test && pass ? '🏠 Ana səhifə' : '‹ Geri'}</a>
        </div>
      </main>`;
    if (!o.test || pass) {
      fx.win();
      if (score >= 0.999 || (o.test && pass)) confetti($app.querySelector('.sc-end'));
    }
    $app.querySelector('#kAgain').addEventListener('click', () => o.again());
  }

  fx.init();
  next();
}
