// "WhatsApp yazışması" (A1.1): dostla mesajlaşma — dəvət, harada?, ünvan, sağollaşma. app.js yalnız renderChat(ctx) çağırır.
//
// Hər raundun əvvəlində tədbir kartı göstərilir (gün, tədbir, məkan, ünvan).
// 1-ci raund: dost (müəllim) dəvət edir, şagird soruşur. 2-ci raund: şagird dəvət edir, dost soruşur.
// Məzmunu tətbiq yoxlayır; qrammatikanı süni intellekt (Gemini) yoxlayır və düzəldir — şagird düzgün yazana qədər.

import { ROUNDS, DAYS, FRIENDS, ev, pl, cap, address, checkStep, aiCheck, wordDiff, same, newGame } from './chat-core.js';
import { dlog } from './log.js';

export function renderChat(ctx) {
  const { $app, d, cat, store, esc, fx, confetti, saveMistake } = ctx;
  const s = ctx.settings();
  const KEY = `chat.${d.id}`;

  let st = store.get(KEY, null);
  const fresh = () => {
    const g = newGame();
    // dəvət forması növbə ilə: bir söhbət "es gibt", növbəti "ist"
    const gibt = store.get('chatForm', 'ist') !== 'gibt';
    store.set('chatForm', gibt ? 'gibt' : 'ist');
    g.sc.forEach((x) => (x.gibt = gibt));
    return { v: 1, ...g, round: 0, idx: 0, intro: [false, false], msgs: [{ type: 'date' }, { type: 'sys', text: '🔒 Bu söhbət A1.1 məşqidir. Müəllim hər mesajını yoxlayacaq və səhvləri düzəldəcək.' }], ok: 0, bad: 0, lastFix: null, tries: 0, finished: false };
  };
  if (!st || st.v !== 1 || !Array.isArray(st.msgs)) st = fresh();
  const save = () => store.set(KEY, st);
  const friend = FRIENDS.find((f) => f.n === st.friend) || FRIENDS[0];
  const sc = () => st.sc[st.round];
  const cur = () => ROUNDS[st.round][st.idx];
  const now = () => Date.now();
  const hhmm = (t) => {
    const x = new Date(t || now());
    return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
  };

  $app.innerHTML = `
    <main class="wa">
      <header class="wa-top">
        <a class="wa-back" href="#/d/${d.id}" aria-label="Geri">‹</a>
        <span class="wa-ava" style="background:${friend.c}">${esc(friend.n[0])}</span>
        <div class="wa-who"><b>${esc(friend.n)}</b><small id="waStatus">online</small></div>
        <button type="button" class="wa-ic" id="waCardBtn" title="Tədbir kartı">📅</button>
        <button type="button" class="wa-ic" id="waRestart" title="Yenidən başla">🔄</button>
      </header>
      <div class="wa-body" id="waBody"><div class="wa-list" id="waList"></div></div>
      <footer class="wa-foot" id="waFoot">
        <div class="wa-task" id="waTask"></div>
        <div class="wa-emo" id="waEmo" hidden>${['😊', '😃', '👍', '🎉', '🙂', '😍', '👋', '🙏', '🎸', '⚽'].map((e) => `<button type="button">${e}</button>`).join('')}</div>
        <div class="wa-keys">${['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'].map((k) => `<button type="button">${k}</button>`).join('')}</div>
        <form class="wa-input" id="waForm">
          <div class="wa-field">
            <button type="button" class="wa-emo-btn" id="waEmoBtn">😊</button>
            <input id="waIn" placeholder="Mesaj" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="send">
          </div>
          <button class="wa-send" id="waSend" aria-label="Göndər">➤</button>
        </form>
      </footer>
      <div class="wa-modal" id="waModal" hidden></div>
    </main>`;

  const $ = (q) => $app.querySelector(q);
  const root = $('main');
  const alive = () => document.body.contains(root);
  const list = $('#waList');
  const body = $('#waBody');
  const input = $('#waIn');
  const sendBtn = $('#waSend');
  const statusEl = $('#waStatus');
  let busy = false;

  // ---------- mesajların görünüşü ----------
  function cardHtml(r) {
    const x = st.sc[r];
    const E = ev(x), P = pl(x);
    return `<div class="wa-card">
      <div class="wa-card-top"><span>${E.e}</span><div><b>${esc(E.n)}</b><small>${esc(E.az)}</small></div></div>
      <div class="wa-card-row"><i>📅</i><b>${cap(x.day)}</b><small>${DAYS[x.day]}</small></div>
      <div class="wa-card-row"><i>${P.e}</i><b>${esc(P.n)}</b><small>${esc(P.az)}</small></div>
      <div class="wa-card-row"><i>📍</i><b>${esc(address(x))}</b><small>ünvan</small></div>
      <div class="wa-card-map"><span>📍</span></div>
    </div>`;
  }
  const ticks = (m) => (m.status === 'bad' ? '<span class="wa-tk bad">❗</span>' : m.status === 'read' ? '<span class="wa-tk read">✓✓</span>' : m.status === 'delivered' ? '<span class="wa-tk">✓✓</span>' : '<span class="wa-tk">✓</span>');
  function diffHtml(a, b) {
    return wordDiff(a, b)
      .map((p) => (p.t === 'same' ? esc(p.w) : p.t === 'del' ? `<del>${esc(p.w)}</del>` : `<ins>${esc(p.w)}</ins>`))
      .join(' ');
  }
  function msgHtml(m, i) {
    switch (m.type) {
      case 'date':
        return '<div class="wa-chip">BU GÜN</div>';
      case 'sys':
        return `<div class="wa-sys">${esc(m.text)}</div>`;
      case 'round':
        return `<div class="wa-round">${esc(m.text)}</div>`;
      case 'card':
        return `<div class="wa-row in"><div class="wa-msg in card-msg">${cardHtml(m.r)}<span class="wa-meta">${hhmm(m.t)}</span></div></div>`;
      case 'in':
        return `<div class="wa-row in"><div class="wa-msg in" data-say="${i}">${esc(m.text)}<span class="wa-meta">${hhmm(m.t)}</span></div></div>`;
      case 'out':
        return `<div class="wa-row out"><div class="wa-msg out ${m.status === 'bad' ? 'bad' : ''}">${esc(m.text)}<span class="wa-meta">${hhmm(m.t)} ${ticks(m)}</span></div></div>`;
      case 'fix':
        return `<div class="wa-fix"><div class="wa-fix-h">✏️ Müəllim düzəltdi</div>
          <div class="wa-fix-d">${diffHtml(m.orig, m.corrected)}</div>
          <div class="wa-fix-c">✅ ${esc(m.corrected)}</div>
          ${m.expl ? `<div class="wa-fix-e">${esc(m.expl)}</div>` : ''}
          <div class="wa-fix-a">👉 Düzgün yazıb yenidən göndər.</div></div>`;
      case 'task':
        return `<div class="wa-fix task"><div class="wa-fix-h">🎯 Müəllim</div><div class="wa-fix-e">${esc(m.text)}</div></div>`;
      case 'note':
        return `<div class="wa-note">💡 ${esc(m.text)}</div>`;
      case 'end':
        return `<div class="wa-end">🏆 <b>Əla! Söhbət bitdi.</b><br>Həm dəvət etdin, həm də dəvətə cavab verdin.<br><small>Düz mesajlar: ${st.ok} · düzəlişlər: ${st.bad}</small></div>`;
    }
    return '';
  }
  function renderList() {
    list.innerHTML = st.msgs.map(msgHtml).join('');
    scrollDown();
  }
  function scrollDown() {
    body.scrollTop = body.scrollHeight;
  }
  function push(m) {
    m.t = m.t || now();
    st.msgs.push(m);
    save();
    list.insertAdjacentHTML('beforeend', msgHtml(m, st.msgs.length - 1));
    const el = list.lastElementChild;
    if (el) el.classList.add('pop');
    scrollDown();
    return m;
  }
  function refreshOut(m) {
    // son mesajın görünüşünü yenilə (işarələr)
    const idx = st.msgs.lastIndexOf(m);
    const rows = list.children;
    if (rows[idx]) rows[idx].outerHTML = msgHtml(m, idx);
    save();
  }

  // ---------- tapşırıq zolağı ----------
  function paintTask() {
    const box = $('#waTask');
    const form = $('#waForm');
    if (st.finished) {
      box.innerHTML = `<div class="wa-done"><span>🏆 Düz: ${st.ok} · Düzəliş: ${st.bad}</span><button type="button" class="btn primary" id="waNew">🔄 Yeni söhbət</button></div>`;
      form.hidden = true;
      $app.querySelector('.wa-keys').hidden = true;
      $('#waNew').addEventListener('click', () => {
        store.set(KEY, null);
        renderChat(ctx);
      });
      return;
    }
    const step = cur();
    if (!step || step.who !== 'L' || busy) {
      box.innerHTML = `<div class="wa-t wait">⏳ ${busy === 'check' ? 'Müəllim yoxlayır…' : `${esc(friend.n)} yazır…`}</div>`;
      sendBtn.disabled = true;
      return;
    }
    sendBtn.disabled = false;
    box.innerHTML = `<div class="wa-t"><b>🎯 ${st.round === 0 ? '1' : '2'}-ci raund:</b> ${esc(step.task(sc()))}
      <button type="button" id="waHint">💡</button><span class="wa-ex ${st.tries ? 'show' : ''}">${esc(step.ex(sc()))}</span></div>`;
    $('#waHint').addEventListener('click', () => $('#waTask .wa-ex').classList.toggle('show'));
  }

  // ---------- kart pəncərəsi ----------
  function showModal(r, startAfter) {
    const m = $('#waModal');
    m.innerHTML = `<div class="wa-modal-box">
      <div class="wa-modal-h">${r === 0 ? `1-ci raund · ${esc(friend.n)} səni dəvət edir` : '2-ci raund · İndi sən dəvət edirsən'}</div>
      ${cardHtml(r)}
      <p>${r === 0 ? `${esc(friend.n)} sənə yazacaq. Sən <b>razılaş</b> və <b>sual ver</b>: harada? ünvan nədir? Sonda sağollaş.` : `Kartdakı tədbirə dostunu (${esc(friend.n)}) <b>dəvət et</b>: gün + tədbir + "Hast du Lust?" Sonra onun suallarına cavab ver: harada? ünvan?`}</p>
      <button type="button" class="btn primary big" id="waGo">${startAfter ? '💬 Söhbətə başla' : 'Bağla'}</button>
    </div>`;
    m.hidden = false;
    $('#waGo').addEventListener('click', () => {
      m.hidden = true;
      if (startAfter) startAfter();
    });
  }
  $('#waCardBtn').addEventListener('click', () => showModal(st.round, null));
  $('#waRestart').addEventListener('click', () => {
    if (!confirm('Söhbət əvvəldən başlasın?')) return;
    store.set(KEY, null);
    renderChat(ctx);
  });

  // ---------- gediş ----------
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function markRead() {
    for (const m of st.msgs) if (m.type === 'out' && m.status === 'delivered') m.status = 'read';
    renderList();
  }
  async function friendTurn() {
    busy = 'friend';
    paintTask();
    while (alive() && cur() && cur().who === 'T') {
      const text = cur().say(sc());
      await wait(500);
      if (!alive()) return;
      markRead();
      statusEl.textContent = 'yazır…';
      list.insertAdjacentHTML('beforeend', '<div class="wa-row in" id="waTyping"><div class="wa-msg in typing"><i></i><i></i><i></i></div></div>');
      scrollDown();
      await wait(Math.min(2200, 700 + text.length * 18));
      if (!alive()) return;
      const t = $('#waTyping');
      if (t) t.remove();
      statusEl.textContent = 'online';
      st.idx++;
      push({ type: 'in', text });
      fx.tone([700, 990], 0.06, 'sine', 0.05);
    }
    busy = false;
    if (!alive()) return;
    if (!cur()) return roundEnd();
    paintTask();
    input.focus();
  }

  function roundEnd() {
    if (st.round === 0) {
      push({ type: 'round', text: '🔁 Rollar dəyişir: indi sən dəvət edirsən' });
      st.round = 1;
      st.idx = 0;
      st.tries = 0;
      save();
      return beginRound();
    }
    st.finished = true;
    push({ type: 'end' });
    const done = store.get('done', {});
    done[d.id] = done[d.id] || Date.now();
    store.set('done', done);
    save();
    paintTask();
    fx.win();
    confetti(body);
  }

  function beginRound() {
    const go = () => {
      st.intro[st.round] = true;
      push({ type: 'card', r: st.round });
      const g = sc().gibt;
      if (st.round === 0) push({ type: 'note', text: `${friend.n} səni dəvət edir. Kartda hər şey yazılıb. ` + (g ? 'Bu dəfə "es gibt" (var) ilə yazacaq: "Heute gibt es ein Konzert." der-sözlərdə artikl dəyişir: "es gibt einen Flohmarkt".' : 'Bu dəfə "ist" ilə yazacaq: "Heute ist ein Konzert."') });
      else push({ type: 'note', text: 'Bu kartı dostuna göndərmək üçün özün yaz: gün, tədbir, yer, ünvan. ' + (g ? 'Dəvəti "… gibt es …" ilə yaz (der-söz → einen).' : 'Dəvəti "… ist ein/eine …" ilə yaz.') });
      save();
      friendTurn();
    };
    if (!st.intro[st.round]) showModal(st.round, go);
    else friendTurn();
  }

  // ---------- şagirdin mesajı ----------
  async function send(text) {
    const step = cur();
    if (!step || step.who !== 'L' || busy) return;
    const m = push({ type: 'out', text, status: 'sent' });
    fx.tone([520, 780], 0.05, 'sine', 0.05);
    dlog.add('yazdı', text);
    // əvvəlki düzəlişi eynilə yazıbsa — qəbul et
    if (st.lastFix && same(text, st.lastFix)) return accept(m, null);
    const c = checkStep(step.k, text, sc());
    if (!c.ok) {
      m.status = 'bad';
      refreshOut(m);
      st.tries++;
      st.bad++;
      push({ type: 'task', text: c.az });
      fx.oops();
      paintTask();
      return;
    }
    busy = 'check';
    paintTask();
    const r = await aiCheck({ apiKey: s.apiKey, text, context: [...st.msgs].reverse().find((x) => x.type === 'in')?.text || '', explainLang: s.explainLang, log: (k, x) => dlog.add(k, x) });
    busy = false;
    if (!alive()) return;
    if (r && !r.correct) {
      m.status = 'bad';
      refreshOut(m);
      st.tries++;
      st.bad++;
      st.lastFix = r.corrected;
      push({ type: 'fix', orig: text, corrected: r.corrected, expl: r.explanation });
      if ((text.match(/[a-zäöüß]{2,}/gi) || []).length >= 2) saveMistake(cat, d, { wrong: text, correct: r.corrected, explanation: r.explanation });
      fx.oops();
      paintTask();
      return;
    }
    if (!r && s.apiKey) push({ type: 'note', text: 'Qrammatika yoxlanmadı (internet və ya AI xətası) — yalnız məzmun yoxlandı.' });
    accept(m, r);
  }
  function accept(m, r) {
    m.status = 'delivered';
    refreshOut(m);
    if (r && r.minor) push({ type: 'note', text: r.minor });
    st.ok++;
    st.idx++;
    st.tries = 0;
    st.lastFix = null;
    save();
    fx.ding();
    if (!cur()) {
      markRead();
      return roundEnd();
    }
    friendTurn();
  }

  // ---------- giriş ----------
  $('#waForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t || busy) return;
    input.value = '';
    send(t);
  });
  $app.querySelector('.wa-keys').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const p = input.selectionStart ?? input.value.length;
    input.value = input.value.slice(0, p) + b.textContent + input.value.slice(input.selectionEnd ?? p);
    input.focus();
    input.setSelectionRange(p + 1, p + 1);
  });
  $('#waEmoBtn').addEventListener('click', () => ($('#waEmo').hidden = !$('#waEmo').hidden));
  $('#waEmo').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    input.value += b.textContent;
    input.focus();
  });
  // dostun mesajına toxunanda səsləndir
  list.addEventListener('click', (e) => {
    const el = e.target.closest('[data-say]');
    if (!el || !('speechSynthesis' in window)) return;
    const m = st.msgs[+el.dataset.say];
    if (!m) return;
    const u = new SpeechSynthesisUtterance(m.text.replace(/[^\p{L}\p{N}\s.,!?'-]/gu, ''));
    u.lang = 'de-DE';
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });

  // ---------- başla ----------
  renderList();
  if (!s.apiKey && st.msgs.length <= 2) push({ type: 'note', text: 'Qrammatika yoxlaması üçün Ayarlar-da Gemini API açarını yaz. İndi yalnız məzmun yoxlanılır.' });
  paintTask();
  if (st.finished) return;
  if (!st.intro[st.round]) beginRound();
  else if (cur() && cur().who === 'T') friendTurn();
  else paintTask();
}
