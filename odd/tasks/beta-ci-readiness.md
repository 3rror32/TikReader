# Beta CI readiness

## Objective
Reproduce and fix six browser CI failures without weakening visual baselines or credential leak detection, complete applicable validation, and preserve the unpublished release.

## Tasks
- [ ] CI-1: Observe focused RED, inspect paired screenshots/differences, correct deterministic test synchronization or justified capture scopes, and observe focused GREEN.
- [ ] CI-2: Run full browser suite, general checks, and installer check-only; record every unavailable/failing check. Parent independently verifies before commit or main update.
- [ ] CI-3: Determine whether runtime bytes changed; replace installer only if necessary, otherwise preserve the verified binary. No publication.

## Scope and route
Delegated direct: one bounded writer for tests/browser/fixtures.cjs, tests/browser/operator.spec.cjs, tests/browser/safety.spec.cjs, .github/workflows/quality.yml, and this document. Production edits need parent approval of exact paths. Forecast approximately 100 authored lines. Preserve existing dirty recovery evidence in odd/tasks/github-beta-presentation.md. Engram mirror pending; gentle-ai and indexed project skills unavailable. No remote writes authorized for this worker.

## Acceptance and checks
Keep zero-pixel visual tolerance and meaningful security equality. Use actual paired image evidence rather than blanket baseline updates. RED/GREEN focused browser checks, full browser suite, general checker, and installer CheckOnly are required where the environment supports them. Clean-Windows and real-broadcast outcomes are not inferred from these checks.

## Partial handoff — diagnostic CI candidate
CI-1: original focused command `npm.cmd run test:operator -- --grep 'visual baseline|synthetic credentials|concealed Kick webhook'` passed 9/9 unchanged (38.7s); no local RED reproduced. CI screenshot artifact downloads failed, including a binary-safe alternate API route; observed network error was TLS handshake timeout. Baselines, pixel tolerance, capture scope, and security equality were not changed. Added paired masked-credential and concealed-webhook PNG attachments so the next CI run exposes the actual differing regions. Same focused command passed 9/9 after instrumentation (41.6s). JS syntax checks passed.
CI-2: workflow now runs general validation unless cancelled, even after browser failure, and uploads coverage only if its file exists. Structural assertions and scoped diff whitespace checks passed. `runtime/installer-python-3.13/python.exe tools/check_changes.py` was attempted with its directory on PATH; embedded environment lacks Ruff/coverage and Python tests reported temporary-directory PermissionError failures. Parent requested convergence; interrupted that runner before completion (exit1), so general validation remains incomplete. No generated tracked runtime diffs appeared. Separate `powershell.exe -NoProfile -ExecutionPolicy Bypass -File packaging/build_installer.ps1 -CheckOnly` with the same Python3.13 PATH passed for1.0.0.9.
CI-3: only tests/CI configuration changed; existing installer bytes remain appropriate and no rebuild/replacement was performed. The six original remote failures remain unresolved pending actual screenshot evidence. No full browser suite was launched after the focused run because the CI cause is still unknown. No commit, push, tag, upload, or publication was performed.
Next: independent parent verification, scoped diagnostic commit/main push, observe full CI and inspect its paired artifacts. Engram mirror remains pending.

Independent verification correction: coverage upload explicitly enables `include-hidden-files: true` only for the exact `runtime/.coverage` path because artifact uploads exclude hidden files by default. The file-existence guard remains. Workflow readback and scoped diff check passed; no other upload surface expanded.
