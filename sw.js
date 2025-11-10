const CACHE_NAME = 'static-v1.5.0';
const BASE_PATH = '/Studyplanner/';

const FILES_TO_CACHE = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}static/style.css`,
  `${BASE_PATH}static/script.js`,
];

// --- install: 事前キャッシュ ---
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// --- activate: 古いキャッシュ削除 ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// --- fetch: Cache First + 更新を裏で実行 ---
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => null);

      // キャッシュがあれば即座に返す（初期表示が速くなる）
      if (cachedResponse) {
        // ネットワーク更新を裏で実行
        networkFetch;
        return cachedResponse;
      }

      // キャッシュがなければネットワーク（初回のみ遅い）
      const response = await networkFetch;
      if (response) return response;

      // オフライン時のフォールバック
      if (event.request.mode === 'navigate') {
        return caches.match(`${BASE_PATH}index.html`);
      }
    })()
  );
});
