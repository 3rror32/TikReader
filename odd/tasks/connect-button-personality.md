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
  - Status: reopened and resolved after independent verification found later important shared/theme control rules suppressing the Connect signature.
  - Finding: `skin_components.css` loads after the refinement styles and its important base, hover, focus, disabled, and theme button rules could replace the intended Connect surface and interaction states.
  - Resolution: the correction raises specificity with the existing Connect ID and `.btn-primary` class, then applies `!important` only to the theme-sensitive surface, focus, active, and disabled declarations; shared geometry remains unchanged.
  - Verification evidence: `node --test tests/test_connect_button.cjs tests/test_form_controls.cjs` — 5 passed, 0 failed; updated regression asserts stylesheet order and later shared/theme important rules; scoped `git diff --check` — passed.
  - Commit boundary: original commit `feat(ui): give connect action a broadcast ignition style` contains the core behavior; a separate correction commit records the cascade fix, assertions, and this task update. The pre-existing visual-refresh test and unrelated CSS navigation/responsive changes remain outside both commits.
- [x] T2 — Make focus contrast, reduced-motion precedence, and regression dependencies reliable.
  - Why T1 verification exposed follow-up defects: the focus outline used `--skin-accent-ink`, which does not contrast with several session-panel surfaces; reduced-motion's active selector omitted the `aria-disabled` qualifier; the test depended on uncommitted template and theme-signature files.
  - Resolution: use a dual focus ring from `--skin-surface` and `--skin-text`, match the full active selector in the reduced-motion rule, and keep the regression test limited to committed `skin_components.css` and `live_refinement.css` plus standard Node modules.
  - Focus evidence: committed theme tokens yield at least 7.22:1 contrast for `--skin-text` against `--skin-surface` across the existing themes (lowest is one-dark-pro); the outer ring is therefore evaluated against the adjacent panel surface rather than the button fill.
  - Verification evidence: `node --test tests/test_connect_button.cjs tests/test_form_controls.cjs` — 5 passed, 0 failed; scoped `git diff --check` — passed.
  - Commit evidence: separate Conventional Commit `fix(ui): make connect focus and motion fallback robust` includes the T2 source, regression coverage, and this record update.

## Next step
No implementation work remains; the T2 commit hash is included in the completion handoff. Preserve the original untracked visual-refresh test and unrelated CSS changes.
