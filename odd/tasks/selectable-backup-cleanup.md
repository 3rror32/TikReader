# Selectable old backup cleanup

## Objective and authorization
User explicitly requested selecting old backups, seeing their sizes, confirming deletion, and preserving the newest backup. They report an existing option apparently ineffective. Source investigation found retention settings prune only after successful automatic backups; no current selectable deletion control exists. Running/installed version has not been inspected.

## Scope and constraints
- Add backup management beside control-center backup controls: list name/type/date/size/protection, selected totals, confirmation, actual deleted/skipped/failure results, and refresh.
- Enumerate only recognized finalized backups inside fixed app-managed locations. No user-supplied paths or scans of external exports.
- Protect newest in each recognized backup type, including timestamp ties; also protect recent files (24h) and in-progress/unknown files.
- Confirm a frozen server-side preview with selected opaque IDs; validate entire request before deletion, reject duplicate/unknown IDs and stale/replayed tokens, recheck identity and newest status at execution.
- Reuse inspected-handle deletion safeguards; reject symlinks, junctions/reparse ancestors, hardlinks, escapes, and changed files; bound scans/results/token storage.
- No actual operator-backup deletion during implementation; tests use disposable roots and mocked UI deletion only.
- Preserve current automatic retention policy, restore behavior, generated cleanup categories, user settings and backup contents.
- No remote operations, installs, publication, PR, merge, or installer updates. English technical artifacts; preserve UI language conventions.

## Tasks and routing
- [x] T1: Add fixed-root backup inventory, selection/confirmation, newest-per-type safeguards, safe deletion, routes and synthetic regressions. Route delegated: multi-file destructive feature and reading prepares implementation. Synthetic deletions and independent security checks completed.
- [x] T2: Add selectable control-center backup table, sizes/totals, protected rows, confirmation and result handling, browser test. Route delegated: multi-file functionality with UI integration. Two targeted browser tests passed, including existing generated cleanup.

## Acceptance and verification
- Analyze/read actions never delete backups; invalid selection causes no partial deletion.
- Selectable old backups delete only after explicit in-app confirmation; newest/recent/replaced/unknown/in-use candidates remain protected.
- Correct logical sizes and actual deleted/skipped/error accounting; path-free safe error messages.
- Deterministic RED then GREEN for groups/ties/newest changes, selection/token/identity, no-path endpoints and UI confirmation.
- Focused backup_cleanup, generated_cleanup, automatic_backups Python tests; frontend check/build; targeted control-center browser tests. Build before final functional verification and independent security verification.
- Existing broad suite/visual gaps remain pending; no baseline changes or claims of full-suite pass.

## Delivery and recovery
- Branch: codex/selectable-backup-cleanup based on completed local improvements.
- Forecast approximately 450–700 authored changed lines, generated excluded; planning heuristic only.
- Cached delivery strategy stacked-to-main; coherent local slices, remote operations unauthorized.
- Native review unavailable (gentle-ai not found); no switch changed. Use high-risk independent verification without claiming native approval.
- Engram mirror odd/selectable-backup-cleanup/tasks pending: tools unavailable.
- Registry work-unit-commits skill missing at indexed and checked fallback paths; no applicable project implementation skill.

## Progress
Implementation and independent verification completed. 633 authored changed lines excluding generated bundle; only controlCenter.js generated content changed. Native RDD assessment remains unavailable for both source slices; independent results do not imply native approval.

## Observed verification
- RED observed for absent backup management functionality, then GREEN.
- Writer: Python backup_cleanup/generated_cleanup/automatic_backups combined 25 run, 23 passed/2 skipped. Frontend typecheck/build and bundle syntax passed; build before final functional proof. Targeted backup-management and generated-cleanup browser cases 2 passed. Whitespace check passed.
- Independent: backup_cleanup 9 passed/1 skipped; generated_cleanup 7 passed/1 skipped. Actual Windows writer rejection and newest-copy lease tests pass. No confirmed candidate defects after independent inspection of producers/roots, selection validation, per-item newest changes, identity/handles, guards, expiry/replay, results, and UI flow.
- Parent spot check: generated control-center bundle syntax check passed.
- Skipped: real hardlink creation and directory symlink/junction creation unavailable on this host. Mocked safeguards pass; no claim of real-link verification.
- Full suite/screenshots not rerun; prior incomplete general suite/visual reference gaps remain. Running installed version uninspected; no installer rebuilt.
- No operator backups scanned/deleted, network access, installation, or baseline changes.

## Local slices and next step
Recorded T1 backend/shared safeguards/tests in `0b8c135` and T2 control-center UI/bundle/browser coverage in `1d6e657`. Feature operates on six recognized app-managed backup groups only, protects newest-per-type/all ties/recent files, and requires explicit in-app confirmation. External exported ZIPs stay outside scope. Delivery remains local; installer update, publication, PR, and merge require separate authorization.
