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
  - Commits: `7feda1f` (`fix(simulation): complete keyboard tab navigation`) and `a56d601` (`test(simulation): exercise tab keyboard behavior`).

- [x] **SUX-2 — Make the real-effect simulation state unmistakable**
  - Add a deterministic RED test for the armed/active messaging where practical.
  - Present a persistent, concise active-state cue near event submission and keep action labels/status consistent.
  - Acceptance: users can tell before submitting that saved rules and normal overlays will run, without repeated modal confirmations.
  - Checks: `node --test tests/test_simulation_ui.cjs`; visual readback.
  - Evidence: the new test was RED because neither form had a cue beside its submit control. Added persistent state-aware cues to the full-page and floating forms; active state names saved rules, usual overlays, and real actions, while inactive and paused states remain distinct. UI tests pass (13/13) and JavaScript syntax check passes. Browser readback at 1440×900 confirmed inactive and active cues in both surfaces; simulation was returned to inactive afterward.
  - Commit: `f8c2e7f` (`feat(simulation): clarify real effect scope`).

- [x] **SUX-3 — Make gift-catalog failures recoverable**
  - Add a deterministic RED test for failed catalog loading and retry.
  - Show an actionable error state and allow retry without reloading the page.
  - Acceptance: a failed request cannot be mistaken for an empty catalog, and a successful retry restores normal selection.
  - Checks: `node --test tests/test_simulation_ui.cjs`; `node --check web/static/simulation.js`.
  - Evidence: the behavioral test was RED because the forms had no catalog error or retry controls. Added live error messages and retry buttons to both forms and the open picker; successful retry repopulates the same UI instance. Independent verification found focus loss when the retry control disappeared, so commit `0edad03` restored focus and added immediate-success coverage. A later deferred-response test exposed focus stealing after newer focus or surface closure; SUX-3A adds the interaction-ownership guard. The catalog failure/retry and focus outcomes are now covered by behavioral tests; the UI suite passes (15/15), and JavaScript syntax check passes.
  - Commits: `edb075c` (`fix(simulation): make gift catalog retryable`) and `0edad03` (`fix(simulation): restore focus after catalog retry`).

- [x] **SUX-3A — Guard delayed retry focus restoration**
  - Add a deterministic RED test with a deferred catalog response and intervening user focus movement.
  - Restore focus only when the retry control still owns the interaction and its originating surface remains open.
  - Acceptance: immediate retry recovery keeps a useful focus destination, while delayed completion never steals focus from a newer user action or a closed surface.
  - Checks: `node --test tests/test_simulation_ui.cjs`; `node --check web/static/simulation.js`.
  - Route: delegated direct; this is a new bounded work unit authorized after the prior candidate exhausted its correction budget.
  - Evidence: deferred-response tests were RED when retry completion always focused its old destination. Focus now returns only if no focus event occurred since retry began and the originating picker or gift form remains open. Tests confirm a newer focused control stays focused, Escape leaves a closed picker closed without focus returning inside, and closing the floating panel leaves focus on its launcher. Immediate picker and inline retry focus remains covered. UI suite passes (15/15); JavaScript syntax check passes.
  - Commit: `84ab64a` (`fix(simulation): guard delayed retry focus`).

- [x] **SUX-4 — Validate and correct responsive presentation**
  - Inspect the running interface at desktop, narrow mobile, and 200% zoom-equivalent viewports.
  - Correct only verified overlap, clipping, focus visibility, or virtual-keyboard/layout defects within the allowed surface.
  - Acceptance: the main simulation page and floating panel remain usable at the inspected sizes, with any unavailable visual checks recorded honestly.
  - Checks: browser screenshots/readback; `node --test tests/test_simulation_ui.cjs` after any correction.
  - Evidence: browser measurements showed the fixed mobile command dock covered the simulation launcher at 390×844 and 720×450. Added a ≤760px CSS offset for the launcher and open panel using the safe-area inset and active banner height. Independent verification found the active-state selector had higher specificity than the generic mobile launcher rule; added an equal-specificity active-state override and extended the regression assertion. Active-state browser revalidation confirmed an 8 px gap at 390×844 and an 18 px gap at 720×450; desktop 1440×900 remains unchanged. UI tests pass (16/16), and JavaScript syntax check passes. Simulation and viewport were restored afterward.
  - Commits: `3214fac` (`fix(simulation): clear mobile command dock`); active-state cascade correction pending parent readback.

## Progress and evidence

- 2026-11-04: Read-only frontend and security audits completed. No P0/P1 security vulnerability was confirmed.
- 2026-11-04: Feature branch created and implementation authorized for items 1–4 only.
- 2026-11-04: SUX-1 implemented and verified; `node --test tests/test_simulation_ui.cjs` passed (12/12), and `node --check web/static/simulation.js` passed. The pre-implementation test run was RED (11 passed, 1 failed on missing tab semantics).
- 2026-11-04: Corrected SUX-1 test quality after independent verification; behavioral assertions now exercise keyboard and focus outcomes. `node --test tests/test_simulation_ui.cjs` passed (12/12), and `node --check web/static/simulation.js` passed. No product code change was needed for this correction.
- 2026-11-04: Independent targeted re-verification passed for `a56d601`; the prior source-string coverage finding is resolved. Native RDD assessment was unavailable because the `gentle-ai` executable is not present in this environment, so no review receipt was claimed.
- 2026-11-04: SUX-2 implementation and functional checks passed; browser validation confirmed both simulation surfaces and the local simulation state was restored to inactive.
- 2026-11-04: Independent verification passed for SUX-2 commit `f8c2e7f`; no correctness finding was identified.
- 2026-11-04: SUX-3 catalog failure/retry behavior implemented and verified; UI suite passed (14/14), and JavaScript syntax check passed.
- 2026-11-04: SUX-3 focus correction passed; picker retry focuses search, inline retry focuses its gift trigger, and both required commands passed.
- 2026-11-04: Targeted re-verification of `0edad03` found a delayed-response focus-stealing race. The existing candidate's correction budget was exhausted; user authorized SUX-3A as a new bounded work unit.
- 2026-11-04: SUX-3A resolved delayed retry focus restoration; deferred-response tests pass for moved focus and closed picker/panel surfaces. UI suite passed (15/15), and JavaScript syntax check passed. SUX-3 is closed.
- 2026-11-04: Independent verification passed for SUX-3A commit `84ab64a`; the asynchronous focus-stealing finding is resolved.
- 2026-11-04: SUX-4 mobile dock clearance CSS and structural assertion implemented; UI suite passed (16/16), and JavaScript syntax check passed. Browser readback passed at desktop 1440×900, mobile 390×844, and zoom-equivalent 720×450; viewport override was reset afterward.
- 2026-11-04: Independent verification found the active-state cascade overrode the mobile launcher clearance. Added an equal-specificity active mobile rule and regression coverage; active-state browser revalidation passed at 390×844 and 720×450. UI suite passed (16/16), JavaScript syntax check passed, simulation was deactivated, and the viewport override was reset.
- Running authored changed-line count and later-task review outcomes: pending.

## Next step

Commit and independently verify SUX-4, record final changed-line count, and close the feature. Item 5 remains out of scope.
