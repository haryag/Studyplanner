import { state } from "./state.js";
import { loadData } from "./storage.js";
import { renderMaterialList, renderTodayPlans } from "./render.js";
import "./eventHandlers.js";

document.getElementById("today-date").textContent = state.todayDate;

loadData();
renderMaterialList();
renderTodayPlans();
