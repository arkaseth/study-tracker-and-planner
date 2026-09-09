import { store, storeRev, currentExam, save } from "../core/state.js";
import { getDueCards } from "../core/planner.js";
import { calcIntervals } from "../core/review.js";
import { iso, addDays, formatDate } from "../utils/dates.js";
import { toast } from "../utils/helpers.js";
import { useState } from "preact/hooks";

export function Review() {
  const rev = storeRev.value;
  const exam = currentExam();
  if (!exam) return null;

  const [flipped, setFlipped] = useState(false);
  const due = getDueCards(exam);
  const currentCard = due[0];
  const gaps = currentCard ? calcIntervals(currentCard) : null;

  const handleRating = (rating) => {
    if (!currentCard) return;
    currentCard.interval = gaps[rating];
    currentCard.due = iso(addDays(new Date(), currentCard.interval));
    currentCard.reviews++;
    
    if (rating === "again") {
      currentCard.repetition = 0;
      currentCard.ease = Math.max(1.3, currentCard.ease - 0.2);
    } else if (rating === "hard") {
      currentCard.repetition = Math.max(1, currentCard.repetition);
      currentCard.ease = Math.max(1.3, currentCard.ease - 0.15);
    } else if (rating === "good") {
      currentCard.repetition++;
    } else if (rating === "easy") {
      currentCard.repetition++;
      currentCard.ease += 0.15;
    }
    
    setFlipped(false);
    save();
    toast(rating === "again" ? "No problem - this card will return today." : "Review scheduled.");
  };

  const getGapText = (g) => g < 1 ? "< 1 day" : `${g} day${g === 1 ? "" : "s"}`;

  return (
    <section className="view active-view">
      <div className="intro-row compact">
        <div>
          <p className="eyebrow">SPACED REPETITION</p>
          <h1>Review <em>with intent.</em></h1>
          <p className="muted">Rate your recall honestly. Hard cards come back sooner.</p>
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
            className="secondary-button" 
            onClick={() => document.dispatchEvent(new CustomEvent('openModal', {detail: 'card'}))}
          >
            + New card
          </button>
        </div>
      </div>

      {!due.length ? (
        <div className="empty-state">
          <div className="empty-orb">✦</div>
          <h2>Your queue is clear.</h2>
          <p>Great work. Add a flashcard or return when the next review is due.</p>
          <button 
            className="primary-button" 
            onClick={() => document.dispatchEvent(new CustomEvent('openModal', {detail: 'card'}))}
          >
            Create a flashcard
          </button>
        </div>
      ) : (
        <section className="flashcard-stage">
          <p className="mono muted">{due.length} card{due.length === 1 ? "" : "s"} to review</p>
          <article className="flashcard">
            <button onClick={() => setFlipped(!flipped)} aria-label="Flip card">
              <span className="card-label">
                {flipped ? "ANSWER · rate your recall" : "PROMPT · click to reveal"}
              </span>
              <h2>{currentCard.front}</h2>
              {flipped && <p>{currentCard.back}</p>}
              <span className="flip-hint">↻</span>
            </button>
          </article>
          {flipped && (
            <div className="review-actions">
              <button onClick={() => handleRating('again')} className="rating again">
                Again <small>{getGapText(gaps.again)}</small>
              </button>
              <button onClick={() => handleRating('hard')} className="rating hard">
                Hard <small>{getGapText(gaps.hard)}</small>
              </button>
              <button onClick={() => handleRating('good')} className="rating good">
                Good <small>{getGapText(gaps.good)}</small>
              </button>
              <button onClick={() => handleRating('easy')} className="rating easy">
                Easy <small>{getGapText(gaps.easy)}</small>
              </button>
            </div>
          )}
        </section>
      )}

      <section className="panel all-cards">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">YOUR LIBRARY</p>
            <h2>Flashcards</h2>
          </div>
        </div>
        <div className="card-list">
          {exam.cards.length ? exam.cards.map(c => (
            <div key={c.id} className="card-row">
              <div>
                <b>{c.front}</b>
                <p>{c.topic} · {c.reviews} review{c.reviews === 1 ? "" : "s"}</p>
              </div>
              <span className="pill">
                {c.due <= iso() ? "due now" : `due ${formatDate(c.due)}`}
              </span>
            </div>
          )) : (
            <p className="muted">Your flashcards will appear here.</p>
          )}
        </div>
      </section>
    </section>
  );
}
