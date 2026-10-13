# TikTok Comment Event Reliability

## Objective

Restore reliable ingestion of TikTok LIVE comments when event payloads omit or reshape user identity fields, while preserving the existing comment feed and voice queue behavior.

## Problem and why

The live session can receive gifts and participant activity while the comment count remains at zero. The comment callback currently assumes `event.user.unique_id` exists and has no local failure reporting, so a payload-shape change can abort processing before `publish_comment_payload` updates diagnostics, history, or the UI.

## Authorized scope

- Harden TikTok comment event normalization and callback diagnostics.
- Add focused regression tests for alternate or incomplete comment payloads.
- Do not change gift, participant, filtering, or voice-selection behavior.

## Constraints

- Keep normalized comment payload compatibility unchanged for existing callers.
- Avoid logging full comment content or sensitive event payloads.
- Preserve the current TikTokLive dependency versions unless tests prove an upgrade is required.
- Engram mirror topic `odd/tiktok-comment-event-reliability/tasks` is pending because no Engram memory tools are available in this session.

## Delivery

- Strategy: `ask-on-risk`
- Forecast: under 200 authored changed lines, generated files excluded.
- Reviewed boundary: branch point not yet recorded.

## Tasks

- [x] **TCER-1 — Make comment ingestion resilient and observable**
  - Route: delegated direct.
  - Trigger evidence: behavior and deterministic regression coverage require non-trivial changes in `app/server.py` and `tests/test_server.py`.
  - Acceptance criteria:
    - Existing well-formed TikTok comments still publish normally.
    - Missing or alternate user identifiers do not abort comment ingestion.
    - A malformed event produces bounded, privacy-safe diagnostics instead of silently leaving the counter at zero.
    - Focused tests cover the compatibility path and malformed-event behavior.
  - Verification:
    - Focused pytest command selected from the repository's existing test layout.
    - Parent reruns one focused reported command as a spot check.
  - Progress: callback now tolerates absent user objects, selects public account-name aliases, uses a stable anonymous fallback, skips blank comments, and logs only bounded error categories or exception class names.
  - Test-first evidence: focused regression tests were written before the implementation. RED could not be observed because the system Python launcher is inaccessible and the available bundled Python has no `pytest` module.
  - Checks observed: `python -m pytest tests/test_server.py -k "comment" -q` — 10 passed, 38 deselected, 2 warnings in 2.31 seconds, using the release Python and pytest 9.1.1 installed only in a temporary folder. The warnings are `websockets` deprecations. Bundled Python AST parse of `app/server.py` and `tests/test_server.py` — passed; `git diff --check` — passed. No real TikTok connection or full test suite was run.
  - Approximate authored change size: 190 lines across callback, focused tests, and this tracking update.
  - Work-unit commit: `acfb348` (`fix: harden TikTok comment event handling`).
  - Review follow-up: fixed the P2 diagnostic-test assertion to inspect the same temporary dictionary patched during the callback; production logic is unchanged.
  - Follow-up checks observed: the focused pytest selector above passed after the diagnostic assertion fix; bundled Python AST parse of `app/server.py` and `tests/test_server.py` passed; `git diff --check` passed.
  - Follow-up change size: approximately 5 authored lines.
  - Review correction commit: `5349fdc` (`test: fix comment diagnostic assertion`).
  - Completion: complete; implementation criteria and focused regression checks passed.

- [x] **TCER-2 — Rebuild and verify the application package**
  - Route: delegated direct.
  - Trigger evidence: payload and installer reconstruction requires build and external packaging tooling.
  - Acceptance criteria:
    - Rebuild the payload and installer from the current HEAD.
    - Verify the packaged `app/server.py` matches the source at HEAD.
    - Run the applicable packaging checks and record their results.
  - Status: complete; the payload and installer were rebuilt from HEAD and the packaged server matches the source.
  - Build setup: prepended the resolved `runtime/installer-python-3.13` directory to the process-only PATH; confirmed Python 3.13.15, pip 25.3, and PyInstaller 6.20.0. `packaging/build_installer.ps1 -CheckOnly` passed for version 1.0.0.8. The official `packaging/build_installer.ps1` first hit sandbox DNS failure for PyPI, then passed with approved execution; overlays, dependencies, payload, PyInstaller launcher, and Inno Setup installer completed successfully (Inno Setup reported `Successful compile (196.906 sec)`). No versions or declared dependencies were changed. PyInstaller emitted a deprecation warning about a foreign `site-packages` search path; build completed successfully.
  - Payload verification: `app/server.py` and `release/TikReader/app/server.py` are byte-identical; SHA-256 for each is `41EA3DBF81A3817359DE5AFA823D01D5F7281EB85175C7D37016D3BBE5DDD042`.
  - Installer: `release/TikReader-1.0.0.8-Beta-Setup.exe` exists, is 311,488,110 bytes, and has UTC timestamp `2026-10-13T06:20:43.4025887Z`, later than the fix commit (`5349fdc`, `2026-10-12T22:51:48-07:00`).
  - Checks: `python tools/validate_release.py` using the local Python 3.13 toolchain passed all six packaged-runtime checks: isolated startup, Vosk/model availability, external preferences, permitted diagnostics, clean server shutdown, and reopen with preferences/database integrity. `node tools/qa_release.cjs` reached the current UI but timed out on `#settings-save-device`; this selector is absent from `web/templates/index.html`, which exposes `#settings-save-status` and automatic preference saving instead, so the checked-in QA script is stale and not applicable to the current settings flow. The documented preview helper started the payload server on `127.0.0.1:5199` for that attempt; its process was stopped afterward and the port is free. No install or TikTok session was started. `git diff --check` passed.
  - Generated changes: two tracked build outputs changed (`web/static/build/broadcast.css`, `web/static/build/platformConnectors.js`); payload and installer remain ignored release artifacts and were not force-added. Preview and validation data/logs are generated under `release/`.
  - Completion: complete for TCER-2. TCER-3 remains blocked until explicit authorization to install the package locally.

- [ ] **TCER-3 — Validate new comments with the rebuilt package**
  - Route: delegated direct after authorization.
  - Trigger evidence: installing the rebuilt package changes the local application; live validation also requires a real LIVE session.
  - Acceptance criteria:
    - Install the rebuilt package after explicit authorization.
    - Validate that new comments arrive during a LIVE session.
  - Status: open, blocked on explicit authorization to install the package locally.

## Progress

- Exploration completed: the server-side comment counter remains zero when processing stops before `publish_comment_payload`; gift and comment handlers are independent.
- Manual validation attempt: failed because the UI used TikReader 1.0.0.8 from an older package. Its payload/installer is dated October 8, while the fix is from October 12; the packaged and current `app/server.py` hashes differ.
- Known behavior: comments from earlier sessions are archived but are not repopulated into the in-memory feed. This is outside the authorized scope and is not being changed.
- RDD state: unavailable because `gentle-ai` is not installed in this terminal.
- Engram mirror: pending.
- Next step: obtain explicit authorization before local installation and TCER-3 LIVE validation.
