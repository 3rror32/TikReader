# Recent chat participants

## Objective

Keep the live participant panel limited to recently observed people instead of retaining everyone seen during the whole stream.

## Problem and why

The backend records `last_seen` but returns every observed participant until the collection reaches its hard cap. The UI can therefore look like an exact connected-viewer roster even though TikTok does not provide reliable leave events.

## Authorized scope

- Expire inactive participant rows after a short, documented activity window.
- Clear participant state when a live session ends or is replaced.
- Present the list as recent activity rather than an exact connected roster.
- Add focused backend and frontend regression coverage.
- Preserve unrelated working-tree changes.

## Constraints

- Do not claim exact presence or infer a reliable leave event.
- Do not expire the separate recent-join greeting history in a way that replays greetings.
- Keep participant updates session- and revision-safe.
- Technical artifacts remain in English; existing localized UI copy stays consistent with the application.

## Tasks

- [x] **RCP-1 — Expire and accurately label recent participants**
  - Route: delegated direct.
  - Trigger evidence: coordinated backend, frontend, localization, and test changes span multiple non-trivial files.
  - Acceptance criteria:
    - Inactive rows disappear after the configured activity window.
    - Active rows remain and refresh their deadline on observed activity.
    - The panel communicates that it shows recent activity, not exact connected users.
    - Session reset behavior remains intact.
  - Verification:
    - `python -m unittest tests.test_server` — unavailable: the Windows Store `python.exe` shim could not start; the bundled Python can parse both changed Python files, but cannot import the server test because Flask is not installed in that runtime.
    - `node --test --test-name-pattern "participants panel" tests/test_frontend.cjs` — passed (1 test).
    - `node --test tests/test_frontend.cjs` — 31 passed, 1 unrelated concurrent template change failure: the connecting-indicator test expects spinner markup removed by edits outside this work unit.
- [x] **RCP-2 — Clear participant rows after definitive session end**
  - Route: delegated direct.
  - Trigger evidence: independent verification found participant rows remained until inactivity expiry after the live had definitively ended.
  - Acceptance criteria:
    - Definitive finalization clears participant rows and emits an empty snapshot for the same session.
    - The participant revision advances once when rows are removed; join history remains intact.
    - Transient disconnects that enter the existing retry loop do not trigger the cleanup.
  - Verification:
    - `python -m unittest tests.test_server` — unavailable: the Windows Store `python.exe` shim could not start; bundled Python lacks Flask (`ModuleNotFoundError`).
    - Bundled Python `-m py_compile app/server.py tests/test_server.py` — passed.
    - Focused AST harness invoking the production finalizer — passed: cleared rows, incremented revision once, emitted a same-session empty snapshot, and preserved join history.
    - `node --test --test-name-pattern "participants" tests/test_frontend.cjs` — passed (2 tests).

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: under 400 authored changed lines.
- Work-unit boundary: one commit containing RCP-1 behavior, tests, UI copy, and this feature record.
- RDD state: unavailable because the `gentle-ai` executable is not present in this environment.

## Progress and evidence

- Exploration confirmed that `last_seen` is stored but `participants_payload()` returns all retained rows.
- TikTok presence is observational; exact leave detection is unavailable.
- RCP-1 uses a 180-second inactivity window in backend payloads and browser rendering; expiry advances the participant revision while recent-join greeting history remains intact. Session replacement still clears both collections.
- Authored change count: approximately 157 lines across this work unit, including the tracked feature record and excluding unrelated edits and generated files.
- RCP-2 clears rows only from `finish_session_metrics()`, reached after the retry loop or after the final external connector stops; it emits the empty participant snapshot while holding the feed lock to preserve session ordering.
- RCP-2 correction size: approximately 46 authored lines including its task-record update; the RCP-1 count above remains its original work-unit count.
- RDD state: unavailable (`gentle-ai` executable is not present); review outcome is unmanaged.
- Work-unit commit: `af6dba4` (`feat(participants): expire inactive activity rows`).
- RCP-2 correction commit: pending.
- Engram mirror `odd/recent-chat-participants/tasks`: pending because the memory provider is unavailable in this session.

## Next step

Restore a Python runtime with Flask and rerun the server suite; record the RCP-2 correction commit identity and synchronize the Engram mirror when available.
