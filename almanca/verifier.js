// Hərfi yoxlayıcı: şagirdin cümləsinin səsini ayrıca Gemini Flash modelinə göndərir
// və eşidilənin DÜZƏLDİLMƏMİŞ, hərf-hərf yazısını alır.
// Danışıq modeli (müəllim) və ASR səhv sonluqları "düzəldir" ("kommet" → "komme");
// bu yoxlayıcının yeganə işi eşitdiyini olduğu kimi yazmaqdır.

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

// Sıra ilə sınanır; işləyən yadda qalır. "gemini-flash-latest" — ən son Flash modelinin ləqəbi.
export const VERIFIER_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

// ---- Təlimat (ingiliscə: model ingiliscə təlimatlara daha dəqiq əməl edir) ----
export const VERIFIER_PROMPT = `You are a VERBATIM SPEECH TRANSCRIBER for a language-learning app. You are NOT a teacher, NOT a corrector, NOT a translator.

CONTEXT
- The audio is one short utterance (usually 1–3 sentences) spoken by an Azerbaijani adult who is learning German at beginner level (A1).
- The speaker makes mistakes ON PURPOSE and by accident: wrong verb endings, missing words, wrong words, wrong articles, Azerbaijani words in the middle of German sentences.
- The app compares your text letter by letter with the correct sentence to find the learner's mistakes. If you correct anything, the learner's mistake becomes invisible and the app fails. Your transcript is only useful if it is EXACTLY what was spoken.

YOUR ONLY TASK
Write down exactly the words that were spoken, in the order they were spoken.

ABSOLUTE RULES (never break them)
1. NEVER correct grammar. If the speaker says "Ich kommet aus Deutschland", you write "Ich kommet aus Deutschland" — NOT "Ich komme aus Deutschland".
2. NEVER fix verb endings. Listen to the exact end of every verb. Write exactly the ending you hear: komm / komme / kommet / kommt / kommst / kommen are all DIFFERENT. "wohne" ≠ "wohnt" ≠ "wohnet" ≠ "wohn". "heiße" ≠ "heiß" ≠ "heißt" ≠ "heißen". "spreche" ≠ "sprech" ≠ "sprecht" ≠ "sprichst".
3. NEVER add a word that was not spoken. If the speaker says "Ich komme Deutschland" (without "aus"), you write "Ich komme Deutschland". Do not add "aus", "der", "den", "ich", "Jahre", "alt" or anything else.
4. NEVER remove a word that was spoken, even if it is wrong, repeated or unnecessary. Write repetitions and self-corrections as spoken ("Ich wohne wohne in Berlin", "Ich heiße … nein, ich bin Anna").
5. NEVER replace a wrong word with the correct one. If the speaker says "Schweise", write "Schweise", not "Schweiz". If they say "Doichland", write "Doichland".
6. Words that do not exist in German: spell them as they sound, using German spelling (e.g. "hayse", "wone", "Hamburk").
7. Azerbaijani (or other non-German) words: write them in their own language with Latin letters, exactly as spoken (e.g. "İsveç", "mənim", "adım"). Do NOT translate them.
8. Numbers: write them as words exactly as spoken ("fünfunddreißig", "zweiundvierzig", "fünf und dreißig" if spoken separately). Never convert to digits.
9. Do NOT guess. If a word is truly not understandable, write [?] in its place. Do not replace it with a likely word.
10. Do not use the context of the lesson to "improve" the text. You do NOT know what the speaker was supposed to say, and you must not try to guess it.
11. Silence, breathing, noise or only "äh/ähm": return an empty "verbatim" and set "noise_only" to true. Keep "äh"/"ähm" out of the transcript.
12. Punctuation: only a full stop at the end of each sentence. Capitalisation does not matter.

EXAMPLES (spoken → what you write)
- spoken "Ich kommet aus Spanien" → "Ich kommet aus Spanien."
- spoken "Ich komme Spanien" → "Ich komme Spanien."
- spoken "Ich wohnt in Berlin" → "Ich wohnt in Berlin."
- spoken "Ich heiß Maria" (no final -e) → "Ich heiß Maria."
- spoken "Ich heiße Maria" (with final -e) → "Ich heiße Maria."
- spoken "Komme aus Italien" → "Komme aus Italien."
- spoken "Ich bin dreißig Jahre" → "Ich bin dreißig Jahre."
- spoken "Ich komme aus Schweise" → "Ich komme aus Schweise."
- spoken "Ich komme aus İsveç" → "Ich komme aus İsveç."
- spoken "Ich spreche Deutsch" (correct) → "Ich spreche Deutsch."

Before answering, check your transcript word by word against the audio: is every ending exactly as heard? Did you add or remove any word? Did you replace any wrong word? If yes, fix your transcript so it matches the audio again.

OUTPUT: only JSON matching the schema.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    verbatim: { type: 'STRING', description: 'Exactly what was spoken, uncorrected.' },
    noise_only: { type: 'BOOLEAN' },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
  },
  required: ['verbatim', 'noise_only', 'confidence'],
};

// 16 kHz, 16-bit, mono PCM → WAV
function pcmToWavBase64(pcm) {
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
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Səsi hərfi yazıya çevirir.
 * @returns {Promise<{text:string, noise:boolean, confidence:string, model:string}|null>} xəta olsa null
 */
export async function verifyAudio(pcm, apiKey, { preferred, timeoutMs = 8000 } = {}) {
  if (!pcm || pcm.length < 16000 * 0.4) return null; // 0.4 saniyədən qısa — boşdur
  const wav = pcmToWavBase64(pcm);
  const models = [...new Set([preferred, ...VERIFIER_MODELS].filter(Boolean))];
  for (const model of models) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(`${API}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VERIFIER_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'audio/wav', data: wav } },
                { text: 'Transcribe this utterance verbatim. Do not correct anything.' },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
        }),
      });
      clearTimeout(timer);
      // Model yoxdur / dəstəklənmir → növbəti model
      if (res.status === 404 || res.status === 400) continue;
      if (!res.ok) return null; // limit (429) və s. — bu dəfə yoxlayıcısız
      const json = await res.json();
      const raw = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      const out = JSON.parse(raw);
      return {
        text: String(out.verbatim || '').trim(),
        noise: !!out.noise_only,
        confidence: out.confidence || 'medium',
        model,
      };
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
  return null;
}
