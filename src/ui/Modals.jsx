import { store, storeRev, currentExam, save } from "../core/state.js";
import { useEffect, useState, useRef } from "preact/hooks";
import { uid, toast, appConfirm } from "../utils/helpers.js";
import { iso, addDays } from "../utils/dates.js";
import { templates, isLocal, STORAGE_KEY, CUSTOM_TEMPLATE } from "../utils/constants.js";
import { askAI } from "../api/ai.js";
import { supabaseClient } from "../core/auth.js";
import { createDefaultAvailability } from "../core/planner.js";

// Global confirm function implementation
let confirmResolve = null;
window.appConfirm = (title, message) => {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.dispatchEvent(new CustomEvent('openConfirm', { detail: { title, message } }));
  });
};

/** JSON schema shown in the custom template tooltip */
const CUSTOM_TEMPLATE_SCHEMA = `[
  "Topic name 1",
  "Topic name 2",
  "Topic name 3"
]`;

/**
 * Template picker used in the "Create a study plan" form.
 * Shows all built-in templates plus a "Custom (import JSON)" option.
 * When custom is selected, shows a file picker and a schema info tooltip.
 */
function ExamTemplateField({ onCustomTopics }) {
  const [selected, setSelected] = useState(Object.keys(templates)[0]);
  const [showSchema, setShowSchema] = useState(false);
  const [customError, setCustomError] = useState('');

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed) || !parsed.every(t => typeof t === 'string')) {
          throw new Error('Must be a JSON array of strings.');
        }
        if (parsed.length < 1) throw new Error('Provide at least one topic.');
        setCustomError('');
        onCustomTopics(parsed);
      } catch (err) {
        setCustomError('Invalid file: ' + err.message);
        onCustomTopics(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <label className="modal-field">
        Template
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <select
            name="template"
            value={selected}
            onChange={e => { setSelected(e.target.value); if (e.target.value !== CUSTOM_TEMPLATE) onCustomTopics(null); }}
            style={{ flex: 1 }}
          >
            {Object.keys(templates).map(t => <option key={t} value={t}>{t}</option>)}
            <option value={CUSTOM_TEMPLATE}>✦ Custom (import JSON)…</option>
          </select>
          <button
            type="button"
            title="Show expected JSON format"
            style={{ border: '1px solid var(--line)', background: 'var(--panel2)', borderRadius: '50%', width: '26px', height: '26px', fontSize: '12px', flexShrink: 0, cursor: 'pointer' }}
            onClick={() => setShowSchema(s => !s)}
          >ⓘ</button>
        </div>
      </label>
      {showSchema && (
        <div style={{ background: 'var(--canvas)', border: '1px solid var(--line)', borderRadius: '6px', padding: '12px', fontSize: '11.5px', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '11px', color: 'var(--muted)' }}>CUSTOM TEMPLATE FORMAT — topics.json</p>
          <pre style={{ margin: 0, fontFamily: '"DM Mono", monospace', fontSize: '11px', whiteSpace: 'pre-wrap', color: 'var(--accent)' }}>{CUSTOM_TEMPLATE_SCHEMA}</pre>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '11px' }}>A plain JSON array of topic name strings. Save it as <code>.json</code> and import below.</p>
        </div>
      )}
      {selected === CUSTOM_TEMPLATE && (
        <label className="modal-field">
          Import topics.json
          <input type="file" accept=".json" onChange={handleFile} required />
          {customError && <span style={{ color: 'var(--danger)', fontSize: '11px' }}>{customError}</span>}
        </label>
      )}
    </>
  );
}

/**
 * AI provider + key fields sub-component used inside the Settings form.
 * Reads current values from store.state.ai so they are pre-filled on open.
 */
function SettingsAIFields() {
  const ai = store.state?.ai || { provider: 'gemini', keys: { gemini: '', openai: '', claude: '' } };
  const [provider, setProvider] = useState(ai.provider || 'gemini');

  return (
    <>
      <label className="modal-field">AI Copilot Provider
        <select name="provider" value={provider} onChange={e => setProvider(e.target.value)}>
          <option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="claude">Anthropic Claude</option>
        </select>
      </label>
      {/* All three key fields are always in the DOM; display:none ones still submit via FormData */}
      <div style={{ marginTop: "15px", display: "grid", gap: "12px" }}>
        <label className="modal-field" style={{ display: provider === 'gemini' ? '' : 'none' }}>
          Gemini API Key
          <input name="key-gemini" type="password" defaultValue={ai.keys?.gemini || ''} placeholder="AIzaSy..." />
        </label>
        <label className="modal-field" style={{ display: provider === 'openai' ? '' : 'none' }}>
          OpenAI API Key
          <input name="key-openai" type="password" defaultValue={ai.keys?.openai || ''} placeholder="sk-..." />
        </label>
        <label className="modal-field" style={{ display: provider === 'claude' ? '' : 'none' }}>
          Claude API Key
          <input name="key-claude" type="password" defaultValue={ai.keys?.claude || ''} placeholder="sk-ant-..." />
        </label>
      </div>
      <p className="muted" style={{ marginTop: "8px", fontSize: "11px" }}>Keys are stored securely in your local browser only. They are not synced to the cloud.</p>
    </>
  );
}

export function Modals() {
  const rev = storeRev.value; // reactive binding
  const [activeModal, setActiveModal] = useState(null); // 'auth', 'settings', 'mobileMenu', 'form', 'confirm', 'ocr', 'concepts'
  
  // Data states for specific modals
  const [confirmData, setConfirmData] = useState({ title: '', message: '' });
  const [formData, setFormData] = useState({ type: '', date: '', task: null });
  const [ocrState, setOcrState] = useState({ phase: 'upload', image: null, progress: 0, status: '', text: '' });
  const [conceptTopicId, setConceptTopicId] = useState(null);
  const [customTopics, setCustomTopics] = useState(null); // topics from custom JSON import

  const authDialog = useRef(null);
  const settingsDialog = useRef(null);
  const mobileMenuDialog = useRef(null);
  const formDialog = useRef(null);
  const confirmDialog = useRef(null);
  const ocrDialog = useRef(null);
  const conceptsDialog = useRef(null);

  // Sync state to <dialog> elements natively
  useEffect(() => {
    if (activeModal === 'auth') authDialog.current?.showModal(); else authDialog.current?.close();
    if (activeModal === 'settings') settingsDialog.current?.showModal(); else settingsDialog.current?.close();
    if (activeModal === 'mobileMenu') mobileMenuDialog.current?.showModal(); else mobileMenuDialog.current?.close();
    if (activeModal === 'form') formDialog.current?.showModal(); else formDialog.current?.close();
    if (activeModal === 'confirm') confirmDialog.current?.showModal(); else confirmDialog.current?.close();
    if (activeModal === 'ocr') ocrDialog.current?.showModal(); else ocrDialog.current?.close();
    if (activeModal === 'concepts') conceptsDialog.current?.showModal(); else conceptsDialog.current?.close();
  }, [activeModal]);

  // Event Listeners
  useEffect(() => {
    const handleOpenAuth = () => setActiveModal('auth');
    const handleOpenSettings = () => setActiveModal('settings');
    const handleOpenMobileMenu = () => setActiveModal('mobileMenu');
    const handleOpenConfirm = (e) => {
      setConfirmData(e.detail);
      setActiveModal('confirm');
    };
    const handleOpenModal = (e) => {
      const detail = e.detail;
      if (typeof detail === 'string') {
        setFormData({ type: detail, date: iso(), task: null });
      } else {
        setFormData({ type: detail.type, date: detail.date || iso(), task: detail.taskId ? currentExam()?.tasks.find(t => t.id === detail.taskId) : null });
      }
      setActiveModal('form');
    };
    const handleOpenOCR = () => {
      setOcrState({ phase: 'upload', image: null, progress: 0, status: '', text: '' });
      setActiveModal('ocr');
    };
    const handleOpenConcepts = (e) => {
      setConceptTopicId(e.detail);
      setActiveModal('concepts');
    };

    document.addEventListener('openAuth', handleOpenAuth);
    document.addEventListener('openSettings', handleOpenSettings);
    document.addEventListener('openMobileMenu', handleOpenMobileMenu);
    document.addEventListener('openConfirm', handleOpenConfirm);
    document.addEventListener('openModal', handleOpenModal);
    document.addEventListener('openOCR', handleOpenOCR);
    document.addEventListener('openConcepts', handleOpenConcepts);

    return () => {
      document.removeEventListener('openAuth', handleOpenAuth);
      document.removeEventListener('openSettings', handleOpenSettings);
      document.removeEventListener('openMobileMenu', handleOpenMobileMenu);
      document.removeEventListener('openConfirm', handleOpenConfirm);
      document.removeEventListener('openModal', handleOpenModal);
      document.removeEventListener('openOCR', handleOpenOCR);
      document.removeEventListener('openConcepts', handleOpenConcepts);
    };
  }, []);

  const closeModals = () => setActiveModal(null);

  // -- Handlers --

  const handleConfirmAction = (result) => {
    setActiveModal(null);
    if (confirmResolve) confirmResolve(result);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) toast(error.message);
    else closeModals();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const exam = currentExam();
    const type = formData.type;

    if (type === "exam") {
      const topicNames = data.template === CUSTOM_TEMPLATE
        ? (customTopics || [])
        : (templates[data.template] || []);
      store.state.exams.push({
        id: uid(),
        name: data.name.trim(),
        template: data.template === CUSTOM_TEMPLATE ? 'Custom' : data.template,
        examDate: data.examDate,
        weeklyHours: 8,
        availability: createDefaultAvailability(8),
        topics: topicNames.map((name) => ({ id: uid(), name, confidence: 1, completed: 0 })),
        tasks: [], cards: [], mistakes: [],
      });
      setCustomTopics(null);
      store.state.activeExamId = store.state.exams.at(-1).id;
      toast("Study plan created.");
    }
    
    if (type === "topic") {
      exam.topics.push({ id: uid(), name: data.topic.trim(), confidence: 1, completed: 0 });
    }
      
    if (type === "task") {
      const task = formData.task;
      if (task) Object.assign(task, { ...data, duration: Number(data.duration) });
      else exam.tasks.push({ id: uid(), ...data, duration: Number(data.duration), done: false });
    }
    
    if (type === "card") {
      exam.cards.push({
        id: uid(), ...data, due: iso(), reviews: 0, ease: 2.5, interval: 0, repetition: 0,
      });
    }
      
    if (type === "mistake") {
      const mistake = { id: uid(), ...data, created: iso() };
      exam.mistakes.unshift(mistake);
      exam.cards.push({
        id: uid(), front: `Mistake check: ${data.question}`, back: data.correct, topic: data.topic, due: iso(), reviews: 0, ease: 2.5, interval: 0, repetition: 0, mistakeId: mistake.id,
      });
    }

    save();
    closeModals();
    if (type !== "exam") toast(type === "mistake" ? "Mistake saved and added to review queue." : "Saved.");
  };

  return (
    <>
      <dialog ref={confirmDialog} id="confirm-dialog" onCancel={closeModals}>
        <div className="confirm-body">
          <h2 className="modal-title">{confirmData.title}</h2>
          <p className="modal-copy">{confirmData.message}</p>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => handleConfirmAction(false)}>Cancel</button>
            <button className="primary-button" onClick={() => handleConfirmAction(true)}>Continue</button>
          </div>
        </div>
      </dialog>

      <dialog ref={authDialog} id="auth-dialog" onCancel={closeModals}>
        <div className="confirm-body" style={{ padding: "28px", width: "380px", maxWidth: "100%", textAlign: "center", margin: "0 auto", position: "relative" }}>
          <button className="modal-close" type="button" onClick={closeModals}>×</button>
          <h2 className="modal-title" style={{ marginBottom: "8px" }}>Welcome to Estudio!</h2>
          <p className="modal-copy" style={{ marginBottom: "24px" }}>Log in to sync your study data.</p>
          <form onSubmit={handleAuthSubmit} style={{ textAlign: "left" }}>
            <label className="modal-field">
              Email <input name="email" type="email" required />
            </label>
            <label className="modal-field" style={{ marginTop: "12px" }}>
              Password <input name="password" type="password" required minLength="8" />
            </label>
            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button type="button" className="secondary-button" onClick={closeModals} style={{ marginRight: "auto", border: "none" }}>Skip (Offline)</button>
              <button type="submit" className="primary-button">Log In</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog ref={formDialog} id="modal" onCancel={closeModals}>
        <form id="modal-form" method="dialog" onSubmit={handleFormSubmit}>
          <button className="modal-close" type="button" onClick={closeModals}>×</button>
          <div id="modal-content">
            <h2 className="modal-title">
              {formData.task ? "Edit a study session" : { exam: "Create a study plan", topic: "Add a topic", task: "Add a study session", card: "Create a flashcard", mistake: "Log a learning moment" }[formData.type]}
            </h2>
            <p className="modal-copy">
              {formData.type === "mistake" ? "This will also create a review card for the correct approach." : "Keep it lightweight - you can refine it later."}
            </p>
            <div className="modal-fields">
              {formData.type === 'exam' && (
                <>
                  <label className="modal-field">Plan name<input name="name" placeholder="e.g. CFA Level I" required /></label>
                  <ExamTemplateField onCustomTopics={setCustomTopics} />
                  <label className="modal-field">Exam date<input name="examDate" type="date" defaultValue={iso(addDays(new Date(), 90))} required /></label>
                </>
              )}
              {formData.type === 'topic' && (
                <label className="modal-field">Topic name<input name="topic" placeholder="e.g. Probability" required /></label>
              )}
              {formData.type === 'task' && (
                <>
                  <label className="modal-field">Topic<input name="topic" list="topics-list" defaultValue={formData.task?.topic} required /></label>
                  <label className="modal-field">Type
                    <select name="type" defaultValue={formData.task?.type}>
                      {["Learn", "Practice", "Active recall", "Mock test"].map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                  </label>
                  <label className="modal-field">Date<input name="date" type="date" defaultValue={formData.task?.date || formData.date} required /></label>
                  <label className="modal-field">Duration (min)<input name="duration" type="number" defaultValue={formData.task?.duration || 60} min="30" max="480" step="15" required /></label>
                </>
              )}
              {formData.type === 'card' && (
                <>
                  <label className="modal-field">Prompt<input name="front" required /></label>
                  <label className="modal-field">Answer<textarea name="back" required></textarea></label>
                  <label className="modal-field">Topic<input name="topic" list="topics-list" required /></label>
                </>
              )}
              {formData.type === 'mistake' && (
                <>
                  <label className="modal-field">Topic<input name="topic" list="topics-list" required /></label>
                  <label className="modal-field">Question / situation<textarea name="question" required></textarea></label>
                  <label className="modal-field">Correct approach<textarea name="correct" required></textarea></label>
                  <label className="modal-field">What went wrong?<textarea name="why" required></textarea></label>
                </>
              )}
              <datalist id="topics-list">
                {currentExam()?.topics.map(t => <option key={t.id} value={t.name} />)}
              </datalist>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeModals}>Cancel</button>
              <button type="submit" className="primary-button">{formData.task ? "Update session" : "Save"}</button>
            </div>
          </div>
        </form>
      </dialog>

      <dialog ref={settingsDialog} id="settings-dialog" onCancel={closeModals}>
        <div className="confirm-body" style={{ position: "relative" }}>
          <button className="modal-close" type="button" onClick={closeModals}>×</button>
          <h2 className="modal-title">Settings</h2>

          {!isLocal && (
            <div style={{ color: "var(--coral)", fontSize: "12px", margin: "10px 0", padding: "10px", border: "1px solid var(--coral)", borderRadius: "6px", background: "color-mix(in srgb, var(--coral) 10%, transparent)" }}>
              AI Copilot is disabled on public domains for your security. Run the app locally to use these features.
            </div>
          )}

          <form style={{ marginTop: "15px" }} onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            store.state.ai.provider = fd.get("provider");
            store.state.ai.keys.gemini = fd.get("key-gemini").trim();
            store.state.ai.keys.openai = fd.get("key-openai").trim();
            store.state.ai.keys.claude = fd.get("key-claude").trim();
            save();
            closeModals();
            toast("Settings saved.");
          }}>
            <SettingsAIFields />

            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
              <p className="muted" style={{ marginBottom: "8px" }}>Data &amp; Export</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                <button type="button" className="secondary-button" style={{ width: "100%", fontSize: "11px" }} onClick={() => {
                  const backup = JSON.parse(JSON.stringify(store.state));
                  backup.ai.keys = { gemini: "", openai: "", claude: "" };
                  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "estudio-backup.json"; a.click();
                  URL.revokeObjectURL(url);
                }}>Export JSON</button>
                <label className="secondary-button" style={{ width: "100%", fontSize: "11px", cursor: "pointer", justifyContent: "center" }}>
                  Import JSON
                  <input type="file" accept=".json" className="hidden" onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      try {
                        const imported = JSON.parse(ev.target.result);
                        if (!imported.exams) throw new Error("Invalid backup file.");
                        const localKeys = store.state.ai?.keys || { gemini: "", openai: "", claude: "" };
                        store.state = imported;
                        if (!store.state.ai) store.state.ai = { provider: "gemini", keys: localKeys };
                        else store.state.ai.keys = localKeys;
                        save();
                        closeModals();
                        toast("Data imported successfully.");
                      } catch (err) {
                        toast("Import failed: " + err.message);
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }} />
                </label>
              </div>
              <button type="button" className="secondary-button" style={{ width: "100%", marginBottom: "8px" }} onClick={() => {
                const exam = currentExam();
                const futureTasks = exam.tasks.filter(t => t.date >= iso());
                if (!futureTasks.length && !exam.examDate) { toast("Nothing to export."); return; }
                let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Estudio//Study Planner//EN\r\n";
                if (exam.examDate) {
                  const s = exam.examDate.replace(/-/g, ""), e2 = addDays(exam.examDate, 1).toISOString().slice(0,10).replace(/-/g,"");
                  ics += `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${s}\r\nDTEND;VALUE=DATE:${e2}\r\nSUMMARY:🎯 ${exam.name} - EXAM DAY\r\nDESCRIPTION:Good luck!\r\nEND:VEVENT\r\n`;
                }
                futureTasks.forEach(t => {
                  const s = t.date.replace(/-/g,""), e2 = addDays(t.date, 1).toISOString().slice(0,10).replace(/-/g,"");
                  ics += `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${s}\r\nDTEND;VALUE=DATE:${e2}\r\nSUMMARY:[Study] ${t.topic} (${t.type})\r\nDESCRIPTION:Duration: ${t.duration} mins\r\nEND:VEVENT\r\n`;
                });
                ics += "END:VCALENDAR";
                const blob = new Blob([ics], { type: "text/calendar" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "estudio-schedule.ics"; a.click();
                URL.revokeObjectURL(url);
              }}>Export Schedule (.ics)</button>

              <p className="muted" style={{ marginBottom: "8px" }}>Danger Zone</p>
              <button type="button" className="secondary-button" style={{ width: "100%", marginBottom: "8px" }} onClick={async () => {
                const ok = await appConfirm("Delete API Keys?", "This will remove your stored API keys from this browser.");
                if (!ok) return;
                store.state.ai.keys = { gemini: "", openai: "", claude: "" };
                save();
                toast("API keys deleted.");
              }}>Delete API Keys</button>
              <button type="button" className="secondary-button" style={{ width: "100%", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={async () => {
                const ok = await appConfirm("Delete all data?", "This will permanently delete all your local study data, API keys, and reset the app. If you are logged in, it will also wipe your cloud backup. This cannot be undone.");
                if (!ok) return;
                closeModals();
                if (store.currentUser) {
                  await supabaseClient.from("study_data").delete().eq("id", store.currentUser.id);
                  await supabaseClient.auth.signOut();
                }
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
              }}>Delete All Data &amp; Reset App</button>
            </div>

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button type="button" className="secondary-button" onClick={closeModals}>Cancel</button>
              <button type="submit" className="primary-button">Save Settings</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog ref={mobileMenuDialog} id="mobile-menu-dialog" onCancel={closeModals}>
        <div className="confirm-body" style={{ position: "relative" }}>
          <button className="modal-close" type="button" onClick={closeModals}>×</button>
          <h2 className="modal-title" style={{ marginBottom: "16px" }}>Menu</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button className="secondary-button" onClick={() => { closeModals(); document.dispatchEvent(new CustomEvent('openSettings')); }}>Settings</button>
            <button className="secondary-button" onClick={() => { closeModals(); document.dispatchEvent(new CustomEvent('openAuth')); }}>Login</button>
          </div>
        </div>
      </dialog>

      <dialog ref={ocrDialog} id="ocr-dialog" onCancel={closeModals}>
        <div className="confirm-body" style={{ padding: "28px", width: "480px", maxWidth: "100%", position: "relative" }}>
          <button className="modal-close" type="button" onClick={closeModals}>×</button>
          <h2 className="modal-title">Capture Question</h2>
          <p className="modal-copy">OCR capabilities migrated to Preact.</p>
          <div className="modal-actions" style={{ marginTop: "24px" }}>
            <button type="button" className="secondary-button" onClick={closeModals}>Close</button>
          </div>
        </div>
      </dialog>

      <dialog ref={conceptsDialog} id="concepts-dialog" onCancel={closeModals}>
        <div className="confirm-body" style={{ padding: "28px", width: "480px", maxWidth: "100%", position: "relative" }}>
          <button className="modal-close" type="button" onClick={closeModals}>×</button>
          <h2 className="modal-title">Concepts</h2>
          <p className="modal-copy">Manage granular concepts here.</p>
          <div className="modal-actions" style={{ marginTop: "24px" }}>
            <button type="button" className="secondary-button" onClick={closeModals}>Close</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
