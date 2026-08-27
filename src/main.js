import { $, escapeHTML, toast, appConfirm, uid } from "./utils/helpers.js";
import { setupAuthListeners, supabaseClient } from "./core/auth.js";
import { initializeState, store, save, currentExam } from "./core/state.js";
import { renderHeader, renderDashboard, startTimer, resetTimer, updateTimerSettings } from "./ui/dashboard.js";
import { renderPlan, applyBulkAvailability, generateSchedule, savePlanSettings } from "./ui/plan.js";
import { renderReview } from "./ui/review.js";
import { renderMistakes } from "./ui/mistakes.js";
import { renderInsights } from "./ui/insights.js";
import { setTheme, toggleTheme } from "./ui/theme.js";
import { openModal, openConceptsModal, handleModal, openOCRModal } from "./ui/modals.js";
import { calcIntervals } from "./core/review.js";
import { iso, addDays, formatDate } from "./utils/dates.js";
import { askAI } from "./api/ai.js";
import { STORAGE_KEY, isLocal } from "./utils/constants.js";
import { getDueCards } from "./core/planner.js";

/**
 * Utility function to sequentially re-render all major views in the application.
 */
export function renderAll() {
  setTheme();
  renderHeader();
  renderDashboard();
  renderPlan();
  renderReview();
  renderMistakes();
  renderInsights();
}

// Initialize Application
initializeState();
setupAuthListeners(renderAll);
renderAll();

// Routing
function navigate() {
  const view = location.hash.slice(1) || "dashboard";
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active-view", v.id === view));
  document.querySelectorAll(".nav-item[data-view]").forEach((v) => v.classList.toggle("active", v.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.addEventListener("hashchange", navigate);
navigate();

// --- Event Listeners from original app.js --- //

// Auth & Settings Modals
$("#auth-skip-btn")?.addEventListener("click", () => {
  if ($("#auth-dialog")?.open) $("#auth-dialog").close();
  if (!store.state.tutorialCompleted) openTutorial();
});
$("#login-nav-button")?.addEventListener("click", () => {
  if (!$("#auth-dialog")?.open) $("#auth-dialog")?.showModal();
});
$("#settings-nav-button")?.addEventListener("click", () => {
  if (!$("#settings-ai-provider")) return;
  $("#settings-ai-provider").value = store.state.ai.provider;
  $("#settings-key-gemini").value = store.state.ai.keys.gemini || "";
  $("#settings-key-openai").value = store.state.ai.keys.openai || "";
  $("#settings-key-claude").value = store.state.ai.keys.claude || "";
  if (!isLocal) {
    $("#settings-ai-provider").disabled = true;
    $("#settings-key-gemini").disabled = true;
    $("#settings-key-openai").disabled = true;
    $("#settings-key-claude").disabled = true;
    $("#ai-local-warning")?.classList.remove("hidden");
  } else {
    $("#ai-local-warning")?.classList.add("hidden");
  }
  $("#settings-ai-provider").dispatchEvent(new Event("change"));
  $("#settings-dialog").showModal();
});
$("#settings-ai-provider")?.addEventListener("change", (e) => {
  ["gemini", "openai", "claude"].forEach((p) => {
    const el = document.querySelector(`[data-provider="${p}"]`);
    if (el) el.classList.toggle("hidden", e.target.value !== p);
  });
});
$("#settings-cancel")?.addEventListener("click", () => $("#settings-dialog")?.close());
$("#settings-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  store.state.ai.provider = $("#settings-ai-provider").value;
  store.state.ai.keys.gemini = $("#settings-key-gemini").value.trim();
  store.state.ai.keys.openai = $("#settings-key-openai").value.trim();
  store.state.ai.keys.claude = $("#settings-key-claude").value.trim();
  save();
  $("#settings-dialog")?.close();
  toast("Settings saved.");
});
$("#auth-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#auth-email").value,
    password = $("#auth-password").value,
    err = $("#auth-error");
  err.classList.add("hidden");
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    err.textContent = error.message;
    err.classList.remove("hidden");
  }
});
$("#auth-google-btn")?.addEventListener("click", () => {
  supabaseClient.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
});
$("#auth-signup-btn")?.addEventListener("click", async () => {
  const email = $("#auth-email").value,
    password = $("#auth-password").value,
    err = $("#auth-error");
  if (!email || password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    err.textContent = "Enter email and 8+ char alphanumeric password.";
    err.classList.remove("hidden");
    return;
  }
  err.classList.add("hidden");
  const { error, data } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    err.textContent = error.message;
    err.classList.remove("hidden");
  } else if (data?.user && data.user.identities && data.user.identities.length === 0) {
    err.textContent = "User already exists.";
    err.classList.remove("hidden");
  } else {
    err.textContent = "Signup successful! Please check your email and click the confirmation link, then come back here to log in.";
    err.style.color = "var(--ink)";
    err.classList.remove("hidden");
  }
});
$("#logout-button")?.addEventListener("click", () => supabaseClient.auth.signOut());

// Global Click Delegation
document.addEventListener("click", (event) => {
  const target = event.target.closest("button,a");
  if (!target) return;
  if (target.dataset.go) location.hash = target.dataset.go;
  if (target.id === "modal-close" || target.id === "modal-cancel") {
    $("#modal")?.close();
    return;
  }
  if (target.id === "settings-close") {
    $("#settings-dialog")?.close();
    return;
  }
  if (target.id === "auth-close") {
    $("#auth-dialog")?.close();
    return;
  }
  if (target.closest(".avatar")) {
    const mobileSelect = $("#mobile-exam-select");
    if (mobileSelect) {
      mobileSelect.innerHTML = store.state.exams
        .map((e) => `<option value="${e.id}" ${e.id === store.state.activeExamId ? "selected" : ""}>${escapeHTML(e.name)}</option>`)
        .join("");
    }
    $("#mobile-menu-dialog")?.showModal();
    return;
  }
  if (target.id === "mobile-menu-close") {
    $("#mobile-menu-dialog")?.close();
    return;
  }
  if (target.closest("#mobile-theme-button")) {
    $("#theme-button")?.click();
    return;
  }
  if (target.closest("#mobile-settings-button")) {
    $("#mobile-menu-dialog")?.close();
    $("#settings-nav-button")?.click();
    return;
  }
  if (target.closest("#mobile-login-button")) {
    $("#mobile-menu-dialog")?.close();
    $("#login-nav-button")?.click();
    return;
  }
  if (target.closest("#mobile-logout-button")) {
    $("#mobile-menu-dialog")?.close();
    $("#logout-button")?.click();
    return;
  }
  if (target.id === "mobile-new-exam-button") {
    $("#mobile-menu-dialog")?.close();
    $("#new-exam-button")?.click();
    return;
  }
  if (target.id === "settings-export-json") {
    const backup = JSON.parse(JSON.stringify(store.state));
    backup.ai.keys = { gemini: "", openai: "", claude: "" }; 
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estudio-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (target.id === "settings-import-btn") {
    $("#settings-import-file")?.click();
    return;
  }
  if (target.id === "settings-export-ics") {
    const exam = currentExam();
    const futureTasks = exam.tasks.filter((t) => t.date >= iso());
    if (futureTasks.length === 0 && !exam.examDate) {
      toast("Nothing to export.");
      return;
    }
    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Estudio//Study Planner//EN\r\n";
    if (exam.examDate) {
      const exStart = exam.examDate.replace(/-/g, "");
      const exEnd = iso(addDays(exam.examDate, 1)).replace(/-/g, "");
      icsContent += "BEGIN:VEVENT\r\n";
      icsContent += `DTSTART;VALUE=DATE:${exStart}\r\n`;
      icsContent += `DTEND;VALUE=DATE:${exEnd}\r\n`;
      icsContent += `SUMMARY:🎯 ${exam.name} - EXAM DAY\r\n`;
      icsContent += `DESCRIPTION:Good luck on your exam!\r\n`;
      icsContent += "END:VEVENT\r\n";
    }
    futureTasks.forEach((task) => {
      const dtStart = task.date.replace(/-/g, "");
      const dtEnd = iso(addDays(task.date, 1)).replace(/-/g, "");
      icsContent += "BEGIN:VEVENT\r\n";
      icsContent += `DTSTART;VALUE=DATE:${dtStart}\r\n`;
      icsContent += `DTEND;VALUE=DATE:${dtEnd}\r\n`;
      icsContent += `SUMMARY:[Study] ${task.topic} (${task.type})\r\n`;
      icsContent += `DESCRIPTION:Duration: ${task.duration} mins\r\n`;
      icsContent += "END:VEVENT\r\n";
    });
    icsContent += "END:VCALENDAR";
    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estudio-schedule.ics";
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (target.id === "settings-delete-keys") {
    appConfirm("Delete API Keys?", "This will remove your stored API keys from this browser.").then((ok) => {
      if (!ok) return;
      store.state.ai.keys = { gemini: "", openai: "", claude: "" };
      if ($("#settings-key-gemini")) $("#settings-key-gemini").value = "";
      if ($("#settings-key-openai")) $("#settings-key-openai").value = "";
      if ($("#settings-key-claude")) $("#settings-key-claude").value = "";
      save();
      toast("API keys deleted.");
    });
  }
  if (target.id === "settings-delete-data") {
    appConfirm(
      "Delete all data?",
      "This will permanently delete all your local study data, API keys, and reset the app. If you are logged in, it will also wipe your cloud backup. This cannot be undone.",
    ).then(async (ok) => {
      if (!ok) return;
      $("#settings-dialog")?.close();
      if (store.currentUser) {
        await supabaseClient.from("study_data").delete().eq("id", store.currentUser.id);
        await supabaseClient.auth.signOut();
      }
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }
  if (target.id === "timer-start") {
    startTimer(renderAll);
    return;
  }
  if (target.id === "timer-reset") {
    resetTimer();
    return;
  }
  if (target.id === "new-exam-button") openModal("exam");
  if (target.id === "add-topic-button") openModal("topic");
  if (target.id === "add-task-button") openModal("task");
  if (target.id === "ocr-button" || target.closest(".ocr-trigger")) openOCRModal();
  if (target.id === "ocr-close" || target.id === "ocr-cancel") $("#ocr-dialog")?.close();
  if (target.id === "ocr-save-mistake") {
    $("#ocr-dialog")?.close();
    openModal("mistake");
    setTimeout(() => {
      const q = document.querySelector('textarea[name="question"]');
      const res = $("#ocr-text-result");
      if (q && res) q.value = res.value;
    }, 100);
  }
  if (target.id === "ocr-save-flashcard") {
    $("#ocr-dialog")?.close();
    openModal("card");
    setTimeout(() => {
      const f = document.querySelector('input[name="front"]');
      const res = $("#ocr-text-result");
      if (f && res) f.value = res.value;
    }, 100);
  }
  if (target.dataset.addSessionDate) openModal("task", target.dataset.addSessionDate);
  if (target.dataset.editTask) {
    const task = currentExam().tasks.find((item) => item.id === target.dataset.editTask);
    if (task) openModal("task", task.date, task);
  }
  if (target.id === "new-card-button" || target.id === "empty-new-card") openModal("card");
  if (target.id === "new-mistake-button") openModal("mistake");
  if (target.id === "apply-bulk-availability") applyBulkAvailability();
  if (target.id === "generate-plan-button") generateSchedule(renderAll);
  if (target.id === "start-review-button") location.hash = "review";
  if (target.id === "theme-button") toggleTheme();
  
  if (target.id === "flip-card" || target.closest("#flip-card")) {
    $("#card-back")?.classList.toggle("hidden");
    $("#review-actions")?.classList.toggle("hidden");
    const label = $("#flashcard .card-label");
    if (label && $("#card-back")) {
      label.textContent = $("#card-back").classList.contains("hidden") ? "PROMPT · click to reveal" : "ANSWER · rate your recall";
    }
  }
  if (target.dataset.rating) {
    const card = getDueCards(currentExam())[0],
      r = target.dataset.rating,
      gaps = calcIntervals(card);
    card.interval = gaps[r];
    card.due = iso(addDays(new Date(), card.interval));
    card.reviews++;
    if (r === "again") {
      card.repetition = 0;
      card.ease = Math.max(1.3, card.ease - 0.2);
    } else if (r === "hard") {
      card.repetition = Math.max(1, card.repetition);
      card.ease = Math.max(1.3, card.ease - 0.15);
    } else if (r === "good") {
      card.repetition++;
    } else if (r === "easy") {
      card.repetition++;
      card.ease += 0.15;
    }
    save();
    renderAll();
    toast(r === "again" ? "No problem - this card will return today." : "Review scheduled.");
  }
  if (target.dataset.deleteTopic) {
    const exam = currentExam();
    exam.topics = exam.topics.filter((topic) => topic.id !== target.dataset.deleteTopic);
    save();
    renderAll();
  }
  if (target.dataset.deleteTask) {
    const exam = currentExam();
    exam.tasks = exam.tasks.filter((task) => task.id !== target.dataset.deleteTask);
    save();
    renderAll();
  }
  if (target.dataset.rescheduleTask) {
    const exam = currentExam(),
      task = exam.tasks.find((t) => t.id === target.dataset.rescheduleTask);
    if (task) {
      task.date = iso(addDays(new Date(), 1));
      save();
      renderAll();
      toast("Session rescheduled to tomorrow.");
    }
  }
  if (target.dataset.doneTask) {
    const exam = currentExam(),
      task = exam.tasks.find((t) => t.id === target.dataset.doneTask);
    if (task) {
      task.done = true;
      save();
      renderAll();
      toast("Session marked complete - nice work.");
    }
  }
  if (target.dataset.skipTask) {
    const exam = currentExam();
    exam.tasks = exam.tasks.filter((t) => t.id !== target.dataset.skipTask);
    save();
    renderAll();
    toast("Session skipped.");
  }
  if (target.dataset.deleteMistake) {
    const exam = currentExam(),
      mistake = exam.mistakes.find((item) => item.id === target.dataset.deleteMistake);
    exam.mistakes = exam.mistakes.filter((item) => item.id !== target.dataset.deleteMistake);
    exam.cards = exam.cards.filter(
      (card) =>
        card.mistakeId !== target.dataset.deleteMistake &&
        card.front !== `Mistake check: ${mistake?.question || ""}`,
    );
    save();
    renderAll();
    toast("Mistake and its review card deleted.");
  }
  if (target.dataset.aiCritique) {
    const mistake = currentExam().mistakes.find((m) => m.id === target.dataset.aiCritique);
    if (!mistake) return;
    const btn = target,
      critiqueBox = document.getElementById(`critique-${mistake.id}`);
    btn.textContent = "🧠 Analyzing...";
    btn.disabled = true;
    const prompt = `Critique this mistake in a supportive, encouraging, and brief manner (2-3 sentences max).\nTopic: ${mistake.topic}\nQuestion: ${mistake.question}\nCorrect Approach: ${mistake.correct}\nWhat went wrong: ${mistake.why}\nProvide one actionable insight to help avoid this cognitive trap next time. Do NOT use markdown formatting, just plain text.`;
    askAI("You are an expert, encouraging tutor.", prompt)
      .then((text) => {
        critiqueBox.textContent = text;
        critiqueBox.classList.remove("hidden");
      })
      .catch((err) => toast(`AI Error: ${err.message}`))
      .finally(() => {
        btn.textContent = "🧠 AI Critique";
        btn.disabled = false;
      });
  }
  if (target.dataset.viewConcepts) openConceptsModal(target.dataset.viewConcepts);
  if (target.dataset.deleteConcept) {
    const exam = currentExam(),
      topic = exam.topics.find((t) => t.id === target.dataset.topicId);
    if (!topic) return;
    const concept = topic.concepts.find((c) => c.id === target.dataset.deleteConcept);
    if (concept) {
      if (concept.cardId) exam.cards = exam.cards.filter((c) => c.id !== concept.cardId);
      topic.concepts = topic.concepts.filter((c) => c.id !== concept.id);
      save();
      renderAll();
      openConceptsModal(topic.id);
      toast("Concept deleted.");
    }
  }
});

// Tutorial logic
let tutorialStep = 1;
function openTutorial() {
  tutorialStep = 1;
  updateTutorialUI();
  $("#tutorial-dialog")?.showModal();
}
function updateTutorialUI() {
  document.querySelectorAll(".tutorial-step").forEach((el, i) => el.classList.toggle("hidden", i + 1 !== tutorialStep));
  document.querySelectorAll("#tutorial-dots .dot").forEach((el, i) => el.classList.toggle("active", i + 1 === tutorialStep));
  $("#tutorial-back")?.classList.toggle("hidden", tutorialStep === 1);
  const nextBtn = $("#tutorial-next");
  if (nextBtn) nextBtn.textContent = tutorialStep === 4 ? "Finish" : "Next";
}
$("#tutorial-skip")?.addEventListener("click", () => {
  store.state.tutorialCompleted = true;
  save();
  $("#tutorial-dialog")?.close();
});
$("#tutorial-next")?.addEventListener("click", () => {
  if (tutorialStep < 4) {
    tutorialStep++;
    updateTutorialUI();
  } else {
    store.state.tutorialCompleted = true;
    save();
    $("#tutorial-dialog")?.close();
  }
});
$("#tutorial-back")?.addEventListener("click", () => {
  if (tutorialStep > 1) {
    tutorialStep--;
    updateTutorialUI();
  }
});

// Global Changes & Inputs
document.addEventListener("change", (event) => {
  const e = currentExam();
  if (!e) return;
  if (event.target.id === "exam-select" || event.target.id === "mobile-exam-select") {
    store.state.activeExamId = event.target.value;
    save();
    renderAll();
    if (event.target.id === "mobile-exam-select") $("#mobile-menu-dialog")?.close();
  }
  if (event.target.matches("[data-task-id]")) {
    const task = e.tasks.find((t) => t.id === event.target.dataset.taskId);
    if (task) {
      task.done = event.target.checked;
      save();
      renderAll();
      toast(task.done ? "Session logged - nice work." : "Session marked open.");
    }
  }
  if (event.target.matches("[data-topic-confidence]")) {
    const topic = e.topics.find((t) => t.id === event.target.dataset.topicConfidence);
    if (topic) {
      topic.confidence = Number(event.target.value);
      save();
      renderAll();
    }
  }
});

$("#plan-settings-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  savePlanSettings(true);
});
$("#plan-settings-form")?.addEventListener("input", () => savePlanSettings());
$("#plan-settings-form")?.addEventListener("change", (event) => {
  if (event.target.matches("[data-availability-day]")) {
    const hours = document.querySelector(`[data-availability-hours="${event.target.dataset.availabilityDay}"]`);
    if (hours) {
      hours.disabled = !event.target.checked;
      savePlanSettings();
    }
  }
});

$("#settings-import-file")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const rawText = ev.target.result;
      if (/<script|javascript:|on\w+\s*=|data:/i.test(rawText)) {
        throw new Error("Malicious content detected in backup file. Import blocked for your security.");
      }
      const imported = JSON.parse(rawText);
      if (!imported.activeExamId || !imported.exams) throw new Error("Invalid format");
      const existingKeys = store.state.ai.keys;
      Object.assign(store.state, imported);
      if (store.state.ai) store.state.ai.keys = existingKeys;
      save();
      location.reload();
    } catch (err) {
      alert("Invalid backup file: " + err.message);
    }
  };
  reader.readAsText(file);
});

$("#timer-focus")?.addEventListener("change", updateTimerSettings);
$("#timer-break")?.addEventListener("change", updateTimerSettings);
$("#modal-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  handleModal(event.currentTarget, renderAll);
});

// Drag and drop for schedule sessions
let draggedTaskId = null;
document.addEventListener("dragstart", (e) => {
  const el = e.target.closest("[data-drag-task]");
  if (!el) return;
  draggedTaskId = el.dataset.dragTask;
  el.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", draggedTaskId);
});
document.addEventListener("dragend", (e) => {
  draggedTaskId = null;
  document.querySelectorAll(".dragging").forEach((el) => el.classList.remove("dragging"));
  document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
});
document.addEventListener("dragover", (e) => {
  const day = e.target.closest("[data-drop-date]");
  if (!day || !draggedTaskId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
  day.classList.add("drag-over");
});
document.addEventListener("dragleave", (e) => {
  const day = e.target.closest("[data-drop-date]");
  if (day) day.classList.remove("drag-over");
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const day = e.target.closest("[data-drop-date]");
  if (!day || !draggedTaskId) return;
  day.classList.remove("drag-over");
  const newDate = day.dataset.dropDate,
    exam = currentExam(),
    task = exam?.tasks.find((t) => t.id === draggedTaskId);
  if (task && task.date !== newDate) {
    task.date = newDate;
    save();
    renderAll();
    toast(`Session moved to ${formatDate(newDate)}.`);
  }
  draggedTaskId = null;
});
