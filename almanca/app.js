import { CATEGORIES, findCategory, findDialog } from './data.js';
import { LiveSession } from './live.js';
import { buildSystemPrompt, START_MESSAGE } from './prompt.js';

const $app = document.getElementById('app');

const MODELS = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-latest',
  'gemini-2.5-flash-native-audio-preview-09-2025',
];
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
const settings = () => ({ ...DEFAULTS, ...store.get('settings', {}) });

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
  renderHome();
}
window.addEventListener('hashchange', route);

function header(title, back) {
  return `<header class="top">
    ${back ? `<a class="icon-btn" href="${back}" aria-label="Geri">‹</a>` : ''}
    <h1>${title}</h1>
    <a class="icon-btn" href="#/settings" aria-label="Ayarlar">⚙️</a>
  </header>`;
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
      <nav class="tabs">
        ${d.phases ? '<button data-tab="plan">Plan</button>' : ''}
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
      voice: $app.querySelector('#voice').value,
      explainLang: $app.querySelector('#explainLang').value,
      mode: $app.querySelector('#mode').value,
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
  const { dialog: d } = found;
  const s = settings();
  const ptt = s.mode === 'ptt';

  $app.innerHTML = `
    ${header(`🎙️ ${esc(d.title)}`, `#/d/${d.id}`)}
    <main class="practice">
      <details class="rule-mini">
        <summary>📘 ${d.phases ? 'Plan və qayda' : esc(d.rule.title)}</summary>
        <div class="rule">${planHtml(d)}${ruleHtml(d.rule)}</div>
      </details>
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
  const setStatus = (t) => (statusEl.textContent = t);
  const scroll = () => (chat.scrollTop = chat.scrollHeight);

  function addText(role, text) {
    if (!last || last.role !== role || !last.open) {
      const el = document.createElement('div');
      el.className = `msg ${role}`;
      chat.appendChild(el);
      last = { role, el, open: true };
    }
    last.el.textContent += text;
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

  let micOn = true;
  const idleStatus = () => (ptt ? 'Danışmaq üçün 🎙️ düyməsini basılı saxla' : micOn ? '🎧 Dinləyirəm… danış' : '🔇 Mikrofon bağlıdır');
  function updateMic() {
    micBtn.classList.toggle('off', !ptt && !micOn);
    micBtn.textContent = !ptt && !micOn ? '🔇' : '🎙️';
  }

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    setStatus('Qoşulur…');
    chat.innerHTML = '';
    let started = Date.now();
    let practiced = false;

    session = new LiveSession({
      apiKey: s.apiKey,
      model: s.model,
      voice: s.voice,
      pushToTalk: ptt,
      systemText: buildSystemPrompt(d, s),
      onEvent(type, data) {
        switch (type) {
          case 'ready':
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
            if (!practiced) {
              practiced = true;
              const done = store.get('done', {});
              done[d.id] = Date.now();
              store.set('done', done);
            }
            addText('user', data);
            break;
          case 'aiText':
            if (last && last.role === 'user') last.open = false;
            addText('ai', data);
            break;
          case 'turnComplete':
            if (last) last.open = false;
            break;
          case 'speaking':
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
      session && session.setSending(true);
      setStatus('🔴 Danış… (buraxanda göndərilir)');
    };
    const up = () => {
      if (!micBtn.classList.contains('hold')) return;
      micBtn.classList.remove('hold');
      session && session.setSending(false);
      setStatus('⏳ Cavab gözlənilir…');
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
    session.sendText(t);
    inp.value = '';
  });

  quick.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      if (!session) return;
      if (last) last.open = false;
      addText('user', b.textContent);
      last.open = false;
      session.sendText(b.dataset.q);
    }),
  );
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
