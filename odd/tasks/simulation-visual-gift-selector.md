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
  - Commit, outcomes, line count: verified implementation; work-unit commit pending. Authored source/test count: 187 additions + 11 deletions = 198 lines.
  - Visual limitation: browser screenshot unavailable; Playwright Chromium absent and installed Edge exited during isolated launch. Popup clipping is structurally checked but not visually verified. Catalog remains loaded once, matching the existing simulator lifecycle.

## Progress and next step

Exploration confirmed name-only datalists in both simulator forms and name-only resolution in `app/simulation.py`. Existing gift catalog already provides artwork, diamonds, and exact IDs. The shared visual listbox now shows the full catalog on focus, filters after typing, and keeps the selected artwork/name/value visible. It supports arrow/Enter/Escape/Tab navigation, starts ArrowUp at the final option, reopens in full on click, and repositions on scroll. Both forms submit the chosen `gift_id`, and backend validation prefers that exact catalog record while retaining the existing typed-name fallback. Focused UI tests cover duplicate-name identity and floating/full picker behavior. No push or PR authorized.
