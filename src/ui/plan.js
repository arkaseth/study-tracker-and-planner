import { $, escapeHTML, toast, appConfirm } from "../utils/helpers.js";
import { store, currentExam, save } from "../core/state.js";
import { iso, addDays, formatDate } from "../utils/dates.js";
import { weekdayNames } from "../utils/constants.js";
import { availabilityHours, getOverdueTasks, minutesAvailableOn } from "../core/planner.js";
import { uid } from "../utils/helpers.js";

/**
 * Generates and updates the availability editor UI in the plan view, allowing users
 * to adjust their daily study hours. Also updates the total weekly hours display.
 */
export function renderAvailabilityEditor(exam) {
  const editor = $("#availability-editor");
  if (!editor) return;
  editor.innerHTML = weekdayNames
    .map((name, day) => {
      const d = exam.availability?.[day] || { hours: 2, active: false };
      return `<label class="availability-row"><input data-availability-day="${day}" type="checkbox" ${d.active ? "checked" : ""}><span>${name}</span><input data-availability-hours="${day}" type="number" min="0.5" max="8" step="0.5" value="${d.hours || 2}" ${d.active ? "" : "disabled"} aria-label="Hours available on ${name}"></label>`;
    })
    .join("");
    
  const days = Object.values(exam.availability || {}).filter((d) => d?.active).length;
  const total = availabilityHours(exam);
  const availTotal = $("#availability-total");
  if (availTotal) {
    availTotal.textContent = `${total}h per week · ${days ? `${Math.round((total / days) * 10) / 10}h average per selected study day` : "select at least one study day"}`;
  }
}

/**
 * Renders the main Planning view.
 */
export function renderPlan() {
  const exam = currentExam();
  if (!exam) return;
  
  if ($("#exam-date")) $("#exam-date").value = exam.examDate;
  if ($("#plan-capacity")) $("#plan-capacity").textContent = `${availabilityHours(exam)}h available / week`;
  
  renderAvailabilityEditor(exam);
  
  const topicList = $("#topic-list");
  if (topicList) {
    topicList.innerHTML = exam.topics
      .map(
        (t) =>
          `<div class="topic-row" style="grid-template-columns: 1fr 90px auto 34px;"><div><b>${escapeHTML(t.name)}</b><span>confidence: ${["needs work", "building", "comfortable", "strong"][t.confidence - 1] || "needs work"}</span></div><input data-topic-confidence="${t.id}" type="range" min="1" max="4" value="${t.confidence}" aria-label="Confidence for ${escapeHTML(t.name)}"><button class="secondary-button" data-view-concepts="${t.id}" style="padding:4px 10px;min-height:30px;font-size:11px;">${(t.concepts || []).length} concepts</button><button class="icon-delete" data-delete-topic="${t.id}" title="Delete topic">×</button></div>`,
      )
      .join("") || '<p class="muted">Add the topics you want to study.</p>';
  }
  
  const today = iso();
  const overdue = getOverdueTasks(exam);
  const overdueDates = [...new Set(overdue.map((t) => t.date))].sort();
  const horizon = Array.from({ length: 14 }, (_, i) => iso(addDays(new Date(), i)));
  const allDates = [...new Set([...overdueDates, ...horizon])].sort();
  
  const scheduleList = $("#schedule-list");
  if (scheduleList) {
    scheduleList.innerHTML = allDates
      .map((d) => {
        const ts = exam.tasks.filter((t) => t.date === d);
        const isPast = d < today;
        return `<div class="schedule-day${isPast && ts.some((t) => !t.done) ? " schedule-day-overdue" : ""}" data-drop-date="${d}"><div class="schedule-date">${formatDate(d)}${isPast ? ' <span class="overdue-pill">overdue</span>' : ""}</div><div class="session-list">${ts.map((t) => `<span class="session${isPast && !t.done ? " session-overdue" : ""}" draggable="true" data-drag-task="${t.id}"><span class="tag">${escapeHTML(t.type)}</span>${escapeHTML(t.topic)} · ${t.duration}m ${isPast && !t.done ? `<button data-reschedule-task="${t.id}" title="Reschedule">↻</button><button data-done-task="${t.id}" title="Mark done">✓</button><button data-skip-task="${t.id}" title="Skip">×</button>` : `<button data-edit-task="${t.id}" title="Edit session">✎</button><button data-delete-task="${t.id}" title="Remove session">×</button>`}</span>`).join("")}${!ts.length ? '<span class="muted mono">Rest / catch-up</span>' : ""}<button class="add-session" data-add-session-date="${d}">+ Add session</button></div></div>`;
      })
      .join("");
  }
}

/**
 * Reads user inputs from the plan settings interface, updates the active exam's
 * availability and target date, and recalculates total weekly hours. Saves state.
 */
export function savePlanSettings(showToast = false) {
  const exam = currentExam();
  if (!exam) return false;
  const availability = {};
  document.querySelectorAll("[data-availability-day]").forEach((toggle) => {
    const day = toggle.dataset.availabilityDay,
      hours = document.querySelector(`[data-availability-hours="${day}"]`);
    availability[day] = {
      hours: Number(hours.value) || 2,
      active: toggle.checked,
    };
  });
  
  const weeklyHours = Object.values(availability).reduce(
    (total, d) => total + (d.active ? Number(d.hours) : 0),
    0,
  );
  
  if (
    !$("#exam-date").value ||
    weeklyHours <= 0 ||
    Object.values(availability).some(
      (d) => d.active && (d.hours < 0.5 || d.hours > 8),
    )
  )
    return false;
    
  exam.examDate = $("#exam-date").value;
  exam.availability = availability;
  exam.weeklyHours = weeklyHours;
  
  const selectedDays = Object.values(availability).filter((d) => d.active).length,
    average = Math.round((weeklyHours / selectedDays) * 10) / 10;
    
  save();
  if ($("#plan-capacity")) $("#plan-capacity").textContent = `${weeklyHours}h available / week`;
  if ($("#availability-total")) $("#availability-total").textContent = `${weeklyHours}h per week · ${average}h average per selected study day`;
  if ($("#settings-status")) $("#settings-status").textContent = "Saved automatically.";
  if (showToast) toast("Plan settings saved.");
  return true;
}

/**
 * Applies a bulk availability preset to the active exam and updates the UI accordingly.
 */
export function applyBulkAvailability() {
  const hoursInput = $("#bulk-availability-hours");
  if (!hoursInput) return;
  const hours = Number(hoursInput.value);
  if (hours < 0.5 || hours > 8) {
    toast("Choose between 0.5 and 8 hours.");
    return;
  }
  const selected = [...document.querySelectorAll("[data-availability-day]:checked")];
  if (!selected.length) {
    toast("Select at least one study day first.");
    return;
  }
  selected.forEach((toggle) => {
    const input = document.querySelector(`[data-availability-hours="${toggle.dataset.availabilityDay}"]`);
    if (input) input.value = hours;
  });
  savePlanSettings();
  toast(`Applied ${hours}h to ${selected.length} selected day${selected.length === 1 ? "" : "s"}.`);
}

/**
 * Asynchronously generates a dynamic study schedule.
 */
export async function generateSchedule(renderAllCallback) {
  if (!savePlanSettings()) {
    toast("Choose at least one study day and its available hours first.");
    return;
  }
  const exam = currentExam();
  if (!exam) return;
  const today = iso(),
    end = iso(addDays(new Date(), 13));
  const existing = exam.tasks.filter((t) => t.date >= today && t.date <= end);
  
  if (existing.length > 0) {
    const ok = await appConfirm(
      "Regenerate schedule?",
      `This will replace ${existing.length} scheduled session${existing.length === 1 ? "" : "s"} in the next 14 days.`,
    );
    if (!ok) return;
  }
  
  exam.tasks = exam.tasks.filter((task) => task.date < today || task.date > end);
  const topics = [...exam.topics];
  if (!topics.length) {
    toast("Add at least one topic before generating a schedule.");
    return;
  }
  
  const pool = [];
  topics.forEach((t) => {
    const weight = Math.max(1, 5 - t.confidence);
    for (let i = 0; i < weight; i++) pool.push(t);
  });
  
  const typeOrder = ["Learn", "Practice", "Active recall"];
  const topicTypeCursor = {};
  topics.forEach((t) => {
    topicTypeCursor[t.id] = 0;
  });
  
  let lastDayTopics = new Set();
  for (let dayIndex = 0; dayIndex < 14; dayIndex++) {
    const date = iso(addDays(new Date(), dayIndex));
    if (date > end) break;
    const dayMinutes = minutesAvailableOn(exam, date);
    if (dayMinutes < 30) continue;
    
    const topicCount = dayMinutes <= 120 ? 1 : dayMinutes <= 240 ? 2 : dayMinutes <= 360 ? 3 : 4;
    const baseDuration = Math.floor(dayMinutes / topicCount / 5) * 5,
      remainder = dayMinutes - baseDuration * topicCount;
      
    const dayTopics = [];
    const available = pool.filter((t) => !lastDayTopics.has(t.id));
    const source = available.length >= topicCount ? available : pool;
    const used = new Set();
    
    for (let s = 0; s < topicCount; s++) {
      let candidates = source.filter((t) => !used.has(t.id));
      if (!candidates.length) candidates = pool.filter((t) => !used.has(t.id));
      if (!candidates.length) candidates = pool;
      
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      used.add(pick.id);
      
      const duration = baseDuration + (s === topicCount - 1 ? remainder : 0);
      const type = typeOrder[topicTypeCursor[pick.id] % 3];
      topicTypeCursor[pick.id]++;
      
      exam.tasks.push({
        id: uid(),
        date,
        topic: pick.name,
        type,
        duration,
        done: false,
      });
      dayTopics.push(pick.id);
    }
    lastDayTopics = new Set(dayTopics);
  }
  save();
  if (renderAllCallback) renderAllCallback();
  toast("A flexible 14-day schedule is ready to edit.");
}
