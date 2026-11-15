# Voice Comment and Greeting Fixes

## Objective

Make the selected spoken-name mode consistent across live comments and participant greetings, and verify the live comment-to-speech path.

## Problem

The spoken-name selector currently affects comment speech but not the manual or automatic greeting text. Participant records expose only the account name, so profile-name selection is unavailable for participant greetings. The working tree also contains a local `studio.js` change that separates duplicate `mode` declarations; preserve it because the duplicate declarations prevent the script from parsing.

## Why

The voice controls should honor the same name choice wherever TikReader speaks a commenter's identity. Existing comment reading should remain live-only and explainable through its current filters and audience controls.

## Scope and constraints

- Use the existing `account`, `profile`, `both`, and `none` name modes for comments, manual greetings, and automatic participant greetings.
- Respect the existing hidden-names setting when producing any spoken name.
- Supply a profile display name to participant greetings when TikTok exposes one; keep the account name as the fallback.
- Preserve the existing local `priorityMode` / `nameMode` rename in `web/static/studio.js`.
- Do not change the live-comment policy: prior history remains unspoken; accepted new live comments are read when enabled and audience-eligible.
- No network or remote operations.

## Authorized edit scope

- `app/server.py`
- `web/static/chat_extras.js`
- `web/static/core_ui.js`
- `web/static/participants.js`
- `web/static/studio.js`
- `web/templates/index.html`
- `tests/test_frontend.cjs`
- `tests/test_server.py`

## Route and trigger

Delegated direct implementation: the fix spans multiple non-trivial frontend/backend files and tests. Parent evidence found the greeting-name mismatch, the existing duplicate-declaration local fix, and a live speech path gated by filters and audience settings.

## Forecast and delivery strategy

- Forecast: approximately 180 authored changed lines, excluding generated files.
- Strategy: `ask-on-risk`.
- Work-unit boundary: one cohesive voice-name/greeting fix with frontend and participant payload regression coverage.

## Acceptance criteria

- Automatic and manual greetings honor all four name modes and hidden-name masking.
- Participant greeting data includes a profile name when available and falls back safely when absent.
- The selected mode continues to govern comment speech without mutating the original comment record.
- A fresh accepted live comment reaches the speech queue under enabled, unrestricted settings; existing filters and audience restrictions still suppress ineligible comments.
- The frontend and targeted server regression checks pass.

## Tasks

- [x] `VCG-1` Resolve spoken names consistently for comment speech and participant greetings; pass participant display names through the existing data flow; update the help text.
- [x] `VCG-2` Add frontend and server regression coverage, including comment speech routing and each greeting name mode.

## Verification

- `node tests/test_frontend.cjs`
- `python -m unittest tests.test_server`
- `node --check web/static/studio.js`

## Progress

- Explored live participant events, manual greeting buttons, comment ingestion, and speech gates with CodeGraph and the running app.
- Read-only UI check: live session connected; comment reading and automatic greeting controls enabled; voice test returned to `Voz activa · cola: 0`.
- Test-first RED was observed for new greeting-mode regressions; after implementation, focused greeting and live-comment regressions passed.
- `node tests/test_frontend.cjs`: 64 passed, 1 failed. The remaining viewers-statistic assertion (`0` versus `—`) also fails on `HEAD`, so it is pre-existing and unrelated.
- Both focused participant server tests passed. The full server suite did not finish within the available run; `python` resolved to an unavailable Windows app alias outside the project virtualenv.
- `node --check web/static/studio.js` and `git diff --check` passed; an independent verifier confirmed the final greeting behavior and reproduced the pre-existing stats failure on `HEAD`.
- Native assessment was unavailable because `gentle-ai` is not installed; RDD state remains unknown. No review command or mode change was made.
- Implementation branch: `codex/voice-comment-greeting-fixes`. Work-unit commit pending.
- Engram mirror under `odd/voice-comment-greeting-fixes/tasks`: pending because no memory provider is available in this session.

## Next step

Commit the verified work unit on the feature branch, record its identity here, and preserve the unrelated dirty files.
