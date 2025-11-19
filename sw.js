const CACHE_NAME = 'static-v1.9.0';
const BASE_PATH = '/Studyplanner/';
const CACHE_TTL = 1 * 24 * 60 * 60 * 1000; // 1日間

const FILES_TO_CACHE = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}static/style.css`,
  `${BASE_PATH}static/script.js`,
  `${BASE_PATH}static/login.js`,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);

    // 有効期限内 → 即キャッシュ返す
    if (cached) {
      const t = Number(cached.headers.get('sw-cache-time'));
      if (t && Date.now() - t < CACHE_TTL) {
        return cached;
      }
    }

    // 期限切れまたは未キャッシュ → ネットワーク
    try {
      if (network.type === 'opaque') return network;
      const network = await fetch(event.request);
      if (network.ok) {
        const headers = new Headers(network.headers);
        headers.set('sw-cache-time', Date.now().toString());
        const cloned = new Response(await network.clone().blob(), { headers });
        cache.put(event.request, cloned);
      }
      return network;
    } catch {
      // ネットワーク失敗 → 古いキャッシュでも返す
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        return cache.match(`${BASE_PATH}index.html`);
      }
    }
  })());
});
