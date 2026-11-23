// WhatsApp yazışması (A1.1): ssenarilər, addım yoxlamaları və süni intellektlə qrammatika yoxlaması. DOM yoxdur — test olunur.
import { wordsToDigits } from './anmeldung-core.js';

export const EVENTS = [
  { id: 'konzert', n: 'Konzert', art: 'das', e: '🎸', az: 'konsert', re: /konzert/ },
  { id: 'fussball', n: 'Fußballspiel', art: 'das', e: '⚽', az: 'futbol oyunu', re: /fu(ss|ß)ball/ },
  { id: 'party', n: 'Party', art: 'die', e: '🎉', az: 'əyləncə (parti)', re: /party|partie|feier|fete/ },
  { id: 'flohmarkt', n: 'Flohmarkt', art: 'der', e: '🛍️', az: 'bit bazarı', re: /flohmarkt/ },
  { id: 'jazz', n: 'Jazzabend', art: 'der', e: '🎷', az: 'caz axşamı', re: /jazz/ },
  { id: 'basketball', n: 'Basketballspiel', art: 'das', e: '🏀', az: 'basketbol oyunu', re: /basketball/ },
];
export const PLACES = [
  { id: 'fuchs', n: 'Bar Fuchs', art: 'die', in: 'in der Bar Fuchs', e: '🍸', az: 'bar', re: /fuchs/ },
  { id: 'mozart', n: 'Café Mozart', art: 'das', in: 'im Café Mozart', e: '☕', az: 'kafe', re: /mozart/ },
  { id: 'mond', n: 'Club Mond', art: 'der', in: 'im Club Mond', e: '🪩', az: 'klub', re: /\bmond\b/ },
  { id: 'stadion', n: 'Stadion Nord', art: 'das', in: 'im Stadion Nord', e: '🏟️', az: 'stadion', re: /stadion/ },
  { id: 'park', n: 'Stadtpark', art: 'der', in: 'im Stadtpark', e: '🌳', az: 'şəhər parkı', re: /stadtpark|\bpark\b/ },
  { id: 'halle', n: 'Sporthalle West', art: 'die', in: 'in der Sporthalle West', e: '🏟️', az: 'idman zalı', re: /sporthalle|\bhalle\b/ },
];
const PAIRS = {
  konzert: ['fuchs', 'mond', 'park', 'mozart'],
  fussball: ['stadion', 'fuchs'],
  party: ['mond', 'mozart', 'fuchs'],
  flohmarkt: ['park'],
  jazz: ['mozart', 'fuchs'],
  basketball: ['halle'],
};
export const STREETS = ['Goethestraße', 'Schillerstraße', 'Bahnhofstraße', 'Lindenstraße', 'Hauptstraße', 'Rosenstraße', 'Bergstraße'];
export const FRIENDS = [
  { n: 'Lena', c: '#e91e63' },
  { n: 'Max', c: '#3f51b5' },
  { n: 'Mia', c: '#9c27b0' },
  { n: 'Jonas', c: '#009688' },
  { n: 'Anna', c: '#ff5722' },
  { n: 'Paul', c: '#795548' },
  { n: 'Samir', c: '#2196f3' },
  { n: 'Aylin', c: '#f44336' },
];
export const DAYS = { heute: 'bu gün', morgen: 'sabah' };

export const ev = (sc) => EVENTS.find((x) => x.id === sc.ev);
export const pl = (sc) => PLACES.find((x) => x.id === sc.pl);
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ein = (it) => (it.art === 'die' ? 'eine' : 'ein');
export const evIndef = (sc) => `${ein(ev(sc))} ${ev(sc).n}`; // ein Konzert
export const evAcc = (sc) => `${ev(sc).art === 'der' ? 'einen' : ein(ev(sc))} ${ev(sc).n}`; // es gibt einen Flohmarkt
// sc.gibt: bu söhbətdə dəvət "es gibt" ilə (Akkusativ), yoxsa "ist" ilə
export const inviteLine = (sc) => (sc.gibt ? `${cap(sc.day)} gibt es ${evAcc(sc)}` : `${cap(sc.day)} ist ${evIndef(sc)}`);
export const evDef = (sc) => `${ev(sc).art} ${ev(sc).n}`; // das Konzert
export const plDef = (sc) => `${pl(sc).art} ${pl(sc).n}`; // die Bar Fuchs
export const address = (sc) => `${sc.street} ${sc.no}`;
export const byeWord = (sc) => sc.bye || (sc.day === 'heute' ? 'gleich' : 'morgen');
// sağollaşma variantları: bu gün → gleich / später / dann; sabah → morgen / dann
export const BYES = { heute: ['gleich', 'später', 'dann'], morgen: ['morgen', 'dann'] };
export const PHRASES = {
  'komme gern': { de: 'Ich komme gern!', az: 'Məmnuniyyətlə gəlirəm!' },
  'freue mich': { de: 'Ich freue mich!', az: 'Sevinirəm! (səbirsizliklə gözləyirəm)' },
  'freue mich auch': { de: 'Ich freue mich auch!', az: 'Mən də sevinirəm!' },
  gleich: { de: 'Bis gleich!', az: 'Az sonra görüşərik!' },
  später: { de: 'Bis später!', az: 'Sonra görüşərik!' },
  dann: { de: 'Bis dann!', az: 'Onda görüşərik!' },
  morgen: { de: 'Bis morgen!', az: 'Sabah görüşərik!' },
  wiedersehen: { de: 'Auf Wiedersehen!', az: 'Sağ olun! (rəsmi vidalaşma — daha çox tanımadığın adamlara)' },
};

export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-zäöü0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// müqayisə üçün: durğu, böyük/kiçik hərf, emoji fərqi nəzərə alınmır
export const same = (a, b) => norm(a) === norm(b);

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];

export function newScenario(rnd = Math.random, avoid = null) {
  let e;
  do e = pick(EVENTS, rnd);
  while (avoid && e.id === avoid.ev && rnd() < 0.9);
  const sc = {
    day: rnd() < 0.5 ? 'heute' : 'morgen',
    ev: e.id,
    pl: pick(PAIRS[e.id], rnd),
    street: pick(STREETS, rnd),
    no: 2 + Math.floor(rnd() * 47),
  };
  sc.bye = pick(BYES[sc.day], rnd);
  return sc;
}
export function newGame(rnd = Math.random) {
  const s1 = newScenario(rnd);
  const s2 = newScenario(rnd, s1);
  return { friend: pick(FRIENDS, rnd).n, sc: [s1, s2] };
}

// ---------- addımlar ----------
// who: T — dost (müəllim) yazır; L — şagird yazır
export const ROUNDS = [
  // 1-ci raund: dost dəvət edir, şagird soruşur
  [
    { k: 'inv', who: 'T', say: (sc) => `Hallo! 👋 ${inviteLine(sc)}. Hast du Lust? ${ev(sc).e}` },
    { k: 'askWhere', who: 'L', task: (sc) => `Razılaş və ${ev(sc).az} harada olduğunu soruş.`, ex: (sc) => `Ja, ich komme gern! Wo ist ${evDef(sc)}?` },
    { k: 'place', who: 'T', say: (sc) => `${cap(pl(sc).in)}. ${pl(sc).e}` },
    { k: 'askAddr', who: 'L', task: (sc) => `"${pl(sc).n}" harada yerləşir? Ünvanı soruş.`, ex: (sc) => `Wo ist ${plDef(sc)}?` },
    { k: 'addr', who: 'T', say: (sc) => `Die Adresse ist ${address(sc)}. 📍 Kommst du?` },
    { k: 'closing', who: 'L', task: () => 'Sevindiyini yaz və sağollaş.', ex: (sc) => `Ja, ich komme gern! Danke für die Nachricht. Ich freue mich! Bis ${byeWord(sc)}!` },
    // prev — şagirdin son mesajı: "Ich freue mich" yazıbsa, dost "Ich freue mich auch" deyir
    { k: 'bye', who: 'T', say: (sc, prev = '') => `${/freu/.test(norm(prev)) ? 'Ich freue mich auch!' : 'Super, ich freue mich!'} Bis ${byeWord(sc)}! 😊` },
  ],
  // 2-ci raund: şagird dəvət edir, dost soruşur
  [
    { k: 'invite', who: 'L', task: (sc) => `Kartdakı tədbirə dostunu dəvət et: gün + tədbir + "Hast du Lust?"`, ex: (sc) => `Hallo! ${inviteLine(sc)}. Hast du Lust?` },
    { k: 'tWhere', who: 'T', say: (sc) => `Ja, ich komme gern! 😃 Wo ist ${evDef(sc)}?` },
    { k: 'tellPlace', who: 'L', task: () => 'Yerini yaz (kartdakı məkan).', ex: (sc) => `${cap(pl(sc).in)}.` },
    { k: 'tAddr', who: 'T', say: (sc) => `Super! Und wo ist ${plDef(sc)}? Wie ist die Adresse?` },
    { k: 'tellAddr', who: 'L', task: () => 'Ünvanı yaz (küçə + nömrə).', ex: (sc) => `Die Adresse ist ${address(sc)}.` },
    { k: 'tBye', who: 'T', say: (sc) => `Danke für die Nachricht! Ich freue mich. Bis ${byeWord(sc)}! 👍` },
    { k: 'closing2', who: 'L', task: () => 'Cavab yaz: sən də sevinirsən, sağollaş.', ex: (sc) => `Ich freue mich auch! Bis ${byeWord(sc)}!` },
  ],
];

const CLOSING = /freu(e)? mich|komme gern|auf wiedersehen|bis gleich|bis sp(ä|a|ae)t|bis dann|bis morgen|bis bald|danke f(ü|u)r die nachricht|ich auch|super|toll|prima/;
const wordCount = (t) => (t.match(/[a-zäöü]{2,}/g) || []).length;
function numbersIn(t) {
  return (wordsToDigits(norm(t)).match(/\d+/g) || []).map(Number);
}

// Məzmun yoxlaması (tətbiq özü): {ok, az}
export function checkStep(k, text, sc) {
  const t = norm(text);
  const E = ev(sc), P = pl(sc);
  const ok = { ok: true };
  const bad = (az) => ({ ok: false, az });
  if (!t) return bad('Bir şey yaz.');
  switch (k) {
    case 'askWhere':
      if (/\bwo\b/.test(t) && wordCount(t) >= 2) return ok;
      return bad(`${cap(E.az)} harada olduğunu soruş: "Wo ist ${evDef(sc)}?"`);
    case 'askAddr':
      if (/adresse|welche stra|wo genau/.test(t)) return ok;
      if (/\bwo\b/.test(t) && (P.re.test(t) || /\b(bar|cafe|café|club|stadion|park|halle|das|die|der)\b/.test(t)) && wordCount(t) >= 2) return ok;
      return bad(`Ünvanı soruş: "Wo ist ${plDef(sc)}?" və ya "Wie ist die Adresse?"`);
    case 'closing':
    case 'closing2':
      if (CLOSING.test(t)) return ok;
      return bad(`Sevindiyini yaz və sağollaş: "Ich freue mich! Bis ${byeWord(sc)}!"`);
    case 'invite': {
      const t2 = t.replace(/guten morgen/g, '');
      const other = sc.day === 'heute' ? 'morgen' : 'heute';
      const hasDay = new RegExp(`\\b${sc.day}\\b`).test(t2);
      if (!hasDay && new RegExp(`\\b${other}\\b`).test(t2)) return bad(`Gün səhvdir: kartda "${cap(sc.day)}" (${DAYS[sc.day]}) yazılıb.`);
      if (!hasDay) return bad(`Günü də yaz — kartda "${cap(sc.day)}" (${DAYS[sc.day]}).`);
      const wrongEv = EVENTS.find((x) => x.id !== E.id && x.re.test(t));
      if (!E.re.test(t)) return bad(wrongEv ? `Tədbir səhvdir: kartda "${E.n}" (${E.az}) yazılıb.` : `Tədbiri yaz: "${sc.gibt ? evAcc(sc) : evIndef(sc)}".`);
      // "es gibt" + der-söz → einen; "ist" + der-söz → ein
      if (E.art === 'der' && /\bgibt\b/.test(t) && new RegExp(`\\bein ${norm(E.n)}`).test(t)) return bad(`"es gibt"-dən sonra der-söz Akkusativdə olur: "einen ${E.n}" ("ein" yox).`);
      if (E.art === 'der' && /\bist\b/.test(t) && !/\bgibt\b/.test(t) && new RegExp(`\\beinen ${norm(E.n)}`).test(t)) return bad(`"ist"-dən sonra Nominativ olur: "ein ${E.n}" ("einen" yox).`);
      if (!/lust|zeit|kommst|mitkommen|m(ö|o|oe)chtest|willst|gehen wir|gehst du|machst du mit/.test(t)) return bad('Dostunu dəvət et — soruş: "Hast du Lust?"');
      return ok;
    }
    case 'tellPlace': {
      if (P.re.test(t)) return ok;
      const wrong = PLACES.find((x) => x.id !== P.id && x.re.test(t));
      return bad(wrong ? `Yer səhvdir: kartda "${P.n}" yazılıb.` : `Kartdakı yeri yaz: "${cap(P.in)}."`);
    }
    case 'tellAddr': {
      const key = norm(sc.street).replace(/strasse$/, '');
      const nums = numbersIn(t);
      const hasStreet = t.includes(key);
      const wrongStreet = STREETS.find((s) => s !== sc.street && t.includes(norm(s).replace(/strasse$/, '')));
      if (!hasStreet) return bad(wrongStreet ? `Küçə səhvdir: kartda "${sc.street}" yazılıb.` : `Küçəni yaz: "${address(sc)}".`);
      if (!nums.length) return bad(`Ev nömrəsini də yaz: "${address(sc)}".`);
      if (!nums.includes(sc.no)) return bad(`Ev nömrəsi səhvdir: kartda ${sc.no} yazılıb.`);
      return ok;
    }
  }
  return ok;
}

// ---------- məsləhət: yazmadığı faydalı ifadələr ----------
// Şagirdin mesajı qəbul olunandan sonra: bu yerdə yaza biləcəyi, amma yazmadığı ifadələr [{de, az}]
const hasBye = (t) => /\bbis (gleich|spat|später|dann|morgen|bald)\b|auf wiedersehen/.test(t);
function byeTips(sc) {
  const day = BYES[sc.day] ? sc.day : 'heute';
  const main = byeWord(sc);
  const list = [main, ...BYES[day].filter((x) => x !== main)].map((k) => PHRASES[k]);
  return [...list, PHRASES.wiedersehen];
}
export function tipsFor(k, text, sc) {
  const t = norm(text);
  const out = [];
  const gern = /komme (gern|gerne)/.test(t);
  const freu = /freu(e)? mich/.test(t);
  if (k === 'askWhere' && !gern) out.push(PHRASES['komme gern']);
  if (k === 'closing') {
    if (!gern) out.push(PHRASES['komme gern']);
    if (!freu) out.push(PHRASES['freue mich']);
    if (!hasBye(t)) out.push(...byeTips(sc));
  }
  if (k === 'closing2') {
    if (!/freu(e)? mich auch/.test(t)) out.push(PHRASES['freue mich auch']);
    if (!hasBye(t)) out.push(...byeTips(sc));
  }
  return out;
}

// ---------- söz-söz fərq (düzəlişi göstərmək üçün) ----------
export function wordDiff(a, b) {
  const A = String(a).split(/\s+/).filter(Boolean);
  const B = String(b).split(/\s+/).filter(Boolean);
  const key = (w) => norm(w);
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = key(A[i]) === key(B[j]) && key(A[i]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (key(A[i]) === key(B[j]) && key(A[i])) {
      out.push({ t: 'same', w: B[j] });
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: 'del', w: A[i++] });
    else out.push({ t: 'add', w: B[j++] });
  }
  while (i < n) out.push({ t: 'del', w: A[i++] });
  while (j < m) out.push({ t: 'add', w: B[j++] });
  return out;
}

// ---------- süni intellekt: qrammatika yoxlaması (Gemini, mətn) ----------
export const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-flash-lite-latest'];
const LANG = { az: 'Azerbaijani', tr: 'Turkish', de: 'very simple German' };

export function grammarPrompt(explainLang = 'az') {
  const L = LANG[explainLang] || LANG.az;
  return `You are a kind German teacher. Your student is an A1.1 beginner whose native language is Azerbaijani.
The student is chatting on WhatsApp with a German friend. Check ONLY the student's message for real German grammar and spelling mistakes:
- verb form / conjugation (ich bin, du hast, er ist ...), verb position (verb in position 2; verb first in yes/no questions),
- articles and gender (ein/eine, der/die/das, im / in der), wrong preposition, wrong or misspelled words,
- missing words that make the sentence wrong.
These are NOT mistakes (the message is correct): missing or extra punctuation, emojis, a lowercase first letter, informal but correct chat style ("Ja, gerne!", "Super!", "Bis gleich!", "Hey!"), short chat answers without a verb ("In der Bar Fuchs.", "Goethestraße 12.", "Im Stadtpark."), "ss" instead of "ß", "ae/oe/ue" instead of "ä/ö/ü", a lowercase noun. Mention a lowercase noun or a missing umlaut only in "minor".
If you are not sure, the message is correct. Never change the meaning, never add new content, never improve the style.
Answer with JSON only:
- correct: true or false
- corrected: the student's message with only the necessary corrections (keep everything else exactly the same; same as the message if correct)
- explanation: in ${L}, very simple, 1–2 short sentences: which word is wrong and why. Empty if correct.
- minor: in ${L}, optional very short note ONLY about a lowercase noun, a missing umlaut or ß (e.g. "İsimlər böyük hərflə yazılır: Konzert."). Never comment on the content, the topic or the first letter. Usually empty.`;
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    correct: { type: 'BOOLEAN' },
    corrected: { type: 'STRING' },
    explanation: { type: 'STRING' },
    minor: { type: 'STRING' },
  },
  required: ['correct', 'corrected', 'explanation'],
};

// "İsimlər böyük hərflə yazılır: Konzert" — söz mətndə artıq böyük hərflədirsə, bu qeydi at
export function cleanMinor(minor, text) {
  return String(minor || '')
    .split(/(?<=\.)\s+/)
    .filter((sent) => {
      if (!/böyük hərf/i.test(sent)) return true;
      const words = (sent.split(':').slice(1).join(':').match(/[A-ZÄÖÜ][a-zäöüß]+/g) || []);
      return !words.length || !words.every((w) => new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, 'u').test(text));
    })
    .join(' ')
    .trim();
}

// {correct, corrected, explanation, minor, model} və ya xəta olanda null
export async function aiCheck({ apiKey, text, context = '', explainLang = 'az', models = TEXT_MODELS, fetchImpl = fetch, timeoutMs = 12000, log = () => {} }) {
  if (!apiKey) return null;
  const user = `${context ? `The friend wrote before: "${context}"\n` : ''}The student's message: "${text}"`;
  for (const model of models) {
    const body = {
      systemInstruction: { parts: [{ text: grammarPrompt(explainLang) }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA, ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
    };
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!res.ok) {
        log('ai', `${model}: HTTP ${res.status}`);
        if (res.status === 401 || res.status === 403) return null;
        continue;
      }
      const data = await res.json();
      const raw = ((((data.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || '').join('');
      const j = JSON.parse(raw);
      const out = { correct: !!j.correct, corrected: String(j.corrected || text).trim(), explanation: String(j.explanation || '').trim(), minor: String(j.minor || '').trim(), model };
      // yalnız durğu/hərf fərqidirsə — səhv sayılmır
      if (!out.correct && same(out.corrected, text)) {
        out.correct = true;
        out.minor = out.minor || out.explanation;
        out.explanation = '';
      }
      if (out.correct) out.corrected = text;
      out.minor = cleanMinor(out.minor, text);
      return out;
    } catch (e) {
      log('ai', `${model}: ${e.message || e}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return null;
}
