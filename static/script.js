import { currentUser } from './login.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
const db = getFirestore();

// --- Service Worker ---
const SW_VERSION = 'v2.6.2';
const BASE_PATH = '/Studyplanner/';

// --- 軽量SVGアイコン定義 ---
// 必要なアイコンだけを文字列で定義（Font Awesomeのパスデータを流用して軽量化）
// --- Font Awesome 6 (Solid) 正式パスデータ ---
const getIcon = (name) => {
    const paths = {
        // [fa-plus]
        'plus': 'M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z',
        'list': 'M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z',
        'check': 'M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z',
        'pen': 'M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z',
        'trash': 'M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z',        
        'info': 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272c0-13.3-10.7-24-24-24s-24 10.7-24 24v64c0 13.3 10.7 24 24 24zm40-144c-13.3 0-24 10.7-24 24v80h-24c-13.3 0-24 10.7-24 24s10.7 24 24 24h64c13.3 0 24-10.7 24-24s-10.7-24-24-24h-16V216c0-13.3-10.7-24-24-24zM208 112c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h48c8.8 0 16-7.2 16-16V128c0-8.8-7.2-16-16-16H208z',
        'clock': 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272c0-13.3-10.7-24-24-24s-24 10.7-24 24v64c0 13.3 10.7 24 24 24zm40-144c-13.3 0-24 10.7-24 24v80h-24c-13.3 0-24 10.7-24 24s10.7 24 24 24h64c13.3 0 24-10.7 24-24s-10.7-24-24-24h-16V216c0-13.3-10.7-24-24-24z', 
        'pen-square': 'M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z',
        'bookmark': 'M0 48C0 21.5 21.5 0 48 0l0 48V512l144-144 144 144V48v-8.8V0H48z M64 48H320V413.2L192 291.5 64 413.2V48z', // 中が少し空いたデザインを使用
        'sort': 'M137.4 41.4c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-80 80c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L128 50.7V336c0 17.7 14.3 32 32 32s32-14.3 32-32V50.7l69.4 69.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-80-80zM310.6 470.6c-12.5 12.5-12.5 32.8 0 45.3l80 80c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L384 461.3V176c0-17.7-14.3-32-32-32s-32 14.3-32 32V461.3l-69.4-69.4c-12.5-12.5-32.8-12.5-45.3 0z',
        'arrow-up': 'M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2V448c0 17.7 14.3 32 32 32s32-14.3 32-32V141.2L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z',
        'arrow-down': 'M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8 224 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z',
        'cloud-up': 'M96 224c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64c0-29.3-19-54-44.5-61.6c4.5-9.4 7-20 7-31.1c0-40.4-30-73.6-69.2-77.9c-4.4-44.6-42.3-79.3-88.8-79.3c-44 0-80.4 31.4-87.8 72.8C108 52.8 64 100.5 64 160c0 7.3 .9 14.3 2.5 21.1C30.6 195 0 231.9 0 272c0 61.9 50.1 112 112 112H208V254.1l-23 23c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l64-64c9.4-9.4 24.6-9.4 33.9 0l64 64c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-23-23V384h35.7C421.7 377 448 350.2 448 320c0-30.9-24.9-56-55.7-56H376c-13.3 0-24-10.7-24-24c0-42.4-32.7-77.2-74.5-80c-5-7.5-12-14-20.2-18.7c-21.7-12.4-49.8-9.4-69.5 8.9V96h32c-6.8-51.7-51.2-96-103.2-96c-57.4 0-104 46.6-104 104c0 14 3.7 27.7 9.1 39.4C10.7 151.2 0 166.4 0 192c0 35.3 28.7 64 64 64h32z',
        'cloud-down': 'M241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l23 23V144c0-13.3 10.7-24 24-24s24 10.7 24 24V262.1l23-23c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-64 64zM32 272c0 23.3 6.8 45 18.5 63.3L16.2 368C5.9 349.8 0 328.6 0 307.3C0 237.9 44.5 176.6 109.9 154.2C118 107.4 158.4 72 206.5 72c11.3 0 22.3 1.9 32.7 5.3C260 30.6 303.8 0 352 0c61.9 0 112 50.1 112 112c0 8.8-1.1 17.5-3.3 25.7C491.3 158 512 191.7 512 232c0 57.4-46.6 104-104 104H366c-13.3 0-24-10.7-24-24s10.7-24 24-24h42c30.9 0 56-25.1 56-56c0-30.2-26.1-55.7-56.7-56H392c-13.3 0-24-10.7-24-24c0-43.2-36-79.6-79.5-79.6c-17.7 0-35.3 4.9-50 14.6c-7.3 4.8-15.6 7.4-24 7.4c-22 0-39.7-17.6-40.4-39.4c-5-29.6-29.3-51.5-58.7-51.5c-30.3 0-55.7 22.6-58.9 51.6c-.6 5.8-9.4 5.9-10.1 .1c-.2-1.9-.3-3.8-.3-5.8c0-35.3 28.7-64 64-64c30.8 0 56.4 21.8 62.4 51.1C182.2 46.2 212.1 24 248 24c44.2 0 80 35.8 80 80h8v8c0 13.3 10.7 24 24 24h64c17.7 0 32 14.3 32 32s-14.3 32-32 32h-40c-13.3 0-24-10.7-24-24v-8h-8c-13.3 0-24-10.7-24-24c0-44.2-35.8-80-80-80h-3.4c-9.1-34.9-40.9-60.8-78.3-60.8c-30.5 0-57.2 16.7-72.2 41.7C99.2 108 55 137.9 33.7 181.7c-5 10.3-8.8 21.3-11.2 32.7C8.1 230.1 0 246.5 0 264c0 14.6 5.6 28.1 14.9 38.6L44 266.3c-4.4-1.2-7.5-4.4-9.3-7.5C18 247.9 32 272 32 272z',
        'login': 'M160 96c17.7 0 32-14.3 32-32V48c0-26.5-21.5-48-48-48H80C35.8 0 0 35.8 0 80V432c0 44.2 35.8 80 80 80h64c26.5 0 48-21.5 48-48V448c0-17.7-14.3-32-32-32H80c-17.7 0-32-14.3-32-32V80c0-17.7 14.3-32 32-32h64zM329.4 179.3c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l57.4 57.4H168c-17.7 0-32 14.3-32 32s14.3 32 32 32h173.5l-57.4 57.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l112-112c12.5-12.5 12.5-32.8 0-45.3l-112-112z',
        'logout': 'M160 96c17.7 0 32-14.3 32-32V48c0-26.5-21.5-48-48-48H80C35.8 0 0 35.8 0 80V432c0 44.2 35.8 80 80 80h64c26.5 0 48-21.5 48-48V448c0-17.7-14.3-32-32-32H80c-17.7 0-32-14.3-32-32V80c0-17.7 14.3-32 32-32h64zM409.4 179.3l112 112c12.5 12.5 12.5 32.8 0 45.3l-112 112c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l57.4-57.4H248c-17.7 0-32-14.3-32-32s14.3-32 32-32h173.5l-57.4-57.4c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0z'
    };
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="height:1em;vertical-align:-0.125em;fill:currentColor;">
        <path d="${paths[name] || ''}"/>
    </svg>`;
};
document.getElementById('add-plan-btn').innerHTML = `${getIcon('plus')} 予定を追加`;
document.getElementById('toggle-section-btn').innerHTML = `${getIcon('list')} 表示切替`;
document.getElementById('add-material-btn').innerHTML = `${getIcon('plus')} 教材追加`;
document.getElementById('sort-material-btn').innerHTML = `${getIcon('arrow-sort')} 並び替え`;
document.getElementById('upload-btn').innerHTML = `${getIcon('cloud-up')} アップロード`;
document.getElementById('download-btn').innerHTML = `${getIcon('cloud-down')} ダウンロード`;
document.getElementById('login-btn').innerHTML = `${getIcon('login')} ログイン`;
document.getElementById('logout-btn').innerHTML = `${getIcon('logout')} ログアウト`;

// 現地の日付取得
const getLocalDate = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

// --- データ初期化 ---
const todayKey = getLocalDate();  // 内部キー用（保存・検索に使う）: 正規化された YYYY-MM-DD
const todayDisplay = new Date().toLocaleDateString('ja-JP');  // UI表示用（従来どおり端末地域の形式）
const materials = [];
const dailyPlans = {};
let backupMaterials = [];

// --- DOM要素 ---
const wrapper = document.getElementById("wrapper");
const todayDatePanel = document.getElementById("todaydate-panel");
const buttonContainer = document.getElementById("button-container");
const planContainer = document.getElementById("plan-container");
const planItems = document.getElementById("plan-items");
const materialContainer = document.getElementById("material-container");
const materialItems = document.getElementById("material-items");

// ユーティリティ
const openPlanModalBtn = document.getElementById("add-plan-btn");
const openMaterialModalBtn = document.getElementById("add-material-btn");
const openSortModalBtn = document.getElementById("sort-material-btn");
const toggleSectionBtn = document.getElementById("toggle-section-btn");
const searchMaterialInput = document.getElementById("search-material-input");
const filterSubjectSelect = document.getElementById("filter-subject-select");
const uploadBtn = document.getElementById('upload-btn');
const downloadBtn = document.getElementById('download-btn');

// 予定追加モーダル
const addPlanModal = document.getElementById("add-plan-modal");
const planMaterialInput = document.getElementById("plan-material-select");
const planContentInput = document.getElementById("plan-content-input");
const planTimeInput = document.getElementById("plan-time-input");
const cancelPlanBtn = document.getElementById("cancel-plan-btn");
const confirmPlanBtn = document.getElementById("confirm-plan-btn");

// 教材追加モーダル
const addMaterialModal = document.getElementById("add-material-modal");
const materialNameInput = document.getElementById("material-name-input");
const materialSubjectSelect = document.getElementById("material-subject-select");
const cancelMaterialBtn = document.getElementById("cancel-material-btn");
const confirmMaterialBtn = document.getElementById("confirm-material-btn");

// 教材情報モーダル
const infoMaterialModal = document.getElementById("info-material-modal");
const materialNamePanel = document.getElementById("material-name-panel");
const materialOngoingCheckbox = document.getElementById("material-ongoing-checkbox");
const materialDateInput = document.getElementById("material-date-input");
const materialProgressInput = document.getElementById("material-progress-input");
const materialDetailInput = document.getElementById("material-detail-input");
const cancelInfoBtn = document.getElementById("cancel-info-btn");
const confirmInfoBtn = document.getElementById("confirm-info-btn");

// 教材並び替えモーダル
const sortMaterialModal = document.getElementById("sort-material-modal");
const sortItems = document.getElementById("sort-items");
const cancelSortBtn = document.getElementById("cancel-sort-btn");
const confirmSortBtn = document.getElementById("confirm-sort-btn");

let editingMaterialId = null;
let editingIndex = null;

// --- 共通関数 ---
// ロード前に表示する関数
function renderAppShell() {
    todayDatePanel.textContent = "Loading...";
}

// --- IndexedDBベースの保存・読み込み ---
// IndexedDB を初期化
const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("Studyplanner", 1);
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("data")) {
            db.createObjectStore("data", { keyPath: "key" });
        }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
});

// --- 汎用的な読み書き関数 ---
async function saveAll(key, value) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction("data", "readwrite");
        const store = tx.objectStore("data");
        store.put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

async function getAll(key) {
    const db = await dbPromise;
    const tx = db.transaction("data", "readonly");
    const store = tx.objectStore("data");
    return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
    });
}

// --- 保存処理 ---
async function saveData() {
    await saveAll("materials", materials);
    await saveAll("dailyPlans", dailyPlans);
}

// --- 読み込み処理 ---
async function loadData() {
    let savedMaterials = await getAll("materials");
    let savedPlans = await getAll("dailyPlans");

    if (savedMaterials) materials.splice(0, materials.length, ...savedMaterials);
    if (savedPlans) Object.assign(dailyPlans, savedPlans);
}

// セクション入れ替え
function toggleSections() {
    const planVisible = !planContainer.classList.contains("hidden");
    planContainer.classList.toggle("hidden", planVisible);
    materialContainer.classList.toggle("hidden", !planVisible);
}

// タップトグル
function addTapToggle(itemDiv, type = "material", associatedData = null) {
    itemDiv.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;

        const alreadyTapped = itemDiv.classList.contains("tapped");

        // 他の tapped を消す
        document.querySelectorAll('.material-item.tapped, .plan-item.tapped').forEach(div => {
            if (div !== itemDiv) div.classList.remove('tapped');
        });

        // 今回のクリックで tapped を切り替え
        itemDiv.classList.toggle("tapped");

        // すでに tapped だった場合はモーダルを開く
        if (alreadyTapped) {
            if (type === "material") {
                const mat = associatedData;  // 渡された教材オブジェクト
                if (mat) {
                    populateMaterialSelect(mat.id); // 教材を選択済みに
                    planContentInput.value = "";
                    planTimeInput.value = "";
                    editingIndex = null;
                    toggleModal(addPlanModal, true);
                }
            } else if (type === "plan") {
                const plan = associatedData;  // 渡された予定オブジェクト
                if (plan) {
                    populateMaterialSelect(plan.materialId);
                    planContentInput.value = plan.range;
                    planTimeInput.value = plan.time || "";
                    editingIndex = dailyPlans[todayKey].indexOf(plan);
                    toggleModal(addPlanModal, true);
                }
            }
        }
    });
}

// モーダル開閉
function toggleModal(modal, show = true) {
    modal.classList.toggle("hidden", !show);
    document.body.style.overflow = show ? "hidden" : "";
    wrapper.classList.toggle("full-height", show);
    buttonContainer.style.display = show ? "none" : "flex";
}

// 教材選択肢生成
function populateMaterialSelect(selectedId = null) {
    planMaterialInput.innerHTML = "";
    materials.forEach(m => {
        const option = document.createElement("option");
        option.value = m.id;
        option.textContent = m.name;
        if (m.id === selectedId) option.selected = true;
        planMaterialInput.appendChild(option);
    });
}

// ボタン生成
function createIconButton(className, iconHtml, onClick) {
    const btn = document.createElement("button");
    btn.className = className;
    btn.innerHTML = iconHtml;
    btn.addEventListener("click", e => {
        e.stopPropagation();
        onClick(e);
    });
    return btn;
}

// 並び替えボタンの表示更新
function updateSortButtons() {
    const items = Array.from(sortItems.children);
    items.forEach((item, i) => {
        const upBtn = item.querySelector('button:nth-child(1)');
        const downBtn = item.querySelector('button:nth-child(2)');
        upBtn.classList.toggle('invisible', i === 0);
        downBtn.classList.toggle('invisible', i === items.length - 1);
    });
}

// save + render セット
function saveAndRender() {
    saveData();
    renderMaterialList();
    renderTodayPlans();
}

// --- 今日の予定表示 ---
function renderTodayPlans() {
    document.getElementById("todaydate-panel").textContent = todayDisplay;
    planItems.innerHTML = "";
    const todayPlans = dailyPlans[todayKey] || [];
    const sortedPlans = [...todayPlans].sort((a, b) => {
        if (a.checked && !b.checked) return 1;
        if (!a.checked && b.checked) return -1;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
    });

    sortedPlans.forEach(plan => {
        const material = materials.find(m => m.id === plan.materialId);
        if (!material) return;

        const item = document.createElement("div");
        item.className = `plan-item ${material.subject}`;
        item.classList.toggle("checked", plan.checked);

        // --- アイコン ---
        const iconDiv = document.createElement("div");
        iconDiv.className = "plan-icon";
        iconDiv.innerHTML = getIcon('bookmark');

        // --- 情報 ---
        const infoDiv = document.createElement("div");
        infoDiv.className = "plan-info";

        const nameDiv = document.createElement("div");
        nameDiv.textContent = material.name;

        const rangeDiv = document.createElement("div");
        rangeDiv.innerHTML = `${getIcon('pen-square')} ${plan.range}`;

        const timeDiv = document.createElement("div");
        if (plan.time) timeDiv.innerHTML = `${getIcon('clock')} ${plan.time}`;

        // --- チェック済みなら色をまとめて変更 ---
        if (plan.checked) {
            item.style.backgroundColor = "#f0f0f0";
            item.style.color = "#808080";

            // アイコンも文字もグレーに
            const mainIcon = iconDiv.querySelector("i");
            if (mainIcon) mainIcon.style.color = "#808080";

            const iconsInInfo = infoDiv.querySelectorAll("i");
            iconsInInfo.forEach(i => i.style.color = "#808080");

            const rangeIcon = rangeDiv.querySelector("i");
            if (rangeIcon) rangeIcon.style.color = "#808080";

            const timeIcon = timeDiv.querySelector("i");
            if (timeIcon) timeIcon.style.color = "#808080";
        }

        // --- ボタン ---
        const checkBtn = createIconButton(
            "check",
            getIcon('check'),
            () => {
                plan.checked = !plan.checked;
                saveAndRender();
            }
        );

        const editBtn = createIconButton(
            "edit",
            getIcon('pen'),
            () => {
                populateMaterialSelect(plan.materialId);
                planContentInput.value = plan.range;
                planTimeInput.value = plan.time || "";
                editingIndex = todayPlans.indexOf(plan);
                toggleModal(addPlanModal, true);
            }
        );

        const delBtn = createIconButton(
            "delete",
            getIcon('trash'),
            () => {
                if (confirm("この予定を削除しますか？")) {
                    const idx = todayPlans.indexOf(plan);
                    todayPlans.splice(idx, 1);
                    saveAndRender();
                }
            }
        );

        const btnContainer = document.createElement("div");
        btnContainer.className = "buttons";
        btnContainer.append(checkBtn, editBtn, delBtn);

        infoDiv.append(nameDiv, rangeDiv);
        if (plan.time) infoDiv.appendChild(timeDiv);

        item.append(iconDiv, infoDiv, btnContainer);
        addTapToggle(item, "plan", plan);
        planItems.appendChild(item);
    });
}

// --- 教材一覧表示 ---
function renderMaterialList() {
    const query = searchMaterialInput.value.toLowerCase();
    const subjectFilter = filterSubjectSelect.value;

    materialItems.innerHTML = "";

    materials.forEach(mat => {
        // --- フィルタリング ---
        if (subjectFilter !== "all" && mat.subject !== subjectFilter) return;
        if (!mat.name.toLowerCase().includes(query)) return;

        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${mat.subject}`;
        itemDiv.style.setProperty('--material-bg-color', `var(--bg-color-${mat.subject})`);
        itemDiv.style.setProperty('--material-bg-width', `${mat.progress}%`);

        // --- カード情報 ---
        const nameDiv = document.createElement("div");
        nameDiv.className = "material-name-input";

        const nameTitleDiv = document.createElement("div");
        nameTitleDiv.className = "material-name-title";
        nameTitleDiv.textContent = mat.name;

        const nameDateDiv = document.createElement("div");
        nameDateDiv.className = "material-name-date";
        if(mat.date) nameDateDiv.textContent = `期間：${mat.date}`;

        const nameProgressDiv = document.createElement("div");
        nameProgressDiv.className = "material-name-progress";
        if(mat.progress) nameProgressDiv.textContent = `進度：${mat.progress}%`;

        const nameCommentDiv = document.createElement("div");
        nameCommentDiv.className = "material-name-comment";
        if(mat.detail) nameCommentDiv.innerHTML = mat.detail.replace(/\n/g, "<br>");

        if(mat.ongoing) {
            nameTitleDiv.style.fontWeight = "medium";
        } else {
            nameDiv.style.color = "#808080";
            itemDiv.style.setProperty('--material-bg-color', `#f0f0f0`);
        }

        nameDiv.append(nameTitleDiv, nameProgressDiv, nameDateDiv, nameCommentDiv);
        itemDiv.appendChild(nameDiv);

        // --- ボタン群 ---
        const btnDiv = document.createElement("div");
        btnDiv.className = "buttons";

        const addPlanBtn = createIconButton(
            "add-plan",
            getIcon('plus'),
            () => {
                populateMaterialSelect(mat.id);
                planContentInput.value = "";
                planTimeInput.value = "";
                editingIndex = null;
                toggleModal(addPlanModal, true);
            }
        );

        const editBtn = createIconButton(
            "edit",
            getIcon('pen'),
            () => {
                materialSubjectSelect.value = mat.subject;
                materialNameInput.value = mat.name;
                editingMaterialId = mat.id;
                toggleModal(addMaterialModal, true);
            }
        );

        const infoBtn = createIconButton(
            "info",
            getIcon('info'),
            () => {
                materialNamePanel.textContent = mat.name;
                materialOngoingCheckbox.checked = mat.ongoing || false;
                materialDateInput.value = mat.date || "";
                materialProgressInput.value = mat.progress;
                materialDetailInput.value = mat.detail || "";
                editingMaterialId = mat.id;
                toggleModal(infoMaterialModal, true);
            }
        );

        const delBtn = createIconButton(
            "delete",
            getIcon('trash'),
            () => {
                if (confirm(`教材「${mat.name}」を削除しますか？`)) {
                    const idx = materials.findIndex(m => m.id === mat.id);
                    if (idx !== -1) materials.splice(idx, 1);
                    Object.keys(dailyPlans).forEach(date => {
                        dailyPlans[date] = dailyPlans[date].filter(p => p.materialId !== mat.id);
                    });
                    saveAndRender();
                }
            }
        );

        btnDiv.append(addPlanBtn, editBtn, infoBtn, delBtn);
        itemDiv.appendChild(btnDiv);

        addTapToggle(itemDiv, "material", mat);
        materialItems.appendChild(itemDiv);
    });

    if (materialItems.children.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "教材なし";
        empty.style.textAlign = "center";
        empty.style.color = "#000";
        empty.style.marginTop = "16px";
        materialItems.appendChild(empty);
    }
}

// --- 教材並び替えモーダル ---
function renderSortMaterialModal() {
    sortItems.innerHTML = "";
    materials.forEach(mat => {
        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${mat.subject}`;
        itemDiv.dataset.id = mat.id;

        const nameDiv = document.createElement("div");
        nameDiv.textContent = mat.name;
        itemDiv.appendChild(nameDiv);

        const btnDiv = document.createElement("div");
        btnDiv.className = "buttons";

        const upBtn = createIconButton(
            "sort-up",
            getIcon('arrow-up'),
            () => {
                const idx = materials.indexOf(mat);
                if (idx <= 0) return;
                [materials[idx - 1], materials[idx]] = [materials[idx], materials[idx - 1]];
                const prevDiv = itemDiv.previousElementSibling;
                if (prevDiv) sortItems.insertBefore(itemDiv, prevDiv);
                itemDiv.classList.add('tapped');
                updateSortButtons();
            }
        );
        const downBtn = createIconButton(
            "sort-down",
            getIcon('arrow-down'),
            () => {
                const idx = materials.indexOf(mat);
                if (idx >= materials.length - 1) return;
                [materials[idx], materials[idx + 1]] = [materials[idx + 1], materials[idx]];
                const nextDiv = itemDiv.nextElementSibling;
                if (nextDiv) sortItems.insertBefore(itemDiv, nextDiv.nextElementSibling);
                // else sortItems.appendChild(itemDiv);
                itemDiv.classList.add('tapped');
                updateSortButtons();
            }
        );

        btnDiv.append(upBtn, downBtn);
        itemDiv.appendChild(btnDiv);

        addTapToggle(itemDiv, "material", mat);
        sortItems.appendChild(itemDiv);
    });
    updateSortButtons();
}

// --- アップロード / ダウンロード ---
uploadBtn.addEventListener("click", async () => {
    if (!window.confirm("データをアップロードします。よろしいですか？")) return;
    if (!navigator.onLine) {
        alert("オフラインのためアップロードできません。ネットワーク接続を確認してください。");
        return;
    }
    if (!currentUser) {
        console.error("currentUser is null");
        alert("まずログインしてください。");
        return;
    }
    
    uploadBtn.disabled = true;
    uploadBtn.textContent = "アップロード中...";

    try {
        const localMaterials = (await getAll("materials")) || [];
        const localDailyPlans = (await getAll("dailyPlans")) || {};
        const data = {
            materials: localMaterials,
            dailyPlans: localDailyPlans,
            updatedAt: new Date().toISOString(),
        };
        // Firestoreに保存
        await setDoc(doc(db, "backups", currentUser.uid), data);
        alert("アップロード完了しました！");
    } catch (err) {
        console.error("アップロード失敗:", err);
        alert("アップロードに失敗しました。");
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> アップロード';
    }
});
downloadBtn.addEventListener("click", async () => {
    if (!window.confirm("データをダウンロードします。上書きされますがよろしいですか？")) return;
    if (!navigator.onLine) {
        alert("オフラインのためダウンロードできません。");
        return;
    }
    if (!currentUser) {
        console.error("currentUser is null");
        alert("まずログインしてください。");
        return;
    }
    
    downloadBtn.disabled = true;
    downloadBtn.textContent = "ダウンロード中...";

    try {
        const snapshot = await getDoc(doc(db, "backups", currentUser.uid));
        if (!snapshot.exists()) {
            alert("バックアップデータが存在しません。");
            return;
        }
        const data = snapshot.data();
        await saveAll("materials", data.materials || []);
        await saveAll("dailyPlans", data.dailyPlans || {});
        
        // UIを最新に再描画
        await loadData();
        renderMaterialList();
        renderTodayPlans();
        alert("ダウンロード完了しました！");
    } catch (err) {
        console.error("ダウンロード失敗:", err);
        alert("ダウンロードに失敗しました。");
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> ダウンロード';
    }
});

// 予定追加モーダル
openPlanModalBtn.addEventListener("click", () => {
    populateMaterialSelect();
    planContentInput.value = "";
    planTimeInput.value = "";
    editingIndex = null;
    toggleModal(addPlanModal, true);
});
cancelPlanBtn.addEventListener("click", () => {
    editingIndex = null;
    toggleModal(addPlanModal, false);
});
confirmPlanBtn.addEventListener("click", () => {
    const materialId = parseInt(planMaterialInput.value);
    const range = planContentInput.value.trim();
    const time = planTimeInput.value;
    if (!range) return alert("範囲を入力してください");
    if (editingIndex !== null) {
        dailyPlans[todayKey][editingIndex] = {
            ...dailyPlans[todayKey][editingIndex],
            materialId,
            range,
            time
        };
        editingIndex = null;
    } else {
        if (!dailyPlans[todayKey]) dailyPlans[todayKey] = [];
        dailyPlans[todayKey].push({ materialId, range, time });
    }
    toggleModal(addPlanModal, false);
    saveAndRender();
});

// 教材追加モーダル
openMaterialModalBtn.addEventListener("click", () => {
    materialNameInput.value = "";
    materialSubjectSelect.value = "math";
    materialProgressInput.value = 0;
    editingMaterialId = null;
    toggleModal(addMaterialModal, true);
});
cancelMaterialBtn.addEventListener("click", () => {
    editingMaterialId = null;
    toggleModal(addMaterialModal, false);
});
confirmMaterialBtn.addEventListener("click", () => {
    const name = materialNameInput.value.trim();
    const subject = materialSubjectSelect.value;
    if (!name) return alert("教材名を入力してください");
    if (editingMaterialId !== null) {
        const mat = materials.find(m => m.id === editingMaterialId);
        if (mat) { mat.name = name; mat.subject = subject; }
    } else {
        const newId = materials.length ? Math.max(...materials.map(m => m.id)) + 1 : 1;
        materials.push({ id: newId, name, subject, progress: 0, checked: false });
    }
    editingMaterialId = null;
    toggleModal(addMaterialModal, false);
    saveAndRender();
});
// 教材情報モーダル
cancelInfoBtn.addEventListener("click", () => {
    editingMaterialId = null;
    toggleModal(infoMaterialModal, false);
});
confirmInfoBtn.addEventListener("click", () => {
    const ongoing = materialOngoingCheckbox.checked;
    const date = materialDateInput.value;
    const progress = parseInt(materialProgressInput.value);
    const detail = materialDetailInput.value.replace(/^\s+|\s+$/g, '');;
    if (isNaN(progress) || progress < 0 || progress > 100) return alert("進度は0～100の数値で入力してください");
    if (editingMaterialId !== null) {
        const mat = materials.find(m => m.id === editingMaterialId);
        if (mat) { mat.ongoing = ongoing; mat.date = date; mat.progress = progress; mat.detail = detail;
        }
    }
    editingMaterialId = null;
    toggleModal(infoMaterialModal, false);
    saveAndRender();
});

// 並び替えモーダル
openSortModalBtn.addEventListener("click", () => {
    backupMaterials = [...materials];
    renderSortMaterialModal();
    toggleModal(sortMaterialModal, true);
});
cancelSortBtn.addEventListener("click", () => {
    materials.splice(0, materials.length, ...backupMaterials);
    toggleModal(sortMaterialModal, false);
});
confirmSortBtn.addEventListener("click", () => {
    toggleModal(sortMaterialModal, false);
    saveAndRender();
});

// 表示切替ボタン
toggleSectionBtn.addEventListener("click", toggleSections);

// 検索・フィルタリング
searchMaterialInput.addEventListener("input", () => renderMaterialList());
filterSubjectSelect.addEventListener("input", () => renderMaterialList());

// --- Enterキー送信 ---
[addMaterialModal, addPlanModal].forEach(modal => {
    modal.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (modal === addMaterialModal) confirmMaterialBtn.click();
            else confirmPlanBtn.click();
        }
    });
});
[materialProgressInput, materialDateInput].forEach(input => {
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            confirmInfoBtn.click();
        }
    });
});

// 初期読み込み
renderAppShell();

// Service Worker登録（非同期でバックグラウンド）
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${BASE_PATH}sw.js?version=${SW_VERSION}`)
        .then(reg => console.log('SW登録完了:', reg))
        .catch(err => console.error('SW登録失敗:', err));
}

// --- 初期UI描画 ---
renderAppShell();  // まず画面の骨格だけ表示

// --- データ読み込み + 初期レンダリング（非同期で遅延） ---
window.addEventListener('DOMContentLoaded', () => {
    // ユーザーが操作可能な状態を優先
    setTimeout(async () => {
        await loadData();
        renderMaterialList();
        renderTodayPlans();
    }, 0); // 0msでも次のイベントループに回るので初期表示は速い
});

