const CACHE_NAME = 'static-v1.1.0';
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
    fetch(event.request)
      .then(resp => {
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
