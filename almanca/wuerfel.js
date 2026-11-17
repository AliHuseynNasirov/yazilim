// "Würfeln und konjugieren" — lövhə oyunu (sən və müəllim, növbə ilə). app.js yalnız renderWuerfel(ctx) çağırır.
//
// Hər növbədə 2 zər atılır: 1-ci zər şəxsi seçir (1 = ich … 6 = sie/Sie), 2-ci zər neçə xana irəli getməyi.
// Düşdüyün xanadakı feli həmin şəxslə yaz ("wir wohnen"). Düz → qalırsan, səhv → köhnə xanaya qayıdırsan.
// Qırmızı xanalar: 5 Joker (feli özün seç), 10 bir daha zər at, 15 bir növbə buraxırsan.
// Müəllimin növbəsində müəllim yazır, sən düz/səhv olduğunu yoxlayırsan. ZIEL-ə birinci çatan qalib gəlir.

import { VERBS, BOARD, GOAL, PERSONS, SHEET_VERBS, verbAt, pickVerbs, kindOf, formOf, answerOf, checkAnswer, explain, wrongForm, rollDie, moveTo } from './wuerfel-core.js';

const WHO = { L: { name: 'Sən', tok: '🔵' }, T: { name: 'Müəllim', tok: '🔴' } };
const OTHER = { L: 'T', T: 'L' };
const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const TEACHER_ERR = 0.3; // müəllim bəzən bilərəkdən səhv edir — sən tutmalısan

function speakDe(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.rate = 0.9;
  const de = speechSynthesis.getVoices().find((v) => v.lang && v.lang.replace('_', '-').startsWith('de'));
  if (de) u.voice = de;
  speechSynthesis.speak(u);
}

// Lövhə: 6×6 şəbəkədə xananın yeri (sətir, sütun)
function cellPos(i) {
  if (i === 0 || i === GOAL) return [1, 1];
  if (i <= 5) return [1, i + 1];
  if (i <= 9) return [i - 4, 6];
  if (i <= 15) return [6, 16 - i];
  return [21 - i, 1];
}

export function renderWuerfel(ctx) {
  const { $app, d, cat, store, esc, header, fx, confetti, saveMistake } = ctx;
  const KEY = `wuerfel.${d.id}`;
  // Hər yeni oyunda lövhəyə kitabın A1.1 fellərindən 16 yeni fel düşür (az oynananlar əvvəl)
  const fresh = () => {
    const turn = Math.random() < 0.5 ? 'L' : 'T';
    const used = store.get('wuerfelUsed', {});
    const verbs = pickVerbs(used);
    verbs.forEach((v) => (used[v] = (used[v] || 0) + 1));
    store.set('wuerfelUsed', used);
    return { v: 1, verbs, pos: { L: 0, T: 0 }, turn, skip: { L: false, T: false }, phase: 'roll', cur: null, stats: { ok: 0, bad: 0, judgeOk: 0, judgeBad: 0 }, winner: null, starter: turn, started: false };
  };
  let st = store.get(KEY, null);
  if (!st || st.v !== 1 || !st.pos) st = fresh();
  if (!Array.isArray(st.verbs) || st.verbs.length !== 16 || !st.verbs.every((v) => VERBS[v])) st.verbs = [...SHEET_VERBS]; // köhnə oyun
  const boardVerbs = () => [...new Set(st.verbs)];
  const save = () => store.set(KEY, st);

  let root = null;
  const alive = () => root && document.body.contains(root);
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (alive()) fn();
    }, ms);
    timers.add(id);
  };
  let anim = false; // zər / hərəkət animasiyası gedir

  // ---------- ekran ----------
  function boardHtml(showPos) {
    const pos = showPos || st.pos;
    const cells = BOARD.map((c, i) => {
      const [r, col] = cellPos(i);
      const toks = ['L', 'T'].filter((w) => pos[w] === i || (i === 0 && pos[w] >= GOAL)).map((w) => `<span class="wf-tok">${WHO[w].tok}</span>`).join('');
      const curCell = st.cur && st.cur.to === i && !anim ? 'now' : '';
      let inner;
      if (c.t === 'start') inner = '<b class="wf-start">START</b><b class="wf-goal">ZIEL</b>';
      else if (c.t === 'verb') {
        const v = verbAt(st.verbs, i);
        inner = `<b class="${v.length > 11 ? 'xl' : v.length > 9 ? 'l' : ''}">${esc(v)}</b>`;
      }
      else if (c.t === 'joker') inner = '<b class="red">Joker!</b><small>Feli seç</small>';
      else if (c.t === 'again') inner = '<b class="red">Noch einmal</b><small>yenə at</small>';
      else inner = '<b class="red">Pause</b><small>1 növbə</small>';
      return `<div class="wf-cell ${c.t} ${curCell}" style="grid-row:${r};grid-column:${col}">${i && i < GOAL ? `<i>${i}</i>` : ''}${inner}<div class="wf-toks">${toks}</div></div>`;
    }).join('');
    const c = st.cur;
    const dice = c ? `<div class="wf-dice"><span class="wf-die" id="wfD1">${PIPS[c.die1]}</span><span class="wf-die" id="wfD2">${PIPS[c.die2]}</span></div>` : '<div class="wf-dice"><span class="wf-die">🎲</span><span class="wf-die">🎲</span></div>';
    return `<div class="wf-board" lang="de">
      ${cells}
      <div class="wf-center">
        <div class="wf-title">Würfeln und konjugieren</div>
        ${dice}
        <div class="wf-legend">${PERSONS.map((p) => `<span>${PIPS[p.die]} ${esc(p.label)}</span>`).join('')}</div>
      </div>
    </div>`;
  }

  function scoreHtml() {
    const s = st.stats;
    return `<div class="wf-score">
      <span class="${st.turn === 'L' && !st.winner ? 'on' : ''}">🔵 Sən: <b>${Math.min(st.pos.L, GOAL)}</b>/${GOAL} · ✅ ${s.ok} ❌ ${s.bad}</span>
      <span class="${st.turn === 'T' && !st.winner ? 'on' : ''}">🔴 Müəllim: <b>${Math.min(st.pos.T, GOAL)}</b>/${GOAL}</span>
    </div>`;
  }

  function promptOf(c) {
    const P = PERSONS[c.die1 - 1];
    const kind = { irr: '<span class="wf-kind irr">qaydasız</span>', sep: '<span class="wf-kind sep">ayrılan fel</span>', reg: '' }[kindOf(c.verb)];
    return `<div class="wf-task"><span class="wf-pill">${PIPS[c.die1]} ${esc(P.label)}</span> + <span class="wf-pill verb">${esc(c.verb)}</span> <small>(${esc(VERBS[c.verb].az)})</small> ${kind}</div>`;
  }

  function panelHtml() {
    const c = st.cur;
    const me = st.turn === 'L';
    if (st.phase === 'over') {
      const won = st.winner === 'L';
      return `<div class="wf-panel ${won ? 'ok' : ''}">
        <h2>${won ? '🏆 Qalib gəldin!' : '🔴 Müəllim qalib gəldi'}</h2>
        <p>Düzgün yazdığın: <b>${st.stats.ok}</b> · səhv: <b>${st.stats.bad}</b> · müəllimin cavablarını düz yoxladın: <b>${st.stats.judgeOk}/${st.stats.judgeOk + st.stats.judgeBad}</b></p>
        <button class="btn primary big" id="wfNew">🔄 Yeni oyun</button>
      </div>`;
    }
    if (!st.started) {
      return `<div class="wf-panel">
        <p>🎲 Püşk atıldı: <b>${st.starter === 'L' ? 'sən başlayırsan' : 'müəllim başlayır'}</b>.</p>
        <p class="small muted">1-ci zər şəxsi, 2-ci zər neçə xana getməyi göstərir. Düşdüyün xanadakı feli şəxslə yaz: məs. <i>wir wohnen</i>.</p>
        <p class="small">Bu oyunun felləri (kitabın A1.1 hissəsindən): ${(() => {
          const k = { reg: 0, irr: 0, sep: 0 };
          boardVerbs().forEach((v) => k[kindOf(v)]++);
          return `<b>${k.reg}</b> qaydalı, <b>${k.irr}</b> qaydasız, <b>${k.sep}</b> ayrılan`;
        })()}. Hər yeni oyunda fellər dəyişir.</p>
        <button class="btn primary big" id="wfGo">▶ Başla</button>
      </div>`;
    }
    const turnLbl = `<div class="wf-turn ${me ? 'me' : 'them'}">${me ? '🔵 Sənin növbən' : '🔴 Müəllimin növbəsi'}</div>`;
    if (st.phase === 'roll') {
      return `<div class="wf-panel">${turnLbl}
        ${st.msg ? `<p class="wf-msg">${st.msg}</p>` : ''}
        ${me ? '<button class="btn primary big" id="wfRoll">🎲🎲 Zərləri at</button>' : '<p class="muted">Müəllim zər atır…</p>'}
      </div>`;
    }
    if (st.phase === 'joker') {
      return `<div class="wf-panel">${turnLbl}
        <p>🃏 <b>Joker!</b> Şəxs: <b>${esc(PERSONS[c.die1 - 1].label)}</b>. ${me ? 'İstədiyin feli seç:' : 'Müəllim fel seçir…'}</p>
        ${me ? `<div class="wf-verbs">${boardVerbs().map((v) => `<button class="chip-btn" data-verb="${v}">${esc(v)}</button>`).join('')}</div>` : ''}
      </div>`;
    }
    if (st.phase === 'answer') {
      return `<div class="wf-panel">${turnLbl}${promptOf(c)}
        <p class="small muted">Şəxs + feli yaz (məs. <i>${esc(PERSONS[c.die1 - 1].ok[0])} …</i>). İstəsən bütöv cümlə də yaza bilərsən.</p>
        <form id="wfForm" class="wf-form"><input id="wfIn" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${esc(PERSONS[c.die1 - 1].ok[0])} …"><button class="btn primary">Yoxla</button></form>
      </div>`;
    }
    if (st.phase === 'judge') {
      return `<div class="wf-panel">${turnLbl}${promptOf(c)}
        <p>🧑‍🏫 Müəllim yazdı: <b class="wf-ans">${esc(c.said)}</b></p>
        <p class="small muted">Sən yoxla: düzdür, yoxsa səhv?</p>
        <div class="k-two"><button class="btn" id="wfJudgeOk">✅ Düzdür</button><button class="btn" id="wfJudgeBad">❌ Səhvdir</button></div>
      </div>`;
    }
    if (st.phase === 'result') {
      return `<div class="wf-panel ${c.ok ? 'ok' : 'bad'}">${turnLbl}${promptOf(c)}${st.msg}
        <button class="btn primary big" id="wfNext">Növbəti ›</button>
      </div>`;
    }
    return '';
  }

  function render(showPos) {
    $app.innerHTML = `
      ${header(esc(d.title), `#/d/${d.id}`)}
      <main class="wf">
        ${scoreHtml()}
        ${boardHtml(showPos)}
        ${anim ? '<div class="wf-panel"><p class="muted">🎲 …</p></div>' : panelHtml()}
        <details class="rule-mini"><summary>📘 Oyunun qaydaları</summary><div class="rule">
          <p>1. Növbə ilə oynayırsınız. Hər növbədə <b>2 zər</b> atılır.</p>
          <p>2. <b>1-ci zər</b> şəxsi seçir: 1 = ich, 2 = du, 3 = er/sie/es, 4 = wir, 5 = ihr, 6 = sie/Sie. <b>2-ci zər</b> — neçə xana irəli gedirsən.</p>
          <p>3. Düşdüyün xanadakı feli həmin şəxslə yaz: məs. 4 + wohnen → <i>wir wohnen</i>.</p>
          <p>4. Düzdür → orada qalırsan. Səhvdir → köhnə xanaya qayıdırsan.</p>
          <p>5. Qırmızı xanalar: <b>Joker</b> — feli özün seçirsən · <b>Noch einmal</b> — bir daha zər at · <b>Pause</b> — növbəti dəfə növbəni buraxırsan.</p>
          <p>6. Müəllimin növbəsində müəllim yazır, <b>sən yoxlayırsan</b>: düzdür, yoxsa səhv?</p>
          <p>7. <b>ZIEL</b>-ə birinci çatan qalib gəlir.</p>
        </div></details>
        ${st.started && st.phase !== 'over' ? '<button class="btn ghost wf-restart" id="wfRestart">🔄 Yenidən başla</button>' : ''}
      </main>`;
    root = $app.querySelector('main');
    bind();
  }

  function bind() {
    const on = (sel, ev, fn) => {
      const el = $app.querySelector(sel);
      if (el) el.addEventListener(ev, fn);
    };
    on('#wfGo', 'click', () => {
      fx.init();
      st.started = true;
      save();
      startTurn();
    });
    on('#wfNew', 'click', () => {
      st = fresh();
      save();
      render();
    });
    on('#wfRestart', 'click', () => {
      if (!confirm('Oyun əvvəldən başlasın?')) return;
      st = fresh();
      save();
      render();
    });
    on('#wfRoll', 'click', () => {
      fx.init();
      roll();
    });
    on('#wfNext', 'click', nextTurn);
    on('#wfJudgeOk', 'click', () => judge(true));
    on('#wfJudgeBad', 'click', () => judge(false));
    $app.querySelectorAll('[data-verb]').forEach((b) =>
      b.addEventListener('click', () => {
        st.cur.verb = b.dataset.verb;
        st.phase = 'answer';
        save();
        render();
      }),
    );
    const form = $app.querySelector('#wfForm');
    if (form) {
      const inp = $app.querySelector('#wfIn');
      inp.focus();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (inp.value.trim()) answer(inp.value);
      });
    }
    const panel = $app.querySelector('.wf-panel');
    if (panel && panel.scrollIntoView && st.started) panel.scrollIntoView({ block: 'nearest' });
  }

  // ---------- oyunun gedişi ----------
  function startTurn() {
    if (st.phase === 'over') return render();
    const w = st.turn;
    if (st.skip[w]) {
      st.skip[w] = false;
      st.msg = `⏸ ${w === 'L' ? 'Sən bu növbəni buraxırsan (Pause).' : 'Müəllim bu növbəni buraxır (Pause).'}`;
      st.turn = OTHER[w];
      st.phase = 'roll';
      save();
      render();
      if (st.turn === 'T') later(roll, 1600);
      return;
    }
    st.phase = 'roll';
    save();
    render();
    if (w === 'T') later(roll, 1100);
  }

  function roll() {
    if (st.phase !== 'roll' || anim) return;
    const w = st.turn;
    const die1 = rollDie();
    const die2 = rollDie();
    const from = st.pos[w];
    const to = moveTo(from, die2);
    st.cur = { who: w, die1, die2, from, to, verb: null, said: '', ok: null };
    st.msg = '';
    // nəticəni dərhal yadda saxla (animasiya zamanı çıxsan da itməsin)
    st.pos[w] = to;
    land(true);
    save();
    // animasiya: zərlər fırlanır, sonra fiqur addım-addım gedir
    anim = true;
    const show = { ...st.pos, [w]: from };
    render(show);
    let k = 0;
    const spin = () => {
      if (!alive()) return;
      const d1 = $app.querySelector('#wfD1');
      const d2 = $app.querySelector('#wfD2');
      if (k++ < 8) {
        if (d1) d1.textContent = PIPS[rollDie()];
        if (d2) d2.textContent = PIPS[rollDie()];
        later(spin, 70);
      } else {
        if (d1) d1.textContent = PIPS[die1];
        if (d2) d2.textContent = PIPS[die2];
        step(from);
      }
    };
    const step = (p) => {
      if (p >= to) {
        anim = false;
        afterLand();
        return;
      }
      show[w] = p + 1;
      render(show);
      const d1 = $app.querySelector('#wfD1');
      const d2 = $app.querySelector('#wfD2');
      if (d1) d1.textContent = PIPS[die1];
      if (d2) d2.textContent = PIPS[die2];
      fx.tone([520 + (p % 4) * 60], 0.05, 'triangle', 0.05);
      later(() => step(p + 1), 230);
    };
    spin();
  }

  // Xanaya düşəndə vəziyyəti təyin et (prepare=true: yalnız state, ekran yox)
  function land() {
    const c = st.cur;
    const w = c.who;
    if (c.to >= GOAL) {
      st.phase = 'over';
      st.winner = w;
      return;
    }
    const cell = BOARD[c.to];
    if (cell.t === 'verb') {
      c.verb = verbAt(st.verbs, c.to);
      st.phase = w === 'L' ? 'answer' : 'judge';
      if (w === 'T') teacherAnswer();
    } else if (cell.t === 'joker') {
      st.phase = 'joker';
    } else if (cell.t === 'again') {
      st.phase = 'roll';
      st.msg = `🔁 <b>Noch einmal!</b> ${w === 'L' ? 'Bir daha zər at.' : 'Müəllim bir daha zər atır.'}`;
    } else if (cell.t === 'pause') {
      st.skip[w] = true;
      st.phase = 'pausedNote';
    }
  }

  function teacherAnswer() {
    const c = st.cur;
    const P = PERSONS[c.die1 - 1];
    const pron = P.ok[Math.floor(Math.random() * P.ok.length)];
    const pronShow = c.die1 === 6 && Math.random() < 0.5 ? 'Sie' : pron;
    c.wrong = Math.random() < TEACHER_ERR;
    c.said = `${pronShow} ${c.wrong ? wrongForm(c.verb, c.die1) : formOf(c.verb, c.die1)}`;
  }

  function afterLand() {
    const w = st.turn;
    if (st.phase === 'over') {
      if (w === 'L') {
        fx.win();
        render();
        confetti($app.querySelector('.wf-panel'));
      } else render();
      return;
    }
    if (st.phase === 'pausedNote') {
      st.phase = 'roll';
      st.turn = OTHER[w];
      st.msg = `⏸ <b>Pause!</b> ${w === 'L' ? 'Növbəti dəfə növbəni buraxırsan.' : 'Müəllim növbəti dəfə növbəni buraxır.'}`;
      save();
      render();
      if (st.turn === 'T') later(startTurn, 1600);
      return;
    }
    if (st.phase === 'roll') {
      // Noch einmal
      save();
      render();
      if (w === 'T') later(roll, 1600);
      return;
    }
    if (st.phase === 'joker' && w === 'T') {
      save();
      render();
      later(() => {
        const vs = boardVerbs();
        st.cur.verb = vs[Math.floor(Math.random() * vs.length)];
        st.phase = 'judge';
        teacherAnswer();
        save();
        render();
      }, 1200);
      return;
    }
    save();
    render();
  }

  function answer(input) {
    const c = st.cur;
    const r = checkAnswer(input, c.verb, c.die1);
    c.said = input.trim();
    c.ok = r.ok;
    const right = answerOf(c.verb, c.die1);
    if (r.ok) {
      st.stats.ok++;
      fx.ding();
      st.msg = `<p>✅ <b>Düzgündür!</b> ${esc(c.said)}</p>${r.note === 'uml' ? `<p class="small">⚠️ Ümlauta diqqət: <b>${esc(right)}</b></p>` : ''}<p class="small">Xana ${c.to}-də qalırsan.</p>`;
      speakDe(right);
    } else {
      st.stats.bad++;
      fx.oops();
      st.pos.L = c.from;
      const why = { pron: 'Şəxs (əvəzlik) düz deyil.', noPron: 'Şəxsi də yazmaq lazımdır.', form: 'Felin forması düz deyil.', sep: 'Ayrılan feldir: önşəkilçi ayrıca, cümlənin sonunda yazılır.', empty: '' }[r.why] || '';
      st.msg = `<p>❌ <b>Səhvdir.</b> ${esc(why)}</p><p class="wf-correct">✔ ${esc(right)} <button class="say" id="wfSay" aria-label="Dinlə">🔊</button></p><p class="small">💡 ${esc(explain(c.verb, c.die1))}</p><p class="small">↩️ Köhnə xanaya (${c.from === 0 ? 'START' : c.from}) qayıdırsan.</p>`;
      saveMistake(cat, d, { wrong: c.said, correct: right, explanation: explain(c.verb, c.die1) });
    }
    st.phase = 'result';
    save();
    render();
    const say = $app.querySelector('#wfSay');
    if (say) say.addEventListener('click', () => speakDe(right));
  }

  function judge(saysOk) {
    const c = st.cur;
    const right = answerOf(c.verb, c.die1);
    const teacherOk = !c.wrong;
    const learnerRight = saysOk === teacherOk;
    if (learnerRight) st.stats.judgeOk++;
    else st.stats.judgeBad++;
    c.ok = teacherOk;
    if (!teacherOk) st.pos.T = c.from;
    learnerRight ? fx.ding() : fx.oops();
    const verdict = learnerRight ? '👍 Düz yoxladın!' : '👎 Diqqətli ol!';
    st.msg = teacherOk
      ? `<p>${verdict} Müəllimin cavabı <b>düzdür</b>: ${esc(c.said)}</p><p class="small">Müəllim xana ${c.to}-də qalır.</p>`
      : `<p>${verdict} Müəllimin cavabı <b>səhvdir</b>: <s>${esc(c.said)}</s></p><p class="wf-correct">✔ ${esc(right)}</p><p class="small">💡 ${esc(explain(c.verb, c.die1))}</p><p class="small">↩️ Müəllim köhnə xanaya (${c.from === 0 ? 'START' : c.from}) qayıdır.</p>`;
    st.phase = 'result';
    save();
    render();
    speakDe(right);
  }

  function nextTurn() {
    st.turn = OTHER[st.turn];
    st.cur = null;
    st.msg = '';
    st.phase = 'roll';
    save();
    startTurn();
  }

  // ---------- başla ----------
  // yarımçıq animasiyadan qayıdanda: müəllimin növbəsini davam etdir
  if (st.phase === 'pausedNote') {
    st.phase = 'roll';
    st.turn = OTHER[st.turn];
  }
  render();
  if (st.started && st.turn === 'T' && !st.winner) {
    if (st.phase === 'roll') later(roll, 1100);
    else if (st.phase === 'joker') afterLand();
  }
}
