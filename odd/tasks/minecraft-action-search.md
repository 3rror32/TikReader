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
- [x] `MCA-2` Configured actions use a default Todos list, section filters, and one grouped Mob category selector with non-mutating filter, count, edition, polling, and keyboard behavior.

## Route and estimate
- Chosen route: delegated direct.
- Trigger evidence: preparation trigger and a coordinated UI, style, and browserless-test change across 3 non-trivial files.
- Estimated authored changed lines: approximately 501 across MCA-1 and MCA-2 (task heuristic; additions plus deletions).
- Delivery strategy: `ask-on-risk`.
- Chain strategy: `stacked-to-main`, selected explicitly by the user before the MCA-2 work-unit commit.

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

## MCA-2: Todos view, section filters, and Mob category selector

### Authorized scope
- `web/static/minecraft.js`
- `web/static/minecraft.css`
- `tests/test_minecraft_controls.cjs`
- `odd/tasks/minecraft-action-search.md`

### Objective and acceptance criteria
- Default to a single Todos list containing every added action, regardless of enabled or gift state.
- Show top filters for Todos, Ambiente, Habilidades, Objetos, and Mobs with counts of added actions. Filtering must only change row visibility.
- Include section context on rows in Todos; Mob rows identify their category.
- Replace eight Mob tabs with one labeled category selector containing all categories plus only currently populated categories, grouped under Superficie, Dimensiones, and Encuentros where supported.
- Category selection filters Mob rows only. Removing the selected category resets safely to all categories.
- Adding actions exposes them immediately in Todos without changing the current filter. Removal, editions, and polling keep counts and filters coherent without mutating saved presets.
- Preserve accessible keyboard navigation and all MCA-1 searchable-picker behaviors.

### Route and estimate
- Chosen route: delegated direct.
- Trigger evidence: coordinated JavaScript, CSS, and browserless-test refactor; reading the existing navigation lifecycle prepares this multi-file write.
- MCA-1 estimate: approximately 180 authored changed lines (recorded before implementation).
- MCA-2 forecast: approximately 300 authored changed lines; running feature forecast: approximately 480 authored changed lines. Generated files excluded.
- Delivery strategy: `ask-on-risk` (unchanged).
- Selected chain strategy: `stacked-to-main`.
- Planned slice 1: searchable action picker, commits `675c8fa` and `c0f1d86`; no pull request created.
- Planned slice 2: unified Todos/filter/Mob-selector work unit at `70f75a9` plus its ODD evidence commit; no pull request created.

### Progress and checks
- MCA-2 status: complete; implementation and required verification passed.
- Engram mirror status: pending (provider unavailable).
- RED: `node --test tests/test_minecraft_controls.cjs` exited 1 before source implementation: 54 tests, 49 passed, 5 failed; new assertions exposed the missing Todos/filter UI and grouped Mob selector.
- Activation-policy regression RED: `node --test tests/test_minecraft_controls.cjs` exited 1 after restoring the paused-first-gift expectation: 53 passed, 1 failed because the add flow still carried automatic enabled state.
- Final GREEN: `node --test tests/test_minecraft_controls.cjs` exited 0 after restoring the pre-MCA-2 serialization and add behavior: 54 tests, 54 passed, 0 failed.
- Required verification plan: run exactly `node --test tests/test_minecraft_controls.cjs`; run scoped `git diff --check`; structurally read back filter semantics and responsive CSS.
- Verification evidence: `node --test tests/test_minecraft_controls.cjs` exited 0 (54 passed, 0 failed). `git diff --check -- web/static/minecraft.js web/static/minecraft.css tests/test_minecraft_controls.cjs odd/tasks/minecraft-action-search.md` exited 0 with only Git's LF-to-CRLF warning for the ignored task document. Structural readback confirmed toolbar/pressed semantics, roving keyboard focus, labeled native category combobox, non-empty grouped options/counts, and compact responsive CSS; no Mob tab strip remains.
- Activation policy is unchanged: newly added actions remain paused after a gift is assigned until the user explicitly enables them; preset serialization requires a gift and an explicitly checked checkbox.
- Final policy-preservation verification: `node --test tests/test_minecraft_controls.cjs` exited 0 (54 passed, 0 failed); scoped `git diff --check` exited 0 with only the task-document LF-to-CRLF warning.
- Parent spot check: `node --test tests/test_minecraft_controls.cjs` passed (54 tests, 0 failures) on the final candidate.
- Independent verification: passed after restoring the original activation serialization guard; no remaining actionable findings.
- Work-unit commit: `70f75a9` (`feat(minecraft): unify configured action filters`).
- RDD status/outcome: unavailable. Post-commit assessment and the committed-only preflight from base `57a3ea1` could not start because the `gentle-ai` executable is absent; no receipt or approval was inferred.

### Next step
Implementation is complete. Pull-request creation remains a separate user decision; the selected strategy is `stacked-to-main`.

## Next step
Implementation is complete. Preserve the two planned `stacked-to-main` slices if pull requests are created later.
