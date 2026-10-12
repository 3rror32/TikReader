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
  - Commit: pending.
  - Review assessment: unavailable; `gentle-ai review mode status` could not run because the executable was not found. RDD state remains unknown.

- [ ] **TCB-2 — Verify the operator connection flow**
  - Route: delegated direct verification.
  - Trigger evidence: browser execution and regression checks are delegated by policy.
  - Acceptance: focused operator and startup browser specifications pass.
  - Checks: `npm run test:operator -- tests/browser/operator.spec.cjs tests/browser/startup.spec.cjs` or the repository-equivalent focused command identified by the worker.
  - Evidence: `npm run test:operator -- tests/browser/operator.spec.cjs tests/browser/startup.spec.cjs` completed with 13 passing and 7 failing. The failing baselines are `tests/visual-baselines/operator/original.png`, `light.png`, `dark.png`, `broadcast-console.png`, `creator-pop.png`, `swiss-brutalist.png`, and `tactile-scrapbook.png`. The inspected original diff contains the intended plug-control change and broad unrelated rendering differences in activity, participant, and feed areas, so the failures are mixed and cannot all be attributed to this task. Baselines are outside this task's authorized edit surfaces and remain pending. Startup checks and the non-visual operator checks passed.

## Progress and next step

TCB-1 is implemented and its focused browser regression is green. TCB-2 remains partial until the seven out-of-scope visual baselines are reconciled. Authored code and test changes currently total 152 changed lines (additions plus deletions; task-document edits excluded). RDD could not be assessed because the `gentle-ai` executable is unavailable in this environment.
