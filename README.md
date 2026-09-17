<div align="center">

# Studia

**A calm, local-first study planner built around active recall, spaced repetition, and error-driven practice.**

[![CI](https://github.com/arkaseth/study-tracker-and-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/arkaseth/study-tracker-and-planner/actions/workflows/ci.yml)

[Live App](https://estudio.netlify.app) · [System Design](docs/SYSTEM_DESIGN.md) · [Test Coverage](docs/TESTS.md)

</div>

---

## Overview

Studia is a personal study-planning tool that puts cognitive science before complexity. The core loop is simple:

1. **Plan** — generate a confidence-weighted 14-day schedule from your exam template
2. **Study** — work sessions with a built-in Pomodoro timer
3. **Review** — flashcards served by SM-2 spaced repetition
4. **Reflect** — log mistakes; each one becomes a review card automatically

Data lives in your browser first. Optional Supabase cloud sync keeps devices in step without requiring an account.

---

## Features

| Area | What's included |
|---|---|
| **Study Plans** | Multiple parallel exams, editable & switchable at any time |
| **Templates** | CAT, CFA I–III, GATE Chemical, GMAT, GRE, JEE Main+Advanced, System Design — or import a custom JSON template |
| **Schedule Generator** | Confidence-weighted, 14-day rolling schedule with consecutive-day avoidance and session-type cycling |
| **Mock Scheduler** | Proximity-based mock test ramp-up (`<= 2 months`); dynamically allocates Sectional & Full Mocks on high-capacity study days |
| **Flashcards** | SM-2 spaced repetition with dynamic ease/interval/repetition tracking, plus in-library edit and delete management |
| **Mistake Book** | Every logged error auto-creates a review card with root-cause capture; one-click logging from completed mock sessions |
| **Concept Glossary** | Per-topic notes, definitions, and formulas |
| **AI Copilot** | Bring-your-own-key (Gemini / OpenAI / Claude) for card generation and answer critique |
| **OCR** | Client-side Tesseract.js to extract questions from textbook photos and past exam screenshots |
| **PWA & Offline** | Fully installable Progressive Web App with Workbox service worker precaching, modern squircle adaptive icons, and offline state detection |
| **Pomodoro Timer** | Configurable focus/break lengths; auto-marks linked sessions done |
| **Overdue Flow** | Missed sessions surface with reschedule / done / skip controls |
| **Drag-and-drop** | Reorder sessions between days in the Plan view |
| **Cloud Sync** | Google OAuth + Email/Password auth via Supabase; full offline-first |
| **4 Themes** | Night, Light, Ink, Lavender |
| **Data Portability** | JSON export/import, ICS calendar export |

---

## Getting started

### Prerequisites

- Node.js 18+ and npm

### Development

```bash
git clone https://github.com/arkaseth/study-tracker-and-planner.git
cd study-tracker-and-planner
npm install
npm run dev          # starts Vite dev server at http://localhost:5173
```

### Production build

```bash
npm run build        # outputs to dist/
npm run preview      # locally preview the production build
```

### Deploy

The app is configured for Netlify out of the box (`netlify.toml` included). Connect the repository in the Netlify dashboard and set build command `npm run build` with publish directory `dist`.

---

## Testing

```bash
npm test                  # run all 81 tests once
npm run test:watch        # watch mode
npm run test:coverage     # run with v8 coverage report
```

See [docs/TESTS.md](docs/TESTS.md) for the full test inventory.

---

## Custom exam template

If none of the built-in templates fit, create a `topics.json` file:

```json
[
  "Topic name 1",
  "Topic name 2",
  "Topic name 3"
]
```

Then in **Create a study plan → Template → ✦ Custom (import JSON)…**, pick the file. The ⓘ button in the form shows this schema inline.

---

## Schedule generation algorithm

The 14-day rolling generator balances topic coverage, confidence weighting, and proximity-based mock exam simulation:

- **Confidence-Weighted Pool**: Each topic enters the pool with `max(1, 5 − confidence)` slots. Topics at confidence 1 appear ~4× more frequently than topics at confidence 4.
- **Dynamic Proximity Mock Cadence**:
  - **Early Foundation (`> 60 days`)**: 1 Sectional Mock per 14-day window.
  - **Transition Cadence (`31 – 60 days`)**: 1 Full Mock + 2 Sectional Mocks per 14-day window.
  - **High Cadence (`15 – 30 days`)**: 2 Full Mocks + 1 Sectional Mock per 14-day window.
  - **Peak Simulation (`4 – 14 days`)**: 3 Full Mocks + 1 Sectional Mock per 14-day window.
  - **Taper Freeze (`<= 3 days`)**: 0 heavy mocks; focus solely on light recall and Mistake Book consolidation.
- **Constraint-Satisfaction Slotting**:
  - Full Mocks require ≥ 90 minutes of available study time and maintain a minimum 3-day recovery separation.
  - Sectional Mocks automatically target the student's lowest-confidence topics.
- **Consecutive-day avoidance**: Topics from today's sessions are excluded from tomorrow's candidate pool where possible to avoid cognitive fatigue.
- **Session-type cycling**: Topics independently cycle through *Learn → Practice → Active recall*.
- Confirmation dialog safeguards protect manually-edited or dragged sessions from accidental overwrite.

---

## AI Copilot

Keys are stored in `localStorage` only — they are never sent to the server, never included in cloud sync, and scrubbed before JSON export. Supported providers:

| Provider | Model used |
|---|---|
| Google Gemini | `gemini-2.0-flash` (default) |
| OpenAI | `gpt-4o-mini` |
| Anthropic Claude | `claude-sonnet-4-5` |

The Copilot is intentionally disabled on public hostnames as a security measure. Run locally (or self-host) to use it.

---

## Project structure

```
estudio/
├── src/
│   ├── api/          # AI provider adapters (ai.js)
│   ├── core/         # State, auth, planner, SM-2 review logic
│   ├── ui/           # Preact components (App, Dashboard, Plan, Review, …)
│   ├── utils/        # Pure helpers: dates, constants, helpers
│   └── test/         # Vitest test suite
├── .github/
│   └── workflows/
│       └── ci.yml    # CI pipeline (test + build)
├── styles.css         # Design system & component styles
├── styles-extra.css   # Feature-specific style extensions
├── timer.css          # Pomodoro timer styles
├── index.html         # Entry point
└── vite.config.js     # Vite + Vitest configuration
```

---

## Design decisions

- **Local-first**: all reads/writes hit `localStorage` synchronously. Supabase sync is fire-and-forget, never on the critical path.
- **No build-time state**: reactive state lives in `@preact/signals`. A single `storeRev` signal triggers re-renders; components never reach into the DOM.
- **Bring-your-own-key AI**: zero server costs, zero key-storage liability.
- **Confidence as a lightweight signal**: avoids complex scoring; the mistake book provides the depth where it matters.

See [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) for the full architecture breakdown.

---

## Roadmap

- [x] Progressive Web App (PWA) installable offline mode with modern WebAPK standards & squircle icons
- [x] Mock exams scheduler with proximity-based ramp-up (`<= 2 months`)
- [x] In-library flashcard editing and deletion management
- [ ] Calendar sync (Google Calendar / Apple Calendar push)
- [ ] Browser notifications for due reviews and session reminders
- [ ] Keyboard navigation and accessibility audit
- [ ] Analytics dashboard (study streaks, topic velocity charts)
