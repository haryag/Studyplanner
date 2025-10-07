// --- データ初期化 ---
const todayDate = new Date().toLocaleDateString('ja-JP');
document.getElementById("today-date").textContent = todayDate;

const materials = [];
const dailyPlans = {};
let backupMaterials = []; // 並び替え用バックアップ

// --- DOM要素 ---
const wrapper = document.getElementById("wrapper");
const buttonGroup = document.querySelector(".button-group");
const studyList = document.querySelector(".card-list");
const materialListDiv = document.getElementById("material-list");
const addMaterialModal = document.getElementById("add-material-modal");
const materialSubject = document.getElementById("material-subject");
const materialName = document.getElementById("material-name");
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

// --- localStorage ---
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
        } catch(e){ console.error(e); }
    }
    if (savedPlans) {
        try {
            const parsed = JSON.parse(savedPlans);
            if (parsed && typeof parsed === "object") Object.assign(dailyPlans, parsed);
        } catch(e){ console.error(e); }
    }
}

// --- 今日の予定表示 ---
function renderTodayPlans() {
    studyList.innerHTML = "";
    const todayPlans = dailyPlans[todayDate] || [];
    const sortedPlans = [...todayPlans].sort((a,b)=>{
        if(a.checked && !b.checked) return 1;
        if(!a.checked && b.checked) return -1;
        if(!a.time) return 1;
        if(!b.time) return -1;
        return a.time.localeCompare(b.time);
    });

    sortedPlans.forEach(plan => {
        const material = materials.find(m => m.id === plan.materialId);
        if (!material) return;

        const item = document.createElement("div");
        item.className = `study-item ${material.subject}`;
        if(plan.checked) {
            item.style.backgroundColor="#f0f0f0";
            item.style.color="#808080";
        }

        const iconDiv = document.createElement("div");
        iconDiv.className = "study-icon";
        iconDiv.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
        if(plan.checked) iconDiv.querySelector("i").style.color="#808080";

        const infoDiv = document.createElement("div");
        infoDiv.className = "study-info";
        const nameDiv = document.createElement("div");
        nameDiv.textContent = material.name;
        const rangeDiv = document.createElement("div");
        rangeDiv.innerHTML = `<i class="fa-solid fa-pencil"></i> ${plan.range}`;
        if(plan.checked) rangeDiv.querySelector("i").style.color="#808080";

        const timeDiv = document.createElement("div");
        if(plan.time){
            timeDiv.innerHTML = `<i class="fa-regular fa-clock"></i> ${plan.time}`;
            if(plan.checked) timeDiv.querySelector("i").style.color="#808080";
        }

        const checkBtn = document.createElement("button");
        checkBtn.className = "check";
        checkBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        checkBtn.style.color = plan.checked ? "#808080" : "green";
        checkBtn.addEventListener("click", e=>{
            e.stopPropagation();
            plan.checked = !plan.checked;
            saveData();
            renderTodayPlans();
        });

        const editBtn = document.createElement("button");
        editBtn.className = "edit";
        editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
        editBtn.style.color = plan.checked ? "#808080" : "#007bff";
        editBtn.addEventListener("click", e=>{
            e.stopPropagation();
            planMaterial.innerHTML="";
            materials.forEach(m=>{
                const option=document.createElement("option");
                option.value=m.id;
                option.textContent=m.name;
                if(m.id===plan.materialId) option.selected=true;
                planMaterial.appendChild(option);
            });
            planRange.value = plan.range;
            planTime.value = plan.time || "";
            addPlanModal.classList.remove("hidden");
            editingIndex = todayPlans.indexOf(plan);
        });

        const delBtn = document.createElement("button");
        delBtn.className = "delete";
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        delBtn.style.color = plan.checked ? "#808080" : "red";
        delBtn.addEventListener("click", e=>{
            e.stopPropagation();
            if(confirm("この予定を削除しますか？")){
                const idx = todayPlans.indexOf(plan);
                todayPlans.splice(idx,1);
                saveData();
                renderTodayPlans();
            }
        });

        const btnContainer = document.createElement("div");
        btnContainer.className="buttons";
        btnContainer.append(checkBtn, editBtn, delBtn);

        item.append(iconDiv, infoDiv, btnContainer);
        infoDiv.append(nameDiv, rangeDiv);
        if(plan.time) infoDiv.appendChild(timeDiv);

        addTapToggle(item);
        studyList.appendChild(item);
    });
}

// --- 教材一覧表示 ---
function renderMaterialList() {
    materialListDiv.innerHTML = "";
    materials.forEach(mat => {
        const itemDiv = document.createElement("div");
        itemDiv.className = `material-item ${mat.subject}`;

        const nameDiv = document.createElement("div");
        nameDiv.className = "material-name";
        nameDiv.textContent = mat.name;
        itemDiv.appendChild(nameDiv);

        const btnDiv = document.createElement("div");
        btnDiv.className = "buttons";

        const addPlanBtn = document.createElement("button");
        addPlanBtn.className = "add-plan";
        addPlanBtn.innerHTML = '<i class="fa-solid fa-square-plus"></i>';
        addPlanBtn.addEventListener("click", () => {
            planMaterial.innerHTML = "";
            materials.forEach(m => {
                const option = document.createElement("option");
                option.value = m.id;
                option.textContent = m.name;
                if (m.id === mat.id) option.selected = true;
                planMaterial.appendChild(option);
            });
            planRange.value = "";
            planTime.value = "";
            editingIndex = null;
            addPlanModal.classList.remove("hidden");
            document.body.style.overflow = "hidden";
            wrapper.classList.add("full-height");
            buttonGroup.style.display = "none";
        });

        const editBtn = document.createElement("button");
        editBtn.className = "edit";
        editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
        editBtn.addEventListener("click", () => {
            materialSubject.value = mat.subject;
            materialName.value = mat.name;
            editingMaterialId = mat.id;
            addMaterialModal.classList.remove("hidden");
            document.body.style.overflow = "hidden";
            wrapper.classList.add("full-height");
            buttonGroup.style.display = "none";
        });

        const delBtn = document.createElement("button");
        delBtn.className = "delete";
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        delBtn.addEventListener("click", () => {
            if (confirm(`教材「${mat.name}」を削除しますか？`)) {
                const idx = materials.findIndex(m => m.id === mat.id);
                if (idx !== -1) materials.splice(idx, 1);
                Object.keys(dailyPlans).forEach(date => {
                    dailyPlans[date] = dailyPlans[date].filter(p => p.materialId !== mat.id);
                });
                saveData();
                renderMaterialList();
                renderTodayPlans();
            }
        });

        btnDiv.append(addPlanBtn, editBtn, delBtn);
        itemDiv.appendChild(btnDiv);

        addTapToggle(itemDiv);
        materialListDiv.appendChild(itemDiv);
    });
}

// --- 教材並び替えモーダル表示 ---
function renderSortMaterialModal() {
    sortMaterialList.innerHTML = ""; // 既存リストをクリア

    // --- タップで矢印表示 ---
    function addTapToggle(itemDiv) {
        itemDiv.addEventListener("click", (e) => {
            if (e.target.closest("button")) return; // ボタンは無視
            // 他の tapped を解除（1枚だけ矢印表示）
            document.querySelectorAll('#sort-material-list .material-item.tapped')
                .forEach(div => { if(div !== itemDiv) div.classList.remove('tapped'); });
            // 自分は付与
            itemDiv.classList.add('tapped');
        });
    }

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

        addTapToggle(itemDiv); // タップ対応
        sortMaterialList.appendChild(itemDiv);

        // --- 上ボタン ---
        upBtn.addEventListener("click", e => {
            e.stopPropagation();
            itemDiv.classList.remove('tapped'); // 元の位置の矢印を消す
            const idx = materials.indexOf(mat);
            if (idx <= 0) return;

            // 配列の入れ替え
            [materials[idx - 1], materials[idx]] = [materials[idx], materials[idx - 1]];

            // DOM入れ替え
            const prevDiv = itemDiv.previousElementSibling;
            if (prevDiv) sortMaterialList.insertBefore(itemDiv, prevDiv);

            itemDiv.classList.add('tapped'); // 移動後に矢印表示
            updateSortButtons();
        });

        // --- 下ボタン ---
        downBtn.addEventListener("click", e => {
            e.stopPropagation();
            itemDiv.classList.remove('tapped'); // 元の位置の矢印を消す
            const idx = materials.indexOf(mat);
            if (idx >= materials.length - 1) return;

            [materials[idx], materials[idx + 1]] = [materials[idx + 1], materials[idx]];

            const nextDiv = itemDiv.nextElementSibling?.nextElementSibling;
            if (nextDiv) sortMaterialList.insertBefore(itemDiv, nextDiv);
            else sortMaterialList.appendChild(itemDiv);

            itemDiv.classList.add('tapped'); // 移動後に矢印表示
            updateSortButtons();
        });
    });

    // --- 先頭・末尾ボタン制御 ---
    function updateSortButtons() {
        const items = Array.from(sortMaterialList.children);
        items.forEach((item, i) => {
            const upBtn = item.querySelector('button:nth-child(1)');
            const downBtn = item.querySelector('button:nth-child(2)');
            upBtn.classList.toggle('invisible', i === 0);
            downBtn.classList.toggle('invisible', i === items.length - 1);
        });
    }

    updateSortButtons(); // 初期状態更新
}

// 先頭・末尾ボタンの表示を制御
function updateSortButtons() {
    const items = Array.from(sortMaterialList.children);
    items.forEach((item, i) => {
        const upBtn = item.querySelector('button:nth-child(1)');
        const downBtn = item.querySelector('button:nth-child(2)');
        upBtn.classList.toggle('invisible', i === 0);
        downBtn.classList.toggle('invisible', i === items.length - 1);
    });
}

// --- 教材モーダル操作 ---
document.getElementById("add-material").addEventListener("click", ()=>{
    materialName.value="";
    materialSubject.value="math";
    editingMaterialId=null;
    addMaterialModal.classList.remove("hidden");
    document.body.style.overflow = 'hidden';
    wrapper.classList.add("full-height");
    buttonGroup.style.display="none";
});
cancelAdd.addEventListener("click", ()=>{
    addMaterialModal.classList.add("hidden");
    editingMaterialId=null;
    document.body.style.overflow = '';
    wrapper.classList.remove("full-height");
    buttonGroup.style.display="flex";
});
confirmAdd.addEventListener("click", ()=>{
    const name = materialName.value.trim();
    const subject = materialSubject.value;
    if(!name) return alert("教材名を入力してください");
    if(editingMaterialId!==null){
        const mat = materials.find(m=>m.id===editingMaterialId);
        if(mat){ mat.name=name; mat.subject=subject; }
    } else {
        const newId = materials.length? Math.max(...materials.map(m=>m.id))+1 : 1;
        materials.push({id:newId,name,subject});
    }
    saveData();
    addMaterialModal.classList.add("hidden");
    document.body.style.overflow = '';
    wrapper.classList.remove("full-height");
    buttonGroup.style.display="flex";
    renderMaterialList();
    renderTodayPlans();
});

// --- 予定モーダル操作 ---
cancelPlan.addEventListener("click", ()=>{
    addPlanModal.classList.add("hidden");
    editingIndex=null;
    document.body.style.overflow = '';
    wrapper.classList.remove("full-height");
    buttonGroup.style.display="flex";
});
confirmPlan.addEventListener("click", ()=>{
    const materialId = parseInt(planMaterial.value);
    const range = planRange.value.trim();
    const time = planTime.value;
    if(!range) return alert("範囲を入力してください");
    if(editingIndex!==null){
        dailyPlans[todayDate][editingIndex] = {materialId,range,time};
        editingIndex=null;
    } else {
        if(!dailyPlans[todayDate]) dailyPlans[todayDate] = [];
        dailyPlans[todayDate].push({materialId,range,time});
    }
    saveData();
    addPlanModal.classList.add("hidden");
    document.body.style.overflow = '';
    wrapper.classList.remove("full-height");
    buttonGroup.style.display="flex";
    renderTodayPlans();
});

// --- 並び替えモーダル操作 ---
document.getElementById("sort-btn").addEventListener("click",()=>{
    backupMaterials = [...materials];
    renderSortMaterialModal();
    sortMaterialModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    wrapper.classList.add("full-height");
    buttonGroup.style.display="none";
});
cancelSortBtn.addEventListener("click",()=>{
    materials.splice(0,materials.length,...backupMaterials);
    sortMaterialModal.classList.add("hidden");
    document.body.style.overflow = "";
    wrapper.classList.remove("full-height");
    buttonGroup.style.display="flex";
});
confirmSortBtn.addEventListener("click",()=>{
    sortMaterialModal.classList.add("hidden");
    document.body.style.overflow = "";
    wrapper.classList.remove("full-height");
    buttonGroup.style.display="flex";
    saveData();
    renderMaterialList();
});

// --- Enterキーでモーダル送信 ---
[addMaterialModal, addPlanModal].forEach(modal=>{
    modal.addEventListener("keydown", e=>{
        if(e.key==="Enter"){
            e.preventDefault();
            if(modal===addMaterialModal) confirmAdd.click();
            else confirmPlan.click();
        }
    });
});

// --- 初期読み込み ---
loadData();
renderMaterialList();
renderTodayPlans();

