// "Guten Appetit! — Food Blogger" (4-cü bölmə): mətn + səsli sual-cavab. app.js yalnız renderBlog(ctx) çağırır.
//
// Müəllim (Gemini) mətnə uyğun sual verir, şagird səslə cavab verir. Düz/səhv qərarını TƏTBİQ verir;
// səhvdə müəllim azərbaycanca izah edir və düzgün deyənə qədər təkrar etdirir.

import { LiveSession } from './live.js';
import { plausibleTranscript } from './checker.js';
import { correctionRules } from './prompt.js';
import { TEXT, TYPES, byId, newRound, norm } from './blog-core.js';
import { dlog, showLogOverlay } from './log.js';

const LANG = { az: 'Azerbaijani', tr: 'Turkish', de: 'very simple German' };

function blogPrompt(expl) {
  return `You are a friendly German teacher. The learner is an A1.1 beginner whose native language is Azerbaijani.
The lesson is about a short magazine text "Was machen Food Blogger?" (people post photos of food; Elaine, 19, likes it; Sascha, 22, does not: "Das nervt!").
You ask the learner questions about the text and about their own opinion; the learner answers by voice.

THE APP CONTROLS THE LESSON. It decides the question, what you say and whether the answer is correct. Messages starting with "[App]" come from the app — follow them silently and exactly.

YOUR JOB — strictly:
1. Ask ONLY the question the app gives you, in German, exactly as given, slowly and very clearly (the learner is training their ear). Do not add other questions.
2. After EVERY answer of the learner, call the function learner_said with heard = EXACTLY what the learner said, word by word, uncorrected (wrong verb forms like "ich findest" must stay as they were). Then follow the function response exactly.
3. If the response says WRONG: explain the mistake in ${expl} using the content the app gives you (naturally, no label or prefix), say the correct German sentence slowly, and ask the learner in ${expl} to say it again. Then end your turn and wait. Repeat until the learner says it correctly.
4. If the response says CORRECT: say only a very short praise in German ("Richtig!", "Super!", "Genau!") and then exactly what the response tells you.
5. Never answer questions that are not about this lesson. Keep everything short.

${correctionRules(expl)}`;
}

const TOOLS = [
  {
    name: 'learner_said',
    description: "Send the learner's answer to the app. Call after EVERY answer of the learner; the app checks it and tells you what to say.",
    parameters: { type: 'OBJECT', properties: { heard: { type: 'STRING', description: 'Exactly what the learner said, word by word, uncorrected.' } }, required: ['heard'] },
  },
];

export function renderBlog(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake, closeMessage, MODELS } = ctx;
  const s = ctx.settings();
  const ptt = s.mode === 'ptt';
  const expl = LANG[s.explainLang] || LANG.az;
  const KEY = `blog.${d.id}`;
  const fresh = () => ({ v: 1, order: newRound(), i: 0, ok: 0, bad: 0, tries: 0, finished: false });
  let st = store.get(KEY, null);
  if (!st || st.v !== 1 || !Array.isArray(st.order) || st.order.some((id) => !byId(id))) st = fresh();
  const save = () => store.set(KEY, st);
  let ear = !!store.get('blogEar', false);
  const cur = () => byId(st.order[st.i]);
  const sayOf = (q) => q.say || q.q;

  $app.innerHTML = `
    ${header(esc(d.title), `#/d/${d.id}`)}
    <main class="practice fb">
      <div class="fb-top"><span id="fbProg"></span>
        <button type="button" id="fbEar" class="fb-ear"></button></div>
      ${(st.i > 0 || st.ok) && !st.finished ? '<div class="resume-bar fb-rb">↩️ Qaldığın yerdən davam <button type="button" id="fbRestart">🔄 Yenidən başla</button></div>' : ''}
      <div class="fb-mid" id="fbMid">
        <details class="fb-text" id="fbText" ${st.i === 0 && !st.ok ? 'open' : ''}><summary>📖 Mətn: Guten Appetit! — Was machen Food Blogger?</summary>
          ${TEXT.map((sec) => `<div class="fb-sec"><b>${esc(sec.who)}</b>${sec.lines.map(([de, az]) => `<div class="fb-line"><button type="button" class="fb-say" data-de="${esc(de)}">🔊</button><div><span>${esc(de)}</span><small>${esc(az)}</small></div></div>`).join('')}</div>`).join('')}
        </details>
        <div class="fb-card" id="fbCard"></div>
        <div id="chat" class="chat fb-chat"><div class="sys">${s.apiKey ? 'Mətni oxu (🔊 ilə dinlə), sonra aşağıdakı düyməyə bas. Müəllim soruşacaq, sən səslə cavab ver.' : '🔑 Əvvəlcə <a href="#/settings">Ayarlar</a>-da API açarını yaz.'}</div></div>
      </div>
      <div class="controls">
        <div class="status"><span id="status">Hazır</span><span><button id="logBtn" type="button" class="mini-btn" title="Jurnal">📋</button> <span id="timer"></span></span></div>
        <div class="meter"><span id="level"></span></div>
        <div class="buttons">
          <button class="btn primary big" id="startBtn" ${s.apiKey ? '' : 'disabled'}>${st.finished ? '🔄 Yeni tur' : '▶️ Başla'}</button>
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
    const m = $('#fbMid');
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
  }

  // brauzer səsi (mətn və nümunələr üçün)
  function speak(t) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(String(t).replace(/[„"“”]/g, ''));
    u.lang = 'de-DE';
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-de]');
    if (b) speak(b.dataset.de);
  });

  // ---------- ekran ----------
  function paintTop() {
    $('#fbProg').innerHTML = st.finished ? '🏆 Tur bitdi' : `<b>Sual ${Math.min(st.i + 1, st.order.length)}/${st.order.length}</b> · ✅ ${st.ok} · ❌ ${st.bad}`;
    const eb = $('#fbEar');
    eb.textContent = ear ? '👂 Qulaqla: açıq' : '👂 Qulaqla';
    eb.classList.toggle('on', ear);
  }
  function paintCard() {
    const box = $('#fbCard');
    if (st.finished) {
      box.innerHTML = `<div class="fb-done">🏆 <b>Əla! Tur bitdi.</b><br>Düz cavablar: ${st.ok} · səhvlər: ${st.bad}</div>`;
      return;
    }
    const q = cur();
    const hidden = ear && !box.dataset.reveal;
    box.innerHTML = `<div class="fb-type">${TYPES[q.type]}</div>
      <div class="fb-q ${hidden ? 'hide' : ''}" id="fbQ">${hidden ? '👂 Dinlə və cavab ver… <small>(yazını görmək üçün toxun)</small>' : `<b>${esc(q.q)}</b><small>${esc(q.az)}</small>`}</div>
      <div class="fb-btns"><button type="button" id="fbRep">🔁 Yenə soruş</button><button type="button" id="fbHint">💡 Cavab</button></div>
      <div class="fb-ex ${st.tries ? 'show' : ''}" id="fbEx">${q.ex.map(([de, az]) => `<div><i data-de="${esc(de)}">🔊 ${esc(de)}</i><small>${esc(az)}</small></div>`).join('')}</div>`;
    $('#fbQ').addEventListener('click', () => {
      if (!hidden) return;
      box.dataset.reveal = '1';
      paintCard();
    });
    $('#fbHint').addEventListener('click', () => $('#fbEx').classList.toggle('show'));
    $('#fbRep').addEventListener('click', () => {
      if (session && session.ready) session.sendText(`[App] The learner wants to hear the question again. Say again slowly and clearly, exactly: "${sayOf(q)}" Then end your turn and wait.`);
      else speak(sayOf(q));
    });
  }
  function paintAll() {
    paintTop();
    paintCard();
  }
  function newQuestionView() {
    delete $('#fbCard').dataset.reveal;
    paintAll();
  }
  paintAll();
  $('#fbEar').addEventListener('click', () => {
    ear = !ear;
    store.set('blogEar', ear);
    newQuestionView();
  });
  const rb = $('#fbRestart');
  if (rb)
    rb.addEventListener('click', () => {
      if (!confirm('Tur əvvəldən başlasın?')) return;
      store.set(KEY, null);
      ctx.teardown();
      renderBlog(ctx);
    });

  // ---------- gediş ----------
  const askText = (q) => `ask exactly in German, slowly: "${sayOf(q)}" Then end your turn and wait for the answer.`;

  function finish() {
    st.finished = true;
    save();
    const done = store.get('done', {});
    done[d.id] = done[d.id] || Date.now();
    store.set('done', done);
    paintAll();
    fx.win();
    confetti($('#fbCard'));
  }

  function judge(heard) {
    const q = cur();
    if (st.finished || !q) return 'The lesson is finished. Say goodbye briefly in Azerbaijani.';
    const sources = [String(heard || '').trim(), userUtter.trim()].filter(Boolean);
    let res = null;
    for (const t of sources) {
      const r = q.check(t);
      if (r.ok) {
        res = r;
        break;
      }
      if (!res) res = r;
    }
    res = res || { ok: false, az: 'Cavab ver.' };
    const said = sources[0] || '—';
    // şagird inkar edibsə — düzgün inkar cümləsini göstər
    const model = q.ex.length > 1 && q.type === 'me' && /^nein\b|\bnicht\b|\bkein/.test(norm(said)) ? q.ex[1][0] : q.ex[0][0];
    if (!res.ok) {
      st.tries++;
      st.bad++;
      fx.oops();
      if ((said.match(/[a-zäöüß]{2,}/gi) || []).length >= 2) saveMistake(cat, d, { wrong: said, correct: model, explanation: res.az });
      addLine('mnote', `❌ ${res.az}`);
      save();
      paintAll();
      return (
        `WRONG. Explain in ${expl} using exactly this content (naturally, no label or prefix): ${res.az} ` +
        `Then say the correct German answer slowly: "${model}" and ask the learner in ${expl} to say it again. Then end your turn. Stay at this question.`
      );
    }
    st.ok++;
    fx.ding();
    addLine('okline', `✅ ${said}`);
    st.i++;
    st.tries = 0;
    save();
    if (st.i >= st.order.length) {
      setTimeout(() => alive() && finish(), 800);
      return `CORRECT. Then say in ${expl}: "Əla! Tur bitdi — bütün suallara cavab verdin. Afərin!" Then end your turn.`;
    }
    newQuestionView();
    const nq = cur();
    const turn = nq.type !== byId(st.order[st.i - 1]).type ? ` First say in ${expl} in one short sentence: "${nq.type === 'pro' ? 'İndi de: bu fikir müsbətdir (pro), yoxsa mənfi (kontra)?' : nq.type === 'me' ? 'İndi sənin fikrini soruşuram.' : 'Mətndən sual.'}"` : '';
    return `CORRECT.${turn} Then ${askText(nq)}`;
  }

  // ---------- səsli sessiya ----------
  let waitTimers = [];
  const stopWaiting = () => (waitTimers.forEach(clearTimeout), (waitTimers = []));
  let micOn = true;
  const idleStatus = () => (ptt ? 'Danışmaq üçün 🎙️ düyməsini basılı saxla' : micOn ? '🎧 Dinləyirəm… danış' : '🔇 Mikrofon bağlıdır');

  startBtn.addEventListener('click', async () => {
    if (st.finished) {
      store.set(KEY, null);
      ctx.teardown();
      renderBlog(ctx);
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
      systemText: blogPrompt(expl),
      log: (k, x) => dlog.add(k, x),
      tools: TOOLS,
      onTool(name, args) {
        stopWaiting();
        if (name !== 'learner_said') return 'unknown function';
        if (args.heard) addLine('heardline', `🧑‍🏫 Müəllim eşitdi: ${args.heard}`);
        return new Promise((r) => setTimeout(r, 500)).then(() => judge(args.heard));
      },
      onEvent(type, data) {
        switch (type) {
          case 'ready': {
            if (data && data.model && !data.reconnect) store.set('workingModel', data.model);
            const q = cur();
            if (data && data.reconnect) {
              setStatus(idleStatus());
              sys(data.resumed ? '✅ Bağlantı bərpa olundu.' : `✅ Yenidən qoşuldu (${data.model}).`);
              session.sendText(`[App] The connection was restarted. Same lesson. Do NOT greet or explain again. Say in ${expl}: "Davam edirik." Then ${askText(q)}`);
              break;
            }
            if (data && data.model) sys(`🤖 Model: ${data.model}`);
            const r = $('.fb-rb');
            if (r) r.remove();
            $('#fbText').open = false;
            started = Date.now();
            startBtn.hidden = true;
            micBtn.hidden = endBtn.hidden = textForm.hidden = false;
            setStatus(idleStatus());
            if (st.i > 0) session.sendText(`[App] The learner continues (progress saved). Do NOT explain again. Say in ${expl}: "Xoş gəldin! Qaldığımız yerdən davam edirik." Then ${askText(q)}`);
            else session.sendText(`[App] Start the lesson. Say in ${expl}, ONCE and briefly: "Food Blogger dərsi! Mən almanca soruşacağam, sən cavab ver. Əvvəl mətndən suallar, sonra sənin fikrin." Then ${askText(q)}`);
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
            setStatus(data ? '🗣️ Müəllim danışır…' : idleStatus());
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
            startBtn.textContent = st.finished ? '🔄 Yeni tur' : '🔄 Yenidən qoşul';
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
    session.sendText(`[App] The learner TYPED this answer: "${t}". The app already checked it: ${judge(t)}`);
    inp.value = '';
  });
}
