# Compact comments and voice status

## Objective and authorized scope
Remove the redundant LIVE connection prompt and button inside Comments. Make voice status compact and discreet: no idle current/next placeholders or repeated empty counts/status. Show current/next when they contain actual messages. Preserve operational errors, pause/hold status, accessible feedback, voice queue management, and the main connection panel.

## Evidence and routing
Screenshot provided by user shows duplicate voice state and a large idle summary. Empty-state writers run in several modules; scoped presentation can consistently hide only the comments placeholder without changing connection logic. Delegated direct route: reading prepares changes across UI logic, CSS and regressions. Parent spot checked live summary construction and refresh. Frontend-design skill available; work-unit-commits skill unavailable after previous fallback discovery.

## Delivery
Branch codex/recovery-safety-build-identity. Forecast 100–220 authored additions/deletions, one coherent work unit; ask-on-risk above approximately 400. Existing unrelated theme edits in index.html/creator.html/theme styles/tests and a separate operator browser hunk must be preserved and excluded from commits. Spanish UI copy matches current app, code/tests English. No remote operations.

## Tasks
- [ ] CV1: Compact comments and voice presentation with meaningful regression checks, then commit owned work.
- [ ] CV2: Independently verify rendered idle/active/mobile layouts and close tracking.

## Acceptance criteria
- No visible comments connection prompt/CTA, including after clearing, reconnect and errors; main connection controls remain.
- Idle voice summary is one small muted line, current/next rows hidden when empty, no duplicate voice status or zero pending count.
- Active current/next and nonzero pending counts remain useful; errors/paused/holds still visible and accessible.
- Queue controls and focus behavior remain usable without nested overflow at 390/900/1440.

## Checks
Test-first meaningful RED then GREEN for new presentation rules.
`node --test tests/test_live_experience.cjs tests/test_frontend.cjs tests/test_workspace_voice.cjs tests/test_rvc_controls.cjs`
`npm run test:operator -- tests/browser/operator.spec.cjs --grep "focus mode|queue management|compact voice|theme"`
No screenshot baseline updates. Independent rendered inspection and parent spot check required. Speech/backend may be mocked; no physical audio or real LIVE proof claimed.

## Progress and limitations
Read-only exploration completed with CodeGraph and targeted CSS/empty-state reads. Native gentle-ai unlocated, RDD unknown/assessment unavailable; no native receipt claimed. Engram tools unavailable: full mirror odd/compact-comments-voice/tasks pending. Preserve local recovery record.

CV1 implemented: scoped comments placeholder hiding removes its redundant connection prompt/CTA across dynamic writers while main connection controls remain. The overview hides empty current/next rows and zero pending count, hides redundant voice-visible text, strips only the trailing queue-count segment from its displayed status, and uses a muted 28 px idle line without the active accent. Canonical Studio status and actual messages, pause/holds/errors, and queue management are preserved.

Observed RED: UI regression found the duplicated `Voz pausada · cola: 1` instead of concise status. Observed GREEN: all 74 focused Node tests passed; requested browser filter ran 3 cases and all passed (31.3 s). A subsequent compact-only run after screenshot setup also passed (12.2 s). Browser assertions cover initial/clear/reconnect/error placeholder suppression, retained main connection controls, idle height <=30 px at 390/900/1440, actual current/next/count and accessible errors. Existing focus and queue management tests pass. Diff checks passed; no applicable source-mutating normalizers or baseline updates. Screenshot inspection confirmed muted idle and useful active rows on desktop and mobile. Screenshots: runtime/operator-browser/results/operator-compact-voice-kee-04ff2-s-actual-reading-and-errors/compact-idle-{390,900,1440}.png and compact-active-{390,1440}.png. Mobile screenshots use the real focus control to expose comments because the existing sidebar obscured the nonfocused mobile capture; no sidebar production changes were made. Physical audio and real LIVE remain unverified.

Updated only the affected existing theme recovery helper to expect the comments CTA hidden and main connect visible. Unrelated concurrent theme edits remain untouched and excluded from this feature commit. Independent verification and parent spot check remain pending; Engram mirror remains pending. Owned work stays below the 400-line advisory threshold.

## Next step
Independent verifier checks this candidate; parent records commit identity and closes observed tasks.
