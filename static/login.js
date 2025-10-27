// login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgDtdyFtxtLEMZ6Gt0_haDlpLFg5UYkBQ",
    authDomain: "studyplanner-12345.firebaseapp.com",
    projectId: "studyplanner-12345",
    storageBucket: "studyplanner-12345.appspot.com",
    messagingSenderId: "11066629765",
    appId: "1:11066629765:web:04cd920de2a077a16713ec"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
    prompt: 'select_account'
});

export let currentUser = null;

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const status = document.getElementById("login-status");

// --- ログイン処理（ポップアップのみ） ---
loginBtn.addEventListener("click", async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
        alert(`ようこそ、${currentUser.displayName}さん！`);
    } catch (error) {
        console.error("ログインエラー:", error);
        alert("ログインに失敗しました。");
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
        status.textContent = `ログイン中： ${user.displayName} さん`;
    } else {
        status.textContent = "未ログイン";
    }
});


