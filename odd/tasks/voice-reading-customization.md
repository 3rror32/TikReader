# Voice reading customization

## Objective

Make spoken commenter names understandable and customizable, and let the user edit the automatic participant greeting in the voice settings.

## Problem and rationale

The voice panel uses separate checkboxes for reading a name and choosing the TikTok profile name. This makes the interaction unclear and cannot read both identifiers. The automatic participant greeting is fixed in code. The existing transmission privacy setting hides identity by replacing the spoken name with “Participante,” but lives outside the voice settings.

## Scope and constraints

- Replace the name checkboxes with one selector for account name, profile name, both names, or no name.
- Preserve existing saved preference behavior when migrating prior checkbox values.
- Add an editable automatic greeting text in the voice panel and support a `{usuario}` placeholder.
- Explain how “Ocultar nombres” affects spoken names and where that privacy control lives.
- Keep the new controls inside the organized voice settings group and migrate legacy values when loading saved workspace profiles.
- Do not change greeting detection, participant visibility, or unrelated chat greeting behavior.
- No tests are authorized for this task; perform structural readback and the native review applicable to the repository state.

## Forecast and delivery

- Forecast: approximately 100 authored changed lines, excluding generated files.
- Delivery strategy: ask-on-risk.
- Task route: delegated direct. Trigger: implementation changes the voice settings markup and multiple connected speech/greeting behaviors.

## Checklist

### VOICE-1 — Clarify name selection and customize automatic greeting

- [x] Replace the separate name toggles with a four-choice selector and preserve/migrate existing local preferences.
- [x] Apply account, profile, both, and no-name choices to spoken comments while respecting the existing hide-names privacy setting.
- [x] Add and persist editable automatic greeting text with `{usuario}` replacement.
- [x] Keep the controls grouped in the voice layout and migrate old preference keys from saved workspace profiles.
- [x] Read back the corrected controls and behavior.
- [ ] Complete native review if enabled (parent-owned).

**Authorized scope:**

- `web/templates/index.html`
- `web/static/studio.js`
- `web/static/production.js`
- `web/static/voice_layout.js`
- `web/static/workspace.js`
- `odd/tasks/voice-reading-customization.md`

**Acceptance criteria:**

- Each selector choice produces its stated name behavior; missing profile names fall back safely.
- Existing `tts-read-name` and `tts-use-profile-name` saved preferences map to the equivalent selector behavior.
- The greeting text is editable, persisted locally, and substitutes the participant name for `{usuario}`.
- The voice panel clearly explains the “Ocultar nombres” privacy control and the spoken “Participante” behavior.
- The selector and greeting controls remain in the “Lectura del chat” group; saved legacy workspace profiles map to the equivalent new choice.

**Checks:**

- Structural readback of the changed markup and JavaScript.
- Native risk assessment/review as required by the user-owned RDD switch.
- Automated tests are not authorized in this request.

**Progress:**

- Exploration confirmed the name selection is in `web/static/studio.js`, the automatic greeting text is hardcoded there, and privacy anonymization is implemented in `web/static/production.js`.
- Engram mirror: pending; no Engram memory tools are available in this session.
- VOICE-1 structural readback complete. Automated tests were not run as instructed; native review remains with the parent orchestrator.
- Automatic greetings now reuse the production display-name helper so “Ocultar nombres” also speaks “Participante” in greetings.
- Independent read-only review found the layout group references removed control IDs and old saved workspace profiles need migration; the verification checklist is reopened for these necessary compatibility fixes.
- The review also noted privacy is formatted before the audio queue; this follows the existing comment-voice behavior and is a deferred edge case, not a proven new defect for this feature.
- `gentle-ai` is unavailable in this environment; RDD status/assessment remain unknown pending the parent’s final native lifecycle attempts.
- Corrected the voice layout group and normalized legacy name preferences both during startup hydration and workspace profile application.
- Clarified the selector label so it explicitly applies to comment names; the greeting placeholder and privacy behavior are explained separately.
- Structural readback and `git diff --check` completed; automated tests remain unauthorized.
- Native review is unavailable: mode status, assessment, and selectorless STATUS all failed because `gentle-ai` is not recognized in this environment. After the feature commit, committed-only assessment and its required preflight STATUS also failed for the same reason. No review lifecycle was started; treat the outcome as unassessable, not approved.
- Engram mirror remains pending because no memory tools are available.
- Work-unit commit: `e5f9c4e` (`feat(voice): customize spoken names and greetings`).
- Next step: run the native review lifecycle in an environment where the `gentle-ai` CLI is available.

## VOICE-2 — Restore the quick comment-reading toggle

- [x] Bind the quick button through the same shared toggle helper as recent activity and gift reading, preserving its current label and state persistence.
- [x] Read back click wiring and state synchronization; automated tests remain unauthorized.
- [x] Keep the enabled/pressed visual state synchronized when the shared helper is unavailable.
- [x] Make the quick button directly toggle, persist, and render its own state without relying on the shared helper.

**Authorized scope:**

- `web/static/workspace.js`
- `odd/tasks/voice-reading-customization.md`

**Acceptance criteria:**

- Clicking “Leer comentarios” toggles `tts-enabled`, updates its pressed/enabled state, and persists the choice in `tikreader.voiceWanted`.
- The direct fallback also updates the enabled icon/state if the shared helper is unavailable.
- Existing voice status and pause controls retain their behavior.

**Route:** direct inline, one known one-file handler change. CodeGraph shows the shared helper already implements the behavior used by the working greeting and gift controls.

**Progress:** user reports that clicks still do not change the button. Replaced the helper dependency with a document-capture handler targeted to `#voice-toggle`; it toggles `tts-enabled`, persists `tikreader.voiceWanted`, and updates the pressed/icon state directly. Bumped the script query version so the browser fetches the updated handler after reload. Structural readback and `git diff --check` completed. Interactive UI verification and automated tests remain unrun. Native review mode status and committed-only assessment are unavailable because the `gentle-ai` CLI is not recognized. Work-unit commit: `968516c` (`fix(voice): repair comment reading toggle`).
