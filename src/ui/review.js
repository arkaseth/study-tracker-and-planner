import { $, escapeHTML } from "../utils/helpers.js";
import { currentExam } from "../core/state.js";
import { iso, formatDate } from "../utils/dates.js";
import { getDueCards } from "../core/planner.js";
import { calcIntervals } from "../core/review.js";

/**
 * Renders the review view.
 */
export function renderReview() {
  const exam = currentExam();
  if (!exam) return;
  const due = getDueCards(exam);
  
  const empty = $("#review-empty");
  const stage = $("#flashcard-stage");
  if (empty) empty.classList.toggle("hidden", !!due.length);
  if (stage) stage.classList.toggle("hidden", !due.length);
  
  if (due.length) {
    const card = due[0];
    if ($("#card-count")) $("#card-count").textContent = `${due.length} card${due.length === 1 ? "" : "s"} to review`;
    if ($("#card-front")) $("#card-front").textContent = card.front;
    if ($("#card-back")) {
      $("#card-back").textContent = card.back;
      $("#card-back").classList.add("hidden");
    }
    const cardLabel = $("#flashcard .card-label");
    if (cardLabel) cardLabel.textContent = "PROMPT · click to reveal";
    if ($("#review-actions")) $("#review-actions").classList.add("hidden");
    
    const gaps = calcIntervals(card);
    const btn = (r, g) => {
      const el = document.querySelector(`.rating.${r} small`);
      if (el) el.textContent = g < 1 ? "< 1 day" : `${g} day${g === 1 ? "" : "s"}`;
    };
    btn("again", gaps.again);
    btn("hard", gaps.hard);
    btn("good", gaps.good);
    btn("easy", gaps.easy);
  }
  
  const cardList = $("#card-list");
  if (cardList) {
    cardList.innerHTML = exam.cards.length
      ? exam.cards
          .map(
            (c) =>
              `<div class="card-row"><div><b>${escapeHTML(c.front)}</b><p>${escapeHTML(c.topic)} · ${c.reviews} review${c.reviews === 1 ? "" : "s"}</p></div><span class="pill">${c.due <= iso() ? "due now" : "due " + formatDate(c.due)}</span></div>`,
          )
          .join("")
      : '<p class="muted">Your flashcards will appear here.</p>';
  }
}
