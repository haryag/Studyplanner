import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
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

// アカウント選択を毎回出す
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
    prompt: 'select_account'
});

export let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const status = document.getElementById("login-status");

    loginBtn.addEventListener("click", () => {
        signInWithRedirect(auth, provider);
    });

    getRedirectResult(auth)
        .then((result) => {
            if (result && result.user) {
                currentUser = result.user;
                alert(`ようこそ、${currentUser.displayName}さん！`);
            }
        })
        .catch((error) => {
            console.error("ログインエラー:", error);
            alert("ログインに失敗しました。");
        });

    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            currentUser = null;
            status.textContent = "未ログイン";
            alert("ログアウトしました");
        });
    });

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        status.textContent = user ? `ログイン中： ${user.displayName} さん` : "未ログイン";
    });
});
