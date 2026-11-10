// "Hast du die Nummer von …?" rol oyunu (Rolle A / Rolle B) — səsli, ayrıca fayl. app.js yalnız renderNummer(ctx) çağırır.
// Anmeldung oyunu ilə eyni məntiq:
//   • Şagird soruşur → müəllim öz siyahısından nömrəni deyir → şagird YAZIR (tətbiq yoxlayır: yaşıl/qırmızı).
//   • Müəllim soruşur → şagird öz siyahısından deyir → müəllim write_number ilə yazır, tətbiq müqayisə edir.
// Rol və kimin başlayacağı təsadüfi seçilir. Düz/səhv qərarını həmişə TƏTBİQ verir.

import { LiveSession } from './live.js';
import { plausibleTranscript, isRepeatRequest } from './checker.js';
import { correctionRules } from './prompt.js';
import { PEOPLE, OTHER, hasList, missingList, spokenNumber, checkTyped, checkHeard, newGame } from './nummer-core.js';
import { dlog, showLogOverlay } from './log.js';

const LANG = { az: 'Azerbaijani', tr: 'Turkish', de: 'very simple German' };
const askQ = (p) => `Hast du die Nummer von ${p.name}?`;

function nummerPrompt(troll, expl) {
  const mine = hasList(troll);
  const notMine = missingList(troll);
  return `You are a friendly German teacher. The learner is an A1.1 beginner whose native language is Azerbaijani.
You play an information-gap ROLE PLAY: "Hast du die Nummer von …?" (Kursbuch A1, S. 31, 3). Each player has a list of 8 names; for 4 names they have the phone number, for the other 4 the line is empty.

YOU are Rolle ${troll}. YOUR LIST — the numbers you HAVE (say them digit by digit, slowly):
${mine.map((p) => `  • ${p.name}: ${p.num} — say: "${spokenNumber(p.num)}"`).join('\n')}
You do NOT have the numbers of: ${notMine.map((p) => p.name).join(', ')}. You never know or guess them.
The learner is Rolle ${OTHER[troll]} and has the other numbers.

THE APP CONTROLS THE GAME: it decides which part is running and whether a number is right. Messages starting with "[App]" come from the app — follow them silently and exactly.

PART "THE LEARNER ASKS" — the learner asks you, e.g. "Hast du die Nummer von ${notMine.length ? mine[0].name : 'Leon Heinrich'}?", and writes the number.
- If you have the number, answer in ONE short German sentence: "Ja, die Nummer ist …" and say the number digit by digit, slowly ("null, eins, sechs, zwei …"). For "+49" say "plus vier, neun".
- If you do not have it, say: "Nein, die Nummer habe ich leider nicht."
- If the learner asks you to repeat or to speak slowly, say the number again, slower.
- In this part do NOT ask the learner questions and do NOT call write_number.
- If the learner's question has a grammar mistake, correct it first (see correction rules), then answer.

PART "YOU ASK" — the app tells you which person to ask about. Ask exactly: "Hast du die Nummer von <name>?" and end your turn.
- After the learner answers, call write_number with: person (the name), number (exactly the digits the learner said, uncorrected; if they said they do not have it, write "nein"), heard (the learner's whole sentence). Then follow the function response exactly.
- Never decide yourself whether the number is right — the app compares it with the learner's list.

Speak slowly and clearly. Keep everything short.

${correctionRules(expl)}`;
}

const TOOLS = [
  {
    name: 'write_number',
    description: "Write the phone number the learner told you. Only in the part where YOU ask. Call after EVERY answer of the learner; the app checks it and tells you what to say.",
    parameters: {
      type: 'OBJECT',
      properties: {
        person: { type: 'STRING', description: 'The name you asked about.' },
        number: { type: 'STRING', description: 'Exactly the digits the learner said (uncorrected), or "nein".' },
        heard: { type: 'STRING', description: "The learner's whole sentence, exactly as heard." },
      },
      required: ['person', 'number', 'heard'],
    },
  },
  {
    name: 'log_mistake',
    description: "Save the learner's grammar mistake to their mistake notebook. Call every time you correct a mistake.",
    parameters: {
      type: 'OBJECT',
      properties: {
        wrong: { type: 'STRING', description: 'Exactly what the learner said (with the mistake).' },
        correct: { type: 'STRING', description: 'The correct German sentence.' },
        explanation: { type: 'STRING', description: 'One short explanation of the mistake in the explanation language.' },
      },
      required: ['wrong', 'correct', 'explanation'],
    },
  },
];

export function renderNummer(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake, closeMessage, MODELS } = ctx;
  const s = ctx.settings();
  const ptt = s.mode === 'ptt';
  const expl = LANG[s.explainLang] || LANG.az;

  // ---------- vəziyyət ----------
  const KEY = `nummer.${d.id}`;
  let st = store.get(KEY, null);
  const fresh = () => ({ v: 1, ...newGame(), part: 0, typed: {}, heard: {}, tIdx: 0, mistakes: 0, finished: false });
  if (!st || st.v !== 1 || !OTHER[st.role]) st = fresh();
  const save = () => store.set(KEY, st);

  const order = () => (st.starter === 'learner' ? ['learner', 'teacher'] : ['teacher', 'learner']);
  const curPart = () => (st.finished ? null : order()[st.part]);
  const toType = () => missingList(st.role); // şagird yazacaq (müəllimdə var)
  const toAsk = () => hasList(st.role); // müəllim soruşacaq (şagirddə var)
  const isDone = (x) => x && (x.status === 'ok' || x.status === 'shown');
  const learnerPartDone = () => toType().every((p) => isDone(st.typed[p.key]));
  const teacherPartDone = () => st.tIdx >= toAsk().length;
  const hasProgress = () => Object.keys(st.typed).length || Object.keys(st.heard).length || st.part > 0;

  // ---------- ekran ----------
  $app.innerHTML = `
    ${header(`📞 ${esc(d.title)}`, `#/d/${d.id}`)}
    <main class="practice anm-mode num-mode">
      <details class="rule-mini"><summary>📘 ${esc(d.rule.title)}</summary><div class="rule">${ctx.ruleHtml(d.rule)}</div></details>
      <div class="anm-top">
        <span class="anm-role">Sən: <b>Rolle ${st.role}</b></span>
        <span id="anmScore"></span>
      </div>
      <div class="anm-part" id="anmPart"></div>
      ${hasProgress() ? `<div class="resume-bar anm">↩️ Qaldığın yerdən davam <button type="button" id="anmRestart">🔄 Yeni oyun</button></div>` : ''}
      <div class="anm-forms" id="anmForms"></div>
      <div id="chat" class="chat"><div class="sys">${s.apiKey ? 'Başlamaq üçün aşağıdakı düyməyə bas.' : '🔑 Əvvəlcə <a href="#/settings">Ayarlar</a>-da API açarını yaz.'}</div></div>
      <div class="controls">
        <div class="status"><span id="status">Hazır</span><span><button id="logBtn" type="button" class="mini-btn" title="Jurnal">📋</button> <span id="timer"></span></span></div>
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
  const formsEl = $app.querySelector('#anmForms');
  $app.querySelector('#logBtn').addEventListener('click', () => showLogOverlay($app));
  const setStatus = (t) => (statusEl.textContent = t);
  const scroll = () => (chat.scrollTop = chat.scrollHeight);
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

  // ---------- siyahı (bir kağız) ----------
  const statusIcon = (x) => (!x ? '' : x.status === 'ok' ? '✅' : x.status === 'shown' ? '❗' : x.status === 'bad' ? '❌' : '');

  function listHtml() {
    const part = curPart();
    const asking = part === 'teacher' ? toAsk()[st.tIdx] : null;
    const rows = PEOPLE.map((p) => {
      if (p.owner === st.role) {
        // məndə var → müəllim soruşacaq
        const h = st.heard[p.key];
        const now = asking && asking.key === p.key;
        const note = h && h.status
          ? `<span class="anm-note ${h.status}">${statusIcon(h)} ${esc(h.value || '')}</span>`
          : now
            ? '<span class="anm-note asking">❓ müəllim soruşur…</span>'
            : '<span class="anm-note"></span>';
        return `<div class="anm-row num-row ${now ? 'now' : ''}" data-person="${p.key}"><span class="anm-lbl">${esc(p.name)}:</span><span class="anm-val hand">${esc(p.num)}</span>${note}</div>`;
      }
      // məndə yoxdur → soruşub yazacağam
      const x = st.typed[p.key] || {};
      const done = isDone(x);
      const active = part === 'learner';
      const cls = x.status === 'ok' ? 'ok' : x.status === 'shown' ? 'shown' : x.status === 'bad' ? 'bad' : '';
      const val = x.status === 'shown' ? p.num : x.value || '';
      const hint = x.status === 'bad' ? `<small class="anm-hint">❌ Səhvdir (${x.tries}/3) — düzəlt və ya yenidən soruş</small>` : x.status === 'shown' ? '<small class="anm-hint">❗ Düzgün nömrə göstərildi</small>' : '';
      return `<div class="anm-row num-row" data-person="${p.key}"><span class="anm-lbl">${esc(p.name)}:</span><span class="anm-inwrap"><input class="anm-in ${cls}" data-key="${p.key}" value="${esc(val)}" ${done || !active ? 'disabled' : ''} inputmode="tel" autocomplete="off" enterkeyhint="done" placeholder="${active && !done ? '______' : ''}">${hint}</span></div>`;
    }).join('');
    return `
      <div class="anm-paper num-paper">
        <h3>📞 Telefonnummern <small>Rolle ${st.role}</small></h3>
        <div class="anm-cols"><span></span><span></span><span class="anm-colh">🧑‍🏫 Müəllim yazdı</span></div>
        ${rows}
      </div>
      <p class="muted small">${
        part === 'learner'
          ? '🎤 Boş xətti olan adları soruş: <i>Hast du die Nummer von …?</i> Nömrəni yaz və <b>Enter</b> bas. Başa düşməsən: <i>Kannst du das bitte wiederholen?</i> · <i>Langsam, bitte!</i>'
          : part === 'teacher'
            ? '🎤 Müəllim soruşur — siyahına bax və cavab ver: <i>Ja, die Nummer ist …</i> (rəqəm-rəqəm).'
            : 'Nömrəsi olan adları müəllim soruşacaq, boş xətti olanları isə sən soruşacaqsan.'
      }</p>`;
  }

  function paint() {
    const part = curPart();
    formsEl.innerHTML = listHtml();
    const okCount = Object.values(st.typed).filter((x) => x.status === 'ok').length + Object.values(st.heard).filter((x) => x.status === 'ok').length;
    $app.querySelector('#anmScore').textContent = `✅ ${okCount} · ❌ ${st.mistakes}`;
    const n = st.part + 1;
    $app.querySelector('#anmPart').textContent = st.finished
      ? '🏆 Oyun bitdi — bütün nömrələr yazıldı!'
      : part === 'learner'
        ? `${n}-ci hissə: SƏN soruşursan, müəllim nömrəni deyir — yaz`
        : `${n}-ci hissə: MÜƏLLİM soruşur, sən siyahından nömrəni de`;
    formsEl.querySelectorAll('.anm-in').forEach((el) => {
      el.addEventListener('change', () => onTyped(el));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onTyped(el);
        }
      });
    });
    const now = formsEl.querySelector('.anm-row.now');
    if (now && now.scrollIntoView) now.scrollIntoView({ block: 'nearest' });
  }
  paint();

  const restartBtn = $app.querySelector('#anmRestart');
  if (restartBtn)
    restartBtn.addEventListener('click', () => {
      if (!confirm('Yeni oyun başlasın? (rol yenidən təsadüfi seçiləcək; səhv dəftəri silinmir)')) return;
      store.set(KEY, null);
      ctx.teardown();
      renderNummer(ctx);
    });

  function logMistake(wrong, correct, explanation) {
    st.mistakes++;
    const m = saveMistake(cat, d, { wrong, correct, explanation });
    addLine('mnote', `📝 Səhv qeyd edildi: ${m.wrong} → ${m.correct}`);
  }

  // ---------- şagird yazır ----------
  function onTyped(el) {
    const p = PEOPLE.find((x) => x.key === el.dataset.key);
    if (!p || curPart() !== 'learner') return;
    const x = st.typed[p.key] || { tries: 0 };
    if (isDone(x)) return;
    const v = el.value.trim();
    if (!v || v === x.value) return;
    x.value = v;
    if (checkTyped(p, v)) {
      x.status = 'ok';
      fx.ding();
    } else {
      x.tries = (x.tries || 0) + 1;
      st.mistakes++;
      fx.oops();
      if (x.tries >= 3) {
        x.status = 'shown';
        const m = saveMistake(cat, d, {
          wrong: v,
          correct: `${p.name}: ${p.num}`,
          explanation: 'Nömrəni diqqətlə dinlə; lazım olsa "Kannst du das bitte wiederholen?" və ya "Langsam, bitte!" de.',
        });
        addLine('mnote', `📝 Səhv qeyd edildi: ${m.wrong} → ${m.correct}`);
      } else x.status = 'bad';
    }
    st.typed[p.key] = x;
    save();
    paint();
    const next = formsEl.querySelector('.anm-in:not([disabled])');
    if (x.status !== 'bad' && next) next.focus();
    if (learnerPartDone()) finishLearnerPart();
  }

  function finishLearnerPart() {
    if (curPart() !== 'learner') return;
    st.part++;
    if (st.part >= 2 || teacherPartDone()) {
      finishGame();
      if (session && session.ready)
        session.sendText(`[App] The learner has written all your numbers. The game is finished. Say in ${expl}: "Əla! Bütün nömrələr yazıldı, oyun bitdi!" and praise the learner briefly. Then end your turn.`);
      return;
    }
    save();
    paint();
    sys('✅ Bütün nömrələri yazdın! İndi sıra müəllimdədir.');
    if (session && session.ready)
      session.sendText(
        `[App] The learner has written all your numbers. Now the asking changes. Say in ${expl}: "Əla, bütün nömrələri yazdın! İndi sıra məndədir: mən soruşuram, sən siyahına baxıb cavab ver." Then ${nextText()}`,
      );
  }

  function finishGame() {
    st.finished = true;
    save();
    const done = store.get('done', {});
    done[d.id] = done[d.id] || Date.now();
    store.set('done', done);
    paint();
    fx.win();
    confetti(formsEl);
    sys('🏆 Oyun bitdi! "🔄 Yeni oyun" ilə rollar yenidən təsadüfi seçilir.');
    if (!$app.querySelector('#anmRestart')) {
      const bar = document.createElement('div');
      bar.className = 'resume-bar anm';
      bar.innerHTML = '🏆 Bitdi <button type="button" id="anmRestart">🔄 Yeni oyun</button>';
      formsEl.before(bar);
      bar.querySelector('#anmRestart').addEventListener('click', () => {
        store.set(KEY, null);
        ctx.teardown();
        renderNummer(ctx);
      });
    }
  }

  // ---------- müəllim soruşur ----------
  function nextText() {
    if (curPart() === 'teacher') {
      return `ask exactly: "${askQ(toAsk()[st.tIdx])}" Then end your turn immediately and wait (no filler, no silence).`;
    }
    return 'end your turn and wait: now the learner asks you for numbers.';
  }
  function stateText() {
    const part = curPart();
    if (!part) return 'The game is finished.';
    if (part === 'learner') {
      const doneP = toType().filter((p) => isDone(st.typed[p.key])).map((p) => p.name);
      return `Current part: THE LEARNER ASKS. Numbers the learner has already written: ${doneP.length ? doneP.join(', ') : 'none'}.`;
    }
    const doneP = toAsk().slice(0, st.tIdx).map((p) => p.name);
    return `Current part: YOU ASK. Numbers you have already written: ${doneP.length ? doneP.join(', ') : 'none'}. Next: ${toAsk()[st.tIdx].name}.`;
  }

  function judgeHeard(args) {
    if (curPart() !== 'teacher') return "Not now: in this part the LEARNER asks you. Do not call write_number; just answer the learner's questions from your own list.";
    const p = toAsk()[st.tIdx];
    const sources = [args.number, args.heard, userUtter].map((x) => String(x || '').trim()).filter(Boolean);
    if (sources.length && sources.every((x) => isRepeatRequest(x))) {
      return `Not an answer: the learner asked you to repeat. Ask again slowly: "${askQ(p)}" Then end your turn.`;
    }
    let res = { ok: false, said: 'none' };
    for (const src of sources) {
      const r = checkHeard(p, src);
      if (r.ok) {
        res = r;
        break;
      }
      if (res.said === 'none') res = r;
    }
    const h = st.heard[p.key] || { tries: 0 };
    if (res.ok) {
      h.status = 'ok';
      h.value = String(args.number || p.num);
      st.heard[p.key] = h;
      st.tIdx++;
      fx.ding();
      return afterHeard(`CORRECT — you wrote "${h.value}". Repeat the number once to confirm ("Danke! ${p.name}: …"), very short.`);
    }
    h.tries = (h.tries || 0) + 1;
    h.value = String(args.number || '');
    st.mistakes++;
    fx.oops();
    if (h.tries >= 3) {
      h.status = 'shown';
      h.value = p.num;
      st.heard[p.key] = h;
      st.tIdx++;
      const m = saveMistake(cat, d, {
        wrong: String(args.heard || args.number || '—'),
        correct: `${p.name}: ${p.num}`,
        explanation: 'Siyahına diqqətlə bax və nömrəni rəqəm-rəqəm de: null, eins, sechs, zwei …',
      });
      addLine('mnote', `📝 Səhv qeyd edildi: ${m.wrong} → ${m.correct}`);
      return afterHeard(
        `WRONG for the 3rd time. The learner's list says: ${p.name}: "${p.num}" (say: "${spokenNumber(p.num)}"). Read it out once slowly, then say in ${expl}: "Siyahına diqqətlə bax, sonra yenə məşq edərik."`,
      );
    }
    h.status = 'bad';
    st.heard[p.key] = h;
    save();
    paint();
    if (res.said === 'no') {
      return `WRONG: the learner said they do not have this number, but it IS on their list (attempt ${h.tries}/3). Say in ${expl}: "Bu nömrə sənin siyahında var, yaxşı bax." Then ask again: "${askQ(p)}" and end your turn.`;
    }
    return (
      `WRONG: what you wrote ("${args.number}") does not match the learner's list (attempt ${h.tries}/3). Read back what you wrote digit by digit, ` +
      `then say in ${expl} that it does not match, that they should look at their list and say the number digit by digit, slowly, and ask again: "${askQ(p)}". ` +
      'Do NOT tell them the right number. Then end your turn.'
    );
  }
  function afterHeard(prefix) {
    save();
    paint();
    if (!teacherPartDone()) return `${prefix} Then ${nextText()}`;
    st.part++;
    if (st.part >= 2 || learnerPartDone()) {
      finishGame();
      return `${prefix} Then say in ${expl}: "Əla! Bütün nömrələr yazıldı, oyun bitdi!" and praise the learner briefly. Then end your turn.`;
    }
    save();
    paint();
    sys('✅ Müəllim bütün nömrələrini yazdı! İndi sıra səndədir — boş xətləri soruş və yaz.');
    return `${prefix} Then say in ${expl}: "Bütün nömrələrini yazdım! İndi sıra səndədir: məndən soruş və nömrələri yaz." Then end your turn and wait for the learner's questions.`;
  }

  function introText() {
    const first =
      st.starter === 'learner'
        ? 'Sən başlayırsan: siyahında boş xətti olan adların nömrəsini məndən soruş və yaz. Məsələn: Hast du die Nummer von …?'
        : 'Mən başlayıram: səndən nömrə soruşacağam, sən siyahına baxıb cavab ver.';
    return `[App] Start the game. Say in ${expl}, ONCE: "Rol oyunu: telefon nömrələri. Sən Rolle ${st.role}-sən, mən Rolle ${OTHER[st.role]}-yəm. ${first}" Then ${nextText()}`;
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
      renderNummer(ctx);
      return;
    }
    dlog.start(`${d.title} · Rolle ${st.role} · ${st.starter} · ${s.mode}`);
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
      systemText: nummerPrompt(OTHER[st.role], expl),
      log: (k, x) => dlog.add(k, x),
      tools: TOOLS,
      onTool(name, args) {
        stopWaiting();
        if (name === 'log_mistake') {
          logMistake(args.wrong, args.correct, args.explanation);
          save();
          paint();
          return 'saved';
        }
        if (name !== 'write_number') return 'unknown function';
        if (args.number && !isRepeatRequest(args.number)) addLine('heardline', `🧑‍🏫 Müəllim yazdı: ${args.number}`);
        return new Promise((r) => setTimeout(r, 600)).then(() => judgeHeard(args));
      },
      onEvent(type, data) {
        switch (type) {
          case 'ready':
            if (data && data.model && !data.reconnect) store.set('workingModel', data.model);
            if (data && data.reconnect) {
              setStatus(idleStatus());
              sys(data.resumed ? '✅ Bağlantı bərpa olundu.' : `✅ Yenidən qoşuldu (${data.model}).`);
              session.sendText(`[App] The connection was restarted. Same game, same roles, same lists. Do NOT greet or explain the game again. ${stateText()} Say in ${expl}: "Davam edirik." Then ${nextText()}`);
              break;
            }
            if (data && data.model) sys(`🤖 Model: ${data.model}`);
            { const rb = $app.querySelector('.resume-bar.anm'); if (rb) rb.remove(); }
            started = Date.now();
            startBtn.hidden = true;
            micBtn.hidden = endBtn.hidden = textForm.hidden = false;
            setStatus(idleStatus());
            if (hasProgress()) {
              session.sendText(`[App] The learner continues this game (progress saved). Do NOT explain the game again. ${stateText()} Say in ${expl}: "Xoş gəldin! Qaldığımız yerdən davam edirik." Then ${nextText()}`);
            } else {
              session.sendText(introText());
            }
            ctx.setTimer(
              setInterval(() => {
                const sec = Math.floor((Date.now() - started) / 1000);
                timerEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
              }, 1000),
            );
            break;
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

  // Mikrofon: "Bas və danış" və ya sərbəst
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
        waitTimers.push(
          setTimeout(
            () =>
              session &&
              session.ready &&
              session.sendText(
                curPart() === 'teacher'
                  ? '[App] The learner has finished speaking. If they answered your question, call write_number now; otherwise respond to what they said.'
                  : '[App] The learner has finished speaking. Respond now to what they said.',
              ),
            8000,
          ),
        );
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

  // Yazılı mesaj (sual və ya cavab)
  textForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $app.querySelector('#textIn');
    const t = inp.value.trim();
    if (!t || !session) return;
    newPress();
    userUtter = t;
    addText('user', t);
    last.open = false;
    dlog.add('yazılı', t);
    if (curPart() === 'teacher') {
      const p = toAsk()[st.tIdx];
      session.sendText(`[App] The learner TYPED this answer: "${t}". The app already checked it: ${judgeHeard({ person: p.name, number: t, heard: t })}`);
    } else {
      session.sendText(`[App] The learner TYPED this: "${t}". Respond to it as if they had said it.`);
    }
    inp.value = '';
  });
}
