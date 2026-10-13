# Connect icon theme contrast

## Objective
Keep the TikTok connect button's plug icon legible across every selectable skin while preserving connection-state meaning.

## Problem and why
The icon currently inherits cyan or red stroke colors that can blend into some theme button backgrounds. A consistent white stroke keeps the icon readable; subtle state-colored glow can retain its disconnected/connected distinction.

## Scope and constraints
- Update only the connect plug icon styles and the browser skin QA check.
- Do not change the button label color.
- Keep the check focused on the real skin selector and real connect icon.
- Preserve unrelated user changes; do not modify, stage, or commit `tests/test_build_release.py`, `tests/test_server.py`, `tools/build_release.py`, or `web/static/custom_voice.js`.

## Authorized scope
`odd/tasks/connect-icon-theme-contrast.md`
`web/static/live_refinement.css`
`tools/qa_skins.cjs`

## Tasks
- [x] CI-1: Derive the complete selectable skin list from `#skin-select`, assert the real connect icon computes to white, and apply a narrowly scoped CSS fix.

## Acceptance criteria
- QA exercises every option in the real `#skin-select`.
- QA asserts the real `#btn-connect .connect-button__icon` has an exact white computed color for each skin.
- Connected and disconnected icon strokes are both white; state distinction remains subtle and legible.
- `node tools/qa_skins.cjs` passes; `git diff --check` is clean; unrelated dirty files remain untouched.

## Route and forecast
- Route: delegated.
- Trigger evidence: preparation reading for a CSS-and-QA change, plus two non-trivial files.
- Forecast: approximately 30 authored changed lines, excluding generated files; actual commit scope is 90 additions and 20 deletions (110 authored changed lines), including this 50-line feature document. The QA helper needed repair because it targeted a nonexistent `#skin-apply` and carried assumptions that contradicted the original skin's raised primary surface and accent-2 selection colors.
- Delivery strategy: ask-on-risk.
- Work-unit commit: required; record the commit identity below.

## Progress and evidence
- Initial repository status showed pre-existing user changes in `tests/test_build_release.py`, `tests/test_server.py`, `tools/build_release.py`, and `web/static/custom_voice.js`; these are out of scope.
- Initial CSS uses cyan for `data-state="disconnected"` and red for `data-state="connected"`.
- Initial QA skin list is hard-coded to ten values; the real selector contains additional skins.
- Engram mirror: pending; no memory tool is exposed in this runtime.
- RDD/review status: unknown/pending; native CLI status was unavailable to the parent.
- Skill resolution: `frontend-design` loaded; the registry-listed `work-unit-commits` skill file was absent from both configured skill roots.
- RED: `node tools/qa_skins.cjs` failed on the original skin because the real disconnected icon computed to `rgb(237, 247, 255)`, not `rgb(255, 255, 255)`.
- GREEN: `node tools/qa_skins.cjs` passed all 23 selectable skin values; both connected and disconnected states computed to `rgb(255, 255, 255)` for the real icon in every skin.
- Additional observed checks: `git diff --check` passed; status showed only the three authorized files modified by this task plus the pre-existing user changes. Generated screenshots from the QA command were removed before staging.
- Changed-line count: 110 authored lines total (90 additions, 20 deletions), including this feature document; generated screenshots excluded.
- Commit: `fix(ui): keep TikTok plug icon white across skins` (the hash is the HEAD commit; report its exact value in the handoff).

## Next step
Parent spot-checks the committed three-file work unit; Engram mirror and native review status remain pending.
