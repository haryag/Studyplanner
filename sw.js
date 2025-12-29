importScripts('src/js/app-version.js');

const CACHE_NAME = 'static-' + self.APP_VERSION;
const BASE_PATH = '/Studyplanner/';

// ----- キャッシュするファイル -----
const FILES_TO_CACHE = [
    BASE_PATH,
    `${BASE_PATH}index.html`,
    `${BASE_PATH}src/css/style.css`,
    `${BASE_PATH}src/css/style-basic.css`,
    `${BASE_PATH}src/js/sys-script.js`,
    `${BASE_PATH}src/js/sys-auth.js`,
    `${BASE_PATH}src/js/fb.js`,
    `${BASE_PATH}src/js/app-version.js`,
    
    // Font Awesome・Firebase
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js'
];

// ----- 初回プリキャッシュ -----
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
    );
    // ユーザーの許可なしにSWを入れ替えるとクラッシュの可能性あり
    // self.skipWaiting();
});

// ----- 古いキャッシュを削除 -----
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ----- メッセージを受け取って即座に入れ替える -----
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

// ----- Stale-While-Revalidate -----
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const allowedOrigins = [
        self.location.origin, 
        'https://fonts.googleapis.com', 
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com',
        'https://www.gstatic.com'  // Firebase用
    ];
    if (!allowedOrigins.some(origin => url.href.startsWith(origin))) {
        return;
    }
  
    // GET リクエスト以外（POST / PUT など）はキャッシュ対象にしない
    if (event.request.method !== 'GET') return;
  
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
    
        // 1. まずキャッシュを探す
        const cached = await cache.match(event.request);
    
        // 2. ネットワーク取得をバックグラウンドで実行
        const networkPromise = fetch(event.request)
            .then(async response => {
                const isAllowedOrigin = allowedOrigins.some(origin => event.request.url.startsWith(origin));
                const isOpaque = response.status === 0;

                if (response && (response.ok || (isAllowedOrigin && isOpaque))) {
                    await cache.put(event.request, response.clone());
                }
                return response;
            })
            .catch(() => null);
    
        // 3. キャッシュがあればすぐ返す
        if (cached) return cached;
    
        // 4. キャッシュが無い場合はネットワーク結果を返す
        const networkResponse = await networkPromise;
        if (networkResponse) 
            return networkResponse;
        }
    
        // 5. ネットワーク失敗時、ナビゲーションなら index.html に fallback（代替手段）
        if (event.request.mode === 'navigate') {
            return cache.match(`${BASE_PATH}index.html`);
        }
    })());
});