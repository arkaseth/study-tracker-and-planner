import { store, storeRev, currentExam, save } from "../core/state.js";
import { useEffect, useState } from "preact/hooks";
import { Dashboard } from "./Dashboard.jsx";
import { Plan } from "./Plan.jsx";
import { Review } from "./Review.jsx";
import { Mistakes } from "./Mistakes.jsx";
import { Insights } from "./Insights.jsx";
import { Modals, GoogleIcon } from "./Modals.jsx";
import { supabaseClient } from "../core/auth.js";
import { getDueCards } from "../core/planner.js";
import { isPwaInstallable, promptPwaInstall } from "../core/pwa.js";

function Sidebar({ currentView }) {
  const exam = currentExam();
  const due = exam ? getDueCards(exam).length : 0;
  const [canInstall, setCanInstall] = useState(isPwaInstallable());

  useEffect(() => {
    const onInstallable = (e) => setCanInstall(Boolean(e.detail));
    window.addEventListener("pwa-installable", onInstallable);
    return () => window.removeEventListener("pwa-installable", onInstallable);
  }, []);
  
  return (
    <aside className="sidebar">
      <a className="brand" href="#dashboard" aria-label="Studia home">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>studia</span>
      </a>
      <div className="exam-switcher">
        <label htmlFor="exam-select">CURRENT FOCUS</label>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <select 
            id="exam-select" 
            aria-label="Current study plan"
            value={store.state?.activeExamId}
            style={{ flex: 1 }}
            onChange={(e) => {
              store.state.activeExamId = e.target.value;
              save();
            }}
          >
            {store.state?.exams.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="icon-button"
            style={{ width: "28px", height: "28px", minWidth: "28px", fontSize: "12px", border: "1px solid var(--line)" }}
            title="Edit current study plan"
            onClick={() => document.dispatchEvent(new CustomEvent('openModal', { detail: { type: 'edit-exam' } }))}
          >
            ✎
          </button>
        </div>
        <button 
          className="text-button" 
          id="new-exam-button"
          onClick={() => document.dispatchEvent(new CustomEvent('openModal', {detail: 'exam'}))}
        >
          + New study plan
        </button>
      </div>
      <nav aria-label="Main navigation">
        <a className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} href="#dashboard">
          <span>◫</span>Today
        </a>
        <a className={`nav-item ${currentView === 'plan' ? 'active' : ''}`} href="#plan">
          <span>▤</span>Plan
        </a>
        <a className={`nav-item ${currentView === 'review' ? 'active' : ''}`} href="#review">
          <span>◌</span>Review queue <b>{due}</b>
        </a>
        <a className={`nav-item ${currentView === 'mistakes' ? 'active' : ''}`} href="#mistakes">
          <span>↗</span>Mistake book
        </a>
        <a className={`nav-item ${currentView === 'insights' ? 'active' : ''}`} href="#insights">
          <span>◔</span>Insights
        </a>
      </nav>
      <div className="sidebar-bottom">
        <button 
          className="nav-item button-nav" 
          onClick={() => {
            const themes = ["night", "light", "ink", "lavender"];
            store.state.theme = themes[(themes.indexOf(store.state.theme) + 1) % themes.length];
            save();
          }}
        >
          <span>◐</span>Change theme
        </button>
        <button className="nav-item button-nav" onClick={() => document.dispatchEvent(new CustomEvent('openSettings'))}>
          <span>⚙️</span>Settings
        </button>
        
        {canInstall && (
          <button className="nav-item button-nav" onClick={promptPwaInstall} style={{ color: "var(--accent)" }}>
            <span>📲</span> Install app
          </button>
        )}
        {!store.currentUser ? (
          <>
            <button
              className="nav-item button-nav"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
              onClick={() => supabaseClient.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })}
            >
              <GoogleIcon size={16} /> Sign in with Google
            </button>
            <button className="nav-item button-nav" onClick={() => document.dispatchEvent(new CustomEvent('openAuth'))}>
              <span>👤</span> Log in to sync
            </button>
          </>
        ) : (
          <button className="nav-item button-nav" onClick={() => supabaseClient.auth.signOut()}>
            <span>⎋</span> Log out
          </button>
        )}
        <p>Built for deliberate practice,<br />not perfect streaks.</p>
      </div>
    </aside>
  );
}

function Topbar() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const dateStr = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className="eyebrow">{dateStr}</div>
        {!online && (
          <span className="pill" style={{ color: "var(--coral)", borderColor: "var(--coral)", fontSize: "9.5px", padding: "2px 6px" }}>
            offline
          </span>
        )}
      </div>
      <div className="top-actions">
        <button
          className="icon-button"
          title="Capture Question"
          style={{ fontSize: "17px" }}
          onClick={() => document.dispatchEvent(new CustomEvent('openOCR'))}
        >
          📷
        </button>
        <button
          className="icon-button"
          title="Add study task"
          onClick={() => document.dispatchEvent(new CustomEvent('openModal', {detail: 'task'}))}
        >
          +
        </button>
        <button 
          className="avatar" 
          title="Profile menu"
          onClick={() => document.dispatchEvent(new CustomEvent('openMobileMenu'))}
        >
          A
        </button>
      </div>
    </header>
  );
}

export function App() {
  // Subscribe to the global store signal
  const rev = storeRev.value; 
  
  const [currentView, setCurrentView] = useState(
    location.hash.slice(1) || "dashboard"
  );

  useEffect(() => {
    const handleHash = () => setCurrentView(location.hash.slice(1) || "dashboard");
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    if (store.state?.theme) {
      document.body.dataset.theme = store.state.theme;
    }
  }, [rev]); // Re-run when rev changes, implying state.theme might have changed

  if (!store.state) return null; // Still initializing

  return (
    <div className="app-shell">
      <Sidebar currentView={currentView} />
      <main>
        <Topbar />
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'plan' && <Plan />}
        {currentView === 'review' && <Review />}
        {currentView === 'mistakes' && <Mistakes />}
        {currentView === 'insights' && <Insights />}
      </main>
      <Modals />
    </div>
  );
}
