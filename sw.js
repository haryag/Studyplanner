// インストール時：即座にアクティブ化
self.addEventListener('install', event => {
  self.skipWaiting();
});

// 有効化時：古いキャッシュを全部削除
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      // クライアントを即時制御
      await self.clients.claim();
    })()
  );
});

// すべてのリクエストをネットワーク経由にする
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
