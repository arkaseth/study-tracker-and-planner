import { store, storeRev, currentExam, save } from "../core/state.js";
import { useEffect, useState } from "preact/hooks";
import { Dashboard } from "./Dashboard.jsx";
import { Plan } from "./Plan.jsx";
import { Review } from "./Review.jsx";
import { Mistakes } from "./Mistakes.jsx";
import { Insights } from "./Insights.jsx";
import { Modals } from "./Modals.jsx";
import { supabaseClient } from "../core/auth.js";
import { getDueCards } from "../core/planner.js";

function Sidebar({ currentView }) {
  const exam = currentExam();
  const due = exam ? getDueCards(exam).length : 0;
  
  return (
    <aside className="sidebar">
      <a className="brand" href="#dashboard" aria-label="Estudio home">
        <span className="brand-mark">e</span><span>estudio</span>
      </a>
      <div className="exam-switcher">
        <label htmlFor="exam-select">CURRENT FOCUS</label>
        <select 
          id="exam-select" 
          aria-label="Current study plan"
          value={store.state?.activeExamId}
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
        
        {!store.currentUser ? (
          <button className="nav-item button-nav" onClick={() => document.dispatchEvent(new CustomEvent('openAuth'))}>
            <span>👤</span>Log in to sync
          </button>
        ) : (
          <button className="nav-item button-nav" onClick={() => supabaseClient.auth.signOut()}>
            <span>⎋</span>Log out
          </button>
        )}
        <p>Built for deliberate practice,<br />not perfect streaks.</p>
      </div>
    </aside>
  );
}

function Topbar() {
  const dateStr = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="topbar">
      <div className="eyebrow">{dateStr}</div>
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
