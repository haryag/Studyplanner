import { initializeApp } from './firebase/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from './firebase/firebase-auth.js';

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
const status = document.getElementById("login-status");
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        status.textContent = `ログイン中： ${user.displayName} さん`;
    } else {
        status.textContent = "未ログイン";
    }
});


