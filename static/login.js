// 外部から参照する変数は最初 null にしておく
export let currentUser = null;
let auth = null;

// Firebaseをバックグラウンドで読み込む関数
export async function initFirebase() {
    // ここで初めて重いファイルを読みに行く（非同期）
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js');
    const { getAuth, GoogleAuthProvider, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');

    const app = initializeApp(window.FIREBASE_CONFIG);
    auth = getAuth(app);
    const db = getFirestore(app);

    // ログイン状態の監視を開始
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        // 準備ができたらイベントを飛ばして script.js に知らせる
        window.dispatchEvent(new Event('auth-ready'));
    });

    return { auth, db };
}

// 実際のログイン処理（ボタンが押されたとき用）
export async function loginWithGoogle() {
    if (!auth) return; // まだ読み込み中なら何もしない
    const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js');
    const provider = new GoogleAuthProvider();
    return await signInWithPopup(auth, provider);
}
