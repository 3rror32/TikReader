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

## Constraints

- Do not guess when multiple distinct gift IDs share the same name.
- Do not weaken Minecraft authorization, emergency, queue, interval, or budget checks.
- Do not change Bedrock command generation for the `diamonds` preset.
- Preserve distinct real TikTok gift IDs even when they share the same visible name.
- Accept legacy preset profiles containing `enabled`, but derive activity from an assigned gift ID.
- Keep authorization, connection, edition, session, scene, emergency, and configuration-generation invalidation checks for queued work.

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
  - Acceptance criteria:
    - Minecraft offers a text gift search comparable to the simulator.
    - No per-preset enable checkbox is rendered or persisted.
    - Assigning a gift activates the preset; removing the row clears the saved assignment.
    - Rose ID `5655` can be mapped to three zombies and verified live in Bedrock with donor `Gordo`.
  - Checks:
    - `node --test tests/test_minecraft_controls.cjs`.
    - Relevant Python preset and Bedrock tests.
    - Live Bedrock verification after the persisted mapping is updated.

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

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: about 520 authored changed lines across all six work units, excluding this task document.
- Chain strategy: `stacked-to-main` (selected by the user).
- Running authored changed lines: approximately 400 (MSG-1: 60; MSG-2: 138; MSG-6: approximately 200; task document excluded).
- Slice boundaries: MSG-1 at `4fa5a9e`; MSG-2 at `2996342f4350c1911acbec31a0fa3c5bac00f095`.

## Progress

- Exploration complete: simulation fallback IDs do not match persisted Minecraft gift IDs.
- Engram mirror: pending because no Engram memory tools are available in this session.

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

MSG-1, MSG-2, and MSG-6 are implemented; MSG-1 and MSG-2 were independently verified and live-tested in Minecraft Bedrock. MSG-6's focused FIFO/count, TNT, pluralization, cancellation, stop-rebase, and simulator tests pass. Full preset and server suites remain unresolved after partial failures and timeouts; live Minecraft verification for MSG-6 was skipped. MSG-3 through MSG-5 remain open. RDD assessment remains unavailable because `gentle-ai` is not on PATH; the Engram mirror remains pending because no Engram memory tools are available in this session.
