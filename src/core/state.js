import { STORAGE_KEY } from "../utils/constants.js";
import { starterData } from "./planner.js";
import { createDefaultAvailability, availabilityHours } from "./planner.js";
import { toast } from "../utils/helpers.js";
import { supabaseClient } from "./auth.js";

export const store = {
  state: null,
  currentUser: null,
  timerMode: "focus",
  timerRemaining: 0,
  timerInterval: null,
};

let saveTimeout = null;

export function initializeState() {
  try {
    store.state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || starterData();
  } catch {
    store.state = starterData();
  }
  if (!store.state.ai)
    store.state.ai = {
      provider: "gemini",
      keys: { gemini: "", openai: "", claude: "" },
    };
    
  store.state.exams.forEach((exam) =>
    exam.mistakes.forEach((mistake) => {
      const linkedCard = exam.cards.find(
        (card) =>
          card.mistakeId === mistake.id ||
          card.front === `Mistake check: ${mistake.question}`,
      );
      if (linkedCard) linkedCard.mistakeId = mistake.id;
    }),
  );
  
  store.state.exams.forEach((exam) => {
    delete exam.sessionLength;
  });
  
  store.state.exams.forEach((exam) => {
    exam.cards.forEach((c) => {
      if (c.ease === undefined) {
        c.ease = 2.5;
        c.repetition = c.streak || 0;
        c.interval = c.repetition > 0 ? (c.repetition === 1 ? 1 : 6) : 0;
        delete c.streak;
      }
    });
  });
  
  store.state.exams.forEach((exam) => {
    if (!exam.availability)
      exam.availability = createDefaultAvailability(exam.weeklyHours);
    exam.weeklyHours = availabilityHours(exam);
  });
  
  store.state.timer ||= { focus: 25, break: 5 };
  store.timerRemaining = store.state.timer.focus * 60;
}

export function currentExam() {
  return store.state.exams.find((x) => x.id === store.state.activeExamId) || store.state.exams[0];
}

export function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store.state));
  if (store.currentUser) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const cloudState = JSON.parse(JSON.stringify(store.state));
      cloudState.ai.keys = { gemini: "", openai: "", claude: "" };
      supabaseClient
        .from("study_data")
        .upsert({ id: store.currentUser.id, state: cloudState })
        .then(({ error }) => {
          if (error) {
            console.error("Supabase Sync Error:", error);
            toast("Cloud sync failed. Check console for details.");
          }
        });
    }, 1500);
  }
}

export async function loadFromCloud(renderAllCallback) {
  if (!store.currentUser) return;
  const { data, error } = await supabaseClient
    .from("study_data")
    .select("state")
    .eq("id", store.currentUser.id)
    .maybeSingle();
    
  if (data?.state && Object.keys(data.state).length) {
    const localKeys = store.state.ai?.keys || { gemini: "", openai: "", claude: "" };
    store.state = data.state;
    if (!store.state.ai) store.state.ai = { provider: "gemini", keys: localKeys };
    else store.state.ai.keys = localKeys;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store.state));
    
    store.state.exams.forEach((exam) =>
      exam.mistakes.forEach((mistake) => {
        const linkedCard = exam.cards.find(
          (card) =>
            card.mistakeId === mistake.id ||
            card.front === `Mistake check: ${mistake.question}`,
        );
        if (linkedCard) linkedCard.mistakeId = mistake.id;
      }),
    );
    store.state.exams.forEach((exam) => {
      exam.cards.forEach((c) => {
        if (c.ease === undefined) {
          c.ease = 2.5;
          c.repetition = c.streak || 0;
          c.interval = c.repetition > 0 ? (c.repetition === 1 ? 1 : 6) : 0;
          delete c.streak;
        }
      });
    });
    store.state.exams.forEach((exam) => {
      if (!exam.availability)
        exam.availability = createDefaultAvailability(exam.weeklyHours);
      exam.weeklyHours = availabilityHours(exam);
    });
    store.state.timer ||= { focus: 25, break: 5 };
  } else {
    supabaseClient
      .from("study_data")
      .upsert({ id: store.currentUser.id, state: store.state })
      .then(({ error }) => {
        if (error) {
          console.error("Initial Supabase Sync Error:", error);
          toast("Initial cloud sync failed. Check console for details.");
        }
      });
  }
  if (renderAllCallback) renderAllCallback();
}
