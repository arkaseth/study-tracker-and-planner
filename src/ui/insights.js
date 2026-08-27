import { $, escapeHTML } from "../utils/helpers.js";
import { currentExam } from "../core/state.js";
import { getDueCards } from "../core/planner.js";

/**
 * Renders performance insights and statistics.
 */
export function renderInsights() {
  const e = currentExam();
  if (!e) return;
  const due = getDueCards(e);
  const weak = e.topics.filter((t) => t.confidence <= 2);
  const totalReview = e.cards.reduce((sum, c) => sum + c.reviews, 0);
  const content = $("#insights-content");
  if (!content) return;
  
  content.innerHTML =
    `<article class="panel insight"><span class="eyebrow">FOCUS NEXT</span><h2>${weak.length ? escapeHTML(weak[0].name) : "Keep it up"}</h2><p>${weak.length ? "Lowest confidence topic - pair one practice block with a short recall review." : "All listed topics are becoming comfortable."}</p></article><article class="panel insight"><span class="eyebrow">REVIEW LOAD</span><h2>${due.length} due</h2><p>${due.length ? "Clear these before adding more new material today." : "A sustainable queue gives you space for new learning."}</p></article><article class="panel insight"><span class="eyebrow">RETRIEVAL REPS</span><h2>${totalReview}</h2><p>Every honest rating helps the schedule learn what needs another look.</p></article>`;
}
