// Mikrofon səsini 16 kHz, 16-bit PCM-ə çevirir və ~100 ms-lik hissələrlə göndərir.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.chunk = new Int16Array(1600);
    this.len = 0;
    this.acc = 0;
    this.n = 0;
    this.t = 0;
    // "flush": buferdə qalan yarımçıq hissəni dərhal göndər
    this.port.onmessage = (e) => {
      if (e.data !== 'flush') return;
      const part = this.chunk.slice(0, this.len);
      this.len = 0;
      this.port.postMessage({ flush: part.buffer }, [part.buffer]);
    };
  }

  push(v) {
    const s = Math.max(-1, Math.min(1, v));
    this.chunk[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.len === this.chunk.length) {
      this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
      this.chunk = new Int16Array(1600);
      this.len = 0;
    }
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      // Sadə endirmə: hər pəncərənin ortalaması
      this.acc += ch[i];
      this.n++;
      this.t += 1;
      if (this.t >= this.ratio) {
        this.t -= this.ratio;
        this.push(this.acc / this.n);
        this.acc = 0;
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCapture);
