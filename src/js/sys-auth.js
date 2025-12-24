// --- グローバル変数とエクスポート ---
export let currentUser = null;
export let auth = null;
export let db = null;

// Firebaseをバックグラウンドで非同期初期化する関数
export async function initFirebase() {
    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js');
        const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-sys-auth.js');
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');

        const app = initializeApp(window.FIREBASE_CONFIG);
        auth = getAuth(app);
        db = getFirestore(app);

        // ログイン状態の監視を開始
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            // ★追加: ログイン/ログアウトした瞬間に sys-script.js に通知してボタンを切り替えさせる
            window.dispatchEvent(new Event('auth-changed'));
        });

        // 初期化完了を通知
        window.dispatchEvent(new Event('auth-ready'));

        return { auth, db };
    } catch (e) {
        console.error("Firebase init failed:", e);
    }
}

// --- ログイン処理 ---
const loginBtn = document.getElementById("login-btn");
loginBtn.addEventListener("click", async () => {
    // 準備（ガード）
    if (!auth || !navigator.onLine) return; 

    loginBtn.disabled = true;

    try {
        const { signInWithPopup, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-sys-auth.js');
        const provider = new GoogleAuthProvider();
        
        // currentUser = result.user は onAuthStateChanged側で自動反映されるので代入不要です
        await signInWithPopup(auth, provider);
        
        // ログインに成功しても、ここにはcurrentUser名などは出さずシンプルな通知にします（安定のため）
        alert(`ようこそ！ログインに成功しました。`);
    } catch (e) {
        console.error("Login error:", e);
        alert("ログインに失敗しました。");
    } finally {
        loginBtn.disabled = false;
    }
});

// --- ログアウト処理 ---
const logoutBtn = document.getElementById("logout-btn");
logoutBtn.addEventListener("click", async () => {
    if (!auth) return; 
    if (!window.confirm("ログアウトしますか？")) return;

    logoutBtn.disabled = true;

    try {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-sys-auth.js');
        await signOut(auth);
        
        alert("ログアウトしました。");
    } catch (e) {
        console.error("Logout error:", e);
        alert("ログアウトに失敗しました。");
    } finally {
        logoutBtn.disabled = false;
    }
});
