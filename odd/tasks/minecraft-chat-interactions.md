# Minecraft and Chat Interactions

## Objective

Make TikTok chat activity more visible and participatory during Minecraft streams with comment bubbles and a named wolf companion. Reuse the app-managed chat poll that already counts one vote per viewer and publishes a poll widget.

## Problem and rationale

The broadcast overlay currently presents comments as feed cards, while Minecraft's existing wolf action names each spawned wolf after the donor. The requested stream experience needs comments that read as on-screen speech and a recognizable community pet. Chat voting is already implemented, so this work should connect to the existing poll workflow instead of adding a second voting system.

## Scope and constraints

- Add a bubble presentation to the existing broadcast comment overlay.
- Add a dedicated, gift-triggered community wolf preset named “Lobito” with Java/Bedrock command support.
- Preserve existing comments, poll controls, poll tallying, Minecraft safety limits, and preset persistence.
- Reuse the existing app-managed poll and interactive widget; do not create parallel poll state.
- Preserve pre-existing work in `assets/sprites/walk-v3/review-chibis.png`, `assets/sprites/walk-v3/review-data.js`, and `odd/tasks/stream-buddy-sprite-refresh.md`.

## Authorized scope

- `frontend/entries/broadcast.ts`
- `frontend/styles/broadcast.css`
- `web/templates/overlay.html`
- `app/minecraft_presets.py`
- `web/static/minecraft.js`
- `web/static/minecraft.css`

## Tasks

### MCI-1 — Show chat comments as broadcast bubbles

- [x] Render incoming chat comments in a readable bubble style using the existing broadcast comment feed.
- [x] Keep the presentation legible at stream-overlay sizes and responsive to viewport changes.
- [x] Preserve the existing comments overlay mode and live update behavior.

Acceptance: new comments appear as readable on-screen bubbles in the broadcast overlay without changing the underlying comment feed or poll behavior.

### MCI-2 — Add a named community wolf action

- [x] Add a dedicated wolf pet preset with the fixed display name “Lobito”.
- [x] Expose it in the Minecraft action catalog and gift mapping UI.
- [x] Generate safe edition-specific Java and Bedrock commands through existing validation and pacing limits.

Acceptance: the streamer can map a gift to the community wolf, and the resulting command names it “Lobito” consistently in both supported editions.

### MCI-3 — Reuse existing chat voting

- [x] Confirm the app-managed chat poll already counts one vote per viewer and is published to the interactive widget.
- [x] Reuse the existing poll controls and widget; no parallel poll implementation is needed.

## Route and estimate

- Route: delegated direct implementation, because this requires coordinated UI and backend changes across multiple non-trivial files.
- Trigger evidence: broadcast rendering spans the TypeScript entry, overlay template, and stylesheet; the named wolf spans the catalog, Minecraft UI, and command generation.
- Estimated authored changes: approximately 300 lines, excluding generated files. Delivery strategy: `ask-on-risk`.
- RDD status could not be read because the `gentle-ai` CLI is unavailable in this environment; do not infer the switch is off.

## Checks and evidence

- Structural readback of the changed surfaces and independent review of the final diff.
- `git diff --check`: passed after the final correction.
- Independent review found paint containment clipped the speech-bubble tail; `.comment-bubble` now keeps layout containment without paint containment.
- Tests were not requested and will not be added or run in this session.
- Engram mirror `odd/minecraft-chat-interactions/tasks` is pending because the local Engram store denied access; retry synchronization when that store is available.

## Progress and next step

- MCI-3 is complete from source inspection: `app/interactivity.py` parses numeric chat votes, deduplicates by viewer, and publishes poll state; `web/static/interactive_widget.js` renders the poll.
- MCI-1 and MCI-2 are implemented; structural readback is complete, the review finding is corrected, and `git diff --check` passed.
- Tests were not added or run, as directed.
- Engram mirror `odd/minecraft-chat-interactions/tasks` remains pending because the local Engram store denied access.
