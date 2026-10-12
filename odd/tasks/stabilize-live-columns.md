# Stabilize live columns

## Objective

Correct the two visible layout regressions in the live studio: oversized comment action controls (including the collapsed `More` control) and the participant panel jumping when the layout is otherwise static.

## Problem and why

The current cascade lets comment actions wrap and stretch inside each card, which compresses the `More` label into a vertical column and makes icon controls appear much taller than intended. The participant column also changes geometry across adjacent desktop breakpoints and scrollbar states, producing avoidable horizontal or vertical movement.

## Authorized scope

- Preserve the current visual language and accessible labels.
- Change only live-column layout styles and focused source-level regression tests.
- Do not modify pre-existing changes under `tools/`, `web/static/build/`, or `tests/test_build_release.py`.

## Constraints

- Source assets loaded by `web/templates/index.html` are authoritative.
- Keep controls keyboard accessible and at least 36 px on desktop / 44 px on mobile.
- Avoid JavaScript unless CSS cannot provide stable geometry.
- Engram mirror: pending because the memory provider is unavailable in this session.

## Delivery strategy

- Strategy: `ask-on-risk`.
- Forecast: fewer than 100 authored changed lines, excluding generated files.
- Expected slice: one feature-branch work unit, below the 400-line delivery budget.

## Tasks

- [x] `SLC-1` Normalize comment action and `More` control geometry.
  - Route: delegated direct.
  - Trigger evidence: implementation requires reading existing cascade and updating source plus regression coverage.
  - Acceptance: per-comment actions remain compact, never inherit card height, and the `More` control renders as an icon-sized square without visible vertical text.
  - Result: actions no longer wrap or stretch; `Más` uses the existing icon-only control treatment and retains its accessible label. Mobile controls keep their existing 44 px size.
  - Follow-up result: removed closed-state padding that clipped the icon; the open disclosure is an absolutely positioned, bounded menu outside the row flow; its container matches the 44 px mobile summary.
  - Follow-up checks: `node --test tests/test_visual_refresh.cjs` RED: 18 passed, 1 failed on the missing zero-padding rule; GREEN: 19/19 passed. `node --test tests/test_frontend.cjs tests/test_chat_navigation.cjs`: 34/34 passed. `git diff --check` passed.
- [x] `SLC-2` Stabilize the `En el chat` participant panel.
  - Route: delegated direct.
  - Trigger evidence: the fix spans breakpoint behavior and scroll geometry in the same live-column cascade.
  - Acceptance: the panel keeps stable width and height at desktop breakpoints, reserves scrollbar space, and does not cause document-scroll handoff while the live layout is static.
  - Result: desktop panel height is fixed at 560 px across 701–1279 px; its list reserves scrollbar space and contains scroll/anchoring behavior.
  - Checks: `node --test tests/test_visual_refresh.cjs` passed 18/18; `node --test tests/test_frontend.cjs tests/test_chat_navigation.cjs` passed 34/34.

## Progress and evidence

- Exploration identified `web/static/live_refinement.css` and `web/static/live_columns.css` as the active cascade, with `tests/test_visual_refresh.cjs` as the nearest source-level regression suite.
- `git diff --check` passed. `git status --short` showed changes only to the authorized task/test/source files plus the five preserved pre-existing paths; none of those unrelated paths were staged.
- Combined work-unit estimate: 49 authored additions before this progress update, well below the forecast. The two tasks share the same source cascade and regression file, so they close in one coherent work-unit commit.
- Work-unit commit: `dd0638d` (`fix: stabilize live column controls and scrolling`).
- Follow-up P2/P3 review findings for `SLC-1` are resolved with explicit open-state and mobile regression coverage. The focused RED was 18 passed/1 failed; GREEN was 19/19; frontend subset was 34/34. `git diff --check` passed.
- Follow-up commit: `0049dd8` (`fix: keep comment disclosure menu unclipped`).
- Final independent rerun: `tests/test_visual_refresh.cjs` passed 19/19 and the candidate diff remained clean. The combined frontend/chat command later reported 34/35 because an uncommitted, out-of-scope participant test now expects `Actividad reciente`; neither that test nor its related source edits are part of this candidate.

## Next step

Complete; the disclosure fix, focused tests, and evidence are committed as `0049dd8`.
