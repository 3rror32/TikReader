# Simulation Gift Visuals and Minecraft Reactions

## Objective

Make simulated gifts easy to recognize in the test chat and ensure they exercise the configured Minecraft reaction path exactly like real gifts.

## Problem and why

The test-chat feed currently renders gift events as text such as `Rose x 1`, even when the gift catalog provides an image. Simulated Minecraft reactions also depend on the exact catalog gift ID, so the end-to-end behavior needs explicit coverage to prevent configured mob reactions from being skipped or losing the visible donor name.

## Authorized scope

- Add gift image metadata to simulation event records without weakening URL validation.
- Render a compact gift image, quantity, accessible label, and resilient fallback in the test-chat dock.
- Preserve the catalog gift ID through simulated delivery so configured Minecraft presets run with the donor name visible on spawned mobs.
- Add focused deterministic tests for both behaviors.

## Constraints

- Preserve all pre-existing worktree changes and avoid `.tmp` and vendored files.
- Keep technical artifacts and test names in English.
- Do not change real TikTok gift behavior or Minecraft preset semantics outside the simulated path.
- Engram recovery tools are unavailable in this session; the required mirror under `odd/simulation-gift-visuals-minecraft/tasks` is pending.

## Delivery strategy

- Strategy: `ask-on-risk`.
- Forecast: approximately 180 authored changed lines, excluding generated files.
- Branch: `codex/minecraft-command-results` (already a non-default feature branch).
- Initial reviewed boundary: `986e05a06764d4feff8621f1d9fa9ba4af832aa4`.

## Tasks

- [x] **SGM-1 — Render simulated gift images in the test chat**
  - Route: delegated direct.
  - Trigger evidence: implementation and focused coverage span multiple non-trivial frontend/backend test surfaces.
  - Acceptance: catalog-backed gifts show their safe image and quantity; the accessible label retains the gift name and quantity; missing or failed images have a stable gift fallback.
  - Checks: `node --test tests/test_simulation_ui.cjs` — RED with 3 expected failures before implementation, then GREEN with 3 passed; `.venv\Scripts\python.exe -m pytest tests/test_simulation.py -q` — 13 passed; parent spot check repeated the UI suite — 3 passed.
  - Work-unit commit: pending hash; planned message `feat(simulation): show gift artwork and cover Minecraft delivery`.
  - Authored implementation/test lines in work-unit: 150 additions and 2 deletions; running total: 177.
  - Rationale: reuse the validated catalog artwork while keeping a readable quantity, accessible event name, and deterministic name fallback.
  - RDD assessment: pending parent assessment.

- [x] **SGM-2 — Exercise configured Minecraft reactions from simulated gifts**
  - Route: delegated direct.
  - Trigger evidence: the behavior crosses simulation payload validation, shared gift dispatch, Minecraft preset matching, and integration tests.
  - Acceptance: a simulated catalog gift uses its exact gift ID, reaches the configured Minecraft preset, and produces the configured zombie command with the donor name visible.
  - Checks: `.venv\Scripts\python.exe -m pytest tests/test_simulation.py -q -k simulated_catalog_gift_reaches_minecraft_preset_with_donor_name` — passed before production changes (1 passed, 11 deselected); `Simulation.deliver` already enters the shared gift handler and its `minecraft.gift` dispatch.
  - Work-unit commit: pending hash; planned shared message `feat(simulation): show gift artwork and cover Minecraft delivery`.
  - Authored implementation/test lines in work-unit: 27 additions; running total: 27.
  - Rationale: preserve the simulated catalog ID, configured preset selection, and named zombie command through a focused regression test.
  - RDD assessment: pending parent assessment.

## Progress and evidence

- Read-only exploration located the dock render in `web/static/simulation.js`, simulation event construction in `app/simulation.py`, shared dispatch in `app/server.py`, and named-mob commands in `app/minecraft_presets.py`.
- Candidate edit surfaces were clean before the first write; unrelated worktree changes remain untouched.
- SGM-2 evidence: the focused regression test passes without a production edit; the initial fixture probe exposed that the process catalog starts empty, so the test injects an isolated catalog entry.
- Full verification: `.venv\Scripts\python.exe -m pytest tests/test_simulation.py -q` — 13 passed; `node --test tests/test_simulation_ui.cjs` — 3 passed; `.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py -q` — 28 passed; `git diff --check` — no errors.
- Running authored implementation/test line count: 177; feature-document edits excluded.

## Next step

Create the shared work-unit commit, record its identity, then run the native RDD assessment and any returned review continuation.
