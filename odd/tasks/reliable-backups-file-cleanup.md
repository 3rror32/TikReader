# Reliable backups, voice priority, and generated file cleanup

## Objective and authorization
User accepted the next improvements and explicitly requested a working file-cleanup button. User clarified cleanup targets: temporary files, cache, and generated audio. Implement backup resilience/truthful status, voice priority, safe local voice diagnostics, and generated-file cleanup. No actual deletion of operator data during development.

## Scope and constraints
- Protect database/history, credentials, settings, backups, media, personal voice models, resumable downloads, installed runtimes, browser profiles, and files currently in use.
- Preview cleanup candidates and bytes before explicit in-app confirmation; report actual results and per-file failures honestly.
- Cleanup fixed app-owned roots only; no caller-supplied paths; reject symlinks, junctions, and escapes. Tests operate only on synthetic temporary roots.
- Existing clear-view/history retention controls are distinct and remain scoped as before.
- Local TTS diagnostics allowlisted and bounded; never log user/chat text, secrets, raw stderr, or private paths.
- No installs, external accounts, publication, push, PRs, or merge. Technical artifacts English with existing UI language conventions.

## Tasks and routing
- [x] T1: Keep backup scheduler alive through SQLite/persistence errors; separate successful backups from attempts and scheduling; explain database-only scope. Route delegated: multi-file behavior plus regression tests. Independent legacy-restart finding corrected and independently rechecked.
- [x] T2: Retain highest-priority voice queue items at capacity with deterministic tie behavior and accurate omission accounting. Route delegated: research prepares implementation and runnable regression.
- [x] T3: Add generated cleanup analysis/action UI, fixed safe cache/audio roots, active-file protection, honest counts/results, and tests. Route delegated: multi-file functionality and destructive-operation safeguards. Confirmation token expires and is single-use; actual operator cleanup never invoked.
- [x] T4: Preserve safe local TTS error categories/timing and actionable messages without sensitive logs. Route delegated: protocol and tests.

## Acceptance and checks
- SQLite and status persistence failures cannot silently terminate scheduled backups; enabling or failed backup cannot fabricate last success.
- Incoming low-priority message cannot evict a higher-priority queued reading.
- Cleanup demonstrably deletes only selected safe generated candidates in synthetic tests, including escaped/reparse paths, active audio, partial failures, zero candidates, and repeat use.
- Cleanup button shows scan and execution outcomes; request cannot specify arbitrary paths or bypass local guards.
- Meaningful deterministic RED before implementation, then GREEN. Focused Python backups/advanced/cleanup/local-TTS suites, Node voice harness, frontend typecheck/build, and targeted browser control-center checks.
- Source-mutating build before final checks; no baseline changes. Independent verification required because native assessment unavailable.

## Delivery and recovery
- Branch: codex/reliable-backups-file-cleanup, based on completed prior local work.
- Forecast: approximately 650–1000 authored changed lines; heuristic only, tests/safeguards preserved.
- Cached user delivery strategy: stacked-to-main. Prepare coherent local slices; no remote operation authorized.
- Native RDD assessment/status unavailable: gentle-ai not on PATH/checked executable locations. No mode change; use high-risk independent verification without claiming native approval.
- Engram topic odd/reliable-backups-file-cleanup/tasks pending because tools unavailable; local document is recovery record.
- Registry work-unit-commits skill missing at indexed path and checked fallback roots. No project implementation-specific skill applies.
- Prior feature broad suite and six unattributed screenshot differences remain pending; do not claim they were fixed here.

## Progress and evidence
Implementation completed and independently verified; local work-unit commit identities pending recording. Existing clear-view/history controls remain distinct. Cleanup covers app data/pycache, source runtime/pycache, and orphan known WAV files inside app-owned generated-audio folders; minimum age 24 hours. New RVC workspaces use that folder and remain protected while active. No arbitrary OS temporary-directory scans, historical system-temp orphan deletion, or browser/download/model cache deletion.

## Observed verification
- Meaningful RED then GREEN: backup success/scheduling failures, queue saturation priorities, generated cleanup, safe TTS error diagnostics, and legacy migration.
- Writer focused Python suites (automatic_backups, advanced, generated_cleanup, local_tts, local_tts_worker, voice_models): initially 45 run, 44 passed/1 skipped. After the independent finding, backup suite expanded to 7 passing tests.
- Writer Node voice suite: 7 passed. Frontend typecheck and build passed; generated controlCenter.js inspected. Build before final functional checks; diff whitespace check passed.
- Targeted browser control-center test: 1 passed, covering scan, cancel/no request, confirmation, counts/failure details, rescan-zero, and API failure.
- Independent verifier: cleanup 7 passed/1 skipped, backups initially 6 passed, local TTS 6 passed, worker 3 passed, advanced 7 passed; Node voice 7 passed. Targeted correction verification: backups 7 passed; legacy deadline remains 87400 across simulated later restarts and successful/opt-in configurations.
- Parent spot check: Node voice suite 7 passed.
- Synthetic cleanup tests actually delete disposable candidates, preserve active/changed/protected files, reject invalid/expired/replayed tokens and caller paths, handle failures, and bound scans. Windows handle deletion and mocked reparse checks pass.
- Skipped: creating real directory symlink/junction was denied by this host; mocked reparse protection passes, but no claim of real-link verification.
- Independent review found one P2 legacy deadline drift; corrected within original surfaces and independently closed. No confirmed cleanup security defect after race/identity/handle, ancestry, hardlink, active-audio, and local request guard inspection.
- Full repository checker and screenshot suite not repeated; prior incomplete general suite and visual-reference gaps remain. Real platform/audio-model hardware validation not performed.
- Native RDD unavailable and Engram mirror pending as above. No claimed native approval.

## Local slices and next step
Four coherent source slices planned: backup reliability; voice priority/diagnostics; protected generated cleanup backend; control-center cleanup/backup UI. Record local commit identities, then deliver with the known verification limits. Runtime cleanup requires the user's explicit confirmation inside the app. Publishing, PRs, and merges remain unauthorized.
