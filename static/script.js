import { initFirebase, currentUser } from './login.js';

// ----- 定数 -----
const APP_NAME = 'Studyplanner';
const LAST_UPDATED = '2025/12/23';
const BASE_PATH = '/Studyplanner/';

// ----- 日付 -----
function getLocalDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// ----- DOM要素 -----
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

// ----- Firebase / Firestore -----
let db = null;

// ----- 起動時状態 -----
const todayDateKey = getLocalDate();
const todayDateLabel = new Date().toLocaleDateString('ja-JP');

// ----- データ初期化 -----
const dailyPlans = {};
const materials = [];
let sortBackupMaterials = [];
let categories = new Set();

// 編集用変数
let editingPlanIndex = null;          // 予定（配列基準）
let editingMaterialId = null;         // 教材（id基準）
let editingSortMaterialId = null;     // 並び替え中の教材（id基準）

// ----- UI初期化・状態復元 -----
function renderAppShell() {
    todayDatePanel.textContent = "Loading...";
}
function restoreUIState() {
    const savedQuery = localStorage.getItem("sp_searchQuery");
    if (savedQuery !== null) searchMaterialInput.value = savedQuery;

    const savedFilter = localStorage.getItem("sp_filterSubject");
    if (savedFilter !== null) filterSubjectSelect.value = savedFilter;

    const savedStatus = localStorage.getItem("sp_filterStatus");
    if (savedStatus !== null) filterStatusSelect.value = savedStatus;
}

// ----- 認証・同期UI制御 -----
function updateSyncButtons() {
    const isOnline = navigator.onLine;
    const isLoggedIn = (currentUser !== null);
    const isLoaded = (db !== null);

    // 同期ボタンの有効・無効（前回までのお揃い部分）
    const isDisabled = !(isOnline && isLoggedIn && isLoaded);
    if (uploadBtn) uploadBtn.disabled = isDisabled;
    if (downloadBtn) downloadBtn.disabled = isDisabled;

    // ここから追加：ログイン・ログアウトボタンの出し分け
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const statusPanel = document.getElementById("login-status-panel");

    if (loginBtn && logoutBtn) {
        if (isLoggedIn) {
            loginBtn.style.display = "none";
            logoutBtn.style.display = "block";
            if (statusPanel) statusPanel.textContent = `ログイン中： ${currentUser.displayName} さん`;
        } else {
            loginBtn.style.display = "block";
            logoutBtn.style.display = "none";
            if (statusPanel) statusPanel.textContent = isLoaded ? "未ログイン" : "接続準備中...";
        }
    }
}

// ----- IndexedDB 関連 -----
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

async function saveLocalData(key, value) {
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

async function loadLocalData(key) {
    const db = await dbPromise;
    const tx = db.transaction("data", "readonly");
    const store = tx.objectStore("data");
    return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
    });
}

// ----- 保存・読み込み -----
// オブジェクトのキーを再帰的にアルファベット順にソートする補助関数
function sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        if (Array.isArray(obj)) {
            return obj.map(sortObjectKeys);
        }
        return obj;
    }
    const sortedKeys = Object.keys(obj).sort();
    const result = {};
    sortedKeys.forEach(key => {
        result[key] = sortObjectKeys(obj[key]);
    });
    return result;
}

async function saveAll() {
    // materials のクリーンアップとソート
    // 不要な ongoing, checked を除外し、キーを整列させる
    const cleanedMaterials = materials.map(m => {
        const { ongoing, checked, ...rest } = m;
        return sortObjectKeys(rest);
    });

    // dailyPlans のクリーンアップとソート
    const cleanedPlans = {};
    // 日付キーをソートし、空の配列を除外
    const sortedDates = Object.keys(dailyPlans).sort();
    
    sortedDates.forEach(date => {
        if (Array.isArray(dailyPlans[date]) && dailyPlans[date].length > 0) {
            // 各予定の中身のキーもソートする
            cleanedPlans[date] = dailyPlans[date].map(task => sortObjectKeys(task));
        }
    });

    try {
        // 整頓されたデータをIndexedDBへ保存
        await saveLocalData("materials", cleanedMaterials);
        await saveLocalData("dailyPlans", cleanedPlans);
    } catch (e) {
        console.error("端末への保存に失敗しました", e);
    }
}

async function loadAll() {
    try {
        const savedMaterials = await loadLocalData("materials");
        const savedPlans = await loadLocalData("dailyPlans");

        if (savedMaterials) materials.splice(0, materials.length, ...savedMaterials);
        if (savedPlans) Object.assign(dailyPlans, savedPlans);

        updateCategoryOptions();
    } catch (e) {
        console.error("データの読み込みに失敗しました", e);
    }
}

// ----- カテゴリ関連 -----
function updateCategoryOptions() {
    categories.clear();
    materials.forEach(material => {
        if (material.category) categories.add(material.category);
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

// ----- UI制御（表示・操作）-----
// 画面全体の切り替え
function toggleSections() {
    const planVisible = !planContainer.classList.contains("hidden");
    planContainer.classList.toggle("hidden", planVisible);
    materialContainer.classList.toggle("hidden", !planVisible);
}

// 画面レイヤー制御
function toggleModal(modal, show = true) {
    const footer = document.getElementById("button-container");
    if (footer) footer.style.display = show ? "none" : "flex";
    if (wrapper) wrapper.classList.toggle("full-height", show);
    modal.classList.toggle("hidden", !show);
    document.body.style.overflow = show ? "hidden" : "";
}

// モーダル一括制御
function closeAllModals() {
    [addPlanModal, addMaterialModal, infoMaterialModal, sortMaterialModal].forEach(modal => {
        if (!modal.classList.contains("hidden")) toggleModal(modal, false);
    });
}

// 個別要素の操作
function addTapToggle(itemDiv, type = "material") {
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

// ----- UI生成・補助 -----
// 予定追加時に使用する教材一覧を更新
function populateMaterialSelect(selectedId = null) {
    planMaterialInput.innerHTML = "";
    materials.forEach(material => {
        // 復習の可能性を考慮し、完了教材も表示する
        const option = document.createElement("option");
        option.value = material.id;
        option.textContent = material.name;
        if (material.id === selectedId) option.selected = true;
        planMaterialInput.appendChild(option);
    });
}

// アイコン付きボタンを生成
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

// ----- 保存して再描画 -----
function saveAndRender() {
    // UIはすぐに反映され描画されるが、保存は非同期で裏で行われる
    saveAll();
    renderMaterialList();
    renderTodayPlans();
}

// ----- 描画関数 -----
// 予定描画
function renderTodayPlans() {
    todayDatePanel.textContent = todayDateLabel;
    planItems.innerHTML = "";
    const todayPlans = dailyPlans[todayDateKey] || [];
    const sortedPlans = [...todayPlans].sort((a, b) => {
        if (a.checked && !b.checked) return 1;
        if (!a.checked && b.checked) return -1;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
    });

    sortedPlans.forEach(plan => {
        const material = materials.find(item => item.id === plan.materialId);
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
            editingPlanIndex = todayPlans.indexOf(plan);
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
        addTapToggle(item, "plan");
        planItems.appendChild(item);
    });
}

// 教材描画
function renderMaterialList() {
    const query = searchMaterialInput.value.toLowerCase();
    const subjectFilter = filterSubjectSelect.value;
    const statusFilter = filterStatusSelect.value;
    const categoryFilter = filterCategorySelect.value;

    materialItems.innerHTML = "";

    materials.forEach(material => {
        // 基本プロパティチェック (statusがない場合はwaitingとみなす)
        const status = material.status || "waiting";

        // --- フィルタ処理 ---
        if (subjectFilter !== "all" && material.subject !== subjectFilter) return;
        if (!material.name.toLowerCase().includes(query)) return;
        
        // カテゴリフィルタ
        if (categoryFilter !== "all") {
            if (categoryFilter === "none") {
                if (material.category) return;
            } else {
                if (material.category !== categoryFilter) return;
            }
        }

        // ステータスフィルタ
        if (statusFilter !== "all") {
            if (statusFilter === "planning") {
                // planning = 未完了（waiting + learning）扱い
                if (status === "completed") return;
            } else {
                if (status !== statusFilter) return;
            }
        }

        // --- DOM生成 ---
        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${material.subject}`;
        itemDiv.style.setProperty('--material-bg-width', `${material.progress || 0}%`);

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
        nameTitleDiv.textContent = material.name;

        const nameDateDiv = document.createElement("div");
        nameDateDiv.className = "material-name-date";
        if(material.date) nameDateDiv.textContent = `期間：${material.date}`;

        const nameProgressDiv = document.createElement("div");
        nameProgressDiv.className = "material-name-progress";
        
        if (material.progress !== undefined && material.progress !== null) {
            nameProgressDiv.textContent = `進度：${material.progress}%`;
        }

        const nameCommentDiv = document.createElement("div");
        nameCommentDiv.className = "material-name-comment";
        if(material.detail) nameCommentDiv.innerHTML = material.detail.replace(/\n/g, "<br>");

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
            populateMaterialSelect(material.id);
            planContentInput.value = "";
            planTimeInput.value = "";
            editingPlanIndex = null;
            toggleModal(addPlanModal, true);
        });

        const editBtn = createIconButton("edit", '<i class="fa-solid fa-pen"></i>', () => {
            updateCategoryOptions();
            
            materialSubjectSelect.value = material.subject;
            materialNameInput.value = material.name;
            
            if (material.category) {
                if (!categories.has(material.category)) {
                    categories.add(material.category);
                    updateCategoryOptions();
                }
                materialCategorySelect.value = material.category;
            } else {
                materialCategorySelect.value = "";
            }
            newCategoryInput.classList.add("hidden");
            
            editingMaterialId = material.id;
            toggleModal(addMaterialModal, true);
        });

        const infoBtn = createIconButton("info", '<i class="fa-solid fa-info"></i>', () => {
            materialNamePanel.textContent = material.name;
            
            // プルダウンに値をセット
            materialStatusSelect.value = material.status || "waiting";

            materialDateInput.value = material.date || "";
            materialProgressInput.value = material.progress || 0;
            materialDetailInput.value = material.detail || "";
            editingMaterialId = material.id;
            toggleModal(infoMaterialModal, true);
        });

        const delBtn = createIconButton("delete", '<i class="fa-solid fa-trash-can"></i>', () => {
            if (confirm(`教材「${material.name}」を削除しますか？`)) {
                const idx = materials.findIndex(item => item.id === material.id);
                if (idx !== -1) materials.splice(idx, 1);
                Object.keys(dailyPlans).forEach(date => {
                    dailyPlans[date] = dailyPlans[date].filter(p => p.materialId !== material.id);
                });
                saveAndRender();
                updateCategoryOptions();
            }
        });

        btnDiv.append(addPlanBtn, editBtn, infoBtn, delBtn);
        itemDiv.appendChild(btnDiv);
        addTapToggle(itemDiv, "material");
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

// 教材並び替えモーダル描画
function renderSortMaterialModal() {
    sortItems.innerHTML = "";
    
    materials.forEach(material => {
        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${material.subject}`;
        itemDiv.dataset.id = material.id;

        itemDiv.style.flexDirection = "row";
        itemDiv.style.alignItems = "center";
        itemDiv.style.padding = "8px 12px";
        itemDiv.style.minHeight = "60px";
        itemDiv.style.cursor = "pointer";
        itemDiv.style.position = "relative";
        itemDiv.style.setProperty('--material-bg-width', '0%');

        itemDiv.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            editingSortMaterialId = (editingSortMaterialId === material.id) ? null : material.id;
            renderSortMaterialModal();
        });

        const nameDiv = document.createElement("div");
        nameDiv.textContent = material.name;
        nameDiv.style.flex = "1";
        nameDiv.style.fontWeight = "bold";
        nameDiv.style.marginRight = "8px";
        itemDiv.appendChild(nameDiv);

        if (material.id === editingSortMaterialId) {
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
                const idx = materials.indexOf(material);
                if (idx <= 0) return;
                [materials[idx - 1], materials[idx]] = [materials[idx], materials[idx - 1]];
                renderSortMaterialModal();
            });

            const downBtn = createIconButton("sort-down", '<i class="fa-solid fa-arrow-down"></i>', () => {
                const idx = materials.indexOf(material);
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

// ----- クラウド関連 -----
// アップロード処理
uploadBtn.addEventListener("click", async () => {
    if (!db || !currentUser) return;
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

// ダウンロード処理
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

// --- モーダル操作 ---
// 予定追加モーダル
cancelPlanBtn.addEventListener("click", () => {
    toggleModal(addPlanModal, false);
});
confirmPlanBtn.addEventListener("click", () => {
    const materialId = parseInt(planMaterialInput.value, 10);
    const range = planContentInput.value.trim();
    const time = planTimeInput.value;
    if (!range) return alert("範囲を入力してください");
    
    if (editingPlanIndex !== null) {
        dailyPlans[todayDateKey][editingPlanIndex] = { ...dailyPlans[todayDateKey][editingPlanIndex], materialId, range, time };
        editingPlanIndex = null;
    } else {
        if (!dailyPlans[todayDateKey]) dailyPlans[todayDateKey] = [];
        dailyPlans[todayDateKey].push({ materialId, range, time, checked: false });
    }
    toggleModal(addPlanModal, false);
    saveAndRender();
});

// 教材追加モーダル
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
    
    // 新規作成時はデフォルトで waiting（未着手）にする
    if (editingMaterialId !== null) {
        const material = materials.find(item => item.id === editingMaterialId);
        if (material) { material.name = name; material.subject = subject; material.category = category; }
    } else {
        const newId = materials.length ? Math.max(...materials.map(material => material.id)) + 1 : 1;
        materials.push({ 
            id: newId, 
            name, 
            subject, 
            category, 
            progress: 0, 
            status: "waiting"
        });
    }
    
    editingMaterialId = null;
    toggleModal(addMaterialModal, false);
    saveAndRender();
    updateCategoryOptions();
});

// 教材詳細モーダル
cancelInfoBtn.addEventListener("click", () => {
    toggleModal(infoMaterialModal, false);
});
confirmInfoBtn.addEventListener("click", () => {
    let status = materialStatusSelect.value;  // 後で書き換える可能性がある
    
    const date = materialDateInput.value;
    const progress = parseInt(materialProgressInput.value, 10);
    const detail = materialDetailInput.value.replace(/^\s+|\s+$/g, '');
    
    if (isNaN(progress) || progress < 0 || progress > 100) return alert("進度は0～100の整数値で入力してください");
    if (progress === 100 && status !== "completed") {
        if (confirm("進捗が100%になりました。\nステータスを「完了」に変更しますか？")) {
            status = "completed";
        }
    }
    
    if (editingMaterialId !== null) {
        const material = materials.find(material => material.id === editingMaterialId);
        if (material) { 
            material.status = status; 
            material.date = date; 
            material.progress = progress; 
            material.detail = detail; 
        }
    }
    toggleModal(infoMaterialModal, false);
    saveAndRender();
});

// 教材並び替えモーダル
openSortModalBtn.addEventListener("click", () => {
    sortBackupMaterials = JSON.parse(JSON.stringify(materials));
    editingSortMaterialId = null;
    renderSortMaterialModal();
    toggleModal(sortMaterialModal, true);
});
cancelSortBtn.addEventListener("click", () => {
    materials.splice(0, materials.length, ...sortBackupMaterials);
    toggleModal(sortMaterialModal, false);
});
confirmSortBtn.addEventListener("click", () => {
    toggleModal(sortMaterialModal, false);
    saveAndRender();
});

// まとめて追加モーダル
bulkAddBtn.addEventListener("click", () => {
    bulkMaterialList.innerHTML = "";
    
    // 完了していない教材のみ抽出して表示
    const activeMaterials = materials.filter(material => material.status !== "completed");
    
    if (activeMaterials.length === 0) {
        bulkMaterialList.innerHTML = "<p style='text-align:center; font-size:12px;'>学習中・未着手の教材がありません</p>";
    } else {
        activeMaterials.forEach(material => {
            const label = document.createElement("label");
            label.className = "bulk-item-label";
            
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = material.id;
            
            const span = document.createElement("span");
            span.textContent = material.name;
            
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
    
    if (!dailyPlans[todayDateKey]) dailyPlans[todayDateKey] = [];
    
    checkboxes.forEach(cb => {
        const materialId = parseInt(cb.value, 10);
        dailyPlans[todayDateKey].push({ 
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
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});
importJsonBtn.addEventListener("click", () => {
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
            if (!data.materials || !data.dailyPlans) return alert("エラー：正しいバックアップファイルではありません。");
            if (!confirm(`データ（${data.exportedAt || '日付不明'} 作成）を読み込みますか？\n※現在のデータは上書きされます。`)) return;

            // データを変数に反映
            materials.splice(0, materials.length, ...data.materials);
            
            // dailyPlansをクリアして反映
            for (const key in dailyPlans) delete dailyPlans[key];
            Object.assign(dailyPlans, data.dailyPlans);

            // カテゴリやIndexed DBも更新
            await saveAll();
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

// ----- Enterキー・Escキー操作 -----
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

// ----- Service Worker登録と更新感知 -----
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
    let newWorker = null;
    navigator.serviceWorker.register(`${BASE_PATH}sw.js`)
        .then(reg => {
            // すでに待機中のSWがある場合（再訪問時など）
            if (reg.waiting) {
                newWorker = reg.waiting;
                offerUpdate(newWorker);
            }

            // 新しいSWが見つかったとき
            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', () => {
                    if (
                        newWorker.state === 'installed' &&
                        navigator.serviceWorker.controller
                    ) {
                        offerUpdate(newWorker);
                    }
                });
            });
        })
        .catch(err => {
            console.error('Service Worker registration failed:', err);
        });
}

// ----- 初期化フロー -----
window.addEventListener('DOMContentLoaded', () => {
    restoreUIState();
    loadAll().then(() => {
        const savedCat = localStorage.getItem("sp_filterCategory");
        if (savedCat !== null) filterCategorySelect.value = savedCat;
        renderMaterialList();
        renderTodayPlans();
        
        // 画面が出た後、裏でFirebaseを読み込み開始
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



