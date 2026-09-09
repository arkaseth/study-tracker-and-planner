# System Design — Estudio

> A deep-dive into the architecture, module boundaries, data model, and design patterns used in the Estudio study planner.

---

## Table of contents

1. [High-level architecture](#1-high-level-architecture)
2. [Module map](#2-module-map)
3. [Data model](#3-data-model)
4. [State management](#4-state-management)
5. [Design patterns](#5-design-patterns)
6. [Rendering pipeline](#6-rendering-pipeline)
7. [Cloud sync strategy](#7-cloud-sync-strategy)
8. [AI Copilot subsystem](#8-ai-copilot-subsystem)
9. [Spaced repetition engine](#9-spaced-repetition-engine)
10. [Schedule generation algorithm](#10-schedule-generation-algorithm)
11. [Security model](#11-security-model)
12. [CI/CD pipeline](#12-cicd-pipeline)

---

## 1. High-level architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Preact UI Layer                       │ │
│  │  App → Dashboard / Plan / Review / Mistakes / Flashcard │ │
│  │  Modals (Auth, Settings, Form, Confirm, OCR, Concepts)  │ │
│  └──────────────────┬──────────────────┬────────────────── ┘ │
│                     │ reads/writes      │ CustomEvents        │
│  ┌──────────────────▼──────────────────▼────────────────── ┐ │
│  │                   Core Layer                            │ │
│  │  state.js (signals) · planner.js · review.js · auth.js  │ │
│  └──────────────────┬──────────────────────────────────────┘ │
│                     │                                         │
│  ┌──────────────────▼──────────────────────────────────────┐ │
│  │               Persistence Layer                         │ │
│  │  localStorage (primary) ←→ Supabase (cloud mirror)      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                External APIs (optional)                 │ │
│  │  Gemini API · OpenAI API · Anthropic Claude API         │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

The application is a **single-page app (SPA)** with no server-side rendering. All logic runs in the browser. Supabase is used only for auth and data persistence — the UI never waits on network for reads.

---

## 2. Module map

```
src/
├── main.jsx              Entry: mounts <App />, calls initializeState()
│
├── api/
│   └── ai.js             AI provider router: Gemini / OpenAI / Claude
│
├── core/
│   ├── auth.js           Supabase client init, auth state listener, cloud sync
│   ├── planner.js        Schedule generation, starter data, planner utilities
│   ├── review.js         SM-2 spaced repetition interval calculator
│   └── state.js          Global store (signals), initializeState, save, currentExam
│
├── ui/
│   ├── App.jsx           Root: nav, theme switching, event listeners, router
│   ├── Dashboard.jsx     Overview: stats, due cards, overdue tasks, quick actions
│   ├── Flashcard.jsx     Active recall review session UI
│   ├── Mistakes.jsx      Mistake book list + add flow
│   ├── Modals.jsx        All dialog modals (auth, settings, form, confirm, OCR, concepts)
│   ├── Plan.jsx          14-day schedule, drag-and-drop, session controls
│   ├── Review.jsx        Topic confidence grid + card browser
│   └── Timer.jsx         Pomodoro timer component
│
└── utils/
    ├── constants.js      Exam templates, STORAGE_KEY, CUSTOM_TEMPLATE sentinel, isLocal
    ├── dates.js           Pure date utilities: iso, addDays, daysBetween, formatDate
    └── helpers.js         uid, toast, escapeHTML, appConfirm proxy
```

### Dependency rules (enforced by convention)

```
ui/* → core/* → utils/*
ui/* → utils/*
api/* → utils/*         (no dependency on core or ui)
core/state.js → core/auth.js, core/planner.js
```

`utils` modules are pure functions with zero side effects and no browser API calls. `core` modules may access browser APIs (`localStorage`, `window`) but not the DOM. `ui` modules own the DOM.

---

## 3. Data model

All application state lives under a single JSON object persisted to `localStorage[STORAGE_KEY]` and mirrored to Supabase.

```ts
interface AppState {
  theme: 'night' | 'dusk' | 'dawn' | 'light';
  activeExamId: string;
  tutorialCompleted: boolean;
  ai: {
    provider: 'gemini' | 'openai' | 'claude';
    keys: { gemini: string; openai: string; claude: string };  // local only, scrubbed on export
  };
  timer: { focus: number; break: number };   // minutes
  exams: Exam[];
}

interface Exam {
  id: string;
  name: string;
  template: string;
  examDate: string;       // ISO date "YYYY-MM-DD"
  weeklyHours: number;
  availability: { [day: 0..6]: { hours: number; active: boolean } };
  topics: Topic[];
  tasks: Task[];
  cards: Card[];
  mistakes: Mistake[];
}

interface Topic {
  id: string;
  name: string;
  confidence: 1 | 2 | 3 | 4;   // self-reported; drives schedule weighting
  completed: number;             // count of done sessions
  concepts?: Concept[];
}

interface Task {
  id: string;
  date: string;            // ISO date
  topic: string;           // topic name (denormalised for display speed)
  type: 'Learn' | 'Practice' | 'Active recall' | 'Mock test';
  duration: number;        // minutes
  done: boolean;
  pomodoroLinked?: string; // task id auto-marked done by timer
}

interface Card {
  id: string;
  front: string;
  back: string;
  topic: string;
  due: string;             // ISO date — SM-2 next review date
  ease: number;            // SM-2 ease factor, starts at 2.5
  interval: number;        // SM-2 interval in days
  repetition: number;      // SM-2 repetition count
  reviews: number;         // total times reviewed
}

interface Mistake {
  id: string;
  topic: string;
  question: string;
  correct: string;
  why: string;
  created: string;         // ISO date
}

interface Concept {
  id: string;
  term: string;
  definition: string;
  tag?: string;
}
```

### Key design choices

- **Denormalised topic name on Task/Card/Mistake** — avoids joins and keeps reads O(1) for display.
- **AI keys stored locally, never in cloud** — `save()` writes keys to `localStorage`; `syncToCloud()` strips them from the payload.
- **Single flat array of exams** — simple to serialise; no relational overhead for the expected dataset size (< 5 exams, < 1000 cards).

---

## 4. State management

### Signal-based reactive store

```
@preact/signals
    └── storeRev: signal(0)          ← single reactive token
         └── incremented on every save()
              └── consumed by all Preact components
                   └── triggers re-render of the subtree that reads it
```

`store.state` is a plain JavaScript object — **not** a signal itself. Granular per-field signals were intentionally avoided to keep the state shape identical to its serialised JSON form and to avoid signal boilerplate on every property.

Components bind to `storeRev.value` at their top level. When `save()` is called (from any mutation site), `storeRev` is incremented, all subscribed components re-render, and they read fresh data directly from `store.state`.

```js
// Pattern used in every component
export function Plan() {
  const rev = storeRev.value;   // creates the reactive subscription
  const exam = currentExam();   // pure read from store.state
  // ...
}
```

### Why not Redux / Zustand / Jotai?

The app is deliberately dependency-light. `@preact/signals` is already a peer dependency of Preact; using it for state avoids an additional runtime dependency and keeps the bundle small.

---

## 5. Design patterns

### 5.1 Singleton Store + Command pattern

`store` is a module-level singleton. All mutations follow an implicit command pattern:

1. **Mutate** `store.state` directly (imperative, readable)
2. **Call `save()`** — this persists to `localStorage`, queues a cloud sync, and increments `storeRev`

No action creators, no reducers. The simplicity is intentional: the dataset is small, history/undo is not a requirement, and the code stays readable without boilerplate.

### 5.2 Event bus via CustomEvents

Cross-component communication (e.g., opening a modal from a nav button) uses the browser's native `CustomEvent` API on `document`:

```js
// Emitter (anywhere in the app)
document.dispatchEvent(new CustomEvent('openSettings'));

// Listener (in Modals.jsx via useEffect)
document.addEventListener('openSettings', () => setActiveModal('settings'));
```

This avoids prop-drilling and keeps components decoupled without adding a pub/sub library. The event names are the de-facto API contract between the nav/header and the modal layer.

### 5.3 Proxy pattern for confirm dialogs

`window.appConfirm` is a Promise-based proxy set by `Modals.jsx` at mount time:

```js
// Set by Modals.jsx (owns the actual <dialog>)
window.appConfirm = (title, message) => new Promise(resolve => {
  confirmResolve = resolve;
  document.dispatchEvent(new CustomEvent('openConfirm', { detail: { title, message } }));
});

// Called from anywhere (helpers.js re-exports it)
export const appConfirm = (t, m) => window.appConfirm(t, m);
```

This pattern lets legacy utility code (`helpers.js`, `planner.js`) trigger a Preact-managed modal without any direct DOM coupling. The `window` global acts as the injection point.

### 5.4 Local-first with optimistic sync

```
User action
    │
    ▼
Mutate store.state     ← synchronous, instant
    │
    ▼
save()
    ├── localStorage.setItem(...)    ← synchronous, always succeeds
    ├── storeRev.value++             ← triggers re-render
    └── syncToCloud()                ← async, fire-and-forget
             │
             ├── if online + logged in → Supabase upsert
             └── if offline or error  → silently ignored (data safe in localStorage)
```

The UI never `await`s the cloud sync. The user sees their change immediately; consistency is eventual.

### 5.5 Compound component pattern (Modals)

All modals live in a single `<Modals />` component that owns:

- One `activeModal` state string (`'auth' | 'settings' | 'form' | 'confirm' | ...`)
- One `<dialog>` ref per modal
- A shared `closeModals()` handler

Sub-modals that need their own state (e.g., `SettingsAIFields`, `ExamTemplateField`) are extracted as private sub-components within the same file, keeping the public API (`<Modals />`) simple while letting internal logic stay collocated.

### 5.6 Strategy pattern (AI provider routing)

`ai.js` implements a strategy pattern for the three supported LLM providers:

```js
const STRATEGIES = {
  gemini: callGemini,
  openai: callOpenAI,
  claude: callClaude,
};

export async function askAI(prompt) {
  const strategy = STRATEGIES[store.state.ai.provider] ?? STRATEGIES.gemini;
  return strategy(prompt, store.state.ai.keys[store.state.ai.provider]);
}
```

Adding a new provider requires only: adding a key slot to the state shape, writing a `callProvider()` function, and registering it in `STRATEGIES`.

### 5.7 Template Method pattern (schedule generation)

`generateSchedule()` in `planner.js` follows a fixed algorithm skeleton with customisable steps:

1. **Build candidate pool** (weighted by topic confidence)
2. **For each day** in the 14-day window:
   a. Filter available minutes from `availability`
   b. Apply consecutive-day exclusion
   c. Select topics from pool
   d. Assign session type by cycling through the topic's type index
   e. Emit `Task` objects

Each step is a pure function that can be tested and replaced independently.

---

## 6. Rendering pipeline

```
initializeState()           (main.jsx, runs once on app load)
       │
       ▼
storeRev.value = 1          (incremented to trigger initial render)
       │
       ▼
<App />                     (subscribes to storeRev)
   ├── <nav> / <header>
   ├── {page === 'dashboard'} → <Dashboard />
   ├── {page === 'plan'}      → <Plan />
   ├── {page === 'review'}    → <Review />
   ├── {page === 'mistakes'}  → <Mistakes />
   ├── {page === 'flashcard'} → <Flashcard />
   ├── {page === 'timer'}     → <Timer />
   └── <Modals />             (always mounted; controls dialog open/close)
```

Navigation is hash-based (`location.hash = '#plan'`). `App.jsx` reads `location.hash` to determine the current page. There is no client-side router library.

---

## 7. Cloud sync strategy

```
Supabase table: user_data
┌────────────────────────────────────────────────────────┐
│ user_id (uuid, FK → auth.users) │ data (jsonb)         │
│ PRIMARY KEY (user_id)           │ updated_at (timestamptz) │
└────────────────────────────────────────────────────────┘
```

- **One row per user** — the entire `AppState` object is stored as a single JSONB column.
- **Upsert on save** — `syncToCloud()` calls `supabase.from('user_data').upsert(...)`. No merge conflicts; last-write wins.
- **Pull on login** — `setupAuthListeners()` fetches the cloud row on `SIGNED_IN` and merges it with local state, **preserving local AI keys**.
- **Row-Level Security** — each user can only read and write their own row (`user_id = auth.uid()`).

### Merge strategy on login

```js
// Simplified from auth.js
const { data } = await supabase.from('user_data')
  .select('data').eq('user_id', userId).maybeSingle();

if (data) {
  const localKeys = store.state.ai?.keys;   // preserve local-only keys
  store.state = { ...data.data, ai: { ...data.data.ai, keys: localKeys } };
  save();
}
```

---

## 8. AI Copilot subsystem

```
User triggers "Generate flashcards" / "Critique answer"
       │
       ▼
askAI(prompt)             ← src/api/ai.js
       │
       ├── reads store.state.ai.provider
       ├── reads store.state.ai.keys[provider]
       └── dispatches to provider strategy
              │
              ├── Gemini:  POST https://generativelanguage.googleapis.com/v1beta/...
              ├── OpenAI:  POST https://api.openai.com/v1/chat/completions
              └── Claude:  POST https://api.anthropic.com/v1/messages
```

- All requests are direct browser-to-API calls. No proxy server.
- Keys **never leave the device** via the app's own infrastructure.
- The Copilot is disabled when `isLocal === false` (non-localhost hostname) to prevent accidental key exposure on shared/public deployments.

---

## 9. Spaced repetition engine

Implementation: `src/core/review.js` — a faithful subset of the **SM-2 algorithm**.

```
Input:  card { ease, repetition, interval }
Output: { again: 0, hard: n, good: n, easy: n }  (days until next review)
```

| Grade | Repetition 0 | Repetition 1 | Repetition ≥ 2 |
|---|---|---|---|
| **again** | 0 | 0 | 0 |
| **hard** | 1 | max(1, interval × 1.2) | max(1, interval × 1.2) |
| **good** | 1 | 6 | round(interval × ease) |
| **easy** | 4 | 6 | round(interval × ease × 1.3) |

**Ease** starts at 2.5 and adjusts on each review (not yet implemented — uses fixed 2.5 default). The interval for *again* resets to 0 (show again today). Cards are sorted by due date ascending, with streak as a tiebreaker.

---

## 10. Schedule generation algorithm

See the README for the user-facing summary. Implementation detail:

```js
// Confidence-weighted pool construction
topics.forEach(topic => {
  const weight = Math.max(1, 5 - topic.confidence);  // 1–4 entries
  for (let i = 0; i < weight; i++) pool.push(topic);
});

// Per-day loop
for (const date of next14Days) {
  const availableMinutes = minutesAvailableOn(exam, date);
  if (!availableMinutes) continue;

  // Consecutive-day exclusion
  const yesterdayTopics = new Set(tasksOnDate(tasks, yesterday).map(t => t.topic));
  const candidates = pool.filter(t => !yesterdayTopics.has(t.name) || pool.length <= yesterdayTopics.size);

  // Session-count from available hours
  const sessionCount = availableMinutes <= 120 ? 1 : availableMinutes <= 240 ? 2 : availableMinutes <= 360 ? 3 : 4;

  // Pick topics (deduplicated within a day) and assign types
  const picked = pickUnique(candidates, sessionCount);
  picked.forEach(topic => {
    const typeIndex = topicTypeIndex.get(topic.id) ?? 0;
    tasks.push({ topic: topic.name, type: TYPES[typeIndex % 3], date, ... });
    topicTypeIndex.set(topic.id, typeIndex + 1);
  });
}
```

---

## 11. Security model

| Concern | Approach |
|---|---|
| AI keys | Stored in `localStorage` only; scrubbed before JSON export and before cloud sync |
| Cloud data | Protected by Supabase Row-Level Security (`user_id = auth.uid()`) |
| XSS | All user-generated content passed through `escapeHTML()` before DOM insertion |
| Copilot on public domains | `isLocal` guard disables all AI calls when `hostname !== localhost` |
| Password auth | Delegated entirely to Supabase Auth (bcrypt + JWT) |

---

## 12. CI/CD pipeline

```yaml
# .github/workflows/ci.yml
on: push / pull_request → main

jobs:
  test:   install → vitest run --coverage → upload coverage artifact
  build:  (needs: test) → vite build → upload dist artifact
```

The **build job is gated on tests passing**. A broken test blocks the dist artifact from being produced. Netlify triggers its own deploy from the `main` branch independently; the CI workflow gives a pre-deploy quality gate on every PR.

See [TESTS.md](TESTS.md) for the full test inventory.
