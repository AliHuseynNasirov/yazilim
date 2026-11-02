// Fel dərsi: "9 fel: şəxsə görə təsrif + suallar".
// Kart dərsindən AYRIDIR — onun koduna toxunmur. app.js yalnız renderDrill(ctx) çağırır.
//
// Axın (hər fel üçün 7 addım):
//   0) təsrif: "leben → du"  → şagird: "du lebst"
//   1-3) W-Frage: müəllim tətbiqin verdiyi sualı oxuyur → şagird tam cümlə ilə cavab verir
//   4-6) Satzfrage: "Ja/Nein, …"
// ✓-ə qərarı TƏTBİQ verir (drill-core.js), müəllim yalnız oxuyur, eşitdiyini bildirir və izah edir.
// 3 uğursuz cəhd → "!" və növbəti addım; bütün fellərdən sonra "!" olanlar limitsiz təkrar olunur.

import { LiveSession } from './live.js';
import { plausibleTranscript, normWord } from './checker.js';
import { assessPronunciation, azureErrors, worstPhoneme, phoneLabel } from './azure.js';
import { PERSONS, STEPS, stepKind, stepContent, checkAnswer, formOf } from './drill-core.js';
import { dlog, showLogOverlay } from './log.js';

const LANG = { az: 'Azerbaijani', tr: 'Turkish', de: 'very simple German' };

function drillPrompt(d, expl) {
  const verbs = d.drill.verbs
    .map((v, i) => `${i + 1}. ${v.inf} — person: ${PERSONS[v.person].pron} — correct form: ${PERSONS[v.person].pron} ${formOf(v, v.person)}`)
    .join('\n');
  return `You are a strict but friendly German teacher. The learner is an A1.1 beginner whose native language is Azerbaijani.
This is a VERB CONJUGATION DRILL. The APP controls the lesson: it decides the current verb, person and question, and it decides whether an answer is correct.

THE VERBS (in this order):
${verbs}

YOUR JOB — follow it strictly:
1. Say ONLY what the app tells you to say: the Azerbaijani task sentence or the German question, EXACTLY as given, once. Never invent other questions, never change the question, never skip ahead.
2. After EVERY answer of the learner, call the function submit_answer with:
   • heard: EXACTLY what the learner said, word by word, including wrong verb endings and wrong pronouns (e.g. "du lebt", "Ich kommet aus Baku"). Never correct it.
   • pronunciation: "good" or "wrong" (wrong only if a word clearly sounded like a different word).
   Then follow the instruction in the function response exactly.
3. If the response says the answer is wrong: explain the mistake in ${expl} using the content the app gives you (naturally, without any label or prefix), say the correct example slowly, and ask the learner to say it again. Do not tick anything yourself.
4. If the response says it is correct: say only a very short praise ("Super!", "Richtig!") and then exactly what the response tells you to say next.
5. Messages starting with "[App]" come from the app: follow them silently.
6. Do not answer questions that are not about this drill. If the learner asks about the grammar of the current verb, explain briefly in ${expl} and repeat the current question.
7. Speak German slowly and clearly. Keep everything short.

VERB ENDINGS (for your explanations): ich -e, du -st, er/sie/es -t, wir -en, ihr -t, sie/Sie -en. Irregular: du sprichst / er spricht, du gibst / er gibt, du hast / er hat, du heißt.
In W-question answers the verb is in position 2 ("Ich lebe in Baku."). Yes/no questions are answered with "Ja, …" or "Nein, …".`;
}

const TOOLS = [
  {
    name: 'submit_answer',
    description: "Send the learner's answer to the app. Call after EVERY answer of the learner. The app checks it and tells you what to say.",
    parameters: {
      type: 'OBJECT',
      properties: {
        heard: { type: 'STRING', description: 'Exactly what the learner said, uncorrected.' },
        pronunciation: { type: 'STRING', enum: ['good', 'wrong'] },
      },
      required: ['heard', 'pronunciation'],
    },
  },
];

// Azərbaycan hərfləri olan, almanca sözü olmayan ASR yazısı ("Yuxarıda Elena") — yoxlamaya yaramır
const DE_ANCHORS = new Set(['ich', 'du', 'er', 'sie', 'wir', 'ihr', 'ja', 'nein', 'nicht', 'kein']);
function asrUsable(t) {
  if (!t || !plausibleTranscript(t)) return false;
  if (!/[əğıİşç]/i.test(t)) return true;
  return (t.toLowerCase().match(/\p{L}+/gu) || []).filter((w) => DE_ANCHORS.has(w)).length >= 2;
}

export function renderDrill(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake, closeMessage, MODELS } = ctx;
  const s = ctx.settings();
  const ptt = s.mode === 'ptt';
  const expl = LANG[s.explainLang] || LANG.az;
  const V = d.drill.verbs;
  const azureOn = !!(ptt && s.azureKey && s.azureRegion);

  // ---------- vəziyyət ----------
  const KEY = `drillProgress.${d.id}`;
  let vIdx = 0;
  let step = 0;
  const status = V.map(() => Array(STEPS).fill(null)); // null | 'ok' | 'skip'
  const fails = V.map(() => Array(STEPS).fill(0));
  let mistakes = 0;
  let reviewMode = false;
  let reviewQ = []; // [{v, step}]
  const save = () => store.set(KEY, { vIdx, step, status, mistakes, reviewMode, reviewQ });
  const saved = store.get(KEY, null);
  if (saved && Array.isArray(saved.status) && saved.status.length === V.length) {
    vIdx = saved.vIdx || 0;
    step = saved.step || 0;
    saved.status.forEach((row, i) => row.forEach((x, k) => (status[i][k] = x)));
    mistakes = saved.mistakes || 0;
    reviewMode = !!saved.reviewMode;
    reviewQ = saved.reviewQ || [];
  }
  const hasProgress = () => status.some((r) => r.some(Boolean));
  const cur = () => (reviewMode ? reviewQ[0] : vIdx < V.length ? { v: vIdx, step } : null);
  const verbDone = (i) => status[i].every(Boolean);

  // ---------- ekran ----------
  const stepLabel = (v, k) => {
    const kind = stepKind(k);
    if (kind === 'conj') return `Təsrif: ${esc(v.inf)} → ${esc(PERSONS[v.person].az)}`;
    const c = stepContent(v, k);
    return `${kind === 'w' ? 'W-Frage' : 'Satzfrage'}: ${esc(c.question)}`;
  };
  $app.innerHTML = `
    ${header(`🔤 ${esc(d.title)}`, `#/d/${d.id}`)}
    <main class="practice cards-mode">
      <details class="rule-mini"><summary>📘 ${esc(d.rule.title)}</summary><div class="rule">${ctx.ruleHtml(d.rule)}</div></details>
      <div class="score-bar"><span id="scDone">✅ 0/${V.length}</span><span id="scErr">❌ 0</span></div>
      ${hasProgress() ? `<div class="resume-bar">↩️ Qaldığın yerdən davam <button type="button" id="restartDrill">🔄 Yenidən başla</button></div>` : ''}
      <div id="cardList" class="card-list">
        ${V.map(
          (v, i) => `<div class="lcard vcard" data-v="${i}">
            <div class="lc-top">
              <div class="vbadge">${esc(v.inf)}</div>
              <div class="lc-title">
                <span class="lc-num">Fel ${i + 1} · ${esc(v.az)}</span>
                <b>${esc(v.inf)} → ${esc(PERSONS[v.person].pron)}</b>
                <span class="lc-now">🎤 Sənin növbən!</span>
              </div>
              <span class="lc-check">✅</span>
            </div>
            <ul class="lc-fields">
              ${Array.from({ length: STEPS }, (_, k) => `<li data-s="${k}"><span class="tick"></span><span class="stxt">${stepLabel(v, k)}</span></li>`).join('')}
            </ul>
          </div>`,
        ).join('')}
      </div>
      <div id="chat" class="chat"><div class="sys">${s.apiKey ? 'Başlamaq üçün aşağıdakı düyməyə bas.' : '🔑 Əvvəlcə <a href="#/settings">Ayarlar</a>-da API açarını yaz.'}</div></div>
      <div class="controls">
        <div class="status"><span id="status">Hazır</span><span id="timer"></span></div>
        <div class="meter"><span id="level"></span></div>
        <div class="buttons">
          <button class="btn primary big" id="startBtn" ${s.apiKey ? '' : 'disabled'}>▶️ Başla</button>
          <button class="mic" id="micBtn" hidden>🎙️</button>
          <button class="btn ghost" id="endBtn" hidden>⏹ Bitir</button>
        </div>
        <form id="textForm" class="textrow" hidden>
          <input id="textIn" placeholder="Və ya yaz… (almanca)" autocomplete="off">
          <button class="btn">➤</button>
        </form>
        <div class="quick"><button id="logBtn" type="button">📋 Jurnal</button></div>
      </div>
    </main>`;

  const chat = $app.querySelector('#chat');
  const statusEl = $app.querySelector('#status');
  const timerEl = $app.querySelector('#timer');
  const levelEl = $app.querySelector('#level');
  const startBtn = $app.querySelector('#startBtn');
  const micBtn = $app.querySelector('#micBtn');
  const endBtn = $app.querySelector('#endBtn');
  const textForm = $app.querySelector('#textForm');
  const cardEls = [...$app.querySelectorAll('.vcard')];
  $app.querySelector('#logBtn').addEventListener('click', () => showLogOverlay($app));
  const setStatus = (t) => (statusEl.textContent = t);
  const scroll = () => (chat.scrollTop = chat.scrollHeight);
  let session = null;
  let last = null;

  function addLine(cls, text, html) {
    const el = document.createElement('div');
    el.className = cls;
    if (html) el.innerHTML = html;
    else el.textContent = text;
    chat.appendChild(el);
    if (last) last.open = false;
    last = null;
    scroll();
    return el;
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

  function paint() {
    const c = cur();
    cardEls.forEach((el, i) => {
      const done = verbDone(i);
      el.classList.toggle('done', done);
      el.classList.toggle('active', !!c && c.v === i);
      el.querySelectorAll('.lc-fields li').forEach((li) => {
        const k = +li.dataset.s;
        li.classList.toggle('ok', status[i][k] === 'ok');
        li.classList.toggle('skip', status[i][k] === 'skip');
        const on = !!c && c.v === i && c.step === k;
        li.classList.toggle('now', on);
        let h = li.querySelector('.hint');
        if (on && !h) {
          h = document.createElement('span');
          h.className = 'hint';
          li.appendChild(h);
        }
        if (h) {
          const P = PERSONS[V[i].person];
          h.textContent = on ? (stepKind(k) === 'conj' ? `🎤 ${P.pron} …` : stepKind(k) === 's' ? `🎤 Ja/Nein, ${P.pron} … (fel 2-ci yerdə)` : `🎤 ${P.pron} … (fel 2-ci yerdə)`) : '';
        }
      });
    });
    $app.querySelector('#scDone').textContent = `✅ ${V.filter((_, i) => verbDone(i) && !status[i].includes('skip')).length}/${V.length}`;
    $app.querySelector('#scErr').textContent = `❌ ${mistakes}`;
    if (c) {
      setTimeout(() => {
        const list = $app.querySelector('#cardList');
        const el = cardEls[c.v];
        if (list && el) list.scrollTo({ top: Math.max(0, el.offsetTop - 80), behavior: 'smooth' });
      }, 300);
    }
  }
  paint();

  const restart = $app.querySelector('#restartDrill');
  if (restart)
    restart.addEventListener('click', () => {
      if (!confirm('Fellər əvvəldən başlasın? (Səhv dəftəri silinmir)')) return;
      store.set(KEY, null);
      ctx.teardown();
      renderDrill(ctx);
    });

  // ---------- müəllimə nə deyiləcək ----------
  function sayText(c) {
    const v = V[c.v];
    const sc = stepContent(v, c.step);
    if (sc.kind === 'conj') return `say in ${expl} exactly this, ONCE: "${sc.taskAz}" Then end your turn immediately (do not produce silence or filler).`;
    return `ask exactly this German question, ONCE, slowly: "${sc.question}" Then end your turn immediately (do not produce silence or filler).`;
  }
  function stateText() {
    const c = cur();
    if (!c) return 'The drill is finished.';
    const v = V[c.v];
    const sc = stepContent(v, c.step);
    const what = sc.kind === 'conj' ? `conjugation of "${v.inf}" with "${PERSONS[v.person].pron}"` : `question "${sc.question}"`;
    return `Current: verb ${c.v + 1} (${v.inf}), person "${PERSONS[v.person].pron}", step ${c.step + 1}/7 (${what}); expected example answer: "${sc.example}".${reviewMode ? ' REVIEW PHASE (no limit of tries).' : ''}`;
  }

  function logMistake(wrong, correct, explanation) {
    mistakes++;
    const m = saveMistake(cat, d, { wrong, correct, explanation });
    const el = document.createElement('a');
    el.className = 'mnote';
    el.href = `#/mistakes/${cat.id}`;
    el.innerHTML = `📝 Səhv qeyd edildi: <s>${esc(m.wrong)}</s> → <b>${esc(m.correct)}</b>`;
    chat.appendChild(el);
    if (last) last.open = false;
    scroll();
    fx.oops();
    const ce = cardEls[cur() ? cur().v : 0];
    if (ce) {
      ce.classList.remove('shake');
      void ce.offsetWidth;
      ce.classList.add('shake');
    }
    save();
    paint();
  }

  // Növbəti addıma keç; qaytarır: müəllimə nə desin
  function advance(result) {
    const c = cur();
    status[c.v][c.step] = result;
    if (result === 'ok') fx.ding();
    if (reviewMode) {
      reviewQ.shift();
    } else {
      step++;
      if (step >= STEPS) {
        if (!status[c.v].includes('skip')) confetti(cardEls[c.v]);
        fx.win();
        step = 0;
        vIdx++;
      }
      if (vIdx >= V.length && !reviewMode) {
        reviewQ = [];
        status.forEach((row, i) => row.forEach((x, k) => x === 'skip' && reviewQ.push({ v: i, step: k })));
        if (reviewQ.length) {
          reviewMode = true;
          sys('🔁 Təkrar mərhələsi: alınmayan addımları indi düzgün deyənə qədər təkrar edirik.');
          save();
          paint();
          return `ALL VERBS ARE DONE, but some steps were not correct. REVIEW PHASE (no limit of tries). Say in ${expl} once: "Bütün fellər bitdi! İndi alınmayanları təkrar edək." Then ${sayText(reviewQ[0])}`;
        }
      }
    }
    save();
    paint();
    const n = cur();
    if (!n) {
      reviewMode = false;
      store.set(KEY, null);
      setTimeout(showTrophy, 900);
      return `THE WHOLE DRILL IS FINISHED. Say in ${expl} warmly that all 9 verbs are done and praise the learner.`;
    }
    const newVerb = !c || n.v !== c.v;
    const intro = newVerb && !reviewMode ? `Say in ${expl}: «Növbəti fel: ${V[n.v].inf}.» Then ` : 'Then ';
    return `${intro}${sayText(n)}`;
  }

  function showTrophy() {
    confetti(null, 120);
    const ov = document.createElement('div');
    ov.className = 'finish';
    ov.innerHTML = `<div class="finish-box"><div class="trophy">🏆</div><h2>Bütün fellər bitdi!</h2>
      <p>${mistakes} səhv düzəldildi</p>
      <a class="btn ghost" href="#/mistakes/${cat.id}">📒 Səhvlərimə bax</a>
      <button class="btn primary big" id="closeFinish">Davam et</button></div>`;
    $app.appendChild(ov);
    ov.querySelector('#closeFinish').addEventListener('click', () => ov.remove());
  }

  // ---------- cavabın yoxlanması ----------
  let userUtter = '';
  let pressId = 0;
  let submittedPress = -1;
  let az = null; // Azure (yalnız təsrif addımında)

  function judge(heard, pron) {
    const c = cur();
    if (!c) return 'The drill is finished.';
    const v = V[c.v];
    const sc = stepContent(v, c.step);
    const asr = userUtter.trim();
    const sources = [String(heard || '').trim(), asrUsable(asr) ? asr : ''].filter(Boolean);
    let bad = null;
    for (const t of sources) {
      const r = checkAnswer(t, v, c.step);
      if (!r.ok) {
        bad = { ...r, wrong: t };
        break;
      }
    }
    // Azure (təsrif addımı): yalnız deyilmiş sözün aşağı tələffüz balı
    if (!bad && az && az.press === pressId && az.done && az.result && az.result.ok && az.step === c.step && az.v === c.v) {
      const errs = azureErrors(az.result, s.pronLevel || 'normal').filter((e) => sources.some((t) => (t.match(/\p{L}+/gu) || []).map(normWord).includes(normWord(e.word))));
      if (errs.length) bad = { ok: false, az: errs.map((e) => e.az).join(' '), en: errs.map((e) => e.en).join('; '), wrong: sources[0] || az.result.text };
    }
    if (!bad && pron === 'wrong') bad = { ok: false, az: 'Tələffüz səhvdir.', en: 'the teacher judged the pronunciation as wrong', wrong: sources[0] || '' };

    if (!bad) {
      // yaşıl sətirdə nümunə yox, şagirdin DEDİYİ cümlə görünsün
      addLine('okline', `✅ ${sources[0] || sc.example}`);
      return `CORRECT. Say only a very short praise ("Super!"). ${advance('ok')}`;
    }
    logMistake(bad.wrong || '—', sc.example, bad.az);
    fails[c.v][c.step]++;
    if (!reviewMode && fails[c.v][c.step] >= 3) {
      sys('⚠️ Bu addım 3 dəfə alınmadı — sonda təkrar edəcəyik. Davam edirik.');
      return `WRONG for the 3rd time. Say the correct example once slowly: "${sc.example}", then say in ${expl}: "Bunu sonra təkrar edərik." ${advance('skip')}`;
    }
    return (
      `WRONG. The learner said: "${bad.wrong}". Mistake: ${bad.en}. Explain in ${expl} using exactly this content (naturally, no label or prefix): ${bad.az} ` +
      `Then say the correct example slowly: "${sc.example}" and ask the learner to say it again. Do not move on.`
    );
  }

  // ---------- səsli sessiya ----------
  let waitTimers = [];
  const stopWaiting = () => (waitTimers.forEach(clearTimeout), (waitTimers = []));
  let micOn = true;
  const idleStatus = () => (ptt ? 'Danışmaq üçün 🎙️ düyməsini basılı saxla' : micOn ? '🎧 Dinləyirəm… danış' : '🔇 Mikrofon bağlıdır');

  startBtn.addEventListener('click', async () => {
    dlog.start(`${d.title} · ${s.mode} · Azure ${azureOn ? 'açıq' : 'sönük'}`);
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
      capture: azureOn,
      systemText: drillPrompt(d, expl),
      log: (k, x) => dlog.add(k, x),
      tools: TOOLS,
      onTool(name, args) {
        stopWaiting();
        if (name !== 'submit_answer') return 'unknown function';
        if (args.heard) addLine('heardline', `🧑‍🏫 Müəllim eşitdi: ${args.heard}`);
        submittedPress = pressId;
        // ASR yazısı və Azure gec gəlir — qərardan əvvəl qısa gözlə
        const waits = [new Promise((r) => setTimeout(r, 900))];
        if (az && az.press === pressId && !az.done) waits.push(Promise.race([az.promise, new Promise((r) => setTimeout(r, 6000))]));
        return Promise.all(waits).then(() => judge(args.heard, args.pronunciation));
      },
      onEvent(type, data) {
        switch (type) {
          case 'ready':
            // yalnız İLK qoşulmanın modelini yadda saxla (dərs ortasında ehtiyat modelə keçid yadda qalmasın)
            if (data && data.model && !data.reconnect) store.set('workingModel', data.model);
            if (data && data.reconnect) {
              setStatus(idleStatus());
              sys(data.resumed ? '✅ Bağlantı bərpa olundu.' : `✅ Yenidən qoşuldu (${data.model}).`);
              session.sendText(`[App] The connection was restarted. Do NOT greet or explain again. ${stateText()} Say in ${expl}: "Davam edirik." Then ${sayText(cur())}`);
              break;
            }
            if (data && data.model) sys(`🤖 Model: ${data.model}`);
            started = Date.now();
            startBtn.hidden = true;
            micBtn.hidden = endBtn.hidden = textForm.hidden = false;
            setStatus(idleStatus());
            if (!cur()) {
              session.sendText('[App] The drill is already finished. Say in Azerbaijani that all verbs are done.');
            } else if (hasProgress()) {
              session.sendText(`[App] The learner continues a drill started earlier (progress saved). Do NOT explain the task again. ${stateText()} Say in ${expl}: "Xoş gəldin! Qaldığımız yerdən davam edirik." Then ${sayText(cur())}`);
            } else {
              session.sendText(
                `[App] Start the drill. Explain ONCE in ${expl}: "Hər feli göstərilən şəxslə de. Sonra həmin şəxslə suallara tam cümlə ilə cavab ver. Bəli/xeyr suallarına Ja və ya Nein ilə başla." Then ${sayText(cur())}`,
              );
            }
            ctx.setTimer(
              setInterval(() => {
                const sec = Math.floor((Date.now() - started) / 1000);
                timerEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
              }, 1000),
            );
            break;
          case 'utterance': {
            // Azure yalnız təsrif addımında ("du lebst" kimi dəqiq bilinən qısa cümlə)
            const c = cur();
            if (!azureOn || !c || c.step !== 0) break;
            const v = V[c.v];
            const P = PERSONS[v.person];
            const ref = `${P.pron.charAt(0).toUpperCase() + P.pron.slice(1)} ${formOf(v, v.person)}.`;
            const a = { press: pressId, v: c.v, step: 0, done: false, result: null };
            az = a;
            const line = addLine('heardline azure', `🎯 Azure yoxlayır… (${ref})`);
            a.promise = assessPronunciation(data, ref, s.azureKey, s.azureRegion).then((r) => {
              a.done = true;
              a.result = r;
              dlog.add('Azure', r && r.ok ? `${r.score}/100 · ${r.words.map((w) => `${w.word} ${w.score ?? '-'}`).join(', ')}` : `xəta: ${r ? r.error : '?'}`);
              if (!r || !r.ok) {
                line.textContent = `🎯 Azure: cavab alınmadı — ${r ? r.error : 'xəta'}`;
                line.classList.add('fail');
              } else {
                const chips = r.words
                  .filter((w) => w.error !== 'Insertion')
                  .map((w) => {
                    const cls = w.score == null ? '' : w.score >= 80 ? 'good' : w.score >= 60 ? 'mid' : 'bad';
                    const wp = worstPhoneme(w);
                    const ph = wp && wp.score < 85 ? ` <small>(${esc(phoneLabel(wp.p))} ${wp.score})</small>` : '';
                    return `<span class="wchip ${cls}">${esc(w.word)} ${w.score ?? ''}${ph}</span>`;
                  })
                  .join(' ');
                line.innerHTML = `🎯 Azure: <b>${r.score ?? '?'}/100</b><div class="wchips">${chips}</div>`;
              }
              return a;
            });
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
            // Müəllim submit_answer çağırmağı unudubsa: yazı etibarlıdırsa özümüz yoxlayaq
            if (pressId > 0 && submittedPress !== pressId && asrUsable(userUtter.trim()) && cur()) {
              submittedPress = pressId;
              session.sendText(`[App] ${judge('', 'good')}`);
            }
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
            startBtn.textContent = '🔄 Yenidən başla';
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

  // Mikrofon: "Bas və danış" və ya sərbəst
  let releaseTimer = null;
  function newPress() {
    pressId++;
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
        waitTimers.push(setTimeout(() => session && session.ready && session.sendText('[App] The learner has finished speaking. Call submit_answer with what they said now.'), 8000));
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

  // Yazılı cavab
  textForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $app.querySelector('#textIn');
    const t = inp.value.trim();
    if (!t || !session) return;
    newPress();
    userUtter = t;
    addText('user', t);
    last.open = false;
    submittedPress = pressId;
    dlog.add('yazılı cavab', t);
    session.sendText(`[App] The learner TYPED this answer: "${t}". ${judge(t, 'good')}`);
    inp.value = '';
  });
}
