# Estudio

A calm, local-first study planner built around active recall, spaced repetition, and error-driven practice.

## Run it

Open `index.html` in a modern browser. There is no build step or dependency install.

All sample data and changes are stored only in the browser's `localStorage`. Clearing site storage resets the app.

## What is implemented

- Separate, switchable study plans for parallel exams
- Templates for CAT, GMAT, GATE Chemical, CFA Levels I–III, and System Design
- Exam countdown and availability-based, editable 14-day schedule generator
- Topics with a confidence signal, manual sessions, and completion logging
- Flashcards with active-recall prompts and simple spaced-repetition intervals
- Mistake book that turns each logged error into a review card
- Review queue, seven-day rhythm view, progress signals, and four colour themes
- Drag-and-drop to move sessions between days in the plan view
- Pomodoro timer with optional session linking (auto-marks task done on focus completion)
- Missed-session flow: overdue tasks surface with reschedule / done / skip controls

## Schedule generation algorithm

The 14-day schedule generator uses a **confidence-weighted pool** to allocate study time:

- Each topic enters the pool with `max(1, 5 − confidence)` entries (confidence 1 → 4 slots, confidence 4 → 1 slot). This means weak topics naturally appear ~4× more than strong ones.
- Available minutes per day are split into 1–4 sessions: ≤2h → 1 topic, 2–4h → 2, 4–6h → 3, 6–8h → 4.
- **Consecutive-day avoidance**: topics scheduled today are excluded from tomorrow's candidate pool when possible, preventing monotonous back-to-back repetition.
- **Per-topic type cycling**: each topic independently cycles through Learn → Practice → Active recall across the 14-day window.
- A confirmation dialog appears before overwriting existing manually-edited sessions.

## Product choices

The planner deliberately favours a short daily review queue plus a small number of focused sessions over exhaustive time-blocking. Confidence is intentionally a lightweight self-report: it gives the schedule a useful direction without asking for elaborate scoring. The mistake book captures the reason for an error, because a correct answer alone rarely fixes a recurring misconception.

- **Supabase Cloud Sync & Auth:** Replaced standard `localStorage` with a live Supabase backend. Includes secure Email/Password and Google OAuth login, with seamless local offline fallback.
- **AI Copilot (Bring-Your-Own-Key):** Secure, local-only storage of API keys (Gemini, OpenAI, Claude) to power smart study generation.
  - **Flashcard Spark:** AI instantly generates missing, highly-testable concepts based on your topic.
  - **Mistake Book Critique:** AI provides a 2-sentence encouraging critique to help you avoid specific cognitive traps in the future.
- **OCR Integration:** Upload or paste images of exam papers to extract text and instantly spin up a flashcard or mistake entry.
- **Concept Glossary:** Each topic has a dedicated "Important concepts" area for definitions, formulas, and notes.

## Next production milestones

1. Replace the current fixed review intervals with an FSRS/SM-2 style scheduler, including per-card difficulty and retention targets.
2. Add calendar synchronization, notifications, data export, and accessibility/keyboard-test coverage.
