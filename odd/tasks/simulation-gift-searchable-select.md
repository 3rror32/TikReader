# Simulation gift searchable select

## Objective
Replace the standalone-looking gift text fields in the main and floating simulation forms with one accessible searchable select trigger backed by the existing shared catalog picker.

## Problem
The simulation form presents editable text fields that resemble independent gift inputs even though selection is intended to happen through a catalog popover.

## Why
A single select-style control makes the relationship between the selected gift and the searchable catalog clear while preserving catalog identity, artwork, keyboard navigation, and submission behavior.

## Scope and constraints
- Update the shared picker behavior, main form markup, styling as needed, and focused UI coverage.
- Preserve catalog search, option artwork and diamond values, selection identity, keyboard behavior, and submission of both gift name and `gift_id`.
- Keep main and floating simulation forms consistent; do not redesign unrelated UI.
- Do not edit, stage, format, or commit `app/server.py` or `tests/test_server.py`; those files contain pre-existing user changes.
- Engram mirror: pending; no Engram tools are available in this session.

## Authorized scope
- `web/templates/simulation.html`
- `web/static/simulation.js`
- `web/static/simulation.css`
- `tests/test_simulation_ui.cjs`
- `odd/tasks/simulation-gift-searchable-select.md`

## Task checklist
- [x] SIM-GIFT-SELECT-01 — Replace text-like gift triggers with accessible select-style controls and preserve the shared searchable picker behavior.

## Acceptance criteria
- Neither form has an editable standalone gift text field; both expose a button/select-style accessible combobox trigger.
- The picker retains a dedicated accessible search input and all catalog options, artwork, diamond values, selection and keyboard behavior.
- The selected gift name and `gift_id` are both submitted from the main form.
- Focused UI tests pass and `git diff --check` is clean.

## Checks
- `node tests/test_simulation_ui.cjs` — test-first RED before implementation, then GREEN after implementation.
- `git diff --check`
- Structural readback: confirm main and floating forms have no editable standalone gift text field and the picker still owns its dedicated search input.

## Route and delivery
- Route: delegated.
- Trigger evidence: the change spans UI markup, shared picker behavior, styles, and focused tests.
- Forecast: approximately 100 authored changed lines, excluding generated files.
- Delivery strategy: `ask-on-risk`.
- Commit: one scoped Conventional Commit after verification; keep the pre-existing server changes unstaged.

## Progress and evidence
- Explored the focused UI test harness and confirmed it currently treats `simulation-gift` as an editable value holder while separately asserting picker search, art, duplicate-name identity, and keyboard behavior.
- Skills: `frontend-design` loaded; `work-unit-commits` was unavailable at the registry path `C:\Users\Carlos\.gemini\skills\work-unit-commits\SKILL.md`.
- RED: `node tests/test_simulation_ui.cjs` exited 1 before implementation (6 passed, 3 failed). The new source contract rejected the main text input, and both runtime control checks observed no combobox role on the main or floating trigger.
- GREEN: `node tests/test_simulation_ui.cjs` exited 0 after implementation (9 passed, 0 failed), including both forms' combobox source contracts, keyboard selection, artwork, duplicate-name identity, and both submissions' gift name plus `gift_id`.
- `git diff --check`: exited 0.
- Structural readback: both source forms render button comboboxes; neither gift control is an editable text input; the picker retains its `type="search"` combobox with `Buscar regalo`; both submit handlers read the selected gift name and `gift_id`.
- Independent verification found the main-form hint still said users could type a gift name without a catalog, which no longer matches the button combobox. Applied a bounded Spanish copy correction directing users to open the selector and search the catalog; no test or unrelated UI files were changed.
- Concurrent working-tree verification: the complete `node tests/test_simulation_ui.cjs` currently includes an unrelated rapid-send test and fails there; all gift-specific tests pass. The concurrent rapid-send source and test changes were deliberately excluded from this work unit.
- Staged-candidate verification: exported the Git index to an isolated directory and ran `node tests/test_simulation_ui.cjs`; 9 tests passed and 0 failed. `git diff --cached --check` also passed.
- Commit identity: `94fd1db` (`fix(simulation): unify gift picker control`). The scoped commit excludes the concurrent rapid-send changes and other pre-existing user work.

## Next step
Implementation and verification are complete. Delivery remains under ordinary repository policy; push or pull request creation requires a separate user decision.
