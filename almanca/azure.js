// Azure Speech — Tələffüz yoxlaması (Pronunciation Assessment).
// Şagirdin cümləsinin səsini və GÖZLƏNİLƏN düzgün cümləni göndəririk; Azure hər sözə
// 0–100 bal verir və sözün əskik / artıq / səhv tələffüz olunduğunu deyir.

// 16 kHz, 16-bit, mono PCM → WAV baytları
export function pcmToWav(pcm) {
  const dataBytes = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  new Int16Array(buf, 44).set(pcm);
  return buf;
}

// UTF-8 JSON → base64 (ß, ü kimi hərflər üçün)
function b64utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

const num = (x) => (typeof x === 'number' ? Math.round(x) : null);

/**
 * @returns {Promise<{ok:true, text:string, score:number|null, words:{word:string, score:number|null, error:string, phonemes:{p:string, score:number|null}[]}[]} | {ok:false, error:string}>}
 */
export async function assessPronunciation(pcm, referenceText, key, region, { timeoutMs = 8000 } = {}) {
  if (!pcm || pcm.length < 16000 * 0.4) return { ok: false, error: 'səs çox qısa idi' };
  const r = String(region || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const url = `https://${r}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=de-DE&format=detailed`;
  const params = {
    ReferenceText: referenceText,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    // Artıq/əskik söz axtarışı sönülü: aksentli nitqdə Azure uydurma "artıq" sözlər tapırdı.
    // Azure yalnız gözlənilən hər sözün tələffüzünə bal verir; əskik sözləri tətbiqin öz yoxlaması tutur.
    EnableMiscue: false,
    PhonemeAlphabet: 'IPA',
  };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        Accept: 'application/json',
        'Pronunciation-Assessment': b64utf8(JSON.stringify(params)),
      },
      body: pcmToWav(pcm),
    });
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') return { ok: false, error: 'cavab gecikdi' };
    return { ok: false, error: 'bağlantı alınmadı (internet, region adı və ya brauzer bloku)' };
  }
  clearTimeout(timer);
  if (res.status === 401 || res.status === 403) return { ok: false, error: `açar və ya region səhvdir (${res.status})` };
  if (res.status === 429) return { ok: false, error: 'pulsuz limit doldu (429)' };
  if (!res.ok) return { ok: false, error: `server xətası (${res.status})` };
  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: 'cavab oxunmadı' };
  }
  if (json.RecognitionStatus && json.RecognitionStatus !== 'Success') {
    return { ok: false, error: json.RecognitionStatus === 'NoMatch' ? 'söz tanınmadı' : `tanınma: ${json.RecognitionStatus}` };
  }
  const best = (json.NBest && json.NBest[0]) || {};
  const pa = best.PronunciationAssessment || best; // köhnə və yeni format
  const words = (best.Words || []).map((w) => {
    const wp = w.PronunciationAssessment || w;
    return {
      word: w.Word,
      score: num(wp.AccuracyScore),
      error: wp.ErrorType || 'None',
      phonemes: (w.Phonemes || []).map((ph) => ({
        p: ph.Phoneme,
        score: num((ph.PronunciationAssessment || ph).AccuracyScore),
      })),
    };
  });
  return {
    ok: true,
    text: best.Display || json.DisplayText || '',
    score: num(pa.PronScore ?? pa.AccuracyScore),
    words,
  };
}

// ---------- Səhvləri azərbaycanca izah ----------

// Kart sözlərinin oxunuşu (izahda göstərmək üçün)
const SAY = {
  heiße: 'HAY-sə', bin: 'bin', jahre: 'YAA-rə', alt: 'alt', komme: 'KOM-mə', aus: 'aus', der: 'der', den: 'den',
  wohne: 'VOO-nə', in: 'in', spreche: 'ŞPRE-xə', deutschland: 'DOYÇ-lant', deutsch: 'doyç', österreich: 'ÖS-tə-rayx',
  schweiz: 'şvayts', spanien: 'ŞPAA-ni-ən', türkei: 'tür-KAY', russland: 'RUS-lant', aserbaidschan: 'a-zer-bay-CAAN',
  usa: 'u-es-AA', china: 'ÇII-na', hamburg: 'HAM-burk', wien: 'viin', zürich: 'TSÜ-rix', berlin: 'ber-LIIN',
  münchen: 'MÜN-xən', köln: 'köln', frankfurt: 'FRANK-furt', düsseldorf: 'DÜS-səl-dorf', spanisch: 'ŞPAA-niş',
  türkisch: 'TÜR-kiş', russisch: 'RU-siş', aserbaidschanisch: 'a-zer-bay-CAA-niş', englisch: 'EN-liş',
  chinesisch: 'çi-NEE-ziş', ich: 'ix', heisse: 'HAY-sə',
  zwei: 'tsvay', drei: 'dray', vier: 'fiir', fünf: 'fünf', sechs: 'zeks', sieben: 'ZII-bən', acht: 'axt', neun: 'noyn',
  zwanzig: 'TSVAN-tsix', dreißig: 'DRAY-six', vierzig: 'FİR-tsix', fünfzig: 'FÜNF-tsix', und: 'unt',
};

// IPA səsi → izah
const PHONE_AZ = [
  [/aɪ|ai/, '"ei" "ay" kimi oxunur'],
  [/ɔʏ|oy/, '"eu" "oy" kimi oxunur'],
  [/ʃ/, '"sch" (və sözün əvvəlində "sp/st"-dəki "s") "ş" kimi oxunur'],
  [/ts/, '"z" "ts" kimi oxunur'],
  [/ç|x/, '"ch" yumşaq "x" kimi oxunur'],
  [/yː|ʏ|y/, '"ü" dodaqlar yumrulanaraq oxunur'],
  [/øː|œ|ø/, '"ö" dodaqlar yumrulanaraq oxunur'],
  [/iː/, '"ie" uzun "i" kimi oxunur'],
  [/ə|ɐ/, 'sondakı "-e" qısa, amma aydın eşidilməlidir'],
  [/^j$/, '"j" "y" kimi oxunur'],
  [/^v$/, '"w" "v" kimi oxunur'],
  [/^f$/, '"v" "f" kimi oxunur'],
  [/^z$/, '"s" saitdən əvvəl "z" kimi oxunur'],
];

// Hərflərə görə izah (səs məlumatı yoxdursa)
const LETTER_AZ = [
  [/ei|ai/, '"ei" "ay" kimi oxunur'],
  [/eu|äu/, '"eu" "oy" kimi oxunur'],
  [/^sp|^st/, 'sözün əvvəlində "sp/st" "şp/şt" kimi oxunur'],
  [/sch/, '"sch" "ş" kimi oxunur'],
  [/z/, '"z" "ts" kimi oxunur'],
  [/^j/, '"j" "y" kimi oxunur'],
  [/w/, '"w" "v" kimi oxunur'],
  [/^v/, '"v" "f" kimi oxunur'],
  [/ie/, '"ie" uzun "i" kimi oxunur'],
  [/ü/, '"ü" dodaqlar yumrulanaraq oxunur'],
  [/ö/, '"ö" dodaqlar yumrulanaraq oxunur'],
  [/ch/, '"ch" yumşaq "x" kimi oxunur'],
  [/[aeiou]h/, '"h" oxunmur, ondan əvvəlki sait uzanır'],
  [/e$/, 'sondakı "-e" qısa, amma aydın eşidilməlidir'],
  [/ß|ss/, '"ß" "s" kimi oxunur'],
];

export function explainWord(w, phonemeMin = 60) {
  const lw = w.word.toLowerCase();
  const say = SAY[lw] ? ` Belə deyilir: ${SAY[lw]}.` : '';
  const worst = [...(w.phonemes || [])].filter((p) => p.score != null).sort((a, b) => a.score - b.score)[0];
  let why = null;
  if (worst && worst.score < Math.max(phonemeMin, 60)) {
    const hit = PHONE_AZ.find(([re]) => re.test(worst.p));
    if (hit) why = hit[1];
  }
  if (!why) {
    const hit = LETTER_AZ.find(([re]) => re.test(lw));
    why = hit ? hit[1] : 'söz düzgün tələffüz olunmayıb';
  }
  const ph = worst && worst.score < Math.max(phonemeMin, 60) ? `, "${phoneLabel(worst.p)}" səsi ${worst.score}/100` : '';
  return `Tələffüz səhvdir: "${w.word}" (${w.score}/100${ph}) — ${why}.${say}`;
}

export const PRON_MIN = 60; // bu baldan aşağı söz = tələffüz səhvi

// Tələffüz sərtliyi: söz balı və ayrıca səs (fonem) balı üçün hədlər
export const STRICTNESS = {
  normal: { word: 60, phoneme: 40 },
  strict: { word: 75, phoneme: 60 },
  very: { word: 85, phoneme: 75 },
};

// IPA səsi → oxucu üçün hərf (çatda göstərmək üçün)
const PHONE_LETTER = [
  [/aɪ/, 'ei'], [/ɔʏ/, 'eu'], [/aʊ/, 'au'], [/ʃ/, 'sch'], [/ts/, 'z'], [/ç|x/, 'ch'], [/yː|ʏ/, 'ü'], [/øː|œ/, 'ö'],
  [/iː/, 'ie'], [/ə|ɐ/, '-e'], [/^j$/, 'j'], [/^v$/, 'w'], [/^f$/, 'f/v'], [/^z$/, 's'], [/^ʁ$|^r$/, 'r'],
];
export function phoneLabel(p) {
  const hit = PHONE_LETTER.find(([re]) => re.test(p));
  return hit ? hit[1] : p;
}
export function worstPhoneme(w) {
  return [...(w.phonemes || [])].filter((p) => p.score != null).sort((a, b) => a.score - b.score)[0] || null;
}

/** Azure nəticəsindən səhvlər: əskik, artıq, səhv tələffüz. */
export function azureErrors(result, level = 'normal') {
  if (!result || !result.ok) return [];
  const lim = STRICTNESS[level] || STRICTNESS.normal;
  const out = [];
  for (const w of result.words) {
    if (w.error === 'Omission') out.push({ kind: 'omission', word: w.word, az: `"${w.word}" sözü deyilmədi (əskikdir).`, en: `the word "${w.word}" was not said` });
    else if (w.error === 'Insertion') out.push({ kind: 'insertion', word: w.word, az: `"${w.word}" artıq sözdür, cümlədə olmamalıdır.`, en: `the extra word "${w.word}" was said` });
    else {
      // söz balı aşağıdırsa VƏ YA bir səs (fonem) ayrıca zəifdirsə — tələffüz səhvi
      const wp = worstPhoneme(w);
      const badWord = w.error === 'Mispronunciation' || (w.score != null && w.score < lim.word);
      const badPhone = wp && wp.score < lim.phoneme;
      if (badWord || badPhone) {
        const az = explainWord(w, badPhone ? lim.phoneme : 60);
        const ph = badPhone ? `, sound "${wp.p}" ${wp.score}/100` : '';
        out.push({ kind: 'pron', word: w.word, score: w.score, az, en: `the word "${w.word}" was mispronounced (${w.score}/100${ph})` });
      }
    }
  }
  return out;
}

/** Səhv dəftəri üçün: cümlədə səhv tələffüz olunan sözləri işarələ, əskik sözləri qeyd et. */
export function markAzureWrong(sentence, errs) {
  let t = sentence;
  const missing = [];
  for (const e of errs) {
    if (e.kind === 'pron') {
      const re = new RegExp(`(^|[^\\p{L}])(${e.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\p{L}])`, 'iu');
      t = re.test(t) ? t.replace(re, `$1$2❗(${e.score ?? '?'}/100)`) : `${t} — ${e.word}❗(${e.score ?? '?'}/100)`;
    } else if (e.kind === 'omission') missing.push(e.word);
    else if (e.kind === 'insertion') t = `${t} — artıq: ${e.word}`;
  }
  if (missing.length) t = `${t} — deyilmədi: ${missing.join(', ')}`;
  return t;
}
