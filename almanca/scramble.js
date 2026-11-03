// "Dağınıq sual cümlələri" məşqi: sözlərə toxunub düzgün sual cümləsini qur.
// Səs/model yoxdur — hamısı tətbiqdə yoxlanılır. app.js yalnız renderScramble(ctx) çağırır.
//
// Tur: 25 sual (yarısı W-Frage, yarısı Satzfrage). Əvvəlki turlarda verilən cümlələr
// yadda saxlanılır və təkrar verilmir. Səhv cavab verilən sual turun sonunda yenidən gəlir.

import { newRound, makeTiles, translate, isCorrect, RULE_AZ } from './scramble-core.js';

export const ROUND_SIZE = 25;
const TYPE_LABEL = { w: 'W-Frage', s: 'Satzfrage (bəli / xeyr)' };

function speakDe(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.rate = 0.85;
  const de = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith('de'));
  if (de) u.voice = de;
  speechSynthesis.speak(u);
}

const sentence = (words) => {
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '?';
};

export function renderScramble(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake } = ctx;
  const KEY = `scramble.${d.id}`;
  const USED = `scrambleUsed.${d.id}`;

  // Tur vəziyyəti: { items, queue: [indekslər], first: {i: 'ok'|'bad'}, wrongLogged: {i:1} }
  let st = store.get(KEY, null);
  const startRound = () => {
    const { items, used } = newRound(ROUND_SIZE, store.get(USED, []));
    store.set(USED, used);
    st = { items, queue: items.map((_, i) => i), first: {}, logged: {}, tries: {}, v: 1 };
    store.set(KEY, st);
  };
  if (!st || st.v !== 1 || !Array.isArray(st.items) || !st.items.length) startRound();

  let showTr = store.get('scrambleTr', true);
  let chosen = []; // seçilmiş plitələrin (tiles) indeksləri
  let checked = null; // null | 'ok' | 'bad'

  const save = () => store.set(KEY, st);

  function render() {
    if (!st.queue.length) return renderEnd();
    const qi = st.queue[0];
    const q = st.items[qi];
    const total = st.items.length;
    const doneCount = total - new Set(st.queue).size;
    const ok = Object.values(st.first).filter((x) => x === 'ok').length;
    const bad = Object.values(st.first).filter((x) => x === 'bad').length;
    // əvvəl səhv cavab verilib turun sonuna qaytarılmış sual
    const again = ((st.tries && st.tries[qi]) || 0) > (checked ? 1 : 0);
    const tr = (w) => (showTr ? `<small>${esc(translate(w, q) || ' ')}</small>` : '');
    const tile = (t, k, where) =>
      `<button class="sc-tile" data-k="${k}" data-where="${where}" ${checked ? 'disabled' : ''}><b>${esc(t.w)}</b>${tr(t.w)}</button>`;

    const answerWords = chosen.map((k) => q.tiles[k].w);
    const correctNow = checked === 'ok';
    $app.innerHTML = `
      ${header(`🧩 ${esc(d.title)}`, `#/d/${d.id}`)}
      <main class="sc">
        <div class="sc-top">
          <span>Sual <b>${Math.min(doneCount + 1, total)}</b> / ${total}</span>
          <span class="sc-score">✅ ${ok} · ❌ ${bad}</span>
        </div>
        <div class="progress"><span style="width:${(doneCount / total) * 100}%"></span></div>
        <div class="sc-meta">
          <span class="chip">${TYPE_LABEL[q.type]}</span>
          ${again ? '<span class="chip warn">🔁 təkrar</span>' : ''}
          <label class="toggle small"><input type="checkbox" id="scTr" ${showTr ? 'checked' : ''}> Tərcümə</label>
        </div>
        <p class="muted small">Sözlərə ardıcıl toxun və sual cümləsini qur. Səhv sözə toxunsan, yuxarıdan geri qaytar.</p>
        <div class="sc-answer ${checked ? (correctNow ? 'ok' : 'bad') : ''}" id="scAnswer">
          ${chosen.length ? chosen.map((k) => tile(q.tiles[k], k, 'a')).join('') : '<span class="sc-ph">Cümlə burada qurulacaq…</span>'}
          <span class="sc-q">?</span>
        </div>
        ${checked ? '' : `<div class="sc-bank" id="scBank">
          ${q.tiles.map((t, k) => (chosen.includes(k) ? `<span class="sc-slot"></span>` : tile(t, k, 'b'))).join('')}
        </div>`}
        ${checked ? `
          <div class="sc-result ${correctNow ? 'ok' : 'bad'}">
            ${correctNow
              ? `<b>✅ Düzgündür!</b>`
              : `<b>❌ Səhvdir.</b> Sənin cümlən: <s>${esc(sentence(answerWords))}</s>`}
            <div class="sc-correct">
              <button class="say" id="scSay" aria-label="Dinlə">🔊</button>
              <span>${esc(sentence(q.words))}</span>
            </div>
            ${correctNow ? '' : `<p class="small">${esc(RULE_AZ[q.type])}</p><p class="small muted">Bu sual turun sonunda yenidən gələcək.</p>`}
          </div>` : ''}
        <div class="sticky-cta sc-cta">
          ${checked
            ? `<button class="btn primary big" id="scNext">Növbəti ›</button>`
            : `<button class="btn ghost" id="scClear" ${chosen.length ? '' : 'disabled'}>↺ Sil</button>
               <button class="btn primary big" id="scCheck" ${chosen.length === q.tiles.length ? '' : 'disabled'}>Yoxla</button>`}
        </div>
      </main>`;

    $app.querySelectorAll('.sc-tile').forEach((b) =>
      b.addEventListener('click', () => {
        if (checked) return;
        fx.init();
        const k = Number(b.dataset.k);
        if (b.dataset.where === 'b') chosen.push(k);
        else chosen = chosen.filter((x) => x !== k);
        render();
      }),
    );
    $app.querySelector('#scTr').addEventListener('change', (e) => {
      showTr = e.target.checked;
      store.set('scrambleTr', showTr);
      render();
    });
    $app.querySelector('#scClear')?.addEventListener('click', () => {
      chosen = [];
      render();
    });
    $app.querySelector('#scCheck')?.addEventListener('click', () => check(q, qi));
    $app.querySelector('#scNext')?.addEventListener('click', next);
    $app.querySelector('#scSay')?.addEventListener('click', () => speakDe(sentence(q.words)));
  }

  function check(q, qi) {
    const words = chosen.map((k) => q.tiles[k].w);
    const ok = isCorrect(q, words);
    checked = ok ? 'ok' : 'bad';
    if (!(qi in st.first)) st.first[qi] = checked;
    st.tries = st.tries || {};
    st.tries[qi] = (st.tries[qi] || 0) + 1;
    if (ok) {
      fx.ding();
    } else {
      fx.oops();
      if (!st.logged[qi]) {
        st.logged[qi] = 1;
        saveMistake(cat, d, { wrong: sentence(words), correct: sentence(q.words), explanation: RULE_AZ[q.type] });
      }
    }
    save();
    render();
    if (ok) speakDe(sentence(q.words));
    const res = $app.querySelector('.sc-result');
    if (res && res.scrollIntoView) res.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function next() {
    const qi = st.queue.shift();
    if (checked === 'bad') {
      // səhv sual sözləri yenidən qarışdırılıb turun sonuna gedir
      st.items[qi].tiles = makeTiles(st.items[qi]);
      st.queue.push(qi);
    }
    checked = null;
    chosen = [];
    save();
    window.scrollTo(0, 0);
    render();
  }

  function renderEnd() {
    const total = st.items.length;
    const ok = Object.values(st.first).filter((x) => x === 'ok').length;
    const wrong = st.items.filter((_, i) => st.first[i] === 'bad');
    const done = store.get('done', {});
    done[d.id] = done[d.id] || Date.now();
    store.set('done', done);
    $app.innerHTML = `
      ${header(`🧩 ${esc(d.title)}`, `#/d/${d.id}`)}
      <main class="sc">
        <div class="hero sc-end">
          <h2>🎉 Tur bitdi!</h2>
          <p>İlk cəhddə düzgün: <b>${ok} / ${total}</b></p>
          ${wrong.length
            ? `<p class="small">Səhv etdiyin suallar (📒 Səhvlərim bölməsində də var):</p>
               <ul class="sc-wrong">${wrong.map((q) => `<li>${esc(sentence(q.words))}</li>`).join('')}</ul>`
            : '<p>Hamısı ilk cəhddə düzgün oldu! 👏</p>'}
          <p class="small muted">Yeni turda tamamilə başqa cümlələr olacaq.</p>
        </div>
        <div class="sticky-cta">
          <button class="btn primary big" id="scNew">🔄 Yeni tur (${ROUND_SIZE} yeni sual)</button>
        </div>
      </main>`;
    fx.init();
    fx.win();
    confetti($app.querySelector('.sc-end'));
    $app.querySelector('#scNew').addEventListener('click', () => {
      startRound();
      checked = null;
      chosen = [];
      window.scrollTo(0, 0);
      render();
    });
  }

  render();
}
