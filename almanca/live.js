// Gemini Live API (native audio) üçün brauzer müştərisi.
// Mikrofon → 16 kHz PCM → WebSocket; cavab 24 kHz PCM → dinamik.
// Bağlantı qopsa (məs. 1011 server xətası) avtomatik bərpa edir: əvvəlcə eyni
// söhbəti davam etdirir (session resumption), alınmasa ehtiyat modelə keçir.

const WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const AC = window.AudioContext || window.webkitAudioContext;
const MAX_RETRIES = 4;

function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export class LiveSession {
  /**
   * @param {{apiKey:string, model:string, fallbackModels?:string[], voice:string, systemText:string,
   *          pushToTalk:boolean, tools?:object[], onTool?:Function, onEvent:(type:string, data?:any)=>void}} opts
   */
  constructor(opts) {
    this.o = opts;
    this.models = [opts.model, ...(opts.fallbackModels || []).filter((m) => m !== opts.model)];
    this.modelIdx = 0;
    this.ws = null;
    this.ready = false;
    this.sending = !opts.pushToTalk;
    this.closed = false;
    this.sources = new Set();
    this.nextTime = 0;
    this.resumeHandle = null;
    this.retries = 0;
    this.everReady = false;
    this.turnAudio = 0;
    // Yoxlayıcı üçün: düymə basılı olanda deyilən səsin surəti
    this.capture = null;
    // Yazıya çevirmə üçün dil ipucu (almanca əsas, azərbaycanca ikinci)
    this.langHint = true;
    // Yazıya çevirmə "hərfi" rejimdə: eşitdiyini düzəltmədən yazsın ("kommet" → "kommet", "komme" yox)
    this.verbatim = true;
  }

  get model() {
    return this.models[this.modelIdx];
  }

  emit(type, data) {
    this.o.onEvent && this.o.onEvent(type, data);
  }

  // İstifadəçi toxunuşu ilə çağırılmalıdır (iOS səs icazəsi üçün).
  async start() {
    // Cihazın öz sürətində; 24 kHz səs buferləri avtomatik çevrilir (bəzi Android-lərdə 24 kHz kontekst səssiz qalırdı)
    this.playCtx = new AC();
    this.micCtx = new AC();
    // Səsi gücləndir + sıxıcı (cızıltı olmasın)
    this.outGain = this.playCtx.createGain();
    this.outGain.gain.value = 1.8;
    const comp = this.playCtx.createDynamicsCompressor();
    this.outGain.connect(comp).connect(this.playCtx.destination);
    await Promise.all([this.playCtx.resume(), this.micCtx.resume()]);

    // "Bas və danış" rejimində əks-səda söndürücü lazım deyil. Onu söndürmək Android-də
    // səsin qulaqcığa (zəng dinamikinə) keçməsinin qarşısını alır — səs əsas dinamikdən gəlir.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: !this.o.pushToTalk,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (this.closed) return this.cleanup();

    await this.micCtx.audioWorklet.addModule(new URL('./pcm-worklet.js', import.meta.url));
    const src = this.micCtx.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.micCtx, 'pcm-capture');
    this.worklet.port.onmessage = (e) => this.onPcm(e.data);
    const silent = this.micCtx.createGain();
    silent.gain.value = 0;
    src.connect(this.worklet).connect(silent).connect(this.micCtx.destination);

    this.connect();
  }

  connect() {
    const { apiKey, voice, systemText, tools } = this.o;
    const resuming = !!this.resumeHandle;
    this.ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(apiKey)}`);
    // Sinxron oxumaq üçün: mesajların sırası qarışmasın
    this.ws.binaryType = 'arraybuffer';
    const decoder = new TextDecoder();
    const ws = this.ws;
    let setupDone = false;

    ws.onopen = () => {
      const setup = {
        model: `models/${this.model}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          // Aşağı temperatur: müəllim plana daha dəqiq əməl edir, mövzudan yayınmır
          temperature: 0.4,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
        systemInstruction: { parts: [{ text: systemText }] },
        // Dil ipucu olmasa, sistem dili özü təxmin edir və bəzən gürcü/rus hərfləri ilə yazır
        inputAudioTranscription: {
          ...(this.langHint ? { languageCodes: this.o.transcriptionLanguages || ['de-DE', 'az-AZ'] } : {}),
          ...(this.verbatim ? { mode: 'VERBATIM' } : {}),
        },
        outputAudioTranscription: {},
        // Bağlantı qopanda eyni söhbəti davam etdirmək üçün
        sessionResumption: this.resumeHandle ? { handle: this.resumeHandle } : {},
        // Uzun dərslərdə kontekst dolmasın
        contextWindowCompression: { slidingWindow: {} },
      };
      if (tools && tools.length) setup.tools = [{ functionDeclarations: tools }];
      this.send({ setup });
    };

    ws.onmessage = (e) => {
      if (ws !== this.ws) return;
      const txt = typeof e.data === 'string' ? e.data : decoder.decode(e.data);
      let msg;
      try {
        msg = JSON.parse(txt);
      } catch {
        return;
      }
      if (msg.setupComplete) setupDone = true;
      this.handle(msg, resuming);
    };

    ws.onclose = (e) => {
      if (ws !== this.ws) return;
      this.ready = false;
      if (this.closed) return;
      this.stopPlayback();

      // Model "hərfi" rejimi qəbul etmirsə (1007), onsuz yenidən qoşul
      if (!setupDone && e.code === 1007 && this.verbatim) {
        this.verbatim = false;
        this.connect();
        return;
      }
      // Model dil ipucunu qəbul etmirsə (1007), ipucusuz yenidən qoşul
      if (!setupDone && e.code === 1007 && this.langHint) {
        this.langHint = false;
        this.connect();
        return;
      }

      // Qoşulma hələ alınmamış qopdu:
      if (!setupDone && e.code !== 1006 && e.code !== 1000) {
        // köhnə söhbət açarı keçərsizdirsə — eyni modelə açarsız yenidən qoşul
        if (this.resumeHandle) {
          this.resumeHandle = null;
          this.connect();
          return;
        }
        // bu model bu açarla əlçatan deyil və ya ayarları qəbul etmir — növbəti modeli sına
        if (this.modelIdx < this.models.length - 1) {
          const skipped = this.model;
          this.modelIdx++;
          this.langHint = true;
          this.emit('modelSkip', { model: skipped, code: e.code, next: this.model });
          this.connect();
          return;
        }
      }

      // 1000 = normal bitmə, 1008 = açar/model qəbul olunmadı — bunları təkrarlamırıq
      const retryable = e.code !== 1000 && e.code !== 1008 && e.code !== 1007;
      if (retryable && this.retries < MAX_RETRIES) {
        this.retries++;
        // 2-ci uğursuzluqdan sonra ehtiyat modelə keç (köhnə söhbət açarı yeni modeldə işləmir)
        if (this.retries >= 2 && this.modelIdx < this.models.length - 1) {
          this.modelIdx++;
          this.resumeHandle = null;
          this.langHint = true;
        }
        this.emit('reconnecting', { attempt: this.retries, code: e.code, model: this.model });
        setTimeout(() => !this.closed && this.connect(), 500 * this.retries);
        return;
      }
      this.emit('close', { code: e.code, reason: e.reason });
    };
  }

  handle(m, resuming) {
    if (m.setupComplete) {
      this.ready = true;
      const wasReady = this.everReady;
      this.everReady = true;
      this.emit('ready', { reconnect: wasReady, resumed: wasReady && resuming, model: this.model });
      return;
    }
    if (m.sessionResumptionUpdate) {
      const u = m.sessionResumptionUpdate;
      if (u.resumable && u.newHandle) this.resumeHandle = u.newHandle;
      return;
    }
    if (m.goAway) this.emit('goaway', m.goAway);
    if (m.toolCall) {
      // Model funksiya çağırır (səhvi qeyd et, kartı göstər) — dərhal cavab veririk
      // onTool Promise qaytara bilər (məs. yazının gəlməsini gözləmək üçün)
      const wsAtCall = this.ws;
      Promise.all(
        (m.toolCall.functionCalls || []).map(async (fc) => {
          let result = 'ok';
          try {
            result = (this.o.onTool && (await this.o.onTool(fc.name, fc.args || {}))) || 'ok';
          } catch (err) {
            result = 'error: ' + err.message;
          }
          return { id: fc.id, name: fc.name, response: { result } };
        }),
      ).then((responses) => {
        // bağlantı arada qopubsa, köhnə cavabı yeni bağlantıya göndərmə
        if (this.ws === wsAtCall) this.send({ toolResponse: { functionResponses: responses } });
      });
      return;
    }
    const sc = m.serverContent;
    if (!sc) return;
    if (sc.interrupted) {
      this.stopPlayback();
      this.emit('interrupted');
    }
    const parts = (sc.modelTurn && sc.modelTurn.parts) || [];
    for (const p of parts) {
      if (p.inlineData && p.inlineData.data) this.play(p.inlineData.data);
    }
    if (sc.inputTranscription && sc.inputTranscription.text) this.emit('userText', sc.inputTranscription.text);
    if (sc.outputTranscription && sc.outputTranscription.text) this.emit('aiText', sc.outputTranscription.text);
    if (sc.turnComplete) {
      this.retries = 0; // uğurlu cavab — sayğacı sıfırla
      this.emit('turnComplete', { audio: this.turnAudio });
      this.turnAudio = 0;
    }
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  onPcm(data) {
    // Adi hissə: ArrayBuffer. "flush" cavabı: { flush: ArrayBuffer }
    const isFlush = data && data.flush !== undefined;
    const buf = isFlush ? data.flush : data;
    if (buf && buf.byteLength) {
      const pcm = new Int16Array(buf);
      let sum = 0;
      for (let i = 0; i < pcm.length; i += 8) sum += Math.abs(pcm[i]);
      this.emit('level', Math.min(1, (sum / Math.max(1, pcm.length / 8) / 32768) * 6));
      if (this.capture && (this.sending || isFlush)) this.capture.push(new Int16Array(buf.slice(0)));
      if (this.ready && (this.sending || isFlush)) {
        this.send({
          realtimeInput: { audio: { data: bytesToB64(new Uint8Array(buf)), mimeType: 'audio/pcm;rate=16000' } },
        });
      }
    }
    if (isFlush && this.capture) {
      // Cümlə bitdi: səsi bir parça kimi ver (yoxlayıcıya göndərmək üçün)
      const parts = this.capture;
      this.capture = null;
      const total = parts.reduce((n, p) => n + p.length, 0);
      const pcm = new Int16Array(total);
      let o = 0;
      for (const p of parts) {
        pcm.set(p, o);
        o += p.length;
      }
      this.emit('utterance', pcm);
    }
    if (isFlush && this.ready) this.sendSilenceAndEnd();
  }

  // Server cümlənin bitdiyini sükutdan anlayır: düymə buraxılanda ~0.8 san sükut göndər, sonra "bitdi" de
  sendSilenceAndEnd(seconds = 0.8) {
    if (!this.ready) return;
    const zero = bytesToB64(new Uint8Array(3200)); // 1600 nümunə = 0.1 san
    for (let k = 0; k < Math.round(seconds * 10); k++) {
      this.send({ realtimeInput: { audio: { data: zero, mimeType: 'audio/pcm;rate=16000' } } });
    }
    this.send({ realtimeInput: { audioStreamEnd: true } });
  }

  // Mikrofonu aç/bağla. "Bas və danış" rejimində düymə basılı olanda açıqdır.
  // Serverin avtomatik nitq aşkarlaması həmişə açıqdır (əl ilə rejim 1011 xətasına səbəb olurdu).
  setSending(on) {
    if (on === this.sending) return;
    if (on) {
      if (this.o.pushToTalk) {
        this.stopPlayback();
        this.capture = [];
      }
      this.sending = true;
      return;
    }
    this.sending = false;
    // Buferdə qalan son səsi də göndər, sonra "səs bitdi" de
    if (this.worklet) this.worklet.port.postMessage('flush');
    else this.sendSilenceAndEnd();
  }

  sendText(text) {
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
  }

  play(b64) {
    if (this.playCtx.state !== 'running') this.playCtx.resume();
    const bytes = b64ToBytes(b64);
    this.turnAudio += bytes.length;
    const pcm = new Int16Array(bytes.buffer, 0, bytes.byteLength >> 1);
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
    const buf = this.playCtx.createBuffer(1, f.length, 24000);
    buf.copyToChannel(f, 0);
    const s = this.playCtx.createBufferSource();
    s.buffer = buf;
    s.connect(this.outGain);
    const t = Math.max(this.nextTime, this.playCtx.currentTime + 0.05);
    s.start(t);
    this.nextTime = t + buf.duration;
    this.sources.add(s);
    s.onended = () => {
      this.sources.delete(s);
      if (!this.sources.size) this.emit('speaking', false);
    };
    this.emit('speaking', true);
  }

  // Səs yoxlaması: qısa siqnal
  testTone() {
    if (!this.playCtx) return;
    this.playCtx.resume();
    const o = this.playCtx.createOscillator();
    const g = this.playCtx.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.25, this.playCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.playCtx.currentTime + 0.6);
    o.connect(g).connect(this.outGain);
    o.start();
    o.stop(this.playCtx.currentTime + 0.6);
  }

  stopPlayback() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources.clear();
    this.nextTime = 0;
    this.emit('speaking', false);
  }

  stop() {
    this.closed = true;
    try {
      this.ws && this.ws.close();
    } catch {}
    this.cleanup();
  }

  cleanup() {
    this.stopPlayback();
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    for (const ctx of [this.micCtx, this.playCtx]) {
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
    }
  }
}
