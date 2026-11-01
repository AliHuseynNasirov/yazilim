import { CATEGORIES, findCategory, findDialog } from './data.js';
import { LiveSession } from './live.js';
import { buildSystemPrompt, buildTools, START_MESSAGE } from './prompt.js';
import { checkSentence, checkWords, buildLexicon, matchCardSentence, inferField, plausibleTranscript, diffWords } from './checker.js';
import { assessPronunciation, azureErrors } from './azure.js';

const $app = document.getElementById('app');

// Birinci model əsasdır; xəta olsa sıra ilə digərlərinə keçilir.
// 12-2025 modelində tez-tez 1011 xətası olduğu üçün 09-2025 əsas seçilib.
// gemini-3.8-live — stabil (preview deyil) model; açarda əlçatan deyilsə, avtomatik növbətiyə keçilir.
const MODELS = [
  'gemini-3.8-live',
  'gemini-2.5-flash-native-audio-preview-09-2025',
  'gemini-3.1-flash-live-preview',
  'gemini-2.5-flash-native-audio-preview-12-2025',
];
const SETTINGS_VERSION = 3;
const VOICES = ['Kore', 'Aoede', 'Leda', 'Zephyr', 'Puck', 'Charon', 'Fenrir', 'Orus'];
const DEFAULTS = { apiKey: '', model: MODELS[0], voice: 'Kore', explainLang: 'az', mode: 'free' };

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('dA1.' + k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    localStorage.setItem('dA1.' + k, JSON.stringify(v));
  },
};
function settings() {
  const saved = store.get('settings', {});
  // Köhnə ayarlarda saxlanmış problemli modeli yeni əsas modellə əvəz et
  if (saved.v !== SETTINGS_VERSION) delete saved.model;
  return { ...DEFAULTS, ...saved };
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let session = null;
let timerId = null;

function teardown() {
  if (session) session.stop();
  session = null;
  clearInterval(timerId);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// ---------- Brauzer TTS (nümunə dialoqu dinləmək üçün, pulsuz) ----------
function speak(text, onend) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text.replace(/–/g, ','));
  u.lang = 'de-DE';
  u.rate = 0.85;
  const de = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith('de'));
  if (de) u.voice = de;
  if (onend) u.onend = onend;
  speechSynthesis.speak(u);
}

// ---------- Marşrutlar ----------
function route() {
  teardown();
  const [view, id] = location.hash.replace(/^#\/?/, '').split('/');
  window.scrollTo(0, 0);
  if (view === 'cat') return renderCategory(id);
  if (view === 'd') return renderDialog(id);
  if (view === 'practice') return renderPractice(id);
  if (view === 'settings') return renderSettings();
  if (view === 'mistakes') return renderMistakes(id);
  renderHome();
}
window.addEventListener('hashchange', route);

function header(title, back) {
  return `<header class="top">
    ${back ? `<a class="icon-btn" href="${back}" aria-label="Geri">‹</a>` : ''}
    <h1>${title}</h1>
    <a class="icon-btn badge-wrap" href="#/mistakes" aria-label="Səhvlərim">📒${mistakeBadge()}</a>
    <a class="icon-btn" href="#/settings" aria-label="Ayarlar">⚙️</a>
  </header>`;
}

// ---------- Səhvlər dəftəri ----------
const getMistakes = () => store.get('mistakes', []);
function mistakeBadge() {
  const n = getMistakes().length;
  return n ? `<span class="badge">${n > 99 ? '99+' : n}</span>` : '';
}
function saveMistake(category, dialog, args) {
  const list = getMistakes();
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ts: Date.now(),
    cat: category.id,
    dialogId: dialog.id,
    dialogTitle: dialog.title,
    wrong: String(args.wrong || '').slice(0, 300),
    correct: String(args.correct || '').slice(0, 300),
    explanation: String(args.explanation || '').slice(0, 400),
  };
  list.unshift(item);
  store.set('mistakes', list.slice(0, 1000));
  return item;
}

function renderMistakes(filter) {
  const all = getMistakes();
  const list = filter ? all.filter((m) => m.cat === filter) : all;
  const cats = CATEGORIES.filter((c) => all.some((m) => m.cat === c.id));
  const fmt = (ts) => new Date(ts).toLocaleString('az', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const groups = CATEGORIES.map((c) => ({ c, items: list.filter((m) => m.cat === c.id) })).filter((g) => g.items.length);

  $app.innerHTML = `
    ${header('📒 Səhvlərim', '#/')}
    <main>
      <p class="muted">Müəllimin düzəltdiyi bütün səhvlər burada saxlanılır. Hər məşqdən sonra bura bax və düzgün cümlələri ucadan təkrar et.</p>
      ${cats.length ? `<div class="filters">
        <a class="chip-btn ${!filter ? 'active' : ''}" href="#/mistakes">Hamısı (${all.length})</a>
        ${cats.map((c) => `<a class="chip-btn ${filter === c.id ? 'active' : ''}" href="#/mistakes/${c.id}">${c.icon} ${esc(c.title)} (${all.filter((m) => m.cat === c.id).length})</a>`).join('')}
      </div>` : ''}
      ${!list.length ? '<div class="empty">🎉 Hələ qeyd edilmiş səhv yoxdur. Səsli məşq et — müəllim səhvlərini bura yazacaq.</div>' : ''}
      ${groups.map((g) => `
        <h2>${g.c.icon} ${esc(g.c.title)}</h2>
        <div class="mistakes">
          ${g.items.map((m) => `
            <div class="mistake" data-id="${m.id}">
              <div class="m-head"><small>${esc(m.dialogTitle)} · ${fmt(m.ts)}</small><button class="del" data-del="${m.id}" aria-label="Sil">✕</button></div>
              <div class="wrong">❌ ${esc(m.wrong)}</div>
              <div class="right">✅ ${esc(m.correct)} <button class="say" data-say="${esc(m.correct)}" aria-label="Dinlə">🔊</button></div>
              <div class="expl">💡 ${esc(m.explanation)}</div>
            </div>`).join('')}
        </div>`).join('')}
      ${list.length ? `<button class="btn ghost" id="clearAll">🗑 ${filter ? 'Bu kateqoriyanı' : 'Hamısını'} sil</button>` : ''}
    </main>`;

  $app.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => {
      store.set('mistakes', getMistakes().filter((m) => m.id !== b.dataset.del));
      renderMistakes(filter);
    }),
  );
  $app.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => {
    speechSynthesis.cancel();
    speak(b.dataset.say);
  }));
  const clear = $app.querySelector('#clearAll');
  if (clear) clear.addEventListener('click', () => {
    if (!confirm('Səhvlər silinsin?')) return;
    store.set('mistakes', filter ? getMistakes().filter((m) => m.cat !== filter) : []);
    renderMistakes(filter);
  });
}

// ---------- Şəxs kartları ----------
function personCard(c, i, compact) {
  return `<div class="pcard ${c.color} ${compact ? 'compact' : ''}">
    <img src="images/${c.img}.jpg" alt="${esc(c.name)}">
    <ul>
      <li><b>Name:</b> ${esc(c.name)}</li>
      <li><b>Alter:</b> ${c.age} Jahre</li>
      <li><b>Land:</b> ${esc(c.land)}</li>
      <li><b>Wohnort:</b> ${esc(c.city)}</li>
      <li><b>Sprache:</b> ${esc(c.lang)}</li>
    </ul>
    ${compact ? '' : `<span class="pnum">${i + 1}</span>`}
    ${(() => { const b = store.get('cardStars', {})[c.name]; return b && !compact ? `<span class="pstars">${'⭐'.repeat(b)}</span>` : ''; })()}
  </div>`;
}

const FIELD_LABELS = [
  ['name', 'Name', (c) => c.name],
  ['age', 'Alter', (c) => `${c.age} Jahre`],
  ['country', 'Land', (c) => c.land],
  ['city', 'Wohnort', (c) => c.city],
  ['language', 'Sprache', (c) => c.lang],
];
function listCard(c, i) {
  return `<div class="lcard ${c.color}" data-i="${i}">
    <div class="lc-top">
      <img src="images/${c.img}.jpg" alt="${esc(c.name)}">
      <div class="lc-title">
        <span class="lc-num">Kart ${i + 1}</span>
        <b>${esc(c.name)}</b>
        <span class="lc-now">🎤 Sənin növbən!</span>
        <span class="lc-stars"></span>
      </div>
      <span class="lc-check">✅</span>
    </div>
    <ul class="lc-fields">
      ${FIELD_LABELS.map(([f, label, get]) => `<li data-f="${f}"><span class="tick"></span><b>${label}:</b> ${esc(get(c))}</li>`).join('')}
    </ul>
  </div>`;
}

// Kiçik səs effektləri (WebAudio)
const fx = {
  ctx: null,
  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {}
    }
    if (this.ctx) this.ctx.resume();
  },
  tone(freqs, dur = 0.12, type = 'sine', vol = 0.12) {
    if (!this.ctx) return;
    let t = this.ctx.currentTime;
    for (const f of freqs) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur);
      t += dur * 0.8;
    }
  },
  ding() { this.tone([880, 1320], 0.1); },
  win() { this.tone([523, 659, 784, 1047], 0.14, 'triangle'); },
  oops() { this.tone([240, 180], 0.12, 'square', 0.05); },
};

function confetti(anchor, count = 40) {
  const box = document.createElement('div');
  box.className = 'confetti';
  const r = anchor ? anchor.getBoundingClientRect() : { left: 0, width: innerWidth, top: innerHeight * 0.3 };
  const colors = ['#111', '#dd0000', '#ffce00', '#4caf50', '#2f62c9', '#e05555'];
  for (let k = 0; k < count; k++) {
    const p = document.createElement('i');
    p.style.left = `${r.left + Math.random() * r.width}px`;
    p.style.top = `${r.top + Math.random() * 20}px`;
    p.style.background = colors[k % colors.length];
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    p.style.animationDelay = `${Math.random() * 0.2}s`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1800);
}

function renderHome() {
  const done = store.get('done', {});
  const s = settings();
  const total = CATEGORIES.reduce((n, c) => n + c.dialogs.length, 0);
  const finished = Object.keys(done).length;
  $app.innerHTML = `
    ${header('🇩🇪 Deutsch A1.1')}
    <main>
      ${!s.apiKey ? `<a class="notice" href="#/settings">🔑 Səsli məşq üçün əvvəlcə Gemini API açarını əlavə et →</a>` : ''}
      <section class="hero">
        <p>Kateqoriya seç → dialoqu oxu və dinlə → qaydanı öyrən → süni intellektlə <b>səsli danış</b>.</p>
        <div class="progress"><span style="width:${Math.round((finished / total) * 100)}%"></span></div>
        <small>${finished} / ${total} dialoq məşq edilib</small>
      </section>
      <a class="card row mistakes-link" href="#/mistakes">
        <div><b>📒 Səhvlərim</b><small>Bütün kateqoriyalardan qeyd edilmiş səhvlər və izahları</small></div>
        <span class="state">${getMistakes().length} ›</span>
      </a>
      <div class="grid">
        ${CATEGORIES.map((c) => {
          const n = c.dialogs.filter((d) => done[d.id]).length;
          return `<a class="card cat" href="#/cat/${c.id}">
            <span class="emoji">${c.icon}</span>
            <b>${esc(c.title)}</b>
            <small>${n}/${c.dialogs.length} ${n === c.dialogs.length ? '✅' : ''}</small>
          </a>`;
        }).join('')}
      </div>
    </main>`;
}

function renderCategory(id) {
  const c = findCategory(id);
  if (!c) return renderHome();
  const done = store.get('done', {});
  $app.innerHTML = `
    ${header(`${c.icon} ${esc(c.title)}`, '#/')}
    <main class="list">
      ${c.dialogs.map((d) => `
        <a class="card row" href="#/d/${d.id}">
          <div>
            <b>${esc(d.title)}</b>
            <small>${esc(d.situation)}</small>
            <span class="chip">📘 ${esc(d.rule.title)}</span>
          </div>
          <span class="state">${done[d.id] ? '✅' : '›'}</span>
        </a>`).join('')}
    </main>`;
}

function ruleHtml(rule) {
  return `
    <h2>📘 ${esc(rule.title)}</h2>
    ${rule.text.map((t) => `<p>${t}</p>`).join('')}
    ${rule.tables.map((t) => `
      <div class="table-wrap"><table>
        ${t.head.some(Boolean) ? `<thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : ''}
        <tbody>${t.rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`).join('')}
    ${(rule.tips || []).map((t) => `<p class="tip">💡 ${esc(t)}</p>`).join('')}`;
}

function planHtml(d) {
  if (!d.phases) return '';
  return `
    <h2>🗺️ Dərsin planı</h2>
    <ol class="phases">${d.phases.map((p) => `<li>${esc(p.title)}</li>`).join('')}</ol>
    <p class="muted small">Hər mərhələ dəyişəndə müəllim azərbaycanca xəbər verəcək. Səhv etsən, nəyin səhv olduğunu deyəcək və cümləni düzgün təkrar etməyini istəyəcək.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Mövzu</th><th>Sual (du)</th><th>Cavab (ich)</th></tr></thead>
      <tbody>${d.topics.map((t) => `<tr><td>${esc(t.az)}</td><td>${esc(t.q)}</td><td>${esc(t.a)}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

function renderDialog(id) {
  const found = findDialog(id);
  if (!found) return renderHome();
  const { category: c, dialog: d } = found;
  $app.innerHTML = `
    ${header(esc(d.title), `#/cat/${c.id}`)}
    <main>
      <p class="situation">🎬 ${esc(d.situation)}</p>
      ${(() => {
        const n = getMistakes().filter((m) => m.dialogId === d.id).length;
        return n ? `<a class="notice soft" href="#/mistakes/${c.id}">📒 Bu dialoqda ${n} səhv qeyd edilib — bax →</a>` : '';
      })()}
      <nav class="tabs">
        ${d.phases ? '<button data-tab="plan">Plan</button>' : ''}
        ${d.cards ? '<button data-tab="cards">Kartlar</button>' : ''}
        <button data-tab="dialog" class="active">Dialoq</button>
        <button data-tab="rule">Qayda</button>
        <button data-tab="vocab">Lüğət</button>
      </nav>
      <section data-pane="dialog">
        <button class="btn ghost" id="playAll">🔊 Hamısını dinlə</button>
        <label class="toggle"><input type="checkbox" id="showTr" checked> Tərcüməni göstər</label>
        <div class="dialog">
          ${d.lines.map((l, i) => `
            <div class="line ${l[0] === 'A' ? 'a' : 'b'}">
              <button class="say" data-i="${i}" aria-label="Dinlə">🔊</button>
              <div><div class="de">${esc(l[1])}</div><div class="tr">${esc(l[2])}</div></div>
            </div>`).join('')}
        </div>
      </section>
      ${d.phases ? `<section data-pane="plan" hidden>${planHtml(d)}</section>` : ''}
      ${d.cards ? `<section data-pane="cards" hidden>
        <p class="muted small">Hər kart üçün 5 cümlə de: <i>Ich heiße … · Ich bin … Jahre alt · Ich komme aus … · Ich wohne in … · Ich spreche …</i></p>
        <div class="pcards">${d.cards.map((c, i) => personCard(c, i)).join('')}</div>
      </section>` : ''}
      <section data-pane="rule" hidden class="rule">${ruleHtml(d.rule)}</section>
      <section data-pane="vocab" hidden>
        <div class="vocab">
          ${d.vocab.map((v) => `<button class="word" data-say="${esc(v[0])}"><b>${esc(v[0])}</b><span>${esc(v[1])}</span></button>`).join('')}
        </div>
      </section>
      <div class="sticky-cta">
        <a class="btn primary big" href="#/practice/${d.id}">🎙️ Səsli məşqə başla</a>
      </div>
    </main>`;

  $app.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      $app.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
      $app.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab));
    }),
  );
  $app.querySelectorAll('.say').forEach((b) => b.addEventListener('click', () => {
    speechSynthesis.cancel();
    speak(d.lines[+b.dataset.i][1]);
  }));
  $app.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => {
    speechSynthesis.cancel();
    speak(b.dataset.say);
  }));
  $app.querySelector('#showTr').addEventListener('change', (e) =>
    $app.querySelector('.dialog').classList.toggle('no-tr', !e.target.checked),
  );
  $app.querySelector('#playAll').addEventListener('click', () => {
    speechSynthesis.cancel();
    let i = 0;
    const next = () => {
      $app.querySelectorAll('.line').forEach((el, j) => el.classList.toggle('playing', j === i));
      if (i >= d.lines.length) return;
      speak(d.lines[i][1], () => {
        i++;
        next();
      });
    };
    next();
  });
}

function renderSettings() {
  const s = settings();
  $app.innerHTML = `
    ${header('⚙️ Ayarlar', '#/')}
    <main class="form">
      <label>Gemini API açarı
        <input id="apiKey" type="password" autocomplete="off" placeholder="AIza..." value="${esc(s.apiKey)}">
      </label>
      <p class="muted small">Pulsuz açarı <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> ünvanından al. Açar yalnız bu telefonda saxlanılır.</p>

      <label>Azure açarı (tələffüz yoxlaması, istəyə görə)
        <input id="azureKey" type="password" autocomplete="off" placeholder="Azure Speech açarı" value="${esc(s.azureKey || '')}">
      </label>
      <label>Azure region
        <input id="azureRegion" autocomplete="off" placeholder="məs. westeurope" value="${esc(s.azureRegion || '')}">
      </label>
      <p class="muted small">Azure portalında Speech resursunun "Keys and Endpoint" bölməsindən: KEY 1 və Location/Region. Boş qalsa, tələffüz yoxlaması sönülüdür. Yalnız kart dərsində və "Bas və danış" rejimində işləyir.</p>

      <label>Model
        <select id="model">${[...new Set([s.model, ...MODELS])].map((m) => `<option ${m === s.model ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
      </label>
      <label>Və ya öz model adını yaz
        <input id="customModel" placeholder="məs. gemini-2.5-flash-native-audio-..." value="">
      </label>

      <label>Səs
        <select id="voice">${VOICES.map((v) => `<option ${v === s.voice ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </label>

      <label>İzah dili (səhvlər izah olunanda)
        <select id="explainLang">
          <option value="az" ${s.explainLang === 'az' ? 'selected' : ''}>Azərbaycanca</option>
          <option value="tr" ${s.explainLang === 'tr' ? 'selected' : ''}>Türkcə</option>
          <option value="de" ${s.explainLang === 'de' ? 'selected' : ''}>Yalnız almanca</option>
        </select>
      </label>

      <label>Danışma rejimi
        <select id="mode">
          <option value="free" ${s.mode === 'free' ? 'selected' : ''}>Sərbəst (qulaqlıqla ən yaxşısı)</option>
          <option value="ptt" ${s.mode === 'ptt' ? 'selected' : ''}>Bas və danış (dinamikdə əks-səda olmur)</option>
        </select>
      </label>

      <button class="btn primary big" id="save">Yadda saxla</button>
      <button class="btn ghost" id="reset">İrəliləyişi sıfırla</button>
    </main>`;

  $app.querySelector('#save').addEventListener('click', () => {
    const custom = $app.querySelector('#customModel').value.trim();
    store.set('settings', {
      apiKey: $app.querySelector('#apiKey').value.trim(),
      model: custom || $app.querySelector('#model').value,
      modelPicked: !!custom || $app.querySelector('#model').value !== MODELS[0],
      azureKey: $app.querySelector('#azureKey').value.trim(),
      azureRegion: $app.querySelector('#azureRegion').value.trim().toLowerCase().replace(/\s+/g, ''),
      voice: $app.querySelector('#voice').value,
      explainLang: $app.querySelector('#explainLang').value,
      mode: $app.querySelector('#mode').value,
      v: SETTINGS_VERSION,
    });
    history.length > 1 ? history.back() : (location.hash = '#/');
  });
  $app.querySelector('#reset').addEventListener('click', () => {
    if (confirm('Bütün irəliləyiş silinsin?')) store.set('done', {});
  });
}

// ---------- Səsli məşq ----------
function renderPractice(id) {
  const found = findDialog(id);
  if (!found) return renderHome();
  const { category: cat, dialog: d } = found;
  const s = settings();
  const ptt = s.mode === 'ptt';
  let cardIdx = 0;

  $app.innerHTML = `
    ${header(`🎙️ ${esc(d.title)}`, `#/d/${d.id}`)}
    <main class="practice ${d.cards ? 'cards-mode' : ''}">
      <details class="rule-mini">
        <summary>📘 ${d.phases ? 'Plan və qayda' : esc(d.rule.title)}</summary>
        <div class="rule">${planHtml(d)}${ruleHtml(d.rule)}</div>
      </details>
      ${d.cards ? `<div class="score-bar">
        <span id="scDone">✅ 0/${d.cards.length}</span><span id="scStars">⭐ 0</span><span id="scErr">❌ 0</span>
      </div>
      <div id="cardList" class="card-list">${d.cards.map((c, i) => listCard(c, i)).join('')}</div>` : ''}
      <div id="chat" class="chat">
        <div class="sys">${s.apiKey ? 'Başlamaq üçün aşağıdakı düyməyə bas. Müəllim almanca danışacaq, səhvlərini izah edəcək.' : '🔑 Əvvəlcə <a href="#/settings">Ayarlar</a>-da API açarını yaz.'}</div>
      </div>
      <div class="controls">
        <div class="status"><span id="status">Hazır</span><span id="timer"></span></div>
        <div class="meter"><span id="level"></span></div>
        <div class="buttons">
          <button class="btn primary big" id="startBtn" ${s.apiKey ? '' : 'disabled'}>▶️ Başla</button>
          <button class="mic" id="micBtn" hidden>🎙️</button>
          <button class="btn ghost" id="endBtn" hidden>⏹ Bitir</button>
        </div>
        <form id="textForm" class="textrow" hidden>
          <input id="textIn" placeholder="Və ya yaz… (almanca / azərbaycanca)" autocomplete="off">
          <button class="btn">➤</button>
        </form>
        <div class="quick" id="quick" hidden>
          <button data-q="Wie bitte? Noch einmal, langsam bitte.">🔁 Təkrar et</button>
          <button data-q="Hilfe! Was kann ich sagen?">🆘 Kömək</button>
          <button data-q="Başa düşmədim, azərbaycanca izah et.">❓ İzah et</button>
          <button id="soundTest" type="button">🔊 Səsi yoxla</button>
        </div>
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
  const quick = $app.querySelector('#quick');

  let last = null; // {role, el, open}
  // Şagirdin son dediyi (ekrandakı yazı) — səhv dəftərinə bu yazılır
  let userUtter = '';
  // true olanda şagirdin növbəti sözü YENİ cümlə sayılır (əvvəlki cümləyə yapışmır)
  let utterClosed = true;
  // Hər yeni cümlə üçün sayğac və yoxlama vəziyyəti
  let utterId = 0;
  let modelLoggedUtter = -1; // model bu cümlə üçün səhv qeyd edib
  let appLoggedUtter = -1; // tətbiq (yoxlayıcı) bu cümlə üçün səhv qeyd edib
  let checkedUtter = -1; // bu cümlə artıq yoxlanılıb
  let aiTurnText = '';
  let tickedThisUtter = []; // [{i, field}]
  const noteUser = (text, fresh) => {
    if (fresh || utterClosed) {
      userUtter = '';
      utterId++;
      aiTurnText = '';
      tickedThisUtter = [];
    }
    utterClosed = !!fresh;
    userUtter += text;
  };
  const closeUtter = () => (utterClosed = true);
  // Kart dərsi üçün qapalı lüğət (səhv deyilmiş sözləri tapmaq üçün)
  const lexicon = d.cards ? buildCardLexicon(d) : null;
  // Ekrandakı yazıda qrammatika və söz səhvlərini tap
  // ---- Hərfi yoxlayıcı (Gemini Flash): düymə basılanda deyilən səsin düzəldilməmiş yazısı ----
  let pressId = 0;
  let verif = null; // { pressId, done, text, promise }
  const verifierReady = () => verif && verif.pressId === pressId && verif.done && !!verif.text;
  const verifierPending = () => verif && verif.pressId === pressId && !verif.done;
  // Yoxlamalar üçün əsas mətn: yoxlayıcının yazısı varsa o, yoxsa ASR yazısı
  const judgeText = () => (verifierReady() ? verif.text : userUtter.trim());

  // ---- Azure tələffüz yoxlaması (yalnız kart dərsi + "Bas və danış" + açar varsa) ----
  const azureOn = !!(d.cards && ptt && s.azureKey && s.azureRegion);
  let az = null; // { pressId, field, ref, done, result, promise }
  const azPending = () => az && az.pressId === pressId && !az.done;
  const azReady = (field) => az && az.pressId === pressId && az.done && az.result && az.result.ok && (!field || az.field === field);
  const azErrs = (field) => (azReady(field) ? azureErrors(az.result) : []);

  const findErrors = () => {
    const text = judgeText();
    if (!text || !looksLatin(text)) return [];
    const errs = [...checkSentence(text), ...checkWords(text, lexicon)];
    if (!errs.length) return errs;
    // Bütün düzəlişləri bir düzgün cümlədə birləşdir
    let fixed = errs.find((e) => !e.word)?.fullCorrect || text;
    for (const e of errs) {
      if (!e.word || e.correct === '?') continue;
      const cap = e.wrong[0] === e.wrong[0].toUpperCase();
      fixed = fixed.replace(e.wrong, cap ? e.correct[0].toUpperCase() + e.correct.slice(1) : e.correct);
    }
    return errs.map((e) => ({ ...e, fullCorrect: fixed }));
  };
  // Bu səhv həmin sahənin ✓-nu bloklayırmı?
  const blocks = (e, field) => e.field === field || (e.word && !e.field);
  const setStatus = (t) => (statusEl.textContent = t);
  const scroll = () => (chat.scrollTop = chat.scrollHeight);

  function addText(role, text) {
    if (!last || last.role !== role || !last.open) {
      const el = document.createElement('div');
      el.className = `msg ${role}`;
      chat.appendChild(el);
      last = { role, el, open: true, raw: '' };
    }
    last.raw += text;
    // Yazıya çevirmə alınmayıbsa ("40356", gürcü hərfləri) mənasız mətn göstərmə
    if (role === 'user' && !plausibleTranscript(last.raw)) {
      last.el.textContent = '🎙️ (səsin yazıya çevrilmədi — müəllim səsini eşidir)';
      last.el.classList.add('unclear');
    } else {
      last.el.textContent = last.raw;
      last.el.classList.remove('unclear');
    }
    scroll();
  }
  function sys(text) {
    const el = document.createElement('div');
    el.className = 'sys';
    el.textContent = text;
    chat.appendChild(el);
    last = null;
    scroll();
  }

  // ---- Kartlar: alt-alta, hər düzgün cümlədə ✓, kart bitəndə yaşıl + ulduz ----
  const FIELDS = ['name', 'age', 'country', 'city', 'language'];
  const cardState = (d.cards || []).map(() => ({ fields: new Set(), mistakes: 0, done: false }));
  const cardEls = [...$app.querySelectorAll('.lcard')];
  const starsFor = (st) => (st.mistakes === 0 ? 3 : st.mistakes <= 2 ? 2 : 1);

  function updateScore() {
    if (!d.cards) return;
    const done = cardState.filter((x) => x.done);
    $app.querySelector('#scDone').textContent = `✅ ${done.length}/${d.cards.length}`;
    $app.querySelector('#scStars').textContent = `⭐ ${done.reduce((n, x) => n + starsFor(x), 0)}`;
    $app.querySelector('#scErr').textContent = `❌ ${cardState.reduce((n, x) => n + x.mistakes, 0)}`;
  }

  function setActive(i, fromUser) {
    if (!d.cards) return;
    cardIdx = Math.max(0, Math.min(d.cards.length - 1, i));
    cardEls.forEach((el, j) => el.classList.toggle('active', j === cardIdx));
    updateStep();
    // Yalnız kart siyahısını sürüşdür (bütün səhifəni yox)
    setTimeout(() => {
      const list = $app.querySelector('#cardList');
      if (list) list.scrollTo({ top: Math.max(0, cardEls[cardIdx].offsetTop - 80), behavior: 'smooth' }); // əvvəlki (yaşıl) kartın kənarı görünsün
    }, 380);
    if (fromUser && session && session.ready) {
      const c = d.cards[cardIdx];
      sys(`➡️ Kart ${cardIdx + 1}: ${c.name}`);
      session.sendText(`[App] The learner switched to card ${cardIdx + 1} (${c.name}). Continue with card ${cardIdx + 1} now.`);
    }
  }

  function markField(cardNo, field, pron, heard) {
    // Kart nömrəsini model yox, tətbiq bilir: həmişə ekrandakı kart
    const i = cardIdx;
    const st = cardState[i];
    if (!st || !FIELDS.includes(field)) return 'invalid';
    if (st.done) return `This card is already complete. ${nextCardText(i)}`;
    // Azure: bu sətrin cümləsində tələffüz / əskik / artıq söz səhvi varsa — ✓ yoxdur
    const aErr = azErrs(field);
    if (aErr.length) {
      const err = {
        fullWrong: judgeText() || az.result.text,
        fullCorrect: az.ref,
        az: aErr.map((e) => e.az).join(' '),
        en: aErr.map((e) => e.en).join('; '),
        field,
      };
      checkedUtter = utterId;
      appLog([err]);
      if (noteFail(field) >= 3) return `REJECTED — not ticked. Correct sentence: "${az.ref}". The mistake is already saved. ${MOVE_ON}`;
      return rejectionText([err]);
    }
    if (pron === 'wrong') {
      return (
        'NOT TICKED — you judged the pronunciation as wrong, so it is a mistake. Call log_mistake first, then explain in Azerbaijani ' +
        `which word/sound was wrong, say the word slowly and ask the learner to repeat the whole sentence. Current card: ${i + 1} (${d.cards[i].name}).`
      );
    }
    // Yoxlayıcı bu cümlədə qrammatika səhvi tapırsa — ✓ qoyma, modelə düzəltməsini de.
    // (Söz səhvlərini aşağıda kartdakı düzgün cümlə ilə müqayisə daha dəqiq izah edir.)
    const errs = findErrors().filter((e) => blocks(e, field) && !e.word);
    if (errs.length) {
      checkedUtter = utterId;
      appLog(errs);
      if (noteFail(field) >= 3) return `REJECTED — not ticked. Correct sentence: "${errs[0].fullCorrect}". The mistake is already saved. ${MOVE_ON}`;
      return rejectionText(errs);
    }
    // Müəllimin hərfi eşitdiyi (yazıya çevirmə "kommet"-i "komme" kimi düzəldir, müəllim isə səsi eşidir)
    // Yoxlayıcının yazısı varsa onu, yoxsa müəllimin "heard"-ini yoxla
    const h = verifierReady() ? verif.text : String(heard || '').trim();
    if (h && plausibleTranscript(h)) {
      const expected = SENT[field](d.cards[i]);
      const gram = checkSentence(h).filter((e) => e.field === field);
      if (gram.length || !matchCardSentence(h, d.cards[i]).includes(field)) {
        const dif = diffWords(h, expected);
        const err = {
          fullWrong: h,
          fullCorrect: expected,
          az: gram.length ? gram.map((e) => e.az).join(' ') : dif.az || `Düzgün cümlə belədir: ${expected}`,
          en: gram.length ? gram.map((e) => e.en).join('; ') : dif.en || `the sentence must be exactly "${expected}"`,
          field,
        };
        checkedUtter = utterId;
        appLog([err]);
        if (noteFail(field) >= 3) return `REJECTED — not ticked. Correct sentence: "${expected}". The mistake is already saved. ${MOVE_ON}`;
        return rejectionText([err]);
      }
    }
    // ✓ yalnız deyilən cümlə kartdakı DÜZGÜN cümlə ilə tam eyni olanda (sonluq, söz, artikl daxil)
    const said = judgeText();
    if (said && plausibleTranscript(said) && !matchCardSentence(said, d.cards[i]).includes(field)) {
      const expected = SENT[field](d.cards[i]);
      const dif = diffWords(said, expected);
      const err = {
        fullWrong: said,
        fullCorrect: expected,
        az: dif.az || `Düzgün cümlə belədir: ${expected}`,
        en: dif.en || `the sentence must be exactly "${expected}"`,
        field,
      };
      checkedUtter = utterId;
      appLog([err]);
      if (noteFail(field) >= 3) return `REJECTED — not ticked. Correct sentence: "${expected}". The mistake is already saved. ${MOVE_ON}`;
      return rejectionText([err]);
    }
    setTick(i, field, 'ok');
    if (st.done) return `ticked ${field}. ${nextCardText(i)}`;
    return `ticked ${field} on card ${i + 1} (${st.fields.size}/5). Say only a very short praise ("Super!"), nothing else. ${stepInfo()} Do not tell the learner the next step — the screen shows it.`;
  }

  // ✓ (ok) və ya ⚠ (skip — 3 cəhddən sonra keçildi) qoy
  // Hər sahə üçün düzgün cümlə və ekranda göstərilən nümunə
  const SENT = {
    name: (c) => `Ich heiße ${c.name}.`,
    age: (c) => `Ich bin ${c.age} Jahre alt.`,
    country: (c) => `Ich komme ${c.from}.`,
    city: (c) => `Ich wohne in ${c.city}.`,
    language: (c) => `Ich spreche ${c.lang}.`,
  };
  const HINT = { name: 'Ich heiße …', age: 'Ich bin … Jahre alt.', country: 'Ich komme aus …', city: 'Ich wohne in …', language: 'Ich spreche …' };
  const nextField = (i) => FIELDS.find((f) => !cardState[i].fields.has(f));
  // Növbəti deyiləcək sətri işıqlandır (addım-addım: Name → Alter → Land → Wohnort → Sprache)
  function updateStep() {
    if (!d.cards) return;
    cardEls.forEach((el, j) => {
      const nf = j === cardIdx && !cardState[j].done ? nextField(j) : null;
      el.querySelectorAll('.lc-fields li').forEach((li) => {
        const on = li.dataset.f === nf;
        li.classList.toggle('now', on);
        let h = li.querySelector('.hint');
        if (on && !h) {
          h = document.createElement('span');
          h.className = 'hint';
          li.appendChild(h);
        }
        if (h) h.textContent = on ? `🎤 ${HINT[li.dataset.f]}` : '';
      });
    });
  }
  // Azərbaycanca sıra şəkilçisi: 1-ci, 3-cü, 6-cı, 9-cu
  const ORD = ['', 'ci', 'ci', 'cü', 'cü', 'ci', 'cı', 'ci', 'ci', 'cu'];
  const ordAz = (n) => `${n}-${ORD[n % 10] || 'cu'}`;
  const nextUndone = (from) => {
    const a = cardState.findIndex((x, j) => j > from && !x.done);
    return a !== -1 ? a : cardState.findIndex((x) => !x.done);
  };
  // Kart bitəndə modelə növbəti kartı dəqiq de (öz başına nömrə uydurmasın)
  function nextCardText(i) {
    const n = nextUndone(i);
    if (n === -1) return 'ALL CARDS ARE COMPLETE. Now say in Azerbaijani that all cards are finished, briefly list the mistakes (wrong → right) and praise the learner.';
    return (
      `CARD ${i + 1} (${d.cards[i].name}) IS COMPLETE. The app now shows card ${n + 1} (${d.cards[n].name}). ` +
      `Say exactly this, ONCE, and nothing else: "Super! İndi ${ordAz(n + 1)} kart: ${d.cards[n].name}." Do not call show_card. Then wait for the learner.`
    );
  }
  function stepInfo() {
    const nf = nextField(cardIdx);
    if (!nf) return 'This card is complete.';
    const c = d.cards[cardIdx];
    return `Next step on the screen: card ${cardIdx + 1} (${c.name}), "${nf}" — expected sentence: "${SENT[nf](c)}".`;
  }
  // Çatda "Super" əvəzinə qəbul olunan düzgün cümləni göstər
  function azureLine() {
    const el = document.createElement('div');
    el.className = 'heardline azure';
    chat.appendChild(el);
    if (last) last.open = false;
    scroll();
    return el;
  }
  // "🎯 Azure eşitdi: … · 72/100" + rəngli söz balları
  function renderAzure(el, r) {
    if (!r || !r.ok) {
      el.textContent = `🎯 Azure: cavab alınmadı — ${r ? r.error : 'naməlum xəta'}`;
      el.classList.add('fail');
      return;
    }
    const chips = r.words
      .map((w) => {
        if (w.error === 'Omission') return `<span class="wchip bad">${esc(w.word)} — deyilmədi</span>`;
        if (w.error === 'Insertion') return `<span class="wchip bad">${esc(w.word)} — artıq</span>`;
        const cls = w.score == null ? '' : w.score >= 80 ? 'good' : w.score >= 60 ? 'mid' : 'bad';
        return `<span class="wchip ${cls}">${esc(w.word)} ${w.score ?? ''}</span>`;
      })
      .join(' ');
    el.innerHTML = `🎯 Azure eşitdi: ${esc(r.text || '—')} · <b>${r.score ?? '?'}/100</b><div class="wchips">${chips}</div>`;
    scroll();
  }

  function verifierNote(text) {
    const el = document.createElement('div');
    el.className = 'heardline verifier';
    el.textContent = text;
    chat.appendChild(el);
    if (last) last.open = false;
    scroll();
    return el;
  }

  // Müqayisə üçün: müəllimin (modelin) səsdən hərfi eşitdiyi — ASR yazısının altında göstərilir
  function heardNote(text) {
    const t = String(text || '').trim();
    if (!t) return;
    const el = document.createElement('div');
    el.className = 'heardline';
    el.textContent = `🧑‍🏫 Müəllim eşitdi: ${t}`;
    chat.appendChild(el);
    if (last) last.open = false;
    scroll();
  }

  function acceptedNote(i, field) {
    const el = document.createElement('div');
    el.className = 'okline';
    el.textContent = `✅ ${SENT[field](d.cards[i])}`;
    chat.appendChild(el);
    if (last) last.open = false;
    scroll();
  }

  function setTick(i, field, kind) {
    const st = cardState[i];
    if (!st || st.done) return;
    const li = cardEls[i].querySelector(`[data-f="${field}"]`);
    if (kind === 'ok') {
      fails[`${i}:${field}`] = 0;
      if (st.fields.has(field) && !li.classList.contains('skip')) return;
      li.classList.remove('skip');
      li.classList.add('ok');
      tickedThisUtter.push({ i, field });
      fx.ding();
      acceptedNote(i, field);
    } else {
      if (st.fields.has(field)) return;
      li.classList.add('skip');
    }
    st.fields.add(field);
    if (st.fields.size === FIELDS.length) completeCard(i);
    updateStep();
  }

  // Eyni cümlədə ard-arda səhv sayı; 3-cü dəfədən sonra ilişib qalmamaq üçün keçirik
  const fails = {};
  const failedUtter = {};
  function noteFail(field) {
    if (!d.cards || !field) return 0;
    const k = `${cardIdx}:${field}`;
    if (failedUtter[k] !== utterId) {
      failedUtter[k] = utterId;
      fails[k] = (fails[k] || 0) + 1;
    }
    if (fails[k] >= 3) {
      setTick(cardIdx, field, 'skip');
      sys('⚠️ Bu cümlə 3 dəfə alınmadı — 📒 dəftərə yazıldı, sonra yenə məşq edərsən. Davam edirik.');
    }
    return fails[k];
  }
  const MOVE_ON =
    'This was already the 3rd try for this sentence, so do NOT ask for it again: say the correct sentence one last time slowly, ' +
    'then say in Azerbaijani "Bunu sonra yenə məşq edərik, davam edək." and wait silently for the next sentence.';

  // Yenidən qoşulanda yeni sessiyaya dəqiq vəziyyəti de ki, çaşmasın
  function cardResumeText() {
    const LBL = { name: 'name', age: 'age', country: 'country', city: 'city', language: 'language' };
    const st = cardState[cardIdx];
    const c = d.cards[cardIdx];
    const done = FIELDS.filter((f) => st.fields.has(f)).map((f) => LBL[f]);
    const missing = FIELDS.filter((f) => !st.fields.has(f)).map((f) => LBL[f]);
    const finished = cardState.map((x, j) => (x.done ? j + 1 : null)).filter(Boolean);
    return (
      '[App] The connection was restarted. You continue the SAME lesson with exactly the same rules and behaviour. ' +
      `Finished cards: ${finished.length ? finished.join(', ') : 'none'}. Current card: ${cardIdx + 1} (${c.name}). ` +
      `Already correct on this card: ${done.length ? done.join(', ') : 'nothing yet'}. Still missing: ${missing.join(', ')}. ` +
      'Do NOT greet, do NOT explain the task again, and do NOT ask the learner for any sentence. ' +
      `Say only in Azerbaijani: "Bağlantı bərpa olundu. ${c.name} kartından davam edirik." Then stay silent and wait for the learner. ` +
      'After each correct sentence say only a very short praise ("Super!", "Gut!") — never tell the learner what to say next.'
    );
  }

  function untick(i, field) {
    const st = cardState[i];
    if (!st || st.done || !st.fields.has(field)) return;
    st.fields.delete(field);
    setTimeout(updateStep, 0);
    cardEls[i].querySelector(`[data-f="${field}"]`).classList.remove('ok');
  }

  function completeCard(i) {
    const st = cardState[i];
    st.done = true;
    const stars = starsFor(st);
    const el = cardEls[i];
    el.classList.add('done', 'flash');
    el.querySelector('.lc-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    const best = store.get('cardStars', {});
    best[d.cards[i].name] = Math.max(best[d.cards[i].name] || 0, stars);
    store.set('cardStars', best);
    fx.win();
    confetti(el);
    updateScore();
    setTimeout(() => {
      el.classList.remove('flash');
      const next = cardState.findIndex((x, j) => j > i && !x.done);
      const anyLeft = next !== -1 ? next : cardState.findIndex((x) => !x.done);
      if (anyLeft === -1) return finishAll();
      if (cardIdx === i) setActive(anyLeft);
    }, 1100);
  }

  function finishAll() {
    const total = cardState.reduce((n, x) => n + starsFor(x), 0);
    confetti(null, 120);
    const ov = document.createElement('div');
    ov.className = 'finish';
    ov.innerHTML = `<div class="finish-box">
      <div class="trophy">🏆</div>
      <h2>Bütün kartlar bitdi!</h2>
      <p class="stars-big">⭐ ${total} / ${d.cards.length * 3}</p>
      <p>${cardState.reduce((n, x) => n + x.mistakes, 0)} səhv düzəldildi</p>
      <a class="btn ghost" href="#/mistakes/${cat.id}">📒 Səhvlərimə bax</a>
      <button class="btn primary big" id="closeFinish">Davam et</button>
    </div>`;
    $app.appendChild(ov);
    ov.querySelector('#closeFinish').addEventListener('click', () => ov.remove());
  }

  if (d.cards) {
    setActive(0);
    cardEls.forEach((el, i) => el.addEventListener('click', () => i !== cardIdx && setActive(i, true)));
  }

  // Səhvi dəftərə yaz + kartı titrət
  function registerMistake(args) {
    mistakeNote(saveMistake(cat, d, args));
    if (d.cards && cardState[cardIdx]) {
      cardState[cardIdx].mistakes++;
      fx.oops();
      cardEls[cardIdx].classList.remove('shake');
      void cardEls[cardIdx].offsetWidth;
      cardEls[cardIdx].classList.add('shake');
      updateScore();
    }
  }

  // Yoxlayıcının tapdığı səhvi (model qeyd etməyibsə) dəftərə yaz
  function appLog(errs) {
    if (modelLoggedUtter === utterId || appLoggedUtter === utterId) return;
    appLoggedUtter = utterId;
    registerMistake({ wrong: errs[0].fullWrong, correct: errs[0].fullCorrect, explanation: errs.map((e) => e.az).join(' ') });
  }

  function rejectionText(errs) {
    return (
      `REJECTED — not ticked. The learner actually said: "${errs[0].fullWrong}". ` +
      `Mistake: ${errs.map((e) => e.en).join('; ')}. Correct sentence: "${errs[0].fullCorrect}". ` +
      'The mistake is already saved, do not call log_mistake. Now speak OUT LOUD to the learner: explain the mistake in Azerbaijani ' +
      `using exactly this content (say it naturally, without any label or prefix, and do not talk about other sentences): ${errs.map((e) => e.az).join(' ')} ` +
      'Then say the correct sentence slowly and ask the learner to repeat the whole sentence. ' +
      'Only call mark_correct after they repeat it correctly.'
    );
  }

  // Müəllimin cavabı bitəndə: buraxılmış səhv varsa, düzəltməsini tələb et
  // ✓ yoxlaması gözləyirsə, cavab-sonu yoxlamasını ona saxla (düzəliş iki dəfə getməsin)
  let pendingMarks = 0;
  let deferredCheck = false;
  function checkAfterTurn() {
    if (pendingMarks) {
      deferredCheck = true;
      return;
    }
    if (verifierPending() || azPending()) {
      deferredCheck = true; // yoxlayıcının / Azure-un cavabını gözlə
      return;
    }
    if (checkedUtter === utterId || !judgeText()) return;
    checkedUtter = utterId;
    const errs = findErrors();
    // Azure səhv tapıb, müəllim isə heç nə deməyibsə — düzəltdir
    if (d.cards && az && azReady(az.field)) {
      const aErr = azErrs(az.field);
      if (aErr.length && modelLoggedUtter !== utterId) {
        for (const t of tickedThisUtter) if (t.field === az.field) untick(t.i, t.field);
        const err = { fullWrong: judgeText() || az.result.text, fullCorrect: az.ref, az: aErr.map((e) => e.az).join(' '), en: aErr.map((e) => e.en).join('; '), field: az.field };
        appLog([err]);
        if (noteFail(az.field) >= 3) {
          session.sendText(`[App] Correct sentence: "${az.ref}". The mistake is already saved, do not call log_mistake. ${MOVE_ON}`);
          return;
        }
        sys('🎯 Azure: tələffüzdə səhv var — müəllim indi düzəldəcək.');
        session.sendText(
          `[App] Pronunciation check: the learner tried to say "${az.ref}" but made a mistake: ${err.en}. ` +
            'The mistake is already saved, do not call log_mistake. Now speak OUT LOUD to the learner: explain the mistake in Azerbaijani ' +
            `using exactly this content (say it naturally, without any label or prefix): ${err.az} ` +
            'Say the correct word slowly twice, then the whole correct sentence, and ask the learner to repeat the whole sentence. Do not call mark_correct until they say it correctly.',
        );
        return;
      }
    }
    const azBlocked = (f) => azErrs(f).length > 0;
    // Model ✓ qoymağı unudubsa: yazıda tam düzgün deyilən cümlələri özümüz ✓ edək
    if (d.cards && modelLoggedUtter !== utterId && !cardState[cardIdx].done) {
      const ci = cardIdx;
      for (const f of matchCardSentence(judgeText(), d.cards[ci])) if (!errs.some((e) => blocks(e, f)) && !azBlocked(f)) setTick(ci, f, 'ok');
      if (cardState[ci].done && !errs.length) {
        session.sendText(`[App] ${nextCardText(ci)}`);
        return;
      }
    }
    if (!errs.length) return;
    for (const t of tickedThisUtter) if (errs.some((e) => blocks(e, t.field))) untick(t.i, t.field);
    if (modelLoggedUtter === utterId) return; // model özü düzəldib
    appLog(errs);
    if (noteFail(errs[0].field || inferField(errs[0].fullCorrect)) >= 3) {
      session.sendText(`[App] The learner said "${errs[0].fullWrong}" (wrong). Correct: "${errs[0].fullCorrect}". The mistake is already saved, do not call log_mistake. ${MOVE_ON}`);
      return;
    }
    sys('🔎 Yoxlama: cümlədə səhv var — müəllim indi düzəldəcək.');
    session.sendText(
      `[App] Grammar check: the learner said "${errs[0].fullWrong}". This is WRONG and you did not correct it: ` +
        `${errs.map((e) => e.en).join('; ')}. Correct sentence: "${errs[0].fullCorrect}". ` +
        'The mistake is already saved, do not call log_mistake. Now speak OUT LOUD to the learner: explain the mistake in Azerbaijani ' +
        `using exactly this content (say it naturally, without any label or prefix, and do not talk about other sentences): ${errs.map((e) => e.az).join(' ')} ` +
        'Say the correct sentence slowly and ask the learner to repeat the whole sentence. ' +
        'Do not call mark_correct for it until they repeat it correctly. Then continue from the same place.',
    );
  }

  function mistakeNote(m) {
    const el = document.createElement('a');
    el.className = 'mnote';
    el.href = `#/mistakes/${cat.id}`;
    el.innerHTML = `📝 Səhv qeyd edildi: <s>${esc(m.wrong)}</s> → <b>${esc(m.correct)}</b>`;
    chat.appendChild(el);
    if (last) last.open = false;
    scroll();
  }

  // Cavab gözləmə qoruyucusu: düymə buraxılandan sonra müəllim susursa, dürt
  let waitTimers = [];
  function stopWaiting() {
    waitTimers.forEach(clearTimeout);
    waitTimers = [];
  }
  function startWaiting() {
    stopWaiting();
    waitTimers.push(setTimeout(() => session && session.sendSilenceAndEnd(1.2), 4000));
    waitTimers.push(
      setTimeout(() => {
        if (!session || !session.ready) return;
        session.sendText('[App] The learner has finished speaking. Respond now to what they just said, following all the rules.');
      }, 8000),
    );
  }

  let micOn = true;
  const idleStatus = () => (ptt ? 'Danışmaq üçün 🎙️ düyməsini basılı saxla' : micOn ? '🎧 Dinləyirəm… danış' : '🔇 Mikrofon bağlıdır');
  function updateMic() {
    micBtn.classList.toggle('off', !ptt && !micOn);
    micBtn.textContent = !ptt && !micOn ? '🔇' : '🎙️';
  }

  startBtn.addEventListener('click', async () => {
    fx.init();
    startBtn.disabled = true;
    setStatus('Qoşulur…');
    chat.innerHTML = '';
    let started = Date.now();
    let practiced = false;

    session = new LiveSession({
      apiKey: s.apiKey,
      model: (!s.modelPicked && store.get('workingModel')) || s.model,
      fallbackModels: MODELS,
      // Bütün dərslərdə almanca + azərbaycanca: yalnız almanca ipucu səhv sonluqları düzəldirdi ("kommet" → "komme")
      transcriptionLanguages: ['de-DE', 'az-AZ'],
      voice: s.voice,
      pushToTalk: ptt,
      systemText: buildSystemPrompt(d, s),
      tools: buildTools(d),
      capture: azureOn,
      onTool(name, args) {
        stopWaiting();
        // Yalnız göstəriş: müəllimin eşitdiyini çatda göstər (məntiq dəyişmir)
        if (name === 'mark_correct') heardNote(args.heard);
        if (name === 'log_mistake') heardNote(args.wrong);
        if (name === 'log_mistake') {
          if (appLoggedUtter === utterId) return 'already saved';
          const heard = judgeText();
          const field = d.cards ? inferField(args.correct) || inferField(heard) : null;
          // Model təkrar "səhv" deyir, amma yazıda cümlə TAM düzgündürsə — qəbul et (ilişib qalmasın)
          if (field && heard && fails[`${cardIdx}:${field}`] >= 1 && matchCardSentence(heard, d.cards[cardIdx]).includes(field) && !findErrors().some((e) => blocks(e, field)) && !azErrs(field).length) {
            const ci = cardIdx;
            setTick(ci, field, 'ok');
            sys('✅ Yoxlama: cümlən düzgün eşidildi — qəbul edildi.');
            if (cardState[ci].done) return `NOT SAVED — this is NOT a mistake, the learner said it correctly. ${nextCardText(ci)}`;
            return (
              `NOT SAVED — this is NOT a mistake. The speech recognition clearly heard the correct sentence "${heard}". ` +
              'The learner said it correctly. Do not correct it again. Say only "Super!" and wait for the next sentence. The line is already ticked.'
            );
          }
          modelLoggedUtter = utterId;
          // Ekrandakı yazı mənalıdırsa onu götür, yoxsa ("40356", gürcü hərfləri) modelin eşitdiyini
          if (heard && plausibleTranscript(heard)) args = { ...args, wrong: heard };
          registerMistake(args);
          if (noteFail(field) >= 3) return `saved. ${MOVE_ON}`;
          return 'saved';
        }
        // Yazı modeldən gec gəlir: qərardan əvvəl qısa gözlə ki, cümlənin yazısı tam çatsın
        if (name === 'mark_correct') {
          pendingMarks++;
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          // Yoxlayıcı işləyirsə onun cavabını gözlə (ən çox 7 san), yoxsa ASR üçün 0.9 san
          // (yoxlayıcı tez uğursuz olsa belə ASR yazısı üçün ən azı 0.9 san gözlə)
          const pend = [sleep(900)];
          if (verifierPending()) pend.push(Promise.race([verif.promise, sleep(7000)]));
          if (azPending()) pend.push(Promise.race([az.promise, sleep(7000)]));
          const wait = Promise.all(pend);
          return wait.then(() => {
            pendingMarks--;
            const r = markField(args.card, args.field, args.pronunciation, args.heard);
            if (deferredCheck && !pendingMarks && !verifierPending() && !azPending()) {
              deferredCheck = false;
              checkAfterTurn();
            }
            return r;
          });
        }
        if (name === 'show_card') {
          // Hansı kartın cari olduğunu tətbiq bilir; model səhv nömrə desə, ekranı dəyişmə
          const want = (parseInt(args.index, 10) || 1) - 1;
          const expected = cardState[cardIdx].done ? nextUndone(cardIdx) : cardIdx;
          if (want !== expected && expected !== -1) {
            return `IGNORED. The current card is card ${expected + 1} (${d.cards[expected].name}). Stay on this card; do not mention any other card.`;
          }
          setActive(want);
          return `showing card ${cardIdx + 1}: ${d.cards[cardIdx].name}`;
        }
        return 'unknown function';
      },
      onEvent(type, data) {
        switch (type) {
          case 'utterance': {
            if (!azureOn) break;
            const field = nextField(cardIdx);
            if (!field) break;
            const a = { pressId, field, ref: SENT[field](d.cards[cardIdx]), done: false, result: null };
            az = a;
            const line = azureLine();
            line.textContent = `🎯 Azure yoxlayır… (${a.ref})`;
            a.promise = assessPronunciation(data, a.ref, s.azureKey, s.azureRegion).then((r) => {
              a.done = true;
              a.result = r;
              renderAzure(line, r);
              if (deferredCheck && !pendingMarks && a.pressId === pressId && !verifierPending()) {
                deferredCheck = false;
                checkAfterTurn();
              }
              return a;
            });
            break;
          }
          case 'modelSkip':
            if (data.model === store.get('workingModel')) store.set('workingModel', null);
            setStatus(`🔄 ${data.next} yoxlanılır…`);
            break;
          case 'reconnecting':
            sys(`⚠️ Bağlantı qopdu (kod ${data.code}). Yenidən qoşulur… (${data.attempt})`);
            setStatus('🔄 Yenidən qoşulur…');
            break;
          case 'ready':
            if (data && data.model) store.set('workingModel', data.model);
            if (data && data.reconnect) {
              setStatus(idleStatus());
              if (data.resumed) {
                sys('✅ Bağlantı bərpa olundu, qaldığımız yerdən davam edirik.');
              } else {
                sys(`✅ Yenidən qoşuldu (${data.model}).`);
                const sendResume = () =>
                  session &&
                  session.sendText(d.cards ? cardResumeText() : '[App] The connection was restarted. Do not repeat the introduction. Briefly say in Azerbaijani that we continue, then continue the lesson from where it stopped, with exactly the same rules and behaviour as before.');
                // ✓ yoxlaması hələ gedirsə, vəziyyəti o bitəndən sonra göndər
                if (pendingMarks) setTimeout(sendResume, 1000);
                else sendResume();
              }
              break;
            }
            sys('ℹ️ Sənin sözlərinin yazısı avtomatikdir, bəzən səhv dildə görünə bilər. Müəllim isə səsini birbaşa eşidir.');
            if (data && data.model) sys(`🤖 Model: ${data.model}`);
            started = Date.now();
            startBtn.hidden = true;
            micBtn.hidden = endBtn.hidden = textForm.hidden = quick.hidden = false;
            updateMic();
            setStatus(idleStatus());
            session.sendText(START_MESSAGE);
            timerId = setInterval(() => {
              const sec = Math.floor((Date.now() - started) / 1000);
              timerEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
              if (sec === 13 * 60) sys('⏳ Sessiya ~15 dəqiqə ilə məhdudlaşır. Tezliklə bitəcək.');
            }, 1000);
            break;
          case 'userText':
            // "<noise>" kimi texniki işarələri göstərmə
            data = data.replace(/<[^>]*>/g, '');
            if (!data.trim() && !(last && last.role === 'user' && last.open)) break;
            if (!practiced) {
              practiced = true;
              const done = store.get('done', {});
              done[d.id] = Date.now();
              store.set('done', done);
            }
            noteUser(data);
            addText('user', data);
            break;
          case 'aiText':
            stopWaiting();
            closeUtter();
            aiTurnText += data;
            if (last && last.role === 'user') last.open = false;
            addText('ai', data);
            break;
          case 'turnComplete':
            stopWaiting();
            if (last) last.open = false;
            closeUtter();
            if (data && data.audio === 0 && aiTurnText.trim()) sys('🔇 Bu cavabın səsi serverdən gəlmədi.');
            checkAfterTurn();
            break;
          case 'speaking':
            if (data) stopWaiting();
            setStatus(data ? '🗣️ Müəllim danışır…' : idleStatus());
            break;
          case 'level':
            levelEl.style.width = `${Math.round(data * 100)}%`;
            break;
          case 'goaway':
            sys('⏳ Sessiya tezliklə bitəcək.');
            break;
          case 'close':
            clearInterval(timerId);
            sys(closeMessage(data));
            setStatus('Bağlantı bitdi');
            micBtn.hidden = endBtn.hidden = textForm.hidden = quick.hidden = true;
            startBtn.hidden = false;
            startBtn.disabled = false;
            startBtn.textContent = '🔄 Yenidən başla';
            if (session) session.cleanup();
            break;
        }
      },
    });

    try {
      await session.start();
    } catch (e) {
      console.error(e);
      sys(
        e && e.name === 'NotAllowedError'
          ? '🎙️ Mikrofon icazəsi verilmədi. Brauzer ayarlarından icazə ver.'
          : `Xəta: ${e.message || e}`,
      );
      teardown();
      startBtn.disabled = false;
      setStatus('Hazır');
    }
  });

  // Mikrofon düyməsi
  if (ptt) {
    const down = (e) => {
      e.preventDefault();
      micBtn.classList.add('hold');
      clearTimeout(releaseTimer);
      stopWaiting();
      closeUtter();
      pressId++;
      // yeni cümlə: yazı gəlməsə də, yoxlamalar yeni cümləyə aid olsun
      userUtter = '';
      utterId++;
      aiTurnText = '';
      tickedThisUtter = [];
      utterClosed = false;
      if (last && last.role === 'user') last.open = false;
      session && session.setSending(true);
      setStatus('🔴 Danış… (buraxanda göndərilir)');
    };
    let releaseTimer = null;
    const up = () => {
      if (!micBtn.classList.contains('hold')) return;
      micBtn.classList.remove('hold');
      setStatus('⏳ Cavab gözlənilir…');
      // Son söz kəsilməsin deyə düyməni buraxandan sonra bir az da dinlə
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => {
        if (!session) return;
        session.setSending(false);
        startWaiting();
      }, 450);
    };
    micBtn.addEventListener('pointerdown', down);
    micBtn.addEventListener('pointerup', up);
    micBtn.addEventListener('pointerleave', up);
    micBtn.addEventListener('pointercancel', up);
    micBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  } else {
    micBtn.addEventListener('click', () => {
      micOn = !micOn;
      session && session.setSending(micOn);
      updateMic();
      setStatus(idleStatus());
    });
  }

  endBtn.addEventListener('click', () => {
    if (session) session.sendText('Bitte beende jetzt das Rollenspiel und gib mir kurzes Feedback.');
  });

  textForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $app.querySelector('#textIn');
    const t = inp.value.trim();
    if (!t || !session) return;
    if (last) last.open = false;
    addText('user', t);
    last.open = false;
    noteUser(t, true);
    session.sendText(t);
    inp.value = '';
  });

  $app.querySelector('#soundTest').addEventListener('click', () => {
    if (session) session.testTone();
    sys('🔊 Siqnal çaldı. Eşitmədinsə: telefonun yan düyməsi ilə səsi artır (musiqi/media səsi) və səssiz rejimi söndür.');
  });
  quick.querySelectorAll('button[data-q]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!session) return;
      if (last) last.open = false;
      addText('user', b.textContent);
      last.open = false;
      closeUtter();
      session.sendText(b.dataset.q);
    }),
  );
}

// Mətn əsasən latın hərflərindədirmi (almanca / azərbaycanca)?
function looksLatin(text) {
  const letters = text.match(/\p{L}/gu) || [];
  if (!letters.length) return false;
  const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  return latin / letters.length >= 0.8;
}

// Kart dərsinin lüğəti: kart faktları + nümunə cümlələr + lüğət bölməsi
function buildCardLexicon(d) {
  const fw = {
    name: ['heiße', 'heisse', 'heißen', 'heißt', 'Name'],
    age: ['bin', 'Jahre', 'Jahr', 'alt'],
    country: ['komme', 'aus', 'der', 'den'],
    city: ['wohne', 'in'],
    language: ['spreche'],
  };
  for (const c of d.cards) {
    fw.name.push(c.name);
    fw.age.push(c.ageDe);
    fw.country.push(c.land);
    fw.city.push(c.city);
    fw.language.push(c.lang);
  }
  const extra = [...d.lines.map((l) => l[1]), ...d.vocab.map((v) => v[0])];
  return buildLexicon(extra, fw);
}

function closeMessage({ code, reason }) {
  const r = reason ? ` (${reason})` : '';
  if (code === 1000) return 'Sessiya bitdi. Əla iş! 👏';
  if (code === 1008) return `❌ API açarı və ya model adı qəbul olunmadı${r}. Ayarları yoxla.`;
  if (code === 1011) return `⚠️ Server xətası${r}. Yenidən cəhd et və ya ayarlarda başqa model seç.`;
  if (code === 1007) return `❌ Sorğu səhvdir${r}. Ayarlarda başqa model seç.`;
  return `Bağlantı kəsildi (kod ${code})${r}.`;
}

// ---------- Başlanğıc ----------
if ('speechSynthesis' in window) speechSynthesis.getVoices();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
route();
