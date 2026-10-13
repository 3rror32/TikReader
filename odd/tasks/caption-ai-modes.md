# AI caption modes

## Objective

Add explicit AI subtitle modes—**Corregir**, **Traducir**, **Bilingüe**, **Simplificar**, and **Personalizado**—to the visible external-model configuration.

## Problem and why

The external model currently accepts one free-form instruction. Useful behaviors such as translation and bilingual captions are possible but undiscoverable, inconsistent, and easy to misconfigure. Presets should make the intended result obvious while preserving existing custom instructions.

## Authorized scope

- Add a persisted AI mode and target language for translation-oriented modes.
- Build trusted mode-specific instructions on the backend while preserving the current provider request contract.
- Expose accessible mode controls in the microphone-caption settings.
- Preserve and migrate existing custom instructions.
- Add focused backend and frontend coverage.

## Constraints

- Keep existing endpoint, model, protected API key, connection test, refinement, and fallback behavior.
- Existing non-default `ai_instruction` values must continue as **Personalizado**.
- Translation language controls appear only when relevant.
- Public caption snapshots must not expose private AI configuration.
- Preserve unrelated worktree changes.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: under 250 authored changed lines, excluding this task document.
- Route: delegated direct; the writer trigger applies because backend validation/prompt selection, frontend controls/styles, and focused tests all require coordinated changes.
- Engram mirror: pending because no Engram memory tools are available in this session.

## Tasks

- [x] **CAP-MODE-1** — Implement persisted AI caption presets, legacy migration, target-language selection, and focused tests.
  - Acceptance: all five modes are selectable; translation and bilingual modes expose the target language; custom mode exposes the instruction; mode-specific prompts are selected server-side; legacy instructions migrate safely; public snapshots remain private; provider request shape is unchanged.
  - Checks: `python -m unittest discover -s tests -p test_microphone_captions.py`; `node tests/test_microphone_captions.cjs`; `node --check web/static/microphone_captions.js`.
  - Verification evidence: Initial test-first red: backend AI mode tests failed for missing defaults, legacy migration, mode-specific prompts, save/load, and public privacy; frontend assertion failed because the mode options were absent. Initial green: backend 11 tests passed; frontend structural checks passed; JavaScript syntax check passed; scoped `git diff --check` passed. Independent review reopened one issue: the local preview flattened bilingual line breaks. Correction test-first red showed the preview rendered the newline as a text span with spaces; correction green: `node tests/test_microphone_captions.cjs` passed, `node --check web/static/microphone_captions.js` passed, and scoped `git diff --check` passed. The Windows `python` app alias was inaccessible, so the backend suite used the installed Python 3.14 interpreter with the requested unittest arguments.
  - Commit: `5daf399` (`feat(captions): add AI subtitle modes`).
  - Correction commit: `9c1453b` (`fix(captions): preserve bilingual preview lines`).
  - Review assessment: pending parent assessment; native receipt tooling was unavailable during the preceding caption task and remains the parent’s responsibility to assess.

## Progress

- Exploration and compatibility design completed with CodeGraph.
- CAP-MODE-1 implemented and committed; 215 authored changed lines across the backend, visible controls, and focused tests.
- Independent review correction preserves explicit line boundaries in local preview and replay while retaining word animations; correction committed as `9c1453b`.
- Engram mirror remains pending because no Engram memory tools are available in this session.

## Next step

Parent performs the native risk assessment and review lifecycle as the user-owned switch requires, then synchronizes the Engram mirror when its memory tools are available.
