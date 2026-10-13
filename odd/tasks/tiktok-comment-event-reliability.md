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

- [ ] **TCER-1 — Make comment ingestion resilient and observable**
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
  - Checks observed: `python -m pytest tests/test_server.py -k "comment" -q` — unavailable (`python.exe` launch denied); bundled Python equivalent — unavailable (`No module named pytest`); bundled Python AST parse of `app/server.py` and `tests/test_server.py` — passed; `git diff --check` — passed.
  - Approximate authored change size: 190 lines across callback, focused tests, and this tracking update.
  - Work-unit commit: `acfb348` (`fix: harden TikTok comment event handling`).
  - Completion: pending focused pytest execution; do not close TCER-1 until it passes.
  - Next step: restore a local Python environment with pytest, run the focused selector, then update this evidence and close the task if all criteria pass.

## Progress

- Exploration completed: the server-side comment counter remains zero when processing stops before `publish_comment_payload`; gift and comment handlers are independent.
- RDD state: unknown/unavailable because `gentle-ai` is not installed in this terminal.
- Next step: delegate TCER-1 implementation and focused verification.
