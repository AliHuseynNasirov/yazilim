// "Anmeldung" rol oyunu (Rolle A / Rolle B) — səsli, ayrıca fayl. app.js yalnız renderAnmeldung(ctx) çağırır.
//
// Oyun başlayanda təsadüfi seçilir: şagird Rolle A və ya B olur (müəllim — o biri rol), həm də kimin başlayacağı.
// İki hissə:
//   • Şagird soruşur → müəllim öz formasından cavab verir → şagird boş formanı YAZARAQ doldurur (tətbiq yoxlayır: yaşıl/qırmızı).
//   • Müəllim soruşur → şagird öz formasına baxıb cavab verir → müəllim fill_form ilə yazır, tətbiq şagirdin forması ilə müqayisə edir.
// Düz/səhv qərarını həmişə TƏTBİQ verir.

import { LiveSession } from './live.js';
import { plausibleTranscript, isRepeatRequest } from './checker.js';
import { correctionRules } from './prompt.js';
import { germanNumber } from './numbers-core.js';
import { PEOPLE, ROLES, SLOTS, fillInputs, checkTyped, checkHeard, slotValue, newGame, digitsOf } from './anmeldung-core.js';
import { dlog, showLogOverlay } from './log.js';

const LANG = { az: 'Azerbaijani', tr: 'Turkish', de: 'very simple German' };
const OTHER = { A: 'B', B: 'A' };

// Müəllimə: rəqəmləri necə desin
const digitWords = (s) => digitsOf(s).split('').map((x) => germanNumber(+x)).join(', ');
function spokenAddress(p) {
  const [, streetName, num] = p.street.match(/^(.*?)str\.\s*(\d+)/i) || [];
  const street = streetName ? `${streetName}straße ${num} (say "${streetName}straße ${germanNumber(+num)}")` : p.street;
  const plz = digitsOf(p.city);
  const city = plz ? `${p.city} (say the postal code digit by digit: "${digitWords(plz)} ${p.city.replace(/\d+\s*/, '')}")` : p.city;
  return `${street}, ${city}`;
}

function anmPrompt(T, L, troll, lroll, expl) {
  return `You are a friendly German teacher. The learner is an A1.1 beginner whose native language is Azerbaijani.
You play an information-gap ROLE PLAY called "Anmeldung" (registration form for a German course).

ROLES:
- YOU are Rolle ${troll}: ${T.vorname} ${T.name}. YOUR OWN FORM (only you know it):
  • Name (Nachname): ${T.name}
  • Vorname: ${T.vorname}
  • Adresse: ${spokenAddress(T)}
  • Handynummer: ${T.handy} — say it digit by digit: "${digitWords(T.handy)}"
  • Herkunft: ${T.herkunft}
  • Sprachen: ${T.sprachen.join(' und ')}
- The LEARNER is Rolle ${lroll}: first name ${L.vorname}. The learner has their own form. You do NOT know any other data of the learner — never guess it.
Each of you also has an EMPTY form about the other person.

THE APP CONTROLS THE GAME: it decides which part is running and whether information is right. Messages starting with "[App]" come from the app — follow them silently and exactly.

PART "THE LEARNER ASKS" — the learner asks you questions (e.g. "Wie ist dein Name?", "Wie ist deine Adresse?", "Wie ist deine Handynummer?", "Woher kommst du?", "Welche Sprachen sprichst du?") and writes your answers into their empty form.
- Answer each question with ONE short German sentence using ONLY the information from YOUR OWN FORM (e.g. "Mein Name ist ${T.name}."). Say only what was asked.
- Say numbers slowly and clearly: phone numbers and postal codes digit by digit, house numbers as one number. Say "Straße" for "Str.".
- If the learner asks "Wie schreibt man das?" or "Kannst du das buchstabieren?", spell the word letter by letter with German letter names (for example H – A – Y – A – T – O – U).
- In this part do NOT ask the learner questions and do NOT call fill_form.
- If the learner's question has a grammar mistake, correct it first (see correction rules), then answer it.

PART "YOU ASK" — the app tells you which field to ask about. Ask ONE short question in German with "du" (e.g. "Wie ist deine Handynummer?"), then end your turn and wait.
- After the learner answers, call fill_form with: field, value (exactly the information the learner said for this field, uncorrected, numbers written as digits), heard (the learner's whole sentence). Then follow the function response exactly.
- Never write a field without calling fill_form and never decide yourself whether the information is right — the app compares it with the learner's form.
- If the answer sentence also has a grammar mistake, call fill_form first, then briefly correct the sentence.

Speak slowly and clearly. Keep everything short.

${correctionRules(expl)}`;
}

const TOOLS = [
  {
    name: 'fill_form',
    description: "Write the learner's answer into your empty form. Only in the part where YOU ask. Call after EVERY answer of the learner to your question; the app checks it and tells you what to say.",
    parameters: {
      type: 'OBJECT',
      properties: {
        field: { type: 'STRING', enum: SLOTS.map((x) => x.key), description: 'Which field you asked about.' },
        value: { type: 'STRING', description: 'Exactly the information the learner said for this field, uncorrected. Numbers as digits.' },
        heard: { type: 'STRING', description: "The learner's whole sentence, exactly as heard." },
      },
      required: ['field', 'value', 'heard'],
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

export function renderAnmeldung(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake, closeMessage, MODELS } = ctx;
  const s = ctx.settings();
  const ptt = s.mode === 'ptt';
  const expl = LANG[s.explainLang] || LANG.az;

  // ---------- vəziyyət ----------
  const KEY = `anmeldung.${d.id}`;
  let st = store.get(KEY, null);
  const fresh = () => {
    const g = newGame();
    return { v: 1, ...g, part: 0, typed: {}, heard: {}, tIdx: 0, mistakes: 0, finished: false };
  };
  if (!st || st.v !== 1 || !ROLES[st.role]) st = fresh();
  const save = () => store.set(KEY, st);

  const learnerPk = () => ROLES[st.role].own;
  const teacherPk = () => ROLES[st.role].other;
  const order = () => (st.starter === 'learner' ? ['learner', 'teacher'] : ['teacher', 'learner']);
  const curPart = () => (st.finished ? null : order()[st.part]);
  const inputs = () => fillInputs(teacherPk());
  const tDone = (x) => x && (x.status === 'ok' || x.status === 'shown');
  const learnerPartDone = () => inputs().every((i) => tDone(st.typed[i.key]));
  const teacherPartDone = () => st.tIdx >= SLOTS.length;
  const hasProgress = () => Object.keys(st.typed).length || Object.keys(st.heard).length || st.part > 0;

  // ---------- ekran ----------
  let view = curPart() === 'learner' ? 'fill' : 'own';

  function render() {
    const L = PEOPLE[learnerPk()];
    const T = PEOPLE[teacherPk()];
    $app.innerHTML = `
      ${header(`📝 ${esc(d.title)}`, `#/d/${d.id}`)}
      <main class="practice anm-mode">
        <details class="rule-mini"><summary>📘 ${esc(d.rule.title)}</summary><div class="rule">${ctx.ruleHtml(d.rule)}</div></details>
        <div class="anm-top">
          <span class="anm-role">Sən: <b>Rolle ${st.role}</b> · ${esc(L.vorname)} ${esc(L.name)}</span>
          <span id="anmScore"></span>
        </div>
        <div class="anm-part" id="anmPart"></div>
        ${hasProgress() ? `<div class="resume-bar anm">↩️ Qaldığın yerdən davam <button type="button" id="anmRestart">🔄 Yeni oyun</button></div>` : ''}
        <nav class="tabs anm-tabs">
          <button data-view="own">📄 Mənim formam</button>
          <button data-view="fill">✍️ Doldur: ${esc(T.vorname)}</button>
        </nav>
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
  }
  render();

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

  // ---------- formalar ----------
  const statusIcon = (x) => (!x ? '' : x.status === 'ok' ? '✅' : x.status === 'shown' ? '❗' : x.status === 'bad' ? '❌' : '');

  function ownFormHtml() {
    const L = PEOPLE[learnerPk()];
    const part = curPart();
    const row = (label, val, slotKey, extra = '') => {
      const h = slotKey ? st.heard[slotKey] : null;
      const asking = part === 'teacher' && SLOTS[st.tIdx] && SLOTS[st.tIdx].key === slotKey;
      const note = !slotKey
        ? ''
        : h && h.status
          ? `<span class="anm-note ${h.status}">${statusIcon(h)} ${esc(h.value || '')}</span>`
          : asking
            ? '<span class="anm-note asking">❓ müəllim soruşur…</span>'
            : '<span class="anm-note"></span>';
      return `<div class="anm-row ${asking ? 'now' : ''}" ${slotKey ? `data-slot="${slotKey}"` : ''}><span class="anm-lbl">${label}</span><span class="anm-val hand">${esc(val)}${extra}</span>${note}</div>`;
    };
    return `
      <div class="anm-paper">
        <h3>Anmeldung <small>Rolle ${st.role}</small></h3>
        <div class="anm-cols"><span></span><span></span><span class="anm-colh">🧑‍🏫 Müəllim yazdı</span></div>
        ${row('Name:', L.name, 'name')}
        ${row('Vorname:', L.vorname, null)}
        ${row('Adresse:', `${L.street}, ${L.city}`, 'adresse')}
        ${row('Handynummer:', L.handy, 'handy')}
        ${row('Herkunft:', L.herkunft, 'herkunft')}
        ${row('Sprachen:', L.sprachen.join(', '), 'sprachen')}
      </div>
      <p class="muted small">${part === 'teacher' ? '🎤 Müəllim soruşur — öz formana bax və tam cümlə ilə cavab ver (məs. <i>Meine Handynummer ist …</i>).' : 'Bu, sənin formandır. Müəllim soruşanda buradan cavab verəcəksən.'}</p>`;
  }

  function fillFormHtml() {
    const T = PEOPLE[teacherPk()];
    const part = curPart();
    const active = part === 'learner';
    const inp = (i) => {
      const x = st.typed[i.key] || {};
      const done = tDone(x);
      const cls = x.status === 'ok' ? 'ok' : x.status === 'shown' ? 'shown' : x.status === 'bad' ? 'bad' : '';
      const val = x.status === 'shown' ? i.expected : x.value || '';
      const hint = x.status === 'bad' ? `<small class="anm-hint">❌ Səhvdir (${x.tries}/3) — düzəlt və ya yenidən soruş</small>` : x.status === 'shown' ? '<small class="anm-hint">❗ Düzgün cavab göstərildi</small>' : '';
      return `<span class="anm-inwrap"><input class="anm-in ${cls}" data-key="${i.key}" value="${esc(val)}" ${done || !active ? 'disabled' : ''} ${i.key === 'handy' ? 'inputmode="tel"' : ''} autocomplete="off" autocapitalize="words" enterkeyhint="done" placeholder="${active && !done ? '…' : ''}">${i.suffix ? `<span class="hand">${esc(i.suffix)}</span>` : ''}${hint}</span>`;
    };
    const byKey = Object.fromEntries(inputs().map((i) => [i.key, i]));
    const row = (label, content) => `<div class="anm-row"><span class="anm-lbl">${label}</span><span class="anm-val">${content}</span></div>`;
    return `
      <div class="anm-paper ${active ? '' : 'idle'}">
        <h3>Anmeldung <small>${esc(T.vorname)}</small></h3>
        ${row('Name:', inp(byKey.name))}
        ${row('Vorname:', `<span class="hand">${esc(T.vorname)}</span>`)}
        ${row('Adresse:', inp(byKey.street))}
        ${row('', byKey.city ? inp(byKey.city) : `<span class="hand">${esc(T.city)}</span>`)}
        ${row('Handynummer:', inp(byKey.handy))}
        ${row('Herkunft:', inp(byKey.herkunft))}
        ${row('Sprachen:', inp(byKey.sprachen))}
      </div>
      <p class="muted small">${active ? `🎤 Müəllimdən soruş (məs. <i>Wie ist dein Name?</i>), cavabı bura yaz və ✓ üçün <b>Enter</b> bas. Başa düşməsən: <i>Kannst du das bitte wiederholen?</i> · <i>Wie schreibt man das?</i>` : 'Sıra sənə gələndə bu formanı dolduracaqsan.'}</p>`;
  }

  function paint() {
    const part = curPart();
    $app.querySelectorAll('.anm-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    formsEl.innerHTML = view === 'own' ? ownFormHtml() : fillFormHtml();
    const okCount = Object.values(st.typed).filter((x) => x.status === 'ok').length + Object.values(st.heard).filter((x) => x.status === 'ok').length;
    $app.querySelector('#anmScore').textContent = `✅ ${okCount} · ❌ ${st.mistakes}`;
    const partEl = $app.querySelector('#anmPart');
    const n = st.part + 1;
    partEl.textContent = st.finished
      ? '🏆 Oyun bitdi — hər iki forma dolduruldu!'
      : part === 'learner'
        ? `${n}-ci hissə: SƏN soruşursan, müəllim cavab verir — boş formanı doldur`
        : `${n}-ci hissə: MÜƏLLİM soruşur, sən öz formana baxıb cavab ver`;
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
  $app.querySelectorAll('.anm-tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      view = b.dataset.view;
      paint();
    }),
  );
  paint();

  const restartBtn = $app.querySelector('#anmRestart');
  if (restartBtn)
    restartBtn.addEventListener('click', () => {
      if (!confirm('Yeni oyun başlasın? (rol yenidən təsadüfi seçiləcək; səhv dəftəri silinmir)')) return;
      store.set(KEY, null);
      ctx.teardown();
      renderAnmeldung(ctx);
    });

  function logMistake(wrong, correct, explanation) {
    st.mistakes++;
    const m = saveMistake(cat, d, { wrong, correct, explanation });
    addLine('mnote', `📝 Səhv qeyd edildi: ${m.wrong} → ${m.correct}`);
  }

  // ---------- şagird yazır ----------
  function onTyped(el) {
    const key = el.dataset.key;
    const i = inputs().find((x) => x.key === key);
    if (!i || curPart() !== 'learner') return;
    const x = st.typed[key] || { tries: 0 };
    if (tDone(x)) return;
    const v = el.value.trim();
    if (!v || v === x.value) return;
    x.value = v;
    if (checkTyped(teacherPk(), key, v)) {
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
          correct: `${i.label || 'Adresse'}: ${i.expected}${i.suffix || ''}`,
          explanation: 'Anmeldung: diqqətlə dinlə; lazım olsa "Kannst du das bitte wiederholen?" və ya "Wie schreibt man das?" soruş.',
        });
        addLine('mnote', `📝 Səhv qeyd edildi: ${m.wrong} → ${m.correct}`);
      } else x.status = 'bad';
    }
    st.typed[key] = x;
    save();
    paint();
    const next = formsEl.querySelector('.anm-in:not([disabled]):not(.ok)');
    if (x.status !== 'bad' && next) next.focus();
    if (learnerPartDone()) finishLearnerPart();
  }

  function finishLearnerPart() {
    if (curPart() !== 'learner') return;
    st.part++;
    if (st.part >= 2 || teacherPartDone()) {
      finishGame();
      if (session && session.ready)
        session.sendText(`[App] The learner has filled in your whole form. The game is finished. Say in ${expl}: "Əla! Hər iki forma dolduruldu, oyun bitdi!" and praise the learner briefly. Then end your turn.`);
      return;
    }
    save();
    view = 'own';
    paint();
    sys('✅ Formanı doldurdun! İndi sıra müəllimdədir.');
    if (session && session.ready)
      session.sendText(
        `[App] The learner has filled in your whole form. Now the asking changes. Say in ${expl}: "Əla, mənim formamı doldurdun! İndi sıra məndədir: mən soruşuram, sən öz Anmeldung-una baxıb cavab ver." Then ${nextText()}`,
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
      $app.querySelector('.anm-tabs').before(bar);
      bar.querySelector('#anmRestart').addEventListener('click', () => {
        store.set(KEY, null);
        ctx.teardown();
        renderAnmeldung(ctx);
      });
    }
    return 'The game is finished.';
  }

  // ---------- müəllim soruşur ----------
  function nextText() {
    if (curPart() === 'teacher') {
      const sl = SLOTS[st.tIdx];
      return `ask the learner ONE short German question about their ${sl.label} (for example "${sl.q}"). Then end your turn immediately and wait (no filler, no silence).`;
    }
    return 'end your turn and wait: now the learner asks you questions.';
  }
  function stateText() {
    const part = curPart();
    if (!part) return 'The game is finished.';
    if (part === 'learner') {
      const doneF = inputs().filter((i) => tDone(st.typed[i.key])).map((i) => i.key);
      return `Current part: THE LEARNER ASKS. Fields the learner has already filled in correctly: ${doneF.length ? doneF.join(', ') : 'none'}.`;
    }
    const doneS = SLOTS.slice(0, st.tIdx).map((x) => x.key);
    return `Current part: YOU ASK. Fields you have already filled: ${doneS.length ? doneS.join(', ') : 'none'}. Next field: ${SLOTS[st.tIdx].label}.`;
  }

  function judgeHeard(args) {
    if (curPart() !== 'teacher') return 'Not now: in this part the LEARNER asks you. Do not call fill_form; just answer the learner\'s questions from your own form.';
    const sl = SLOTS[st.tIdx];
    const sources = [args.value, args.heard, userUtter].map((x) => String(x || '').trim()).filter(Boolean);
    if (sources.length && sources.every((x) => isRepeatRequest(x))) {
      return `Not an answer: the learner asked you to repeat. Ask the same question again slowly: "${sl.q}" Then end your turn.`;
    }
    const pk = learnerPk();
    let res = { ok: false };
    for (const src of sources) {
      const r = checkHeard(pk, sl.key, src);
      if (r.ok) {
        res = r;
        break;
      }
      if (r.missing) res = r;
    }
    const h = st.heard[sl.key] || { tries: 0 };
    if (res.ok) {
      h.status = 'ok';
      h.value = String(args.value || slotValue(pk, sl.key));
      st.heard[sl.key] = h;
      st.tIdx++;
      fx.ding();
      return afterHeard(`CORRECT — you wrote "${h.value}" into your form. Say only a very short praise ("Super!", "Richtig!").`);
    }
    if (res.missing === 'plz') {
      h.value = String(args.value || '');
      st.heard[sl.key] = h;
      save();
      paint();
      return 'PARTLY RIGHT: the street is right, but the postal code and the city are missing. Ask: "Und die Postleitzahl?" Then end your turn and wait.';
    }
    h.tries = (h.tries || 0) + 1;
    h.value = String(args.value || '');
    st.mistakes++;
    fx.oops();
    if (h.tries >= 3) {
      h.status = 'shown';
      h.value = slotValue(pk, sl.key);
      st.heard[sl.key] = h;
      st.tIdx++;
      const m = saveMistake(cat, d, {
        wrong: String(args.heard || args.value || '—'),
        correct: `${sl.label}: ${slotValue(pk, sl.key)}`,
        explanation: 'Anmeldung: öz formana diqqətlə bax və məlumatı düz de (rəqəmləri bir-bir).',
      });
      addLine('mnote', `📝 Səhv qeyd edildi: ${m.wrong} → ${m.correct}`);
      return afterHeard(
        `WRONG for the 3rd time. The learner's form says: "${slotValue(pk, sl.key)}". Read it out once slowly, then say in ${expl}: "Öz formana diqqətlə bax, sonra yenə məşq edərik."`,
      );
    }
    h.status = 'bad';
    st.heard[sl.key] = h;
    save();
    paint();
    return (
      `WRONG: what you heard ("${args.value}") does not match the learner's form (attempt ${h.tries}/3). Read back what you wrote, ` +
      `then say in ${expl} that it does not match their form, that they should look at their form again (numbers digit by digit), and ask again slowly: "${sl.q}". ` +
      'Do NOT tell them the right information. Then end your turn.'
    );
  }
  function afterHeard(prefix) {
    save();
    paint();
    if (!teacherPartDone()) return `${prefix} Then ${nextText()}`;
    // müəllimin hissəsi bitdi
    st.part++;
    if (st.part >= 2 || learnerPartDone()) {
      finishGame();
      return `${prefix} Then say in ${expl}: "Əla! Hər iki forma dolduruldu, oyun bitdi!" and praise the learner briefly. Then end your turn.`;
    }
    save();
    view = 'fill';
    paint();
    sys('✅ Müəllim sənin formanı doldurdu! İndi sıra səndədir — soruş və boş formanı doldur.');
    return `${prefix} Then say in ${expl}: "Sənin formanı doldurdum! İndi sıra səndədir: məndən soruş və boş Anmeldung-u doldur." Then end your turn and wait for the learner's questions.`;
  }

  function introText() {
    const L = PEOPLE[learnerPk()];
    const T = PEOPLE[teacherPk()];
    const first =
      st.starter === 'learner'
        ? 'Sən başlayırsan: məndən sual ver və boş Anmeldung-u doldur. Məsələn: Wie ist dein Name?'
        : 'Mən başlayıram: sənə sual verəcəyəm, sən öz Anmeldung-una baxıb cavab ver.';
    return (
      `[App] Start the game. Say in ${expl}, ONCE: "Rol oyunu: Anmeldung. Sən Rolle ${st.role}-sən: ${L.vorname} ${L.name}. Mən Rolle ${OTHER[st.role]}-yəm: ${T.vorname} ${T.name}. ${first}" ` +
      `Then ${nextText()}`
    );
  }

  // ---------- səsli sessiya ----------
  let waitTimers = [];
  const stopWaiting = () => (waitTimers.forEach(clearTimeout), (waitTimers = []));
  let micOn = true;
  let pressId = 0;
  const idleStatus = () => (ptt ? 'Danışmaq üçün 🎙️ düyməsini basılı saxla' : micOn ? '🎧 Dinləyirəm… danış' : '🔇 Mikrofon bağlıdır');

  startBtn.addEventListener('click', async () => {
    if (st.finished) {
      store.set(KEY, null);
      ctx.teardown();
      renderAnmeldung(ctx);
      return;
    }
    dlog.start(`${d.title} · Rolle ${st.role} · ${st.starter} · ${s.mode}`);
    fx.init();
    startBtn.disabled = true;
    setStatus('Qoşulur…');
    chat.innerHTML = '';
    let started = Date.now();
    const L = PEOPLE[learnerPk()];
    const T = PEOPLE[teacherPk()];
    session = new LiveSession({
      apiKey: s.apiKey,
      model: (!s.modelPicked && store.get('workingModel')) || s.model,
      fallbackModels: MODELS,
      transcriptionLanguages: ['de-DE', 'az-AZ'],
      voice: s.voice,
      pushToTalk: ptt,
      systemText: anmPrompt(T, L, OTHER[st.role], st.role, expl),
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
        if (name !== 'fill_form') return 'unknown function';
        if (args.value) addLine('heardline', `🧑‍🏫 Müəllim yazdı: ${args.value}`);
        // ASR yazısı bir az gec gələ bilər
        return new Promise((r) => setTimeout(r, 600)).then(() => judgeHeard(args));
      },
      onEvent(type, data) {
        switch (type) {
          case 'ready':
            if (data && data.model && !data.reconnect) store.set('workingModel', data.model);
            if (data && data.reconnect) {
              setStatus(idleStatus());
              sys(data.resumed ? '✅ Bağlantı bərpa olundu.' : `✅ Yenidən qoşuldu (${data.model}).`);
              session.sendText(`[App] The connection was restarted. Same game, same roles, same forms. Do NOT greet or explain the game again. ${stateText()} Say in ${expl}: "Davam edirik." Then ${nextText()}`);
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
        waitTimers.push(
          setTimeout(
            () =>
              session &&
              session.ready &&
              session.sendText(
                curPart() === 'teacher'
                  ? '[App] The learner has finished speaking. If they answered your question, call fill_form now; otherwise respond to what they said.'
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
      const sl = SLOTS[st.tIdx];
      session.sendText(`[App] The learner TYPED this answer: "${t}". The app already checked it: ${judgeHeard({ field: sl.key, value: t, heard: t })}`);
    } else {
      session.sendText(`[App] The learner TYPED this: "${t}". Respond to it as if they had said it.`);
    }
    inp.value = '';
  });
}
