const CACHE_NAME = 'static-v2.3.0';
const BASE_PATH = '/Studyplanner/';

const FILES_TO_CACHE = [
    BASE_PATH,
    `${BASE_PATH}index.html`,
    `${BASE_PATH}static/style.css`,
    `${BASE_PATH}static/basic-style.css`,
    `${BASE_PATH}static/script.js`,
    `${BASE_PATH}static/login.js`,
    `${BASE_PATH}static/firebase-config.js`,
    // Firebaseのライブラリ
    'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js'
];

// 初回プリキャッシュ
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
    );
    // self.skipWaiting();  // 有効にしない方がよい
});

// 古いキャッシュ削除
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Stale-While-Revalidate
self.addEventListener('fetch', event => {
    // 自分のオリジン以外（chrome-extension:// 等）は無視する
    const url = new URL(event.request.url);
    const allowedOrigins = [
        self.location.origin, 
        'https://fonts.googleapis.com', 
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com',
        'https://www.gstatic.com' // Firebase用
    ];
    if (!allowedOrigins.some(origin => url.href.startsWith(origin))) {
        return;
    }
  
    // GET リクエスト以外（POST / PUT など）はキャッシュ対象にしない
    if (event.request.method !== 'GET') return;
  
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
    
        // 1. まずキャッシュを探す（存在すれば即使う）
        const cached = await cache.match(event.request);
    
        // 2. ネットワーク取得をバックグラウンドで実行
        const networkPromise = fetch(event.request)
            .then(async response => {
                // 正常応答ならキャッシュ更新
                if (response && response.ok) {
                    await cache.put(event.request, response.clone());
                }
                return response;
            })
            .catch(() => null);
    
        // 3. キャッシュがあれば即返して高速化
        if (cached) {
            return cached;
        }
    
        // 4. キャッシュが無い場合はネットワーク結果を返す
        const networkResponse = await networkPromise;
        if (networkResponse) {
            return networkResponse;
        }
    
        // 5. ネットワーク失敗時、ナビゲーションなら index.html に fallback
        if (event.request.mode === 'navigate') {
            return cache.match(`${BASE_PATH}index.html`);
        }
    })());
});
