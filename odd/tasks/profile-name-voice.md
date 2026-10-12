# Profile Name in Voice Comments

## Objective

Let users choose whether spoken commenter names in Lectura por voz use the visible TikTok profile name or the account username. The existing name-reading option remains available, and the new preference defaults off.

## Problem and rationale

Comment speech currently reads the account username. Users may prefer the visible profile name, which can be more recognizable. TikTokLive 7.0.0 exposes this value as `event.user.nickname`; `event.user.unique_id` remains the account username. External comment payloads and events without a nickname must keep working through a safe account-name fallback.

## Scope and constraints

- Keep the existing “Leer el nombre de quien comenta” checkbox and its behavior.
- Add a separate persisted checkbox to select the profile display name; default it off for backward compatibility.
- Carry a normalized `display_name` in backend comment payloads, with the account username as fallback when the display name is absent.
- When the new preference is on, speak the profile name when available and otherwise speak the account username.
- Keep the existing Spanish UI language and labels.
- Do not alter unrelated user changes in `tools/build_release.py`, `web/static/build/chunks/browser-1hTm3ecb.js`, `web/static/build/chunks/lottie_light-Be-sxyU1.js`, `web/static/build/studio.js`, or `tests/test_build_release.py`; never stage or commit those files.
- Engram mirror is pending: no Engram memory mechanism is available in this session. Required mirror locator: topic `odd/profile-name-voice/tasks`, repository file `odd/tasks/profile-name-voice.md`.
- The requested `work-unit-commits` skill could not be loaded: the injected path and project registry path `C:\Users\Carlos\.gemini\skills\work-unit-commits\SKILL.md` do not exist. The parent authorized proceeding without this stale project-specific skill.

## Authorized scope

The user authorized implementation of the profile-name voice preference, its persistence, fallback behavior, and relevant tests. This document records that work before any source change. Existing unrelated dirty files are outside the authorized edit and delivery scope.

## Route and estimate

- Route: delegated direct, using one bounded writer for implementation and tests.
- Trigger evidence: preparation reads and coordinated backend, frontend, and test changes span multiple non-trivial files.
- Test-first expectation: observe RED for applicable backend and frontend tests, implement GREEN, then refactor while the focused checks remain green. Do not claim RED/GREEN evidence until observed.
- Estimated authored changed lines: approximately 120 (implementation, tests, and any necessary focused documentation; generated files excluded).
- Delivery strategy: `ask-on-risk`.

## Tasks and acceptance criteria

### T1 — Carry and normalize the display name — complete

- [x] Extract `event.user.nickname` into a normalized `display_name` field in comment payloads.
- [x] Fall back safely to the account username when the profile name is missing or empty, including external comment payloads.
- [x] Add backend tests for a present profile name and missing/empty-name fallback.
- Acceptance: payloads expose a usable display name without changing the account username field or breaking payloads that lack profile data.
- Check: `python -m pytest tests/test_server.py`.

### T2 — Persist the voice preference and select the spoken name

- [ ] Add a second checkbox beside the existing commenter-name option, with persistence and a default-off value.
- [ ] When enabled, use `display_name` for speech when available and otherwise use the account username; preserve current behavior when disabled.
- [ ] Add frontend tests for restoring/saving the preference, default-off compatibility, and spoken-name selection/fallback.
- Acceptance: the current checkbox remains intact, the new preference survives reload, and speech uses the requested name with a safe fallback.
- Check: `node tests/test_frontend.cjs`.

## Progress and verification

- Tracking document: created and structurally read back.
- T1 source and backend tests: implemented.
- Task completion: 1/2; T2 remains pending.
- Test-first evidence: before implementation, the three focused display-name tests produced 1 failure and 2 errors for the missing/untrimmed/unpropagated field. After implementation, the same three tests passed (`Ran 3 tests ... OK`) using the repository bundled Python and standard-library unittest runner.
- Full-check status: the requested `python -m pytest tests/test_server.py` could not start because the WindowsApps Python launcher returned Access denied; bundled Python does not include pytest. A full-file unittest fallback was started but had not returned a final result after 30 seconds. The focused T1 tests passed; the full backend suite remains unverified.
- Structural readback: the T1 diff and task record were reviewed; only the display-name implementation, its backend test class, and T1 progress evidence belong in this work unit.
- Engram mirror: pending because no Engram mechanism is available in this session.
- Skill resolution for this turn: none; proceeding without the unavailable project-specific skill was authorized by the parent.

## Next step

Continue with T2 in a separate authorized work unit. Preserve unrelated dirty files throughout; synchronize the Engram mirror when a memory mechanism is available.
