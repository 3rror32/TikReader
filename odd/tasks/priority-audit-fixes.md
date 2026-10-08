# Priority Audit Fixes

## Objective

Correct every verified priority finding from the 2026-10-07 whole-codebase audit without overwriting unrelated work already present in the dirty working tree.

## Problem

The current local application has one broken broadcast-state route, several reliability and accessibility gaps, QA/runtime drift, CI/watch configuration drift, weak exception diagnostics, and three brittle frontend regression tests.

## Why

These defects can blank the broadcast overlay, reduce accessibility, hide useful diagnostics, weaken long-running reliability, and let CI or QA report misleading results.

## Scope

- Repair shared studio-state construction and `/broadcast/state`.
- Bound stale LAN rate-limit state.
- Align overlay QA with the shipped runtime.
- Add accessible studio pane semantics and keyboard behavior.
- Align coverage artifact collection and TypeScript watch inputs.
- Preserve useful local diagnostics for background failures.
- Repair the three currently failing frontend regression tests.

## Constraints

- Preserve all unrelated tracked and untracked user changes.
- Stage and commit only task-owned hunks; never stage whole dirty files blindly.
- Do not clean, reset, restore, or rewrite unrelated changes.
- Generated output may be verified but must not be committed unless the task explicitly requires it.
- Artifacts remain in English; existing Spanish UI copy stays consistent with the project.
- Test-first where a deterministic runner is available; record unavailable Python checks honestly.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: approximately 280 authored changed lines, below the 400-line chaining threshold.
- Feature branch: `codex/priority-audit-fixes`.
- Initial reviewed boundary: `dd285d12e44e0a58497da48cae09c2a502e0f12c`.

## Tasks

- [x] **PAF-1 — Repair backend state and rate limiting**
  - Route: delegated direct.
  - Trigger: shared state extraction, route behavior, rate-limit lifecycle, and tests span multiple non-trivial files.
  - Acceptance:
    - `/studio/state` and `/broadcast/state` use one shared state builder.
    - `/broadcast/state` no longer calls a nonexistent runtime attribute.
    - Inactive remote-request IP keys are evicted and total state is bounded.
    - Focused route and IP-churn regression tests pass, or runner unavailability is recorded.
  - Checks: focused Python tests; structural CodeGraph/readback; `git diff --check`.
  - Evidence: Added `build_studio_state` and used it from both routes; capped IP state at 1,000 entries and pruned expired per-IP timestamps before enforcing the unchanged 300/minute limit. Added route parity, churn, and threshold regressions. `py_compile` and `git diff --check` passed. Focused unittest collection was attempted with the bundled Python but is unavailable because Flask is missing (`ModuleNotFoundError: No module named 'flask'`). Work-unit commit: `3ebb80c`; authored line count: 195 (includes the new task document); no unrelated paths staged.

- [x] **PAF-2 — Align overlay QA and accessible studio navigation**
  - Route: delegated direct.
  - Trigger: template semantics, browser behavior, QA fixture, and tests span multiple non-trivial files.
  - Acceptance:
    - Overlay QA exercises the shipped Vite bundle rather than the legacy test-only runtime.
    - Studio pane controls expose selected state and pane relationships.
    - Arrow/Home/End keyboard navigation works without breaking existing clicks.
    - Focused frontend tests pass.
  - Checks: relevant Node tests; JavaScript syntax; TypeScript no-emit check; `git diff --check`.
  - Evidence: QA now loads `web/templates/widget.html` and asserts the shipped `/static/build/studio.js` was requested; the standalone legacy effects page is retained only as a clearly labeled compatibility fixture. Studio panes now expose linked tab/tab-panel semantics, selected/focus state, click activation, and Arrow/Home/End handling. The focused Node regressions, JavaScript syntax checks, TypeScript no-emit check (`npm run check:overlays`), and `git diff --check` passed. Browser QA was attempted but cannot start because Playwright is missing (`Cannot find module 'playwright'`). Work-unit commit: `0c6e5fa`; PAF-2 authored line count: 156 including task-document changes and excluding pre-existing alert hunks.

- [ ] **PAF-3 — Repair quality automation and diagnostics**
  - Route: delegated direct.
  - Trigger: workflow, watcher, three runtime services, and regression coverage span multiple non-trivial files.
  - Acceptance:
    - CI uploads the configured `runtime/.coverage` artifact and does not silently ignore absence.
    - Watch mode includes `frontend/**/*.ts`.
    - Background service failures preserve actionable local exception details without exposing them to users.
    - Focused checks pass.
  - Checks: configuration assertions; Python/Node focused tests where available; `git diff --check`.
  - Evidence: pending.

- [ ] **PAF-4 — Restore the regression suite and verify the candidate**
  - Route: delegated direct verification.
  - Trigger: full suites/builds must remain outside the parent context.
  - Acceptance:
    - Brittle connect-label and overlay-menu assertions validate behavior rather than formatting.
    - The sliced live-games harness supplies required lexical state.
    - Node suite, static JavaScript syntax checks, and TypeScript checking pass.
    - Python suite and Ruff pass, or precise environment blockers are recorded.
  - Checks: full applicable verification commands and final status/diff review.
  - Evidence: pending.

## Progress

- Current task: PAF-3.
- Completed tasks: PAF-1 (backend state reuse and bounded LAN request state; focused Python runner blocked by missing Flask); PAF-2 (shipped overlay bundle QA and keyboard-accessible studio tabs; browser QA blocked by missing Playwright).
- Running authored-line count: 359 (PAF-1 195 + PAF-1 metadata update 4 + PAF-2 156 + PAF-2 metadata update 4; excludes pre-existing unrelated hunks).
- Next step: align coverage/watch inputs and improve background-service exception logging.
