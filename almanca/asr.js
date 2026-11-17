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

/**
 * Bir cümləni dinlə (susanda özü dayanır).
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
    if ('speechSynthesis' in window) speechSynthesis.cancel(); // müəllimin səsi mikrofona düşməsin
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
