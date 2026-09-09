import { store, storeRev, currentExam, save } from "../core/state.js";
import { getDueCards, sessionsCompleted, taskHours, getOverdueTasks } from "../core/planner.js";
import { iso, addDays, daysBetween, formatDate } from "../utils/dates.js";
import { toast } from "../utils/helpers.js";

function timerMinutes() {
  return store.timerMode === "focus" ? store.state.timer.focus : store.state.timer.break;
}

function Timer() {
  const minutes = Math.floor(store.timerRemaining / 60);
  const seconds = store.timerRemaining % 60;
  const total = timerMinutes() * 60;
  const progress = Math.max(0, Math.min(100, (1 - store.timerRemaining / total) * 100));

  const startTimer = () => {
    if (store.timerInterval) {
      clearInterval(store.timerInterval);
      store.timerInterval = null;
      storeRev.value++;
      return;
    }
    
    store.timerInterval = setInterval(() => {
      store.timerRemaining--;
      if (store.timerRemaining <= 0) {
        const wasFocus = store.timerMode === "focus";
        store.timerMode = wasFocus ? "break" : "focus";
        store.timerRemaining = timerMinutes() * 60;
        
        if (wasFocus) {
          const taskId = store.state.timerLinkedTaskId;
          const exam = currentExam();
          if (taskId && exam) {
            const task = exam.tasks.find(t => t.id === taskId);
            if (task && !task.done) {
              task.done = true;
              store.state.timerLinkedTaskId = "";
              save();
              toast("Focus done—linked session marked complete!");
            } else {
              toast("Focus block complete—take a break.");
            }
          } else {
            toast("Focus block complete—take a break.");
          }
        } else {
          toast("Break complete—ready for another block?");
        }
      }
      storeRev.value++;
    }, 1000);
    storeRev.value++;
  };

  const resetTimer = () => {
    if (store.timerInterval) clearInterval(store.timerInterval);
    store.timerInterval = null;
    store.timerMode = "focus";
    store.timerRemaining = store.state.timer.focus * 60;
    storeRev.value++;
  };

  const updateSettings = (field, value) => {
    const val = Number(value);
    if (field === 'focus' && (val < 5 || val > 120)) return;
    if (field === 'break' && (val < 5 || val > 60)) return;
    
    store.state.timer[field] = val;
    save();
    if (!store.timerInterval) {
      store.timerRemaining = timerMinutes() * 60;
      storeRev.value++;
    }
  };

  const exam = currentExam();
  const tasks = exam ? exam.tasks.filter((t) => t.date === iso() && !t.done) : [];

  return (
    <section className="panel pomodoro-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">POMODORO</p>
          <h2>One focused block.</h2>
        </div>
      </div>
      <div className="timer-layout">
        <div className="timer-clock">
          <div id="timer-display">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          <div className="timer-progress">
            <span style={{ width: `${progress}%` }}></span>
          </div>
          <span id="timer-mode">{store.timerMode.toUpperCase()}</span>
        </div>
        <div className="timer-controls">
          <div className="timer-link">
            <label htmlFor="timer-linked-task">Link to session</label>
            <select 
              id="timer-linked-task"
              value={store.state.timerLinkedTaskId || ""}
              onChange={(e) => { store.state.timerLinkedTaskId = e.target.value; storeRev.value++; }}
            >
              <option value="">None</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>{t.topic} · {t.duration}m</option>
              ))}
            </select>
          </div>
          <div className="timer-settings">
            <label>
              Focus
              <input 
                type="number" min="5" max="120" step="5" 
                value={store.state.timer.focus}
                onChange={(e) => updateSettings('focus', e.target.value)}
              /> min
            </label>
            <label>
              Break
              <input 
                type="number" min="5" max="60" step="5" 
                value={store.state.timer.break}
                onChange={(e) => updateSettings('break', e.target.value)}
              /> min
            </label>
          </div>
          <div className="timer-buttons">
            <button className="primary-button" onClick={startTimer}>
              {store.timerInterval ? "Pause" : `Start ${store.timerMode}`}
            </button>
            <button className="secondary-button" onClick={resetTimer}>
              Reset
            </button>
          </div>
          <p className="muted">When the timer ends, it moves to your break automatically.</p>
        </div>
      </div>
    </section>
  );
}

export function Dashboard() {
  const rev = storeRev.value;
  const exam = currentExam();
  if (!exam) return null;

  const today = iso();
  const due = getDueCards(exam);
  const days = daysBetween(today, exam.examDate);
  const target = Math.ceil((exam.weeklyHours / 7) * days);
  const overdue = getOverdueTasks(exam);
  const todayTasks = exam.tasks.filter((t) => t.date === today);

  let weeklyMinutes = 0;
  const heatDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = iso(addDays(new Date(), -i));
    const minutes = taskHours(exam, d) * 60;
    weeklyMinutes += minutes;
    heatDays.push({
      date: d,
      minutes,
      label: new Date(d + "T12:00").toLocaleDateString("en", { weekday: "narrow" })
    });
  }

  const toggleTask = (taskId, done) => {
    const t = exam.tasks.find(x => x.id === taskId);
    if (t) { t.done = done; save(); }
  };

  const handleOverdue = (taskId, action) => {
    const t = exam.tasks.find(x => x.id === taskId);
    if (!t) return;
    if (action === 'done') {
      t.done = true;
    } else if (action === 'reschedule') {
      t.date = iso(addDays(new Date(), 1));
    } else if (action === 'skip') {
      exam.tasks = exam.tasks.filter(x => x.id !== taskId);
    }
    save();
  };

  return (
    <section className="view active-view">
      <div className="intro-row">
        <div>
          <p className="eyebrow">YOUR STUDY STUDIO</p>
          <h1>Make today <em>count.</em></h1>
          <p className="muted">{days} days until {exam.name}. Protect the next helpful session.</p>
        </div>
        <button className="primary-button" onClick={() => location.hash = "review"}>
          Start a review <span>→</span>
        </button>
      </div>
      
      <div className="stat-grid">
        <article className="stat-card">
          <span className="eyebrow">DAYS LEFT</span>
          <div className="stat-number">{days}</div>
          <div className="stat-detail">until {exam.name}</div>
        </article>
        <article className="stat-card">
          <span className="eyebrow">TODAY</span>
          <div className="stat-number">{Math.round(taskHours(exam, today) * 60)} min</div>
          <div className="stat-detail">{todayTasks.filter(t => !t.done).length} sessions remaining</div>
        </article>
        <article className="stat-card">
          <span className="eyebrow">REVIEWS DUE</span>
          <div className="stat-number">{due.length}</div>
          <div className="stat-detail">{due.length ? "prioritize weak and old cards" : "your queue is clear"}</div>
        </article>
        <article className="stat-card">
          <span className="eyebrow">PLAN PROGRESS</span>
          <div className="stat-number">{sessionsCompleted(exam)}/{exam.tasks.length}</div>
          <div className="stat-detail">{target ? Math.round((sessionsCompleted(exam) / target) * 100) : 0}% of suggested rhythm</div>
        </article>
      </div>

      <div className="dashboard-grid">
        <section className="panel today-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TODAY'S FOCUS</p>
              <h2>Small steps, real progress.</h2>
            </div>
            <button className="text-button" onClick={() => location.hash = "plan"}>View plan →</button>
          </div>
          
          {overdue.length > 0 && (
            <div className="overdue-banner">
              <span className="eyebrow overdue-label">⚠ {overdue.length} MISSED SESSION{overdue.length === 1 ? "" : "S"}</span>
              {overdue.map(t => (
                <div key={t.id} className="task overdue-task">
                  <div>
                    <div className="task-title">{t.topic}</div>
                    <div className="task-meta">{t.type} · {formatDate(t.date)}</div>
                  </div>
                  <div className="overdue-actions">
                    <button className="overdue-btn rescue" onClick={() => handleOverdue(t.id, 'reschedule')}>Reschedule</button>
                    <button className="overdue-btn done" onClick={() => handleOverdue(t.id, 'done')}>Done</button>
                    <button className="overdue-btn skip" onClick={() => handleOverdue(t.id, 'skip')}>Skip</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="task-list">
            {todayTasks.length > 0 ? todayTasks.map(t => (
              <label key={t.id} className="task">
                <input 
                  type="checkbox" 
                  checked={t.done}
                  onChange={(e) => toggleTask(t.id, e.target.checked)}
                />
                <div>
                  <div className="task-title">{t.topic}</div>
                  <div className="task-meta">{t.type}</div>
                </div>
                <span className="task-duration">{t.duration} min</span>
              </label>
            )) : (
              <p className="muted">No sessions planned. Add a focused block to keep your rhythm.</p>
            )}
          </div>
        </section>

        <section className="panel rhythm-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">STUDY RHYTHM</p>
              <h2>Last 7 days</h2>
            </div>
            <span className="mono muted">{Math.round((weeklyMinutes / 60) * 10) / 10}h logged</span>
          </div>
          <div className="heatmap">
            {heatDays.map(d => (
              <div key={d.date} className="heat-day">
                <div className={`heat-bar ${d.minutes ? "active" : ""}`} style={{ height: `${Math.max(4, Math.min(100, d.minutes / 1.2))}%` }}></div>
                <span>{d.label}</span>
              </div>
            ))}
          </div>
          <p className="callout">
            <span>✦</span> Consistency beats cramming. A 25-minute recall session still counts.
          </p>
        </section>
      </div>

      <section className="panel due-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">RECALL, DON'T REREAD</p>
            <h2>Ready for a quick review</h2>
          </div>
          <button className="text-button" onClick={() => location.hash = "review"}>Open queue →</button>
        </div>
        <div className="due-preview">
          {due.length > 0 ? due.slice(0, 3).map(c => (
            <article key={c.id} className="due-item">
              <span>{c.topic}</span>
              <b>{c.front}</b>
            </article>
          )) : (
            <p className="muted">No reviews due today.</p>
          )}
        </div>
      </section>

      <Timer />
    </section>
  );
}
