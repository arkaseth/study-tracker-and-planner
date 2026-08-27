import { $, escapeHTML } from "../utils/helpers.js";
import { currentExam } from "../core/state.js";
import { isLocal } from "../utils/constants.js";

/**
 * Renders the mistakes view.
 */
export function renderMistakes() {
  const exam = currentExam();
  if (!exam) return;
  const mistakes = exam.mistakes;
  const list = $("#mistake-list");
  if (!list) return;
  
  list.innerHTML = mistakes.length
    ? mistakes
        .map(
          (m) =>
            `<article class="mistake-row"><div class="mistake-info"><span class="pill">${escapeHTML(m.topic)}</span><b>${escapeHTML(m.question)}</b><p><strong>Correct approach:</strong> ${escapeHTML(m.correct)}</p><p class="why"><strong>What went wrong:</strong> ${escapeHTML(m.why)}</p>${isLocal ? `<button class="secondary-button" style="margin-top:10px; font-size:11px;" data-ai-critique="${m.id}">🧠 AI Critique</button>` : ""}<div id="critique-${m.id}" class="mistake-critique hidden" style="margin-top:10px; padding:12px; background:var(--bg-body); border-radius:6px; font-size:12.5px; line-height:1.5; color:var(--ink);"></div></div><button class="icon-delete" data-delete-mistake="${m.id}" title="Delete mistake">×</button></article>`,
        )
        .join("")
    : '<div class="empty-state"><div class="empty-orb">✓</div><h2>No mistakes logged.</h2><p>When one happens, capture the lesson while it is fresh.</p></div>';
}
