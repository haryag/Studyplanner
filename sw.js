const CACHE_NAME = 'static-v1.0.2'; // バージョン管理
const FILES_TO_CACHE = [
  './',
  './index.html',
  './static/style.css',
  './static/script.js'
];

// インストール時：静的リソースをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => 
      Promise.all(FILES_TO_CACHE.map(file =>
        fetch(file).then(resp => {
          if (!resp.ok) throw new Error(`${file} を取得できません`);
          return cache.put(file, resp);
        })
      ))
    ).catch(err => console.error('キャッシュ失敗:', err))
  );
  self.skipWaiting();
});

// 有効化時：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch: キャッシュ優先戦略
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
