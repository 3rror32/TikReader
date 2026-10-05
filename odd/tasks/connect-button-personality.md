# Connect Button Personality

## Objective
Give the dashboard's primary TikTok Connect action a distinctive, theme-aware broadcast-ignition identity without changing its geometry or behavior.

## Problem
The top Connect action is the most-used control but currently reads as a generic primary button; it needs a focused visual signature that remains coherent across themes and accessible interaction states.

## Scope
- Add ID-specific styling for `button#btn-connect` in `web/static/live_refinement.css`.
- Add focused contract assertions in `tests/test_connect_button.cjs`.
- Preserve the shared form-controls geometry and all unrelated dirty working-tree changes.

## Constraints
- Derive colors from semantic theme tokens, especially `--skin-accent` and `--skin-accent-ink`; do not hardcode brand colors.
- Use one restrained hover/focus signal response, arrow movement, visible focus, tactile active state, disabled restraint, and reduced-motion support; no ambient animation.
- Do not edit `form_controls.css` or theme exception files.
- Engram mirror is pending because Engram tools are unavailable in this session.

## Authorized scope
- `odd/tasks/connect-button-personality.md`
- `web/static/live_refinement.css`
- `tests/test_connect_button.cjs`

## Route and trigger evidence
- Chosen route: delegated.
- Trigger evidence: meaningful CSS behavior plus dedicated regression coverage; task assigned to one bounded writer.

## Forecast and delivery
- Forecast: approximately 100 authored changed lines (CSS, assertions, and this task record).
- Delivery strategy: `ask-on-risk`.
- Work unit: one coherent Connect-button visual and regression-contract change.

## Acceptance criteria
- Connect's visual identity uses theme semantic tokens and an ID-specific rule that wins existing generic theme overrides.
- Hover/focus, focus-visible, active, disabled, and reduced-motion behavior are explicitly styled and regression-tested without pixel snapshots.
- Shared control sizing/alignment remains untouched.
- Focused verification passes; only authorized new hunks and this task document enter the work-unit commit.

## Applicable checks
- `node --test tests/test_connect_button.cjs tests/test_form_controls.cjs`
- `git -c safe.directory=C:/Users/Carlos/Documents/cedep/TikReaer diff --check -- web/static/live_refinement.css tests/test_connect_button.cjs odd/tasks/connect-button-personality.md`
- Runtime harness: N/A; CSS contract is checked by focused Node tests and no browser harness was requested.

## Progress
- [x] T1 — Implement the Connect visual contract and focused regression assertions in the working tree.
  - Route: delegated.
  - Status: implementation, focused verification, and one work-unit commit complete; dedicated coverage isolates this change from the pre-existing untracked visual-refresh test.
  - Verification evidence: `node --test tests/test_connect_button.cjs tests/test_form_controls.cjs` — 5 passed, 0 failed; scoped `git diff --check` — passed.
  - Commit boundary: commit `feat(ui): give connect action a broadcast ignition style` includes this task document, the dedicated test, and only the Connect-button CSS hunk. The pre-existing visual-refresh test and unrelated CSS navigation/responsive changes remain outside the commit.

## Next step
No implementation work remains; the commit hash is included in the completion handoff. Preserve the original untracked visual-refresh test and unrelated CSS changes.
