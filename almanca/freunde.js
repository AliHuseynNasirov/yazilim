// "Zwei Freunde im Restaurant" (Akkusativ): iki dost restoranda, menyu — Max & Moritz. Səsli (Gemini).
// app.js yalnız renderFreunde(ctx) çağırır.
//
// Gediş: Hallo, wie geht's? → Gut, danke! Und dir? → Was nimmst du? → şagird soruşur: "Gibt es hier eine Tomatensuppe?"
// (və ya "Haben die hier …?") → dost menyuya baxır: var / yox → şagird fikrini deyir → "Und was nimmst du?" →
// dost soruşur, şagird menyuya baxıb cavab verir (Ja, es gibt einen … / Nein, es gibt keinen …) → Guten Appetit!
// Forma hər yeni oyunda növbə ilə dəyişir: "gibt es" ↔ "haben die". Düz/səhv qərarını TƏTBİQ verir.

import { LiveSession } from './live.js';
import { plausibleTranscript } from './checker.js';
import { correctionRules } from './prompt.js';
import { MENU, FORMS, T, akk, akkNeg, euro, dishById, onMenu, friendPlan, checkHow, checkAsk, checkLike, checkBack, checkAnswer, checkBye } from './freunde-core.js';
import { dlog, showLogOverlay } from './log.js';

const LANG = { az: 'Azerbaijani', tr: 'Turkish', de: 'very simple German' };
const FRIEND = 'Lena';

function freundePrompt(expl) {
  return `You are a friendly German teacher. The learner is an A1.1 beginner whose native language is Azerbaijani; the topic is the ACCUSATIVE (einen / eine / ein, keinen / keine / kein).
You play the learner's friend ${FRIEND}. You two sit in the restaurant "Max & Moritz" and look at the menu. You use "du".

THE APP CONTROLS THE GAME. It decides what you say and whether the learner's sentence is correct (also the articles). Messages starting with "[App]" come from the app — follow them silently and exactly.

YOUR JOB — strictly:
1. Say ONLY what the app tells you to say, in German, exactly as given, slowly and clearly, like a friendly friend. Do not invent dishes, do not answer menu questions yourself.
2. After EVERY sentence of the learner, call the function learner_said with heard = EXACTLY what the learner said, word by word, uncorrected (wrong articles like "ein Salat" or "keine Fisch" must stay as they were). Then follow the function response exactly.
3. If the response says WRONG: step out of your role for a moment and explain the mistake in ${expl} using the content the app gives you (naturally, no label or prefix), say the correct German sentence slowly, and ask the learner in ${expl} to say it again. Then end your turn and wait. Repeat until the learner says it correctly.
4. If the response says CORRECT: stay in your role, do not praise, and say exactly what the response tells you.
5. Never answer questions that are not about this game. Keep everything short.

${correctionRules(expl)}`;
}

const TOOLS = [
  {
    name: 'learner_said',
    description: "Send the learner's sentence to the app. Call after EVERY sentence of the learner; the app checks it and tells you what to say.",
    parameters: { type: 'OBJECT', properties: { heard: { type: 'STRING', description: 'Exactly what the learner said, word by word, uncorrected.' } }, required: ['heard'] },
  },
];

export function renderFreunde(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake, closeMessage, MODELS } = ctx;
  const s = ctx.settings();
  const ptt = s.mode === 'ptt';
  const expl = LANG[s.explainLang] || LANG.az;
  const KEY = `freunde.${d.id}`;
  // forma növbə ilə: bir oyun "gibt es", növbəti "haben die"
  const nextForm = () => {
    const f = store.get('freundeForm', 'haben') === 'haben' ? 'gibt' : 'haben';
    store.set('freundeForm', f);
    return f;
  };
  const fresh = () => ({ v: 1, form: nextForm(), stage: 'start', dish1: null, plan: [], pi: 0, dish2: null, ok: 0, bad: 0, tries: 0, lastLine: '', finished: false });
  let st = store.get(KEY, null);
  if (!st || st.v !== 1 || !FORMS[st.form]) st = fresh();
  const save = () => store.set(KEY, st);
  const F = () => FORMS[st.form];
  const asked = () => dishById(st.plan[st.pi]);

  // ---------- ekran ----------
  const menuRow = (m, i) =>
    `<div class="mm-row" data-de="${esc(`${m.g} ${m.n}`)}"><span class="mm-no">${i + 1}</span><span class="mm-name">${esc(m.full)}<small><i class="mm-g ${m.g}">${m.g}</i> ${esc(m.az)}${m.veg ? ' · 🥕 vegetarisch' : ''}${m.pork ? ' · 🐷 Schwein' : ''}</small></span><b>${euro(m.p)}</b></div>`;
  $app.innerHTML = `
    ${header(esc(d.title), `#/d/${d.id}`)}
    <main class="practice mm">
      <div class="mm-top"><span id="mmForm"></span><span id="mmScore"></span></div>
      ${st.stage !== 'start' && !st.finished ? '<div class="resume-bar mm-rb">↩️ Qaldığın yerdən davam <button type="button" id="mmRestart">🔄 Yenidən başla</button></div>' : ''}
      <div class="mm-scene" id="mmScene">
        <div class="mm-p me"><div class="mm-bub" id="mmBubMe"></div><span>🧑</span><small>Sən</small></div>
        <div class="mm-p fr" id="mmFriend" role="button" title="Toxun — son cümləni təkrar etsin"><div class="mm-bub" id="mmBubFr"></div><span>👩</span><i class="mm-rep">🔁</i><small>${FRIEND} · müəllim</small></div>
        <div class="mm-table"><span class="mm-plate me" id="mmPlateMe"></span><span class="mm-menu-ic">📖</span><span class="mm-plate fr" id="mmPlateFr"></span></div>
      </div>
      <div class="mm-task" id="mmTask"></div>
      <div class="mm-mid" id="mmMid">
        <details class="mm-card" open><summary>🍽️ Restaurant Max &amp; Moritz — Speisekarte</summary>
          <div class="mm-sec">VORSPEISEN</div>${MENU.filter((m) => m.sec === 'vor').map((m) => menuRow(m, MENU.indexOf(m))).join('')}
          <div class="mm-sec">HAUPTGERICHTE</div>${MENU.filter((m) => m.sec === 'haupt').map((m) => menuRow(m, MENU.indexOf(m))).join('')}
        </details>
        <details class="mm-akk"><summary>📐 Akkusativ: einen / eine / ein</summary>
          <table><tr><th></th><th>der Salat</th><th>die Suppe</th><th>das Steak</th></tr>
          <tr><td>✅ var</td><td><b>einen</b> Salat</td><td><b>eine</b> Suppe</td><td><b>ein</b> Steak</td></tr>
          <tr><td>❌ yox</td><td><b>keinen</b> Salat</td><td><b>keine</b> Suppe</td><td><b>kein</b> Steak</td></tr>
          <tr><td>ich nehme</td><td><b>den</b> Salat</td><td><b>die</b> Suppe</td><td><b>das</b> Steak</td></tr></table>
          <small>Yalnız der-sözlər dəyişir: der → einen / keinen / den.</small>
        </details>
        <div id="chat" class="chat mm-chat"><div class="sys">${s.apiKey ? 'Başlamaq üçün aşağıdakı düyməyə bas.' : '🔑 Əvvəlcə <a href="#/settings">Ayarlar</a>-da API açarını yaz.'}</div></div>
      </div>
      <div class="controls">
        <div class="status"><span id="status">Hazır</span><span><button id="logBtn" type="button" class="mini-btn" title="Jurnal">📋</button> <span id="timer"></span></span></div>
        <div class="meter"><span id="level"></span></div>
        <div class="buttons">
          <button class="btn primary big" id="startBtn" ${s.apiKey ? '' : 'disabled'}>${st.finished ? '🔄 Yeni oyun' : '▶️ Başla'}</button>
          <button class="mic" id="micBtn" hidden>🎙️</button>
          <button class="btn ghost" id="endBtn" hidden>⏹ Bitir</button>
        </div>
        <form id="textForm" class="textrow" hidden>
          <input id="textIn" placeholder="Və ya yaz… (almanca)" autocomplete="off">
          <button class="btn">➤</button>
        </form>
      </div>
    </main>`;

  const $ = (q) => $app.querySelector(q);
  const root = $('main');
  const alive = () => document.body.contains(root);
  const chat = $('#chat');
  const statusEl = $('#status');
  const timerEl = $('#timer');
  const levelEl = $('#level');
  const startBtn = $('#startBtn');
  const micBtn = $('#micBtn');
  const endBtn = $('#endBtn');
  const textForm = $('#textForm');
  $('#logBtn').addEventListener('click', () => showLogOverlay($app));
  const setStatus = (t) => (statusEl.textContent = t);
  const scroll = () => {
    const m = $('#mmMid');
    m.scrollTop = m.scrollHeight;
  };
  let session = null;
  let last = null;
  let userUtter = '';

  function addLine(cls, text) {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    chat.appendChild(el);
    if (last) last.open = false;
    last = null;
    scroll();
  }
  const sys = (t) => addLine('sys', t);
  function addText(role, text) {
    if (!last || last.role !== role || !last.open) {
      const el = document.createElement('div');
      el.className = `msg ${role}`;
      chat.appendChild(el);
      last = { role, el, open: true, raw: '' };
    }
    last.raw += text;
    last.el.textContent = role === 'user' && !plausibleTranscript(last.raw) ? '🎙️ (səsin yazıya çevrilmədi — müəllim səsini eşidir)' : last.raw;
    scroll();
    const bub = role === 'ai' ? $('#mmBubFr') : $('#mmBubMe');
    bub.textContent = last.raw.length > 110 ? `…${last.raw.slice(-108)}` : last.raw;
    bub.classList.add('on');
    clearTimeout(bub._t);
    bub._t = setTimeout(() => bub.classList.remove('on'), 9000);
  }
  function speak(t) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'de-DE';
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  root.addEventListener('click', (e) => {
    const r = e.target.closest('[data-de]');
    if (r) speak(r.dataset.de);
  });
  // Dosta (Lena-ya) toxunanda — son cümləsini yenə desin ("Kannst du das bitte wiederholen?"); neçə dəfə bassan, o qədər
  $('#mmFriend').addEventListener('click', () => {
    const line = st.lastLine;
    const f = $('#mmFriend');
    f.classList.remove('tap');
    void f.offsetWidth;
    f.classList.add('tap');
    const bub = $('#mmBubFr');
    bub.textContent = line || `${FRIEND} hələ heç nə deməyib.`;
    bub.classList.add('on');
    clearTimeout(bub._t);
    bub._t = setTimeout(() => bub.classList.remove('on'), 7000);
    if (!line) return;
    dlog.add('təkrar', line);
    if (session && session.ready) {
      stopWaiting();
      session.sendText(`[App] The learner tapped on you to hear your last sentence again ("Kannst du das bitte wiederholen?"). Repeat it slowly and clearly, exactly: "${line}" Say nothing else, do not explain, do not call any function. Then end your turn and wait.`);
    } else speak(line);
  });

  // ---------- tapşırıq ----------
  function task() {
    const f = F();
    const d1 = dishById(st.dish1);
    switch (st.stage) {
      case 'how':
        return ['Cavab ver və dostundan da soruş: necəsən?', 'Gut, danke! Und dir?'];
      case 'ask':
        return [`Menyuya bax və soruş: bu yemək var? Bu oyunda: "${f.q} …?" (Akkusativ: einen / eine / ein)`, `${f.q} eine Tomatensuppe?`];
      case 'like':
        return [`${d1.n} var! Fikrini de: xoşlayırsan? dadlıdır? vegetariandır? Sonra dostundan soruş: "Und was nimmst du?"`, `Super! Ich nehme ${akk(d1)}. Ich esse gern ${d1.n}. Und was nimmst du?`];
      case 'back':
        return ['İndi dostundan soruş: o nə götürür?', 'Und was nimmst du?'];
      case 'answer': {
        const a = asked();
        return [`Dostun soruşur: "${a.n}" var? Menyuya bax və eyni formada cavab ver.`, onMenu(a) ? `${f.yes} ${akk(a)}.` : `${f.no} ${akkNeg(a)}.`];
      }
      case 'bye':
        return ['Yeməkdən əvvəl: "Guten Appetit!"', 'Guten Appetit!'];
    }
    return null;
  }
  function paint() {
    $('#mmForm').innerHTML = st.finished ? '🏆 Oyun bitdi' : `Bu oyun: <b>${esc(F().q)} …?</b>`;
    $('#mmScore').textContent = `✅ ${st.ok} · ❌ ${st.bad}`;
    $('#mmPlateMe').textContent = st.dish1 ? dishById(st.dish1).e : '';
    $('#mmPlateFr').textContent = st.dish2 ? dishById(st.dish2).e : '';
    $('#mmPlateMe').classList.toggle('on', !!st.dish1);
    $('#mmPlateFr').classList.toggle('on', !!st.dish2);
    const box = $('#mmTask');
    if (st.finished) {
      box.innerHTML = `<div class="mm-done">🏆 <b>Əla! Guten Appetit!</b><br>Düz: ${st.ok} · səhv: ${st.bad}. Növbəti oyunda forma dəyişəcək: <b>${esc(FORMS[st.form === 'gibt' ? 'haben' : 'gibt'].q)} …?</b></div>`;
      return;
    }
    const t = task();
    if (!t) {
      box.innerHTML = `<div class="mm-t them">🔊 ${FRIEND} danışır…</div>`;
      return;
    }
    box.innerHTML = `<div class="mm-t me">🎤 <b>Sənin növbən:</b> ${esc(t[0])}</div>
      <div class="mm-ex ${st.tries ? 'show' : ''}"><button type="button" id="mmExBtn">💡 Nümunə</button><span>${esc(t[1])}</span></div>`;
    $('#mmExBtn').addEventListener('click', () => $('#mmTask .mm-ex').classList.toggle('show'));
  }
  paint();
  const rb = $('#mmRestart');
  if (rb)
    rb.addEventListener('click', () => {
      if (!confirm('Oyun əvvəldən başlasın?')) return;
      store.set(KEY, null);
      ctx.teardown();
      renderFreunde(ctx);
    });

  // ---------- gediş ----------
  const sayLine = (line) => {
    st.lastLine = line;
    st.tries = 0;
    save();
    setTimeout(() => alive() && paint(), 50);
    return `say exactly in German: "${line}" Then end your turn and wait for the learner.`;
  };
  function finish() {
    st.finished = true;
    save();
    const done = store.get('done', {});
    done[d.id] = done[d.id] || Date.now();
    store.set('done', done);
    paint();
    fx.win();
    confetti($('#mmScene'));
  }

  const CHECKS = {
    how: (t) => checkHow(t),
    ask: (t) => checkAsk(t, st.form),
    like: (t) => checkLike(t),
    back: (t) => checkBack(t),
    answer: (t) => checkAnswer(t, st.plan[st.pi], st.form),
    bye: (t) => checkBye(t),
  };
  function judge(heard) {
    if (st.finished) return 'The game is finished. Say goodbye briefly in Azerbaijani.';
    const check = CHECKS[st.stage];
    if (!check) return `Not now. ${resumeTail()}`;
    const sources = [String(heard || '').trim(), userUtter.trim()].filter(Boolean);
    let res = null;
    for (const t of sources) {
      const r = check(t);
      if (r.ok) {
        res = r;
        break;
      }
      if (!res) res = r;
    }
    res = res || { ok: false, az: 'Bir cümlə de.' };
    const said = sources[0] || '—';
    // şagird bir yemək soruşubsa — düzgün cümləni həmin yeməklə göstər
    const ex = st.stage === 'ask' && res.dish ? `${F().q} ${akk(dishById(res.dish))}?` : (task() || [])[1] || '';
    if (!res.ok) {
      st.tries++;
      st.bad++;
      fx.oops();
      if ((said.match(/[a-zäöüß]{2,}/gi) || []).length >= 2) saveMistake(cat, d, { wrong: said, correct: ex, explanation: res.az });
      addLine('mnote', `❌ ${res.az}`);
      save();
      paint();
      return (
        `WRONG. Step out of your role for a moment: explain in ${expl} using exactly this content (naturally, no label or prefix): ${res.az} ` +
        `Then say the correct German sentence slowly: "${ex}" and ask the learner in ${expl} to say it again. Then end your turn. Stay at this step.`
      );
    }
    st.ok++;
    fx.ding();
    addLine('okline', `✅ ${said}`);
    const C = 'CORRECT — stay in your role, do not praise. Then ';
    switch (st.stage) {
      case 'how':
        st.stage = 'ask';
        return C + sayLine(T.menu());
      case 'ask': {
        const dish = dishById(res.dish);
        if (!onMenu(dish)) return C + sayLine(T.no(dish, st.form)); // yenə soruşsun
        st.dish1 = dish.id;
        st.stage = 'like';
        return C + sayLine(T.yes(dish, st.form));
      }
      case 'like':
        if (!res.back) {
          st.stage = 'back';
          save();
          paint();
          return 'CORRECT — stay in your role. Say only "Mhm, lecker!" and end your turn: the learner continues.';
        }
      // eslint-disable-next-line no-fallthrough
      case 'back':
        st.plan = friendPlan(Math.random, st.dish1);
        st.pi = 0;
        st.stage = 'answer';
        return C + sayLine(T.ask(asked(), st.form));
      case 'answer': {
        const a = asked();
        if (!onMenu(a)) {
          st.pi++;
          return C + sayLine(T.schade(asked(), st.form));
        }
        st.dish2 = a.id;
        st.stage = 'bye';
        return C + sayLine(T.like(a));
      }
      case 'bye':
        st.stage = 'end';
        st.finished = true;
        st.lastLine = T.bye();
        save();
        setTimeout(() => alive() && finish(), 1500);
        return `CORRECT — say exactly in German: "${T.bye()}" Then say in ${expl}: "Əla! Oyun bitdi. Növbəti oyunda başqa formada soruşacağıq." Then end your turn.`;
    }
    return C + 'end your turn.';
  }
  function resumeTail() {
    if (st.stage === 'start') {
      st.stage = 'how';
      return sayLine(T.greet());
    }
    return st.lastLine ? `say again in German, exactly: "${st.lastLine}" Then end your turn and wait.` : 'end your turn and wait for the learner.';
  }
  const stateText = () => `This game uses the form "${F().q} …?". ${st.dish1 ? `The learner takes: ${akk(dishById(st.dish1))}.` : ''} Now the learner must: ${(task() || ['—'])[0]}`;

  // ---------- səsli sessiya ----------
  let waitTimers = [];
  const stopWaiting = () => (waitTimers.forEach(clearTimeout), (waitTimers = []));
  let micOn = true;
  const idleStatus = () => (ptt ? 'Danışmaq üçün 🎙️ düyməsini basılı saxla' : micOn ? '🎧 Dinləyirəm… danış' : '🔇 Mikrofon bağlıdır');

  startBtn.addEventListener('click', async () => {
    if (st.finished) {
      store.set(KEY, null);
      ctx.teardown();
      renderFreunde(ctx);
      return;
    }
    dlog.start(`${d.title} · ${s.mode}`);
    fx.init();
    startBtn.disabled = true;
    setStatus('Qoşulur…');
    chat.innerHTML = '';
    let started = Date.now();
    session = new LiveSession({
      apiKey: s.apiKey,
      model: (!s.modelPicked && store.get('workingModel')) || s.model,
      fallbackModels: MODELS,
      transcriptionLanguages: ['de-DE', 'az-AZ'],
      voice: s.voice,
      pushToTalk: ptt,
      systemText: freundePrompt(expl),
      log: (k, x) => dlog.add(k, x),
      tools: TOOLS,
      onTool(name, args) {
        stopWaiting();
        if (name !== 'learner_said') return 'unknown function';
        if (args.heard) addLine('heardline', `🧑‍🏫 ${FRIEND} eşitdi: ${args.heard}`);
        return new Promise((r) => setTimeout(r, 500)).then(() => judge(args.heard));
      },
      onEvent(type, data) {
        switch (type) {
          case 'ready': {
            if (data && data.model && !data.reconnect) store.set('workingModel', data.model);
            if (data && data.reconnect) {
              setStatus(idleStatus());
              sys(data.resumed ? '✅ Bağlantı bərpa olundu.' : `✅ Yenidən qoşuldu (${data.model}).`);
              session.sendText(`[App] The connection was restarted. Same game. Do NOT greet or explain again. ${stateText()} Say in ${expl}: "Davam edirik." Then ${resumeTail()}`);
              break;
            }
            if (data && data.model) sys(`🤖 Model: ${data.model}`);
            const r = $('.mm-rb');
            if (r) r.remove();
            started = Date.now();
            startBtn.hidden = true;
            micBtn.hidden = endBtn.hidden = textForm.hidden = false;
            setStatus(idleStatus());
            if (st.stage !== 'start') session.sendText(`[App] The learner continues this game (progress saved). Do NOT explain again. ${stateText()} Say in ${expl}: "Xoş gəldin! Qaldığımız yerdən davam edirik." Then ${resumeTail()}`);
            else
              session.sendText(
                `[App] Start the game. Say in ${expl}, ONCE and briefly: "Biz iki dostuq, restoranda oturmuşuq. Menyu ekrandadır. Bu oyunda yeməyi '${F().q} …?' ilə soruşuruq — Akkusativə diqqət: einen, eine, ein." Then ${resumeTail()}`,
              );
            ctx.setTimer(
              setInterval(() => {
                const sec = Math.floor((Date.now() - started) / 1000);
                timerEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
              }, 1000),
            );
            break;
          }
          case 'userText':
            data = String(data).replace(/<[^>]*>/g, '');
            if (!data.trim()) break;
            userUtter += data;
            addText('user', data);
            break;
          case 'aiText':
            stopWaiting();
            if (last && last.role === 'user') last.open = false;
            addText('ai', data);
            break;
          case 'turnComplete':
            stopWaiting();
            if (last) last.open = false;
            break;
          case 'speaking':
            if (data) stopWaiting();
            setStatus(data ? `🗣️ ${FRIEND} danışır…` : idleStatus());
            break;
          case 'level':
            levelEl.style.width = `${Math.round(data * 100)}%`;
            break;
          case 'reconnecting':
            sys(`⚠️ Bağlantı qopdu (kod ${data.code}). Yenidən qoşulur… (${data.attempt})`);
            setStatus('🔄 Yenidən qoşulur…');
            break;
          case 'close':
            sys(closeMessage(data));
            setStatus('Bağlantı bitdi');
            micBtn.hidden = endBtn.hidden = textForm.hidden = true;
            startBtn.hidden = false;
            startBtn.disabled = false;
            startBtn.textContent = st.finished ? '🔄 Yeni oyun' : '🔄 Yenidən qoşul';
            if (session) session.cleanup();
            break;
        }
      },
    });
    ctx.setSession(session);
    try {
      await session.start();
    } catch (e) {
      sys(e && e.name === 'NotAllowedError' ? '🎙️ Mikrofon icazəsi verilmədi.' : `Xəta: ${e.message || e}`);
      ctx.teardown();
      startBtn.disabled = false;
      setStatus('Hazır');
    }
  });

  // Mikrofon
  let releaseTimer = null;
  function newPress() {
    userUtter = '';
    if (last && last.role === 'user') last.open = false;
  }
  if (ptt) {
    micBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      micBtn.classList.add('hold');
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
        if (session) session.setSending(false);
      }
      stopWaiting();
      newPress();
      if (session) session.setSending(true);
      setStatus('🔴 Danış… (buraxanda göndərilir)');
    });
    const up = () => {
      if (!micBtn.classList.contains('hold')) return;
      micBtn.classList.remove('hold');
      setStatus('⏳ Cavab gözlənilir…');
      releaseTimer = setTimeout(() => {
        releaseTimer = null;
        if (!session) return;
        session.setSending(false);
        stopWaiting();
        waitTimers.push(setTimeout(() => session && session.sendSilenceAndEnd(1.2), 4000));
        waitTimers.push(setTimeout(() => session && session.ready && session.sendText('[App] The learner has finished speaking. Call learner_said with what they said now.'), 8000));
      }, 450);
    };
    micBtn.addEventListener('pointerup', up);
    micBtn.addEventListener('pointerleave', up);
    micBtn.addEventListener('pointercancel', up);
    micBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  } else {
    micBtn.addEventListener('click', () => {
      micOn = !micOn;
      if (session) session.setSending(micOn);
      micBtn.classList.toggle('off', !micOn);
      setStatus(idleStatus());
    });
  }

  endBtn.addEventListener('click', () => session && session.sendText('[App] The learner wants to stop. Say goodbye briefly in Azerbaijani; the progress is saved.'));

  textForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#textIn');
    const t = inp.value.trim();
    if (!t || !session) return;
    newPress();
    userUtter = t;
    addText('user', t);
    last.open = false;
    dlog.add('yazılı', t);
    session.sendText(`[App] The learner TYPED this: "${t}". The app already checked it: ${judge(t)}`);
    inp.value = '';
  });
}
