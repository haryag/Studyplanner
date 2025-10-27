// login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgDtdyFtxtLEMZ6Gt0_haDlpLFg5UYkBQ",
    authDomain: "studyplanner-12345.firebaseapp.com",
    projectId: "studyplanner-12345",
    storageBucket: "studyplanner-12345.firebasestorage.app",
    messagingSenderId: "11066629765",
    appId: "1:11066629765:web:04cd920de2a077a16713ec"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export let currentUser = null;

// 要素取得
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const status = document.getElementById("login-status");

// --- ログイン処理 ---
loginBtn.addEventListener("click", async () => {
    try {
        // モバイルかどうかで方式を変える
        if (/Mobi|Android/i.test(navigator.userAgent)) {
            // モバイル端末 → リダイレクト
            await signInWithRedirect(auth, provider);
        } else {
            // PCブラウザ → ポップアップ
            const result = await signInWithPopup(auth, provider);
            currentUser = result.user;
            alert(`ようこそ、${currentUser.displayName}さん！`);
        }
    } catch (error) {
        console.error("ログインエラー:", error);
        alert("ログインに失敗しました。");
    }
});

// --- リダイレクト結果をページロード後に取得 ---
window.addEventListener("DOMContentLoaded", async () => {
    try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
            currentUser = result.user;
            alert(`ようこそ、${currentUser.displayName}さん！`);
        }
    } catch (error) {
        console.error("リダイレクト後の処理エラー:", error);
    }
});

// --- ログアウト処理 ---
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        currentUser = null;
        status.textContent = "未ログイン";
        alert("ログアウトしました");
    } catch (error) {
        console.error("ログアウトエラー:", error);
        alert("ログアウトに失敗しました");
    }
});

// --- ログイン状態監視 ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        status.textContent = `ログイン中: ${user.displayName}さん`;
    } else {
        status.textContent = "未ログイン";
    }
});
