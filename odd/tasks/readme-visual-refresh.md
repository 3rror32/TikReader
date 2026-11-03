# README Visual Refresh

## Objective

Refresh the main README so it accurately presents the current operator workflow and uses polished, privacy-safe screenshots of the real application.

## Problem

The README still centers the 1.0.0.9 feature set and its existing screenshots do not show the durable Minecraft activity queue, the improved simulation workflow, or the current operational navigation.

## Why

New users should understand the product's strongest current capabilities from the repository landing page without relying on stale visuals or exposing real account data.

## Scope

- Leave screenshot replacement to the user while preserving the existing README image references.
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

- [x] **RVR-1 — Defer screenshot replacement to the user**
  - Route: direct inline scope reconciliation.
  - Trigger evidence: the user explicitly chose to provide the replacement images and requested text-only work from the orchestrator.
  - Acceptance criteria:
    - Existing image files and paths remain unchanged.
    - README text does not depend on unavailable replacement images.
  - Evidence: no screenshot asset was created, replaced, or removed; the user will update images separately.

- [x] **RVR-2 — Rewrite the README feature presentation**
  - Route: direct inline because this is one bounded prose file with already-established product evidence.
  - Trigger evidence: the README is the only non-generated content file.
  - Acceptance criteria:
    - The opening explains TikReader as an operator workspace, not only a chat reader.
    - Current simulation, durable Minecraft queue, recovery, overlays, and local voice capabilities are represented accurately.
    - Existing screenshot paths remain stable and the hero alt text is ready for the user's replacement image.
    - Installation and integration caveats remain intact.
  - Checks: Markdown link/image-path validation and structural readback.
  - Evidence: the hero and capability summary now describe the unified operator workspace, simulation, durable Minecraft pacing and recovery, local voice, overlays, gift mapping, and operational safeguards. Installation and integration caveats remain present, and image paths are unchanged.

- [x] **RVR-3 — Verify the repository presentation**
  - Route: direct inline structural and visual verification.
  - Trigger evidence: passive documentation and image assets require structural readback, not an artificial semantic test suite.
  - Acceptance criteria:
    - Every referenced local image exists and renders.
    - `git diff --check` passes for the README and task document.
    - The final diff contains only the authorized README and task tracking changes.
  - Checks: image-reference existence, Markdown structure, and final diff review.
  - Evidence: all three local README image references resolve to existing files; the heading structure reads back correctly; `git diff --check` passes; and the final uncommitted scope contains only `README.md` and this task document.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: fewer than 200 authored documentation lines plus three generated PNG assets.
- Engram mirror: pending because no Engram memory tools are available in this session.

## Progress

- Existing README and screenshot inventory reviewed.
- CodeGraph is unavailable in this worktree because it has no local index; bounded filesystem inspection is used instead.
- RVR-1 was reconciled with the user's text-only continuation; image replacement is intentionally left to the user.
- RVR-2 and RVR-3 are complete; the README text is current and structurally verified.

## Verification evidence

- `git diff --check -- README.md odd/tasks/readme-visual-refresh.md`: passed.
- README image references: 3 checked, 3 existing.
- Final changed-file scope before commit: `README.md` and `odd/tasks/readme-visual-refresh.md` only.

## Next step

The user can replace the three existing screenshot files when the new images are ready; no README path changes are required.
