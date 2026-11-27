// "Magst du …? Isst du gern …?" (4-cü bölmə, c — "Fragen und antworten Sie schnell"). app.js yalnız renderMagst(ctx) çağırır.
//
// Hər oyunda bir yemək (növbə ilə). Müəllim səslə soruşur: "Magst du (gern) Fisch?" / "Isst du (gern) Fisch?"
// Şagird bir oyunda 6 cavab formasının HAMISINI işlətməlidir (3 təsdiq, 3 inkar). Düz/səhv qərarını TƏTBİQ verir.

import { LiveSession } from './live.js';
import { plausibleTranscript } from './checker.js';
import { correctionRules } from './prompt.js';
import { FOODS, FORMS6, formByK, foodById, questions, classify } from './magst-core.js';
import { dlog, showLogOverlay } from './log.js';

const LANG = { az: 'Azerbaijani', tr: 'Turkish', de: 'very simple German' };

function magstPrompt(expl) {
  return `You are a friendly German teacher. The learner is an A1.1 beginner whose native language is Azerbaijani.
Exercise: "Magst du …? Isst du gern …? — Fragen und antworten Sie schnell." You ask short questions about ONE food; the learner answers with one of six answer patterns:
"Ja, ich finde … lecker." / "Ja, ich mag … gern." / "Ja, ich esse … gern." / "Nein, ich finde … nicht lecker." / "Nein, ich mag … nicht (gern)." / "Nein, ich esse … nicht (gern)."
In one game the learner must use ALL SIX patterns.

THE APP CONTROLS THE LESSON. It decides the question, what you say and whether the answer is correct. Messages starting with "[App]" come from the app — follow them silently and exactly.

YOUR JOB — strictly:
1. Ask ONLY the question the app gives you, in German, exactly as given, slowly and clearly. Do not add other questions.
2. After EVERY answer, call the function learner_said with heard = EXACTLY what the learner said, word by word, uncorrected (wrong forms like "ich magst" or "ich mag nicht Fisch" must stay as they were). Then follow the function response exactly.
3. If the response says WRONG: explain in ${expl} using the content the app gives you (naturally, no label or prefix), say the correct German sentence slowly, and ask the learner in ${expl} to say it again. Then end your turn and wait.
4. If the response says AGAIN: say in ${expl} what the app gives you, then ask the same question again.
5. If the response says CORRECT: say only what the response tells you.
6. Never answer questions that are not about this exercise. Keep everything short.

${correctionRules(expl)}`;
}

const TOOLS = [
  {
    name: 'learner_said',
    description: "Send the learner's answer to the app. Call after EVERY answer of the learner; the app checks it and tells you what to say.",
    parameters: { type: 'OBJECT', properties: { heard: { type: 'STRING', description: 'Exactly what the learner said, word by word, uncorrected.' } }, required: ['heard'] },
  },
];

const qAz = (q, food) => (q.startsWith('Magst') ? `${food.az} — xoşlayırsan?` : q.startsWith('Isst du gern') ? `${food.az} yeməyi xoşlayırsan?` : `${food.az} yeyirsən?`);

export function renderMagst(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake, closeMessage, MODELS } = ctx;
  const s = ctx.settings();
  const ptt = s.mode === 'ptt';
  const expl = LANG[s.explainLang] || LANG.az;
  const KEY = `magst.${d.id}`;
  // yemək növbə ilə: hər yeni oyunda növbəti yemək
  const nextFood = () => {
    const i = (store.get('magstFood', -1) + 1) % FOODS.length;
    store.set('magstFood', i);
    return FOODS[i].id;
  };
  const fresh = () => {
    const food = nextFood();
    return { v: 1, food, qs: questions(foodById(food)), qi: 0, used: [], ok: 0, bad: 0, tries: 0, finished: false };
  };
  let st = store.get(KEY, null);
  if (!st || st.v !== 1 || !Array.isArray(st.used)) st = fresh();
  const save = () => store.set(KEY, st);
  const food = foodById(st.food);
  const curQ = () => st.qs[st.qi % st.qs.length];

  $app.innerHTML = `
    ${header(esc(d.title), `#/d/${d.id}`)}
    <main class="practice mg">
      ${(st.used.length || st.bad) && !st.finished ? '<div class="resume-bar mg-rb">↩️ Qaldığın yerdən davam <button type="button" id="mgRestart">🔄 Yenidən başla</button></div>' : ''}
      <div class="mg-food"><span class="mg-emo">${food.e}</span><div><small>Bu oyunun yeməyi</small><b>${esc(food.n)}</b><small>${food.g === 'pl' ? 'cəm' : food.g} · ${esc(food.az)}</small></div><span class="mg-count" id="mgCount"></span></div>
      <div class="mg-mid" id="mgMid">
        <div class="mg-card" id="mgCard"></div>
        <div class="mg-forms" id="mgForms"></div>
        <div id="chat" class="chat mg-chat"><div class="sys">${s.apiKey ? 'Müəllim soruşacaq: "Magst du …?" / "Isst du gern …?" Hər dəfə aşağıdakı 6 formadan başqasını işlət.' : '🔑 Əvvəlcə <a href="#/settings">Ayarlar</a>-da API açarını yaz.'}</div></div>
      </div>
      <div class="controls">
        <div class="status"><span id="status">Hazır</span><span><button id="logBtn" type="button" class="mini-btn" title="Jurnal">📋</button> <span id="timer"></span></span></div>
        <div class="meter"><span id="level"></span></div>
        <div class="buttons">
          <button class="btn primary big" id="startBtn" ${s.apiKey ? '' : 'disabled'}>${st.finished ? '🔄 Yeni oyun (növbəti yemək)' : '▶️ Başla'}</button>
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
    const m = $('#mgMid');
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

  // ---------- ekran ----------
  function paint() {
    $('#mgCount').innerHTML = `<b>${st.used.length}/6</b><small>forma</small>`;
    $('#mgForms').innerHTML = `<div class="mg-fh">📋 6 cavab forması — hamısını işlət <small>(toxun — tam cümləni gör və dinlə)</small></div>
      ${FORMS6.map((f) => {
        const done = st.used.includes(f.k);
        return `<details class="mg-f ${done ? 'done' : ''} ${f.pos ? 'pos' : 'neg'}"><summary><span>${done ? '✅' : f.pos ? '➕' : '➖'}</span>${esc(f.t)}</summary>
          <div><i data-de="${esc(f.de(food.n))}">🔊 ${esc(f.de(food.n))}</i><small>${esc(f.az.replace('…', food.az))}</small></div></details>`;
      }).join('')}`;
    const box = $('#mgCard');
    if (st.finished) {
      box.innerHTML = `<div class="mg-done">🏆 <b>Əla! 6 formanın hamısını işlətdin.</b><br>Düz: ${st.ok} · səhv: ${st.bad}. Növbəti oyunda başqa yemək: <b>${esc(FOODS[(FOODS.findIndex((f) => f.id === food.id) + 1) % FOODS.length].n)}</b></div>`;
      return;
    }
    const q = curQ();
    box.innerHTML = `<div class="mg-q"><b>${esc(q)}</b><small>${esc(qAz(q, food))}</small></div>
      <button type="button" id="mgRep">🔁 Yenə soruş</button>`;
    $('#mgRep').addEventListener('click', () => {
      if (session && session.ready) session.sendText(`[App] The learner wants to hear the question again. Say again slowly and clearly, exactly: "${q}" Then end your turn and wait.`);
      else speak(q);
    });
  }
  paint();
  const rb = $('#mgRestart');
  if (rb)
    rb.addEventListener('click', () => {
      if (!confirm('Oyun əvvəldən başlasın?')) return;
      // eyni yeməklə əvvəldən (növbəti yeməyə keçmir)
      store.set(KEY, { v: 1, food: st.food, qs: questions(food), qi: 0, used: [], ok: 0, bad: 0, tries: 0, finished: false });
      ctx.teardown();
      renderMagst(ctx);
    });

  // ---------- gediş ----------
  const askText = (q) => `ask exactly in German, slowly: "${q}" Then end your turn and wait for the answer.`;
  const left = () => FORMS6.filter((f) => !st.used.includes(f.k));
  function finish() {
    st.finished = true;
    save();
    const done = store.get('done', {});
    done[d.id] = done[d.id] || Date.now();
    store.set('done', done);
    paint();
    fx.win();
    confetti($('#mgCard'));
  }
  function judge(heard) {
    if (st.finished) return 'The game is finished. Say goodbye briefly in Azerbaijani.';
    const sources = [String(heard || '').trim(), userUtter.trim()].filter(Boolean);
    let res = null;
    for (const t of sources) {
      const r = classify(t, food);
      if (r.ok) {
        res = r;
        break;
      }
      if (!res) res = r;
    }
    res = res || { ok: false, az: 'Cavab ver.' };
    const said = sources[0] || '—';
    if (!res.ok) {
      st.tries++;
      st.bad++;
      fx.oops();
      // şagirdin cəhd etdiyi fel + təsdiq/inkar → həmin formanın düzgün cümləsi
      const pol = /^nein\b|nicht/i.test(said) ? '-' : '+';
      const verb = /\bm(a|ö|o)g|\bmögen/i.test(said) ? 'm' : /\b(ess|isst|iss)/i.test(said) ? 'e' : /\bfind/i.test(said) ? 'f' : null;
      const want = verb && formByK(verb + pol);
      const model = (want && !st.used.includes(want.k) ? want : null) || left().find((f) => (pol === '-' ? !f.pos : f.pos)) || left()[0] || FORMS6[0];
      if ((said.match(/[a-zäöüß]{2,}/gi) || []).length >= 2) saveMistake(cat, d, { wrong: said, correct: model.de(food.n), explanation: res.az });
      addLine('mnote', `❌ ${res.az}`);
      save();
      paint();
      return `WRONG. Explain in ${expl} using exactly this content (naturally, no label or prefix): ${res.az} Then say a correct German answer slowly: "${model.de(food.n)}" and ask the learner in ${expl} to say it again. Then end your turn. Stay at this question.`;
    }
    const f = formByK(res.k);
    if (st.used.includes(res.k)) {
      st.tries++;
      fx.tone([440, 440], 0.08, 'sine', 0.05);
      const l = left();
      addLine('mnote', `🔁 Bu formanı artıq işlətdin: "${f.t}". İndi başqasını işlət.`);
      save();
      paint();
      return `AGAIN. The sentence is correct, but the learner already used this answer pattern. Say in ${expl}: "Düzdür, amma bu formanı artıq işlətdin. İndi başqa formada cavab ver, məsələn: ${l[0].de(food.n)}" Then ask the same question again, exactly: "${curQ()}" Then end your turn and wait.`;
    }
    st.used.push(res.k);
    st.ok++;
    st.tries = 0;
    fx.ding();
    addLine('okline', `✅ ${said}`);
    if (st.used.length >= 6) {
      save();
      setTimeout(() => alive() && finish(), 900);
      return `CORRECT. Say in German: "Super!" Then say in ${expl}: "Əla! Altı formanın hamısını işlətdin. Növbəti oyunda başqa yemək olacaq." Then end your turn.`;
    }
    st.qi++;
    save();
    paint();
    const react = f.pos ? ['Ich auch!', 'Super!', 'Lecker, ja!'][st.qi % 3] : ['Ach so.', 'Okay, verstehe.', 'Schade!'][st.qi % 3];
    return `CORRECT. Say in German: "${react}" Then ${askText(curQ())}`;
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
      renderMagst(ctx);
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
      systemText: magstPrompt(expl),
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
            const l = left().map((f) => f.t).join(' · ');
            if (data && data.reconnect) {
              setStatus(idleStatus());
              sys(data.resumed ? '✅ Bağlantı bərpa olundu.' : `✅ Yenidən qoşuldu (${data.model}).`);
              session.sendText(`[App] The connection was restarted. Same game (food: ${food.n}; patterns still to use: ${l}). Do NOT greet or explain again. Say in ${expl}: "Davam edirik." Then ${askText(curQ())}`);
              break;
            }
            if (data && data.model) sys(`🤖 Model: ${data.model}`);
            const r = $('.mg-rb');
            if (r) r.remove();
            started = Date.now();
            startBtn.hidden = true;
            micBtn.hidden = endBtn.hidden = textForm.hidden = false;
            setStatus(idleStatus());
            if (st.used.length) session.sendText(`[App] The learner continues (food: ${food.n}; patterns still to use: ${l}). Do NOT explain again. Say in ${expl}: "Xoş gəldin! Davam edirik." Then ${askText(curQ())}`);
            else session.sendText(`[App] Start the game. Say in ${expl}, ONCE and briefly: "Bu oyunun yeməyi: ${food.n}. Mən soruşacağam, sən hər dəfə başqa formada cavab ver — altı formanın hamısını işlət: üçü 'Ja', üçü 'Nein'." Then ${askText(curQ())}`);
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
            startBtn.textContent = st.finished ? '🔄 Yeni oyun (növbəti yemək)' : '🔄 Yenidən qoşul';
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
