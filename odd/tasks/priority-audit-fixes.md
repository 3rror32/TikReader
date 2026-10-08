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

- Strategy: `stacked-to-main` (selected by the user after the running authored-line count approached the delivery threshold).
- Forecast at creation: approximately 280 authored changed lines; current observed cumulative total is above 400, so use independent task slices.
- Feature branch: `codex/priority-audit-fixes`.
- Initial reviewed boundary: `dd285d12e44e0a58497da48cae09c2a502e0f12c`.
- Future PR slices (planning only; do not create or push):
  1. PAF-1 backend state/rate limiting, target `main`, independent; observed task and metadata commits total 302 authored lines including initial feature documentation and concurrency correction.
  2. PAF-2 overlay QA and accessible navigation, target `main`, independent; observed task and metadata commits total 160 authored lines excluding unrelated alert hunks.
  3. PAF-3 CI/watch configuration and background diagnostics, target `main`, independent; observed work-unit and SHA-metadata commits total 78 authored lines.
  4. PAF-4 frontend regression repairs and final verification record, target `main`, independent; task and SHA-evidence commits total 101 authored lines including the committed-byte portability correction.
- Slice order: PAF-1 → PAF-2 → PAF-3 → PAF-4 for review convenience only; each slice targets `main` and has no prerequisite slice dependency.
- Dependency diagram: `main ← [PAF-1]`; `main ← [PAF-2]`; `main ← [PAF-3]`; `main ← [PAF-4] ✓ complete`. No slice depends on another.

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
  - Independent correction: concurrent requests could prune the same stale key because shared rate-limit and reader maps had no synchronization. Added one `remote_access_lock` around pruning, eviction, rate checks, map writes/reads, and token-rotation clearing; the 300/minute rule and 1,000-key bound are unchanged. Added a barrier-coordinated two-request regression. Use `threading.Lock` so the regression can inspect acquisition state on the bundled Python 3.12 runtime (`threading.RLock` has no `locked()` method there). Correction commits: `5fec3233105d` and portability follow-up `74ff0d397eb4`; 105 authored changed lines. `py_compile` and `git diff --check` pass. The new Python behavior test could not execute because Flask is absent (`ModuleNotFoundError: No module named 'flask'`); therefore no behavioral RED/GREEN is claimed for this follow-up.

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

- [x] **PAF-3 — Repair quality automation and diagnostics**
  - Route: delegated direct.
  - Trigger: workflow, watcher, three runtime services, and regression coverage span multiple non-trivial files.
  - Acceptance:
    - CI uploads the configured `runtime/.coverage` artifact and does not silently ignore absence.
    - Watch mode includes `frontend/**/*.ts`.
    - Background service failures preserve actionable local exception details without exposing them to users.
    - Focused checks pass.
  - Checks: configuration assertions; Python/Node focused tests where available; `git diff --check`.
  - Evidence: RED observed: before implementation, the focused Node suite failed the three new PAF-3 checks (coverage upload behavior, TypeScript watch glob, and background exception logging). GREEN observed: focused Node suite passed 5/5; `node --check web/static/studio.js`, bundled Python `py_compile` for the three services and watcher, and `git diff --check` passed. The Python runtime compile check is not a substitute for behavior-level Flask tests; no runtime logging capture test was added. Work-unit commit: `b635b42`; authored line count: 66 including task-document changes.

- [x] **PAF-4 — Restore the regression suite and verify the candidate**
  - Route: delegated direct verification.
  - Trigger: three existing dirty frontend regression files required isolated hunk staging; the full suite and static checks run at feature closure.
  - Acceptance:
    - Brittle connect-label and overlay-menu assertions validate behavior rather than formatting.
    - The sliced live-games harness supplies required lexical state.
    - Node suite, static JavaScript syntax checks, and TypeScript checking pass.
    - Python suite and Ruff pass, or precise environment blockers are recorded.
  - Checks: full applicable verification commands and final status/diff review.
  - Evidence: RED observed: the initial focused run failed the brittle connection-label assertion and whitespace-sensitive overlay-order assertion; the sliced games harness raised `ReferenceError: bankStateRevision is not defined`. After those repairs, the full CJS suite exposed PAF-2's new navigation helper assuming every test root had `querySelector`; a narrow guard restored compatibility without changing real document navigation. GREEN observed: the three focused suites passed 38/38, then focused RVC + priority tests passed 13/13, and full `node --test --test-timeout=30000 tests/test_*.cjs` passed 267/267. All 88 `web/static/*.js` files passed `node --check`; `npm run check:overlays` / TypeScript no-emit passed. Python unittest ran 44 tests but all 44 failed import/collection because bundled Python lacks Flask (`ModuleNotFoundError: No module named 'flask'`); no project `.venv` was present. Ruff was unavailable (`No module named ruff`). PAF-2 browser QA remains unavailable because Playwright is not installed. Task-owned `git diff --check` passed; staged-only changes preserve unrelated pre-existing hunks. Work-unit commit: `c7ed5fc`; authored line count: 42 including task-document changes.
  - Independent correction: prior assertions depended on dirty-only connection-button markup/text and on favorites preceding animations. RED was verified against committed `c7ed5fc` bytes: the old label-wrapper matcher returned false, and menu positions were favorites 446 versus animations 130. Replaced them with a VM-executed `startLive` request assertion and order-independent direct-destination/routing checks. The staged test bodies pass against in-memory committed source bytes and in the working tree. Final full Node suite passes 270/270; all 88 JavaScript syntax checks pass, TypeScript no-emit and Python syntax checks pass. Focused Python behavior test still cannot import Flask (`ModuleNotFoundError: No module named 'flask'`). Correction commit: `25e7410d5860`; 45 authored changed lines.

## Progress

- Current slice: independent verification corrections for PAF-1 and PAF-4 are complete; selected strategy remains `stacked-to-main`, and no PRs were created or pushed.
- Completed tasks: PAF-1 (backend state reuse and bounded LAN request state; focused Python runner blocked by missing Flask); PAF-2 (shipped overlay bundle QA and keyboard-accessible studio tabs; browser QA blocked by missing Playwright); PAF-3 (coverage/watch configuration and local traceback logging); PAF-4 (frontend test repairs and final applicable verification).
- Tracked slice authored-line count: 653 including the prior 10-line closure commit (PAF-1 304 + PAF-2 160 + PAF-3 78 + PAF-4 101 + closure 10; excludes unrelated pre-existing hunks and this post-review record-only document update).
- Independent-review corrections are committed as PAF-1 `5fec3233105d` plus `74ff0d397eb4` (105 authored changed lines total) and PAF-4 `25e7410d5860` (45 authored changed lines). Full Node suite: 270/270 pass; all 88 JavaScript files pass syntax checks; `npm run check:overlays` / TypeScript no-emit, Python `py_compile`, committed-byte UI semantic checks, and staged `git diff --check` pass. Focused Python behavior and full Python unittest remain unavailable because Flask is missing; Ruff and browser QA remain unavailable because Ruff and Playwright are not installed. No unrelated hunks were staged; no PR/push created.
