import './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
    prompt: 'select_account'
});

export let currentUser = null;

// --- ログイン ---
document.getElementById("login-btn").addEventListener("click", async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
        alert(`ようこそ、${currentUser.displayName}さん！`);
    } catch (error) {
        console.error("ログインエラー:", error);
        alert("ログインに失敗しました。");
    }
});

// --- ログアウト ---
document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
        await signOut(auth);
        currentUser = null;
        alert("ログアウトしました");
    } catch (error) {
        console.error("ログアウトエラー:", error);
        alert("ログアウトに失敗しました");
    }
});

// --- ログイン状態監視 ---
const status = document.getElementById("login-status-panel");
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        status.textContent = `ログイン中： ${user.displayName} さん`;
        document.getElementById("login-btn").style.display = "none";
        document.getElementById("logout-btn").style.display = "block";
    } else {
        status.textContent = "未ログイン";
        document.getElementById("login-btn").style.display = "block";
        document.getElementById("logout-btn").style.display = "none";
    }
});

