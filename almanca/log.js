// Dərs jurnalı: problemləri analiz etmək üçün sessiyada baş verənlər qeyd olunur
// (ASR yazısı, müəllimin eşitdiyi, tətbiqin qərarı, müəllimə gedən əmrlər, müəllimin sözləri, qopmalar).
// Şagird jurnalı kopyalayıb göndərə bilər. Yalnız bu telefonda saxlanılır.

const KEY = 'dA1.debugLog';
const MAX = 800;

let entries = [];
let t0 = Date.now();
try {
  entries = JSON.parse(localStorage.getItem(KEY) || '[]');
} catch {
  entries = [];
}
let saveTimer = null;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX)));
    } catch {}
  }, 300);
};

export const dlog = {
  start(title) {
    t0 = Date.now();
    entries.push({ t: new Date().toISOString(), k: '=== START', x: title });
    persist();
  },
  add(kind, text) {
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    entries.push({ t: sec, k: kind, x: String(text == null ? '' : text).slice(0, 1200) });
    if (entries.length > MAX) entries = entries.slice(-MAX);
    persist();
  },
  text() {
    return entries.map((e) => `[${e.t}] ${e.k}: ${e.x}`).join('\n');
  },
  clear() {
    entries = [];
    persist();
  },
};

// Jurnal pəncərəsi: bax, kopyala, yüklə, təmizlə
export function showLogOverlay(root) {
  const ov = document.createElement('div');
  ov.className = 'finish logov';
  ov.innerHTML = `<div class="finish-box logbox">
    <h2>📋 Dərs jurnalı</h2>
    <p class="muted small">Problem olanda "Kopyala" bas və mətni söhbətə yapışdır — səbəbini oradan tapacağam.</p>
    <textarea readonly></textarea>
    <div class="logbtns">
      <button class="btn primary" data-a="copy">📋 Kopyala</button>
      <button class="btn ghost" data-a="dl">⬇️ Fayl</button>
      <button class="btn ghost" data-a="clear">🗑 Təmizlə</button>
      <button class="btn ghost" data-a="close">Bağla</button>
    </div>
  </div>`;
  const ta = ov.querySelector('textarea');
  ta.value = dlog.text() || '(jurnal boşdur)';
  root.appendChild(ov);
  setTimeout(() => (ta.scrollTop = ta.scrollHeight), 0);
  ov.addEventListener('click', async (e) => {
    const a = e.target.dataset && e.target.dataset.a;
    if (!a) return;
    if (a === 'close') ov.remove();
    if (a === 'clear' && confirm('Jurnal silinsin?')) {
      dlog.clear();
      ta.value = '(jurnal boşdur)';
    }
    if (a === 'copy') {
      try {
        await navigator.clipboard.writeText(ta.value);
        e.target.textContent = '✅ Kopyalandı';
      } catch {
        ta.focus();
        ta.select();
        document.execCommand('copy');
        e.target.textContent = '✅ Seçildi — kopyala';
      }
    }
    if (a === 'dl') {
      const url = URL.createObjectURL(new Blob([ta.value], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `jurnal-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
}
