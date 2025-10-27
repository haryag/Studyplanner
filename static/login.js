import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

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

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const status = document.getElementById("login-status");

// ログインボタン
loginBtn.addEventListener("click", () => {
    signInWithRedirect(auth, provider);
});

// ページロード時にリダイレクト結果を取得
getRedirectResult(auth)
    .then((result) => {
        if (result && result.user) {  // ← result が null でないかを確認
            currentUser = result.user;
            alert(`ようこそ、${currentUser.displayName}さん！`);
        }
    })
    .catch((error) => {
        console.error("ログインエラー:", error);
        alert("ログインに失敗しました。");
    });

// ログアウト
logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => {
        currentUser = null;
        status.textContent = "未ログイン";
        alert("ログアウトしました");
    });
});

// ログイン状態監視
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        status.textContent = `ログイン中: ${user.displayName}さん`;
    } else {
        status.textContent = "未ログイン";
    }
});