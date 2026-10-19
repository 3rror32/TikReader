# Focus mode and visible voice queue

## Objective and authorized scope
Improve the existing concentration mode and reading queue so a LIVE operator can see current speech, next message, and pending count without opening queue details, and optionally reveal gifts while focused.

## Problem and constraints
The existing queue is initially collapsed; concentration hides gifts without an inline reveal control. Reuse Studio snapshots, queue actions, concentration preference, and existing icon hooks. Preserve session, voice, and layout behavior. UI copy follows the existing Spanish interface. No remote operations.

## Delivery and routing
One coherent work unit on the current feature branch `codex/recovery-safety-build-identity`. Forecast: 250–380 authored changed lines; strategy: ask-on-risk if exceeding approximately 400. Route: delegated direct; preparation and multiple non-trivial files require a bounded writer. Exploration completed read-only using CodeGraph and targeted reads. Parent spot check confirmed existing controls in live_experience.js.

## Tasks
- [ ] FQ1: Improve focus controls and add always-visible current/next/pending voice summary, with regression checks and one work-unit commit.
- [ ] FQ2: Independently verify behavior, responsive layout, and focused regression commands; record limitations.

## Acceptance criteria
- Existing concentration preference and keyboard-accessible exit work across reload and repeated toggles.
- Gifts can be revealed in focus mode and normal layout restores on exit.
- Visible current/next/count use Studio state, including pause, skip, completion, expiry, errors, and session clearing; queue management remains accessible.
- Untrusted comment text uses safe text rendering; no horizontal overflow at desktop/tablet/mobile widths.

## Checks
Applicable test-first policy: observe meaningful deterministic regression RED before implementation, GREEN afterwards; add focused Node and browser coverage.
`node --test tests/test_live_experience.cjs`
`node --test tests/test_frontend.cjs tests/test_workspace_voice.cjs tests/test_rvc_controls.cjs`
`npm run test:operator -- --grep "focus mode"`
Independent verification and parent command spot check required because native assessment is unavailable.

## Progress and evidence
Repository initially clean. Native gentle-ai review command not found on PATH or usual local binary locations: RDD state unknown, assessment unavailable; no native approval claimed. Registry points to a missing work-unit-commits skill; fallback discovery pending. Engram tools unavailable: full mirror `odd/focus-voice-queue/tasks` pending; local document is the recovery record.

FQ1 implementation: retained concentration preference and icon hooks; added a labeled keyboard-accessible gifts disclosure which resets on exit, and a theme-aware always-visible reading strip showing Studio current/next/status/pending count independently of collapsible queue management. Responsive gifts columns use one column on phones and two when space permits. No parallel voice model or engine changes were introduced.

Observed RED: both new deterministic focus/voice-summary regressions failed against the previous UI. Observed GREEN: `node --test tests/test_live_experience.cjs` passed 2/2; `node --test tests/test_frontend.cjs tests/test_workspace_voice.cjs tests/test_rvc_controls.cjs` passed 70/70. Additional expiry and synchronous-start-error regressions passed on the existing engine; callers already refresh status, so no engine fix was necessary. Browser `npm run test:operator -- --grep "focus mode"` passed 1/1, covering keyboard use, focus persistence/reload/exit, gifts, no horizontal overflow at 390/900/1440, safe text, collapsed management, current/next/count, pause/skip/error/clear. Browser fixture speech is mocked and releases backend holds because no audio-owner heartbeat is present; no physical audio hardware is verified. Initial browser failures were fixture setup omissions (backend-ready on reload, native utterance type, and audio-owner holds), corrected without weakening product assertions. Screenshot baselines were not changed.

Source-mutating normalizers: none applicable to these plain JS/CSS changes. `git diff --check` passed. Work-unit skill fallback found no replacement; ordinary Conventional Commit used. Independent verification and parent spot check remain pending; Engram mirror remains pending.

## Next step
Independent verifier checks the completed candidate and parent records closure. Native assessment unavailable means no receipt or native approval is claimed.
