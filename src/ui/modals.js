import { $, escapeHTML, toast } from "../utils/helpers.js";
import { currentExam, store, save } from "../core/state.js";
import { uid } from "../utils/helpers.js";
import { iso, addDays } from "../utils/dates.js";
import { templates, isLocal } from "../utils/constants.js";
import { askAI } from "../api/ai.js";
import { createDefaultAvailability } from "../core/planner.js";

/**
 * Opens a modal dialog for creating, editing, or rescheduling a task/session.
 */
export function openModal(type, presetDate = iso(), existingTask = null) {
  const modal = $("#modal"),
    content = $("#modal-content"),
    exam = currentExam();
  let fields = "";
  const topicOptions = exam?.topics
    ? exam.topics.map((topic) => `<option value="${escapeHTML(topic.name)}">`).join("")
    : "";
    
  if (type === "exam")
    fields = `<label class="modal-field">Plan name<input name="name" placeholder="e.g. CFA Level I" required></label><label class="modal-field">Start from a template<select name="template">${Object.keys(templates).map((t) => `<option>${t}</option>`).join("")}</select></label><label class="modal-field">Exam date<input name="examDate" type="date" value="${iso(addDays(new Date(), 90))}" required></label>`;
  if (type === "topic")
    fields = '<label class="modal-field">Topic name<input name="topic" placeholder="e.g. Probability" required></label>';
  if (type === "task")
    fields = `<label class="modal-field">Topic<input name="topic" list="topics" value="${existingTask ? escapeHTML(existingTask.topic) : ""}" required><datalist id="topics">${topicOptions}</datalist></label><label class="modal-field">Type<select name="type">${["Learn", "Practice", "Active recall", "Mock test"].map((option) => `<option ${existingTask?.type === option ? "selected" : ""}>${option}</option>`).join("")}</select></label><label class="modal-field">Date<input name="date" type="date" value="${existingTask?.date || presetDate}" required></label><label class="modal-field">Duration (minutes)<input name="duration" type="number" value="${existingTask?.duration || 60}" min="30" max="480" step="15" required></label>`;
  if (type === "card")
    fields = `<label class="modal-field">Prompt<input name="front" placeholder="Ask one clear recall question" required></label><label class="modal-field">Answer<textarea name="back" required></textarea></label><label class="modal-field">Topic<input name="topic" list="topics" required><datalist id="topics">${topicOptions}</datalist></label>`;
  if (type === "mistake")
    fields = `<label class="modal-field">Topic<input name="topic" list="topics" required><datalist id="topics">${topicOptions}</datalist></label><label class="modal-field">Question / situation<textarea name="question" placeholder="What was the question or error?" required></textarea></label><label class="modal-field">Correct approach<textarea name="correct" required></textarea></label><label class="modal-field">What went wrong?<textarea name="why" placeholder="Capture the misconception or decision that caused it." required></textarea></label>`;
    
  content.innerHTML = `<h2 class="modal-title">${existingTask ? "Edit a study session" : { exam: "Create a study plan", topic: "Add a topic", task: "Add a study session", card: "Create a flashcard", mistake: "Log a learning moment" }[type]}</h2><p class="modal-copy">${type === "mistake" ? "This will also create a review card for the correct approach." : "Keep it lightweight - you can refine it later."}</p><div class="modal-fields">${fields}</div><div class="modal-actions"><button id="modal-cancel" type="button" class="secondary-button">Cancel</button><button type="submit" class="primary-button">${existingTask ? "Update session" : "Save"}</button></div>`;
  modal.dataset.type = type;
  modal.dataset.taskId = existingTask?.id || "";
  modal.showModal();
}

/**
 * Opens a modal to manage (view, add, generate, delete) granular concepts for a specific topic.
 */
export function openConceptsModal(topicId) {
  const exam = currentExam(),
    topic = exam.topics.find((t) => t.id === topicId);
  if (!topic) return;
  topic.concepts = topic.concepts || [];
  const modal = $("#modal"),
    content = $("#modal-content");
    
  const conceptsList = topic.concepts
    .map(
      (c) =>
        `<div class="concept-item"><div><b>${escapeHTML(c.overview)}</b><p>${escapeHTML(c.details)}</p>${c.cardId ? '<span class="pill">Flashcard</span>' : ""}</div><button type="button" class="icon-delete" data-delete-concept="${c.id}" data-topic-id="${topic.id}" title="Delete concept">×</button></div>`,
    )
    .join("");
    
  content.innerHTML = `<h2 class="modal-title">${escapeHTML(topic.name)} Concepts</h2><p class="modal-copy">Key definitions, tricky questions, or notes.</p><div class="concept-list">${conceptsList}</div><div class="modal-fields">${isLocal ? '<button type="button" id="ai-spark-btn" class="secondary-button" style="margin-bottom: 12px; width: 100%;">✨ Spark Concept with AI</button>' : ""}<label class="modal-field">Overview (Prompt)<input name="overview" id="concept-overview" placeholder="e.g. Newton's Second Law" required></label><label class="modal-field" style="margin-top:12px;">Details (Answer)<textarea name="details" id="concept-details" placeholder="F = ma" required></textarea></label><label style="display:flex;align-items:center;gap:8px;font-size:12px;margin:12px 0 16px;"><input type="checkbox" name="makeCard" checked> Turn into a spaced-repetition flashcard</label></div><div class="modal-actions"><button type="button" id="modal-cancel" class="secondary-button">Close</button><button type="submit" class="primary-button">Add concept</button></div>`;
  
  if (isLocal) {
    const aiBtn = $("#ai-spark-btn");
    if (aiBtn) {
      aiBtn.addEventListener("click", async (e) => {
        const btn = e.target;
        btn.textContent = "✨ Generating...";
        btn.disabled = true;
        try {
          const existing = topic.concepts.map((c) => c.overview).join(", ");
          const prompt = `Suggest ONE new, highly testable concept for the topic "${topic.name}". Existing concepts: ${existing || "None"}. Provide a short Overview (the prompt/term) and a detailed but concise Details (the answer/explanation). Format as JSON: {"overview": "...", "details": "..."}`;
          const res = await askAI(
            "You are an expert tutor creating flashcards. Always respond with valid JSON.",
            prompt,
          );
          const jsonStr = res.match(/\{[\s\S]*\}/)?.[0] || res;
          const json = JSON.parse(jsonStr);
          $("#concept-overview").value = json.overview || "";
          $("#concept-details").value = json.details || "";
          toast("AI suggested a concept!");
        } catch (err) {
          toast(`AI Error: ${err.message}`);
        } finally {
          btn.textContent = "✨ Spark Concept with AI";
          btn.disabled = false;
        }
      });
    }
  }
  modal.dataset.type = "concepts";
  modal.dataset.topicId = topic.id;
  modal.showModal();
}

/**
 * Handles the submission event of the general task/session modal.
 */
export function handleModal(form, renderAllCallback) {
  const modal = $("#modal"),
    type = modal.dataset.type,
    data = Object.fromEntries(new FormData(form)),
    exam = currentExam();
    
  if (type === "concepts") {
    const topic = exam.topics.find((t) => t.id === modal.dataset.topicId);
    if (topic) {
      const makeCard = form.elements.makeCard?.checked;
      let cardId = null;
      if (makeCard) {
        cardId = uid();
        exam.cards.push({
          id: cardId,
          front: data.overview,
          back: data.details,
          topic: topic.name,
          due: iso(),
          reviews: 0,
          ease: 2.5,
          interval: 0,
          repetition: 0,
        });
      }
      topic.concepts.push({
        id: uid(),
        overview: data.overview,
        details: data.details,
        cardId,
      });
      save();
      if (renderAllCallback) renderAllCallback();
      toast("Concept saved.");
      openConceptsModal(topic.id);
    }
    return;
  }
  
  if (type === "exam") {
    const template = data.template;
    store.state.exams.push({
      id: uid(),
      name: data.name.trim(),
      template,
      examDate: data.examDate,
      weeklyHours: 8,
      availability: createDefaultAvailability(8),
      topics: templates[template].map((name) => ({
        id: uid(),
        name,
        confidence: 1,
        completed: 0,
      })),
      tasks: [],
      cards: [],
      mistakes: [],
    });
    store.state.activeExamId = store.state.exams.at(-1).id;
    toast("Study plan created.");
  }
  
  if (type === "topic")
    exam.topics.push({
      id: uid(),
      name: data.topic.trim(),
      confidence: 1,
      completed: 0,
    });
    
  if (type === "task") {
    const task = exam.tasks.find((item) => item.id === modal.dataset.taskId);
    if (task) Object.assign(task, { ...data, duration: Number(data.duration) });
    else
      exam.tasks.push({
        id: uid(),
        ...data,
        duration: Number(data.duration),
        done: false,
      });
  }
  
  if (type === "card")
    exam.cards.push({
      id: uid(),
      ...data,
      due: iso(),
      reviews: 0,
      ease: 2.5,
      interval: 0,
      repetition: 0,
    });
    
  if (type === "mistake") {
    const mistake = { id: uid(), ...data, created: iso() };
    exam.mistakes.unshift(mistake);
    exam.cards.push({
      id: uid(),
      front: `Mistake check: ${data.question}`,
      back: data.correct,
      topic: data.topic,
      due: iso(),
      reviews: 0,
      ease: 2.5,
      interval: 0,
      repetition: 0,
      mistakeId: mistake.id,
    });
  }
  
  save();
  modal.close();
  if (renderAllCallback) renderAllCallback();
  if (type !== "exam")
    toast(
      type === "mistake"
        ? "Mistake saved and added to review queue."
        : "Saved.",
    );
}

let ocrPasteHandler = null;

/**
 * Opens the OCR modal for extracting text.
 */
export function openOCRModal() {
  const dialog = $("#ocr-dialog"),
    dropzone = $("#ocr-dropzone"),
    fileInput = $("#ocr-file-input"),
    preview = $("#ocr-preview"),
    prompt = $("#ocr-prompt"),
    progressContainer = $("#ocr-progress-container"),
    progressBar = $("#ocr-progress-bar"),
    status = $("#ocr-status"),
    resultContainer = $("#ocr-result-container"),
    textResult = $("#ocr-text-result"),
    initialActions = $("#ocr-initial-actions");
    
  function reset() {
    preview.classList.add("hidden");
    preview.src = "";
    prompt.classList.remove("hidden");
    progressContainer.classList.add("hidden");
    status.classList.add("hidden");
    resultContainer.classList.add("hidden");
    initialActions.classList.remove("hidden");
    dropzone.style.display = "block";
    textResult.value = "";
    fileInput.value = "";
  }
  
  reset();
  dialog.showModal();
  
  function handleImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.classList.remove("hidden");
    prompt.classList.add("hidden");
    initialActions.classList.add("hidden");
    progressContainer.classList.remove("hidden");
    status.classList.remove("hidden");
    progressBar.style.width = "0%";
    status.textContent = "Initializing OCR...";
    
    // Tesseract is global from CDN
    window.Tesseract.recognize(file, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          progressBar.style.width = `${Math.max(5, m.progress * 100)}%`;
          status.textContent = `Extracting text: ${Math.round(m.progress * 100)}%`;
        } else {
          status.textContent = m.status;
        }
      },
    })
      .then(({ data: { text } }) => {
        progressContainer.classList.add("hidden");
        status.classList.add("hidden");
        dropzone.style.display = "none";
        resultContainer.classList.remove("hidden");
        textResult.value = text.trim();
      })
      .catch((err) => {
        status.textContent = "Error reading image.";
        console.error(err);
      });
  }
  
  dropzone.onclick = () => fileInput.click();
  fileInput.onchange = (e) => handleImage(e.target.files[0]);
  
  dropzone.ondragover = (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  };
  dropzone.ondragleave = () => dropzone.classList.remove("drag-over");
  dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer.files.length) handleImage(e.dataTransfer.files[0]);
  };
  
  if (ocrPasteHandler) document.removeEventListener("paste", ocrPasteHandler);
  ocrPasteHandler = (e) => {
    if (!dialog.open) return;
    const item = [...e.clipboardData.items].find((i) =>
      i.type.startsWith("image/"),
    );
    if (item) handleImage(item.getAsFile());
  };
  document.addEventListener("paste", ocrPasteHandler);
}
