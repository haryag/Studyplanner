const CACHE_NAME = 'static-v1.6.0';
const BASE_PATH = '/Studyplanner/';
const FILES_TO_CACHE = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}static/style.css`,
  `${BASE_PATH}static/script.js`,
  `${BASE_PATH}static/login.js`,
  `${BASE_PATH}static/firebase/firebase-app.js`,
  `${BASE_PATH}static/firebase/firebase-auth.js`,
  `${BASE_PATH}static/firebase/firebase-firestore.js`,
];

// --- install ---
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

// --- activate ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key.startsWith('static-') && key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// --- fetch ---
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    const networkFetch = fetch(event.request)
      .then(response => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
      .catch(() => null);

    if (cached) {
      networkFetch.catch(() => {}); // 裏で更新
      return cached;
    }

    const response = await networkFetch;
    if (response) return response;

    const fallback = await cache.match(event.request);
    if (fallback) return fallback;

    if (event.request.mode === 'navigate') {
      return cache.match(`${BASE_PATH}index.html`);
    }
  })());
});
