const CACHE_NAME = 'static-v1.3.0';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './static/style.css',
  './static/script.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(FILES_TO_CACHE.map(async file => {
        try {
          const resp = await fetch(file);
          if (!resp.ok) throw new Error(`${file} を取得できません`);
          await cache.put(file, resp);
        } catch (err) {
          console.warn('キャッシュ失敗（無視）:', err);
        }
      }))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (event.request.method === 'GET') {
          const cache = await caches.open(CACHE_NAME);
          if (response.type !== 'opaque') {
            cache.put(event.request, response.clone());
          }
        }
        return response;
      } catch (err) {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        throw err;
      }
    })()
  );
});
