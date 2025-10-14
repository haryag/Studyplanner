// --- データ初期化 ---
const todayDate = new Date().toLocaleDateString('ja-JP');
document.getElementById("today-date").textContent = todayDate;

const materials = [];
const dailyPlans = {};
let backupMaterials = [];

// --- DOM要素 ---
const wrapper = document.getElementById("wrapper");
const buttonGroup = document.querySelector(".button-group");
const planList = document.querySelector(".plan-list-section");
const materialListDiv = document.getElementById("material-list");
const addMaterialModal = document.getElementById("add-material-modal");
const materialSubject = document.getElementById("material-subject");
const materialName = document.getElementById("material-name");
const materialProgress = document.getElementById("material-progress");
const materialTimeStart = document.getElementById("material-time-start");
const materialTimeEnd = document.getElementById("material-time-end");
const cancelAdd = document.getElementById("cancel-add");
const confirmAdd = document.getElementById("confirm-add");
const addPlanModal = document.getElementById("add-plan-modal");
const planMaterial = document.getElementById("plan-material");
const planRange = document.getElementById("plan-range");
const planTime = document.getElementById("plan-time");
const cancelPlan = document.getElementById("cancel-plan");
const confirmPlan = document.getElementById("confirm-plan");

// 並び替えモーダル
const sortMaterialModal = document.getElementById("sort-material-modal");
const sortMaterialList = document.getElementById("sort-material-list");
const cancelSortBtn = document.getElementById("cancel-sort");
const confirmSortBtn = document.getElementById("confirm-sort");

let editingMaterialId = null;
let editingIndex = null;

// --- 共通関数 ---
// localStorage
function saveData() {
    localStorage.setItem("materials", JSON.stringify(materials));
    localStorage.setItem("dailyPlans", JSON.stringify(dailyPlans));
}
function loadData() {
    const savedMaterials = localStorage.getItem("materials");
    const savedPlans = localStorage.getItem("dailyPlans");
    if (savedMaterials) {
        try {
            const parsed = JSON.parse(savedMaterials);
            if (Array.isArray(parsed)) materials.splice(0, materials.length, ...parsed);
        } catch (e) { console.error(e); }
    }
    if (savedPlans) {
        try {
            const parsed = JSON.parse(savedPlans);
            if (parsed && typeof parsed === "object") Object.assign(dailyPlans, parsed);
        } catch (e) { console.error(e); }
    }
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
    planList.innerHTML = "";
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
                saveData();
                renderTodayPlans();
            }
        );

        const editBtn = createIconButton(
            "edit",
            '<i class="fa-solid fa-pen"></i>',
            () => {
                populateMaterialSelect(plan.materialId);
                planRange.value = plan.range;
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
                    saveData();
                    renderTodayPlans();
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
        planList.appendChild(item);
    });
}

// --- 教材一覧表示 ---
function renderMaterialList() {
    const today = new Date();
    materialListDiv.innerHTML = "";
    materials.forEach(mat => {
        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${mat.subject}`;
        itemDiv.style.setProperty('--material-bg-color', `var(--bg-color-${mat.subject})`);
        itemDiv.style.setProperty('--material-bg-width', `${mat.progress}%`);
        
        const nameDiv = document.createElement("div");
        nameDiv.className = "material-name";
        nameDiv.textContent = mat.name;
        if (today < startDate || today > endDate) {
            nameDiv.style.color = "#808080";
        }
        itemDiv.appendChild(nameDiv);

        const btnDiv = document.createElement("div");
        btnDiv.className = "buttons";

        const addPlanBtn = createIconButton(
            "add-plan",
            '<i class="fa-solid fa-plus"></i>',
            () => {
                populateMaterialSelect(mat.id);
                planRange.value = "";
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
                materialProgress.value = mat.progress;
                materialTimeStart.value = mat.startDate;
                materialTimeEnd.value = mat.endDate;
                editingMaterialId = mat.id;
                toggleModal(addMaterialModal, true);
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

        btnDiv.append(addPlanBtn, editBtn, delBtn);
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

        const upBtn = document.createElement("button");
        upBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        const downBtn = document.createElement("button");
        downBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
        btnDiv.append(upBtn, downBtn);
        itemDiv.appendChild(btnDiv);

        addTapToggle(itemDiv);
        sortMaterialList.appendChild(itemDiv);

        upBtn.addEventListener("click", e => {
            e.stopPropagation();
            const idx = materials.indexOf(mat);
            if (idx <= 0) return;
            [materials[idx - 1], materials[idx]] = [materials[idx], materials[idx - 1]];
            const prevDiv = itemDiv.previousElementSibling;
            if (prevDiv) sortMaterialList.insertBefore(itemDiv, prevDiv);
            itemDiv.classList.add('tapped');
            updateSortButtons();
        });

        downBtn.addEventListener("click", e => {
            e.stopPropagation();
            const idx = materials.indexOf(mat);
            if (idx >= materials.length - 1) return;
            [materials[idx], materials[idx + 1]] = [materials[idx + 1], materials[idx]];
            const nextDiv = itemDiv.nextElementSibling?.nextElementSibling;
            if (nextDiv) sortMaterialList.insertBefore(itemDiv, nextDiv);
            else sortMaterialList.appendChild(itemDiv);
            itemDiv.classList.add('tapped');
            updateSortButtons();
        });
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
document.getElementById("add-material").addEventListener("click", () => {
    materialName.value = "";
    materialSubject.value = "math";
    materialProgress.value = 0;
    materialTimeStart.value = "";
    materialTimeEnd.value = "";
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
    const progress = parseInt(materialProgress.value);
    const startDate = new Date(materialTimeStart.value);
    const endDate = new Date(materialTimeEnd.value);
    if (!name) return alert("教材名を入力してください");
    if (isNaN(progress) || progress < 0 || progress > 100) return alert("進度は0～100の値で入力してください");
    if (isNaN(startDate) || isNaN(endDate) || startDate >= endDate ) return alert("正しい日付を入力してください");
    if (editingMaterialId !== null) {
        const mat = materials.find(m => m.id === editingMaterialId);
        if (mat) { mat.name = name; mat.subject = subject; mat.progress = progress; mat.startDate = startDate; mat.endDate = endDate; }
    } else {
        const newId = materials.length ? Math.max(...materials.map(m => m.id)) + 1 : 1;
        materials.push({ id: newId, name, subject , progress , startDate , endDate });
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
    const range = planRange.value.trim();
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

cancelSortBtn.addEventListener("click", () => {
    materials.splice(0, materials.length, ...backupMaterials);
    toggleModal(sortMaterialModal, false);
});

confirmSortBtn.addEventListener("click", () => {
    toggleModal(sortMaterialModal, false);
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

// --- 初期読み込み ---
loadData();
renderMaterialList();
renderTodayPlans();


