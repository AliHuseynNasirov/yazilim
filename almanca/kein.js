// "Ist das ein Kaffee?" oyunu (sən və müəllim, növbə ilə). app.js yalnız renderKein(ctx) çağırır.
//
// Hər raundda iki şəkil: ✗ (yanlış) və ✓ (düzgün). Soruşan ✗ şəkil haqqında soruşur: "Ist das ein Kaffee?"
// Cavab verən: "Nein, das ist kein Kaffee. Das ist ein Espresso. (Und das ist mein Espresso.)"
// Birinci soruşan təsadüfi seçilir, sonra növbə dəyişir. Müəllim cavab verəndə bəzən səhv edir — sən yoxlayırsan.

import { findItem, question, answer, checkQuestion, checkAnswer, explain, wrongAnswer, newGame } from './kein-core.js';
import { asrSupported, listenLong, asrErrorText } from './asr.js';

const TEACHER_ERR = 0.3;
// Səsi tanıma bəzən sözü tutmur — onda cəza yox, "yenidən de" (ən çox 2 dəfə)
const MAX_RETRY = 2;
const foldTxt = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä|ae/g, 'a')
    .replace(/ö|oe/g, 'o')
    .replace(/ü|ue/g, 'u');

function speakDe(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.rate = 0.9;
  const de = speechSynthesis.getVoices().find((v) => v.lang && v.lang.replace('_', '-').startsWith('de'));
  if (de) u.voice = de;
  speechSynthesis.speak(u);
}

export function renderKein(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake } = ctx;
  const KEY = `kein.${d.id}`;
  const fresh = () => {
    const used = store.get('keinUsed', {});
    const g = newGame(10, used);
    g.rounds.forEach((r) => {
      used[r.x] = (used[r.x] || 0) + 1;
      used[r.y] = (used[r.y] || 0) + 1;
    });
    store.set('keinUsed', used);
    return { v: 1, ...g, i: 0, phase: 'start', cur: {}, stats: { ans: 0, ansOk: 0, q: 0, qOk: 0, judge: 0, judgeOk: 0 } };
  };
  let root = null;
  const alive = () => root && document.body.contains(root);
  let st = store.get(KEY, null);
  if (!st || st.v !== 1 || !Array.isArray(st.rounds)) st = fresh();
  const save = () => store.set(KEY, st);

  const round = () => st.rounds[st.i];
  const X = () => findItem(round().x);
  const Y = () => findItem(round().y);

  // ---------- ekran ----------
  function pics() {
    const x = X();
    const y = Y();
    const card = (it, ok) => `<div class="kn-pic ${ok ? 'ok' : 'no'}">
      <span class="kn-mark">${ok ? '✔' : '✖'}</span>
      <span class="kn-emoji">${it.e}</span>
      <b>${esc(it.n)}</b><small>${esc(it.az)}</small>
    </div>`;
    return `<div class="kn-pics">${card(x, false)}${card(y, true)}</div>`;
  }

  function panel() {
    const s = st.stats;
    const c = st.cur;
    const r = round();
    if (st.phase === 'over') {
      return `<div class="wf-panel ok">
        <h2>🎉 Oyun bitdi!</h2>
        <p>Cavabların: <b>${s.ansOk}/${s.ans}</b> düz · Sualların: <b>${s.qOk}/${s.q}</b> düz · Müəllimi yoxlamağın: <b>${s.judgeOk}/${s.judge}</b> düz</p>
        <p class="small muted">Yeni oyunda başqa şəkillər və sözlər olacaq.</p>
        <button class="btn primary big" id="knNew">🔄 Yeni oyun</button>
      </div>`;
    }
    if (st.phase === 'start') {
      return `<div class="wf-panel">
        <p>🎲 Püşk atıldı: <b>${st.first === 'L' ? 'birinci sən soruşursan' : 'birinci müəllim soruşur'}</b>. Sonra növbə ilə.</p>
        <p class="small muted">✖ şəkil haqqında soruşulur: <i>Ist das ein Kaffee?</i> Cavab: <i>Nein, das ist kein Kaffee. Das ist ein Espresso.</i></p>
        <button class="btn primary big" id="knGo">▶ Başla</button>
      </div>`;
    }
    const me = r.asker === 'L';
    const turn = `<div class="wf-turn ${me ? 'me' : 'them'}">${me ? '🔵 Sən soruşursan, müəllim cavab verir' : '🔴 Müəllim soruşur, sən cavab ver'}</div>`;
    if (st.phase === 'ask') {
      return `<div class="wf-panel">${turn}
        <p>✖ şəkil haqqında <b>səslə</b> sual ver: <i>Ist das …?</i></p>
        ${voiceBox('Ist das …?')}
      </div>`;
    }
    if (st.phase === 'answer') {
      return `<div class="wf-panel">${turn}
        <p class="kn-bubble">🧑‍🏫 <b>${esc(c.q)}</b> <button class="say" id="knSayQ" aria-label="Dinlə">🔊</button></p>
        <p class="small muted">Şəkilə bax və <b>səslə</b> cavab ver: <i>Nein, das ist … Das ist …</i></p>
        ${voiceBox('Nein, das ist …')}
      </div>`;
    }
    if (st.phase === 'judge') {
      return `<div class="wf-panel">${turn}${c.qMsg || ''}
        <p class="kn-bubble">🧑‍🏫 <b>${esc(c.t)}</b> <button class="say" id="knSayT" aria-label="Dinlə">🔊</button></p>
        <p class="small muted">Müəllimin cavabını yoxla: düzdür, yoxsa səhv?</p>
        <div class="k-two"><button class="btn" id="knOk">✅ Düzdür</button><button class="btn" id="knBad">❌ Səhvdir</button></div>
      </div>`;
    }
    if (st.phase === 'result') {
      return `<div class="wf-panel ${c.ok ? 'ok' : 'bad'}">${turn}${c.msg}
        <button class="btn primary big" id="knNext">${st.i + 1 >= st.rounds.length ? '🏁 Nəticə' : 'Növbəti ›'}</button>
      </div>`;
    }
    return '';
  }

  // Səs bloku: böyük 🎙️ + eşidilən yazı; səs tanınmırsa və ya istəsən — yazmaq
  function voiceBox(ph) {
    const c = st.cur;
    const can = asrSupported();
    const kb = !can || c.kb;
    return `${c.retryMsg ? `<p class="kn-retry">${c.retryMsg}</p>` : ''}
      ${can ? `<div class="kn-voice">
        <button class="mic kn-mic ${listening ? 'hold' : ''}" id="knMic" aria-label="Danış" ${listening ? 'disabled' : ''}>🎙️</button>
        <div class="kn-heard" id="knHeard">${listening ? `🔴 ${esc(liveText) || 'Dinləyirəm… cümləni tam de, sonra yaşıl düyməni bas'}` : c.heard ? `Eşitdim: «${esc(c.heard)}»` : '🎙️ düyməsinə bas və danış'}</div>
      </div>
      ${listening ? `<div class="kn-live-btns">
        <button class="btn ghost" id="knClear" type="button">↺ Sil, yenidən de</button>
        <button class="btn kn-send" id="knSend" type="button">✅ Bitirdim — yoxla</button>
      </div>` : ''}` : '<p class="small muted">Bu brauzer səsi tanımır — cavabı yaz (Chrome-da səslə işləyir).</p>'}
      ${kb
        ? `<form id="knForm" class="wf-form kn-form"><textarea id="knIn" rows="2" autocomplete="off" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="${esc(ph)}"></textarea><button class="btn primary">Yoxla</button></form>`
        : '<button class="btn ghost kn-kb" id="knKb" type="button">⌨️ Yazaraq cavab ver</button>'}`;
  }

  // 🎙️ basanda dinləmə başlayır və yaşıl "Bitirdim" basılana qədər davam edir (fasilələrdə dayanmır)
  let listening = false;
  let liveText = '';
  let rec = null;
  function micClick() {
    if (listening) return;
    fx.init();
    listening = true;
    liveText = '';
    st.cur.retryMsg = '';
    render();
    rec = listenLong({
      isAlive: alive,
      onText: (t) => {
        liveText = t;
        const h = $app.querySelector('#knHeard');
        if (h) h.textContent = `🔴 ${t || 'Dinləyirəm…'}`;
      },
      onError: (code) => {
        const m = asrErrorText(code);
        if (m) st.cur.retryMsg = m;
      },
      onDone: (t, fatal) => {
        listening = false;
        rec = null;
        liveText = '';
        if (!alive()) return;
        if (t) heardText(t);
        else {
          if (!fatal && !st.cur.retryMsg) st.cur.retryMsg = asrErrorText('no-speech');
          render();
        }
      },
    });
  }
  function sendClick() {
    if (rec) rec.finish();
  }
  function clearClick() {
    liveText = '';
    if (rec) rec.clear();
    const h = $app.querySelector('#knHeard');
    if (h) h.textContent = '🔴 Dinləyirəm… yenidən de';
  }

  // Səslə deyilən: əvvəl sözlər tanınıbmı yoxla (tanınmayıbsa cəza yox, yenidən de)
  function heardText(t) {
    const r = round();
    const need = st.phase === 'ask' ? [X().n] : [X().n, Y().n];
    const ok = need.every((n) => foldTxt(t).includes(foldTxt(n)));
    st.cur.heard = t;
    if (!ok && (st.cur.tries || 0) < MAX_RETRY) {
      st.cur.tries = (st.cur.tries || 0) + 1;
      st.cur.retryMsg = `🤔 Eşitdim: «${esc(t)}». Şəkildəki sözü (${need.map(esc).join(', ')}) tanıya bilmədim — yenidən de, aydın və yavaş.`;
      save();
      render();
      return;
    }
    st.cur.tries = 0;
    st.cur.retryMsg = '';
    st.phase === 'ask' ? asked(t) : answered(t);
    void r;
  }

  function render() {
    const s = st.stats;
    $app.innerHTML = `
      ${header(esc(d.title), `#/d/${d.id}`)}
      <main class="wf kn">
        <div class="sc-top"><span>Raund <b>${Math.min(st.i + 1, st.rounds.length)}</b> / ${st.rounds.length}</span><span class="sc-score">✅ ${s.ansOk + s.qOk + s.judgeOk} · ❌ ${s.ans - s.ansOk + s.q - s.qOk + s.judge - s.judgeOk}</span></div>
        <div class="progress"><span style="width:${Math.round((st.i / st.rounds.length) * 100)}%"></span></div>
        ${st.phase === 'over' ? '' : pics()}
        ${panel()}
        <details class="rule-mini"><summary>📘 ein / eine · kein / keine · mein / meine</summary><div class="rule">
          <p><b>der</b> və <b>das</b> sözləri: <b>ein</b> · <b>kein</b> · <b>mein</b> — <i>ein Kaffee, kein Wasser, mein Espresso</i></p>
          <p><b>die</b> sözləri: <b>eine</b> · <b>keine</b> · <b>meine</b> — <i>eine Cola, keine Milch, meine Limonade</i></p>
          <p>Sual (fel əvvəldə): <i>Ist das ein Kaffee?</i> · Cavab: <i>Nein, das ist kein Kaffee. Das ist ein Espresso.</i> Və ya: <i>Das ist mein Espresso.</i></p>
        </div></details>
        ${st.phase !== 'start' && st.phase !== 'over' ? '<button class="btn ghost wf-restart" id="knRestart">🔄 Yeni oyun</button>' : ''}
      </main>`;
    root = $app.querySelector('main');
    bind();
  }

  function bind() {
    const on = (sel, fn) => {
      const el = $app.querySelector(sel);
      if (el) el.addEventListener('click', fn);
    };
    on('#knGo', () => {
      fx.init();
      startRound();
    });
    on('#knNew', () => {
      st = fresh();
      save();
      render();
    });
    on('#knRestart', () => {
      if (!confirm('Yeni oyun başlasın?')) return;
      st = fresh();
      save();
      render();
    });
    on('#knNext', nextRound);
    on('#knOk', () => judge(true));
    on('#knBad', () => judge(false));
    on('#knSayQ', () => speakDe(st.cur.q));
    on('#knSayT', () => speakDe(st.cur.t));
    on('#knSayC', () => speakDe(st.cur.model));
    on('#knMic', micClick);
    on('#knSend', sendClick);
    on('#knClear', clearClick);
    on('#knKb', () => {
      st.cur.kb = true;
      render();
    });
    const form = $app.querySelector('#knForm');
    if (form) {
      const inp = $app.querySelector('#knIn');
      if (st.cur.kb) inp.focus();
      const go = () => {
        if (!inp.value.trim()) return;
        st.phase === 'ask' ? asked(inp.value) : answered(inp.value);
      };
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        go();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          go();
        }
      });
    }
    const p = $app.querySelector('.wf-panel');
    if (p && p.scrollIntoView && st.phase !== 'start') p.scrollIntoView({ block: 'nearest' });
  }

  // ---------- gediş ----------
  function startRound() {
    const r = round();
    st.cur = { kb: st.cur && st.cur.kb && !asrSupported() };
    if (r.asker === 'T') {
      st.cur.q = question(X());
      st.phase = 'answer';
      save();
      render();
      speakDe(st.cur.q);
    } else {
      st.phase = 'ask';
      save();
      render();
    }
  }

  // Şagird soruşdu → yoxla → müəllim cavab verir (bəzən səhv) → şagird yoxlayır
  function asked(input) {
    const x = X();
    const y = Y();
    const r = checkQuestion(input, x);
    st.stats.q++;
    const right = question(x);
    if (r.ok) {
      st.stats.qOk++;
      fx.ding();
      st.cur.qMsg = `<p class="kn-ok">✅ Sualın düzdür: <i>${esc(right)}</i></p>`;
    } else {
      fx.oops();
      st.cur.qMsg = `<p class="kn-bad">❌ Sualda səhv var. Sən dedin: <s>${esc(input.trim())}</s> → <b>${esc(right)}</b><br><small>💡 ${esc(explain(r.why, x, y, r.got))}</small></p>`;
      saveMistake(cat, d, { wrong: input.trim(), correct: right, explanation: explain(r.why, x, y, r.got) });
    }
    st.cur.wrong = Math.random() < TEACHER_ERR;
    st.cur.model = answer(x, y, Math.random() < 0.5);
    st.cur.t = st.cur.wrong ? wrongAnswer(x, y) : st.cur.model;
    st.phase = 'judge';
    save();
    render();
    speakDe(st.cur.t);
  }

  function judge(saysOk) {
    const x = X();
    const y = Y();
    const teacherOk = !st.cur.wrong;
    const right = saysOk === teacherOk;
    st.stats.judge++;
    if (right) st.stats.judgeOk++;
    right ? fx.ding() : fx.oops();
    const model = answer(x, y, false);
    st.cur.ok = right;
    st.cur.msg =
      (st.cur.qMsg || '') +
      (teacherOk
        ? `<p>${right ? '👍 Düz yoxladın!' : '👎 Diqqətli ol!'} Müəllimin cavabı <b>düzdür</b>.</p><p class="wf-correct">✔ ${esc(st.cur.t)}</p>`
        : `<p>${right ? '👍 Düz yoxladın!' : '👎 Diqqətli ol!'} Müəllimin cavabı <b>səhvdir</b>: <s>${esc(st.cur.t)}</s></p><p class="wf-correct">✔ ${esc(model)}</p><p class="small">💡 ${esc(explain('negArt', x, y))} ${esc(explain('posArt', x, y))}</p>`);
    st.phase = 'result';
    save();
    render();
    if (!teacherOk) speakDe(model);
  }

  // Müəllim soruşdu → şagird cavab verdi → yoxla
  function answered(input) {
    const x = X();
    const y = Y();
    const r = checkAnswer(input, x, y);
    st.stats.ans++;
    const model = answer(x, y, true);
    st.cur.model = model;
    st.cur.ok = r.ok;
    if (r.ok) {
      st.stats.ansOk++;
      fx.ding();
      st.cur.msg = `<p>✅ <b>Düzgündür!</b> <small class="muted">(eşitdim: «${esc(input.trim())}»)</small></p><p class="wf-correct">${esc(answer(x, y, false))}</p>`;
      speakDe(answer(x, y, false));
    } else {
      fx.oops();
      st.cur.msg = `<p>❌ <b>Səhv var.</b> Sən dedin: <s>${esc(input.trim())}</s></p><p class="wf-correct">✔ ${esc(model)} <button class="say" id="knSayC" aria-label="Dinlə">🔊</button></p><p class="small">💡 ${esc(explain(r.why, x, y, r.got))}</p>`;
      saveMistake(cat, d, { wrong: input.trim(), correct: answer(x, y, false), explanation: explain(r.why, x, y, r.got) });
    }
    st.phase = 'result';
    save();
    render();
  }

  function nextRound() {
    st.i++;
    if (st.i >= st.rounds.length) {
      st.phase = 'over';
      const done = store.get('done', {});
      done[d.id] = done[d.id] || Date.now();
      store.set('done', done);
      save();
      render();
      fx.win();
      confetti($app.querySelector('.wf-panel'));
      return;
    }
    startRound();
  }

  render();
}
