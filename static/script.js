import { initFirebase, currentUser } from './login.js';

// --- 定数 ---
const APP_NAME = 'Studyplanner';
const LAST_UPDATED = '2025/12/20';
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
let db = null;

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

// まとめて追加モーダル要素
const bulkAddBtn = document.getElementById("bulk-add-btn");
const bulkAddModal = document.getElementById("bulk-add-modal");
const bulkMaterialList = document.getElementById("bulk-material-list");
const cancelBulkBtn = document.getElementById("cancel-bulk-btn");
const confirmBulkBtn = document.getElementById("confirm-bulk-btn");

// 編集用変数
let editingMaterialId = null;
let editingIndex = null;
let editingSortId = null;

// --- 共通関数 ---
function renderAppShell() {
    todayDatePanel.textContent = "Loading...";
}

// 入力データを復元
const restoreUIState = () => {
    const savedQuery = localStorage.getItem("sp_searchQuery");
    if (savedQuery !== null) searchMaterialInput.value = savedQuery;

    const savedFilter = localStorage.getItem("sp_filterSubject");
    if (savedFilter !== null) filterSubjectSelect.value = savedFilter;

    const savedStatus = localStorage.getItem("sp_filterStatus");
    if (savedStatus !== null) filterStatusSelect.value = savedStatus;
};

function updateSyncButtons() {
    const isOnline = navigator.onLine;
    const isLoggedIn = (currentUser !== null);
    const isLoaded = (db !== null); // Firebase読み込み済みか

    // 同期ボタンの有効・無効（前回までのお揃い部分）
    const isDisabled = !(isOnline && isLoggedIn && isLoaded);
    if (uploadBtn) uploadBtn.disabled = isDisabled;
    if (downloadBtn) downloadBtn.disabled = isDisabled;

    // --- ここから追加：ログイン・ログアウトボタンの出し分け ---
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const statusPanel = document.getElementById("login-status-panel");

    if (loginBtn && logoutBtn) {
        if (isLoggedIn) {
            // ログイン中のとき
            loginBtn.style.display = "none";   // ログインボタンを隠す
            logoutBtn.style.display = "block"; // ログアウトボタンを出す
            if (statusPanel) statusPanel.textContent = `ログイン中： ${currentUser.displayName} さん`;
        } else {
            // 未ログインのとき
            loginBtn.style.display = "block";  // ログインボタンを出す
            logoutBtn.style.display = "none";  // ログアウトボタンを隠す
            if (statusPanel) statusPanel.textContent = isLoaded ? "未ログイン" : "接続準備中...";
        }
    }
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
    try {
        await saveAll("materials", materials);
        await saveAll("dailyPlans", dailyPlans);
    } catch (e) {
        console.error("端末への保存に失敗しました", e);
    }
}

async function loadData() {
    const savedMaterials = await getAll("materials");
    const savedPlans = await getAll("dailyPlans");

    if (savedMaterials) materials.splice(0, materials.length, ...savedMaterials);
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

// --- アップロード処理 ---
uploadBtn.addEventListener("click", async () => {
    if (!db || !currentUser) return; // 念のためcurrentUserもチェック
    if (!window.confirm("データをクラウドへアップロードします。よろしいですか？")) return;
    
    uploadBtn.disabled = true;

    try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
        
        await setDoc(doc(db, "backups", currentUser.uid), {
            materials: materials,
            dailyPlans: dailyPlans,
            updatedAt: new Date().toISOString(),
        });
        
        alert("アップロードが完了しました。");
    } catch (e) {
        console.error("Upload error:", e);
        alert("アップロードに失敗しました。");
    } finally {
        uploadBtn.disabled = false;
    }
});

// --- ダウンロード処理 ---
downloadBtn.addEventListener("click", async () => {
    if (!db || !currentUser) return;
    if (!window.confirm("データをクラウドからダウンロードして上書きします。よろしいですか？")) return;
    
    downloadBtn.disabled = true;

    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
        
        const snapshot = await getDoc(doc(db, "backups", currentUser.uid));
        if (!snapshot.exists()) {
            alert("バックアップデータが存在しませんでした。");
            return;
        }

        const data = snapshot.data();
        
        // データ反映
        materials.splice(0, materials.length, ...(data.materials || []));
        for (const key in dailyPlans) delete dailyPlans[key];
        Object.assign(dailyPlans, data.dailyPlans || {});
        
        saveAndRender();
        alert("ダウンロードが完了しました。");
    } catch (e) {
        console.error("Download error:", e);
        alert("ダウンロードに失敗しました。");
    } finally {
        downloadBtn.disabled = false;
    }
});

// --- モーダル操作イベント ---
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

bulkAddBtn.addEventListener("click", () => {
    bulkMaterialList.innerHTML = "";
    
    // 完了していない教材のみ抽出して表示
    const activeMaterials = materials.filter(m => m.status !== "completed");
    
    if (activeMaterials.length === 0) {
        bulkMaterialList.innerHTML = "<p style='text-align:center; font-size:12px;'>学習中・未着手の教材がありません</p>";
    } else {
        activeMaterials.forEach(m => {
            const label = document.createElement("label");
            label.className = "bulk-item-label";
            
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = m.id;
            
            const span = document.createElement("span");
            span.textContent = m.name;
            
            label.append(checkbox, span);
            bulkMaterialList.appendChild(label);
        });
    }
    
    toggleModal(bulkAddModal, true);
});
cancelBulkBtn.addEventListener("click", () => {
    toggleModal(bulkAddModal, false);
});
confirmBulkBtn.addEventListener("click", () => {
    // チェックされた教材のIDを取得
    const checkboxes = bulkMaterialList.querySelectorAll("input[type='checkbox']:checked");
    
    if (checkboxes.length === 0) {
        return alert("教材が選択されていません");
    }
    
    if (!dailyPlans[todayKey]) dailyPlans[todayKey] = [];
    
    checkboxes.forEach(cb => {
        const materialId = parseInt(cb.value);
        // 内容を「仮」、時間は空で追加
        dailyPlans[todayKey].push({ 
            materialId, 
            range: "仮", 
            time: "", 
            checked: false 
        });
    });
    
    toggleModal(bulkAddModal, false);
    saveAndRender();
    alert(`${checkboxes.length}件の予定を追加しました`);
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
        version: window.APP_VERSION
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

// --- [8. サービスワーカー登録と更新感知] ---
let isUpdateProcessed = (sessionStorage.getItem('sw_update_processed') === 'true');

function offerUpdate(worker) {
    if (isUpdateProcessed) return;

    // 起動直後の安定を待ってから通知
    setTimeout(() => {
        if (confirm("新しいバージョンがあります。更新（再起動）しますか？")) {
            isUpdateProcessed = true;
            sessionStorage.setItem('sw_update_processed', 'true');
            worker.postMessage('skipWaiting');
        }
    }, 1000); 
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${BASE_PATH}sw.js?v=${window.APP_VERSION}`)
            .then(reg => {
                
                // パターンA: すでに待機中の更新がある場合
                setTimeout(() => {
                    if (reg.waiting && navigator.serviceWorker.controller) {
                        offerUpdate(reg.waiting);
                    }
                }, 1000);

                // パターンB: 起動中に新バージョンを検知した場合
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            offerUpdate(newWorker);
                        }
                    });
                });
            });
    });

    // サービスワーカーの入れ替え完了時にリロード
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        sessionStorage.setItem('sw_update_processed', 'true');
        window.location.reload();
    });
}
// --- [9. ★新設：初期化フロー] ---
window.addEventListener('DOMContentLoaded', () => {
    // A. UIの状態を復元
    restoreUIState();

    // B. IndexedDBからロードして即描画 (Firebaseを待たない！)
    loadData().then(() => {
        const savedCat = localStorage.getItem("sp_filterCategory");
        if (savedCat !== null) filterCategorySelect.value = savedCat;
        renderMaterialList();
        renderTodayPlans();
        
        // C. 画面が出た後、裏でFirebaseを読み込み開始
        initFirebase().then((res) => {
            db = res.db;
            updateSyncButtons();
        });
    });

    // 初期状態のボタン更新
    updateSyncButtons();
});

// バージョン表示
window.showVersion = function() {
    alert(`${APP_NAME}\n\nバージョン：${window.APP_VERSION}\n最終更新日：${LAST_UPDATED}`);
};

window.addEventListener('online', updateSyncButtons);
window.addEventListener('offline', updateSyncButtons);
window.addEventListener('auth-ready', updateSyncButtons);
window.addEventListener('auth-changed', updateSyncButtons);





