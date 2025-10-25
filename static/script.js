const SW_VERSION = 'v1.0.4';
const BASE_PATH = '/Studyplanner/';

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
        .then(regs => {
            const needUpdate = regs.some(r =>
                !(r.active || r.waiting || r.installing)?.scriptURL.includes(`${BASE_PATH}sw.js?version=${SW_VERSION}`)
            );
            if (needUpdate) {
                return Promise.all(regs.map(r => r.unregister()))
                    .then(() => navigator.serviceWorker.register(`${BASE_PATH}sw.js?version=${SW_VERSION}`));
            } else if (regs.length === 0) {
                return navigator.serviceWorker.register(`${BASE_PATH}sw.js?version=${SW_VERSION}`);
            }
        })
        .then(() => console.log('Service Worker 登録完了'))
        .catch(err => console.error('SW登録失敗:', err));
}

// --- データ ---
const todayDate = new Date().toLocaleDateString('ja-JP');
const materials = [];
const dailyPlans = {};
let backupMaterials = [];

// --- DOM ---
const wrapper = document.getElementById("wrapper");
const buttonGroup = document.querySelector(".button-group");
const planListSection = document.getElementById("plan-list-section");
const planListDiv = document.getElementById("plan-list");
const materialListSection = document.getElementById("material-list-section");
const materialListDiv = document.getElementById("material-list");

// --- モーダル ---
const addPlanModal = document.getElementById("add-plan-modal");
const planMaterial = document.getElementById("plan-material");
const planContent = document.getElementById("plan-content");
const planTime = document.getElementById("plan-time");
const cancelPlan = document.getElementById("cancel-plan");
const confirmPlan = document.getElementById("confirm-plan");

const addMaterialModal = document.getElementById("add-material-modal");
const materialName = document.getElementById("material-name");
const materialSubject = document.getElementById("material-subject");
const cancelAdd = document.getElementById("cancel-add");
const confirmAdd = document.getElementById("confirm-add");

const infoMaterialModal = document.getElementById("info-material-modal");
const materialNameDiv = document.getElementById("material-name-div");
const materialOngoing = document.getElementById("material-ongoing");
const materialDate = document.getElementById("material-date");
const materialProgress = document.getElementById("material-progress");
const materialDetail = document.getElementById("material-detail");
const cancelInfo = document.getElementById("cancel-info");
const confirmInfo = document.getElementById("confirm-info");

const sortMaterialModal = document.getElementById("sort-material-modal");
const sortMaterialList = document.getElementById("sort-material-list");
const cancelSort = document.getElementById("cancel-sort");
const confirmSort = document.getElementById("confirm-sort");

let editingMaterialId = null;
let editingIndex = null;

// --- IndexedDB ---
const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("Studyplanner", 1);
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("data")) db.createObjectStore("data", { keyPath: "key" });
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
});

async function saveAll(key, value) {
    const db = await dbPromise;
    const tx = db.transaction("data", "readwrite");
    tx.objectStore("data").put({ key, value });
    return tx.complete;
}

async function getAll(key) {
    const db = await dbPromise;
    const tx = db.transaction("data", "readonly");
    return new Promise((resolve, reject) => {
        const req = tx.objectStore("data").get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
    });
}

async function saveData() {
    await saveAll("materials", materials);
    await saveAll("dailyPlans", dailyPlans);
}

// --- App Shell ---
function renderAppShell() {
    document.getElementById("today-date").textContent = todayDate;
    materialListDiv.textContent = "=== Loading ===";
    planListDiv.textContent = "=== Loading ===";
}

// --- 共通関数 ---
function toggleModal(modal, show = true) {
    modal.classList.toggle("hidden", !show);
    document.body.style.overflow = show ? "hidden" : "";
    wrapper.classList.toggle("full-height", show);
    buttonGroup.style.display = show ? "none" : "flex";
}

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

// --- 教材リスト描画 ---
function renderMaterialList() {
    materialListDiv.innerHTML = "";
    const fragment = document.createDocumentFragment();
    materials.forEach(mat => {
        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${mat.subject}`;
        const nameDiv = document.createElement("div");
        nameDiv.className = "material-name";

        const titleDiv = document.createElement("div");
        titleDiv.className = "material-name-title";
        titleDiv.textContent = mat.name;

        const progressDiv = document.createElement("div");
        progressDiv.className = "material-name-progress";
        progressDiv.textContent = `進度：${mat.progress || 0}%`;

        nameDiv.append(titleDiv, progressDiv);
        itemDiv.appendChild(nameDiv);

        // ボタン群
        const btnDiv = document.createElement("div");
        btnDiv.className = "buttons";

        const addPlanBtn = createIconButton("add-plan", '<i class="fa-solid fa-plus"></i>', () => {
            planMaterial.innerHTML = "";
            materials.forEach(m => {
                const option = document.createElement("option");
                option.value = m.id;
                option.textContent = m.name;
                planMaterial.appendChild(option);
            });
            planContent.value = "";
            planTime.value = "";
            editingIndex = null;
            toggleModal(addPlanModal, true);
        });

        const editBtn = createIconButton("edit", '<i class="fa-solid fa-pen"></i>', () => {
            materialName.value = mat.name;
            materialSubject.value = mat.subject;
            editingMaterialId = mat.id;
            toggleModal(addMaterialModal, true);
        });

        const infoBtn = createIconButton("info", '<i class="fa-solid fa-info"></i>', () => {
            materialNameDiv.textContent = mat.name;
            materialOngoing.checked = mat.ongoing || false;
            materialDate.value = mat.date || "";
            materialProgress.value = mat.progress || 0;
            materialDetail.value = mat.detail || "";
            editingMaterialId = mat.id;
            toggleModal(infoMaterialModal, true);
        });

        const delBtn = createIconButton("delete", '<i class="fa-solid fa-trash-can"></i>', () => {
            if (!confirm(`教材「${mat.name}」を削除しますか？`)) return;
            const idx = materials.findIndex(m => m.id === mat.id);
            if (idx !== -1) materials.splice(idx, 1);
            Object.keys(dailyPlans).forEach(date => {
                dailyPlans[date] = dailyPlans[date].filter(p => p.materialId !== mat.id);
            });
            saveData();
            renderMaterialList();
            renderTodayPlans();
        });

        btnDiv.append(addPlanBtn, editBtn, infoBtn, delBtn);
        itemDiv.appendChild(btnDiv);

        fragment.appendChild(itemDiv);
    });
    materialListDiv.appendChild(fragment);
}

// --- 今日の予定描画 ---
function renderTodayPlans() {
    planListDiv.innerHTML = "";
    const todayPlans = dailyPlans[todayDate] || [];
    todayPlans.sort((a, b) => {
        if (a.checked && !b.checked) return 1;
        if (!a.checked && b.checked) return -1;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
    });
    todayPlans.forEach(plan => {
        const material = materials.find(m => m.id === plan.materialId);
        if (!material) return;

        const item = document.createElement("div");
        item.className = `plan-item ${material.subject}`;
        item.innerHTML = `<div class="plan-icon"><i class="fa-solid fa-bookmark"></i></div>
                          <div class="plan-info">
                            <div>${material.name}</div>
                            <div><i class="fa-regular fa-pen-to-square"></i> ${plan.range}</div>
                            ${plan.time ? `<div><i class="fa-regular fa-clock"></i> ${plan.time}</div>` : ""}
                          </div>`;
        planListDiv.appendChild(item);
    });
}

// --- 初期読み込み ---
renderAppShell();

getAll("materials").then(savedMaterials => {
    if (savedMaterials) materials.push(...savedMaterials);
    renderMaterialList();
});

getAll("dailyPlans").then(savedPlans => {
    if (savedPlans) Object.assign(dailyPlans, savedPlans);
    renderTodayPlans();
});
