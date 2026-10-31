# Sidebar submenu alignment

## Objective

Align every expanded sidebar level to the left while preserving a consistent, intentional margin for menus and their child submenus.

## Problem and why

The sidebar applies the same indentation rule to both the advanced-section container and nested `.nav-submenu` containers. Nested groups therefore accumulate a second margin, padding, and border, pushing destinations such as Efectos, Herramientas, Metas, and Mis animaciones farther right than sibling destinations such as Favoritos and Mis overlays.

## Authorized scope

- Normalize expanded submenu indentation in `web/static/sidebar.css`.
- Preserve icons, disclosure arrows, vertical guide, collapsed behavior, responsive behavior, focus, active states, and route semantics.
- Add a focused regression in `tests/test_sidebar_navigation.cjs`.
- Verify representative Overlays and Chat submenus at the narrow sidebar width shown by the user.

## Constraints

- Do not redesign the sidebar or change labels/navigation hierarchy.
- Use logical CSS properties where appropriate so alignment remains direction-safe.
- Keep a minimum 40 px destination target and existing theme tokens.
- Engram mirror is pending because no Engram memory tools are available.

## Delivery strategy

`exception-ok`: one focused CSS contract and its regression test on an isolated feature branch.

## Tasks

- [x] `SSA-01` Remove accumulated nested indentation and align submenu icon/text columns across all disclosure levels.
  - Route: delegated direct.
  - Trigger: the shared CSS contract and regression test span two non-trivial files; visual verification is required across multiple menu groups.
  - Test-first policy: add a failing structural regression for nested submenu flattening, then implement GREEN.
  - Acceptance: direct and nested submenu labels share the same text start; only one vertical guide is visible per expanded advanced section; collapsed/mobile behavior remains intact; focused navigation tests and `git diff --check` pass.
- [x] `SSA-02` Restore visible hierarchy: menu summaries align to the left at the parent inset, while submenu destinations align to the left at one consistent child inset.
  - Route: delegated direct.
  - Trigger: the correction updates the shared CSS contract and its regression test, and requires responsive visual verification.
  - Test-first policy: strengthen the structural regression to distinguish parent and child margins before changing CSS.
  - Acceptance: no menu or submenu content is centered; every item at the same hierarchy level shares one left edge; each child level has a deliberate, consistent inset and guide; collapsed icons remain centered; focused tests and narrow-view visual checks pass.

## Evidence

- The initial shared container rule applied the same 22 px margin, 10 px padding, and guide to `.sidebar-disclosure-content` and `.nav-submenu`.
- Before SSA-01, a `.nav-submenu` nested inside `.sidebar-disclosure-content` repeated that indentation and guide.
- Initial screenshot evidence showed second-level entries visibly farther right than their direct siblings; SSA-02 now preserves that difference as a single deliberate hierarchy step.
- RED: the new nested-container/summary regression failed against the original CSS (13 passed, 1 failed); it identified the missing flattened nested-container and summary-column rules.
- GREEN: `node tests/test_sidebar_navigation.cjs` passes 14/14 after adding the nested reset and shared nested-summary columns.
- Superseded first visual attempt: the representative DOM under `runtime/sidebar-alignment/` was not an actual-app verification. Independent verification on the actual app found expanded destination label starts differed by 33.41 px at 390 px and 30.61 px at 280 px because buttons remained centered.
- Correction RED: the strengthened regression failed on `2fce6f1` (14 passed, 1 failed), proving `.app-sidebar` class specificity still lost to the ID-specific global text-button contract.
- Cascade cause: `web/static/form_controls.css` uses `:is(#ui-text-button-contract, ...)`, giving the global button alignment rule ID specificity. The sidebar declaration now uses `#app-sidebar` and excludes `body.sidebar-collapsed`.
- Correction GREEN: after adding `#app-sidebar` specificity to the expanded disclosure destination rule, `node tests/test_sidebar_navigation.cjs` passed 15/15. The selector still excludes collapsed mode so collapsed icons remain centered.
- Cascade attempts: the original rule had no left-alignment declaration (`a1afa5b`); the class-specific normal declaration (`2fce6f1`) lost to the global ID branch; the one-ID normal declaration (`317aa0c`) still lost because `:is(...)`/`:not(...)` accumulated specificity. The final scoped declaration uses `justify-content:flex-start!important` only for `body:not(.sidebar-collapsed) #app-sidebar details [data-section-nav]`.
- Final correction RED: the regression failed on `317aa0c` (14 passed, 1 failed) because the exact scoped `!important` declaration was absent. Final GREEN: `node tests/test_sidebar_navigation.cjs` passed 15/15 after adding it.
- Actual-app attempt 1: the earlier representative DOM diagnostic was not an actual-app verification and is superseded.
- Actual-app attempt 2: `runtime/sidebar-alignment-verify/actual.spec.cjs` uses the repository browser fixture and production templates/scripts/styles, but its Chat group selector did not resolve. The captured `actual-390-overlays.png` shows the app view without the sidebar open. Treat that screenshot as failed diagnostic output, not visual evidence.
- Final actual-app verification froze all 109 production assets at `d7ebca0` and exercised the real Flask/browser fixture. At both 390 x 930 and 280 x 930, every expanded destination label starts at x = 85 px (0 px spread), computed alignment is `flex-start`, each open group renders one guide, minimum target height is 40 px, and no horizontal overflow or clipping occurs.
- Collapsed-desktop verification measured 37 controls with a maximum icon-center deviation of 0 px and all labels hidden, confirming that the expanded-state override does not alter collapsed navigation.
- Valid verification captures: `runtime/sidebar-alignment-verify/important/sidebar-390.png`, `runtime/sidebar-alignment-verify/important/sidebar-280.png`, and `runtime/sidebar-alignment-verify/important/collapsed.png`.
- Exact checks for the final cascade correction: `node tests/test_sidebar_navigation.cjs` passed 15/15; `node tests/test_compact_navigation.cjs` passed 7/7; `node tests/test_basic_mode.cjs` failed (12 passed, 1 failed) because its reduced-motion assertion expects `prefers-reduced-motion: reduce` in `web/static/sidebar.js`, unrelated to this CSS correction; `git diff --check` passed with no output.
- Unrelated concurrent motion commits `f4dc63f` and `f86388c` were preserved on the feature branch and explicitly excluded from this work unit's integration to `main`.
- Work-unit commit: `a1afa5b` — `fix(sidebar): align nested submenu columns`.
- Correction commit: `2fce6f1` — `fix(sidebar): align expanded destination labels`.
- Cascade correction commit: `317aa0c` — `fix(sidebar): override global button alignment`.
- Scoped important correction commit: `d7ebca0` — `fix(sidebar): enforce expanded destination alignment`.
- Concurrent commits preserved before this correction: `f4dc63f` and `f86388c`.
- Selective `main` integration: `f11865a`, `f7f1721`, `beead12`, `94c227a`, and `dfe7f6d`; the concurrent motion commits were not integrated.
- Parent spot-check on selective `main`: `node tests/test_sidebar_navigation.cjs` passed 14/14, `node tests/test_compact_navigation.cjs` passed 7/7, and `git diff --check` passed. The sidebar suite has one fewer test than the feature branch because the unrelated motion test was intentionally excluded with its commit.
- SSA-02 RED: the strengthened hierarchy regression failed on the pre-correction CSS (13/14 passed), first because nested containers had `margin:0`, then because expanded parent disclosures had no parent-level guide.
- SSA-02 GREEN: nested expanded containers now add an 18 px inline inset with their own guide; open parent details show a shared guide, while their child content retains its own 22 px guide. Expanded destinations use the existing left-aligned `!important` contract; collapsed overrides continue to center icons.
- SSA-02 actual-app check: the isolated Playwright fixture rendered production templates, scripts, and CSS at 390×930 and 280×930. Parent summary labels start at x=57 px; direct child destination labels start at x=86 px, a consistent 29 px hierarchy inset. At both widths, same-level destination spread was 0 px, parent and child guides were each 1 px, targets were at least 40 px, and the sidebar had no horizontal overflow or viewport clipping.
- SSA-02 visual captures and measurements: `runtime/sidebar-left-hierarchy/390-overlays.png`, `runtime/sidebar-left-hierarchy/390-chat.png`, `runtime/sidebar-left-hierarchy/280-overlays.png`, `runtime/sidebar-left-hierarchy/280-chat.png`, and `runtime/sidebar-left-hierarchy/measurements.json`.
- SSA-02 exact checks: `node tests/test_sidebar_navigation.cjs` passed 14/14; `node tests/test_compact_navigation.cjs` passed 7/7; the isolated actual-app Playwright check passed 1/1; `git diff --check` passed.
- RDD: unavailable because `gentle-ai` is not installed in this shell; no native review assessment or review lifecycle was run.
- Engram mirror remains pending because no Engram memory tools are available.

## Applicable checks

- `node tests/test_sidebar_navigation.cjs`
- Relevant compact/basic navigation tests.
- Narrow-viewport visual inspection of Overlays and Chat disclosures.
- `git diff --check`
- Parent spot-check of one reported command.

## Next step

SSA-02 is complete on `codex/sidebar-left-hierarchy`. Parent to spot-check this work unit; integration or merge is outside this task.
