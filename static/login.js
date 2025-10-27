// login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithRedirect, 
    getRedirectResult, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Firebase 初期化
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

// DOM要素
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const status = document.getElementById("login-status");

// ユーザー情報共有用
export let currentUser = null;
let redirectProcessed = false;  // 重要：リダイレクト結果が処理済みか

// --- ログインボタン ---
loginBtn.addEventListener("click", () => {
    signInWithRedirect(auth, provider);
});

// --- リダイレクト結果をページロード時に処理 ---
getRedirectResult(auth)
    .then((result) => {
        redirectProcessed = true;  // このタイミングで処理済みフラグ
        if (result && result.user) {
            currentUser = result.user;
            status.textContent = `ログイン中: ${currentUser.displayName}さん`;
            alert(`ようこそ、${currentUser.displayName}さん！`);
        }
    })
    .catch((error) => {
        redirectProcessed = true;
        console.error("ログインエラー:", error);
        alert("ログインに失敗しました。");
    });

// --- ログアウト ---
logoutBtn.addEventListener("click", () => {
    signOut(auth)
        .then(() => {
            currentUser = null;
            status.textContent = "未ログイン";
            alert("ログアウトしました");
        })
        .catch((error) => {
            console.error("ログアウトエラー:", error);
            alert("ログアウトに失敗しました");
        });
});

// --- ログイン状態監視 ---
onAuthStateChanged(auth, (user) => {
    // リダイレクト結果をまだ処理していなければ何もしない
    if (!redirectProcessed) return;

    currentUser = user;
    if (user) {
        status.textContent = `ログイン中: ${user.displayName}さん`;
    } else {
        status.textContent = "未ログイン";
    }
});
