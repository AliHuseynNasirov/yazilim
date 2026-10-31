// Gemini Live API (native audio) üçün brauzer müştərisi.
// Mikrofon → 16 kHz PCM → WebSocket; cavab 24 kHz PCM → dinamik.

const WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const AC = window.AudioContext || window.webkitAudioContext;

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
   * @param {{apiKey:string, model:string, voice:string, systemText:string,
   *          pushToTalk:boolean, onEvent:(type:string, data?:any)=>void}} opts
   */
  constructor(opts) {
    this.o = opts;
    this.ws = null;
    this.ready = false;
    this.sending = !opts.pushToTalk;
    this.closed = false;
    this.sources = new Set();
    this.nextTime = 0;
  }

  emit(type, data) {
    this.o.onEvent && this.o.onEvent(type, data);
  }

  // İstifadəçi toxunuşu ilə çağırılmalıdır (iOS səs icazəsi üçün).
  async start() {
    this.playCtx = new AC({ sampleRate: 24000 });
    this.micCtx = new AC();
    await Promise.all([this.playCtx.resume(), this.micCtx.resume()]);

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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
    const { apiKey, model, voice, systemText, pushToTalk } = this.o;
    this.ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(apiKey)}`);
    // Sinxron oxumaq üçün: mesajların sırası qarışmasın
    this.ws.binaryType = 'arraybuffer';
    const decoder = new TextDecoder();

    this.ws.onopen = () => {
      const setup = {
        model: `models/${model}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          // Aşağı temperatur: müəllim plana daha dəqiq əməl edir, mövzudan yayınmır
          temperature: 0.4,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
        systemInstruction: { parts: [{ text: systemText }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      };
      if (pushToTalk) {
        setup.realtimeInputConfig = { automaticActivityDetection: { disabled: true } };
      }
      this.send({ setup });
    };

    this.ws.onmessage = (e) => {
      const txt = typeof e.data === 'string' ? e.data : decoder.decode(e.data);
      let msg;
      try {
        msg = JSON.parse(txt);
      } catch {
        return;
      }
      this.handle(msg);
    };

    this.ws.onclose = (e) => {
      this.ready = false;
      if (!this.closed) this.emit('close', { code: e.code, reason: e.reason });
    };
  }

  handle(m) {
    if (m.setupComplete) {
      this.ready = true;
      this.emit('ready');
      return;
    }
    if (m.goAway) this.emit('goaway', m.goAway);
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
    if (sc.turnComplete) this.emit('turnComplete');
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  onPcm(buf) {
    const pcm = new Int16Array(buf);
    let sum = 0;
    for (let i = 0; i < pcm.length; i += 8) sum += Math.abs(pcm[i]);
    this.emit('level', Math.min(1, (sum / (pcm.length / 8) / 32768) * 6));
    if (!this.ready || !this.sending) return;
    this.send({
      realtimeInput: { audio: { data: bytesToB64(new Uint8Array(buf)), mimeType: 'audio/pcm;rate=16000' } },
    });
  }

  // Sərbəst rejimdə: mikrofonu aç/bağla. "Bas və danış" rejimində: basılı saxla.
  setSending(on) {
    if (on === this.sending) return;
    this.sending = on;
    if (!this.ready) return;
    if (this.o.pushToTalk) {
      if (on) {
        this.stopPlayback();
        this.send({ realtimeInput: { activityStart: {} } });
      } else {
        this.send({ realtimeInput: { activityEnd: {} } });
      }
    } else if (!on) {
      this.send({ realtimeInput: { audioStreamEnd: true } });
    }
  }

  sendText(text) {
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
  }

  play(b64) {
    const bytes = b64ToBytes(b64);
    const pcm = new Int16Array(bytes.buffer, 0, bytes.byteLength >> 1);
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
    const buf = this.playCtx.createBuffer(1, f.length, 24000);
    buf.copyToChannel(f, 0);
    const s = this.playCtx.createBufferSource();
    s.buffer = buf;
    s.connect(this.playCtx.destination);
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
