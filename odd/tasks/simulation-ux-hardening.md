# Simulation UX hardening

## Objective

Improve the simulation interface in four bounded areas: accessible keyboard operation, clearer communication of real effects, recoverable gift-catalog failures, and responsive visual validation.

## Problem and why

The simulation UI already exposes useful controls and status, but the floating panel does not fully implement the keyboard behavior implied by its ARIA tabs, activation can make the real-effect scope more prominent, catalog failures can look like empty data, and the responsive layout needs browser-level validation.

## Authorized scope

- Implement improvements 1–4 from the frontend/security audit.
- Do not change the HTTP origin policy or implement audit item 5.
- Preserve all pre-existing staged and unstaged user changes; commit only changes attributable to this feature.

## Constraints

- Current staged changes overlap simulation frontend files and must not be overwritten or silently absorbed when unrelated.
- Technical artifacts remain in English; existing Spanish UI copy stays consistent with the product.
- Use test-first development when a deterministic UI test can express the behavior.
- Engram mirror topic: `odd/simulation-ux-hardening/tasks` (pending: Engram tools are unavailable in this session).

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: approximately 180–260 authored changed lines, generated files excluded.
- Route: delegated direct; four non-trivial frontend/test tasks and overlapping staged work trigger the writer and preparation rules.
- Branch: `codex/simulation-ux-hardening`.
- Reviewed boundary: branch point (pending determination).

## Tasks

- [x] **SUX-1 — Complete accessible floating-panel tabs and focus behavior**
  - Add a deterministic RED test for keyboard tab navigation and focus restoration.
  - Implement ArrowLeft/ArrowRight, Home/End, roving `tabindex`, selected-panel state, and predictable open/close focus.
  - Acceptance: keyboard users can traverse and activate tabs without leaving the tablist; closing restores focus to the launcher.
  - Checks: `node --test tests/test_simulation_ui.cjs`; `node --check web/static/simulation.js`.
  - Evidence: the initial tab-navigation assertion failed before implementation because the tabs had no roving tab stop or panel relationship; the implementation then passed all 12 UI tests and the script syntax check. Independent verification found the assertion checked source strings rather than executing tab behavior. Replaced it with behavioral coverage for arrow wrapping, Home/End, selected state, roving tabindex, panel visibility, mouse activation, open focus, close, and Escape focus restoration. The expanded test suite passes (12/12); no product runtime defect was exposed.
  - Commits: `7feda1f` (`fix(simulation): complete keyboard tab navigation`); behavioral-test correction pending parent readback.

- [ ] **SUX-2 — Make the real-effect simulation state unmistakable**
  - Add a deterministic RED test for the armed/active messaging where practical.
  - Present a persistent, concise active-state cue near event submission and keep action labels/status consistent.
  - Acceptance: users can tell before submitting that saved rules and normal overlays will run, without repeated modal confirmations.
  - Checks: `node --test tests/test_simulation_ui.cjs`; visual readback.
  - Commit: pending.

- [ ] **SUX-3 — Make gift-catalog failures recoverable**
  - Add a deterministic RED test for failed catalog loading and retry.
  - Show an actionable error state and allow retry without reloading the page.
  - Acceptance: a failed request cannot be mistaken for an empty catalog, and a successful retry restores normal selection.
  - Checks: `node --test tests/test_simulation_ui.cjs`; `node --check web/static/simulation.js`.
  - Commit: pending.

- [ ] **SUX-4 — Validate and correct responsive presentation**
  - Inspect the running interface at desktop, narrow mobile, and 200% zoom-equivalent viewports.
  - Correct only verified overlap, clipping, focus visibility, or virtual-keyboard/layout defects within the allowed surface.
  - Acceptance: the main simulation page and floating panel remain usable at the inspected sizes, with any unavailable visual checks recorded honestly.
  - Checks: browser screenshots/readback; `node --test tests/test_simulation_ui.cjs` after any correction.
  - Commit: pending.

## Progress and evidence

- 2026-11-04: Read-only frontend and security audits completed. No P0/P1 security vulnerability was confirmed.
- 2026-11-04: Feature branch created and implementation authorized for items 1–4 only.
- 2026-11-04: SUX-1 implemented and verified; `node --test tests/test_simulation_ui.cjs` passed (12/12), and `node --check web/static/simulation.js` passed. The pre-implementation test run was RED (11 passed, 1 failed on missing tab semantics).
- 2026-11-04: Corrected SUX-1 test quality after independent verification; behavioral assertions now exercise keyboard and focus outcomes. `node --test tests/test_simulation_ui.cjs` passed (12/12), and `node --check web/static/simulation.js` passed. No product code change was needed for this correction.
- Verification, commit identities, RDD assessment, and running changed-line count: pending.

## Next step

Delegate one bounded writer to reconcile the pre-existing staged simulation work, implement tasks sequentially, run the named checks, update this document after each task, and avoid item 5.
