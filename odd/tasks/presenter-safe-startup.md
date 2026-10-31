# Presenter safe startup

## Objective

Always start TikReader in the normal operator view. Presenter mode must activate only from an explicit action in the current session.

## Problem and why

`workspace.js` restores the complete `tikreader.layout` object from local storage. When a previous session closes with `presenter: true`, the next launch immediately reapplies the body class and shows “Salir del modo presentador”, even though the user only opened the application.

## Authorized scope

- Normalize restored layout state so startup always begins with `presenter: false`.
- Preserve the saved chat split and the ability to activate and exit presenter mode during the current session.
- Add a focused regression for stale persisted presenter state.

## Constraints

- Do not remove presenter mode or change its visible controls.
- Do not reset unrelated profile, voice, accessibility, or layout data.
- Engram mirror is pending because no Engram memory tools are available.

## Delivery strategy

`exception-ok`: one focused startup-state work unit, forecast below 100 authored changed lines.

## Tasks

- [x] `PSS-01` Discard stale presenter activation during startup while preserving the saved chat split and explicit in-session toggling.
  - Route: delegated direct.
  - Trigger: implementation and deterministic regression span two non-trivial files.
  - Test-first policy: observe a focused RED for restored `presenter: true`, then implement GREEN.
  - Acceptance: startup never applies presenter mode from persisted layout; split is restored; the toggle and exit control still save explicit changes; focused tests and `git diff --check` pass.

## Applicable checks

- Focused workspace/operator safety test.
- Relevant settings cleanup test.
- `git diff --check`.
- Parent spot-check of one reported command.

## Evidence

- `web/static/workspace.js` reads `tikreader.layout` with the full persisted `presenter` field and immediately calls `applyLayout()`.
- RED: the first `node tests/test_operator_safety.cjs` run failed the new PSS-01 regression on invalid-layout normalization (4 existing tests passed, 1 new test failed).
- GREEN: after startup normalization was implemented, `node tests/test_operator_safety.cjs` passed all 5 tests; `node tests/test_settings_cleanup.cjs` passed all 4 tests; `git diff --check` passed (Git emitted only its LF-to-CRLF advisory for the edited test file).
- Startup now rejects non-object and array layouts, preserves unrelated fields on valid objects, forces `presenter` false before applying, restores/clamps `split`, and saves the normalized layout. Session toggle and exit handlers remain intact.
- Limitation: the regression follows the repository's source-assertion test style; it does not run the browser DOM. Engram mirror remains pending because no Engram memory tools are available.
- RDD is unavailable because `gentle-ai` is not installed in this shell.

## Commit

Created the required work-unit commit: `fix: keep presenter mode session-scoped`.
