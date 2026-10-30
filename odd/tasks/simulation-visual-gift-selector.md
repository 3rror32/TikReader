# Simulation Visual Gift Selector

## Objective and authorized scope

Display the full gift catalog with artwork, names, and diamond values in the live laboratory simulator, matching the existing configuration picker. Preserve exact gift identity through submission, including duplicate names. Cover both the floating laboratory and full simulator.

## Constraints

Preserve unrelated worktree changes and existing custom-gift fallback behavior. Keep current Spanish UI vocabulary and styling. Engram is unavailable; mirror `odd/simulation-visual-gift-selector/tasks` is pending. Native review tooling (`gentle-ai`) is unavailable; mode and assessment are unknown and require independent verification.

## Delivery

Branch: `codex/minecraft-command-results`. Strategy: `ask-on-risk`. Forecast: approximately 250 authored implementation/test lines. Initial boundary: `2098bdb`. Missing registry `work-unit-commits` skill is unavailable in both indexed and configured user skill roots.

## Tasks

- [x] **SVG-1 — Add catalog artwork selection and preserve exact IDs.**
  - Route: delegated direct; reading prepares a write and behavior spans frontend, backend, and tests.
  - Acceptance: complete catalog, image/name/diamond labels, duplicate-name identity, keyboard access, usable floating/full forms, catalog refresh if supported, custom fallback preserved.
  - Test-first: focused deterministic UI and backend regression where applicable; observe RED then GREEN.
  - Checks: `node --test tests/test_simulation_ui.cjs`; `.venv/Scripts/python.exe -m pytest tests/test_simulation.py -q`; scoped `git diff --check`.
  - Verification: writer and independent verifier checks passed: `node --test tests/test_simulation_ui.cjs` (7 passed), `.venv/Scripts/python.exe -m pytest tests/test_simulation.py -q` (15 passed, 3 subtests; two upstream deprecation warnings), and scoped `git diff --check`. Parent repeated the final UI suite (7 passed). Duplicate-name selection regression was observed RED before the backend fix. Native assessment/review unavailable; treated as high with independent verification.
  - Commit, outcomes, line count: verified work-unit commit `bcf08c1` (`feat(simulation): add visual gift catalog selection`). Authored source/test count: 187 additions + 11 deletions = 198 lines.
  - Visual limitation: browser screenshot unavailable; Playwright Chromium absent and installed Edge exited during isolated launch. Popup clipping is structurally checked but not visually verified. Catalog remains loaded once, matching the existing simulator lifecycle.

## Progress and next step

- [x] **SVG-2 — Keep floating laboratory send controls reachable.**
  - Authorized follow-up: fix screenshot-confirmed clipping below the selected gift preview.
  - Route: delegated direct; CSS cascade/layout correction requires focused verification.
  - Diagnosis: form label `display:flex` overrides the comment label's hidden attribute; viewport-capped dock uses `overflow:hidden` with no internal form scrolling.
  - Acceptance: message label hides in gift mode; gift fields hide in comment mode; constrained form scrolls to delay/send controls; header remains usable; gift selector continues working.
  - Allowed implementation: scoped simulation CSS and JS only if needed, focused UI/layout coverage.
  - Checks: `node --test tests/test_simulation_ui.cjs`, scoped diff check, real-browser layout check if available. Avoid fake-DOM assertions as proof of CSS geometry.
  - Verification: `node --test tests/test_simulation_ui.cjs` (7 passed); `node --test tests/browser/simulation-layout.spec.cjs` (1 passed in installed Edge at 390×734 and 390×550); scoped `git diff --check` passed. Browser screenshots: `.tmp/simulation-layout-734.png` and `.tmp/simulation-layout-550.png`. Browser harness observed the hidden-label cascade failure before the CSS fix; after the fix, comment/gift fields switch correctly, the dock fits both viewports, and the send control is reachable by scrolling the form at 550px. Screenshot review confirmed the header, tabs, footer, gift field, delay, and send control remain usable. Bundled Chromium was absent; installed Edge required an escalated launch. No source mutation from screenshot capture.
  - Independent verification: 7 UI tests and Edge regression passed; extra Edge checks at 844×390 and 1366×768 confirmed reachable send controls, visible header/tabs, viewport fit, and hidden dock/tab behavior. Parent repeated 7 UI tests and inspected the 734px screenshot. Layout harness uses representative isolated markup and actual CSS, not a live application session.
  - Commit: pending parent work-unit commit. Change is limited to scoped CSS, real-browser regression, and this task record. The browser regression exceeds the initial 50-line forecast to cover both modes and geometry; feature total remains below 400 authored lines. Engram mirror and native review remain unavailable as documented above.

Exploration confirmed name-only datalists in both simulator forms and name-only resolution in `app/simulation.py`. Existing gift catalog already provides artwork, diamonds, and exact IDs. The shared visual listbox now shows the full catalog on focus, filters after typing, and keeps the selected artwork/name/value visible. It supports arrow/Enter/Escape/Tab navigation, starts ArrowUp at the final option, reopens in full on click, and repositions on scroll. Both forms submit the chosen `gift_id`, and backend validation prefers that exact catalog record while retaining the existing typed-name fallback. Focused UI tests cover duplicate-name identity and floating/full picker behavior. No push or PR authorized.
