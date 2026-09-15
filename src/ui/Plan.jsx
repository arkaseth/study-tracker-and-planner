import { store, storeRev, currentExam, save } from "../core/state.js";
import { getOverdueTasks, availabilityHours, minutesAvailableOn } from "../core/planner.js";
import { iso, addDays, formatDate } from "../utils/dates.js";
import { weekdayNames } from "../utils/constants.js";
import { toast, appConfirm, uid } from "../utils/helpers.js";
import { useState } from "preact/hooks";

function TrashIcon({ size = 13, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function Plan() {
  const rev = storeRev.value;
  const exam = currentExam();
  if (!exam) return null;

  const [bulkHours, setBulkHours] = useState(2);
  // Drag state
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  // Bulk-select state: Set of selected task IDs
  const [selectedIds, setSelectedIds] = useState(new Set());

  const clearSelected = async () => {
    const ok = await appConfirm('Delete selected sessions?', `Remove ${selectedIds.size} selected session(s)?`);
    if (!ok) return;
    exam.tasks = exam.tasks.filter(t => !selectedIds.has(t.id));
    setSelectedIds(new Set());
    save();
    toast('Selected sessions deleted.');
  };

  const clearDay = async (date) => {
    const dayTasks = exam.tasks.filter(t => t.date === date);
    if (!dayTasks.length) return;
    const ok = await appConfirm('Clear day?', `Remove all ${dayTasks.length} session(s) on ${formatDate(date)}?`);
    if (!ok) return;
    exam.tasks = exam.tasks.filter(t => t.date !== date);
    setSelectedIds(prev => { const next = new Set(prev); dayTasks.forEach(t => next.delete(t.id)); return next; });
    save();
    toast(`Cleared ${formatDate(date)}.`);
  };

  const clearAll = async () => {
    const total = exam.tasks.length;
    if (!total) { toast('No sessions to clear.'); return; }
    const ok = await appConfirm('Clear all sessions?', `This will permanently remove all ${total} sessions — including overdue and upcoming. This cannot be undone.`);
    if (!ok) return;
    exam.tasks = [];
    setSelectedIds(new Set());
    save();
    toast('All sessions cleared.');
  };

  const updateAvailability = (day, field, value) => {
    if (!exam.availability) exam.availability = {};
    if (!exam.availability[day]) exam.availability[day] = { hours: 2, active: false };
    
    exam.availability[day][field] = value;
    exam.weeklyHours = availabilityHours(exam);
    save();
  };

  const applyBulk = () => {
    if (bulkHours < 0.5 || bulkHours > 8) {
      toast("Choose between 0.5 and 8 hours.");
      return;
    }
    const selected = Object.values(exam.availability || {}).filter(d => d.active);
    if (!selected.length) {
      toast("Select at least one study day first.");
      return;
    }
    Object.keys(exam.availability).forEach(day => {
      if (exam.availability[day].active) {
        exam.availability[day].hours = bulkHours;
      }
    });
    exam.weeklyHours = availabilityHours(exam);
    save();
    toast(`Applied ${bulkHours}h to ${selected.length} selected day(s).`);
  };

  const handleGenerate = async () => {
    if (exam.weeklyHours <= 0) {
      toast("Choose at least one study day and its available hours first.");
      return;
    }
    const today = iso();
    const end = iso(addDays(new Date(), 13));
    const existing = exam.tasks.filter((t) => t.date >= today && t.date <= end);
    
    if (existing.length > 0) {
      const ok = await appConfirm(
        "Regenerate schedule?",
        `This will replace ${existing.length} scheduled session(s) in the next 14 days.`
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
    topics.forEach((t) => { topicTypeCursor[t.id] = 0; });
    
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
          id: uid(), date, topic: pick.name, type, duration, done: false,
        });
        dayTopics.push(pick.id);
      }
      lastDayTopics = new Set(dayTopics);
    }
    save();
    toast("A flexible 14-day schedule is ready to edit.");
  };

  const updateTopicConfidence = (topicId, val) => {
    const topic = exam.topics.find(t => t.id === topicId);
    if (topic) {
      topic.confidence = Number(val);
      save();
    }
  };

  const deleteTopic = (topicId) => {
    exam.topics = exam.topics.filter(t => t.id !== topicId);
    exam.tasks = exam.tasks.filter(t => t.topic !== exam.topics.find(x => x.id === topicId)?.name);
    save();
  };

  const handleTaskAction = (taskId, action) => {
    const t = exam.tasks.find(x => x.id === taskId);
    if (!t) return;
    if (action === 'delete') {
      exam.tasks = exam.tasks.filter(x => x.id !== taskId);
    } else if (action === 'reschedule') {
      t.date = iso(addDays(new Date(), 1));
    } else if (action === 'done') {
      t.done = true;
    } else if (action === 'edit') {
      document.dispatchEvent(new CustomEvent('openModal', { detail: { type: 'task', taskId }}));
      return; // save happens in modal
    }
    save();
  };

  const activeDaysCount = Object.values(exam.availability || {}).filter(d => d?.active).length;
  const avgHours = activeDaysCount ? Math.round((exam.weeklyHours / activeDaysCount) * 10) / 10 : 0;
  
  const today = iso();
  const overdueDates = [...new Set(getOverdueTasks(exam).map(t => t.date))].sort();
  const horizon = Array.from({ length: 14 }, (_, i) => iso(addDays(new Date(), i)));
  const allDates = [...new Set([...overdueDates, ...horizon])].sort();

  return (
    <section className="view active-view">
      <div className="intro-row compact">
        <div>
          <p className="eyebrow">ADAPTIVE SCHEDULE</p>
          <h1>Your study <em>plan.</em></h1>
          <p className="muted">Edit any session. The plan is a guide, not a contract.</p>
        </div>
        <button className="primary-button" onClick={handleGenerate}>
          Generate schedule <span>→</span>
        </button>
      </div>

      <div className="plan-layout">
        <section className="panel settings-panel">
          <p className="eyebrow">PLAN SETTINGS</p>
          <form onSubmit={e => e.preventDefault()}>
            <label>
              Exam date 
              <input 
                type="date" 
                required 
                value={exam.examDate}
                onChange={e => { exam.examDate = e.target.value; save(); }}
              />
            </label>
            <div className="availability-block">
              <span>Study availability</span>
              <small>Choose your study days and hours. This is the only scheduling input.</small>
              <div className="availability-editor">
                {weekdayNames.map((name, day) => {
                  const d = exam.availability?.[day] || { hours: 2, active: false };
                  return (
                    <label key={day} className="availability-row">
                      <input 
                        type="checkbox" 
                        checked={d.active}
                        onChange={e => updateAvailability(day, 'active', e.target.checked)}
                      />
                      <span>{name}</span>
                      <input 
                        type="number" min="0.5" max="8" step="0.5" 
                        value={d.hours} 
                        disabled={!d.active}
                        onChange={e => updateAvailability(day, 'hours', Number(e.target.value))}
                      />
                    </label>
                  );
                })}
              </div>
              <div className="availability-bulk">
                <label>
                  Set selected days to
                  <input 
                    type="number" min="0.5" max="8" step="0.5" 
                    value={bulkHours}
                    onChange={e => setBulkHours(Number(e.target.value))}
                  /> hrs
                </label>
                <button type="button" className="secondary-button" onClick={applyBulk}>Apply</button>
              </div>
              <p className="settings-status">
                {exam.weeklyHours}h per week · {activeDaysCount ? `${avgHours}h average per selected study day` : "select at least one study day"}
              </p>
            </div>
            <p className="settings-status">Changes save automatically.</p>
          </form>
        </section>

        <section className="panel topics-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TOPIC MAP</p>
              <h2>What you’re learning</h2>
            </div>
            <button className="text-button" onClick={() => document.dispatchEvent(new CustomEvent('openModal', {detail: 'topic'}))}>
              + Add topic
            </button>
          </div>
          <div className="topic-list">
            {exam.topics.length ? exam.topics.map(t => (
              <div key={t.id} className="topic-row" style={{ gridTemplateColumns: "1fr 90px auto 34px" }}>
                <div>
                  <b>{t.name}</b>
                  <span>confidence: {["needs work", "building", "comfortable", "strong"][t.confidence - 1] || "needs work"}</span>
                </div>
                <input 
                  type="range" min="1" max="4" 
                  value={t.confidence}
                  onChange={e => updateTopicConfidence(t.id, e.target.value)}
                />
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: "4px 10px", minHeight: "30px", fontSize: "11px", cursor: "pointer" }}
                  title="Manage sub-concepts"
                  onClick={() => document.dispatchEvent(new CustomEvent('openConcepts', { detail: t.id }))}
                >
                  {(t.concepts || []).length} concepts
                </button>
                <button className="icon-delete" onClick={() => deleteTopic(t.id)}>×</button>
              </div>
            )) : <p className="muted">Add the topics you want to study.</p>}
          </div>
        </section>
      </div>

      <section className="panel calendar-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">NEXT 14 DAYS</p>
            <h2>Your schedule</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="muted mono">{exam.weeklyHours}h / week</span>
            <button
              className="secondary-button"
              style={{ fontSize: '11px', padding: '4px 10px', minHeight: '30px', color: 'var(--danger)', borderColor: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              onClick={clearAll}
            >
              <TrashIcon size={12} /> Clear all
            </button>
          </div>
        </div>

        {/* Floating bulk-action bar — visible when sessions are selected */}
        {selectedIds.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'var(--panel2)', border: '1px solid var(--line)',
            borderRadius: '8px', padding: '10px 16px', marginBottom: '12px',
            fontSize: '13px',
          }}>
            <span style={{ flex: 1 }}><strong>{selectedIds.size}</strong> session{selectedIds.size !== 1 ? 's' : ''} selected</span>
            <button
              className="secondary-button"
              style={{ fontSize: '11px', padding: '4px 12px', minHeight: '28px' }}
              onClick={() => setSelectedIds(new Set())}
            >Deselect all</button>
            <button
              className="secondary-button"
              style={{ fontSize: '11px', padding: '4px 12px', minHeight: '28px', color: 'var(--danger)', borderColor: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              onClick={clearSelected}
            >
              <TrashIcon size={12} /> Delete selected
            </button>
          </div>
        )}
        <div className="schedule-list">
          {allDates.map(d => {
            const ts = exam.tasks.filter(t => t.date === d);
            const isPast = d < today;
            const isOverdueDay = isPast && ts.some(t => !t.done);
            const allDaySelected = ts.length > 0 && ts.every(t => selectedIds.has(t.id));

            return (
              <div key={d} className={`schedule-day ${isOverdueDay ? 'schedule-day-overdue' : ''} ${dragOverDate === d ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverDate(d); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDate(null); }}
                onDrop={e => {
                  e.preventDefault();
                  setDragOverDate(null);
                  if (!draggingId || draggingId === d) return;
                  const task = exam.tasks.find(t => t.id === draggingId);
                  if (task && task.date !== d) {
                    task.date = d;
                    save();
                    toast(`Moved to ${formatDate(d)}.`);
                  }
                  setDraggingId(null);
                }}
              >
                <div className="schedule-date">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Day-level checkbox: selects/deselects all sessions on this day */}
                    {ts.length > 0 && (
                      <input
                        type="checkbox"
                        title={allDaySelected ? 'Deselect day' : 'Select all on this day'}
                        checked={allDaySelected}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent)', flexShrink: 0 }}
                        onChange={() => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (allDaySelected) ts.forEach(t => next.delete(t.id));
                            else ts.forEach(t => next.add(t.id));
                            return next;
                          });
                        }}
                      />
                    )}
                    <span style={{ fontWeight: 600 }}>{formatDate(d)}</span>
                    {/* Per-day clear button */}
                    {ts.length > 0 && (
                      <button
                        type="button"
                        className="day-clear-btn"
                        title="Clear all sessions on this day"
                        onClick={() => clearDay(d)}
                      >
                        <TrashIcon size={12} />
                      </button>
                    )}
                  </div>
                  {isPast && isOverdueDay && (
                    <div style={{ marginTop: '3px' }}>
                      <span className="overdue-pill" style={{ marginLeft: 0 }}>overdue</span>
                    </div>
                  )}
                </div>
                <div className="session-list">
                  {ts.map(t => (
                    <span
                      key={t.id}
                      className={`session ${isPast && !t.done ? 'session-overdue' : ''} ${draggingId === t.id ? 'dragging' : ''} ${selectedIds.has(t.id) ? 'session-selected' : ''}`}
                      draggable={!t.done}
                      onDragStart={e => {
                        setDraggingId(t.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', t.id);
                      }}
                      onDragEnd={() => { setDraggingId(null); setDragOverDate(null); }}
                    >
                      <span className="tag">{t.type}</span>
                      {t.topic} · {t.duration}m
                      {isPast && !t.done ? (
                        <>
                          <button onClick={() => handleTaskAction(t.id, 'reschedule')} title="Reschedule">↻</button>
                          <button onClick={() => handleTaskAction(t.id, 'done')} title="Mark done">✓</button>
                          <button onClick={() => handleTaskAction(t.id, 'delete')} title="Skip">×</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleTaskAction(t.id, 'edit')} title="Edit session">✎</button>
                          <button onClick={() => handleTaskAction(t.id, 'delete')} title="Remove session">×</button>
                        </>
                      )}
                    </span>
                  ))}
                  {!ts.length && <span className="muted mono">Rest / catch-up</span>}
                  <button className="add-session" onClick={() => document.dispatchEvent(new CustomEvent('openModal', {detail: {type: 'task', date: d}}))}>
                    + Add session
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
