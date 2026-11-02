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
- [x] T1 — Queue fast-forward: `main` advanced through the existing queue work units; the gift marker already matched by patch-id.
- [x] T2 — Sidebar selective integration: alignment assertions and CSS update complete; focused test passed.
- [x] T3 — Main update: local `main` advanced to the selected feature commit.

## Evidence and next step
Current branch: `codex/minecraft-simulated-gift-delivery`, starting revision `b5a3976`. The source branch diff contained unrelated motion-setting test changes; they were excluded. Test-first evidence: `node --test tests/test_sidebar_navigation.cjs` failed on the new no-second-guide assertion before CSS changes, then passed all 14 tests after the CSS update. `git diff --check` passed. Work-unit commit: `dcd2f30 fix(sidebar): align nested destinations selectively`; its three staged paths were verified before committing. Local `main` moved from `dc6a17f` to `dcd2f30` by fast-forward. Clean-worktree checks passed: 65 JavaScript tests and 67 Python tests (two dependency deprecation warnings). The nine pre-existing local modifications remain unstaged. Remote `origin/main` was not fetched or updated.

## Deferred branches
- `codex/presenter-safe-startup`, `codex/remove-presenter-mode`, and `codex/sidebar-left-hierarchy` were not integrated because `main` already has equivalent or superseding behavior.
- `codex/sidebar-submenu-alignment` was not merged as a branch: it has textual conflicts and unrelated motion behavior. Only the reviewed alignment fragments were integrated.
- `codex/simulated-gift-delivery` was not merged as a branch: the selected gift marker is already present by equivalent patch.
- `codex/stream-buddies-walking` remains outside `main` because its change was explicitly reverted there; visual validation is needed before reconsideration.
