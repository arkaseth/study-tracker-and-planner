import { store, storeRev, currentExam, save } from "../core/state.js";
import { useEffect, useState, useRef } from "preact/hooks";
import { uid, toast, appConfirm } from "../utils/helpers.js";
import { iso, addDays } from "../utils/dates.js";
import { templates, isLocal, STORAGE_KEY, CUSTOM_TEMPLATE, SESSION_TYPES } from "../utils/constants.js";
import { askAI } from "../api/ai.js";
import { supabaseClient } from "../core/auth.js";
import { createDefaultAvailability } from "../core/planner.js";
import { isPwaInstallable, promptPwaInstall } from "../core/pwa.js";

// Global confirm function implementation
let confirmResolve = null;
window.appConfirm = (title, message) => {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.dispatchEvent(new CustomEvent('openConfirm', { detail: { title, message } }));
  });
};

export function GoogleIcon({ size = 18, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

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
  const [formData, setFormData] = useState({ type: '', date: '', task: null, initialText: '' });
  const [ocrState, setOcrState] = useState({ phase: 'upload', image: null, progress: 0, status: '', text: '' });
  const [ocrDragOver, setOcrDragOver] = useState(false);
  const [conceptTopicId, setConceptTopicId] = useState(null);
  const [customTopics, setCustomTopics] = useState(null); // topics from custom JSON import
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  const authDialog = useRef(null);
  const settingsDialog = useRef(null);
  const mobileMenuDialog = useRef(null);
  const formDialog = useRef(null);
  const confirmDialog = useRef(null);
  const ocrDialog = useRef(null);
  const ocrFileRef = useRef(null);
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

  // Paste handler for OCR capture
  useEffect(() => {
    const handlePaste = (e) => {
      if (activeModal !== 'ocr') return;
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) handleOcrImage(file);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [activeModal]);

  // Event Listeners
  useEffect(() => {
    const handleOpenAuth = () => {
      setAuthError('');
      setAuthMessage('');
      setActiveModal('auth');
    };
    const handleOpenSettings = () => setActiveModal('settings');
    const handleOpenMobileMenu = () => setActiveModal('mobileMenu');
    const handleOpenConfirm = (e) => {
      setConfirmData(e.detail);
      setActiveModal('confirm');
    };
    const handleOpenModal = (e) => {
      const detail = e.detail;
      if (typeof detail === 'string') {
        setFormData({ type: detail, date: iso(), task: null, card: null, initialText: '' });
      } else {
        setFormData({
          type: detail.type,
          date: detail.date || iso(),
          task: detail.taskId ? currentExam()?.tasks.find(t => t.id === detail.taskId) : null,
          card: detail.cardId ? currentExam()?.cards.find(c => c.id === detail.cardId) : null,
          initialText: detail.initialText || ''
        });
      }
      setActiveModal('form');
    };
    const handleOpenOCR = () => {
      setOcrState({ phase: 'upload', image: null, progress: 0, status: '', text: '' });
      setOcrDragOver(false);
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

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (error) setAuthError(error.message);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
    } else {
      closeModals();
      toast("Logged in successfully.");
    }
  };

  const handleSignUp = async (e) => {
    const form = e.target.closest('form');
    const email = form?.email?.value?.trim();
    const password = form?.password?.value;
    if (!email || !password || password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setAuthError('Enter email and 8+ char alphanumeric password.');
      return;
    }
    setAuthError('');
    setAuthMessage('');
    const { error, data } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
    } else if (data?.user && data.user.identities && data.user.identities.length === 0) {
      setAuthError('User already exists.');
    } else {
      setAuthMessage('Signup successful! Check your email confirmation link, then log in.');
    }
  };

  const handleOcrImage = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast('Please choose a valid image file.');
      return;
    }
    const url = URL.createObjectURL(file);
    setOcrState({
      phase: 'processing',
      image: url,
      progress: 8,
      status: 'Initializing OCR engine...',
      text: ''
    });

    if (!window.Tesseract) {
      setOcrState(prev => ({
        ...prev,
        phase: 'upload',
        status: 'OCR library (Tesseract.js) is not loaded. Please check your internet connection.'
      }));
      toast('OCR library not available.');
      return;
    }

    window.Tesseract.recognize(file, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.max(10, Math.round(m.progress * 100));
          setOcrState(prev => ({
            ...prev,
            progress: pct,
            status: `Extracting text: ${pct}%`
          }));
        } else if (m.status) {
          setOcrState(prev => ({ ...prev, status: m.status }));
        }
      }
    })
      .then(({ data: { text } }) => {
        setOcrState(prev => ({
          ...prev,
          phase: 'result',
          progress: 100,
          status: '',
          text: (text || '').trim()
        }));
      })
      .catch((err) => {
        console.error('OCR Recognition error:', err);
        setOcrState(prev => ({
          ...prev,
          phase: 'upload',
          status: 'Failed to extract text from this image. Please try another image.'
        }));
        toast('OCR failed to read image.');
      });
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

    if (type === "edit-exam") {
      if (data.name?.trim()) exam.name = data.name.trim();
      if (data.examDate) exam.examDate = data.examDate;
      toast("Study plan updated.");
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
      const card = formData.card;
      if (card) {
        card.front = data.front.trim();
        card.back = data.back.trim();
        card.topic = data.topic.trim();
      } else {
        exam.cards.push({
          id: uid(), ...data, due: iso(), reviews: 0, ease: 2.5, interval: 0, repetition: 0,
        });
      }
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
          <h2 className="modal-title" style={{ marginBottom: "8px" }}>Welcome to Studia!</h2>
          <p className="modal-copy" style={{ marginBottom: "20px" }}>Log in to sync your study data.</p>
          
          <button
            type="button"
            id="auth-google-btn"
            className="secondary-button"
            style={{
              width: "100%",
              marginBottom: "16px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "10px 16px",
              fontWeight: 500,
              fontSize: "13px",
              cursor: "pointer",
            }}
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon size={18} />
            Sign in with Google
          </button>

          <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ flex: 1, height: "1px", background: "var(--line)" }}></span>
            <span>OR</span>
            <span style={{ flex: 1, height: "1px", background: "var(--line)" }}></span>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ textAlign: "left" }}>
            <label className="modal-field">
              Email <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
            </label>
            <label className="modal-field" style={{ marginTop: "12px" }}>
              Password <input name="password" type="password" required minLength="8" autoComplete="current-password" placeholder="••••••••" />
            </label>

            {authError && (
              <p style={{ color: "var(--coral)", fontSize: "12px", marginTop: "10px" }}>
                {authError}
              </p>
            )}
            {authMessage && (
              <p style={{ color: "var(--ink)", fontSize: "12px", marginTop: "10px" }}>
                {authMessage}
              </p>
            )}

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button
                type="button"
                id="auth-skip-btn"
                className="secondary-button"
                onClick={closeModals}
                style={{ marginRight: "auto", border: "none", background: "transparent", fontSize: "11px", color: "var(--muted)", cursor: "pointer" }}
              >
                Skip (Offline)
              </button>
              <button
                type="button"
                id="auth-signup-btn"
                className="secondary-button"
                onClick={handleSignUp}
              >
                Sign Up
              </button>
              <button type="submit" id="auth-login-btn" className="primary-button">
                Log In
              </button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog ref={formDialog} id="modal" onCancel={closeModals}>
        <form id="modal-form" method="dialog" onSubmit={handleFormSubmit}>
          <button className="modal-close" type="button" onClick={closeModals}>×</button>
          <div id="modal-content">
            <h2 className="modal-title">
              {formData.task ? "Edit a study session" : formData.card ? "Edit flashcard" : { exam: "Create a study plan", "edit-exam": "Edit study plan", topic: "Add a topic", task: "Add a study session", card: "Create a flashcard", mistake: "Log a learning moment" }[formData.type]}
            </h2>
            <p className="modal-copy">
              {formData.type === "mistake" ? "This will also create a review card for the correct approach." : formData.type === "edit-exam" ? "Update plan name or target exam date." : "Keep it lightweight - you can refine it later."}
            </p>
            <div className="modal-fields">
              {formData.type === 'edit-exam' && (
                <>
                  <label className="modal-field">Plan name<input name="name" defaultValue={currentExam()?.name} required /></label>
                  <label className="modal-field">Exam date<input name="examDate" type="date" defaultValue={currentExam()?.examDate} required /></label>
                  <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
                    <p className="muted" style={{ fontSize: "11px", marginBottom: "8px" }}>Danger Zone</p>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: "100%", color: "var(--danger)", borderColor: "var(--danger)", fontSize: "12px" }}
                      onClick={async () => {
                        const exams = store.state?.exams || [];
                        if (exams.length <= 1) {
                          toast("You must have at least one study plan.");
                          return;
                        }
                        const cur = currentExam();
                        const ok = await appConfirm(
                          "Delete study plan?",
                          `Permanently delete "${cur?.name}" and all its topics, schedule tasks, flashcards, and mistakes?`
                        );
                        if (!ok) return;
                        store.state.exams = exams.filter(e => e.id !== cur.id);
                        store.state.activeExamId = store.state.exams[0].id;
                        save();
                        closeModals();
                        toast("Study plan deleted.");
                      }}
                    >
                      Delete this study plan
                    </button>
                  </div>
                </>
              )}
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
                    <select name="type" defaultValue={formData.task?.type || "Learn"}>
                      {SESSION_TYPES.map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                  </label>
                  <label className="modal-field">Date<input name="date" type="date" defaultValue={formData.task?.date || formData.date} required /></label>
                  <label className="modal-field">Duration (min)<input name="duration" type="number" defaultValue={formData.task?.duration || 60} min="30" max="480" step="15" required /></label>
                </>
              )}
              {formData.type === 'card' && (
                <>
                  <label className="modal-field">Prompt<input name="front" defaultValue={formData.card?.front || formData.initialText || ''} required /></label>
                  <label className="modal-field">Answer<textarea name="back" defaultValue={formData.card?.back || ''} required></textarea></label>
                  <label className="modal-field">Topic<input name="topic" list="topics-list" defaultValue={formData.card?.topic || ''} required /></label>
                </>
              )}
              {formData.type === 'mistake' && (
                <>
                  <label className="modal-field">Topic<input name="topic" list="topics-list" required /></label>
                  <label className="modal-field">Question / situation<textarea name="question" defaultValue={formData.initialText || ''} required></textarea></label>
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
              <button type="submit" className="primary-button">
                {formData.task ? "Update session" : formData.card ? "Update flashcard" : formData.type === "edit-exam" ? "Update plan" : "Save"}
              </button>
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
                  a.href = url; a.download = "studia-backup.json"; a.click();
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
                let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Studia//Study Planner//EN\r\n";
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
                const a = document.createElement("a"); a.href = url; a.download = "studia-schedule.ics"; a.click();
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
            {isPwaInstallable() && (
              <button
                className="secondary-button"
                style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
                onClick={() => {
                  closeModals();
                  promptPwaInstall();
                }}
              >
                <span>📲</span> Install app
              </button>
            )}
            <button className="secondary-button" onClick={() => { closeModals(); document.dispatchEvent(new CustomEvent('openSettings')); }}>Settings</button>
            {!store.currentUser ? (
              <>
                <button
                  className="primary-button"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "center" }}
                  onClick={() => {
                    closeModals();
                    supabaseClient.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
                  }}
                >
                  <GoogleIcon size={16} /> Sign in with Google
                </button>
                <button className="secondary-button" onClick={() => { closeModals(); document.dispatchEvent(new CustomEvent('openAuth')); }}>
                  <span>👤</span> Email login / sync
                </button>
              </>
            ) : (
              <button
                className="secondary-button"
                style={{ color: "var(--coral)", borderColor: "var(--coral)" }}
                onClick={() => { closeModals(); supabaseClient.auth.signOut(); }}
              >
                <span>⎋</span> Log out
              </button>
            )}
          </div>
        </div>
      </dialog>

      <dialog ref={ocrDialog} id="ocr-dialog" onCancel={closeModals}>
        <div className="confirm-body" style={{ width: "100%", maxWidth: "100%", padding: "28px", boxSizing: "border-box", position: "relative" }}>
          <button className="modal-close" type="button" onClick={closeModals}>×</button>
          <h2 className="modal-title">Capture Question</h2>
          <p className="modal-copy">Paste an image (Ctrl+V) or click to upload.</p>

          <input
            type="file"
            ref={ocrFileRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleOcrImage(e.target.files[0]);
              e.target.value = '';
            }}
          />

          {ocrState.phase !== 'result' ? (
            <div
              className={`ocr-dropzone ${ocrDragOver ? 'drag-over' : ''}`}
              onClick={() => ocrFileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOcrDragOver(true); }}
              onDragLeave={() => setOcrDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOcrDragOver(false);
                if (e.dataTransfer.files?.[0]) handleOcrImage(e.dataTransfer.files[0]);
              }}
            >
              {ocrState.image ? (
                <img src={ocrState.image} className="ocr-preview" alt="Question capture" />
              ) : (
                <div style={{ padding: "10px 0" }}>
                  <div style={{ fontSize: "30px", marginBottom: "8px" }}>📷</div>
                  <p style={{ margin: 0, fontWeight: 500 }}>Click to browse or drop an image</p>
                  <p className="muted" style={{ fontSize: "11.5px", marginTop: "4px" }}>Screenshots, textbook problems, past exams</p>
                </div>
              )}

              {ocrState.phase === 'processing' && (
                <div style={{ marginTop: "14px" }}>
                  <div className="timer-progress" style={{ width: "100%", marginTop: "10px" }}>
                    <span style={{ width: `${ocrState.progress}%` }}></span>
                  </div>
                  <p className="muted" style={{ fontSize: "11.5px", marginTop: "6px" }}>
                    {ocrState.status || "Extracting text..."}
                  </p>
                </div>
              )}

              {ocrState.phase === 'upload' && ocrState.status && (
                <p style={{ color: "var(--coral)", fontSize: "12px", marginTop: "10px" }}>
                  {ocrState.status}
                </p>
              )}
            </div>
          ) : (
            <div style={{ marginTop: "15px" }}>
              {ocrState.image && (
                <img src={ocrState.image} className="ocr-preview" alt="Extracted source" style={{ maxHeight: "130px" }} />
              )}
              <label className="modal-field">
                Extracted Text (Edit if needed)
                <textarea
                  style={{ minHeight: "120px", marginTop: "6px", width: "100%", boxSizing: "border-box" }}
                  value={ocrState.text}
                  onInput={(e) => setOcrState(prev => ({ ...prev, text: e.target.value }))}
                />
              </label>

              <div className="modal-actions" style={{ marginTop: "16px", justifyContent: "space-between" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setOcrState({ phase: 'upload', image: null, progress: 0, status: '', text: '' })}
                >
                  Capture another
                </button>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      const text = ocrState.text;
                      closeModals();
                      document.dispatchEvent(new CustomEvent('openModal', { detail: { type: 'card', initialText: text } }));
                    }}
                  >
                    Save to Flashcard
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      const text = ocrState.text;
                      closeModals();
                      document.dispatchEvent(new CustomEvent('openModal', { detail: { type: 'mistake', initialText: text } }));
                    }}
                  >
                    Save to Mistake Book
                  </button>
                </div>
              </div>
            </div>
          )}

          {ocrState.phase !== 'result' && (
            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button type="button" className="secondary-button" onClick={closeModals} style={{ marginLeft: "auto" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </dialog>

      <dialog ref={conceptsDialog} id="concepts-dialog" onCancel={closeModals}>
        <div className="confirm-body" style={{ padding: "28px", width: "480px", maxWidth: "100%", position: "relative" }}>
          <button className="modal-close" type="button" onClick={closeModals}>×</button>
          {(() => {
            const topic = currentExam()?.topics.find(t => t.id === conceptTopicId);
            if (!topic) {
              return (
                <div>
                  <h2 className="modal-title">Concepts</h2>
                  <p className="modal-copy">Topic not found.</p>
                  <div className="modal-actions" style={{ marginTop: "20px" }}>
                    <button type="button" className="secondary-button" onClick={closeModals}>Close</button>
                  </div>
                </div>
              );
            }

            const concepts = Array.isArray(topic.concepts) ? topic.concepts : [];

            return (
              <div>
                <p className="eyebrow" style={{ color: "var(--accent)" }}>TOPIC BREAKDOWN</p>
                <h2 className="modal-title" style={{ marginBottom: "6px" }}>{topic.name}</h2>
                <p className="modal-copy" style={{ marginBottom: "16px" }}>
                  Granular concepts help you break topics down into focused checkpoints.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.target.conceptName;
                    const val = input.value.trim();
                    if (!val) return;
                    if (!topic.concepts) topic.concepts = [];
                    topic.concepts.push(val);
                    save();
                    input.value = "";
                  }}
                  style={{ display: "flex", gap: "8px", marginBottom: "16px" }}
                >
                  <input
                    name="conceptName"
                    placeholder="Add a concept (e.g. Bayes Theorem)..."
                    style={{ flex: 1 }}
                    required
                  />
                  <button type="submit" className="primary-button" style={{ padding: "6px 14px" }}>
                    Add
                  </button>
                </form>

                <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
                  {concepts.length > 0 ? concepts.map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "var(--panel2)",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        fontSize: "13px"
                      }}
                    >
                      <span>{typeof c === "string" ? c : c.name || "Concept"}</span>
                      <button
                        type="button"
                        className="icon-delete"
                        title="Delete concept"
                        onClick={() => {
                          topic.concepts = concepts.filter((_, i) => i !== idx);
                          save();
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )) : (
                    <p className="muted" style={{ fontSize: "12px", textAlign: "center", padding: "16px 0" }}>
                      No concepts added yet. Add key concepts to track mastery.
                    </p>
                  )}
                </div>

                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={closeModals} style={{ marginLeft: "auto" }}>
                    Done
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </dialog>
    </>
  );
}
