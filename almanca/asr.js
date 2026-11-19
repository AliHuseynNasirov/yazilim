// Brauzerin öz nitq tanıması (Web Speech API) — pulsuz, açar lazım deyil (Chrome internet istəyir).
// Səsli oyunlarda şagirdin dediyini yazıya çevirir; yoxlamanı oyunun özü edir.

export function asrSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** Səhv kodunun azərbaycanca izahı */
export function asrErrorText(code) {
  return (
    {
      'not-allowed': '🎙️ Mikrofon icazəsi verilməyib. Brauzerin ayarlarından bu sayta mikrofon icazəsi ver.',
      'service-not-allowed': '🎙️ Mikrofon icazəsi verilməyib.',
      'no-speech': '🤔 Heç nə eşitmədim. 🎙️ düyməsini basıb yenidən de.',
      'audio-capture': '🎙️ Mikrofon tapılmadı.',
      network: '📶 Səsi tanımaq üçün internet lazımdır.',
      aborted: '',
    }[code] ?? '🤔 Səsi tanıya bilmədim. Yenidən cəhd et.'
  );
}

const low = (s) => String(s || '').trim().toLowerCase();
/**
 * Yekun parçaları birləşdir. Bəzi Android telefonlarında hər parça əvvəlkini də təkrarlayır
 * ("nein", "nein das", "nein das ist …") — onda sonuncunu götür, yoxsa ardınca əlavə et.
 */
export function mergeFinals(parts) {
  let out = '';
  for (const p of parts) {
    const t = String(p || '').trim();
    if (!t) continue;
    if (!out || low(t).startsWith(low(out))) out = t;
    else if (!low(out).endsWith(low(t))) out = `${out} ${t}`;
  }
  return out;
}

/**
 * Uzun dinləmə: şagird yaşıl "Bitirdim" düyməsini basana qədər dinləyir — fasilədə dayanmır.
 * Brauzer özü dayansa (səssizlik), yenidən başladılır; deyilənlər yığılır.
 * @returns {{ finish: () => void, clear: () => void, cancel: () => void }}
 */
export function listenLong({ lang = 'de-DE', onText, onDone, onError, isAlive } = {}) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const sessions = []; // bitmiş seansların mətni
  let cur = null;
  let curFinals = [];
  let curInterim = '';
  let state = 'on'; // on | finishing | cancelled | done
  let fatal = false;
  let restarts = 0;

  const text = () => mergeFinals([...sessions, mergeFinals(curFinals), curInterim]);
  const emit = () => onText && onText(text());

  function start() {
    curFinals = [];
    curInterim = '';
    const r = new R();
    cur = r;
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const finals = [];
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finals.push(t);
        else interim += t;
      }
      curFinals = finals;
      curInterim = interim;
      emit();
    };
    r.onerror = (e) => {
      const code = e.error || 'error';
      if (code === 'no-speech' || code === 'aborted') return; // fasilə — yenidən başlayacaq
      if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture' || code === 'network') fatal = true;
      if (onError) onError(code);
    };
    r.onend = () => {
      if (cur !== r) return;
      const piece = mergeFinals([...curFinals, curInterim]);
      if (piece) sessions.push(piece);
      curFinals = [];
      curInterim = '';
      cur = null;
      // səhifədən çıxıbsa mikrofonu bağlı saxla
      if (isAlive && !isAlive()) state = 'cancelled';
      if (state === 'on' && !fatal && restarts < 60) {
        restarts++;
        try {
          start(); // brauzer özü dayandı — dinləməyə davam
          return;
        } catch {}
      }
      if (state === 'cancelled') return;
      state = 'done';
      if (onDone) onDone(text(), fatal);
    };
    r.start();
  }

  try {
    if ('speechSynthesis' in window) speechSynthesis.cancel(); // müəllimin səsi mikrofona düşməsin
    start();
  } catch {
    state = 'done';
    if (onError) onError('start');
    if (onDone) onDone('', true);
  }
  return {
    finish() {
      if (state !== 'on') return;
      state = 'finishing';
      if (cur) {
        try {
          cur.stop();
        } catch {}
      } else {
        state = 'done';
        if (onDone) onDone(text(), fatal);
      }
    },
    clear() {
      sessions.length = 0;
      curFinals = [];
      curInterim = '';
      // brauzerin bu seansda yığdıqlarını da at
      if (cur) {
        const old = cur;
        cur = null;
        try {
          old.abort ? old.abort() : old.stop();
        } catch {}
        if (state === 'on') start();
      }
      emit();
    },
    cancel() {
      state = 'cancelled';
      if (cur) {
        try {
          cur.abort ? cur.abort() : cur.stop();
        } catch {}
      }
    },
  };
}

/**
 * Bir cümləni dinlə (susanda özü dayanır). Köhnə qısa rejim.
 * @returns {{ stop: () => void }}
 */
export function listen({ lang = 'de-DE', onInterim, onFinal, onError, onEnd } = {}) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new R();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  let final = '';
  let interim = '';
  let ended = false;
  r.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    if (onInterim) onInterim(`${final} ${interim}`.trim());
  };
  r.onerror = (e) => {
    if (onError) onError(e.error || 'error');
  };
  r.onend = () => {
    if (ended) return;
    ended = true;
    if (onEnd) onEnd();
    const text = (final || interim).trim();
    if (text && onFinal) onFinal(text);
  };
  try {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    r.start();
  } catch {
    ended = true;
    if (onError) onError('start');
    if (onEnd) onEnd();
  }
  return {
    stop() {
      try {
        r.stop();
      } catch {}
    },
  };
}
