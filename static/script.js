import { currentUser } from './login.js';
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
const db = getFirestore();

// --- Service Worker ---
const SW_VERSION = 'v1.3.1';    // sw.js と同期させる
const BASE_PATH = '/Studyplanner/';

// --- データ初期化 ---
const todayDate = new Date().toLocaleDateString('ja-JP');
const materials = [];
const dailyPlans = {};
let backupMaterials = [];

// --- DOM要素 ---
const wrapper = document.getElementById("wrapper");
const buttonGroup = document.querySelector(".button-group");
const planListSection = document.getElementById("plan-list-section");
const planListDiv = document.getElementById("plan-list");
const materialListSection = document.getElementById("material-list-section");
const materialListDiv = document.getElementById("material-list");

// 予定追加モーダル
const addPlanModal = document.getElementById("add-plan-modal");
const planMaterial = document.getElementById("plan-material");
const planContent = document.getElementById("plan-content");
const planTime = document.getElementById("plan-time");
const cancelPlan = document.getElementById("cancel-plan");
const confirmPlan = document.getElementById("confirm-plan");

// 教材追加モーダル
const addMaterialModal = document.getElementById("add-material-modal");
const materialName = document.getElementById("material-name");
const materialSubject = document.getElementById("material-subject");
const cancelAdd = document.getElementById("cancel-add");
const confirmAdd = document.getElementById("confirm-add");

// 教材情報モーダル
const infoMaterialModal = document.getElementById("info-material-modal");
const materialNameDiv = document.getElementById("material-name-div");
const materialOngoing = document.getElementById("material-ongoing");
const materialDate = document.getElementById("material-date");
const materialProgress = document.getElementById("material-progress");
const materialDetail = document.getElementById("material-detail");
const cancelInfo = document.getElementById("cancel-info");
const confirmInfo = document.getElementById("confirm-info");

// 教材並び替えモーダル
const sortMaterialModal = document.getElementById("sort-material-modal");
const sortMaterialList = document.getElementById("sort-material-list");
const cancelSort = document.getElementById("cancel-sort");
const confirmSort = document.getElementById("confirm-sort");

let editingMaterialId = null;
let editingIndex = null;

// --- 共通関数 ---
// ロード前に表示する関数
function renderAppShell() {
    // 今日の日付のところにロード表示
    document.getElementById("today-date").textContent = "Loading...";
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

// --- アップロードボタン ---
const uploadBtn = document.getElementById('upload-btn');
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
        const materials = (await getAll("materials")) || [];
        const dailyPlans = (await getAll("dailyPlans")) || {};
        const data = {
            materials,
            dailyPlans,
            updatedAt: new Date().toISOString(),
        };
        // Firestoreに保存
        await setDoc(doc(db, "backups", currentUser.uid), data, { merge: true });
        alert("アップロード完了しました！");
    } catch (err) {
        console.error("アップロード失敗:", err);
        alert("アップロードに失敗しました。");
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> アップロード';
    }
});

// --- ダウンロードボタン ---
const downloadBtn = document.getElementById('download-btn');
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
    const planVisible = !planListSection.classList.contains("hidden");
    planListSection.classList.toggle("hidden", planVisible);
    materialListSection.classList.toggle("hidden", !planVisible);
}

// モーダル開閉
function toggleModal(modal, show = true) {
    modal.classList.toggle("hidden", !show);
    document.body.style.overflow = show ? "hidden" : "";
    wrapper.classList.toggle("full-height", show);
    buttonGroup.style.display = show ? "none" : "flex";
}

// 教材選択肢生成
function populateMaterialSelect(selectedId = null) {
    planMaterial.innerHTML = "";
    materials.forEach(m => {
        const option = document.createElement("option");
        option.value = m.id;
        option.textContent = m.name;
        if (m.id === selectedId) option.selected = true;
        planMaterial.appendChild(option);
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

// タップトグル
function addTapToggle(itemDiv) {
    itemDiv.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        document.querySelectorAll('.material-item.tapped, .plan-item.tapped').forEach(div => {
            if (div !== itemDiv) div.classList.remove('tapped');
        });
        itemDiv.classList.toggle("tapped");
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
    document.getElementById("today-date").textContent = todayDate;
    planListDiv.innerHTML = "";
    const todayPlans = dailyPlans[todayDate] || [];
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
                planContent.value = plan.range;
                planTime.value = plan.time || "";
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
        addTapToggle(item);
        planListDiv.appendChild(item);
    });
}

// --- 教材一覧表示 ---
function renderMaterialList() {
    materialListDiv.innerHTML = "";
    materials.forEach(mat => {
        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${mat.subject}`;
        itemDiv.style.setProperty('--material-bg-color', `var(--bg-color-${mat.subject})`);
        itemDiv.style.setProperty('--material-bg-width', `${mat.progress}%`);

        // カード（ボタン以外）
        const nameDiv = document.createElement("div");
        nameDiv.className = "material-name";

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
            nameTitleDiv.style.fontWeight = "bold";
        } else {
            nameDiv.style.color = "#808080";
            itemDiv.style.setProperty('--material-bg-color', `#f0f0f0`);
        }
        nameDiv.append(nameTitleDiv, nameDateDiv, nameProgressDiv, nameCommentDiv);
        itemDiv.appendChild(nameDiv);

        // ボタン群
        const btnDiv = document.createElement("div");
        btnDiv.className = "buttons";

        const addPlanBtn = createIconButton(
            "add-plan",
            '<i class="fa-solid fa-plus"></i>',
            () => {
                populateMaterialSelect(mat.id);
                planContent.value = "";
                planTime.value = "";
                editingIndex = null;
                toggleModal(addPlanModal, true);
            }
        );

        const editBtn = createIconButton(
            "edit",
            '<i class="fa-solid fa-pen"></i>',
            () => {
                materialSubject.value = mat.subject;
                materialName.value = mat.name;
                editingMaterialId = mat.id;
                toggleModal(addMaterialModal, true);
            }
        );
        
        const infoBtn = createIconButton(
            "info",
            '<i class="fa-solid fa-info"></i>',
            () => {
                materialNameDiv.textContent = mat.name;
                materialOngoing.checked = mat.ongoing || false;
                materialDate.value = mat.date || "";
                materialProgress.value = mat.progress;
                materialDetail.value = mat.detail || "";
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
        addTapToggle(itemDiv);
        materialListDiv.appendChild(itemDiv);
    });
}

// --- 教材並び替えモーダル ---
function renderSortMaterialModal() {
    sortMaterialList.innerHTML = "";
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
                if (prevDiv) sortMaterialList.insertBefore(itemDiv, prevDiv);
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
                if (nextDiv) sortMaterialList.insertBefore(itemDiv, nextDiv.nextElementSibling);
                // else sortMaterialList.appendChild(itemDiv);
                itemDiv.classList.add('tapped');
                updateSortButtons();
            }
        );

        btnDiv.append(upBtn, downBtn);
        itemDiv.appendChild(btnDiv);

        addTapToggle(itemDiv);
        sortMaterialList.appendChild(itemDiv);
    });
    updateSortButtons();
}

function updateSortButtons() {
    const items = Array.from(sortMaterialList.children);
    items.forEach((item, i) => {
        const upBtn = item.querySelector('button:nth-child(1)');
        const downBtn = item.querySelector('button:nth-child(2)');
        upBtn.classList.toggle('invisible', i === 0);
        downBtn.classList.toggle('invisible', i === items.length - 1);
    });
}

// --- 各種イベント ---
document.getElementById("add-material-btn").addEventListener("click", () => {
    materialName.value = "";
    materialSubject.value = "math";
    materialProgress.value = 0;
    editingMaterialId = null;
    toggleModal(addMaterialModal, true);
});

cancelAdd.addEventListener("click", () => {
    editingMaterialId = null;
    toggleModal(addMaterialModal, false);
});
confirmAdd.addEventListener("click", () => {
    const name = materialName.value.trim();
    const subject = materialSubject.value;
    if (!name) return alert("教材名を入力してください");
    if (editingMaterialId !== null) {
        const mat = materials.find(m => m.id === editingMaterialId);
        if (mat) { mat.name = name; mat.subject = subject; }
    } else {
        const newId = materials.length ? Math.max(...materials.map(m => m.id)) + 1 : 1;
        materials.push({ id: newId, name, subject });
    }
    editingMaterialId = null;
    toggleModal(addMaterialModal, false);
    saveAndRender();
});

cancelPlan.addEventListener("click", () => {
    editingIndex = null;
    toggleModal(addPlanModal, false);
});

confirmPlan.addEventListener("click", () => {
    const materialId = parseInt(planMaterial.value);
    const range = planContent.value.trim();
    const time = planTime.value;
    if (!range) return alert("範囲を入力してください");
    if (editingIndex !== null) {
        dailyPlans[todayDate][editingIndex] = { materialId, range, time };
        editingIndex = null;
    } else {
        if (!dailyPlans[todayDate]) dailyPlans[todayDate] = [];
        dailyPlans[todayDate].push({ materialId, range, time });
    }
    toggleModal(addPlanModal, false);
    saveAndRender();
});

// 並び替えモーダル
document.getElementById("sort-btn").addEventListener("click", () => {
    backupMaterials = [...materials];
    renderSortMaterialModal();
    toggleModal(sortMaterialModal, true);
});

cancelSort.addEventListener("click", () => {
    materials.splice(0, materials.length, ...backupMaterials);
    toggleModal(sortMaterialModal, false);
});

confirmSort.addEventListener("click", () => {
    toggleModal(sortMaterialModal, false);
    saveAndRender();
});

// 教材情報モーダル
document.getElementById("view-section").addEventListener("click", toggleSections);
cancelInfo.addEventListener("click", () => {
    editingMaterialId = null;
    toggleModal(infoMaterialModal, false);
});
confirmInfo.addEventListener("click", () => {
    const ongoing = materialOngoing.checked;
    const date = materialDate.value;
    const progress = parseInt(materialProgress.value);
    const detail = materialDetail.value.replace(/^\s+|\s+$/g, '');;
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

// --- Enterキー送信 ---
[addMaterialModal, addPlanModal].forEach(modal => {
    modal.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (modal === addMaterialModal) confirmAdd.click();
            else confirmPlan.click();
        }
    });
});
[materialProgress, materialDate].forEach(input => {
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            confirmInfo.click();
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

// データ読み込み + 初期レンダリング（ややディレイ）
setTimeout(() => {
    loadData().then(() => {
        renderMaterialList();
        renderTodayPlans();
    });
}, 500);

