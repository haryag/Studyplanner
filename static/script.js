import { currentUser } from './login.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
const db = getFirestore();

// --- Service Worker ---
const SW_VERSION = 'v2.6.1';
const BASE_PATH = '/Studyplanner/';

// --- 軽量SVGアイコン定義 ---
// 必要なアイコンだけを文字列で定義（Font Awesomeのパスデータを流用して軽量化）
const getIcon = (name) => {
    const paths = {
        'plus': '<path fill="currentColor" d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/>',
        'list': '<path fill="currentColor" d="M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM64 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm48-208a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z"/>',
        'check': '<path fill="currentColor" d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>',
        'pen': '<path fill="currentColor" d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"/>',
        'pen-square': '<path fill="currentColor" d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3l-22.7-22.6zM192 468v-33.9l0 0 0 0c.2-7 2-13.7 5.1-19.8L83.2 447.8 55.4 345l46.2 135.2L192 468zM315.6 150.8L124 342.3 98.7 317 290.2 125.5 315.6 150.8z"/>',
        'trash': '<path fill="currentColor" d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0H284.2c12.1 0 23.2 6.8 28.6 17.7L320 32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32h96l7.2-14.3zM32 128H416V448c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V128z"/>',
        'arrow-up': '<path fill="currentColor" d="M182.6 137.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-9.2 9.2-11.9 22.9-6.9 34.9s16.6 19.8 29.6 19.8H32c0 12.9 10.5 23.5 23.4 23.5H456.6c12.9 0 23.4-10.5 23.4-23.5H480c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-128-128z"/>', // 三角上矢印（単純化）
        'arrow-down': '<path fill="currentColor" d="M182.6 470.6c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-9.2-9.2-11.9-22.9-6.9-34.9s16.6-19.8 29.6-19.8H288c12.9 0 24.6 7.8 29.6 19.8s2.2 25.7-6.9 34.9l-128 128z"/>', // 三角下矢印（単純化）
        'arrow-sort': '<path fill="currentColor" d="M137.4 41.4c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-80 80c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L128 50.7V336c0 17.7 14.3 32 32 32s32-14.3 32-32V50.7l69.4 69.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-80-80zM310.6 470.6c-12.5 12.5-12.5 32.8 0 45.3l80 80c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L384 461.3V176c0-17.7-14.3-32-32-32s-32 14.3-32 32V461.3l-69.4-69.4c-12.5-12.5-32.8-12.5-45.3 0z"/>',
        'info': '<path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272c0-13.3-10.7-24-24-24s-24 10.7-24 24v64c0 13.3 10.7 24 24 24zm40-144c-13.3 0-24 10.7-24 24v80h-24c-13.3 0-24 10.7-24 24s10.7 24 24 24h64c13.3 0 24-10.7 24-24s-10.7-24-24-24h-16V216c0-13.3-10.7-24-24-24zM208 112c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h48c8.8 0 16-7.2 16-16V128c0-8.8-7.2-16-16-16H208z"/>',
        'clock': '<path fill="currentColor" d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/>',
        'bookmark': '<path fill="currentColor" d="M384 48V512l-128-80L128 512V48C128 21.5 149.5 0 176 0h160c26.5 0 48 21.5 48 48z"/>',
        'up-s': '<path fill="currentColor" d="M182.6 137.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-9.2 9.2-11.9 22.9-6.9 34.9s16.6 19.8 29.6 19.8H456.6c12.9 0 24.6-10.5 24.6-23.5s-4.6-22.3-12.9-31.2l-128-128z"/>',
        'down-s': '<path fill="currentColor" d="M182.6 470.6c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-9.2-9.2-11.9-22.9-6.9-34.9s16.6-19.8 29.6-19.8H456.6c12.9 0 24.6 7.8 24.6 19.8s-4.6 22.3-12.9 31.2l-128 128z"/>',
        'cloud-up': '<path fill="currentColor" d="M384 352v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32v-64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64c0 53 43 96 96 96H352c53 0 96-43 96-96v-64c0-17.7-14.3-32-32-32s-32 14.3-32 32zm-128-212.7L315.3 200c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-128-128c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L224 139.3V320c0 17.7 14.3 32 32 32s32-14.3 32-32V139.3z"/>',
        'cloud-down': '<path fill="currentColor" d="M224 372.7L164.7 313.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 372.7V192c0-17.7-14.3-32-32-32s-32 14.3-32 32V372.7zM448 96c0-53-43-96-96-96H96C43 0 0 43 0 96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V96c0-17.7 14.3-32 32-32H352c17.7 0 32 14.3 32 32v64c0 17.7 14.3 32 32 32s32-14.3 32-32V96z"/>',
        'login': '<path fill="currentColor" d="M128 64c0-35.3 28.7-64 64-64H352c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H192c-35.3 0-64-28.7-64-64V384c0-17.7 14.3-32 32-32s32 14.3 32 32v64c0 1.9 1.4 1.3 .1-.6l.6-.1H352c10 0 18.2-7 19.8-16.7c.1 .9 .2 2.7 .2-4.2V64c0-11-9-20-20-20H192c-5.8 0-11.1 2.5-14.8 6.4c1.1-1.3 2.6-3 4.4-4.8l-1.3 1.1c2 2 1.6 2 19.7 2h.2c1.9-2.9 2-3.1 3-3.1 0 .2-4.1-.2 1.9c-.8-.2-.3-.1-3 .1v-64zm-14 186.7l67.9-67.9c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L157.3 300H320c17.7 0 32 14.3 32 32s-14.3 32-32 32H157.3l70.6 70.6c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L66.7 334.6c-12.5-12.5-12.5-32.8 0-45.3L114 250.7z"/>',
        'logout': '<path fill="currentColor" d="M224.5 121.4l91.4 91.4c9.4 9.4 9.4 24.6 0 33.9l-91.4 91.4c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l50.5-50.5H32c-13.3 0-24-10.7-24-24s10.7-24 24-24h219.1l-50.5-50.5c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0zM352 32c17.7 0 32 14.3 32 32v384c0 17.7-14.3 32-32 32H160c-17.7 0-32-14.3-32-32V400c0-17.7 14.3-32 32-32s32 14.3 32 32v16H352V64H160v16c0 17.7-14.3 32-32 32s-32-14.3-32-32V64c0-17.7 14.3-32 32-32H352z"/>'
    };
    const path = paths[name] || '';
    // SVG viewBoxはFontAwesome標準の512x512を使用
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="height:1em;vertical-align:-0.125em;">${path}</svg>`;
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
