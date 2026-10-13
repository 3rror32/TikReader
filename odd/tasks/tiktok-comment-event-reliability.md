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

- [ ] **TCER-2 — Rebuild and verify the application package**
  - Route: delegated direct.
  - Trigger evidence: payload and installer reconstruction requires build and external packaging tooling.
  - Acceptance criteria:
    - Rebuild the payload and installer from the current HEAD.
    - Verify the packaged `app/server.py` matches the source at HEAD.
    - Run the applicable packaging checks and record their results.
  - Status: open.
  - Next step: delegate packaging work and verification.

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
- Next step: complete TCER-2 package reconstruction and checks, then obtain explicit authorization before local installation and TCER-3 LIVE validation.
