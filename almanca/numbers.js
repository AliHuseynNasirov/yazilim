// Rəqəm dinləmə məşqi: tətbiq rəqəmi almanca deyir, şagird rəqəmlə yazır.
// Səs brauzerin öz almanca səsi ilə (pulsuzdur, internet/açar lazım deyil).
// app.js yalnız renderNumbers(ctx) çağırır — başqa dərslərə toxunmur.

import { germanNumber, numberHint, isSwapped, RANGES, makeRound } from './numbers-core.js';

const COUNTS = [20, 50, 100];
const TEMPOS = [1, 2, 3, 5]; // rəqəm deyildikdən sonra yazmaq üçün saniyə
const DEFAULTS = { range: 'mid', count: 100, tempo: 2 };

export function renderNumbers(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake } = ctx;
  const CFG = 'numbersCfg';
  let cfg = { ...DEFAULTS, ...store.get(CFG, {}) };
  if (!RANGES[cfg.range]) cfg.range = DEFAULTS.range;
  if (!COUNTS.includes(cfg.count)) cfg.count = DEFAULTS.count;
  if (!TEMPOS.includes(cfg.tempo)) cfg.tempo = DEFAULTS.tempo;

  let root = null;
  const alive = () => root && document.body.contains(root);
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (alive()) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const clearTimers = () => {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  };

  let speakSeq = 0;
  function speak(text, onDone) {
    const seq = ++speakSeq;
    let fired = false;
    const done = () => {
      if (fired || seq !== speakSeq) return;
      fired = true;
      if (onDone && alive()) onDone();
    };
    if (!('speechSynthesis' in window)) {
      later(done, 300);
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.rate = 0.9;
    const de = speechSynthesis.getVoices().find((v) => v.lang && v.lang.replace('_', '-').startsWith('de'));
    if (de) u.voice = de;
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
    // bəzi telefonlarda "onend" gəlmir — ehtiyat
    later(done, 3500);
  }

  // ---------- Başlanğıc ekranı (ayarlar) ----------
  function renderStart() {
    clearTimers();
    const chips = (name, items, label) =>
      items.map((v) => `<button class="chip-btn ${cfg[name] === v ? 'active' : ''}" data-set="${name}" data-v="${v}">${label(v)}</button>`).join('');
    $app.innerHTML = `
      ${header(`🎧 ${esc(d.title)}`, `#/d/${d.id}`)}
      <main class="nm">
        <div class="hero">
          <p>Tətbiq rəqəmi <b>almanca deyəcək</b>, sən onu <b>rəqəmlə yaz</b> (məs. <i>siebenundvierzig</i> → <b>47</b>).
          Düzgün → yaşıl, səhv → qırmızı. Sonra dərhal növbəti rəqəm gəlir.</p>
          <p class="small muted">Telefonun səsini aç. Rəqəmlər təsadüfi gəlir.</p>
        </div>
        <h3>Rəqəmlər</h3>
        <div class="filters">${chips('range', Object.keys(RANGES), (k) => RANGES[k].label)}</div>
        <h3>Neçə rəqəm</h3>
        <div class="filters">${chips('count', COUNTS, (n) => n)}</div>
        <h3>Yazmaq üçün vaxt</h3>
        <div class="filters">${chips('tempo', TEMPOS, (n) => `${n} san`)}</div>
        <div class="sticky-cta">
          <button class="btn primary big" id="nmStart">▶ Başla</button>
        </div>
      </main>`;
    root = $app.querySelector('main');
    $app.querySelectorAll('[data-set]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.set;
        cfg[k] = k === 'range' ? b.dataset.v : Number(b.dataset.v);
        store.set(CFG, cfg);
        renderStart();
      }),
    );
    $app.querySelector('#nmStart').addEventListener('click', () => startGame(makeRound(cfg.count, RANGES[cfg.range])));
  }

  // ---------- Oyun ----------
  function startGame(list) {
    clearTimers();
    fx.init();
    const results = []; // { n, got, ok }
    let idx = -1;
    let state = 'idle'; // listen | wait | fb | paused | idle
    let windowStarted = false;

    $app.innerHTML = `
      ${header(`🎧 ${esc(d.title)}`, `#/d/${d.id}`)}
      <main class="nm">
        <div class="sc-top">
          <span><b id="nmPos">1</b> / ${list.length}</span>
          <span class="sc-score" id="nmScore">✅ 0 · ❌ 0</span>
        </div>
        <div class="progress"><span id="nmBar" style="width:0%"></span></div>
        <div class="nm-card" id="nmCard">
          <div class="nm-ear" id="nmEar">🔊</div>
          <input id="nmIn" class="nm-in" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="next" aria-label="Rəqəmi yaz" />
          <div class="nm-timer"><span id="nmTime"></span></div>
          <div class="nm-fb" id="nmFb">Dinlə və yaz…</div>
        </div>
        <div class="nm-ctrl">
          <button class="btn ghost" id="nmAgain">🔁 Yenidən dinlə</button>
          <button class="btn ghost" id="nmPause">⏸ Fasilə</button>
        </div>
      </main>`;
    root = $app.querySelector('main');
    const $in = root.querySelector('#nmIn');
    const $fb = root.querySelector('#nmFb');
    const $card = root.querySelector('#nmCard');
    const $time = root.querySelector('#nmTime');
    const $ear = root.querySelector('#nmEar');
    const $pause = root.querySelector('#nmPause');

    const cur = () => list[idx];
    const updateTop = () => {
      const ok = results.filter((r) => r.ok).length;
      root.querySelector('#nmPos').textContent = Math.min(idx + 1, list.length);
      root.querySelector('#nmScore').textContent = `✅ ${ok} · ❌ ${results.length - ok}`;
      root.querySelector('#nmBar').style.width = `${(results.length / list.length) * 100}%`;
    };

    function play() {
      clearTimers();
      state = 'listen';
      windowStarted = false;
      $card.className = 'nm-card listening';
      $time.style.transition = 'none';
      $time.style.width = '100%';
      speak(String(cur()), startWindow);
    }

    function startWindow() {
      if (state !== 'listen' || windowStarted) return;
      windowStarted = true;
      state = 'wait';
      $card.className = 'nm-card waiting';
      // zaman zolağı
      void $time.offsetWidth;
      $time.style.transition = `width ${cfg.tempo}s linear`;
      $time.style.width = '0%';
      later(() => judge($in.value), cfg.tempo * 1000);
    }

    function next() {
      idx++;
      if (idx >= list.length) return renderEnd(list, results);
      $in.value = '';
      $fb.textContent = 'Dinlə və yaz…';
      updateTop();
      play();
    }

    function judge(v) {
      if (state !== 'listen' && state !== 'wait') return;
      clearTimers();
      speakSeq++; // gecikmiş "onend" pəncərəni açmasın
      state = 'fb';
      const n = cur();
      const ok = v === String(n);
      results.push({ n, got: v, ok });
      updateTop();
      $time.style.transition = 'none';
      $time.style.width = '0%';
      if (ok) {
        fx.ding();
        $card.className = 'nm-card ok';
        $fb.innerHTML = `✅ <b>${n}</b> — ${esc(germanNumber(n))}`;
        later(next, 700);
      } else {
        fx.oops();
        $card.className = 'nm-card bad';
        const gotTxt = v ? `<s>${esc(v)}</s> yox → ` : 'Yazmağa çatmadın → ';
        const hint = isSwapped(v, n) ? `<div class="small">Yerlərini qarışdırdın! ${esc(numberHint(n))}</div>` : '';
        $fb.innerHTML = `❌ ${gotTxt}<b>${n}</b> — ${esc(germanNumber(n))}${hint}`;
        saveMistake(cat, d, {
          wrong: v || '(yazılmadı)',
          correct: `${n} — ${germanNumber(n)}`,
          explanation: numberHint(n) || `${n} almanca: ${germanNumber(n)}`,
        });
        later(next, hint ? 2600 : 1900);
      }
    }

    $in.addEventListener('input', () => {
      const clean = $in.value.replace(/\D/g, '');
      if (clean !== $in.value) $in.value = clean;
      if (state !== 'listen' && state !== 'wait') return;
      if (clean.length >= String(cur()).length) judge(clean);
    });
    $in.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (state === 'listen' || state === 'wait') && $in.value) judge($in.value);
    });
    root.querySelector('#nmAgain').addEventListener('click', () => {
      if (state === 'listen' || state === 'wait') play();
      $in.focus();
    });
    $pause.addEventListener('click', () => {
      if (state === 'paused') {
        $pause.textContent = '⏸ Fasilə';
        $in.value = '';
        play();
        $in.focus();
        return;
      }
      if (state === 'fb') return; // rəy göstərilərkən gözlə
      clearTimers();
      speakSeq++;
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      state = 'paused';
      $card.className = 'nm-card';
      $fb.textContent = '⏸ Fasilə. Davam etmək üçün ▶ bas.';
      $pause.textContent = '▶ Davam';
    });
    $ear.addEventListener('click', () => {
      if (state === 'listen' || state === 'wait') play();
    });

    $in.focus();
    next();
  }

  // ---------- Nəticə ----------
  function renderEnd(list, results) {
    clearTimers();
    const ok = results.filter((r) => r.ok).length;
    const wrong = results.filter((r) => !r.ok);
    const done = store.get('done', {});
    done[d.id] = done[d.id] || Date.now();
    store.set('done', done);
    const uniqWrong = [...new Set(wrong.map((r) => r.n))];
    $app.innerHTML = `
      ${header(`🎧 ${esc(d.title)}`, `#/d/${d.id}`)}
      <main class="nm">
        <div class="hero nm-end">
          <h2>🎉 Bitdi!</h2>
          <p>Düzgün: <b>${ok} / ${results.length}</b></p>
          ${wrong.length ? `<p class="small">Səhv etdiklərin (🔊 bas, dinlə):</p>
            <div class="nm-wrong">${wrong.map((r) => `
              <button class="word" data-say="${r.n}"><b>${r.n}</b><span>${esc(germanNumber(r.n))}${r.got ? ` · sən: ${esc(r.got)}` : ''}</span></button>`).join('')}
            </div>` : '<p>Hamısı düzgün! 👏</p>'}
        </div>
        <div class="sticky-cta nm-endcta">
          ${uniqWrong.length ? `<button class="btn ghost" id="nmRetry">🔁 Səhvləri təkrar et (${uniqWrong.length})</button>` : ''}
          <button class="btn primary big" id="nmNew">🔄 Yeni tur</button>
          <button class="btn ghost" id="nmCfg">⚙️ Ayarlar</button>
        </div>
      </main>`;
    root = $app.querySelector('main');
    fx.win();
    if (ok === results.length) confetti(root.querySelector('.nm-end'));
    root.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => speak(b.dataset.say)));
    root.querySelector('#nmRetry')?.addEventListener('click', () => {
      // hər səhv rəqəm 2 dəfə, qarışıq
      const again = makeRound(uniqWrong.length * 2, { min: 0, max: uniqWrong.length - 1 }).map((i) => uniqWrong[i]);
      startGame(again);
    });
    root.querySelector('#nmNew').addEventListener('click', () => startGame(makeRound(cfg.count, RANGES[cfg.range])));
    root.querySelector('#nmCfg').addEventListener('click', renderStart);
  }

  renderStart();
}
