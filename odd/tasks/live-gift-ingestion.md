# Live gift ingestion

## Objective and authorization
Investigate missing roses and fix future gift accounting without interrupting the running LIVE. Existing unrelated edits must be preserved. No restart, disconnect, remote account access, push, or PR is authorized.

## Evidence and constraints
Gift ingestion currently drops ongoing streaks without group_id before accounting or diagnostics. This is a reproducible candidate cause, not proof of what happened to the user's two roses. No raw payload exists for those roses. The backend has no supported hot reload; activation must wait for a later authorized restart.

## Scope and delivery
Allowed implementation paths: app/server.py and tests/test_gift_ingestion.py. One delegated writer, followed by independent verification because native risk assessment is unavailable. Route: delegated direct, triggered by code analysis, regression tests, and multiple nontrivial files. Forecast: about 200 authored changed lines; strategy: ask-on-risk. Branch: codex/live-gift-ingestion. Engram mirror pending because no memory tool is available. Registry work-unit-commits skill path is missing; no replacement found.

## Tasks
- [ ] G1: Reproduce missing-group streak loss with deterministic tests; implement stable incremental accounting and useful gift error diagnostics without changing the active process. Cover duplicate and final streak updates. Run focused ingestion, server, and load tests. Record proof and work-unit commit.
- [ ] G2: Independently verify changed behavior, inspect scope, and record remaining limitations. Activation is pending a user-authorized restart after the LIVE.

## Acceptance criteria and checks
Missing-group streaks count incrementally; repeated updates do not double count; valid-group behavior remains correct. Tests use isolated data and never the active server. Required commands: unittest discovery for test_gift_ingestion.py, test_server.py, and test_load.py with PYTHONPATH=app;.venv/test-deps and a temporary TIKREADER_DATA_DIR. Observe RED then GREEN when the runner supports it. No live disruption is permitted.

## Verification and progress
Read-only runtime inspection showed zero gift entries and an empty bank. Native gentle-ai command is unavailable: RDD state unknown and risk unassessable; no approval is claimed. Parent structural readback and one focused command spot check are required. Implementation and checks are recorded below; independent verification and commit remain pending.

## Next step
Independent verification and the parent spot check passed eight focused regressions. Source correction is ready; full integration verification and activation remain pending. A later authorized restart is required after the LIVE.

## G1 implementation and proof
Implemented bounded cumulative streak keys using session-scoped group_id, then session/sender/gift fallback. Missing group identifiers use completion and 30-second inactivity as heuristic boundaries; lower counts within an open streak retain its cumulative maximum. The local protocol declares log_id without documenting streak stability, so log_id is not used as accounting identity. Message IDs map replays to their original streak rather than each counting as a new gift. Completed streaks cannot reopen on replay. Gift callback errors log a traceback and propagate.

Initial regression suite: four tests covered ongoing missing-group accounting and replay boundaries. Initial RED observed two failures against packaged old implementation. Additional baseline RED verified the exact HEAD handle_gift_event AST loaded into the workspace server in memory: four tests, two expected failures. No source file was reverted for that check. The final suite expanded to eight tests after independent findings; all eight pass, including changing log IDs without splitting the cumulative streak.

## Final bounded verification
Independent verifier and parent both ran the final workspace regression suite: eight passed, exit 0. Structural diff inspection found no further required correction in scope. Five existing core gift tests passed in writer verification. The earlier 14 broad-suite import errors remain unresolved; real TikTokLive integration is unverified. G1 and G2 remain partial until that proof and a user-authorized post-LIVE activation. No restart or live endpoint mutation occurred. Work-unit commit identity is recorded after committing below. Native review unavailable; Engram mirror pending.

Runner: release/TikReader/python/python.exe. Embedded Python ignores PYTHONPATH because its _pth file adds the packaged app, so workspace verification explicitly prepended app to sys.path. The initial mandated discovery commands used PYTHONPATH=app;.venv/test-deps and isolated TIKREADER_DATA_DIR but imported packaged code. The workspace bootstrap used unittest.main with discover arguments -s tests -p test_gift_ingestion.py -v. Broader workspace verification with app and .venv/test-deps explicitly prepended and tempfile.tempdir under runtime ran 56 tests (test_server.py plus test_load.py): 42 passed, 14 errors, zero assertion failures. Errors are unavailable/incompatible TikTokLive/pydantic_core imports and missing event/client symbols following that import failure. Earlier run additionally exposed sandbox default-temp SQLite access failures, resolved by relocating test temp storage. A packaged-dependencies retry was interrupted after no output; it produced no verification result. No dependency installation occurred.

Remaining limits: exact cause of the historical two roses remains unproven. When group IDs are absent, a new unseen message after a final notification opens another streak, while known message replays map to their original streak. Without a message ID, duplicate final notifications cannot be distinguished reliably from new final-only gifts. Without a group ID, two open streaks for the same sender/gift within 30 seconds may merge, and a delayed final delivered under a new message ID after closure may appear as another gift. Cache deduplication is bounded to 1000 entries. No active process was restarted or disconnected; the running LIVE still uses its existing loaded code. Commit pending. Engram mirror pending.


## G1 bounded correction after independent verification
Independent checks found two accounting defects in the first candidate: lower out-of-order counts opened extra streaks, and separate final-only gifts merged. Added regression tests before correction: eight focused tests ran, four failed (the two reported defects, changing log IDs, and cross-session group identity). Corrected all four. Final focused suite: eight passed. Existing core server gift checks: five passed (diamond deltas, cumulative/final deduplication, unchanged snapshots, reconnect history updates, exact-room recovery). Both checks used release/TikReader/python/python.exe with app explicitly prepended to sys.path; core tests also prepend tests, set isolated TIKREADER_DATA_DIR, and use runtime-local tempfile.tempdir. Compatible packaged dependencies were retained; no dependency installation or live process operation occurred. Broad earlier suite errors remain documented above and were not retried. Final independent recheck and commit pending; no review approval claimed.
