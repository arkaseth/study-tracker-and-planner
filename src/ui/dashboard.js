import { $, escapeHTML } from "../utils/helpers.js";
import { formatDate } from "../utils/dates.js";
import { store, currentExam, save } from "../core/state.js";
import { iso, addDays, daysBetween } from "../utils/dates.js";
import { getDueCards, sessionsCompleted, taskHours, getOverdueTasks } from "../core/planner.js";
import { toast } from "../utils/helpers.js";

// Ensure renderAll is imported properly where needed, or dispatch an event.
// Since modules can't easily circularly depend, we can take renderAll as a callback
// or use custom events. Let's export the functions and let main.js wire them up, 
// or import renderAll from main.js (circular dependency risk).
// Let's use a global custom event or a pub/sub pattern, OR just pass renderAll to those who need it.
// Actually, `window.renderAll` can be set in main.js, or we can just export a `renderDashboard` function.

export function renderHeader() {
  const headerDate = $("#header-date");
  if (!headerDate) return;
  headerDate.textContent = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  
  const select = $("#exam-select");
  if (select) {
    select.innerHTML = store.state.exams
      .map(
        (e) =>
          `<option value="${e.id}" ${e.id === store.state.activeExamId ? "selected" : ""}>${escapeHTML(e.name)}</option>`,
      )
      .join("");
  }
  
  const reviewBadge = $("#review-badge");
  if (reviewBadge) {
    reviewBadge.textContent = getDueCards(currentExam()).length;
  }
}

function renderOverdueHTML(overdue) {
  return overdue
    .map(
      (t) =>
        `<div class="task overdue-task"><div><div class="task-title">${escapeHTML(t.topic)}</div><div class="task-meta">${escapeHTML(t.type)} · ${formatDate(t.date)}</div></div><div class="overdue-actions"><button class="overdue-btn rescue" data-reschedule-task="${t.id}" title="Reschedule to tomorrow">Reschedule</button><button class="overdue-btn done" data-done-task="${t.id}" title="Mark as completed">Done</button><button class="overdue-btn skip" data-skip-task="${t.id}" title="Remove this session">Skip</button></div></div>`,
    )
    .join("");
}

export function renderDashboard() {
  const exam = currentExam();
  if (!exam) return;
  const today = iso(),
    due = getDueCards(exam);
  const days = daysBetween(today, exam.examDate),
    target = Math.ceil((exam.weeklyHours / 7) * days);
  const overdue = getOverdueTasks(exam);

  const summary = $("#today-summary");
  if (summary) {
    summary.textContent = `${days} days until ${exam.name}. Protect the next helpful session.`;
  }

  const statGrid = $("#stat-grid");
  if (statGrid) {
    statGrid.innerHTML = [
      ["DAYS LEFT", days, `until ${escapeHTML(exam.name)}`],
      [
        "TODAY",
        `${Math.round(taskHours(exam, today) * 60)} min`,
        `${exam.tasks.filter((t) => t.date === today && !t.done).length} sessions remaining`,
      ],
      [
        "REVIEWS DUE",
        due.length,
        due.length ? "prioritize weak and old cards" : "your queue is clear",
      ],
      [
        "PLAN PROGRESS",
        `${sessionsCompleted(exam)}/${exam.tasks.length}`,
        `${target ? Math.round((sessionsCompleted(exam) / target) * 100) : 0}% of suggested rhythm`,
      ],
    ]
      .map(
        ([l, n, d]) =>
          `<article class="stat-card"><span class="eyebrow">${l}</span><div class="stat-number">${n}</div><div class="stat-detail">${d}</div></article>`,
      )
      .join("");
  }

  const overdueContainer = $("#overdue-tasks");
  if (overdueContainer) {
    overdueContainer.innerHTML = overdue.length
      ? `<div class="overdue-banner"><span class="eyebrow overdue-label">⚠ ${overdue.length} MISSED SESSION${overdue.length === 1 ? "" : "S"}</span>${renderOverdueHTML(overdue)}</div>`
      : "";
  }

  const todayTasksContainer = $("#today-tasks");
  if (todayTasksContainer) {
    const tasks = exam.tasks.filter((t) => t.date === today);
    todayTasksContainer.innerHTML = tasks.length
      ? tasks
          .map(
            (t) =>
              `<label class="task"><input type="checkbox" data-task-id="${t.id}" ${t.done ? "checked" : ""}/><div><div class="task-title">${escapeHTML(t.topic)}</div><div class="task-meta">${escapeHTML(t.type)}</div></div><span class="task-duration">${t.duration} min</span></label>`,
          )
          .join("")
      : '<p class="muted">No sessions planned. Add a focused block to keep your rhythm.</p>';
  }

  const heatmap = $("#heatmap");
  if (heatmap) {
    const labels = [];
    let weeklyMinutes = 0;
    for (let i = 6; i >= 0; i--) {
      const d = iso(addDays(new Date(), -i)),
        minutes = taskHours(exam, d) * 60;
      weeklyMinutes += minutes;
      labels.push(
        `<div class="heat-day"><div class="heat-bar ${minutes ? "active" : ""}" style="height:${Math.max(4, Math.min(100, minutes / 1.2))}%"></div><span>${new Date(d + "T12:00").toLocaleDateString("en", { weekday: "narrow" })}</span></div>`,
      );
    }
    heatmap.innerHTML = labels.join("");
    
    const weeklyTotal = $("#weekly-total");
    if (weeklyTotal) {
      weeklyTotal.textContent = `${Math.round((weeklyMinutes / 60) * 10) / 10}h logged`;
    }
  }

  const duePreview = $("#due-preview");
  if (duePreview) {
    duePreview.innerHTML = due.length
      ? due
          .slice(0, 3)
          .map(
            (c) =>
              `<article class="due-item"><span>${escapeHTML(c.topic)}</span><b>${escapeHTML(c.front)}</b></article>`,
          )
          .join("")
      : '<p class="muted">No reviews due today.</p>';
  }

  renderTimer();
}

function timerMinutes() {
  return store.timerMode === "focus" ? store.state.timer.focus : store.state.timer.break;
}

export function renderTimer() {
  const display = $("#timer-display");
  if (!display) return;
  const minutes = Math.floor(store.timerRemaining / 60),
    seconds = store.timerRemaining % 60,
    total = timerMinutes() * 60;
    
  display.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  $("#timer-mode").textContent = store.timerMode.toUpperCase();
  $("#timer-progress span").style.width =
    `${Math.max(0, Math.min(100, (1 - store.timerRemaining / total) * 100))}%`;
    
  $("#timer-start").textContent = store.timerInterval
    ? "Pause"
    : `Start ${store.timerMode}`;
  
  if ($("#timer-focus")) $("#timer-focus").value = store.state.timer.focus;
  if ($("#timer-break")) $("#timer-break").value = store.state.timer.break;
  
  const linkSelect = $("#timer-linked-task");
  if (linkSelect && currentExam()) {
    const prev = linkSelect.value,
      today = iso(),
      tasks = currentExam().tasks.filter((t) => t.date === today && !t.done);
    linkSelect.innerHTML =
      '<option value="">None</option>' +
      tasks
        .map(
          (t) =>
            `<option value="${t.id}">${escapeHTML(t.topic)} · ${t.duration}m</option>`,
        )
        .join("");
    linkSelect.value = prev;
  }
}

export function pauseTimer() {
  clearInterval(store.timerInterval);
  store.timerInterval = null;
  renderTimer();
}

export function startTimer(renderAllCallback) {
  if (store.timerInterval) {
    pauseTimer();
    return;
  }
  store.timerInterval = setInterval(() => {
    store.timerRemaining--;
    if (store.timerRemaining <= 0) {
      const wasFocus = store.timerMode === "focus";
      store.timerMode = wasFocus ? "break" : "focus";
      store.timerRemaining = timerMinutes() * 60;
      
      if (wasFocus) {
        const linkSelect = $("#timer-linked-task"),
          taskId = linkSelect?.value;
        if (taskId && currentExam()) {
          const task = currentExam().tasks.find((t) => t.id === taskId);
          if (task && !task.done) {
            task.done = true;
            if (linkSelect) linkSelect.value = "";
            save();
            if (renderAllCallback) renderAllCallback();
            toast("Focus done\u2014linked session marked complete!");
          } else {
            toast("Focus block complete\u2014take a break.");
          }
        } else {
          toast("Focus block complete\u2014take a break.");
        }
      } else {
        toast("Break complete\u2014ready for another block?");
      }
    }
    renderTimer();
  }, 1000);
  renderTimer();
}

export function resetTimer() {
  pauseTimer();
  store.timerMode = "focus";
  store.timerRemaining = store.state.timer.focus * 60;
  renderTimer();
}

export function updateTimerSettings() {
  const focusInput = $("#timer-focus");
  const breakInput = $("#timer-break");
  if (!focusInput || !breakInput) return;
  
  const focus = Number(focusInput.value),
    rest = Number(breakInput.value);
    
  if (focus < 5 || focus > 120 || rest < 5 || rest > 60) return;
  store.state.timer = { focus, break: rest };
  save();
  if (!store.timerInterval) store.timerRemaining = timerMinutes() * 60;
  renderTimer();
}
