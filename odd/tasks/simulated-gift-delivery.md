# Simulated gift delivery

## Objective

Make simulated gifts follow the same effective contract as finalized LIVE gifts so voice announcements and Minecraft presets react reliably.

## Problem and why

A simulated gift can fail in two independent places. Minecraft matches configured presets by exact catalog `gift_id`, while free-text simulation may synthesize a different ID. Separately, the first gift update after a simulation session starts is treated by the browser as an initial history snapshot, so the gift reader does not announce it.

## Authorized scope

- Resolve simulated gift names to the correct catalog identifier when possible and preserve explicit catalog identifiers.
- Deliver the first new simulated gift to voice without replaying historical gifts on ordinary startup/reconnection.
- Preserve finalized-streak semantics, Minecraft authorization/safety gates, and real LIVE ingestion behavior.
- Add deterministic backend and frontend regressions.

## Constraints

- Do not weaken Minecraft authorization, emergency, scene, cooldown, queue, or usage limits.
- Do not announce old gift history as new audio.
- Do not change real TikTok gift IDs or remote/live behavior.
- Engram mirror is pending because no Engram memory tools are available.

## Delivery strategy

`exception-ok`: two focused work units, forecast below 250 authored changed lines.

## Tasks

- [x] `SGD-01` Resolve simulated free-text/catalog gifts to the identifier used by Minecraft presets.
  - Route: delegated direct.
  - Trigger: backend behavior and deterministic regression span multiple non-trivial files.
  - Test-first policy: reproduce a GG name/ID mismatch as RED, then implement GREEN while preserving explicit IDs and duplicate-name disambiguation.
  - Acceptance: a simulated GG activates a preset configured with GG's catalog ID; explicit catalog IDs remain unchanged; unknown gifts remain bounded and deterministic; Minecraft safety gates remain active.
- [ ] `SGD-02` Announce the first new gift of a simulation session without replaying initial historical snapshots.
  - Route: delegated direct.
  - Trigger: browser gift-state logic and simulation/session behavior require coordinated regression coverage.
  - Test-first policy: reproduce the discarded first simulated gift as RED and retain a regression that historical bootstrap gifts stay silent.
  - Acceptance: the first finalized simulated gift reaches the gift voice queue when enabled; ordinary initial history remains silent; subsequent real and simulated gifts are not duplicated.

## Applicable checks

- Focused simulation backend tests.
- Focused Studio/gift voice frontend tests.
- Minecraft preset regression tests.
- `git diff --check`.
- Parent spot-check of one reported command.

## Evidence

- `SGD-01` RED: `\.venv\Scripts\python.exe -m pytest tests/test_simulation.py -q` failed only `test_simulation_does_not_guess_between_duplicate_catalog_names` (expected safe synthetic ID, got first duplicate catalog ID).
- `SGD-01` GREEN: `\.venv\Scripts\python.exe -m pytest tests/test_simulation.py tests/test_minecraft_presets.py -q` → 44 passed, 301 subtests passed; two upstream deprecation warnings.
- `SGD-01` `git diff --check` → clean. Work-unit commit: `dc7967da318dd31fbaca165d0dafc2b7898c7717` (`fix(simulation): resolve gift catalog identifiers`). SHA-256: `app/simulation.py` `32D889DB61313337414E98752A81F4EC02151CC0D17877E342EEB6818219851A`; `tests/test_simulation.py` `60A79B65F3A5C03E79ADE6649BF95F47C51A0C584AAB6ACE097484727458777E`.
- `app/minecraft_connector.py` matches automatic gifts by exact `gift_id`; its manual play/test path bypasses that matching.
- `app/simulation.py` synthesizes `simulation-<name>` when a catalog ID is absent.
- `web/static/studio.js` suppresses processing while the first `gift_history` snapshot initializes `giftsReady`.
- RDD is unavailable because `gentle-ai` is not installed in this shell.

## Next step

Implement SGD-01 and SGD-02 with RED/GREEN evidence and verify both consumers.
