import { currentUser } from './login.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
const db = getFirestore();

// --- Service Worker ---
const SW_VERSION = 'v3.0.1';
const BASE_PATH = '/Studyplanner/';

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

// タップトグルとスクロール
// --- script.js の addTapToggle 関数 ---

function addTapToggle(itemDiv, type = "material", associatedData = null) {
    itemDiv.addEventListener("click", (e) => {
        // ボタン操作時は反応させない
        if (e.target.closest("button")) return;

        // 他の開いているカードを閉じる
        document.querySelectorAll('.material-item.tapped, .plan-item.tapped').forEach(div => {
            if (div !== itemDiv) div.classList.remove('tapped');
        });

        // 自分自身のクラスを切り替え
        itemDiv.classList.toggle("tapped");
        const isOpened = itemDiv.classList.contains("tapped");

        if (isOpened && type === "material") {
            // アニメーション(0.5s)に合わせて、計算を少し遅らせる(0.35s)
            setTimeout(() => {
                // block: 'center' だと画面からはみ出す計算ミスが起きやすいため
                // 'nearest' または 'start' にすると安定します。
                itemDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 10); 
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
        iconDiv.innerHTML = '<i class="fa-solid fa-bookmark"></i>';

        // --- 情報 ---
        const infoDiv = document.createElement("div");
        infoDiv.className = "plan-info";

        const nameDiv = document.createElement("div");
        nameDiv.textContent = material.name;

        const rangeDiv = document.createElement("div");
        rangeDiv.innerHTML = `<i class="fa-regular fa-pen-to-square"></i> ${plan.range}`;

        const timeDiv = document.createElement("div");
        if (plan.time) timeDiv.innerHTML = `<i class="fa-regular fa-clock"></i> ${plan.time}`;

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
            '<i class="fa-solid fa-check"></i>',
            () => {
                plan.checked = !plan.checked;
                saveAndRender();
            }
        );

        const editBtn = createIconButton(
            "edit",
            '<i class="fa-solid fa-pen"></i>',
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
            '<i class="fa-solid fa-trash-can"></i>',
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
        itemDiv.style.setProperty('--material-bg-color', '#d0d0d0');
        itemDiv.style.setProperty('--material-bg-width', `${mat.progress || 0}%`);

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

        if (!mat.ongoing) {
            nameDiv.style.color = "#a0a0a0"; 
        }

        nameDiv.append(nameTitleDiv, nameProgressDiv, nameDateDiv, nameCommentDiv);
        itemDiv.appendChild(nameDiv);

        // --- ボタン群 ---
        const btnDiv = document.createElement("div");
        btnDiv.className = "buttons";

        const addPlanBtn = createIconButton(
            "add-plan",
            '<i class="fa-solid fa-plus"></i>',
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
            '<i class="fa-solid fa-pen"></i>',
            () => {
                materialSubjectSelect.value = mat.subject;
                materialNameInput.value = mat.name;
                editingMaterialId = mat.id;
                toggleModal(addMaterialModal, true);
            }
        );

        const infoBtn = createIconButton(
            "info",
            '<i class="fa-solid fa-info"></i>',
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
            '<i class="fa-solid fa-trash-can"></i>',
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
            '<i class="fa-solid fa-arrow-up"></i>',
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
            '<i class="fa-solid fa-arrow-down"></i>',
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
        dailyPlans[todayKey].push({ materialId, range, time, checked: false });
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
    const detail = materialDetailInput.value.replace(/^\s+|\s+$/g, '');
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

