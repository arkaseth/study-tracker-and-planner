# Test Coverage — Estudio

> Full inventory of the Vitest test suite: what is tested, why, and how to run it.

---

## Quick start

```bash
npm test                  # run all 72 tests once (CI mode)
npm run test:watch        # interactive watch mode during development
npm run test:coverage     # run with v8 coverage report → ./coverage/
```

---

## Test stack

| Tool | Role |
|---|---|
| **Vitest 5** | Test runner, assertion library, coverage orchestrator |
| **jsdom** | Browser environment simulation (DOM, localStorage, CustomEvent) |
| **@testing-library/preact** | Component rendering and querying utilities |
| **@testing-library/jest-dom** | Extended DOM matchers (`toHaveClass`, `toBeInTheDocument`, …) |
| **@vitest/coverage-v8** | V8-native line/branch/function coverage |

Configuration lives in `vite.config.js` under the `test` key. The setup file is `src/test/setup.js`.

---

## Setup file (`src/test/setup.js`)

Runs before every test file. Provides:

| Stub | Reason |
|---|---|
| `window.location` override | `constants.js` reads `window.location.hostname` at module evaluation time; jsdom's default value would make `isLocal` return `false` |
| `window.supabase` stub | `auth.js` calls `window.supabase.createClient()` at module evaluation time; stub returns a no-op client that never hits the network |
| `@testing-library/jest-dom` matchers | Adds DOM-aware matchers to Vitest's `expect` |

> `localStorage` is **not** stubbed — jsdom provides a real, working `localStorage` implementation.

---

## Test files

### `src/test/dates.test.js` — 9 tests

Tests the pure date utility functions in `src/utils/dates.js`.

| Test | What it verifies |
|---|---|
| `iso()` returns a `YYYY-MM-DD` string | Output format matches the ISO date pattern |
| `iso()` defaults to today | No-argument call returns today's date (±1 day tolerance for timezone edge cases) |
| `addDays()` adds positive days | `Jan 1 + 5 = Jan 6` |
| `addDays()` adds negative days | `Jan 10 − 3 = Jan 7` |
| `addDays()` crosses month boundaries | `Jan 29 + 5 = Feb 3` |
| `daysBetween()` returns positive difference | `Jan 1 → Jan 10 = 9 days` |
| `daysBetween()` same date returns 0 | Identity case |
| `daysBetween()` end before start returns 0 | Clamped to 0, never negative |
| `formatDate()` returns a non-empty string | Smoke test for `Intl.DateTimeFormat` output |

**Why these tests?** Date arithmetic is the foundation of the schedule generator and review queue. Off-by-one errors here silently corrupt the entire planner.

---

### `src/test/review.test.js` — 12 tests

Tests the SM-2 spaced repetition calculator in `src/core/review.js`.

| Test group | Tests | What's verified |
|---|---|---|
| **`again` grade** | 2 | Always returns 0 days — new card and mature card |
| **New card (rep=0)** | 3 | `hard=1`, `good=1`, `easy=4` |
| **Second rep (rep=1)** | 3 | `hard≥1`, `good=6`, `easy=6` |
| **Mature card (rep=5, interval=20)** | 4 | `good = round(20 × 2.5)`, `easy > good`, `hard < good`, all non-negative integers |
| **Default ease fallback** | 1 | Missing `ease` property defaults to 2.5 without throwing |

**Why these tests?** The SM-2 logic drives the entire flashcard review queue. A regression here would cause cards to surface too early or never again.

---

### `src/test/constants.test.js` — 11 tests

Tests the template registry and sentinel values in `src/utils/constants.js`.

| Test | What it verifies |
|---|---|
| At least 9 built-in templates | Count guard — adding templates doesn't accidentally remove existing ones |
| Every template has ≥ 1 topic | No empty template arrays |
| Every topic is a non-empty string | No null/undefined/empty entries from typos |
| Contains `JEE Main+Advanced` | Regression guard for the newly added template |
| Contains `GRE` | Regression guard for the newly added template |
| Templates are sorted alphabetically | Ensures the dropdown always presents a consistent, sorted order |
| `CUSTOM_TEMPLATE` is a non-empty string | Sentinel is well-formed |
| `CUSTOM_TEMPLATE` not in template keys | Sentinel doesn't collide with a real template name |
| `weekdayNames` has exactly 7 entries | Array length guard |
| `weekdayNames[0]` is Sunday | Correct week start (0-indexed to match `Date.getDay()`) |
| `weekdayNames[6]` is Saturday | Correct week end |

**Why these tests?** Template data drives the exam creation modal and the starter data. Silent corruption (missing topics, wrong order) would make the UX confusing without throwing an error.

---

### `src/test/helpers.test.js` — 12 tests

Tests the utility functions in `src/utils/helpers.js`.

#### `uid()` — 2 tests

| Test | What it verifies |
|---|---|
| Returns a non-empty string | Basic type safety |
| Generates unique values (100 samples) | Statistical uniqueness guarantee |

#### `escapeHTML()` — 7 tests

| Test | Character escaped |
|---|---|
| `&` → `&amp;` | Ampersand |
| `<` → `&lt;` | Open tag |
| `>` → `&gt;` | Close tag |
| `"` → `&quot;` | Double quote |
| `'` → `&#39;` | Single quote |
| Plain text unchanged | No false positives |
| Non-string coerced via `String()` | Number input doesn't throw |

**Why `escapeHTML`?** All user-generated content (mistake text, flashcard content, topic names) is rendered via `innerHTML` in some paths. Missing even one escape character creates a stored XSS vector.

#### `toast()` — 3 tests

| Test | What it verifies |
|---|---|
| Sets `#toast` `textContent` | Message is applied to the DOM element |
| Adds `show` class | CSS animation is triggered |
| No throw when `#toast` absent | Defensive; toast shouldn't crash the app if the element is missing |

---

### `src/test/planner.test.js` — 16 tests

Tests the planner utility functions in `src/core/planner.js`.

#### `createDefaultAvailability()` — 4 tests

| Test | What it verifies |
|---|---|
| Returns 7 day entries (0–6) | Shape is correct for all 7 weekdays |
| Total active hours = requested hours | 6h requested → 6h active across the week |
| Sunday (day 0) is inactive by default | Rest day convention |
| `0` input defaults to 8h (falsy guard) | The function treats 0 as "not specified" and falls back to 8h — documents the actual behaviour |

#### `availabilityHours()` — 2 tests

Verifies only active days are summed, and `undefined` availability returns 0.

#### `minutesAvailableOn()` — 2 tests

Verifies an active day returns `hours × 60`, and an inactive day returns 0.

#### `getDueCards()` — 2 tests

Verifies cards due today or earlier are included; future cards are excluded.

#### `sessionsCompleted()` — 2 tests

Verifies only `done: true` tasks are counted; empty task list returns 0.

#### `taskHours()` — 2 tests

Verifies only done tasks on the queried date contribute; undone and different-date tasks are excluded.

#### `getOverdueTasks()` — 2 tests

Verifies past undone tasks are returned; done tasks and today's tasks are excluded.

**Why these tests?** The overdue flow, dashboard stats, and schedule generator all call these functions. A silent bug in `getOverdueTasks` would cause overdue sessions to never surface.

---

### `src/test/state.test.js` — 12 tests

Integration tests for `src/core/state.js`. These import the real state module and exercise the `localStorage` round-trip without network calls.

#### `initializeState()` — 5 tests

| Test | What it verifies |
|---|---|
| Populates at least one exam | Starter data is created correctly |
| `activeExamId` is valid | Always points to an actual exam in the array |
| AI config exists with all three key slots | Schema completeness |
| Timer config exists with positive values | `timer.focus` and `timer.break` are always present |
| Bumps `storeRev` | Reactive signal fires on init (components will re-render) |

#### `currentExam()` — 2 tests

| Test | What it verifies |
|---|---|
| Returns the active exam | Correct exam is selected by `activeExamId` |
| Falls back to first exam when ID is invalid | Defensive; stale IDs don't crash the app |

#### `save()` — 3 tests

| Test | What it verifies |
|---|---|
| Persists state to `localStorage` | Round-trip: mutate → save → parse → verify |
| Bumps `storeRev` on every call | Every save triggers a re-render |
| Local AI keys survive a save | Keys written locally are preserved (not scrubbed from `localStorage`) |

#### Data integrity migrations — 2 tests

| Test | What it verifies |
|---|---|
| SM-2 fields added to legacy cards | Cards with only `streak` get `ease`, `repetition`, `interval` on next `initializeState` |
| Default availability created when missing | Old exam objects without `availability` get a sane default |

**Why integration tests here?** `state.js` is the single most critical module — it coordinates all persistence, reactivity, and migrations. Unit-testing individual functions in isolation would miss interaction bugs (e.g., migrations running in the wrong order).

---

## Coverage scope

Coverage is collected from all files under `src/**/*.{js,jsx}` excluding `src/main.jsx` (entry point) and `src/test/**` (test files themselves).

Run `npm run test:coverage` to generate a detailed report in `./coverage/`. The CI pipeline uploads this as a build artifact named `coverage-report` with a 14-day retention window.

---

## What is intentionally not tested

| Area | Reason |
|---|---|
| Preact UI components (Dashboard, Plan, etc.) | Require DOM + signal integration; benefit better from end-to-end tests (Playwright) |
| Supabase auth flow | Network-dependent; covered by Supabase's own test suite |
| AI provider calls | Third-party network; tested via manual smoke tests |
| CSS / visual regressions | Out of scope for unit testing; addressed by visual review |
| `app.js.old` | Legacy file kept for reference only; not part of the active codebase |

---

## Adding new tests

1. Create `src/test/your-module.test.js`
2. Import from `../core/...` or `../utils/...` (one level up from `src/test/`)
3. Use `describe` / `it` / `expect` — they are globally available (configured in `vite.config.js`)
4. If your module reads `window.location` or `window.supabase` at import time, the `setup.js` stubs already handle this
5. Run `npm run test:watch` while writing
