# Focus mode and visible voice queue

## Objective and authorized scope
Improve the existing concentration mode and reading queue so a LIVE operator can see current speech, next message, and pending count without opening queue details, and optionally reveal gifts while focused.

## Problem and constraints
The existing queue is initially collapsed; concentration hides gifts without an inline reveal control. Reuse Studio snapshots, queue actions, concentration preference, and existing icon hooks. Preserve session, voice, and layout behavior. UI copy follows the existing Spanish interface. No remote operations.

## Delivery and routing
One coherent work unit on the current feature branch `codex/recovery-safety-build-identity`. Forecast: 250–380 authored changed lines; strategy: ask-on-risk if exceeding approximately 400. Route: delegated direct; preparation and multiple non-trivial files require a bounded writer. Exploration completed read-only using CodeGraph and targeted reads. Parent spot check confirmed existing controls in live_experience.js.

## Tasks
- [x] FQ1: Improve focus controls and add always-visible current/next/pending voice summary; implementation `ae0dd55`, mobile correction `8d4febb`.
- [x] FQ2: Independently verify behavior, responsive layout, and focused regression commands; closure evidence below.

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

Work-unit commit: `ae0dd55` (244 additions / 4 deletions). Independent verification then found candidate-caused nested feed clipping at 390 px after the gifts label expanded; document-level overflow checks had missed the nested scroll offset. Bounded correction makes the focus toolbar and its action group wrap within the available mobile width, preserving desktop styles. New browser assertions verify feed scrollWidth/clientWidth, zero scrollLeft, and summary bounds after showing/hiding gifts and exiting focus at 390/900/1440. Observed RED: nested feed measured 400 px against 372 px available. Observed GREEN: focus browser 1/1 passed, Node 2/2 and 70/70 passed, and `git diff --check` passed. Correction adds approximately 30 authored lines, keeping cumulative work below 400; correction commit identity is recorded by parent after commit creation. Independent correction readback remains pending.

## Closure
Independent verification observed 72/72 Node tests and the browser focus test passing. After correction `8d4febb`, independent browser recheck passed 1/1 at 390/900/1440; supplemental 390px keyboard open/close/exit checks retained scrollLeft=0 and scrollWidth=clientWidth=372. Rendered mobile screenshot inspected at `runtime/operator-browser/focus-verify-fixed-390.png`; long current/next text and focus outlines remain visible. No remaining findings. Parent reran the two new regressions successfully and git diff --check passed. Work units total 275 authored additions/deletions, below the chain threshold. Missing work-unit skill fallback discovery completed without a replacement. Engram mirror remains unavailable/pending. Native RDD state unknown and assessment unavailable; no receipt or native approval claimed. Physical audio and a real LIVE connection were not verified; speech/backend were mocked.

## Next step
Ready for user use and optional real LIVE/audio smoke check. No push or publication performed.
