# Minecraft Simulated Gift Delivery

## Objective

Ensure a simulated gift such as `GG` triggers its enabled Minecraft preset even when the live TikTok gift catalog is unavailable or stale.

## Problem

The simulator displays a typed gift name but assigns an unresolved synthetic gift ID. Minecraft mappings match exact persisted gift IDs, so the configured preset is never admitted and no Bedrock command is sent.

## Why

Simulation must exercise the same saved automation that a real gift would use; otherwise a successful-looking test can hide a production failure.

## Scope

- Resolve an unresolved simulated gift name against saved Minecraft mappings when there is exactly one safe identity match.
- Preserve catalog IDs and duplicate-name safety.
- Add a deterministic regression test for the reported `GG` scenario.

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
  - Commit: `44f93f6` (`fix(simulation): resolve saved Minecraft gift mappings`).
  - RDD assessment: unavailable/unknown; `gentle-ai` is not available on the parent PATH.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: fewer than 120 authored changed lines, excluding this task document.
- Running authored changed lines: 60 (9 additions and 1 deletion in `app/simulation.py`; 50 additions in `tests/test_simulation.py`; task document excluded).
- Slice boundaries: one work unit expected.

## Progress

- Exploration complete: simulation fallback IDs do not match persisted Minecraft gift IDs.
- Engram mirror: pending because no Engram memory tools are available in this session.

## Verification evidence

Verification results:

- `tests/test_simulation.py::SimulationTests::test_simulated_unresolved_gift_reaches_unique_saved_minecraft_mapping -q`: RED before implementation (`simulation-GG` did not equal `saved-gg-id`); the same regression passed after the fix.
- `.\.venv\Scripts\python.exe -m pytest tests/test_simulation.py -q`: passed, 19 tests and 3 subtests; 2 existing dependency deprecation warnings.
- `.\.venv\Scripts\python.exe -m pytest tests/test_simulation.py tests/test_points_minecraft.py tests/test_minecraft_bedrock.py -q`: partial, 37 passed and 9 failed (29 subtests passed). The two points tests could not open SQLite files under the sandbox temp directory; all nine Bedrock tests were blocked by `WinError 10013` when opening local sockets. The simulation tests in this command passed.

## Next step

MSG-1 is committed locally. Engram mirror remains pending because no Engram memory tools are available in this session; the broader verification command also remains limited by sandbox SQLite and socket permissions.
