import { storeRev, currentExam } from "../core/state.js";
import { getDueCards } from "../core/planner.js";

export function Insights() {
  const rev = storeRev.value;
  const exam = currentExam();
  if (!exam) return null;

  const due = getDueCards(exam);
  const weak = exam.topics.filter(t => t.confidence <= 2);
  const totalReview = exam.cards.reduce((sum, c) => sum + (c.reviews || 0), 0);

  return (
    <section className="view active-view">
      <div className="intro-row compact">
        <div>
          <p className="eyebrow">LEARNING SIGNALS</p>
          <h1>Notice the <em>pattern.</em></h1>
          <p className="muted">Use these signals to adjust effort, not judge yourself.</p>
        </div>
      </div>
      
      <div className="insights-grid">
        <article className="panel insight">
          <span className="eyebrow">FOCUS NEXT</span>
          <h2>{weak.length ? weak[0].name : "Keep it up"}</h2>
          <p>
            {weak.length 
              ? "Lowest confidence topic - pair one practice block with a short recall review." 
              : "All listed topics are becoming comfortable."}
          </p>
        </article>
        
        <article className="panel insight">
          <span className="eyebrow">REVIEW LOAD</span>
          <h2>{due.length} due</h2>
          <p>
            {due.length 
              ? "Clear these before adding more new material today." 
              : "A sustainable queue gives you space for new learning."}
          </p>
        </article>
        
        <article className="panel insight">
          <span className="eyebrow">RETRIEVAL REPS</span>
          <h2>{totalReview}</h2>
          <p>Every honest rating helps the schedule learn what needs another look.</p>
        </article>
      </div>
      
      <section className="panel">
        <p className="eyebrow">METHOD, LIGHTLY APPLIED</p>
        <div className="method-grid">
          <div>
            <b>Active recall</b>
            <p>Answer before you look. Retrieval strengthens memory more than rereading.</p>
          </div>
          <div>
            <b>Spaced reviews</b>
            <p>Revisit just before forgetting. Short intervals for difficult ideas; longer for solid ones.</p>
          </div>
          <div>
            <b>Deliberate practice</b>
            <p>Record why an answer failed and practise that exact gap next time.</p>
          </div>
        </div>
      </section>
    </section>
  );
}
