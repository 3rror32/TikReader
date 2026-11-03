# README Visual Refresh

## Objective

Refresh the main README so it accurately presents the current operator workflow and uses polished, privacy-safe screenshots of the real application.

## Problem

The README still centers the 1.0.0.9 feature set and its existing screenshots do not show the durable Minecraft activity queue, the improved simulation workflow, or the current operational navigation.

## Why

New users should understand the product's strongest current capabilities from the repository landing page without relying on stale visuals or exposing real account data.

## Scope

- Capture attractive desktop screenshots from the current local `main` build using safe demo state only.
- Feature the live operator workspace, simulation controls, and Minecraft activity/queue experience.
- Rewrite the README feature summary and screenshot captions around current behavior.
- Preserve installation, integration-status, privacy, and validation caveats.

## Constraints

- Do not expose credentials, real chat identities, account tokens, private paths, or personal data.
- Do not imply that unvalidated external integrations are production-certified.
- Do not trigger real Minecraft, OBS, TikTok, YouTube, Twitch, Spotify, or Streamer.bot actions while composing screenshots.
- Keep screenshots legible on the GitHub README at desktop and narrow widths.

## Authorized scope

The user explicitly requested updating the README on `main` with new functionality and replacing its screenshots with more visually attractive images.

## Tasks

- [ ] **RVR-1 — Capture privacy-safe product visuals**
  - Route: direct inline because Windows UI capture must remain bound to the orchestrator's Computer Use session.
  - Trigger evidence: generated screenshots are passive visual assets; no source-code writer is needed.
  - Acceptance criteria:
    - Three current desktop screenshots show the operator workspace, simulation, and Minecraft activity/queue.
    - Images contain no personal or secret data and use realistic but non-live demo state.
    - Composition is legible, balanced, and visually consistent.
  - Checks: inspect every final image at full resolution and README scale.

- [ ] **RVR-2 — Rewrite the README feature presentation**
  - Route: direct inline because this is one bounded prose file with already-established product evidence.
  - Trigger evidence: the README is the only non-generated content file.
  - Acceptance criteria:
    - The opening explains TikReader as an operator workspace, not only a chat reader.
    - Current simulation, durable Minecraft queue, recovery, overlays, and local voice capabilities are represented accurately.
    - The new screenshots replace stale hero/support visuals with descriptive alt text.
    - Installation and integration caveats remain intact.
  - Checks: Markdown link/image-path validation and structural readback.

- [ ] **RVR-3 — Verify the repository presentation**
  - Route: direct inline structural and visual verification.
  - Trigger evidence: passive documentation and image assets require structural readback, not an artificial semantic test suite.
  - Acceptance criteria:
    - Every referenced local image exists and renders.
    - `git diff --check` passes for the README and task document.
    - The final diff contains only the authorized README, screenshot assets, and task tracking changes.
  - Checks: file existence, image dimensions, Markdown references, and final diff review.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: fewer than 200 authored documentation lines plus three generated PNG assets.
- Engram mirror: pending because no Engram memory tools are available in this session.

## Progress

- Existing README and screenshot inventory reviewed.
- CodeGraph is unavailable in this worktree because it has no local index; bounded filesystem inspection is used instead.

## Verification evidence

Pending.

## Next step

Prepare a clean local demo state and capture the three product views.
