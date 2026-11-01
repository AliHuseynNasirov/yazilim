// Offline üçün tətbiq fayllarını keşləyir. Səsli məşq internet tələb edir.
const CACHE = 'deutsch-a1-v18';
const FILES = [
  './', './index.html', './style.css', './app.js', './data.js', './live.js',
  './prompt.js', './checker.js', './pcm-worklet.js', './manifest.json',
  './images/thomas.jpg', './images/anna.jpg', './images/lukas.jpg', './images/maria.jpg', './images/ali.jpg', './images/elena.jpg', './images/leyla.jpg', './images/john.jpg', './images/mei.jpg', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Əvvəlcə şəbəkə, alınmasa keş — yeniləmələr dərhal görünsün.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
