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

## Constraints

- Do not guess when multiple distinct gift IDs share the same name.
- Do not weaken Minecraft authorization, emergency, queue, interval, or budget checks.
- Do not change Bedrock command generation for the `diamonds` preset.

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

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: fewer than 240 authored changed lines across both work units, excluding this task document.
- Running authored changed lines: 198 (MSG-1: 60; MSG-2: 138; task document excluded).
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

## Next step

MSG-1 and MSG-2 are implemented and committed. The feature branch is ready for the parent to complete its RDD assessment and the user's ordinary delivery decision. Engram mirror remains pending because no Engram memory tools are available in this session.
