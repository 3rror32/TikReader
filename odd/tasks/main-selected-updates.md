# Main Selected Updates

## Objective
Apply the authorized Minecraft queue fast-forward and selective sidebar alignment updates to main through the current feature branch, preserving unrelated work.

## Problem and rationale
The selected main updates need the Minecraft queue delivered, while sidebar submenu alignment is limited to the targeted alignment changes. The existing gift marker already matches by patch-id and needs no edit.

## Scope and constraints
- Queue fast-forward: parent-owned integration step; no queue edits in this writer task.
- Sidebar selective integration: update only `web/static/sidebar.css` and `tests/test_sidebar_navigation.cjs` for submenu alignment; omit motion behavior changes from the source branch.
- Main update: parent-owned after this feature-branch commit.
- Preserve all nine pre-existing modified files exactly; do not stage or commit them.
- Do not merge or cherry-pick the sidebar branch wholesale, and do not move main.
- Engram mirror is pending because the memory provider is unavailable in this task context.

## Acceptance criteria
- Sidebar hierarchy uses one outer guide and nested containers do not add duplicate indentation or guides.
- Expanded disclosure destinations are selectively left-aligned; collapsed navigation behavior remains intact.
- Assertions cover the intended submenu alignment and destination selector behavior.
- Only the task document, `web/static/sidebar.css`, and `tests/test_sidebar_navigation.cjs` are included in the work-unit commit.
- The existing nine modified files remain unchanged and unstaged.

## Checks
- Test first: `node --test tests/test_sidebar_navigation.cjs` must show RED after the assertions change and before the CSS change.
- Then run `node --test tests/test_sidebar_navigation.cjs` for GREEN.
- Check formatting and staged paths before committing.

## Tasks and progress
- [ ] T1 — Queue fast-forward: parent-owned; existing gift marker match means no marker edit is needed.
- [x] T2 — Sidebar selective integration: alignment assertions and CSS update complete; focused test passed.
- [ ] T3 — Main update: parent-owned after the feature-branch work-unit commit.

## Evidence and next step
Current branch: `codex/minecraft-simulated-gift-delivery`, starting revision `b5a3976`. The source branch diff contained unrelated motion-setting test changes; they were excluded. Test-first evidence: `node --test tests/test_sidebar_navigation.cjs` failed on the new no-second-guide assertion before CSS changes, then passed all 14 tests after the CSS update. `git diff --check` passed. Next: verify only the three authorized paths are staged and commit the work unit.
