// "Kellner und Gast" — animasiyalı kafe rol oyunu, səsli (Gemini). app.js yalnız renderKellner(ctx) çağırır.
//
// 1-ci raund: müəllim — ofisiant, şagird — müştəri. 2-ci raund: rollar dəyişir.
// Addımlar: salam + menyu → sifariş → "noch etwas?" → "Nein, danke" → gətirir → ödəmək + qiymət →
// "Zusammen oder getrennt?" → pul → qalıq → "Stimmt so" → sağollaşma.
// Hər addımı TƏTBİQ idarə edir və şagirdin cümləsini özü yoxlayır; səhvdə müəllim izah edib düzgün deyənə qədər təkrar etdirir.

import { LiveSession } from './live.js';
import { plausibleTranscript } from './checker.js';
import { correctionRules } from './prompt.js';
import { MENU, itemById, euro, euroWords, orderTotal, orderPhrase, randomOrder, payAmount, CHECK } from './kellner-core.js';
import { dlog, showLogOverlay } from './log.js';

const LANG = { az: 'Azerbaijani', tr: 'Turkish', de: 'very simple German' };

// ---------- addımlar ----------
// who: T (müəllim deyir) | L (şagird deyir). say(ctx) — müəllimin sözü; check — CHECK açarı; ex(ctx) — nümunə; anim — animasiya
const R1 = [
  { k: 'greet', who: 'T', anim: 'arrive', say: () => 'Guten Tag! Hier ist die Speisekarte. Was möchten Sie?' },
  { k: 'order', who: 'L', check: 'order', az: 'Menyuya bax və sifariş ver (einen / ein / eine + söz).', ex: () => 'Ich möchte einen Kaffee und ein Croissant, bitte.' },
  { k: 'more', who: 'T', anim: 'notepad', say: (c) => (c.order.some((x) => itemById(x.id).grp === 'food') ? 'Gerne. Möchten Sie sonst noch etwas?' : 'Gerne. Möchten Sie noch etwas dazu? Vielleicht einen Kuchen?') },
  { k: 'no', who: 'L', check: 'noThanks', az: 'Başqa bir şey istəmirsən — nəzakətlə de. (İstəyirsənsə, sifariş ver.)', ex: () => 'Nein, danke.' },
  { k: 'serve', who: 'T', anim: 'serve', say: () => 'Kommt sofort! … Bitte schön. Guten Appetit!' },
  { k: 'pay', who: 'L', check: 'pay', az: (c) => `Yedin, içdin. Ödəmək istədiyini de, hesabı istə və qiyməti soruş (bu oyunda: "Was ${c.form} das?").`, ex: (c) => `Ich möchte bitte zahlen. Die Rechnung, bitte. Was ${c.form} das?` },
  { k: 'price', who: 'T', anim: 'bill', say: (c) => `Gerne, hier ist die Rechnung. Das ${c.form} ${euroWords(c.total)}. Zusammen oder getrennt?` },
  { k: 'tog', who: 'L', check: 'together', az: 'Cavab ver: birlikdə və ya ayrı.', ex: () => 'Zusammen, bitte.' },
  { k: 'ok', who: 'T', say: () => 'Gerne.' },
  { k: 'give', who: 'L', check: 'give', az: 'Pulu ver və məbləği de (hesabdan çox ola bilər).', ex: (c) => `Hier sind ${euroWords(payAmount(c.total))}.` },
  { k: 'change', who: 'T', anim: 'change', say: (c) => (c.paid > c.total ? `Danke schön! Und ${euroWords(c.paid - c.total)} zurück.` : 'Danke schön, das passt genau.') },
  { k: 'keep', who: 'L', check: 'keepChange', az: 'Qalığı saxlasın deyə de (bəxşiş).', ex: () => 'Stimmt so, danke!' },
  { k: 'thanks', who: 'T', say: () => 'Vielen Dank! Auf Wiedersehen!' },
  { k: 'bye', who: 'L', check: 'bye', okAnim: 'bye', az: 'Vidalaş.', ex: () => 'Auf Wiedersehen!' },
];
const R2 = [
  { k: 'kgreet', who: 'L', check: 'askOrder', okAnim: 'arrive', az: 'Sən ofisiantsan: salam ver, menyunu qoy və nə istədiyini soruş.', ex: () => 'Guten Tag! Hier ist die Speisekarte. Was möchten Sie?' },
  { k: 'korder', who: 'T', anim: 'notepad', say: (c) => `Ich möchte ${orderPhrase(c.order)}, bitte.` },
  { k: 'kmore', who: 'L', check: 'askMore', az: 'Başqa bir şey istəyib-istəmədiyini soruş.', ex: () => 'Möchten Sie sonst noch etwas?' },
  { k: 'kno', who: 'T', anim: 'serve', say: () => 'Nein, danke.' },
  { k: 'kpay', who: 'T', anim: 'bill', say: (c) => `Danke, das war lecker! Ich möchte bitte zahlen. Die Rechnung, bitte. Was ${c.form} das?` },
  { k: 'kprice', who: 'L', check: 'price', az: (c) => `Hesabı ver, qiyməti de — müştərinin sözü ilə: "Das ${c.form} …". Sonra "birlikdə, yoxsa ayrı?" soruş.`, ex: (c) => `Hier ist die Rechnung. Das ${c.form} ${euroWords(c.total)}. Zusammen oder getrennt?` },
  { k: 'ktog', who: 'L', check: 'askTogether', az: 'Soruş: birlikdə, yoxsa ayrı?', ex: () => 'Zusammen oder getrennt?' },
  { k: 'kpays', who: 'T', anim: 'pay', say: (c) => `Zusammen, bitte. Hier sind ${euroWords(c.paid)}.` },
  { k: 'kchange', who: 'L', check: 'change', okAnim: 'change', az: 'Qalığı hesabla və qaytar.', ex: (c) => `Danke! Und ${euroWords(c.paid - c.total)} zurück.` },
  { k: 'kkeep', who: 'T', say: () => 'Stimmt so, danke! Auf Wiedersehen!' },
  { k: 'kbye', who: 'L', check: 'byeWaiter', okAnim: 'bye', az: 'Təşəkkür et və vidalaş.', ex: () => 'Vielen Dank! Auf Wiedersehen!' },
];
const ROUNDS = [R1, R2];

function kellnerPrompt(expl) {
  return `You are a friendly German teacher. The learner is an A1.1 beginner whose native language is Azerbaijani.
You play a ROLE PLAY in a German café: "Kellner und Gast" (waiter and guest). There are two rounds:
- Round 1: YOU are the waiter (Kellner), the learner is the guest (Gast).
- Round 2: the roles change — the learner is the waiter, YOU are the guest.
Waiter and guest use the formal "Sie".

THE APP CONTROLS THE GAME. It decides the step, what you say and whether the learner's sentence is correct. Messages starting with "[App]" come from the app — follow them silently and exactly.

YOUR JOB — strictly:
1. Say ONLY what the app tells you to say, in German, exactly as given, slowly and clearly, like a real waiter/guest. Do not add other sentences, do not invent prices, do not order or offer anything yourself.
2. After EVERY sentence of the learner, call the function learner_said with heard = EXACTLY what the learner said, word by word, uncorrected (wrong articles like "ein Kaffee" or wrong numbers must stay as they were). Then follow the function response exactly.
3. If the response says WRONG: step out of your role for a moment and explain the mistake in ${expl} using the content the app gives you (naturally, no label or prefix), say the correct German sentence slowly, and ask the learner in ${expl} to say it again. Then end your turn and wait. Repeat this until the learner says it correctly.
4. If the response says CORRECT: stay in your role, do not praise, and say exactly what the response tells you to say next.
5. Prices: say them exactly as the app writes them (e.g. "vier Euro sechzig").
6. Never answer questions that are not about this café role play. Keep everything short.

${correctionRules(expl)}`;
}

const TOOLS = [
  {
    name: 'learner_said',
    description: "Send the learner's sentence to the app. Call after EVERY sentence of the learner; the app checks it and tells you what to say.",
    parameters: {
      type: 'OBJECT',
      properties: { heard: { type: 'STRING', description: 'Exactly what the learner said, word by word, uncorrected.' } },
      required: ['heard'],
    },
  },
];

export function renderKellner(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake, closeMessage, MODELS } = ctx;
  const s = ctx.settings();
  const ptt = s.mode === 'ptt';
  const expl = LANG[s.explainLang] || LANG.az;

  // ---------- vəziyyət ----------
  const KEY = `kellner.${d.id}`;
  // qiymət sualı növbə ilə: bir oyun "Was macht das?", növbəti "Was kostet das?"
  const nextForm = () => {
    const f = store.get('kellnerForm', 'macht') === 'macht' ? 'kostet' : 'macht';
    store.set('kellnerForm', f);
    return f;
  };
  const fresh = () => ({ v: 1, form: nextForm(), round: 0, idx: 0, order: [], total: 0, paid: 0, scene: { waiter: 'away', menu: false, pad: false, items: [], bill: false, money: false, coins: false, wave: false }, mistakes: 0, okSteps: 0, tries: 0, lastLine: '', finished: false });
  let st = store.get(KEY, null);
  if (!st || st.v !== 1 || !Array.isArray(st.order)) st = fresh();
  if (!st.form) st.form = 'macht'; // köhnə yadda saxlanmış oyun
  const save = () => store.set(KEY, st);
  const steps = () => ROUNDS[st.round];
  const cur = () => steps()[st.idx];
  const learnerIsWaiter = () => st.round === 1;
  const c = () => ({ order: st.order, total: st.total, paid: st.paid, form: st.form });
  const azOf = (step) => (typeof step.az === 'function' ? step.az(c()) : step.az);
  const hasProgress = () => st.round > 0 || st.idx > 0;

  // ---------- ekran ----------
  $app.innerHTML = `
    ${header(esc(d.title), `#/d/${d.id}`)}
    <main class="practice kc">
      <div class="kc-top"><span id="kcRound"></span><span id="kcScore"></span></div>
      ${hasProgress() && !st.finished ? '<div class="resume-bar kc-rb">↩️ Qaldığın yerdən davam <button type="button" id="kcRestart">🔄 Yenidən başla</button></div>' : ''}
      <div class="kc-scene" id="kcScene">
        <div class="kc-wall"><span>☕ Café Leipzig</span><span class="kc-lamp">💡</span><span class="kc-plant">🪴</span></div>
        <div class="kc-cust"><div class="kc-bubble" id="kcBubC"></div><span class="kc-ava">🧑</span><small id="kcLblC"></small></div>
        <div class="kc-waiter" id="kcWaiter"><div class="kc-bubble" id="kcBubW"></div><span class="kc-ava">🤵</span><span class="kc-hand" id="kcHand"></span><small id="kcLblW"></small></div>
        <div class="kc-table">
          <div class="kc-menu" id="kcMenuCard">📖<small>Speisekarte</small></div>
          <div class="kc-items" id="kcItems"></div>
          <div class="kc-bill" id="kcBill"></div>
          <div class="kc-money" id="kcMoney">💶</div>
          <div class="kc-coins" id="kcCoins">🪙</div>
        </div>
        <div class="kc-wave" id="kcWave">👋</div>
      </div>
      <div class="kc-task" id="kcTask"></div>
      <div class="kc-mid" id="kcMid">
      <div class="kc-cols">
        <details class="kc-box" open><summary>📖 Speisekarte</summary><div class="kc-menu-list">${MENU.map((it) => `<div class="kc-mi"><span>${it.e}</span><b>${esc(it.n)}</b><small>${esc(it.az)}</small><i>${euro(it.p)}</i></div>`).join('')}</div></details>
        <div class="kc-box kc-billbox" id="kcBillBox"></div>
      </div>
      <div id="chat" class="chat kc-chat"><div class="sys">${s.apiKey ? 'Başlamaq üçün aşağıdakı düyməyə bas.' : '🔑 Əvvəlcə <a href="#/settings">Ayarlar</a>-da API açarını yaz.'}</div></div>
      </div>
      <div class="controls kc-controls">
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

  const $ = (sel) => $app.querySelector(sel);
  const chat = $('#chat');
  const statusEl = $('#status');
  const timerEl = $('#timer');
  const levelEl = $('#level');
  const startBtn = $('#startBtn');
  const micBtn = $('#micBtn');
  const endBtn = $('#endBtn');
  const textForm = $('#textForm');
  const root = $('main');
  const alive = () => document.body.contains(root);
  $('#logBtn').addEventListener('click', () => showLogOverlay($app));
  const setStatus = (t) => (statusEl.textContent = t);
  const scroll = () => { const m = $('#kcMid'); m.scrollTop = m.scrollHeight; };
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
    // danışığı personajın üstündə göstər
    const teacherIsWaiter = !learnerIsWaiter();
    const bub = (role === 'ai') === teacherIsWaiter ? $('#kcBubW') : $('#kcBubC');
    bub.textContent = last.raw.length > 120 ? `…${last.raw.slice(-118)}` : last.raw;
    bub.classList.add('on');
    clearTimeout(bub._t);
    bub._t = setTimeout(() => bub.classList.remove('on'), 9000);
  }

  // ---------- səhnə ----------
  function paintScene() {
    const sc = st.scene;
    const scene = $('#kcScene');
    scene.classList.toggle('w-table', sc.waiter === 'table');
    scene.classList.toggle('s-menu', sc.menu);
    scene.classList.toggle('s-bill', sc.bill);
    scene.classList.toggle('s-money', sc.money);
    scene.classList.toggle('s-coins', sc.coins);
    scene.classList.toggle('s-wave', sc.wave);
    $('#kcHand').textContent = sc.tray ? '🍽️' : sc.pad ? '📝' : '';
    $('#kcItems').innerHTML = sc.items.map((e, i) => `<span style="animation-delay:${i * 0.15}s">${e}</span>`).join('');
    $('#kcBill').textContent = sc.bill ? `🧾 ${euro(st.total)}` : '';
    $('#kcLblC').textContent = learnerIsWaiter() ? 'Gast · Müəllim' : 'Gast · Sən';
    $('#kcLblW').textContent = learnerIsWaiter() ? 'Kellner · Sən' : 'Kellner · Müəllim';
    $('#kcRound').innerHTML = st.finished ? '🏆 Oyun bitdi' : `<b>${st.round + 1}-ci raund:</b> ${learnerIsWaiter() ? 'sən ofisiantsan 🤵' : 'sən müştərisən 🧑'}`;
    $('#kcScore').textContent = `✅ ${st.okSteps} · ❌ ${st.mistakes}`;
    // hesab qutusu
    const rows = st.order.map((x) => {
      const it = itemById(x.id);
      return `<div class="kc-br"><span>${it.e} ${x.qty > 1 ? `${x.qty} × ` : ''}${esc(it.n)}</span><b>${euro(it.p * x.qty)}</b></div>`;
    }).join('');
    $('#kcBillBox').innerHTML = `<div class="kc-bt">🧾 ${learnerIsWaiter() ? 'Sifariş (bloknot)' : 'Sənin sifarişin'}</div>
      ${rows || '<div class="muted small">Hələ sifariş yoxdur.</div>'}
      ${st.order.length ? `<div class="kc-br kc-sum"><span>Cəmi</span><b>${euro(st.total)}</b></div>` : ''}
      ${st.paid ? `<div class="kc-br"><span>💶 Verilən</span><b>${euro(st.paid)}</b></div><div class="kc-br"><span>🪙 Qalıq</span><b>${euro(Math.max(0, st.paid - st.total))}</b></div>` : ''}`;
  }

  // animasiya addımı
  function anim(name) {
    const sc = st.scene;
    if (name === 'arrive') {
      Object.assign(sc, { waiter: 'table', menu: true, pad: false, tray: false, items: [], bill: false, money: false, coins: false, wave: false });
    } else if (name === 'notepad') {
      Object.assign(sc, { waiter: 'table', pad: true });
    } else if (name === 'serve') {
      // ofisiant gedir, sinidə gətirir
      Object.assign(sc, { waiter: 'away', pad: false, menu: false });
      paintScene();
      save();
      setTimeout(() => {
        if (!alive()) return;
        Object.assign(sc, { waiter: 'table', tray: true });
        paintScene();
        setTimeout(() => {
          if (!alive()) return;
          sc.tray = false;
          sc.items = st.order.flatMap((x) => Array(Math.min(x.qty, 3)).fill(itemById(x.id).e));
          paintScene();
          save();
          fx.tone([660, 880], 0.08, 'triangle', 0.06);
        }, 900);
      }, 1500);
      return;
    } else if (name === 'bill') {
      Object.assign(sc, { waiter: 'table', bill: true });
    } else if (name === 'pay') {
      Object.assign(sc, { money: true });
    } else if (name === 'change') {
      Object.assign(sc, { money: true });
      paintScene();
      setTimeout(() => {
        if (!alive()) return;
        if (st.paid > st.total) sc.coins = true;
        paintScene();
        save();
      }, 900);
      return;
    } else if (name === 'bye') {
      Object.assign(sc, { wave: true });
      paintScene();
      setTimeout(() => {
        if (!alive()) return;
        Object.assign(sc, { waiter: 'away', bill: false, money: false, coins: false });
        paintScene();
        save();
      }, 1400);
      return;
    }
    paintScene();
  }

  function paintTask() {
    const box = $('#kcTask');
    if (st.finished) {
      box.innerHTML = `<div class="kc-done">🏆 <b>Əla! Hər iki rolu oynadın.</b><br>Düz addımlar: ${st.okSteps} · səhvlər: ${st.mistakes}</div>`;
      return;
    }
    const step = cur();
    if (!step) return (box.innerHTML = '');
    if (step.who === 'T') {
      box.innerHTML = `<div class="kc-t them">🔊 ${learnerIsWaiter() ? 'Müştəri' : 'Ofisiant'} (müəllim) danışır…</div>`;
      return;
    }
    const exShow = st.tries >= 1;
    box.innerHTML = `<div class="kc-t me">🎤 <b>Sənin növbən</b> (${learnerIsWaiter() ? 'ofisiant' : 'müştəri'}): ${esc(azOf(step))}</div>
      <div class="kc-ex ${exShow ? 'show' : ''}"><button type="button" id="kcExBtn">💡 Nümunə</button><span>${esc(step.ex(c()))}</span></div>`;
    const b = $('#kcExBtn');
    if (b) b.addEventListener('click', () => $('#kcTask .kc-ex').classList.toggle('show'));
  }
  function paintAll() {
    paintScene();
    paintTask();
  }
  paintAll();

  const restartBtn = $('#kcRestart');
  if (restartBtn)
    restartBtn.addEventListener('click', () => {
      if (!confirm('Oyun əvvəldən başlasın?')) return;
      store.set(KEY, null);
      ctx.teardown();
      renderKellner(ctx);
    });

  // ---------- gediş ----------
  // Ardıcıl müəllim addımlarını topla, animasiyaları işə sal; müəllimə deyiləcək mətni qaytar
  function teacherTurn() {
    const lines = [];
    let delay = 0;
    while (cur() && cur().who === 'T') {
      const step = cur();
      const line = step.say(c());
      lines.push(line);
      if (step.anim) {
        const a = step.anim;
        setTimeout(() => alive() && anim(a), delay);
        delay += a === 'serve' ? 2600 : 300;
      }
      st.idx++;
    }
    st.tries = 0;
    if (lines.length) st.lastLine = lines.join(' ');
    save();
    setTimeout(() => alive() && paintAll(), 50);
    return lines.length ? `say exactly in German: "${lines.join(' ')}" Then end your turn and wait for the learner.` : 'end your turn and wait for the learner.';
  }

  function startRound2() {
    st.round = 1;
    st.idx = 0;
    st.order = randomOrder();
    st.total = orderTotal(st.order);
    st.paid = payAmount(st.total);
    st.scene = { waiter: 'away', menu: false, pad: false, items: [], bill: false, money: false, coins: false, wave: false };
    st.tries = 0;
    save();
    paintAll();
  }

  function finishGame() {
    st.finished = true;
    save();
    const done = store.get('done', {});
    done[d.id] = done[d.id] || Date.now();
    store.set('done', done);
    paintAll();
    fx.win();
    confetti($('#kcScene'));
  }

  // Şagirdin cümləsi (müəllim learner_said ilə göndərir)
  function judge(heard) {
    const step = cur();
    if (st.finished || !step) return 'The game is finished. Say goodbye briefly in Azerbaijani.';
    if (step.who !== 'L') return `Not now. ${teacherTurn()}`;
    const sources = [String(heard || '').trim(), userUtter.trim()].filter(Boolean);
    let res = null;
    for (const t of sources) {
      const r = CHECK[step.check](t, c());
      if (r.ok) {
        res = r;
        break;
      }
      if (!res) res = r;
    }
    res = res || { ok: false, az: azOf(step) };
    if (!res.ok) {
      st.tries++;
      st.mistakes++;
      fx.oops();
      const said = sources[0] || '—';
      if ((said.match(/[a-zäöüß]{2,}/gi) || []).length >= 2) saveMistake(cat, d, { wrong: said, correct: step.ex(c()), explanation: res.az });
      addLine('mnote', `❌ ${res.az}`);
      save();
      paintAll();
      return (
        `WRONG. Step out of your role for a moment: explain in ${expl} using exactly this content (naturally, no label or prefix): ${res.az} ` +
        `Then say the correct German sentence slowly: "${step.ex(c())}" and ask the learner in ${expl} to say it again. Then end your turn. Stay at this step.`
      );
    }
    // düzdür
    st.okSteps++;
    fx.ding();
    addLine('okline', `✅ ${sources[0] || ''}`);
    if (step.check === 'order' || (step.check === 'noThanks' && res.more)) {
      for (const it of res.items) {
        const ex = st.order.find((x) => x.id === it.id);
        if (ex) ex.qty += it.qty;
        else st.order.push({ ...it });
      }
      st.total = orderTotal(st.order);
      if (res.more) {
        // əlavə sifariş: yenə "sonst noch etwas?"
        st.tries = 0;
        save();
        paintAll();
        return 'CORRECT — stay in your role, do not praise. Say exactly in German: "Gerne. Möchten Sie sonst noch etwas?" Then end your turn and wait for the learner.';
      }
    }
    if (step.check === 'give') st.paid = res.val;
    if (step.check === 'together') {
      // pulu da eyni cümlədə veribsə — "give" addımını da keç
      const money = CHECK.give(sources.join(' '), c());
      if (money.ok) {
        st.paid = money.val;
        st.idx += 3; // tog → ok → give keçildi
        save();
        return `CORRECT — stay in your role, do not praise. Then ${teacherTurn()}`;
      }
    }
    if (step.check === 'price') {
      // "Zusammen oder getrennt?" da eyni cümlədədirsə — onu da keç
      if (CHECK.askTogether(sources.join(' ')).ok) st.idx++;
    }
    if (step.okAnim) anim(step.okAnim);
    st.idx++;
    st.tries = 0;
    save();
    paintAll();
    if (!cur()) {
      if (st.round === 0) {
        setTimeout(() => alive() && startRound2(), 2200);
        st.round = 0;
        save();
        return `CORRECT. Now say in ${expl}: "Əla! Birinci raund bitdi. İndi rolları dəyişirik: sən ofisiantsan, mən müştəriyəm. Mən stola oturdum — gəl, salam ver, menyunu ver və nə istədiyimi soruş." Then end your turn and wait.`;
      }
      setTimeout(() => alive() && finishGame(), 1500);
      return `CORRECT. Now say in ${expl}: "Əla! Oyun bitdi — həm müştəri, həm də ofisiant rolunu oynadın. Afərin!" Then end your turn.`;
    }
    if (cur().who === 'L') {
      return 'CORRECT — stay in your role. Say only "Mhm." (or "Okay.") and end your turn: the learner continues.';
    }
    return `CORRECT — stay in your role, do not praise. Then ${teacherTurn()}`;
  }

  function stateText() {
    const step = cur();
    const role = learnerIsWaiter() ? 'Round 2: the learner is the WAITER, you are the GUEST.' : 'Round 1: you are the WAITER, the learner is the GUEST.';
    const ord = st.order.length ? ` Order so far: ${orderPhrase(st.order)} (total ${euroWords(st.total)}).` : '';
    if (!step) return `${role}${ord}`;
    return `${role}${ord} Now the learner must: ${azOf(step)}`;
  }
  function resumeTail() {
    const step = cur();
    if (step && step.who === 'T') return teacherTurn();
    return st.lastLine ? `say again in German, exactly: "${st.lastLine}" Then end your turn and wait.` : 'end your turn and wait for the learner.';
  }

  function introText() {
    return `[App] Start the game. Say in ${expl}, ONCE: "Kafe oyunu! Birinci raund: mən ofisiantam, sən müştərisən. Menyuya bax, sifariş ver, sonra ödə. İkinci raundda rolları dəyişəcəyik." Then ${teacherTurn()}`;
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
      renderKellner(ctx);
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
      systemText: kellnerPrompt(expl),
      log: (k, x) => dlog.add(k, x),
      tools: TOOLS,
      onTool(name, args) {
        stopWaiting();
        if (name !== 'learner_said') return 'unknown function';
        if (args.heard) addLine('heardline', `🧑‍🏫 Müəllim eşitdi: ${args.heard}`);
        return new Promise((r) => setTimeout(r, 600)).then(() => judge(args.heard));
      },
      onEvent(type, data) {
        switch (type) {
          case 'ready':
            if (data && data.model && !data.reconnect) store.set('workingModel', data.model);
            if (data && data.reconnect) {
              setStatus(idleStatus());
              sys(data.resumed ? '✅ Bağlantı bərpa olundu.' : `✅ Yenidən qoşuldu (${data.model}).`);
              session.sendText(`[App] The connection was restarted. Same game. Do NOT greet or explain again. ${stateText()} Say in ${expl}: "Davam edirik." Then ${resumeTail()}`);
              break;
            }
            if (data && data.model) sys(`🤖 Model: ${data.model}`);
            { const rb = $('.kc-rb'); if (rb) rb.remove(); }
            started = Date.now();
            startBtn.hidden = true;
            micBtn.hidden = endBtn.hidden = textForm.hidden = false;
            setStatus(idleStatus());
            if (hasProgress()) {
              session.sendText(`[App] The learner continues this game (progress saved). Do NOT explain the game again. ${stateText()} Say in ${expl}: "Xoş gəldin! Qaldığımız yerdən davam edirik." Then ${resumeTail()}`);
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

  // Yazılı cavab
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
