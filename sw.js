const CACHE_NAME = 'static-v1.7.0';
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
    const cachedResponse = await cache.match(event.request);

    // キャッシュが存在し、有効期限内ならそれを返す
    if (cachedResponse) {
      const dateHeader = cachedResponse.headers.get('sw-cache-time');
      if (dateHeader && Date.now() - Number(dateHeader) < CACHE_TTL) {
        return cachedResponse;
      }
    }

    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse.ok) {
        // 保存時刻付きでキャッシュに保存
        const headers = new Headers(networkResponse.headers);
        headers.append('sw-cache-time', Date.now().toString());
        const cloned = new Response(await networkResponse.clone().blob(), { headers });
        await cache.put(event.request, cloned);
      }
      return networkResponse;
    } catch {
      // ネットワーク失敗時は古いキャッシュでも返す
      if (cachedResponse) return cachedResponse;
      if (event.request.mode === 'navigate') {
        return cache.match(`${BASE_PATH}index.html`);
      }
    }
  })());
});
