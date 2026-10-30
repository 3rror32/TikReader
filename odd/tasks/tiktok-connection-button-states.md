# TikTok connection button states

## Objective

Replace the split connect/disconnect presentation with one consistent TikTok connection control that clearly communicates disconnected, connecting, connected, and disconnecting states.

## Problem and why

The current interface exposes a large pending control beside a separate disconnect action, which makes the transition look visually broken. The operator needs one stable control whose label and plug icon explain the current action or progress without moving the layout.

## Authorized scope

- Refine the TikTok connection control requested by the user.
- Preserve the existing connection protocol and socket events.
- Preserve unrelated local changes and generated build outputs.

## Constraints

- Spanish interface copy must remain concise and action-oriented.
- The control must remain keyboard accessible and expose busy state to assistive technology.
- Motion must respect `prefers-reduced-motion`.
- Do not rebuild unrelated overlay assets.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: about 140 authored changed lines, excluding generated files.
- Current reviewed boundary: branch point pending discovery.
- Engram mirror: pending because memory tools are unavailable in this session.

## Tasks

- [x] **TCB-1 — Implement the unified stateful control**
  - Route: delegated direct.
  - Trigger evidence: coordinated behavior and styling across multiple non-trivial source files.
  - Acceptance: the same button renders disconnected, connecting, connected, and disconnecting states with state-specific labels and plug/status icons.
  - Acceptance: connecting and disconnecting cannot be triggered twice, while connected and disconnected actions remain available.
  - Acceptance: focus styling, accessible status, responsive layout, and reduced-motion behavior remain intact.
  - Checks: focused browser test for all four states; structural readback of changed markup, script, and styles.
  - Outcome: implemented. One button now renders `Conectar`, `Conectando…`, `Desconectar`, and `Desconectando…`; connecting and disconnecting transitions reject repeats without removing keyboard focus. Socket event names and payloads remain unchanged. The compatibility stop node stays visually and accessibly hidden while retaining its computed active state for the external-platform status integration.
  - RED: the corrected focused browser regression failed before implementation because `#btn-connect` had no `data-connection-state` (`expected disconnected`, `received null`).
  - GREEN/refinement: the focused four-state regression passed, including focus retention, busy/disabled announcements, hidden split control, and one start/stop emission each. The focused four-state plus mobile keyboard checks passed (2/2).
  - Commit: `a3e88542d66ac075a67d522b227b77da7af349bc` — `feat(operator): unify TikTok connection button states`.
  - Review assessment: unavailable; `gentle-ai review mode status` could not run because the executable was not found. RDD state remains unknown.
  - Correction RED: after the button entered `disconnecting`, a synthetic `status` snapshot with `connected: true` changed its accessible name back to `Desconectar`; expected `Desconectando…`.
  - Correction GREEN: the status handler now ignores nonterminal connected/connecting snapshots only while the local offline stop intent is pending and the button is still `disconnecting`. The focused regression passes and verifies an extra click emits no second `stop_live` event; terminal disconnect confirmation still resets the button.
  - Correction commit: `f5824e8da33001c7fbf0a6d25319bf8ac4931bae` — `fix(operator): preserve disconnecting state on status refresh`.

- [ ] **TCB-2 — Verify the operator connection flow**
  - Route: delegated direct verification.
  - Trigger evidence: browser execution and regression checks are delegated by policy.
  - Acceptance: focused operator and startup browser specifications pass.
  - Checks: `npm run test:operator -- tests/browser/operator.spec.cjs tests/browser/startup.spec.cjs` or the repository-equivalent focused command identified by the worker.
  - Evidence: the latest `npm run test:operator -- tests/browser/operator.spec.cjs tests/browser/startup.spec.cjs` run completed with 13 passing and 7 failing. The same visual baselines fail: `tests/visual-baselines/operator/original.png`, `light.png`, `dark.png`, `broadcast-console.png`, `creator-pop.png`, `swiss-brutalist.png`, and `tactile-scrapbook.png`. The inspected original diff contains the intended plug-control change and broad unrelated rendering differences in activity, participant, and feed areas, so the failures are mixed and cannot all be attributed to this task. Baselines remain untouched and pending. All non-visual operator checks, the corrected disconnect-refresh regression, and startup checks passed.

## Progress and next step

TCB-1 is implemented; the status-refresh correction is green in the focused browser regression. TCB-2 remains partial until the seven out-of-scope visual baselines are reconciled. RDD could not be assessed because the `gentle-ai` executable is unavailable in this environment.

## TCB-3 — Restore single-control pending cancellation

- [x] Restore one visible button with distinct unplugged/plugged shapes; the same pending button cancels once.
- Route: delegated direct; multi-file behavior, icon markup, and regression checks.
- Forecast: about 150 additional authored changed lines, below the 400-line delivery forecast.
- Preserve TCB-2 partial baseline evidence and unrelated dirty changes.
- Checks: deterministic connection and accessibility checks plus focused Playwright connection/cancel regressions.
- Engram mirror remains pending because memory tools are unavailable.
- Commit pending parent isolation review; native assessment unavailable because gentle-ai is absent.

- Outcome: main control uses `Conectar`, `Cancelar conexión`, `Desconectar`, and `Desconectando…`; pending cancellation remains busy and keyboard actionable. Removed the CSS rule exposing a second pending-cancel control. The compatibility stop node remains hidden and outside the tab order, preserving computed display state for integrations.
- RED: `node tests/test_connection_button_states.cjs` observed 2/4 failures before implementation: pending main activation did not cancel, and distinct icon groups were absent.
- GREEN: `node tests/test_connection_button_states.cjs` passed 4/4; `node tests/test_theme_accessibility.cjs` passed 10/10.
- Browser verification: `npm run test:operator -- tests/browser/operator.spec.cjs --grep 'pending connection|one connection control|connection intent'` passed 3/3 after final normalization, covering forced colors, reduced motion, keyboard cancellation/focus, distinct visible plug shapes, exact-once stop, and delayed status/connected events after cancellation.
- Structural check: `git diff --check` passed. Existing TCB-2 seven visual baseline failures remain pending; no baselines updated or unrelated tests rerun.
- Environment: the system Python alias was unavailable; the attempted edit made no source changes, and editing continued with available Node runtime.
- Next step: parent independent verification and isolation review; commit remains pending and Engram mirror unavailable.

- Independent verification: separate verifier observed connection unit 4/4, accessibility 10/10, and focused browser 3/3 passes; parent spot check observed connection unit 4/4.
- Local compatibility adjustment: the pre-existing appended Dragon contrast test now targets the visible `#btn-connect` instead of hidden `#btn-stop`; its entire appended test remains outside this connection work-unit commit.
- Additional command: `npm run test:operator -- tests/browser/operator.spec.cjs --grep 'dragon keeps text readable across live and settings surfaces at desktop and mobile widths'` failed 1/1 on `#app-sidebar [data-section-nav].active` text contrast (1.086 versus minimum 4.5), after the connection contrast checks passed. This unrelated theme failure remains pending.
- Delivery fallback: work-unit-commits skill was unavailable; ordinary Git selective staging isolates this task from pre-existing theme edits. Native review remains unavailable; no approval is asserted.

TCB-3 work-unit commit: e672694cb97ddd491d045319579ea1614d825ff5 (fix(operator): restore single connection control). This supersedes the precommit pending note above. Native review unavailable; no receipt asserted.
