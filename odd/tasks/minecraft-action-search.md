# Minecraft action search

## Objective
Replace the long Minecraft “Acción para agregar” select with an accessible searchable picker that helps users find and distinguish actions while preserving explicit add behavior and existing payloads.

## Problem and why
The current select lists the full catalog in one native control and offers little context beyond an action name and category. Search by metadata and familiar terms will reduce scanning and make similar actions easier to distinguish.

## Scope and constraints
- Add a bounded, keyboard-operable combobox/listbox with normalized Spanish search and useful action metadata and aliases.
- Preserve selected-action/category navigation, explicit “Agregar acción”, busy/safety guards, and backend payloads.
- Reuse the Minecraft panel's existing colors and control styling; do not redesign unrelated controls.
- Preserve pre-existing unrelated user changes. The parent owns the isolated work-unit commit.

## Authorized scope
- `web/static/minecraft.js`
- `web/static/minecraft.css`
- `tests/test_minecraft_controls.cjs`
- `odd/tasks/minecraft-action-search.md`

## Acceptance criteria
- [x] `MCA-1` Searchable accessible picker is implemented, focused tests and required verification pass, and feature progress is recorded.

## Route and estimate
- Chosen route: delegated direct.
- Trigger evidence: preparation trigger and a coordinated UI, style, and browserless-test change across 3 non-trivial files.
- Estimated authored changed lines: approximately 180 (task heuristic only).
- Delivery strategy: `ask-on-risk`.

## Progress
- Initial exploration confirmed the action picker is created in `web/static/minecraft.js` and current action/category behavior is preserved by `addActionButton`.
- Skill resolution: frontend-design loaded; work-unit-commits unavailable at the requested path and not found in searched skill roots (`fallback-path`).
- Implemented a Spanish accent-normalized combobox with name/description/ID/category/section search, TNT and item-giving aliases, eight-row suggestions, and ArrowUp/ArrowDown/Enter/Escape handling. The explicit add button still performs the existing selected-action/category update path.
- Preserved pointer selection by cancelling the option's pointerdown default so the input does not blur and hide the option before its click handler runs.
- Engram mirror status: pending (provider unavailable).
- Work-unit commit: `675c8fa` (`feat(minecraft): add searchable action picker`).
- RDD status/outcome: unavailable. Both post-commit assessment and committed-only preflight could not start because the `gentle-ai` executable is absent from this session; no receipt or approval was inferred.
- Engram mirror remains pending because no memory provider is available in this session.
- Implementation and required checks are complete. The feature task file is ignored by repository rule `.gitignore:40` (`/odd/`) and is force-staged only for its isolated documentation commit.

## Verification evidence
- RED: `node --test tests/test_minecraft_controls.cjs` exited 1 before implementation: 45 passed, 2 new picker tests failed because the searchable control was absent.
- Follow-up regression RED: the same command exited 1 before the pointerdown fix: 47 passed, 1 failed; the simulated blur hid the option and the selection stayed empty.
- Follow-up GREEN: the same command exited 0 after the pointerdown fix: 48 passed, 0 failed.
- Polling regression RED: `node --test tests/test_minecraft_controls.cjs` exited 1 before active-option preservation: 48 passed, 1 failed; polling cleared `aria-activedescendant` for the second suggestion before Enter.
- Polling regression GREEN: the same command exited 0 after preserving the active action ID through refresh: 49 passed, 0 failed.
- Required command `node --test tests/test_minecraft_controls.cjs`: passed (49 tests, 0 failures).
- Structural readback: confirmed combobox/listbox roles, name/category/description result labels, bounded scrollable menu, active-option styling, and keyboard handlers in the JS/CSS; passed.
- `git diff --check -- web/static/minecraft.js web/static/minecraft.css tests/test_minecraft_controls.cjs odd/tasks/minecraft-action-search.md`: exited 0 with no output; passed.
- Follow-up `git diff --check -- web/static/minecraft.js tests/test_minecraft_controls.cjs odd/tasks/minecraft-action-search.md`: exited 0 with no output; passed.
- Parent spot check `node --test tests/test_minecraft_controls.cjs`: passed (49 tests, 0 failures).
- Independent verification: passed after one correction; confirmed active keyboard selection survives polling and pointer selection survives blur-before-click ordering.
- Post-commit `gentle-ai review assess --cwd <repo> --agent codex --base-ref 57a3ea1 --committed-only --json`: unavailable because `gentle-ai` was not found.
- Committed-only native review preflight for base `57a3ea1`: unavailable for the same reason.

## Next step
Optional visual smoke test in the running Minecraft panel; no functional implementation work remains.
