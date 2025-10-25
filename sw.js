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
  event.respondWith(
    fetch(event.request).catch(err => {
      console.error('Fetch failed for:', event.request.url, err);
      // 必要に応じて fallback を返すことも可能
      return new Response('Network error occurred', {
        status: 408,
        statusText: 'Network Error'
      });
    })
  );
});
