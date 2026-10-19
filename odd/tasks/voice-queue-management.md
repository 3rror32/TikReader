# Voice queue management

## Objective and authorized scope
Add practical pending voice queue management: reorder, remove, and clear pending messages. Continue current speech when clearing. Extend existing Studio actions and UI without duplicating voice state.

## Problem and scope
The queue already supports front/remove, but lacks adjacent reordering and safe clear-pending controls. Rerendered controls may lose keyboard focus. Preserve current playback, paused state, deferred items, safe text rendering, existing priority behavior except deliberate manual moves, and the visible summary/focus layout. Spanish UI copy matches the existing app; code/tests use English. No remote operations or publication.

## Routing and delivery
Delegated direct: preparation and multi-file behavior require a bounded writer. Read-only explorer used CodeGraph first, then targeted reads because lexical results were unrelated. Parent spot check: current editQueue and queue renderer. Branch: codex/recovery-safety-build-identity. Forecast 250–380 authored changed lines; one coherent work unit, ask-on-risk above approximately 400. Registry skill work-unit-commits unavailable after fallback discovery; frontend-design available.

## Tasks
- [x] QM1: Extend engine/UI with safe up/down/remove/clear pending and keyboard focus retention; implementation `9db8acf`, label correction `cd6dddd`.
- [x] QM2: Independently verify behavior and mobile controls; closure evidence below.

## Acceptance criteria
- Up/down changes pending order; boundary/missing IDs are harmless. Subsequent ordinary arrivals do not undo the manual move.
- Clear removes all pending entries and preserves active speech, pause/hold, deferred entries and voice callbacks.
- Queue/next/count update immediately; boundary and empty actions are disabled appropriately.
- Keyboard focus remains useful during edits and automatic queue progress; stale actions target stable IDs.
- Untrusted text stays safe and controls fit mobile/desktop without nested overflow.

## Checks
Test-first: meaningful deterministic RED before implementation, then GREEN.
`node --test tests/test_frontend.cjs tests/test_live_experience.cjs tests/test_workspace_voice.cjs tests/test_rvc_controls.cjs`
`npm run test:operator -- tests/browser/operator.spec.cjs --grep "queue management|focus mode"`
Independent verifier required; parent spot check reruns one reported command. No screenshot baseline updates. Physical audio and real LIVE connection may remain unverified when using mocks.

## Progress
Repository initially clean. Exploration complete. Native gentle-ai review tooling not located in this session; RDD unknown/assessment unavailable, no native approval claimed. Engram tools unavailable; full mirror odd/voice-queue-management/tasks pending. Local file is recovery record.

QM1 implemented: adjacent up/down swaps preserve positional priority slots so ordinary arrivals retain manual relative order; existing front/remove/later/restore remain compatible. Explicit `Studio.clearPendingVoice()` clears only pending entries and returns the count without touching active playback, paused/held state, deferred messages, log or callback generations. Numbered accessible rows offer Subir/Bajar/Siguiente/Quitar with boundary disabling, plus Vaciar pendientes and helper copy explaining current playback continues. Stable item/action focus restores after edits and automatic progress, falls back to a neighbor or visible queue disclosure, and does not steal focus from unrelated inputs. Controls wrap within the queue.

Observed RED: adjacent move returned false and clear-pending API was missing. Observed GREEN: `node --test tests/test_frontend.cjs tests/test_live_experience.cjs tests/test_workspace_voice.cjs tests/test_rvc_controls.cjs` passed 74/74. Browser `npm run test:operator -- tests/browser/operator.spec.cjs --grep "queue management|focus mode"` passed 2/2 (final run 34.7 s), covering 390/900/1440 nested overflow, keyboard focus during edits/removal/automatic progress, boundaries, safe text, next/count, and clearing while current playback continues. Unit checks also cover stale IDs, unknown actions, future arrivals after cross-priority moves, preserved deferred/log/pause/holds, and callback continuity. `git diff --check` passed. No source-mutating normalizer applicable; no baseline updates. Speech is mocked, so physical audio and real LIVE are unverified.

Concurrent unrelated dragon-theme changes appeared during this work, including a separate browser-test hunk. They were preserved and excluded from this feature commit; final repository cleanliness cannot be claimed. Owned work is approximately 180 authored lines plus this recovery document, below the 400-line advisory threshold. Independent verification and parent command spot check remain pending. Engram mirror remains pending.

Initial implementation commit: `9db8acf` (196 additions / 8 deletions). Independent screenshot inspection found that the shared icon decorator replaced queue button labels with icons, including identical ellipses for Subir/Bajar/Vaciar pendientes. Bounded correction marks all queue buttons with the existing `data-live-label` opt-out, preserving readable text and wrapping without altering other live controls. New browser regression measures actual computed font size and text-range dimensions/bounds for every queue button at 390/900/1440. Observed RED: Saltar lectura actual had computed font size 0. Observed GREEN: all queue labels render at least 11 px and fit their buttons; both focused browser cases pass (35.5 s), all 74 Node tests pass, and diff checks pass. No new scope or engine change. Final independent visual readback remains pending; parent records correction identity after creation.

## Closure
Independent verifier observed 74/74 Node tests and 2/2 browser tests. After label correction `cd6dddd`, independent focused browser rerun again passed 2/2. Rendered screenshots at 390/1440 show six readable Spanish action labels at 14 px; regression covers 390/900/1440. Nested feed scrollWidth equals clientWidth and scrollLeft remains zero. No remaining findings. Parent spot check reran tests/test_live_experience.cjs successfully (2/2). Implementation and correction total 221 authored additions/deletions, below the chain threshold. Concurrent unrelated theme edits remain preserved in the worktree and were excluded from the feature commits; browser verification used that live tree. Engram mirror remains unavailable/pending; native assessment unavailable, RDD unknown, no receipt or native approval claimed. Physical audio and a real LIVE connection remain unverified.

## Next step
Ready for user use and optional real LIVE/audio smoke check. No push or publication performed.
