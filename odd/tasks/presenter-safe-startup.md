# Presenter safe startup

## Objective

Keep TikReader focused on the normal operator view by removing the unused presenter mode while preserving the independent chat-width control.

## Problem and why

`workspace.js` originally restored the complete `tikreader.layout` object from local storage. The temporary startup fix prevented automatic activation, but the remaining controls, styles, translations, documentation, and profile state still expose a mode the user does not need.

## Authorized scope

- Remove presenter controls, runtime state, styles, translations, documentation, and tests that assert the feature exists.
- Preserve the saved chat split and sanitize legacy layout/profile objects without retaining the removed property.
- Keep unrelated uses of “presentador” that refer to a human moderator/presenter.
- Add focused regressions for legacy-data cleanup and chat-width preservation.

## Constraints

- Do not reset unrelated profile, voice, accessibility, or layout data.
- Do not remove moderator flows that refer to a human presenter.
- Engram mirror is pending because no Engram memory tools are available.

## Delivery strategy

`exception-ok`: two focused work units, accumulated forecast below 250 authored changed lines.

## Tasks

- [x] `PSS-01` Discard stale presenter activation during startup while preserving the saved chat split and explicit in-session toggling.
  - Route: delegated direct.
  - Trigger: implementation and deterministic regression span two non-trivial files.
  - Test-first policy: observe a focused RED for restored `presenter: true`, then implement GREEN.
  - Acceptance: startup never applies presenter mode from persisted layout; split is restored; the toggle and exit control still save explicit changes; focused tests and `git diff --check` pass.
- [x] `PSS-02` Remove presenter mode completely while preserving the chat-width setting and sanitizing legacy layouts/profiles.
  - Route: delegated direct.
  - Trigger: complete removal spans runtime code, template, CSS, translations, documentation, and multiple regressions.
  - Test-first policy: update the feature contract to fail while presenter UI/runtime references remain, then remove the implementation and reach GREEN.
  - Acceptance: no presenter-mode control, runtime branch, style, translation, or documentation remains; legacy `presenter` keys are discarded while `split` survives; moderator references remain; focused, browser, and cleanup checks pass.

## Applicable checks

- Focused workspace/operator safety test.
- Relevant settings cleanup test.
- `git diff --check`.
- Parent spot-check of one reported command.

## Evidence

- `web/static/workspace.js` reads `tikreader.layout` with the full persisted `presenter` field and immediately calls `applyLayout()`.
- RED: the first `node tests/test_operator_safety.cjs` run failed the new PSS-01 regression on invalid-layout normalization (4 existing tests passed, 1 new test failed).
- GREEN: after startup normalization was implemented, `node tests/test_operator_safety.cjs` passed all 5 tests; `node tests/test_settings_cleanup.cjs` passed all 4 tests; `git diff --check` passed (Git emitted only its LF-to-CRLF advisory for the edited test file).
- Historical PSS-01 behavior: startup rejected non-object and array layouts, preserved unrelated fields on valid objects, forced `presenter` false before applying, restored/clamped `split`, and saved the normalized layout. This is retained as prior implementation evidence; PSS-02 removes that mode.
- Limitation: the regression follows the repository's source-assertion test style; it does not run the browser DOM. Engram mirror remains pending because no Engram memory tools are available.
- RDD is unavailable because `gentle-ai` is not installed in this shell.

### PSS-02 evidence

- Files: `web/static/workspace.js`, `web/templates/index.html`, `web/static/studio.css`, `web/static/shell.css`, `web/static/translations.js`, `docs/INSTRUCCIONES.md`, `tests/test_operator_safety.cjs`, `tests/browser/safety.spec.cjs`, and `tests/test_workspace_voice.cjs`.
- RED: after updating the feature contract, `node tests/test_operator_safety.cjs` failed on the remaining runtime presenter controls/state (4 other tests passed, 1 failed).
- GREEN: `node tests/test_operator_safety.cjs` passed 5/5; `node tests/test_workspace_voice.cjs` passed 5/5, including current-layout and profile migration while preserving unrelated preferences; `node tests/test_settings_cleanup.cjs` passed 4/4; `git diff --check` passed.
- Browser: `npm run test:operator -- tests/browser/safety.spec.cjs` passed all 6 tests, including loading a legacy profile and checking its sanitized saved layout.
- Migration: `normalizeLayout` accepts only a valid numeric split, clamps it to 40–70, defaults invalid values to 58, and returns only `{split}`. Startup and profile loading save this canonical layout; profile data and unrelated local-storage keys remain unchanged.
- Directed production-source searches found no removed control IDs, presenter layout state, body-class toggles, presenter CSS selectors, or visual-mode copy. Remaining translation references describe human moderator/question flows.
- Independent verification repeated all focused checks successfully, confirmed the configuration card contains only the chat-width description/control with no orphaned presenter nodes, and found no candidate-caused failure.
- Pre-existing follow-up: changing `split` updates storage, the displayed percentage, and `--chat-share`, but `web/static/live_refinement.css` currently fixes the visible three-column layout and prevents the control from changing the rendered column width. This limitation exists unchanged in the parent commit and is outside PSS-02.
- Limitation: the Engram mirror remains pending because no Engram memory tools are available.

## Commit

PSS-01 commit: `fix: keep presenter mode session-scoped`. PSS-02 work-unit commit: `refactor: remove presenter mode`.
