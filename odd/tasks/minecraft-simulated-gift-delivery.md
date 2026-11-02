# Minecraft Simulated Gift Delivery

## Objective

Ensure simulated and live gifts trigger their enabled Minecraft presets reliably and identify the donor in Minecraft chat.

## Problem

The simulator displays a typed gift name but assigns an unresolved synthetic gift ID. Minecraft mappings match exact persisted gift IDs, so the configured preset is never admitted and no Bedrock command is sent.

## Why

Simulation must exercise the same saved automation that a real gift would use; otherwise a successful-looking test can hide a production failure.

## Scope

- Resolve an unresolved simulated gift name against saved Minecraft mappings when there is exactly one safe identity match.
- Preserve catalog IDs and duplicate-name safety.
- Add a deterministic regression test for the reported `GG` scenario.
- Announce each successful preset once in Minecraft chat with the sanitized donor name and effective quantity.
- Replace synthetic `observed:*` catalog entries when a real gift with the same name becomes available.
- Treat an assigned gift as an active Minecraft preset without a separate enable toggle.
- Add text search to the Minecraft gift picker and make removal clear the persisted assignment.
- Capitalize the donor's first alphabetic character without changing the rest of the username casing.
- Queue every valid Minecraft gift in FIFO order and use the configured interval as execution spacing instead of an admission rejection.
- Preserve the incoming gift count through preset execution and describe one versus multiple gifts with singular/plural chat wording.
- Persist every valid Minecraft donation until its mapped effects are confirmed, including across pause, disconnect, and application restart.
- Pace spawned objects at 20 per 30 seconds, one object at a time, while retaining overflow in a fair donor-aware queue.
- Replace the passive help/recent-log layout with an always-visible Activity and queue board that exposes the current effect, next wave, countdown, backlog pressure, and failures.

## Constraints

- Do not guess when multiple distinct gift IDs share the same name.
- Do not weaken Minecraft authorization, emergency, queue, interval, or budget checks.
- Do not change Bedrock command generation for the `diamonds` preset.
- Preserve distinct real TikTok gift IDs even when they share the same visible name.
- Accept legacy preset profiles containing `enabled`, but derive activity from an assigned gift ID.
- Keep authorization, connection, edition, session, scene, emergency, and configuration-generation invalidation checks for queued work.
- Never reject or silently discard a valid donation because throughput capacity is exhausted; pause unsafe execution while preserving durable pending state.
- Deduplicate replayed TikTok gifts by their stable event identity before adding effects to the durable queue.

## Authorized scope

The user explicitly requested correction of simulated gifts that appear in the test chat but do not reach an active, enabled Minecraft connection.

## Tasks

- [x] **MSG-1 — Resolve and deliver saved simulated gift mappings**
  - Route: delegated direct.
  - Trigger evidence: behavior change and regression coverage require coordinated, non-trivial edits to `app/simulation.py` and `tests/test_simulation.py`; reading that prepares the write belongs to the writer.
  - Test-first policy: observe the focused regression fail before implementation, then pass after the fix.
  - Acceptance criteria:
    - A typed simulated `GG` gift resolves to the unique enabled saved Minecraft mapping when the catalog does not provide an ID.
    - The mapped `diamonds` preset is admitted with the donor and count preserved.
    - Ambiguous same-name mappings are not guessed.
    - Existing catalog-backed simulation behavior remains green.
  - Checks:
    - Focused regression test in `tests/test_simulation.py`.
    - Relevant simulation and Minecraft test modules.
    - Parent spot check of one reported command.
  - Evidence: regression observed RED (`simulation-GG` instead of `saved-gg-id`), then GREEN after the fix; added coverage for donor, streak count, and duplicate saved mapping names.
  - Commit: `4fa5a9e` (`fix(simulation): resolve saved Minecraft gift mappings`).
  - RDD assessment: unavailable/unknown; `gentle-ai` is not available on the parent PATH.

- [x] **MSG-2 — Announce donor and quantity in Minecraft chat**
  - Route: delegated direct.
  - Trigger evidence: safe cross-edition message construction, preset-job ordering, and regression coverage require coordinated non-trivial edits across preset definitions, connector execution, and tests.
  - Test-first policy: observe focused announcement regressions fail before implementation, then pass after the fix.
  - Acceptance criteria:
    - A successful zombie gift announces `Simulador te envió 1 Zombie` for the simulated donor.
    - The diamonds preset announces `Simulador te envió 5 diamantes`.
    - A real donor name replaces `Simulador` after existing sanitization.
    - Each selected preset announces once, after its action commands succeed, without multiplying announcements for mobs, TNT, or streaks.
    - Java and Bedrock use valid native chat command syntax.
    - Rejected, cancelled, or failed actions do not claim that the gift was delivered.
  - Checks:
    - Focused preset and connector regression tests.
    - Relevant simulation, preset, and Bedrock modules.
    - Parent spot check of one reported command.
  - Evidence: focused regressions observed RED before implementation (3 failed: announcement generator missing, job metadata missing, and Java wrapped summons unconfirmed), then GREEN (4 passed). MSG-2 changed 138 authored lines (134 additions, 4 deletions; task document excluded). Java RCON cannot confirm `tellraw` success, so its notification log remains `unconfirmed`; no retry is issued.
  - Commit: `2996342f4350c1911acbec31a0fa3c5bac00f095` (`feat(minecraft): announce successful preset gifts`).
  - RDD assessment: unavailable/unknown; `gentle-ai` is not available on the parent PATH.

- [ ] **MSG-3 — Canonicalize real and observed gift catalog entries**
  - Route: delegated direct.
  - Trigger evidence: startup restoration, live catalog merging, persistence, and regression coverage require coordinated non-trivial changes in server catalog logic and tests.
  - Test-first policy: add focused fallback/merge regressions and observe failure before implementation.
  - Acceptance criteria:
    - A real gift removes a same-name synthetic `observed:*` entry.
    - Two distinct real IDs with the same name remain available.
    - Restored caches are normalized before either UI receives the catalog.
  - Checks:
    - Focused server catalog tests.
    - Relevant simulation tests.

- [ ] **MSG-4 — Derive preset activity from gift assignment**
  - Route: delegated direct.
  - Trigger evidence: profile migration, backend admission, queued-job validity, simulator fallback, donor formatting, and regression coverage cross multiple non-trivial files.
  - Test-first policy: observe focused migration/admission/name regressions fail before implementation, then pass after the change.
  - Acceptance criteria:
    - Any preset with a non-empty gift ID is active; an unassigned preset is inactive.
    - Legacy `enabled: false` does not disable an assigned gift, and legacy profiles load without data loss.
    - Simulator name fallback uses assigned mappings and keeps ambiguity safety.
    - `gordo` becomes `Gordo`, while existing internal uppercase characters remain unchanged.
  - Checks:
    - Focused preset, connector, and simulation tests.

- [ ] **MSG-5 — Search and simplify Minecraft gift mappings**
  - Route: delegated direct.
  - Trigger evidence: the behavior spans JavaScript state, rendered controls, persistence, CSS layout, and DOM regression tests.
  - Test-first policy: add DOM regressions for search, removal, and absence of the enable checkbox before implementation.
  - Search behavior for this work unit: render a compact, Spanish-labeled text filter inside each Minecraft gift picker; filter gift options by case-insensitive name as the query changes; preserve the selected-gift trigger and existing save flow; announce no matches accessibly; keep filtered arrow-key navigation and Escape-to-close behavior usable.
  - Test-first scope for this work unit: add DOM regressions proving the picker contains the filter, matching is case-insensitive, choosing a filtered gift saves its catalog ID and name, clearing restores the catalog, empty results are announced without a selectable placeholder, and keyboard navigation/Escape continue to work; observe RED before implementation.
  - Acceptance criteria:
    - Minecraft offers a text gift search comparable to the simulator.
    - No per-preset enable checkbox is rendered or persisted.
    - Assigning a gift activates the preset; removing the row clears the saved assignment.
    - Rose ID `5655` can be mapped to three zombies and verified live in Bedrock with donor `Gordo`.
  - Checks:
    - `node --test tests/test_minecraft_controls.cjs`.
    - Relevant Python preset and Bedrock tests.
    - Live Bedrock verification after the persisted mapping is updated.
  - Evidence (search increment): the added DOM regression was RED before implementation because the picker had no search input (44 passed, 1 failed); after implementation `node --test tests/test_minecraft_controls.cjs` passed (45 tests). `git diff --check` passed. Python and live Bedrock checks remain pending for MSG-5.
  - Commit: `5e5f77a` (`feat(minecraft): search gifts in preset picker`).

- [x] **MSG-6 — Queue valid Minecraft gifts with execution spacing**
  - Route: delegated direct.
  - Trigger evidence: admission ownership, FIFO reservations, interval timing, budget accounting, stale-job validation, and safety regression coverage require coordinated non-trivial connector and test changes.
  - Test-first policy: add focused regressions that demonstrate the current pending-owner and interval rejections before changing admission.
  - Acceptance criteria:
    - Multiple valid gifts are admitted and processed in FIFO order by the existing serial worker.
    - The configured interval delays the next job instead of rejecting it.
    - Legitimate queue waiting does not expire solely because it exceeded the previous ten-second age limit.
    - Each queued job owns an independent reservation and preserves its donor, count, commands, and announcement.
    - A single “You're awesome” gift mapped to TNT is admitted and triggers the TNT preset.
    - Two Creeper gifts with a configured quantity of three each emit six mob commands.
    - Minecraft announcements use singular wording for a total of one and plural wording for totals of two or more; invariant TNT wording remains `1 TNT` / `2 TNT`.
    - Simulator event text uses singular for one gift and plural for two or more while retaining the selected display name.
    - Queue overflow remains observable, while disconnect, edition/session/configuration changes, stop, emergency, and incompatible scene changes still invalidate unsafe pending work.
  - Checks:
    - Focused preset queue and singular/plural RED/GREEN tests with a deterministic clock.
    - Focused simulator event wording tests.
    - `tests/test_minecraft_presets.py`, `tests/test_simulation.py`, and `tests/test_server.py`.
    - Live back-to-back simulated Rose verification after the mapping is updated.
  - Evidence: focused regressions were RED before implementation (queue rejected a second gift, mob chat lacked plural forms, and simulator text lacked singular/plural wording). GREEN afterward: FIFO/count, TNT quantity one, Spanish plural labels, canceled-job retirement, stop schedule rebasing, and simulator singular/plural regressions passed. Final focused preset selection passed (5 tests); cancellation/budget/plural selection passed independently (4 tests); stop-rebase/canceled-wait selection passed (2 tests); and the simulator suite passed (20 tests, 3 subtests; 2 dependency deprecation warnings). The complete preset suite emitted partial output containing a failure and did not complete; `tests/test_server.py` emitted `F..` and exceeded 60 seconds. Both full-suite outcomes remain unresolved. No live Minecraft verification was run for this work unit.

- Commit: `08c2d4a` (`fix(minecraft): queue simulated gift presets reliably`).

- [x] **MSG-7 — Add an in-popover search field to simulator gift pickers**
  - Route: delegated direct.
  - Trigger evidence: picker behavior, responsive styling, and DOM regressions require coordinated non-trivial edits to `web/static/simulation.js`, `web/static/simulation.css`, and `tests/test_simulation_ui.cjs`.
  - Test-first policy: add focused DOM regressions and observe them fail before implementing the picker changes.
  - Acceptance criteria:
    - Both full simulator and floating chat gift popovers contain a distinct, accessible search field while the `Regalo` input continues to show the selected gift.
    - Opening the picker clears its query and displays the full catalog; case-insensitive query changes filter options, and clearing restores the catalog.
    - Selecting an option preserves its gift ID and updates the selected gift artwork and diamond preview.
    - No matches are announced accessibly, and arrows, Enter, Escape, and Tab remain usable without breaking close behavior.
    - Existing simulator submit payload and gift ID behavior stay unchanged.
  - Checks:
    - `node --test tests/test_simulation_ui.cjs`.
    - Parent spot check of that exact command.
  - Evidence: the test-first run was RED (4 failed, 4 passed) because both picker surfaces lacked the search field and keyboard/no-result behaviors. After implementation, the exact focused command passed (8 tests, 0 failures); coverage includes both surfaces, case-insensitive filtering, query reset/clear, selected ID and preview, no-match status, arrows/Enter, Escape, Tab, and unchanged submit payload. Parent spot check passed (8 tests, 0 failures).
  - Commit: `f4134d7` (`feat(simulation): search gifts in chat picker`).
  - Engram mirror: pending because no Engram memory tools are available in this session.

- [x] **MSG-8 — Persist and pace the fair Minecraft effect queue**
  - Route: delegated direct.
  - Trigger evidence: durable storage, replay-safe identities, fair scheduling, per-object pacing, pause/reconnect recovery, execution confirmation, and regression coverage span multiple non-trivial backend files.
  - Reopen reason: MSG-6 admitted FIFO jobs but still allowed saturation rejection and invalidated pending work on stop or disconnect; the user replaced that contract with durable eventual execution.
  - Test-first policy: observe focused failures for saturation retention, restart recovery, duplicate replay, five-object rotation, pause preservation, and 20-per-30-second pacing before implementation.
  - Acceptance criteria:
    - Every valid live or simulated gift is durably recorded before execution and is never rejected because the throughput budget is full.
    - Stable gift identities prevent a replayed event from executing twice.
    - Zombies and TNT execute one at a time at a default rate of 20 objects per 30 seconds.
    - After five objects from one donation, another ready donor receives a turn before the first donation continues.
    - Pause, disconnect, process restart, and temporary Minecraft failure preserve the remaining quantity for later execution.
    - Manual Test clicks enqueue repeatedly through the same paced scheduler.
    - Gift reception and individual Minecraft execution confirmation remain separately observable.
  - Checks:
    - Focused RED/GREEN selections in `tests/test_minecraft_presets.py`.
    - Relevant persistence and gift-ingestion regressions without modifying pre-existing unrelated working-tree changes.
    - Parent spot check of one reported focused command.
  - Evidence: the four new deterministic regressions were RED before implementation (4 failed: unsupported rate shape, missing durable store API, absent fair scheduler, and saturation rejection) and GREEN afterward (4 passed). The durable SQLite queue deduplicates stable event IDs, retains per-object progress through reopen/restart, and stores repeated command groups compactly; manual tests receive unique identities. The scheduler confirms one object at a time, derives 1.5 seconds from 20 objects per 30 seconds, rotates to another donor after five successful objects, and preserves work across pause, disconnection, and temporary failures. Legacy `{interval, per_minute}` profiles remain accepted with an effective interval that respects both former limits. The snapshot exposes current/next/pending summaries, remaining quantities, pacing countdown, backlog pressure, and failure count for MSG-9. The former transient job queue is only a wake-up path; durable SQLite rows are authoritative.
  - Correction evidence: independent review found stop did not pause durable work and an unready Bedrock row could block Java-ready work. The two focused regressions were RED before correction (2 failed) and GREEN afterward (2 passed). Stop now persists an effective queue pause without deleting rows; the local `/minecraft/presets/resume` endpoint resumes the same queue, and the snapshot exposes `effect_queue.paused`. Scheduling now filters rows by current edition and active mapping before fair selection, retaining unready rows for later.
  - Checks: `.\.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py -q` passed after MSG-8 (44 tests, 298 subtests) and after the correction (46 tests, 298 subtests). `git diff --check -- app/minecraft_connector.py app/minecraft_presets.py app/history_store.py tests/test_minecraft_presets.py odd/tasks/minecraft-simulated-gift-delivery.md` passed. No live Minecraft connection was used.
  - Commit: `56e6306` (`feat(minecraft): persist paced gift queue`).
  - Correction commit: `6c05801` (`fix(minecraft): preserve paused queue execution`).

- [x] **MSG-9 — Make Activity and queue the Minecraft control center**
  - Route: delegated direct.
  - Trigger evidence: snapshot/API state, DOM structure, responsive styling, accessible live updates, configuration controls, and UI regressions require coordinated non-trivial edits across backend, JavaScript, CSS, and tests.
  - Test-first policy: observe DOM regressions fail for removed Help, merged Rhythm controls, always-visible Activity, next-wave countdown, queue pressure, and current/next/pending rows before implementation.
  - Acceptance criteria:
    - Help is removed and Advanced options plus Safety limits become one plain-language `Ritmo y cola` section.
    - `Actividad y cola` is always expanded and shows the executing effect, next effect, donor, gift, remaining quantity, failures, and estimated wait.
    - A visible 30-second wave countdown says `Espera la siguiente oleada de regalos` and creates the requested Tetris-like anticipation without releasing pending effects simultaneously.
    - Queue pressure is classified as normal, accumulating, or saturated without rejecting valid donations.
    - Controls configure the object count and period while displaying the derived interval.
    - Pause and resume preserve pending work; no ordinary control silently clears the queue.
    - Queue status is announced politely, the ticking number is not announced each second, keyboard focus stays visible, and the board stacks on narrow screens without adding motion.
  - Checks:
    - `node tests/test_minecraft_controls.cjs`: RED before implementation (3 failures, 53 passed); GREEN after implementation (56 passed, 0 failed).
    - `\.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py -q`: passed, 46 tests and 298 subtests.
    - `git diff --check -- app/minecraft_connector.py app/minecraft_presets.py web/static/minecraft.js web/static/minecraft.css tests/test_minecraft_controls.cjs tests/test_minecraft_presets.py odd/tasks/minecraft-simulated-gift-delivery.md`.
    - No visual browser or live Minecraft check was run.
  - Evidence: the new DOM regressions failed before the UI change because pause controls, queue execution details, and object/period controls were absent. The final view removes Help, combines rate and connection options under `Ritmo y cola`, keeps Activity expanded, and provides current/next cards, pending/failure/wait metrics, pressure state, endpoint-backed pause/resume, and the queue-timed wave lane. The backend snapshot supplies its period, object budget, derived interval, and countdown. Countdown updates are excluded from live announcements, while queue state uses a polite live status. CSS retains the existing border/glass/teal tokens and stacks the board on narrow screens.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: revise to about 1,500 authored changed lines across all nine work units, excluding task-document changes; MSG-8 and MSG-9 together added 836 authored lines.
- Chain strategy: `stacked-to-main` (selected by the user).
- Running authored changed lines: approximately 1,349 after MSG-9 (prior MSG-1/2/6/7 estimate: 513; MSG-8 and correction: 623; MSG-9: 213; task document excluded).
- Slice boundaries: MSG-1 at `4fa5a9e`; MSG-2 at `2996342f4350c1911acbec31a0fa3c5bac00f095`; MSG-5 search at `5e5f77a`; MSG-6 at `08c2d4a`; MSG-7 at `f4134d7` (stacked to main).

## Progress

- Exploration complete: simulation fallback IDs do not match persisted Minecraft gift IDs.
- MSG-7 implementation and focused DOM checks are complete; parent commit and spot check remain pending.
- Engram mirror: pending because no Engram memory tools are available in this session.
- MSG-8 and MSG-9 were added after the user replaced saturation rejection with durable eventual execution and promoted Activity and queue to the primary Minecraft operations surface.
- MSG-8 is implemented and committed; its parent spot check passed with 46 tests and 298 subtests. MSG-9 implementation and focused checks are complete.

## Verification evidence

Verification results:

- `tests/test_simulation.py::SimulationTests::test_simulated_unresolved_gift_reaches_unique_saved_minecraft_mapping -q`: RED before implementation (`simulation-GG` did not equal `saved-gg-id`); the same regression passed after the fix.
- `.\.venv\Scripts\python.exe -m pytest tests/test_simulation.py -q`: passed, 19 tests and 3 subtests; 2 existing dependency deprecation warnings.
- `.\.venv\Scripts\python.exe -m pytest tests/test_simulation.py tests/test_points_minecraft.py tests/test_minecraft_bedrock.py -q`: the sandbox run was limited by SQLite and loopback socket permissions; an independent rerun with the normal sandbox escalation passed, 46 tests and 29 subtests with 2 dependency deprecation warnings.
- Live Bedrock verification: TikReader was restarted on the candidate, Minecraft was reconnected and authorized, the persisted `GG` → `Diamantes` action was confirmed enabled, and a simulated `GG` produced `Éxito confirmado · diamonds · simulador · paso 1/1: Dio Diamante * 5` in the Minecraft log. Minecraft chat independently displayed `Recibiste Diamante * 5`.
- The simulator activity message `Juegos · No hay una acción para este regalo...` belongs to the separate game-hotkey integration and does not describe Minecraft delivery; Minecraft success is recorded in the Minecraft recent log.
- `tests/test_minecraft_presets.py` focused MSG-2 regressions: RED before implementation (3 failures) and GREEN after implementation (4 passed, 28 deselected).
- `.\.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py -q`: passed, 33 tests and 298 subtests.
- `.\.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py tests/test_minecraft_bedrock.py tests/test_simulation.py -q`: sandbox attempt failed 7 Bedrock loopback tests with `WinError 10013`; the exact command rerun with sandbox escalation passed, 63 tests and 307 subtests, with 2 existing dependency deprecation warnings.
- Independent MSG-2 verification found no actionable issues; `.\.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py tests/test_minecraft_bedrock.py -q` passed with loopback access (44 tests and 304 subtests).
- Live donor-announcement verification: TikReader was restarted on `2996342f`, Minecraft Bedrock was reconnected, and a simulated catalog-backed `GG` from `Simulador` executed the enabled zombie preset. Minecraft chat displayed `Simulador te envió 3 Zombie`, matching the preset's configured quantity of three. The deterministic diamonds regression separately verifies `Simulador te envió 5 diamantes`.

## Next step

MSG-1, MSG-2, MSG-6, MSG-8, and MSG-9 are implemented; MSG-1 and MSG-2 were independently verified and live-tested in Minecraft Bedrock. MSG-6's focused FIFO/count, TNT, pluralization, cancellation, stop-rebase, and simulator tests pass, but its saturation/cancellation contract is superseded by MSG-8. MSG-8's focused suite and parent spot check passed with 46 tests and 298 subtests; its work-unit commit is `56e6306`. MSG-9's focused Node suite passes 56 tests and its Python suite passes 46 tests and 298 subtests. MSG-3 through MSG-5 remain open. RDD assessment remains unavailable because `gentle-ai` is not on PATH; the Engram mirror remains pending because no Engram memory tools are available in this session.
