# Recovery safety, bounded checks, and build identity

## Objective and authorization
User explicitly authorized all four recommendations, prioritizing restored-data validation and complete backup safety before checker diagnostics and immutable build identification.

## Constraints and scope
- Validate schema and known startup-critical persisted settings offline before replacing live data; no runtime-service construction, silent clamping, or data loss. Preserve compatible unknown JSON settings.
- Preflight space per affected filesystem for extraction, rollback, SQLite snapshot, and safety backup with reserve; preserve stopped-app guard, manifest compatibility, checksums, WAL handling, rollback, and existing-export no-overwrite guarantee.
- Write unique sibling partial ZIP, verify contents and database, then publish exclusively. Failures clean only owned partial artifacts and preserve prior files.
- Checker stable named stages, start/end/duration, bounded timeout with owned-descendant cleanup, per-stage logs/results, stage/from-stage selection, full/watch compatibility. No environment/credential dumps.
- Immutable packaged ID/revision/date/provenance in payload metadata, version/About/sanitized diagnostics. Keep existing version.build frontend reload semantics; unknown/legacy identity remains runnable and source mode explicitly development.
- No actual operator restore/backup, installer build, install/download, remote operation, publication, PR, or merge. Tests use synthetic roots and mocked build metadata/producers.
- Technical artifacts English with existing UI/document context language respected.

## Tasks and routing
- [x] T1: Offline schema and startup setting validation, recovery rejection without changing existing data. Delegated: multi-file behavior and validation research. Independent old-state preservation regression corrected and rechecked.
- [x] T2: Per-volume recovery space preflight and atomic verified exclusive ZIP publication with rollback regression tests. Delegated: multi-file data safety behavior. Synthetic faults and existing roundtrip/rollback tests passed.
- [x] T3: Named checker stages, durations/logs/timeouts/resume and bounded process-tree cleanup. Delegated: new behavior, subprocess tests, prior unexplained stalls. Windows parent/grandchild termination tested; POSIX inspected only.
- [x] T4: Packaged build identity plus compatible version/About/diagnostics and mocked packaging validation. Delegated: multi-file build/UI integration. Content fingerprint, reproducibility, source/legacy/malformed metadata, diagnostics, and About checked.

## Verification and acceptance
- Meaningful deterministic RED before each implementation, then GREEN. Focused recovery/layout/review/checker/build-info/build-release/release-support tests.
- Inject invalid persisted values/schema, insufficient space/disk-full, corrupt ZIP, destination race, replacement rollback, process timeouts/descendants, malformed metadata, and legacy/source identity cases.
- Build/check source-normalization before final functional checks. Targeted browser About/version and existing control-center cases; no reference screenshot updates.
- Independent high-risk verifier inspects recovery and checker/build provenance; parent spot check retained.
- Prior full-suite/screenshot gaps remain until actually resolved; improved checker may diagnose but never implies success.

## Delivery and recovery
- Branch: codex/recovery-safety-build-identity based on completed prior local features.
- Forecast approximately 1000–1500 authored changed lines excluding generated artifacts; advisory only, preserve safeguards/tests.
- Cached strategy stacked-to-main. Coherent local source slices; push/PR/merge unauthorized.
- Native RDD assessment unavailable (gentle-ai absent from checked locations); no switch changed or native approval claimed. Engram mirror odd/recovery-safety-build-identity/tasks pending: tools unavailable.
- Registry work-unit-commits/cognitive-doc-design entries point to missing Gemini skills; no checked fallback. Proceed within task using existing code/document patterns.

## Progress
All four tasks implemented and independently checked. Authored feature delta 1,343 changed lines, generated files excluded; coherent data-safety and process-ownership changes retain their tests despite exceeding the advisory planning heuristic. Exact test fixture surface tests/browser/fixtures.cjs added to support approved server-rendered About tests.

## Observed verification
- Relevant regressions observed RED before implementation: invalid incoming settings/future schema admitted, missing disk preflight/exclusive publication, missing checker stages/build identity, and old invalid state blocked valid recovery.
- T1/T2 writer: initial recovery/layout/review suites 25 passed; after correction recovery suite 13 passed. Synthetic low-space, separate-volume/UNC, disk-full, corrupt publication, partial ownership/collision, destination race, legacy schema, invalid setting, cross-volume copy, rollback and roundtrip covered.
- Independent first check: recovery 12/layout 3/review 10 passed; found one P2 where strict export validation prevented safety-preserving broken old settings. Corrected through private preservation path retaining raw schema/integrity/hash checks while public export/incoming validation remain strict. Independent correction recovery suite 13 passed.
- Writer final focused Python: 46 passed, no skips. Final checker suite after watch refresh change: 4 passed. Actual named javascript-syntax stage passed in 21.248 seconds; other nine stages explicitly unselected. Targeted About browser test 1 passed; diff whitespace check passed.
- Independent final current-byte checks: build_info 3/build_release 4/release_support 9/checker 4, total 20 passed; no confirmed remaining defect in inspected areas.
- Parent spot check: build_info suite 3 passed.
- Native Windows owned parent/grandchild timeout tests passed; POSIX process cleanup inspected but not executed on this host. Physical separate-drive/UNC behavior tested via mocked planning, not physical second volume.
- No full checker, installer assembly, screenshot baseline changes, operator backup/restore, network operations, or installed-app update performed. Prior incomplete broad suite/visual-reference gaps remain.
- Build identity keeps existing asset-mtime version.build behavior; runtime metadata cached/allowlisted without Git. Packaged identity incorporates payload content, reproducible epoch, and nullable source provenance. Legacy unknown metadata remains runnable.
- Per-volume free-space estimates cannot reserve disk space against concurrent consumers.

## Local slices and next step
Record recovery safeguards as T1/T2, staged checker as T3, and build identity/About as T4. Deliver local changes with known limits, pending Engram mirror and unavailable native review honestly recorded. Installer creation, publication, PRs, and merges require separate authorization.
