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
- [x] `SGD-02` Announce the first new gift of a simulation session without replaying initial historical snapshots.
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
- `SGD-02` The user explicitly authorized adding `app/server.py` to the edit surface. RED: `.venv\Scripts\python.exe -m pytest tests/test_simulation.py::SimulationTests::test_simulated_gift_record_has_explicit_origin_flag -q` failed because the record lacked `simulated`; `node --test tests/test_simulated_gift_voice.cjs` failed because the first simulated gift was not read.
- `SGD-02` GREEN: `.venv\Scripts\python.exe -m pytest tests/test_simulation.py tests/test_gift_ingestion.py -q` → 25 passed, 3 subtests passed. `$env:TEMP='C:\Users\Carlos\Documents\cedep\TikReaer'; $env:TMP=$env:TEMP; .\.venv\Scripts\python.exe -m pytest tests/test_server.py -k 'gift' -q` → 7 passed, 47 deselected; workspace temp was needed because sandbox temp access failed on the first attempt.
- `SGD-02` GREEN frontend: `node --test tests/test_simulated_gift_voice.cjs` → 1 passed; `node --test --test-name-pattern="gift voice priority|ordinary initial gift" tests/test_frontend.cjs tests/test_simulated_gift_voice.cjs` → 2 passed. Full `node --test tests/test_frontend.cjs` still has one failure at `tests/test_frontend.cjs:609` (`'0' !== '—'`) in the unrelated session-stat test; 59 other tests passed.
- `SGD-02` `git diff --check` → clean. Work-unit commit: `caea7b96258ec78528419ad323a72608a40f27ca` (`fix(simulation): announce first simulated gift`). SHA-256: `app/simulation.py` `56E5E2D1769768000EB2D4DF3212108D99D977A0880FECCEEB88D6D832183526`; `app/server.py` `D442C5CAE0B751DBFAA05E034DAE96A12FA9D536F3B9A1B3137B908489F1F18E`; `web/static/studio.js` `558FB8E653DB17679D6B1FFC4B7D8929C77B50A0F64F45FB890E1B310CA4FAA0`; `tests/test_simulation.py` `8C69FC387836122F9EB17DA70EF2B102CA6330357481315250242941D526F56D`; `tests/test_simulated_gift_voice.cjs` `EFB7BFEA91CEB81BC7374F3ACD61A49D13C7E7CC3643152957FFD5B3EF657F80`.
- `app/minecraft_connector.py` matches automatic gifts by exact `gift_id`; its manual play/test path bypasses that matching.
- `app/simulation.py` synthesizes `simulation-<name>` when a catalog ID is absent.
- `web/static/studio.js` suppresses processing while the first `gift_history` snapshot initializes `giftsReady`.
- RDD is unavailable because `gentle-ai` is not installed in this shell.

## Next step

Both tasks are implemented; parent review and spot-check remain.
