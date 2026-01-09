import { initFirebase, currentUser } from './sys-auth.js';

// ----- 1. 初期設定 -----
const APP_NAME = 'Studyplanner';
const LAST_UPDATED = '2026/1/9';
const BASE_PATH = '/Studyplanner/';

// ----- 2. ユーティリティ -----
function getLocalDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// ----- 3. アプリ状態管理 -----
const materials = [];
let sortBackupMaterials = [];
let categories = new Set();
let materialMap = new Map();
const dailyPlans = {};
let editingPlanIndex = null;          // 予定（配列基準）
let editingMaterialId = null;         // 教材（id基準）
let editingSortMaterialId = null;     // 並び替え中の教材（id基準）
let isModalEdited = false;            // モーダル内で何らかの編集がされたか
let todayDateKey = getLocalDate();  // 再代入の可能性があるため
let db = null;
let isUpdateProcessed = (sessionStorage.getItem('sw_update_processed') === 'true');   // Service Worker更新済みフラグ

// ----- 4. ドメインロジック（UI非依存） -----
// -- 教材のmapを再構築 --
function rebuildMaterialMap() {
    materialMap.clear();
    materials.forEach(m => materialMap.set(m.id, m));
}
// -- 教材をカテゴリごとに並べ替える関数 --
function getSortedMaterials(targetArray = materials) {
    return [...targetArray].sort((a, b) => {
        const catA = a.category || "zzz_なし";
        const catB = b.category || "zzz_なし";
        
        if (catA !== catB) {
            return catA.localeCompare(catB, 'ja');
        }
        return materials.indexOf(a) - materials.indexOf(b);
    });
}
// -- 同じカテゴリーに属する直前/直後のアイテムと位置を入れ替える関数 --
function moveInGlobalArray(item, direction) {
    const globalIdx = materials.indexOf(item);
    const cat = item.category || "";
    let targetIdx = -1;

    if (direction === -1) {
        // 上方向に同じカテゴリーの教材を探す
        for (let i = globalIdx - 1; i >= 0; i--) {
            if ((materials[i].category || "") === cat) { targetIdx = i; break; }
        }
    } else {
        // 下方向に同じカテゴリーの教材を探す
        for (let i = globalIdx + 1; i < materials.length; i++) {
            if ((materials[i].category || "") === cat) { targetIdx = i; break; }
        }
    }

    if (targetIdx !== -1) {
        // 配列内での入れ替えを実行
        [materials[globalIdx], materials[targetIdx]] = [materials[targetIdx], materials[globalIdx]];
        isModalEdited = true;
        renderSortMaterialModal();
    }
}


// ----- 5. 永続化（IndexedDB） -----
// -- IndexedDBの初期化 --
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
// -- データ保存・読み込み関数 --
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
// -- 全データ保存・読み込み関数 --
async function saveAll() {
    // 保存前にデータを整理
    const cleanedMaterials = materials.map(m => ({
        id: Number(m.id),
        name: m.name,
        subject: m.subject,
        category: m.category || "",
        progress: Number(m.progress) || 0,
        status: m.status || "waiting",
        date: m.date || "",
        detail: m.detail || ""
    }));
    materials.splice(0, materials.length, ...cleanedMaterials);

    // dailyPlansの整理
    const cleanedPlans = {};
    Object.keys(dailyPlans).sort().forEach(date => {
        if (Array.isArray(dailyPlans[date])) {
            cleanedPlans[date] = dailyPlans[date].map(p => ({
                materialId: Number(p.materialId),
                range: p.range,
                time: p.time || "",
                checked: !!p.checked
            }));
        }
    });
    for (const key in dailyPlans) delete dailyPlans[key];
    Object.assign(dailyPlans, cleanedPlans);

    try {
        await saveLocalData("materials", cleanedMaterials);
        await saveLocalData("dailyPlans", cleanedPlans);
    } catch (e) {
        console.error("端末への保存に失敗しました。", e);
    }
}
async function loadAll() {
    try {
        const savedMaterials = await loadLocalData("materials");
        const savedPlans = await loadLocalData("dailyPlans");

        // 教材データの読み込み
        if (savedMaterials && Array.isArray(savedMaterials)) {
            materials.splice(0, materials.length, ...savedMaterials);
        } else {
            materials.splice(0, materials.length);
        }
        
        // 予定データの読み込み
        if (savedPlans && typeof savedPlans === 'object') {
            // dailyPlansを一度空にしてから反映
            for (const key in dailyPlans) delete dailyPlans[key];
            Object.assign(dailyPlans, savedPlans);
        } else {
            // データが空ならリセット
            for (const key in dailyPlans) delete dailyPlans[key];
        }
        updateCategoryOptions();

    } catch (e) {
        console.error("データの読み込みに失敗しました。", e);
        // 失敗した場合は安全のために空の状態を保証する
        materials.splice(0, materials.length);
        for (const key in dailyPlans) delete dailyPlans[key];
    }
}
// -- 保存・再描画 --
function saveAndRender() {
    // UIはすぐに反映され描画されるが、保存は非同期で裏で行われる
    saveAll();
    renderMaterialList();
    renderTodayPlans();
}
// -- データ所有者チェック --
async function checkDataOwner() {
    const savedUid = await loadLocalData("ownerUid");
    
    // ログイン済みで、データの所有者が「ゲスト」でなく「自分」でもない場合
    if (currentUser && savedUid && savedUid !== "guest" && savedUid !== currentUser.uid) {
        return false;
    }
    return true;
}

// ----- 6. Firebase / Firestore 初期化 -----
// -- ボタンの有効・無効管理 --
function updateSyncButtons() {
    const isOnline = navigator.onLine;
    const isLoggedIn = (currentUser !== null);
    const isLoaded = (db !== null);

    // 同期ボタンの有効・無効（前回までのお揃い部分）
    const isDisabled = !(isOnline && isLoggedIn && isLoaded);
    if (uploadBtn) uploadBtn.disabled = isDisabled;
    if (downloadBtn) downloadBtn.disabled = isDisabled;

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

    // リロードボタンも無効化（リロードするとアイコンが表示されなくなってしまう）
    const reloadBtn = document.getElementById("reload-btn");
    if (reloadBtn) {
        reloadBtn.disabled = !isOnline;
        reloadBtn.style.opacity = isOnline ? "1" : "0.5";
    }
}
// -- upload --
async function upload() {
    if (!db || !currentUser) return;

    const isSafe = await checkDataOwner();
    const msg = isSafe 
        ? "データをクラウドへアップロードします。よろしいですか？"
        : "⚠ アカウントが異なる可能性があります。このままアップロード（上書き）しますか？";

    if (!confirm(msg)) return;

    uploadBtn.disabled = true;

    try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
        
        await setDoc(doc(db, "backups", currentUser.uid), {
            materials: materials,
            dailyPlans: dailyPlans,
            updatedAt: new Date().toISOString(),
        });
        
        await saveLocalData("ownerUid", currentUser.uid);
        alert("アップロードが完了しました。");
    } catch (e) {
        console.error("Upload error:", e);
        alert("アップロードに失敗しました。");
    } finally {
        uploadBtn.disabled = false;
    }
}
// -- download --
async function download() {
    if (!db || !currentUser) return;

    const isSafe = await checkDataOwner();
    const msg = isSafe 
        ? "データをクラウドからダウンロードします。よろしいですか？"
        : "⚠ アカウントが異なる可能性があります。このままダウンロードしますか？";

    if (!confirm(msg + "（現在の端末のデータは上書きされます）")) return;
    
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
        rebuildMaterialMap();

        for (const key in dailyPlans) delete dailyPlans[key];
        Object.assign(dailyPlans, data.dailyPlans || {});
        
        saveAndRender();
        await saveLocalData("ownerUid", currentUser.uid);

        alert("ダウンロードが完了しました。");
    } catch (e) {
        console.error("Download error:", e);
        alert("ダウンロードに失敗しました。");
    } finally {
        downloadBtn.disabled = false;
    }
}
// -- export --
async function exportDataAsJson() {
    if (!confirm("データをファイルとして保存しますか？")) return;
    
    // saveAllの中で既にデータは綺麗に整頓されている
    await saveAll();
    
    const data = {
        materials: materials,
        dailyPlans: dailyPlans,
        exportedAt: getLocalDate(),
        appName: APP_NAME,
        version: window.APP_VERSION
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `studyplanner_${getLocalDate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
// -- import --
async function importDataAsJson(file) {
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
            rebuildMaterialMap();
            
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
}


// ----- 7. DOM要素取得 -----
const wrapper = document.getElementById("wrapper");
const todayDatePanel = document.getElementById("todaydate-panel");
const planContainer = document.getElementById("plan-container");
const planItems = document.getElementById("plan-items");
const materialContainer = document.getElementById("material-container");
const materialItems = document.getElementById("material-items");

// -- ユーティリティボタン --
const openMaterialModalBtn = document.getElementById("add-material-btn");
const openSortModalBtn = document.getElementById("sort-material-btn");
const openBulkAddBtn = document.getElementById("bulk-add-btn");
const toggleSectionBtn = document.getElementById("toggle-section-btn");
const uploadBtn = document.getElementById('upload-btn');
const downloadBtn = document.getElementById('download-btn');
const exportJsonBtn = document.getElementById("export-json-btn");
const importJsonBtn = document.getElementById("import-json-btn");
const importFileInput = document.getElementById("import-file-input");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const statusPanel = document.getElementById("auth-status-panel");

// -- 検索・フィルタ入力要素 --
const searchMaterialInput = document.getElementById("search-material-input");
const filterSubjectSelect = document.getElementById("filter-subject-select");
const filterStatusSelect = document.getElementById("filter-status-select");
const filterCategorySelect = document.getElementById("filter-category-select");

// -- 予定追加・編集モーダル要素 --
const addPlanModal = document.getElementById("add-plan-modal");
const planMaterialInput = document.getElementById("plan-material-select");
const planContentInput = document.getElementById("plan-content-input");
const planTimeInput = document.getElementById("plan-time-input");
const cancelPlanBtn = document.getElementById("cancel-plan-btn");
const confirmPlanBtn = document.getElementById("confirm-plan-btn");

// -- 教材追加・編集モーダル要素 --
const addMaterialModal = document.getElementById("add-material-modal");
const materialNameInput = document.getElementById("material-info");
const materialSubjectSelect = document.getElementById("material-subject-select");
const materialCategorySelect = document.getElementById("material-category-select");
const newCategoryInput = document.getElementById("new-category-input");
const cancelMaterialBtn = document.getElementById("cancel-material-btn");
const confirmMaterialBtn = document.getElementById("confirm-material-btn");

// -- 教材情報表示モーダル要素 --
const infoMaterialModal = document.getElementById("info-material-modal");
const materialNamePanel = document.getElementById("material-name-panel");
const materialDateInput = document.getElementById("material-date-input");
const materialProgressInput = document.getElementById("material-progress-input");
const materialDetailInput = document.getElementById("material-detail-input");
const materialStatusSelect = document.getElementById("material-status-select");
const cancelInfoBtn = document.getElementById("cancel-info-btn");
const confirmInfoBtn = document.getElementById("confirm-info-btn");

// -- 並び替えモーダル要素 --
const sortMaterialModal = document.getElementById("sort-material-modal");
const sortItems = document.getElementById("sort-items");
const cancelSortBtn = document.getElementById("cancel-sort-btn");
const confirmSortBtn = document.getElementById("confirm-sort-btn");

// -- まとめて追加モーダル要素
const bulkAddModal = document.getElementById("bulk-add-modal");
const bulkMaterialList = document.getElementById("bulk-material-list");
const cancelBulkBtn = document.getElementById("cancel-bulk-btn");
const confirmBulkBtn = document.getElementById("confirm-bulk-btn");

// -- 履歴・統計表示モーダル要素 --
const historyModal = document.getElementById("history-modal");
const historyContainer = document.getElementById("history-container");
const balanceList = document.getElementById("balance-list");
const historyMaterialName = document.getElementById("history-material-name");
const statTotalCompleted = document.getElementById("stat-total-completed");
const statLastDate = document.getElementById("stat-last-date");
const closeHistoryBtn = document.getElementById("close-history-btn");


// ----- 8. UI制御（表示・操作） -----
// ----- 8-1. UI操作関数群 -----
// -- 保存されたUI状態の復元 --
function restoreUIState() {
    const savedQuery = localStorage.getItem("sp_searchQuery");
    if (savedQuery !== null) searchMaterialInput.value = savedQuery;

    const savedFilter = localStorage.getItem("sp_filterSubject");
    if (savedFilter !== null) filterSubjectSelect.value = savedFilter;

    const savedStatus = localStorage.getItem("sp_filterStatus");
    if (savedStatus !== null) filterStatusSelect.value = savedStatus;
}
// -- カテゴリを再構築 --
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
// -- 画面セクション切り替え --
function toggleSections() {
    const planVisible = !planContainer.classList.contains("hidden");
    planContainer.classList.toggle("hidden", planVisible);
    materialContainer.classList.toggle("hidden", !planVisible);
}
// -- 画面レイヤー制御 --
function toggleModal(modal, show = true) {
    const footer = document.getElementById("button-container");
    if (footer) footer.style.display = show ? "none" : "flex";
    if (wrapper) wrapper.classList.toggle("full-height", show);
    modal.classList.toggle("hidden", !show);
    document.body.style.overflow = show ? "hidden" : "";

    // モーダルを開くとき、中身のスクロールを一番上に戻す
    if (show) {
        const container = modal.querySelector(".modal-container");
        if (container) {
            container.scrollTop = 0;
        }
    }
}
// -- 予定追加・編集モーダルでの教材選択 => 予定追加・編集モーダル --
function populateMaterialSelect(selectedId = null) {
    planMaterialInput.innerHTML = "";
    materials.forEach(material => {
        const option = document.createElement("option");
        option.value = material.id;
        option.textContent = material.name;
        if (material.id === selectedId) option.selected = true;
        planMaterialInput.appendChild(option);
    });
}

// ----- 8-2. モーダルを開く関数 -----
// -- 教材追加・編集モーダル --
function openMaterialModal(materialId = null) {
    updateCategoryOptions();
    if (materialId !== null) {
        const material = materialMap.get(materialId);
        materialSubjectSelect.value = material.subject;
        materialNameInput.value = material.name;
        materialCategorySelect.value = material.category || "";
        editingMaterialId = materialId;
    } else {
        materialNameInput.value = "";
        materialSubjectSelect.value = "math";
        materialCategorySelect.value = "";
        editingMaterialId = null;
    }
    newCategoryInput.classList.add("hidden");
    toggleModal(addMaterialModal, true);
}
// -- 予定追加・編集モーダル --
function openPlanModal(materialId = null, planIndex = null) {
    populateMaterialSelect(materialId);
    if (planIndex !== null) {
        const plan = dailyPlans[todayDateKey][planIndex];
        planContentInput.value = plan.range;
        planTimeInput.value = plan.time || "";
        editingPlanIndex = planIndex;
    } else {
        planContentInput.value = "";
        planTimeInput.value = "";
        editingPlanIndex = null;
    }
    toggleModal(addPlanModal, true);
}
// -- 教材並び替えモーダル --
function openSortModal() {
    isModalEdited = false;
    editingSortMaterialId = null;
    sortBackupMaterials = JSON.parse(JSON.stringify(materials));

    // メイン画面の現在のカテゴリフィルタ値を初期値として取得
    let currentCat = filterCategorySelect.value;
    if (currentCat === "all") currentCat = "none";

    const modalSelect = document.getElementById("sort-category-select");
    modalSelect.innerHTML = filterCategorySelect.innerHTML;
    const allOpt = modalSelect.querySelector('option[value="all"]');
    if (allOpt) allOpt.remove();

    modalSelect.value = currentCat;

    modalSelect.onchange = () => {
        editingSortMaterialId = null;
        renderSortMaterialModal();
    };

    renderSortMaterialModal();
    toggleModal(sortMaterialModal, true);
}

// -- 教材情報表示モーダル --
function openInfoModal(materialId) {
    const material = materialMap.get(materialId);
    if (!material) return;
    
    isModalEdited = false;
    materialNamePanel.textContent = material.name;
    materialStatusSelect.value = material.status || "waiting";
    materialDateInput.value = material.date || "";
    materialProgressInput.value = material.progress || 0;
    materialDetailInput.value = material.detail || "";
    editingMaterialId = materialId;
    toggleModal(infoMaterialModal, true);
}
// -- まとめて追加モーダル --
function openBulkAddModal() {
    bulkMaterialList.innerHTML = "";
    const activeMaterials = materials.filter(m => m.status === "learning");
    const displayMaterials = getSortedMaterials(activeMaterials);
    
    if (displayMaterials.length === 0) {
        bulkMaterialList.innerHTML = "<p style='text-align:center; font-size:12px;'>学習中・未着手の教材がありません。</p>";
    } else {
        displayMaterials.forEach(material => {
            const label = document.createElement("label");
            label.className = "bulk-item-label";
            label.innerHTML = `<input type="checkbox" value="${material.id}"> <span></span>`;
            label.querySelector("span").textContent = material.name;
            bulkMaterialList.appendChild(label);
        });
    }
    toggleModal(bulkAddModal, true);
}
// -- 履歴・統計表示モーダル --
function openHistoryModal(materialId) {
    const material = materialMap.get(materialId);
    if (!material) return;

    let totalCompletedTasks = 0;
    const subjectCounts = {};
    let materialCompletedCount = 0;
    let lastDate = null;
    const historyData = [];

    const subjectLabels = {
        math: "数学",
        english: "英語",
        modernjp: "現代文",
        classicjp: "古典",
        science: "理科",
        social: "社会",
        others: "その他"
    };

    // データの集計
    Object.keys(dailyPlans).forEach(date => {
        dailyPlans[date].forEach(plan => {
            if (plan.checked) {
                totalCompletedTasks++;
                const targetMaterial = materialMap.get(plan.materialId);
                const subject = targetMaterial ? targetMaterial.subject : 'others';
                subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;

                if (plan.materialId === materialId) {
                    materialCompletedCount++;
                    if (!lastDate || date > lastDate) lastDate = date;
                }
            }
            if (plan.materialId === materialId) {
                historyData.push({ date, ...plan });
            }
        });
    });

    // 表示の更新
    historyMaterialName.textContent = material.name;
    statTotalCompleted.innerHTML = `${materialCompletedCount} <small>回</small>`;
    statLastDate.textContent = lastDate ? lastDate.replace(/-/g, '/') : '---';

    // バランスバーの描画
    balanceList.innerHTML = "";
    if (totalCompletedTasks === 0) {
        balanceList.innerHTML += "<p class='no-data'>完了した実績がまだありません</p>";
    } else {
        const sortedSubjects = Object.keys(subjectCounts).sort((a, b) => subjectCounts[b] - subjectCounts[a]);
        sortedSubjects.forEach(sub => {
            const count = subjectCounts[sub];
            const percent = Math.round((count / totalCompletedTasks) * 100);
            const isCurrent = (sub === material.subject);
            
            const row = document.createElement("div");
            row.className = `balance-row ${isCurrent ? 'current-subject' : ''}`;
            row.innerHTML = `
                <span class="subject-name">${subjectLabels[sub] || sub}</span>
                <div class="balance-bar-container">
                    <div class="balance-bar ${sub}" style="width: ${percent}%"></div>
                </div>
                <span class="subject-percent">${percent}%</span>
            `;
            balanceList.appendChild(row);
        });
    }

    // 履歴リストの描画
    historyContainer.innerHTML = "";
    if (historyData.length === 0) {
        historyContainer.innerHTML = "<p class='no-data'>学習記録がありません</p>";
    } else {
        historyData.sort((a, b) => b.date.localeCompare(a.date));
        historyData.forEach(item => {
            const itemDiv = document.createElement("div");
            itemDiv.className = `plan-item ${material.subject} history-card ${item.checked ? 'checked' : ''}`;

            // infoContainerの要素
            const infoContainer = document.createElement("div");
            infoContainer.className = "plan-info";

            const dateDiv = document.createElement("div");
            dateDiv.className = "history-date";
            dateDiv.textContent = item.date.replace(/-/g, '/');
            if (item.checked) {
                dateDiv.innerHTML += ' <i class="fa-solid fa-check"></i>';
            }

            const rangeDiv = document.createElement("div");
            rangeDiv.className = "history-range";
            rangeDiv.textContent = item.range || '';

            // infoContainerの組み立て
            infoContainer.append(dateDiv, rangeDiv);
            itemDiv.append(infoContainer);

            if (item.time) {
                const timeBadgeDiv = document.createElement("div");
                timeBadgeDiv.className = "history-time-badge";
                timeBadgeDiv.textContent = item.time;
                itemDiv.append(timeBadgeDiv);
            }
            historyContainer.appendChild(itemDiv);
        });
    }
    toggleModal(historyModal, true);
}
// ----- 8-3. モーダルを閉じる関数 -----
function closeAllModals() {
    // 開いているモーダルを取得
    const modals = document.querySelectorAll(".modal");
    const openedModals = [...modals].filter(modal => !modal.classList.contains("hidden"));

    // 例外処理（基本的には閉じるだけ）
    const isInfoOpen = openedModals.includes(infoMaterialModal);
    const isSortOpen = openedModals.includes(sortMaterialModal);

    if ((isInfoOpen || isSortOpen) && isModalEdited) {
        if (!confirm("変更内容は保存されません！キャンセルしてもよろしいですか？")) return;

        if (isSortOpen && sortBackupMaterials.length > 0) {
            materials.splice(0, materials.length, ...sortBackupMaterials);
            rebuildMaterialMap();
        }
    }

    // 全てのモーダルを閉じる
    openedModals.forEach(modal => toggleModal(modal, false));
    isModalEdited = false;
}

// ----- 8-4. モーダルを確定する関数 -----
// -- 教材追加・編集モーダル --
function confirmMaterialModal() {
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
    rebuildMaterialMap();
    saveAndRender();
    updateCategoryOptions();
}
// -- 予定追加・編集モーダル --
function confirmPlanModal() {
    const materialId = parseInt(planMaterialInput.value, 10);
    const range = planContentInput.value.trim();
    const time = planTimeInput.value;
    if (!range) return alert("学習内容を入力してください。");
    
    if (editingPlanIndex !== null) {
        dailyPlans[todayDateKey][editingPlanIndex] = { ...dailyPlans[todayDateKey][editingPlanIndex], materialId, range, time };
        editingPlanIndex = null;
    } else {
        if (!dailyPlans[todayDateKey]) dailyPlans[todayDateKey] = [];
        dailyPlans[todayDateKey].push({ materialId, range, time, checked: false });
    }
    toggleModal(addPlanModal, false);
    saveAndRender();
}
// -- 教材情報表示モーダル --
function confirmInfoModal() {
    let status = materialStatusSelect.value;  // 後で書き換える可能性がある
    
    const date = materialDateInput.value;
    const progress = parseInt(materialProgressInput.value, 10);
    const detail = materialDetailInput.value.trim();
    
    if (isNaN(progress) || progress < 0 || progress > 100) return alert("進度は0～100の整数値で入力してください。");
    
    if (status === "waiting" && progress > 0 && progress < 100) {
        if (confirm("進捗が0%でなくなりました。\nステータスを「学習中」に変更しますか？")) {
            status = "learning";  // 未着手 → 学習中
        }
    } else if (status !== "completed" && progress === 100) {
        if (confirm("進捗が100%になりました。\nステータスを「完了」に変更しますか？")) {
            status = "completed";  // 学習中 → 完了
        }
    } else if (status === "completed" && progress < 100) {
        if (confirm("進捗が100%ではありません。\nステータスを「学習中」に変更しますか？")) {
            status = "learning";  // 完了 → 学習中
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
    rebuildMaterialMap();
    saveAndRender();
}
// -- 並び替えモーダル --
function confirmSortModal() {
    toggleModal(sortMaterialModal, false);
    saveAndRender();
}
// -- まとめて追加モーダル --
function confirmBulkModal() {
    // チェックされた教材のIDを取得
    const checkboxes = bulkMaterialList.querySelectorAll("input[type='checkbox']:checked");
    
    if (checkboxes.length === 0) {
        return alert("教材が選択されていません。");
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
    saveAll();
    renderTodayPlans();
    alert(`${checkboxes.length}件の予定を追加しました。`);
}

// ----- 8-5. モーダル描画関数 -----
// -- アイテムタップで開閉を制御 --
function addTapToggle(itemDiv, type = "material") {
    itemDiv.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;

        // テキストを選択中（ドラッグ中）ならカードを閉じない
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return; 

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
// -- アイコン付きボタンを生成 --
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
// -- 予定一覧描画 --
function renderTodayPlans() {
    todayDateKey = getLocalDate();
    todayDatePanel.textContent = new Date().toLocaleDateString('ja-JP');
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
        const material = materialMap.get(plan.materialId);
        if (!material) return;

        const itemDiv = document.createElement("div");
        itemDiv.className = `plan-item ${material.subject} ${plan.checked ? 'checked' : ''}`;

        const iconDiv = document.createElement("div");
        iconDiv.className = "plan-icon";
        iconDiv.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
        
        // infoContainerの要素
        const infoContainer = document.createElement("div");
        infoContainer.className = "plan-info";

        const nameDiv = document.createElement("div");
        nameDiv.textContent = material.name;

        const rangeDiv = document.createElement("div");
        rangeDiv.innerHTML = '<i class="fa-regular fa-pen-to-square"></i> ';
        rangeDiv.append(plan.range);

        // infoContainerの組み立て
        infoContainer.append(nameDiv, rangeDiv);
        if (plan.time) {
            const timeDiv = document.createElement("div");
            timeDiv.innerHTML = `<i class="fa-regular fa-clock"></i> ${plan.time}`;
            infoContainer.append(timeDiv);
        }
        
        // ボタン類の組み立て
        const btnContainer = document.createElement("div");
        btnContainer.className = "item-buttons";

        const checkBtn = createIconButton("check", '<i class="fa-solid fa-check"></i>', () => {
            plan.checked = !plan.checked;
            saveAll();
            renderTodayPlans();
        });
        const editBtn = createIconButton("edit", '<i class="fa-solid fa-pen"></i>', () => {
            openPlanModal(plan.materialId, todayPlans.indexOf(plan));
        });
        const delBtn = createIconButton("delete", '<i class="fa-solid fa-trash-can"></i>', () => {
            if (confirm("この予定を削除しますか？")) {
                const idx = todayPlans.indexOf(plan);
                todayPlans.splice(idx, 1);
                saveAll();
                renderTodayPlans();
            }
        });
        btnContainer.append(checkBtn, editBtn, delBtn);

        // 親要素（itemDiv）への追加
        itemDiv.append(iconDiv, infoContainer, btnContainer);
        addTapToggle(itemDiv, "plan");
        planItems.appendChild(itemDiv);
    });
}
// -- 教材一覧描画 --
function renderMaterialList() {
    const query = searchMaterialInput.value.toLowerCase();
    const subjectFilter = filterSubjectSelect.value;
    const statusFilter = filterStatusSelect.value;
    const categoryFilter = filterCategorySelect.value;
    const displayMaterials = getSortedMaterials();
    
    materialItems.innerHTML = "";
    const fragment = document.createDocumentFragment();

    displayMaterials.forEach(material => {
        // 検索・フィルタ処理
        const status = material.status || "waiting";
        const category = material.category;

        // 教科フィルタ
        if (subjectFilter !== "all" && material.subject !== subjectFilter) return;
        if (statusFilter !== "all") {
            if (statusFilter === "planning") {
                if (status === "completed") return;    // planning = 未完了（waiting + learning）扱い
            } else {
                if (status !== statusFilter) return;
            }
        }
        if (categoryFilter !== "all") {
            if (categoryFilter === "none") {
                if (category) return;
            } else {
                if (category !== categoryFilter) return;
            }
        }

        // 検索（重めなので後回し）
        const nameMatch = material.name.toLowerCase().includes(query);
        const detailMatch = (material.detail || "").toLowerCase().includes(query);
        if (!nameMatch && !detailMatch) return;

        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${material.subject}`;
        itemDiv.style.setProperty('--material-bg-width', `${material.progress || 0}%`);

        // 教材ステータスバッジの組み立て
        const badgeDiv = document.createElement("div");
        badgeDiv.className = `status-badge ${status}`;
        if (status === "learning") badgeDiv.title = "学習中";
        else if (status === "waiting") badgeDiv.title = "未着手";
        else if (status === "completed") badgeDiv.title = "完了";

        // infoContainerの組み立て
        const infoContainer = document.createElement("div");
        infoContainer.className = "material-info scrollable";

        const nameDiv = document.createElement("div");
        nameDiv.className = "material-name";
        nameDiv.textContent = material.name;

        const dateDiv = document.createElement("div");
        dateDiv.className = "material-date";
        if(material.date) dateDiv.textContent = `期間：${material.date}`;

        const progressDiv = document.createElement("div");
        progressDiv.className = "material-progress";
        if (material.progress !== undefined && material.progress !== null) {
            progressDiv.textContent = `進度：${material.progress}%`;
        }

        const detailDiv = document.createElement("div");
        detailDiv.className = "material-detail";
        if(material.detail) detailDiv.textContent = material.detail;

        // infoContainerの組み立て
        infoContainer.append(nameDiv, progressDiv, dateDiv, detailDiv);

        // ボタン類の組み立て
        const btnContainer = document.createElement("div");
        btnContainer.className = "item-buttons";

        const addPlanBtn = createIconButton("add-plan", '<i class="fa-solid fa-plus"></i>', () => openPlanModal(material.id));
        const editBtn = createIconButton("edit", '<i class="fa-solid fa-pen"></i>', () => openMaterialModal(material.id));
        const infoBtn = createIconButton("info", '<i class="fa-solid fa-info"></i>', () => openInfoModal(material.id));
        const historyBtn = createIconButton("history", '<i class="fa-solid fa-clock-rotate-left"></i>', () => openHistoryModal(material.id));
        const delBtn = createIconButton("delete", '<i class="fa-solid fa-trash-can"></i>', () => {
            if (confirm(`教材「${material.name}」を削除しますか？教材を削除すると、この教材に関連する全ての予定も削除されます。`)) {
                const idx = materials.findIndex(item => item.id === material.id);
                if (idx !== -1) materials.splice(idx, 1);
                Object.keys(dailyPlans).forEach(date => {
                    dailyPlans[date] = dailyPlans[date].filter(p => p.materialId !== material.id);
                });
                rebuildMaterialMap();
                saveAndRender();
                updateCategoryOptions();
            }
        });
        btnContainer.append(addPlanBtn, editBtn, infoBtn, historyBtn, delBtn);

        // 親要素（itemDiv）への追加
        itemDiv.append(badgeDiv, infoContainer, btnContainer);
        addTapToggle(itemDiv, "material");
        fragment.appendChild(itemDiv);
    });

    if (!fragment.hasChildNodes()) {
        const emptyText = document.createElement("p");
        emptyText.textContent = "該当する教材がありません。";
        emptyText.classList.add("no-data");
        fragment.appendChild(emptyText);
    }

    materialItems.appendChild(fragment);
}
// -- 教材並び替えモーダル描画 --
function renderSortMaterialModal() {
    const listContainer = document.getElementById("sort-container");
    const targetCat = document.getElementById("sort-category-select").value;
    const catValue = (targetCat === "none") ? "" : targetCat;
    
    listContainer.innerHTML = "";

    // 選択されたカテゴリーに一致する教材だけを表示
    const catMaterials = materials.filter(m => (m.category || "") === catValue);

    catMaterials.forEach(material => {
        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${material.subject}`;
        itemDiv.style.setProperty('--material-bg-width', '0%');

        const nameDiv = document.createElement("div");
        nameDiv.textContent = material.name;
        nameDiv.style.flex = "1";
        nameDiv.style.fontWeight = "bold";
        itemDiv.appendChild(nameDiv);

        if (material.id === editingSortMaterialId) {
            itemDiv.classList.add("tapped");
            const btnDiv = document.createElement("div");
            btnDiv.className = "item-buttons";

            // 上移動ボタン
            const upBtn = createIconButton("sort-up", '<i class="fa-solid fa-arrow-up"></i>', () => {
                moveInGlobalArray(material, -1);
            });
            // 下移動ボタン
            const downBtn = createIconButton("sort-down", '<i class="fa-solid fa-arrow-down"></i>', () => {
                moveInGlobalArray(material, 1);
            });

            btnDiv.append(upBtn, downBtn);
            itemDiv.appendChild(btnDiv);
        }

        itemDiv.onclick = (e) => {
            if (e.target.closest("button")) return;
            editingSortMaterialId = (editingSortMaterialId === material.id) ? null : material.id;
            renderSortMaterialModal();
        };
        listContainer.appendChild(itemDiv);
    });
}

// ----- 9. UIイベントハンドラ -----
// -- セクション切り替え --
toggleSectionBtn.addEventListener("click", () => toggleSections());

// -- モーダル開閉 --
openMaterialModalBtn.addEventListener("click", () => openMaterialModal());
openSortModalBtn.addEventListener("click", openSortModal);
openBulkAddBtn.addEventListener("click", openBulkAddModal);

cancelMaterialBtn.addEventListener("click", closeAllModals);
cancelPlanBtn.addEventListener("click", closeAllModals);
cancelSortBtn.addEventListener("click", closeAllModals);
cancelInfoBtn.addEventListener("click", closeAllModals);
cancelBulkBtn.addEventListener("click", closeAllModals);
closeHistoryBtn.addEventListener("click", closeAllModals);

confirmMaterialBtn.addEventListener("click", confirmMaterialModal);
confirmPlanBtn.addEventListener("click", confirmPlanModal);
confirmInfoBtn.addEventListener("click", confirmInfoModal);
confirmSortBtn.addEventListener("click", confirmSortModal);
confirmBulkBtn.addEventListener("click", confirmBulkModal);

// -- モーダル内変更検知 --
infoMaterialModal.addEventListener('input', () => {
    isModalEdited = true;
});

// -- 検索・フィルタ --
let searchTimeout;
searchMaterialInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        localStorage.setItem("sp_searchQuery", searchMaterialInput.value);
        renderMaterialList();
    }, 100);
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
materialCategorySelect.addEventListener("change", () => {
    if (materialCategorySelect.value === "new") {
        newCategoryInput.classList.remove("hidden");
        newCategoryInput.focus();
    } else {
        newCategoryInput.classList.add("hidden");
        newCategoryInput.value = "";
    }
});

// -- upload / download --
uploadBtn.addEventListener("click", async () => await upload());
downloadBtn.addEventListener("click", async () => await download());

// -- export / import --
exportJsonBtn.addEventListener("click", async () => await exportDataAsJson());
importJsonBtn.addEventListener("click", () => {
    importFileInput.value = "";
    importFileInput.click();
});
importFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    await importDataAsJson(file);
});

// -- Enter / Ctrl + Enter / Escape --
// -- Enter --
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
// -- Ctrl + Enter --
materialDetailInput.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        confirmInfoBtn.click();
    }
});
// -- Escape --
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
});


// ----- 10. 起動・初期化 -----
// -- 起動時の処理 --
window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('show_update_success') === 'true') {
        alert("アプリの更新が完了しました！");
        sessionStorage.removeItem('show_update_success');  // 二度出ないように消す
    }
    
    restoreUIState();
    loadAll().then(() => {
        const savedCat = localStorage.getItem("sp_filterCategory");
        if (savedCat !== null) filterCategorySelect.value = savedCat;
        rebuildMaterialMap();
        renderMaterialList();
        renderTodayPlans();
        
        // Firebase初期化と所有者チェック
        initFirebase().then(async (res) => {
            if(res && res.db) db = res.db;
            updateSyncButtons(); 

            if (currentUser) {
                const savedUid = await loadLocalData("ownerUid");
                // 「guest」でも「自分」でもない場合のみ警告
                if (savedUid && savedUid !== "guest" && savedUid !== currentUser.uid) {
                    alert("ログイン中のアカウントと端末のデータが異なる可能性があります。");
                }
            }
        });
    });
    updateSyncButtons();
});
// -- Service Worker更新通知と管理 --
function offerUpdate(worker) {
    if (isUpdateProcessed) return;

    // 起動直後の安定を待ってから通知
    setTimeout(() => {
        if (confirm("新しいバージョンがあります。更新（再起動）しますか？")) {
            isUpdateProcessed = true;
            sessionStorage.setItem('sw_update_processed', 'true');
            // リロード後にアラートを出すためのフラグ
            sessionStorage.setItem('show_update_success', 'true');

            worker.postMessage('skipWaiting');
        }
    }, 1000); 
}
// -- Service Worker登録・更新管理 --
if ('serviceWorker' in navigator) {
    let newWorker = null;
    
    // controllerが変更されたらリロード
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isUpdateProcessed) window.location.reload();
    });
    
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
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        offerUpdate(newWorker);
                    }
                });
            });
        })
        .catch(err => {
            console.error('Service Worker registration failed:', err);
        });
}
// -- バージョン情報表示 --
window.showVersion = function() {
    alert(`${APP_NAME}\n\nバージョン：${window.APP_VERSION}\n最終更新日：${LAST_UPDATED}`);
};
// -- ネットワーク・認証状態変化で同期ボタン更新 --
window.addEventListener('online', updateSyncButtons);
window.addEventListener('offline', updateSyncButtons);
window.addEventListener('auth-ready', updateSyncButtons);

window.addEventListener('auth-changed', updateSyncButtons);
