# Connection recovery and optional startup loading

## Objective
Prevent stale external-platform callbacks, recover transient connection failures, and defer optional studio tools until opened.

## Problem and scope
Old connector workers can publish after replacement; transient failures currently terminate connections; optional tool scripts load at startup even when hidden. User explicitly authorized recommendations 1, 2, and 4. Beta release validation is outside this implementation.

## Constraints
- Preserve current user data, chat/session identity, essential startup controls, audio, and first-render CSS ordering.
- No network access to external platforms, publication, push, PR, or merge.
- Retry only transient failures with bounded cancellable waits; permanent errors and normal completion remain terminal.
- Load Minecraft and game-hotkeys on demand, once, with navigation and retry coverage.
- Technical artifacts use English; preserve existing UI language conventions.

## Tasks and routing
- [x] T1: Bind connector callbacks and finalization to the current live worker generation. Route: delegated; reading prepares a write and behavior needs regression tests. Confirmed RED then GREEN; independent connector suite passed.
- [x] T2: Add bounded transient recovery and visible reconnecting state. Route: delegated; multiple non-trivial files and deterministic tests. YouTube/Twitch recover with cancellable delays; Kick remains manual because repeating subscription writes is unsafe.
- [x] T3: Defer Minecraft and game-hotkeys scripts with loading/error/retry handling. Route: delegated; multiple non-trivial files and navigation tests. Confirmed RED then GREEN, including targeted browser navigation/retry tests.

## Acceptance and checks
- Stopped/replaced workers cannot publish connected/comment/support callbacks or stop the new session.
- Transient errors recover within a bounded budget; cancellation interrupts waiting; permanent errors and ended streams do not retry.
- Reconnecting remains stoppable in the operator UI.
- Deferred assets are absent initially, load once when opened, and handle initial routes, history navigation, rapid changes, and failures.
- Observe meaningful regression RED before implementation and GREEN afterward where runnable.
- Focused Python connector tests; Node startup/navigation/lazy-loader tests; frontend checks/build; targeted operator browser tests; repository check at closure when available.

## Delivery and recovery
- Branch: codex/connection-recovery-startup; initial reviewed boundary: branch point.
- Forecast: approximately 410–630 authored changed lines, generated files excluded; heuristic only.
- Strategy: ask-on-risk; user selected stacked-to-main (2026-10-18). Prepare coherent local work-unit commits for chained delivery toward main; remote PR creation, push, and merge remain unauthorized.
- Work-unit commits: T1/T2 `a9713c6` (connection lifecycle/recovery); T3 `3abdd16` (optional loading and startup order). These are two local slices toward main; no PRs created. Native assessment unavailable for each slice; independent checks recorded below.
- Native RDD status/assessment: unavailable because gentle-ai is absent from PATH and checked local executable locations. No mode preference changed. Treat risk as high for independent verification; do not claim native approval.
- Engram mirror odd/connection-recovery-startup/tasks: pending; no Engram tools available.
- Registry skill work-unit-commits points to a missing file; no fallback found in checked skill roots. Implementation can proceed without this optional helper.

## Progress
Implementation and independent verification completed. Authored implementation delta: 374 additions plus deletions, generated bundle excluded.

## Verification evidence
- Writer: connector unittest suite 12 passed; Node startup/navigation/optional-loader suites 28 passed; frontend check and build passed; diff whitespace check passed.
- Meaningful regression RED observed for stale callbacks, missing retry API, and eager optional assets, followed by GREEN.
- Browser full run: 41 passed, 8 failed (seven screenshot comparisons and an optional-loader fixture test before correction). Final targeted optional-loader and platform-settings tests: 2 passed.
- Original screenshot mismatch reproduced with HEAD template: exact same 91,779 differing pixels. Other six visual reference failures are not independently attributed. No baselines changed.
- Independent verifier: connector suite 12 passed; Node optional-loader/startup suites 8 passed; no confirmed candidate defects after callback lock/retry/navigation inspection.
- Parent spot check: optional-loader suite 2 passed.
- Broad repository check incomplete: first run had default TEMP permission failures; one rerun with repo-local TEMP/TMP removed explicit denials but stalled during Python discovery after two error markers. Interrupted with no identifying summary; no claim of full-suite success. Local log: runtime/independent-check.log.
- Real external-platform/network validation not performed; no remote authorization supplied.
- Startup-adjacent fix: production socket consumer now loads after core socket initialization; regression test covers the order.

## Next step
Local implementation recorded in two work-unit commits. Resolve broad-check and visual-reference limitations before release validation; real-platform validation, pending Engram mirror, and native review remain unverified/unavailable. Future publication or PR creation requires explicit authorization.
