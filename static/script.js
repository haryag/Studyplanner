const SW_VERSION = 'v1.0.5';
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

// --- データ初期化 ---
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

// モーダル
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
    const store = tx.objectStore("data");
    store.put({ key, value });
    return tx.complete;
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

async function saveData() {
    await saveAll("materials", materials);
    await saveAll("dailyPlans", dailyPlans);
}

async function loadData() {
    const [savedMaterials, savedPlans] = await Promise.all([
        getAll("materials"),
        getAll("dailyPlans")
    ]);
    if (savedMaterials) materials.splice(0, materials.length, ...savedMaterials);
    if (savedPlans) Object.assign(dailyPlans, savedPlans);
}

// --- App Shell ---
function renderAppShell() {
    document.getElementById("today-date").textContent = todayDate;
    materialListDiv.textContent = "=== Loading ===";
    planListDiv.textContent = "=== Loading ===";
}

// --- Material List: Shell + Details ---
function renderMaterialListShell(materials) {
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
        fragment.appendChild(itemDiv);
    });
    materialListDiv.appendChild(fragment);
}

function renderMaterialListDetails(materials) {
    const items = materialListDiv.children;
    materials.forEach((mat, idx) => {
        const itemDiv = items[idx];
        requestAnimationFrame(() => {
            const nameDiv = itemDiv.querySelector(".material-name");
            if (mat.detail) {
                const commentDiv = document.createElement("div");
                commentDiv.className = "material-name-comment";
                commentDiv.innerHTML = mat.detail.replace(/\n/g, "<br>");
                nameDiv.appendChild(commentDiv);
            }
            // ボタン群
            const btnDiv = document.createElement("div");
            btnDiv.className = "buttons";
            itemDiv.appendChild(btnDiv);
        });
    });
}

// --- Today Plans ---
function renderTodayPlansDelayed() {
    setTimeout(() => renderTodayPlans(), 50);
}

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
        item.classList.toggle("checked", plan.checked);
        item.innerHTML = `<div class="plan-icon"><i class="fa-solid fa-bookmark"></i></div>
                          <div class="plan-info">
                            <div>${material.name}</div>
                            <div><i class="fa-regular fa-pen-to-square"></i> ${plan.range}</div>
                            ${plan.time ? `<div><i class="fa-regular fa-clock"></i> ${plan.time}</div>` : ""}
                          </div>`;
        planListDiv.appendChild(item);
    });
}

// --- Section Toggle ---
function toggleSections() {
    const planVisible = !planListSection.classList.contains("hidden");
    planListSection.classList.toggle("hidden", planVisible);
    materialListSection.classList.toggle("hidden", !planVisible);
}

// --- Modal Toggle ---
function toggleModal(modal, show = true) {
    modal.classList.toggle("hidden", !show);
    document.body.style.overflow = show ? "hidden" : "";
    wrapper.classList.toggle("full-height", show);
    buttonGroup.style.display = show ? "none" : "flex";
}

// --- Initial Load ---
renderAppShell();

loadData().then(() => {
    renderMaterialListShell(materials);
    requestAnimationFrame(() => renderMaterialListDetails(materials));
    renderTodayPlansDelayed();
});
