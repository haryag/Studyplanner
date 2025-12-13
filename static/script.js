import { currentUser } from './login.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
const db = getFirestore();

// --- Service Worker ---
const SW_VERSION = 'v3.5.0';
const BASE_PATH = '/Studyplanner/';

// --- 現地の日付取得 ---
const getLocalDate = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

// --- データ初期化 ---
const todayKey = getLocalDate();
const todayDisplay = new Date().toLocaleDateString('ja-JP');
const materials = [];
const dailyPlans = {};
let backupMaterials = [];
let categories = new Set();

// --- 更新通知バー ---
const notification = document.createElement('div');
notification.id = 'update-notification';
notification.innerHTML = `
    <span>アップデートできます！</span>
    <button id="reload-btn">更新</button>
`;
document.body.appendChild(notification);

// 更新ボタンクリック時の動作
document.getElementById('reload-btn').addEventListener('click', () => {
    if (newWorker) {
        newWorker.postMessage({ type: 'SKIP_WAITING' });
    }
});

let newWorker = null;

// --- DOM要素 ---
const wrapper = document.getElementById("wrapper");
const todayDatePanel = document.getElementById("todaydate-panel");
const planContainer = document.getElementById("plan-container");
const planItems = document.getElementById("plan-items");
const materialContainer = document.getElementById("material-container");
const materialItems = document.getElementById("material-items");

// ユーティリティボタン
const openPlanModalBtn = document.getElementById("add-plan-btn");
const openMaterialModalBtn = document.getElementById("add-material-btn");
const openSortModalBtn = document.getElementById("sort-material-btn");
const toggleSectionBtn = document.getElementById("toggle-section-btn");
const uploadBtn = document.getElementById('upload-btn');
const downloadBtn = document.getElementById('download-btn');

// フィルタ・検索系入力要素
const searchMaterialInput = document.getElementById("search-material-input");
const filterSubjectSelect = document.getElementById("filter-subject-select");
const filterStatusSelect = document.getElementById("filter-status-select");
const filterCategorySelect = document.getElementById("filter-category-select");

// 予定追加モーダル要素
const addPlanModal = document.getElementById("add-plan-modal");
const planMaterialInput = document.getElementById("plan-material-select");
const planContentInput = document.getElementById("plan-content-input");
const planTimeInput = document.getElementById("plan-time-input");
const cancelPlanBtn = document.getElementById("cancel-plan-btn");
const confirmPlanBtn = document.getElementById("confirm-plan-btn");

// 教材追加モーダル要素
const addMaterialModal = document.getElementById("add-material-modal");
const materialNameInput = document.getElementById("material-name-input");
const materialSubjectSelect = document.getElementById("material-subject-select");
const materialCategorySelect = document.getElementById("material-category-select");
const newCategoryInput = document.getElementById("new-category-input");
const cancelMaterialBtn = document.getElementById("cancel-material-btn");
const confirmMaterialBtn = document.getElementById("confirm-material-btn");

// 教材情報モーダル要素
const infoMaterialModal = document.getElementById("info-material-modal");
const materialNamePanel = document.getElementById("material-name-panel");
const materialOngoingCheckbox = document.getElementById("material-ongoing-checkbox");
const materialDateInput = document.getElementById("material-date-input");
const materialProgressInput = document.getElementById("material-progress-input");
const materialDetailInput = document.getElementById("material-detail-input");
const cancelInfoBtn = document.getElementById("cancel-info-btn");
const confirmInfoBtn = document.getElementById("confirm-info-btn");

// 並び替えモーダル要素
const sortMaterialModal = document.getElementById("sort-material-modal");
const sortItems = document.getElementById("sort-items");
const cancelSortBtn = document.getElementById("cancel-sort-btn");
const confirmSortBtn = document.getElementById("confirm-sort-btn");

// 編集用変数
let editingMaterialId = null;
let editingIndex = null;
let editingSortId = null;

// --- 共通関数 ---
function renderAppShell() {
    todayDatePanel.textContent = "Loading...";
}

// --- IndexedDB ---
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

// --- 保存/読込 ---
async function saveData() {
    await saveAll("materials", materials);
    await saveAll("dailyPlans", dailyPlans);
}
async function loadData() {
    let savedMaterials = await getAll("materials");
    let savedPlans = await getAll("dailyPlans");

    if (savedMaterials) materials.splice(0, materials.length, ...savedMaterials);
    if (savedPlans) Object.assign(dailyPlans, savedPlans);

    updateCategoryOptions();
}

// --- カテゴリ管理関数 ---
function updateCategoryOptions() {
    categories.clear();
    materials.forEach(m => {
        if (m.category) categories.add(m.category);
    });

    const currentVal = materialCategorySelect.value;
    materialCategorySelect.innerHTML = `
        <option value="">カテゴリなし</option>
        ${Array.from(categories).sort().map(c => `<option value="${c}">${c}</option>`).join('')}
        <option value="new">＋ 新規作成...</option>
    `;
    
    if (currentVal && currentVal !== "new" && categories.has(currentVal)) {
        materialCategorySelect.value = currentVal;
    } else if (!currentVal) {
        materialCategorySelect.value = "";
    }

    const currentFilter = filterCategorySelect.value;
    filterCategorySelect.innerHTML = `
        <option value="all">全カテゴリ</option>
        <option value="none">タグなし</option>
        ${Array.from(categories).sort().map(c => `<option value="${c}">${c}</option>`).join('')}
    `;
    if (currentFilter && (categories.has(currentFilter) || currentFilter === 'all' || currentFilter === 'none')) {
        filterCategorySelect.value = currentFilter;
    } else {
        filterCategorySelect.value = "all";
    }
}

// --- カテゴリセレクトボックス変更イベント ---
materialCategorySelect.addEventListener("change", () => {
    if (materialCategorySelect.value === "new") {
        newCategoryInput.classList.remove("hidden");
        newCategoryInput.focus();
    } else {
        newCategoryInput.classList.add("hidden");
        newCategoryInput.value = "";
    }
});


// --- 画面操作 ---
function toggleSections() {
    const planVisible = !planContainer.classList.contains("hidden");
    planContainer.classList.toggle("hidden", planVisible);
    materialContainer.classList.toggle("hidden", !planVisible);
}

function addTapToggle(itemDiv, type = "material", associatedData = null) {
    itemDiv.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;

        document.querySelectorAll('.material-item.tapped, .plan-item.tapped').forEach(div => {
            if (div !== itemDiv) div.classList.remove('tapped');
        });
        itemDiv.classList.toggle("tapped");

        const isOpened = itemDiv.classList.contains("tapped");
        if (isOpened && type === "material") {
            setTimeout(() => {
                itemDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 10); 
        }
    });
}

function toggleModal(modal, show = true) {
    const footer = document.getElementById("button-container");
    if (footer) footer.style.display = show ? "none" : "flex";
    if (wrapper) wrapper.classList.toggle("full-height", show);
    modal.classList.toggle("hidden", !show);
    document.body.style.overflow = show ? "hidden" : "";
}

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

function saveAndRender() {
    saveData();
    renderMaterialList();
    renderTodayPlans();
}

// --- 描画ロジック ---
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

        const iconDiv = document.createElement("div");
        iconDiv.className = "plan-icon";
        iconDiv.innerHTML = '<i class="fa-solid fa-bookmark"></i>';

        const infoDiv = document.createElement("div");
        infoDiv.className = "plan-info";

        const nameDiv = document.createElement("div");
        nameDiv.textContent = material.name;
        const rangeDiv = document.createElement("div");
        rangeDiv.innerHTML = `<i class="fa-regular fa-pen-to-square"></i> ${plan.range}`;
        const timeDiv = document.createElement("div");
        if (plan.time) timeDiv.innerHTML = `<i class="fa-regular fa-clock"></i> ${plan.time}`;

        if (plan.checked) {
            item.style.backgroundColor = "#f0f0f0";
            item.style.color = "#808080";
            const mainIcon = iconDiv.querySelector("i");
            if (mainIcon) mainIcon.style.color = "#808080";
            const iconsInInfo = infoDiv.querySelectorAll("i");
            iconsInInfo.forEach(i => i.style.color = "#808080");
        }

        const checkBtn = createIconButton("check", '<i class="fa-solid fa-check"></i>', () => {
            plan.checked = !plan.checked;
            saveAndRender();
        });
        const editBtn = createIconButton("edit", '<i class="fa-solid fa-pen"></i>', () => {
            populateMaterialSelect(plan.materialId);
            planContentInput.value = plan.range;
            planTimeInput.value = plan.time || "";
            editingIndex = todayPlans.indexOf(plan);
            toggleModal(addPlanModal, true);
        });
        const delBtn = createIconButton("delete", '<i class="fa-solid fa-trash-can"></i>', () => {
            if (confirm("この予定を削除しますか？")) {
                const idx = todayPlans.indexOf(plan);
                todayPlans.splice(idx, 1);
                saveAndRender();
            }
        });

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

function renderMaterialList() {
    const query = searchMaterialInput.value.toLowerCase();
    const subjectFilter = filterSubjectSelect.value;
    const statusFilter = filterStatusSelect.value;
    const categoryFilter = filterCategorySelect.value;

    materialItems.innerHTML = "";

    materials.forEach(mat => {
        // フィルタ処理
        if (subjectFilter !== "all" && mat.subject !== subjectFilter) return;
        if (!mat.name.toLowerCase().includes(query)) return;
        if (statusFilter === "ongoing" && mat.ongoing === false) return;
        if (statusFilter === "completed" && mat.ongoing !== false) return;
        
        // カテゴリフィルタ
        if (categoryFilter !== "all") {
            if (categoryFilter === "none") {
                if (mat.category) return;
            } else {
                if (mat.category !== categoryFilter) return;
            }
        }

        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${mat.subject}`;
        itemDiv.style.setProperty('--material-bg-color', '#f0f0f0');
        itemDiv.style.setProperty('--material-bg-width', `${mat.progress || 0}%`);

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
        
        if (mat.progress !== undefined && mat.progress !== null) {
            nameProgressDiv.textContent = `進度：${mat.progress}%`;
        }

        const nameCommentDiv = document.createElement("div");
        nameCommentDiv.className = "material-name-comment";
        if(mat.detail) nameCommentDiv.innerHTML = mat.detail.replace(/\n/g, "<br>");

        if (!mat.ongoing) {
            nameDiv.style.color = "#a0a0a0"; 
        }

        nameDiv.append(nameTitleDiv, nameProgressDiv, nameDateDiv, nameCommentDiv);
        itemDiv.appendChild(nameDiv);

        const btnDiv = document.createElement("div");
        btnDiv.className = "buttons";

        const addPlanBtn = createIconButton("add-plan", '<i class="fa-solid fa-plus"></i>', () => {
            populateMaterialSelect(mat.id);
            planContentInput.value = "";
            planTimeInput.value = "";
            editingIndex = null;
            toggleModal(addPlanModal, true);
        });

        // 編集ボタン（カテゴリ設定のために修正）
        const editBtn = createIconButton("edit", '<i class="fa-solid fa-pen"></i>', () => {
            updateCategoryOptions();
            
            materialSubjectSelect.value = mat.subject;
            materialNameInput.value = mat.name;
            
            if (mat.category) {
                if (!categories.has(mat.category)) {
                    categories.add(mat.category);
                    updateCategoryOptions();
                }
                materialCategorySelect.value = mat.category;
            } else {
                materialCategorySelect.value = "";
            }
            newCategoryInput.classList.add("hidden");
            
            editingMaterialId = mat.id;
            toggleModal(addMaterialModal, true);
        });

        const infoBtn = createIconButton("info", '<i class="fa-solid fa-info"></i>', () => {
            materialNamePanel.textContent = mat.name;
            materialOngoingCheckbox.checked = mat.ongoing !== false;
            materialDateInput.value = mat.date || "";
            materialProgressInput.value = mat.progress || 0;
            materialDetailInput.value = mat.detail || "";
            editingMaterialId = mat.id;
            toggleModal(infoMaterialModal, true);
        });

        const delBtn = createIconButton("delete", '<i class="fa-solid fa-trash-can"></i>', () => {
            if (confirm(`教材「${mat.name}」を削除しますか？`)) {
                const idx = materials.findIndex(m => m.id === mat.id);
                if (idx !== -1) materials.splice(idx, 1);
                Object.keys(dailyPlans).forEach(date => {
                    dailyPlans[date] = dailyPlans[date].filter(p => p.materialId !== mat.id);
                });
                saveAndRender();
                updateCategoryOptions();
            }
        });

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

function renderSortMaterialModal() {
    sortItems.innerHTML = "";
    
    materials.forEach(mat => {
        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${mat.subject}`;
        itemDiv.dataset.id = mat.id;

        itemDiv.style.flexDirection = "row";
        itemDiv.style.alignItems = "center";
        itemDiv.style.padding = "8px 12px";
        itemDiv.style.minHeight = "60px";
        itemDiv.style.cursor = "pointer";
        itemDiv.style.position = "relative";
        itemDiv.style.setProperty('--material-bg-width', '0%');

        itemDiv.addEventListener("click", (e) => {
            if (e.target.closest("button")) return; 
            editingSortId = (editingSortId === mat.id) ? null : mat.id;
            renderSortMaterialModal();
        });

        const nameDiv = document.createElement("div");
        nameDiv.textContent = mat.name;
        nameDiv.style.flex = "1";
        nameDiv.style.fontWeight = "bold";
        nameDiv.style.marginRight = "8px"; 
        itemDiv.appendChild(nameDiv);

        if (mat.id === editingSortId) {
            itemDiv.style.backgroundColor = "#fff";
            itemDiv.style.zIndex = "10";

            const btnDiv = document.createElement("div");
            btnDiv.className = "buttons";
            
            btnDiv.style.display = "flex";
            btnDiv.style.position = "absolute";
            btnDiv.style.right = "10px";
            btnDiv.style.top = "0";
            btnDiv.style.bottom = "0";
            btnDiv.style.margin = "auto 0";
            btnDiv.style.height = "fit-content";
            btnDiv.style.transform = "none";
            
            btnDiv.style.background = "rgba(255, 255, 255, 0.95)";
            btnDiv.style.padding = "4px 8px";
            btnDiv.style.borderRadius = "30px";
            btnDiv.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
            btnDiv.style.gap = "0";
            btnDiv.style.animation = "popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
            
            const upBtn = createIconButton("sort-up", '<i class="fa-solid fa-arrow-up"></i>', () => {
                const idx = materials.indexOf(mat);
                if (idx <= 0) return;
                [materials[idx - 1], materials[idx]] = [materials[idx], materials[idx - 1]];
                renderSortMaterialModal();
            });

            const downBtn = createIconButton("sort-down", '<i class="fa-solid fa-arrow-down"></i>', () => {
                const idx = materials.indexOf(mat);
                if (idx >= materials.length - 1) return;
                [materials[idx], materials[idx + 1]] = [materials[idx + 1], materials[idx]];
                renderSortMaterialModal();
            });

            btnDiv.append(upBtn, downBtn);
            itemDiv.appendChild(btnDiv);
        }
        sortItems.appendChild(itemDiv);
    });
}

// --- イベントリスナー ---
uploadBtn.addEventListener("click", async () => {
    if (!window.confirm("データをアップロードします。よろしいですか？")) return;
    if (!navigator.onLine) { return alert("オフラインのため操作できません。"); }
    if (!currentUser) { return alert("まずログインしてください。"); }
    
    uploadBtn.disabled = true;
    try {
        const localMaterials = (await getAll("materials")) || [];
        const localDailyPlans = (await getAll("dailyPlans")) || {};
        const data = {
            materials: localMaterials,
            dailyPlans: localDailyPlans,
            updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "backups", currentUser.uid), data);
        alert("アップロード完了！");
    } catch (err) {
        console.error(err);
        alert("失敗しました。");
    } finally {
        uploadBtn.disabled = false;
    }
});

downloadBtn.addEventListener("click", async () => {
    if (!window.confirm("データを上書きします。よろしいですか？")) return;
    if (!navigator.onLine) { return alert("オフラインのため操作できません。"); }
    if (!currentUser) { return alert("まずログインしてください。"); }
    
    downloadBtn.disabled = true;
    try {
        const snapshot = await getDoc(doc(db, "backups", currentUser.uid));
        if (!snapshot.exists()) {
            alert("バックアップデータが存在しません。");
            return;
        }
        const data = snapshot.data();
        await saveAll("materials", data.materials || []);
        await saveAll("dailyPlans", data.dailyPlans || {});
        await loadData();
        renderMaterialList();
        renderTodayPlans();
        alert("ダウンロード完了！");
    } catch (err) {
        console.error(err);
        alert("失敗しました。");
    } finally {
        downloadBtn.disabled = false;
    }
});

openPlanModalBtn.addEventListener("click", () => {
    populateMaterialSelect();
    planContentInput.value = "";
    planTimeInput.value = "";
    editingIndex = null;
    toggleModal(addPlanModal, true);
});
cancelPlanBtn.addEventListener("click", () => {
    toggleModal(addPlanModal, false);
});
confirmPlanBtn.addEventListener("click", () => {
    const materialId = parseInt(planMaterialInput.value);
    const range = planContentInput.value.trim();
    const time = planTimeInput.value;
    if (!range) return alert("範囲を入力してください");
    
    if (editingIndex !== null) {
        dailyPlans[todayKey][editingIndex] = { ...dailyPlans[todayKey][editingIndex], materialId, range, time };
        editingIndex = null;
    } else {
        if (!dailyPlans[todayKey]) dailyPlans[todayKey] = [];
        dailyPlans[todayKey].push({ materialId, range, time, checked: false });
    }
    toggleModal(addPlanModal, false);
    saveAndRender();
});

// 教材追加モーダル
openMaterialModalBtn.addEventListener("click", () => {
    updateCategoryOptions(); // カテゴリリスト最新化
    
    materialNameInput.value = "";
    materialSubjectSelect.value = "math";
    materialProgressInput.value = 0;
    
    // カテゴリ初期化
    materialCategorySelect.value = ""; 
    newCategoryInput.value = "";
    newCategoryInput.classList.add("hidden");
    
    editingMaterialId = null;
    toggleModal(addMaterialModal, true);
});
cancelMaterialBtn.addEventListener("click", () => {
    toggleModal(addMaterialModal, false);
});
confirmMaterialBtn.addEventListener("click", () => {
    const name = materialNameInput.value.trim();
    const subject = materialSubjectSelect.value;
    
    // ★カテゴリ処理
    let category = "";
    if (materialCategorySelect.value === "new") {
        category = newCategoryInput.value.trim();
        if (!category) return alert("新しいカテゴリ名を入力してください");
        categories.add(category); // 新規追加
    } else {
        category = materialCategorySelect.value;
    }

    if (!name) return alert("教材名を入力してください");
    if (editingMaterialId !== null) {
        const mat = materials.find(m => m.id === editingMaterialId);
        // categoryも保存
        if (mat) { mat.name = name; mat.subject = subject; mat.category = category; }
    } else {
        const newId = materials.length ? Math.max(...materials.map(m => m.id)) + 1 : 1;
        // categoryも保存
        materials.push({ id: newId, name, subject, category, progress: 0, checked: false });
    }
    
    editingMaterialId = null;
    toggleModal(addMaterialModal, false);
    saveAndRender();
    updateCategoryOptions(); // 更新反映
});

// 詳細/進度モーダル
cancelInfoBtn.addEventListener("click", () => {
    toggleModal(infoMaterialModal, false);
});
confirmInfoBtn.addEventListener("click", () => {
    const ongoing = materialOngoingCheckbox.checked;
    const date = materialDateInput.value;
    const progress = parseInt(materialProgressInput.value);
    const detail = materialDetailInput.value.replace(/^\s+|\s+$/g, '');
    if (isNaN(progress)) return alert("数値を入力してください");
    if (editingMaterialId !== null) {
        const mat = materials.find(m => m.id === editingMaterialId);
        if (mat) { mat.ongoing = ongoing; mat.date = date; mat.progress = progress; mat.detail = detail; }
    }
    toggleModal(infoMaterialModal, false);
    saveAndRender();
});

// 並び替えモーダル
openSortModalBtn.addEventListener("click", () => {
    backupMaterials = [...materials];
    editingSortId = null;
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

// 状態保存＆復元 (変更検知)
toggleSectionBtn.addEventListener("click", () => {
    toggleSections();
    const mode = planContainer.classList.contains("hidden") ? "material" : "plan";
    localStorage.setItem("sp_activeSection", mode);
});
searchMaterialInput.addEventListener("input", () => {
    localStorage.setItem("sp_searchQuery", searchMaterialInput.value);
    renderMaterialList();
});
filterSubjectSelect.addEventListener("change", () => {
    localStorage.setItem("sp_filterSubject", filterSubjectSelect.value);
    renderMaterialList();
});
filterStatusSelect.addEventListener("change", () => {
    localStorage.setItem("sp_filterStatus", filterStatusSelect.value);
    renderMaterialList();
});
filterCategorySelect.addEventListener("change", () => {
    localStorage.setItem("sp_filterCategory", filterCategorySelect.value);
    renderMaterialList();
});

// Enterキー
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

// 初期化フロー
renderAppShell();
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${BASE_PATH}sw.js?version=${SW_VERSION}`)
        .then(reg => {
            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        notification.classList.add('show');
                    }
                });
            });
        });
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        window.location.reload();
        refreshing = true;
    });
}

window.addEventListener('DOMContentLoaded', () => {
    // ローカルストレージ設定の復元
    const savedQuery = localStorage.getItem("sp_searchQuery");
    if (savedQuery !== null) searchMaterialInput.value = savedQuery;

    const savedFilter = localStorage.getItem("sp_filterSubject");
    if (savedFilter !== null) filterSubjectSelect.value = savedFilter;

    const savedStatus = localStorage.getItem("sp_filterStatus");
    if (savedStatus !== null) filterStatusSelect.value = savedStatus;

    const savedSection = localStorage.getItem("sp_activeSection");
    if (savedSection === "material") {
        planContainer.classList.add("hidden");
        materialContainer.classList.remove("hidden");
    } else {
        planContainer.classList.remove("hidden");
        materialContainer.classList.add("hidden");
    }
    
    // データ読込
    setTimeout(async () => {
        await loadData();
        
        // データロード後にカテゴリフィルタを復元（選択肢生成後でないとvalueセットが無効になるため）
        const savedCategory = localStorage.getItem("sp_filterCategory");
        if (savedCategory !== null) filterCategorySelect.value = savedCategory;

        renderMaterialList();
        renderTodayPlans();
    }, 0);
});

