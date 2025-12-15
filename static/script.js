import { currentUser } from './login.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

// --- 定数 ---
const APP_NAME = 'Studyplanner';
const SW_VERSION = 'v3.9.1';
const LAST_UPDATED = '2025/12/16';
const BASE_PATH = '/Studyplanner/';

// --- 日付取得 ---
const getLocalDate = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

// --- Firebase / Firestore ---
const db = getFirestore();

// --- データ初期化 ---
const todayKey = getLocalDate();
const todayDisplay = new Date().toLocaleDateString('ja-JP');
const materials = [];
const dailyPlans = {};
let backupMaterials = [];
let categories = new Set();
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
const exportJsonBtn = document.getElementById("export-json-btn");
const importJsonBtn = document.getElementById("import-json-btn");
const importFileInput = document.getElementById("import-file-input");

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
const materialDateInput = document.getElementById("material-date-input");
const materialProgressInput = document.getElementById("material-progress-input");
const materialDetailInput = document.getElementById("material-detail-input");
const materialStatusSelect = document.getElementById("material-status-select");
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

// --- IndexedDB 関連 ---
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

    if (savedMaterials) {
        // データ移行（旧データ互換）
        savedMaterials = savedMaterials.map(m => {
            // すでに status プロパティがあるなら何もしない
            if (m.status) return m;

            // status がない場合、旧プロパティから変換
            if (m.learning === true || m.ongoing === true) { 
                // 以前 learning または ongoing が true だった場合 → 学習中
                m.status = "learning";
            } else if (m.completed === true) {
                // completed が true だった場合 → 完了
                m.status = "completed";
            } else {
                // それ以外 → 未着手
                m.status = "waiting";
            }
            
            return m;
        });

        materials.splice(0, materials.length, ...savedMaterials);
    }
    if (savedPlans) Object.assign(dailyPlans, savedPlans);

    updateCategoryOptions();
}

// --- カテゴリ関連 ---
function updateCategoryOptions() {
    categories.clear();
    materials.forEach(m => {
        if (m.category) categories.add(m.category);
    });

    const currentVal = materialCategorySelect.value;
    materialCategorySelect.textContent = '';
    
    const optNoneMaterial = document.createElement('option');
    optNoneMaterial.value = '';
    optNoneMaterial.textContent = 'カテゴリなし';
    materialCategorySelect.appendChild(optNoneMaterial);
    
    Array.from(categories).sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        materialCategorySelect.appendChild(opt);
    });
    
    const optNew = document.createElement('option');
    optNew.value = 'new';
    optNew.textContent = '＋ 新規作成...';
    materialCategorySelect.appendChild(optNew);
    
    if (currentVal && currentVal !== 'new' && categories.has(currentVal)) {
        materialCategorySelect.value = currentVal;
    } else if (!currentVal) {
        materialCategorySelect.value = '';
    }

    const currentFilter = filterCategorySelect.value;
    filterCategorySelect.textContent = '';
    
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = '全カテゴリ';
    filterCategorySelect.appendChild(optAll);
    
    const optNoneFilter = document.createElement('option');
    optNoneFilter.value = 'none';
    optNoneFilter.textContent = 'タグなし';
    filterCategorySelect.appendChild(optNoneFilter);
    
    Array.from(categories).sort().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      filterCategorySelect.appendChild(opt);
    });
    
    filterCategorySelect.value = currentFilter;

    if (currentFilter && (categories.has(currentFilter) || currentFilter === 'all' || currentFilter === 'none')) {
        filterCategorySelect.value = currentFilter;
    } else {
        filterCategorySelect.value = "all";
    }
}

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
        // 完了した教材は予定追加のリストに出さない場合はここでフィルタできますが、
        // 復習の可能性もあるので一旦全表示にします。
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

function closeAllModals() {
    [addPlanModal, addMaterialModal, infoMaterialModal, sortMaterialModal].forEach(modal => {
        if (!modal.classList.contains("hidden")) toggleModal(modal, false);
    });
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
        // 基本プロパティチェック (statusがない場合はwaitingとみなす)
        const status = mat.status || "waiting";

        // --- フィルタ処理 ---
        if (subjectFilter !== "all" && mat.subject !== subjectFilter) return;
        if (!mat.name.toLowerCase().includes(query)) return;
        
        // カテゴリフィルタ
        if (categoryFilter !== "all") {
            if (categoryFilter === "none") {
                if (mat.category) return;
            } else {
                if (mat.category !== categoryFilter) return;
            }
        }

        // ★★★ ステータスフィルタ ★★★
        if (statusFilter !== "all") {
            if (statusFilter === "planning") {
                // 進行中 = 「完了」以外（つまり未着手 or 学習中）
                if (status === "completed") return;
            } else {
                // それ以外は完全一致で判定 (waiting, learning, completed)
                if (status !== statusFilter) return;
            }
        }

        // --- DOM生成 ---
        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${mat.subject}`;
        itemDiv.style.setProperty('--material-bg-width', `${mat.progress || 0}%`);

        const badge = document.createElement("div");
        badge.className = `status-badge ${status}`;
        // ツールチップ設定（ホバー時に出てくるヒントのこと）
        if (status === "learning") badge.title = "学習中";
        else if (status === "waiting") badge.title = "未着手";
        else if (status === "completed") badge.title = "完了";
        itemDiv.appendChild(badge);

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

        // 完了状態なら文字色を薄くする
        if (status === "completed") {
            nameDiv.style.color = "#a0a0a0"; 
        } else {
            nameDiv.style.color = "#333"; 
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
            
            // プルダウンに値をセット
            materialStatusSelect.value = mat.status || "waiting";

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

// --- Firestore バックアップ ---
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

// --- モーダル操作イベント ---
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

openMaterialModalBtn.addEventListener("click", () => {
    updateCategoryOptions();
    
    materialNameInput.value = "";
    materialSubjectSelect.value = "math";
    materialProgressInput.value = 0;
    
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

    let category = "";
    if (materialCategorySelect.value === "new") {
        category = newCategoryInput.value.trim();
        if (!category) return alert("新しいカテゴリ名を入力してください");
        categories.add(category);
    } else {
        category = materialCategorySelect.value;
    }

    if (!name) return alert("教材名を入力してください");
    
    // 新規作成時はデフォルトで waiting (未着手) にする
    if (editingMaterialId !== null) {
        const mat = materials.find(m => m.id === editingMaterialId);
        if (mat) { mat.name = name; mat.subject = subject; mat.category = category; }
    } else {
        const newId = materials.length ? Math.max(...materials.map(m => m.id)) + 1 : 1;
        materials.push({ 
            id: newId, 
            name, 
            subject, 
            category, 
            progress: 0, 
            status: "waiting", // 新規デフォルト
            checked: false 
        });
    }
    
    editingMaterialId = null;
    toggleModal(addMaterialModal, false);
    saveAndRender();
    updateCategoryOptions();
});

cancelInfoBtn.addEventListener("click", () => {
    toggleModal(infoMaterialModal, false);
});
confirmInfoBtn.addEventListener("click", () => {
    let status = materialStatusSelect.value;  // letに変更（後で書き換える可能性があるため）
    
    const date = materialDateInput.value;
    const progress = parseInt(materialProgressInput.value);
    const detail = materialDetailInput.value.replace(/^\s+|\s+$/g, '');
    
    if (isNaN(progress) || progress < 0 || progress > 100) return alert("進度は0～100の整数値で入力してください");
    if (progress === 100 && status !== "completed") {
        if (confirm("進捗が100%になりました。\nステータスを「完了」に変更しますか？")) {
            status = "completed";
        }
    }
    
    if (editingMaterialId !== null) {
        const mat = materials.find(m => m.id === editingMaterialId);
        if (mat) { 
            mat.status = status; 
            mat.date = date; 
            mat.progress = progress; 
            mat.detail = detail; 
        }
    }
    toggleModal(infoMaterialModal, false);
    saveAndRender();
});

openSortModalBtn.addEventListener("click", () => {
    backupMaterials = JSON.parse(JSON.stringify(materials));
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

// --- フィルタ・検索・状態保存 ---
toggleSectionBtn.addEventListener("click", () => {
    toggleSections();
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

// --- JSON エクスポート/インポート機能 ---
exportJsonBtn.addEventListener("click", () => {
    if (!confirm("現在のデータをファイルとして保存（ダウンロード）しますか？")) return;

    // 保存するデータを作成
    const data = {
        materials: materials,
        dailyPlans: dailyPlans,
        exportedAt: new Date().toISOString(),
        appName: APP_NAME,
        version: SW_VERSION
    };

    // JSON文字列に変換
    const jsonStr = JSON.stringify(data, null, 2);
    
    // Blobオブジェクトを作成 (データをファイル化)
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // ダウンロード用リンクを生成してクリックさせる
    const a = document.createElement("a");
    a.href = url;
    a.download = `studyplanner_backup_${getLocalDate()}.json`; // ファイル名
    document.body.appendChild(a);
    a.click();
    
    // 後始末
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});
importJsonBtn.addEventListener("click", () => {
    // 隠しinputをクリックしてファイル選択画面を出す
    importFileInput.value = ""; // 同じファイルを再度選べるようにリセット
    importFileInput.click();
});
// ファイルが選択された時の処理
importFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const jsonStr = event.target.result;
            const data = JSON.parse(jsonStr);

            // 簡易的なデータ検証
            if (!data.materials || !data.dailyPlans) {
                return alert("エラー：正しいバックアップファイルではありません。");
            }

            if (!confirm(`データ（${data.exportedAt || '日付不明'} 作成）を読み込みますか？\n※現在のデータは上書きされます。`)) {
                return;
            }

            // データを変数に反映
            materials.splice(0, materials.length, ...data.materials);
            
            // dailyPlansをクリアして反映
            for (const key in dailyPlans) delete dailyPlans[key];
            Object.assign(dailyPlans, data.dailyPlans);

            // カテゴリやインデックスDBも更新
            await saveData();
            updateCategoryOptions();
            renderMaterialList();
            renderTodayPlans();

            alert("インポートが完了しました！");

        } catch (err) {
            console.error(err);
            alert("読み込みに失敗しました。ファイルが破損している可能性があります。");
        }
    };
    reader.readAsText(file);
});

// Enterキー・Escキー操作
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
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeAllModals();
    }
});

// --- ボタンの有効/無効を切り替える関数 ---
function updateSyncButtons() {
    const isOnline = navigator.onLine;
    const isLoggedIn = (currentUser !== null);
    const isDisabled = !(isOnline && isLoggedIn);

    if (uploadBtn) uploadBtn.disabled = isDisabled;
    if (downloadBtn) downloadBtn.disabled = isDisabled;
}

// --- ネットワーク・認証状態変化を監視 ---
window.addEventListener('online', updateSyncButtons);
window.addEventListener('offline', updateSyncButtons);
window.addEventListener('auth-changed', updateSyncButtons);

// --- 初期化フロー ---
renderAppShell();

window.addEventListener('DOMContentLoaded', () => {
    const savedQuery = localStorage.getItem("sp_searchQuery");
    if (savedQuery !== null) searchMaterialInput.value = savedQuery;

    const savedFilter = localStorage.getItem("sp_filterSubject");
    if (savedFilter !== null) filterSubjectSelect.value = savedFilter;

    const savedStatus = localStorage.getItem("sp_filterStatus");
    if (savedStatus !== null) filterStatusSelect.value = savedStatus;
    
    setTimeout(async () => {
        await loadData();
        updateCategoryOptions();
        const savedCategory = localStorage.getItem("sp_filterCategory");
        if (savedCategory !== null) filterCategorySelect.value = savedCategory;

        renderMaterialList();
        renderTodayPlans();
    }, 0);

    setTimeout(updateSyncButtons, 500);
});

// --- Service Worker 設定 ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${BASE_PATH}sw.js?version=${SW_VERSION}`);
}

// --- バージョン表示 ---
function showVersion() {
    window.alert(
        APP_NAME +
        "\n\n" +
        "バージョン：" + SW_VERSION +
        "\n最終更新日：" + LAST_UPDATED
    );
}
window.showVersion = showVersion;



