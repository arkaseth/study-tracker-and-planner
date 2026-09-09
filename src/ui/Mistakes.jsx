import { store, storeRev, currentExam, save } from "../core/state.js";
import { askAI } from "../api/ai.js";
import { isLocal } from "../utils/constants.js";
import { toast } from "../utils/helpers.js";
import { useState } from "preact/hooks";

function MistakeRow({ mistake, exam, onDelete }) {
  const [critique, setCritique] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCritique = async () => {
    setLoading(true);
    const prompt = `Critique this mistake in a supportive, encouraging, and brief manner (2-3 sentences max).\nTopic: ${mistake.topic}\nQuestion: ${mistake.question}\nCorrect Approach: ${mistake.correct}\nWhat went wrong: ${mistake.why}\nProvide one actionable insight to help avoid this cognitive trap next time. Do NOT use markdown formatting, just plain text.`;
    
    try {
      const text = await askAI("You are an expert, encouraging tutor.", prompt);
      setCritique(text);
    } catch (err) {
      toast(`AI Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="mistake-row">
      <div className="mistake-info">
        <span className="pill">{mistake.topic}</span>
        <b>{mistake.question}</b>
        <p><strong>Correct approach:</strong> {mistake.correct}</p>
        <p className="why"><strong>What went wrong:</strong> {mistake.why}</p>
        
        {isLocal && (
          <button 
            className="secondary-button" 
            style={{ marginTop: "10px", fontSize: "11px" }} 
            onClick={handleCritique}
            disabled={loading}
          >
            {loading ? "🧠 Analyzing..." : "🧠 AI Critique"}
          </button>
        )}
        
        {critique && (
          <div 
            className="mistake-critique" 
            style={{ marginTop: "10px", padding: "12px", background: "var(--bg-body)", borderRadius: "6px", fontSize: "12.5px", lineHeight: "1.5", color: "var(--ink)" }}
          >
            {critique}
          </div>
        )}
      </div>
      <button 
        className="icon-delete" 
        title="Delete mistake"
        onClick={() => onDelete(mistake.id)}
      >
        ×
      </button>
    </article>
  );
}

export function Mistakes() {
  const rev = storeRev.value;
  const exam = currentExam();
  if (!exam) return null;

  const mistakes = exam.mistakes || [];

  const handleDelete = (id) => {
    const mistake = exam.mistakes.find(m => m.id === id);
    exam.mistakes = exam.mistakes.filter(m => m.id !== id);
    exam.cards = exam.cards.filter(c => 
      c.mistakeId !== id && c.front !== `Mistake check: ${mistake?.question || ""}`
    );
    save();
    toast("Mistake and its review card deleted.");
  };

  return (
    <section className="view active-view">
      <div className="intro-row compact">
        <div>
          <p className="eyebrow">ERROR-DRIVEN LEARNING</p>
          <h1>Your mistake <em>book.</em></h1>
          <p className="muted">Turn errors into targeted recall prompts. No shame, just data.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            className="secondary-button" 
            title="Capture from image"
            onClick={() => document.dispatchEvent(new CustomEvent('openOCR'))}
          >
            <span style={{ verticalAlign: "middle", lineHeight: 1 }}>📷</span> Capture
          </button>
          <button 
            className="primary-button" 
            onClick={() => document.dispatchEvent(new CustomEvent('openModal', {detail: 'mistake'}))}
          >
            Log a mistake <span>+</span>
          </button>
        </div>
      </div>
      <section className="panel">
        <div className="mistake-list">
          {mistakes.length ? mistakes.map(m => (
            <MistakeRow key={m.id} mistake={m} exam={exam} onDelete={handleDelete} />
          )) : (
            <div className="empty-state">
              <div className="empty-orb">✓</div>
              <h2>No mistakes logged.</h2>
              <p>When one happens, capture the lesson while it is fresh.</p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
