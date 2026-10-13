# Operator UX Trust and Polish

## Objective

Improve TikReader's operator interface so navigation is recoverable, operational states are truthful, error recovery is clear, keyboard and screen-reader use is reliable, and the existing TikReader visual personality is polished without performing the deferred frontend architecture consolidation.

## Problem

The current interface has a confirmed navigation recovery gap, inconsistent wording around the control center, ambiguous pending-versus-zero telemetry, and accessibility uncertainty around classified errors and focus transitions. Motion and visual emphasis also need rendered validation so the live operator workflow stays calm and legible under load.

## Why

An operator console must communicate what is happening, what changed, and how to recover before visual decoration can be trusted. The user explicitly authorized navigation/state, vocabulary/recovery, accessibility, and aesthetic/motion improvements while deferring architectural consolidation.

## Authorized scope

- Recoverable hash navigation, browser history, aliases, and destination focus.
- Truthful pending, zero, connecting, reconnecting, live, offline, and error states.
- Consistent "Control center" vocabulary and actionable error recovery.
- Keyboard and screen-reader behavior for navigation and error states.
- Focused aesthetic, hierarchy, motion, and responsive polish using existing authored assets.
- Focused tests and non-generated QA support required for these behaviors.
- Reproducible browser, visual-regression, zoom, theme, and accessibility checks.
- Measured startup behavior with visible loading and failure recovery.
- Explicit preview, draft, saved, applied, and on-stream consequences.
- Credential visibility and irreversible-action safeguards.
- Static view composition and stable dynamic mounting.
- Central semantic tokens, component ownership, and removal of proven override duplication.

## Explicitly out of scope

- Removing supported themes or changing their user-visible identity without a separate product decision.
- Replacing the frontend framework or rewriting the product wholesale.
- Editing generated files under `web/static/build/**`.
- Editing or staging the existing installer work in `tools/build_release.py` or `tests/test_build_release.py`.
- Push, pull request creation, or merge.

## Constraints

- Preserve the current 22-theme system and basic/advanced modes.
- Preserve existing runtime enhancements that already update empty-state copy and route simple errors to alerts/notifications.
- Avoid duplicate live-region announcements and frequent screen-reader chatter.
- Keep authored source, tests, and user-visible copy together in each work-unit commit.
- Use Conventional Commit messages without AI attribution.
- Do not run commands that rebuild or rewrite generated frontend bundles.
- Visual baselines must be explicit, reproducible, and fail closed when missing or changed.
- Browser tests must block external traffic and use synthetic API/socket data.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: approximately 500–750 authored changed lines across three work units.
- Follow-up forecast: approximately 1,800–2,900 authored lines across six additional work units, excluding accepted baseline images.
- Chain strategy: `stacked-to-main` (selected by the user).
- Current branch: `codex/operator-ux-trust-polish`.
- Unrelated pre-existing changes must remain untouched.

## Tasks

### UX-1 — Recoverable navigation and keyboard orientation

- Route: delegated direct.
- Trigger: implementation and tests span multiple non-trivial files; preparation and writing stay with one bounded writer.
- [x] Add a safe fallback for unknown hashes without breaking aliases or asynchronously registered views.
- [x] Synchronize deliberate navigation with browser history and support Back/Forward and refresh.
- [x] Move focus to a meaningful destination heading after deliberate navigation without stealing focus on initial load.
- [x] Preserve correct mobile-menu focus behavior.
- [x] Add focused deterministic coverage.

Acceptance criteria:

- Unknown routes recover to a known screen and canonical URL.
- Valid static, alias, and late-registered routes remain addressable.
- Back and Forward restore the expected view.
- Keyboard-triggered navigation leaves focus at the destination content.

Verification:

- `node --test --test-timeout=30000 tests/test_operator_ux.cjs tests/test_compact_navigation.cjs tests/test_dynamic_views.cjs tests/test_sidebar_navigation.cjs tests/test_basic_mode.cjs`
- `git diff --check`

Evidence:

- Commit: `d24e66d7f9935d658c05e5443cf7e8e88a3e591c` (`fix(navigation): restore routes and orient destination focus`).
- RED: 8 failed, 27 passed before production edits.
- GREEN: 37 passed after implementation and refactor.
- Parent spot check: the required five-file Node test command passed 37/37.
- `git diff --check`: passed.
- Native assessment: medium risk, `under_budget`, 299 authored changed lines from the initial boundary.
- Remaining check: real-browser focus and mobile-menu validation is included in UX-3 rendered QA.

### UX-2 — Truthful state, vocabulary, and accessible recovery

- Route: delegated direct.
- Trigger: integrated state behavior, translations, markup, and tests span multiple non-trivial files.
- [x] Distinguish unavailable viewer data from a confirmed zero visually and accessibly.
- [x] Keep connecting, reconnecting, live, offline, cancelled, and failed wording truthful.
- [x] Use "Control center" consistently in navigation and contextual help.
- [x] Give classified errors one accessible announcement and a useful recovery action while preserving user input.
- [x] Preserve existing empty-state and simple-error enhancement paths.
- [x] Add focused deterministic coverage, including translation coverage where applicable.

Acceptance criteria:

- Pending telemetry never claims a measured zero.
- State labels reflect confirmed backend/UI state rather than requested intent.
- Error recovery identifies the next safe action and does not erase the username.
- Each error is announced once through an appropriate accessible path.

Verification:

- `node --test --test-timeout=30000 tests/test_operator_ux.cjs tests/test_frontend.cjs tests/test_visual_refresh.cjs tests/test_i18n.cjs tests/test_connect_button.cjs tests/test_compact_navigation.cjs`
- `git diff --check`

Evidence:

- Commit: `fd668e63309aa21b7b4ea2810ea8c73677a5a008` (`fix(operator): report truthful state and accessible recovery`).
- RED: 8 failed, 73 passed before production edits.
- GREEN: 85 passed after implementation and expanded regression coverage.
- Parent spot check: the required six-file Node test command passed 85/85.
- `git diff --check`: passed.
- Native assessment: medium risk, 428 authored changed lines, `slice_budget_reached`.
- Receipt-driven review: disabled/unmanaged for this clone, so no native review lifecycle was started.
- Remaining check: real-browser and screen-reader validation is included in UX-3 rendered QA.

### UX-3 — Quiet hierarchy, motion safety, and TikReader personality

- Route: delegated direct.
- Trigger: styling, motion behavior, rendered QA, and tests span multiple non-trivial files.
- [x] Establish a compact design direction grounded in the live operator-console job.
- [x] Clarify primary versus secondary actions and pending/error hierarchy.
- [x] Preserve visible focus and improve narrow/short-window wrapping.
- [x] Reduce repetitive motion during busy chat while preserving intentional TikReader personality.
- [x] Preserve reduced-motion behavior and validate representative themes.
- [x] Add deterministic behavior tests and rendered QA evidence where the environment permits.

Acceptance criteria:

- Live operation keeps one visually dominant next action per view.
- Pending and error states remain legible across representative themes.
- Keyboard focus stays visible at mobile, desktop, and 200% zoom.
- Repeated comment and metric updates do not create distracting motion.

Verification:

- `node --test --test-timeout=30000 tests/test_operator_ux.cjs tests/test_visual_refresh.cjs tests/test_theme_accessibility.cjs tests/test_motion_system.cjs tests/test_connect_button.cjs`
- Representative rendered checks at 390x844, 900x700, and 1440x900 when a browser runtime is available.
- `git diff --check`

Evidence:

- Commit: `452426305d3bb64bf8b6ba3c720d01960d235f63` (`fix(operator): keep chat steady and recovery controls clear`).
- RED: 9 failed, 44 passed before production edits for deterministic motion, focus, and layout contracts.
- GREEN: 56 passed after implementation, regression expansion, and refactor.
- Parent spot check: the required five-file Node test command passed 56/56.
- `git diff --check`: passed.
- Native assessment: medium risk, 577 authored changed lines, `slice_budget_reached`.
- Receipt-driven review: disabled/unmanaged for this clone, so no native review lifecycle was started.
- Live QA: desktop and 640x720 layouts showed clear hierarchy, wrapping, visible keyboard focus, truthful unavailable viewer copy, and Back/Forward focus restoration.
- Live QA unavailable: actual 200% browser zoom, alternate auto-saving themes, and a real classified connection error were not triggered; deterministic coverage passed for their relevant contracts.

### UX-4 — Reproducible browser, visual, zoom, and accessibility regression foundation

- Route: delegated direct.
- Trigger: dependency configuration, browser fixtures, baselines, CI, documentation, and tests span multiple non-trivial files.
- [x] Add a pinned project browser-test dependency and deterministic Chromium runtime.
- [x] Exercise production templates and script order with synthetic local data and blocked external traffic.
- [x] Verify actual browser zoom, representative themes, narrow/short windows, classified errors, focus, and credential-safe captures.
- [x] Keep reports and diffs outside source; require explicit baseline acceptance.
- [x] Cover all themes structurally and selected themes with stable pixel baselines.

Acceptance criteria:

- Normal test runs never create or accept baselines silently.
- Genuine 200% browser zoom is measured through browser-level evidence.
- Captures contain no secrets or live credentials.
- Browser checks run locally and in the quality workflow without external service dependencies.

Verification:

- `npm.cmd run test:operator`
- Missing or changed baselines fail; `npm.cmd run test:operator:update` is explicit-only.

Evidence:

- RED first failed because `test:operator` did not exist; the completed harness then produced seven intentional missing-baseline failures before explicit acceptance.
- Exact `@playwright/test` 1.63.0 dependency and isolated ignored Chromium cache; the global cache exposed a Windows side-by-side defect, while the same revision passed from the isolated cache.
- `npm.cmd run test:operator:update` accepted the initial/corrected baselines only during deliberate updates; every subsequent normal suite passed 16/16.
- Production templates and script order run with synthetic backend/socket data, strict external-network rejection, isolated preferences, 22-theme structural coverage, seven representative pixel baselines, keyboard/focus/status assertions, reduced-motion persistence, credential-safe captures, and Chrome API-confirmed 200% zoom.
- Independent review found and corrected a clipped locator screenshot (`2bfc282`) and a fixture mismatch for production icon routing (`3c23ffb`). Final independent verification passed 16/16 in 1.5 minutes and visually inspected all seven complete 2560×1800 baselines.
- Commits: `90bf6f6f4d6f10aa6acf24527b9f6af6a23d91b3`, `2bfc28205036ed40d38b242d748e8e388c94c39a`, `3c23ffb5ee23622eb9f7c04c6d19dd75896e738e`.
- Remote CI and a real screen-reader session were not run; the quality workflow is configured and automated semantics/keyboard coverage must not be presented as assistive-technology proof.

### UX-5 — Measured startup, visible structure, and failure recovery

- Route: delegated direct.
- Trigger: template, boot controller, styles, translations, browser instrumentation, and tests span multiple files.
- [x] Measure cold/warm requests, transferred bytes, and key boot milestones.
- [x] Replace whole-body hiding with useful inert structure during initialization.
- [x] Add an explicit failed/stalled boot message and retry path.
- [x] Keep shell-ready, backend-ready, and live-session states distinct.
- [x] Prevent partial-boot controls from causing production actions.

Acceptance criteria:

- Useful branded structure is visible before all scripts finish.
- Failed critical initialization leaves an actionable recovery surface.
- Successful boot activates controls once without claiming TikTok is live.

Verification:

- `node --test tests/test_operator_startup.cjs`
- `npm.cmd run test:operator -- startup.spec.cjs`

Evidence:

- RED unit/browser contracts first failed because boot behavior and startup-spec discovery were absent.
- Successful browser measurements: cold 109 requests / 2,561,819 bytes, FCP 972 ms, useful structure 247 ms; warm reload 111 requests / 2,563,841 bytes, FCP 220 ms, useful structure 168 ms. These are deterministic fixture observations, not production budgets or cache claims.
- Whole-body hiding was replaced with immediately visible branded structure, native inert/busy semantics, and distinct document/shell/backend/TikTok-live states.
- A 503 for `shell.js` recovers through one reload with one connect listener and one start action.
- Independent review found that a 503 for `operator_boot.js` could strand the app. Commit `3049424` added an earlier independent fallback, failure sentinel, accessible retry, and observer-loop guard; actual 503 recovery passed after 11.25 seconds.
- Final focused checks: 4/4 Node tests and 3/3 startup browser tests passed; the full operator suite passed 19/19 with all seven visual baselines unchanged.
- Commits: `8144b3f0d084507e745c1f11936c3730e33f7249`, `30494245190616a7eb7d96a661d7ae2bf4359db9`.
- CI/live-service behavior and real screen-reader use remain environmental checks, not claims made by this task.

### UX-6 — Explicit operational consequences and safe mutation states

- Route: delegated direct.
- Trigger: overlay, creator, animation, workspace, reliability, translations, backend-aware tests, and browser tests span multiple files.
- [x] Distinguish preview, draft, saved, applied, published, and on-stream states according to each feature's real semantics.
- [x] Prevent duplicate destructive submissions and preserve edits after failure.
- [x] Keep profile loads paused until explicitly enabled.
- [x] Verify cancellation and failed acknowledgements do not claim success.

Acceptance criteria:

- Preview never implies publication.
- Failed writes preserve input and show the next safe action.
- Cancel paths perform no mutation and destructive actions remain guarded.

Verification:

- Focused operator-safety, overlay, workspace, creator, reliability, and browser safety tests.

Evidence:

- RED safety checks first failed because consequences and profile-load guards were absent.
- Creator saves remain drafts, overlay appearance saves remain applied streaming configuration, alert tests remain synthetic tests, and canceling activation sends zero arm mutations.
- Pending guards prevent duplicate consequential submissions; confirmed success is reported only after request success and failed input remains editable.
- Independent review found profile-load pause was only visual before reload. Commit `294b3b5` now persists voice and local-alert false through real change events while retaining the saved profile's enabled intent; browser reload proof passed.
- Commit `6b0466d` routes new dynamic outcomes through `I18n.t(source, values)`; 29 added catalog rows have English/French equivalents and matching placeholder sets.
- Final checks: 23 focused Node tests, 18 creator Python tests, 11 reliability Python tests, 3 browser safety tests, and a 22/22 full browser suite passed. Python required `PYTHONPATH=app` and repository-local `TEMP`/`TMP`.
- Commits: `60253147ef1835e7d748953982d616009a930741`, `294b3b5e8434bca7f15806e9af05c4771145061b`, `6b0466dbe06293814bbd7c9f2dbe56dcf6886a2b`.

### UX-7 — Credential visibility and irreversible-action proof

- Route: delegated direct.
- Trigger: secret-bearing markup, styles, translations, safety tests, and browser capture assertions span multiple files.
- [x] Mask the Kick webhook secret path until deliberate reveal or copy.
- [x] Add clear local-secret handling guidance.
- [x] Prove secrets are absent from screenshots, exports, logs, and browser-persisted preferences.
- [x] Preserve existing local-only routes, DPAPI storage, disabled-rule loading, and confirmations.

Acceptance criteria:

- Secret-bearing values are hidden by default and never enter visual baselines.
- Existing protection contracts remain intact.

Verification:

- Release-support, operator-safety, and browser safety tests.

Evidence:

- RED browser coverage first found no accessibility concealment and then reproduced forced-colors disclosure caused by transparent secret text.
- The concealed UI now renders a constant 12-bullet mask and keeps the real local value in inert template content. Copy reads the real value without revealing it; reveal/hide is explicit and reload resets concealment.
- Unmasked normal and forced-colors captures were byte-identical for distinct 21-character and 500-character synthetic secrets; outer/client/scroll geometry remained constant.
- Synthetic secrets were absent from body text, accessibility tree, browser find/select-all, local/session storage, URL state, request/error/console logs, diagnostic exports, and visual baselines.
- Release-support tests preserved local-only credential routes, injected protected storage, private diagnostic behavior, disabled-rule/profile safety, and non-mutating confirmation cancellation; no backend change was required.
- Final checks: 8/8 release-support Python tests, 4/4 Node safety tests, 5/5 focused browser safety tests, and 24/24 full operator tests passed. Real DPAPI and real screen-reader operation were not directly exercised.
- Commits: `a01332d`, `8e2f516`.

### UX-8 — Static composition and stable dynamic mounting

- Route: delegated direct.
- Trigger: template structure, navigation shell, dynamic feature producers, and compatibility tests span many non-trivial files.
- [ ] Declare stable content and configuration mounts in markup.
- [ ] Remove heading-text section ownership and unnecessary static-pane reparenting.
- [ ] Preserve legacy selectors while migrating dynamic producers to stable mounts.
- [ ] Preserve asynchronous view registration, aliases, creator iframe lifetime, and existing IDs.

Acceptance criteria:

- Each route has exactly one stable mount and no duplicate IDs.
- Changing visible headings cannot change section ownership.
- Late registration and initialization order do not break navigation.

Verification:

- Focused operator, dynamic-view, settings, frontend, workspace, and browser navigation tests.

Evidence: pending.

### UX-9 — Semantic tokens, component ownership, and proven override removal

- Route: delegated direct.
- Trigger: shared tokens, foundations, typography, controls, themes, templates, tests, documentation, and visual parity span multiple non-trivial files.
- [ ] Centralize semantic color, geometry, type, focus, and control-state aliases.
- [ ] Document that themes own palette/type/personality while feature files own feature layout.
- [ ] Define permitted theme customizations and stylesheet ordering.
- [ ] Remove duplicated declarations only after computed-style and visual parity proof.
- [ ] Preserve all supported themes and extreme geometry safeguards.

Acceptance criteria:

- Every theme supplies required semantic values.
- Shared controls retain readable states, focus, and bounds across representative themes.
- Stable contracts no longer depend on accidental stylesheet ordering.

Verification:

- Focused form, theme, visual-refresh, connection-button, and full browser theme-matrix tests.

Evidence: pending.

### UX-10 — Collapsed search popover legibility

- Route: delegated direct.
- Trigger: implementation and deterministic regression coverage span two non-trivial files; preparation and writing stay with one bounded writer.
- [x] Keep collapsed navigation search icon-only until activated.
- [x] Present the active search field and results in a viewport-clamped popover outside the narrow rail.
- [x] Prevent result labels and categories from wrapping vertically; truncate safely when space is exhausted.
- [x] Add focused deterministic coverage for the collapsed and popover layout contracts.

Acceptance criteria:

- Collapsed navigation shows one recognizable search action without an inline text field.
- Activating search exposes a usable input and results surface without expanding the rail.
- Search result text remains horizontal at supported narrow viewport widths.

Verification:

- `node --test tests/test_sidebar_navigation.cjs tests/test_sidebar_search_icon.cjs`
- `git diff --check`

Evidence:

- RED: the requested Node command reported 7 passing and 2 failing tests; the failures identified missing viewport-clamp and horizontal-truncation rules.
- GREEN: `node --test tests/test_sidebar_navigation.cjs tests/test_sidebar_search_icon.cjs` passed 9/9 after the CSS change.
- `git diff --check`: passed; Git noted an existing LF-to-CRLF warning in the unrelated `tests/browser/operator.spec.cjs` change.
- Work-unit commit: `af297fd` (`fix(sidebar): keep collapsed search legible`).
- Independent verification found the base input rule outranked the original collapsed hide rule. The added cascade regression failed before correction (9 passed, 1 failed).
- The inactive collapsed input now has a more specific rule, while the later active-popover rule restores it. The focused Node command passed 10/10 after correction.
- Correction `git diff --check`: passed; the LF-to-CRLF warning remains limited to the unrelated browser test change.
- Correction commit: `ba7da0e` (`fix(sidebar): hide inactive collapsed search input`).

### UX-11 — Single compact tooltip for collapsed advanced navigation

- Route: delegated direct.
- Trigger: tooltip behavior and deterministic regression coverage span two non-trivial files; preparation and writing stay with one bounded writer.
- [x] Remove native browser tooltips from advanced destination buttons and generated advanced category summaries.
- [x] Preserve accessible names and the existing custom hover/focus tooltip.
- [x] Keep expanded navigation free of redundant tooltips when labels are already visible.
- [x] Add focused deterministic coverage for the tooltip contract.

Acceptance criteria:

- A collapsed advanced navigation control displays exactly one compact custom tooltip.
- Destination buttons and advanced category summaries retain an accessible name.
- Expanded navigation relies on its visible labels without showing the custom collapsed tooltip.

Verification:

- `node --test tests/test_sidebar_navigation.cjs`
- `git diff --check`

Evidence:

- RED: `node --test tests/test_sidebar_navigation.cjs` reported 10 passed and 2 failed for native titles on destination buttons and generated advanced summaries; the delegated custom-tooltip coverage passed.
- First implementation rerun reported 11 passed and 1 failed because the summary assertion expected `label` instead of the source's `label.textContent`; the assertion was corrected to match the accessible-name value.
- GREEN: `node --test tests/test_sidebar_navigation.cjs` passed 12/12 after removing the two native title assignments and adding the generated summary's `aria-label`.
- `git diff --check`: passed; Git emitted a line-ending normalization warning for the task document.
- The delegated custom tooltip selectors and pointer/focus handlers remain covered by the passing regression test.
- Work-unit commit identity is recorded in the final implementation handoff.

## Closing checks

- Run all non-emitting JavaScript tests.
- Run syntax checks for authored JavaScript.
- Run `npm.cmd run check:overlays` only if confirmed non-emitting in the active checkout.
- Run `git diff --check`.
- Record every failed, unavailable, skipped, or pending check honestly.

## Progress

- Exploration complete.
- Three implementation work units defined.
- UX-1 complete and committed.
- UX-2 complete and committed.
- UX-3 complete and committed.
- UX-4 through UX-7 complete locally and committed; UX-8 and UX-9 authorized and pending.
- UX-10 implementation and focused verification are complete.
- UX-11 implementation and focused verification are complete; commit identity is recorded in the final implementation handoff.
- Full closing Node suite: 305/305 passed after correcting a stale source-order assertion.
- JavaScript syntax: 88 authored files passed.
- Overlay type check: `tsc --noEmit` passed.
- Running authored changed lines: 3,129, excluding baseline PNGs.
- Planned stacked-PR slice 1: commit `d24e66d7f9935d658c05e5443cf7e8e88a3e591c`.
- Planned stacked-PR slice 2: commit `fd668e63309aa21b7b4ea2810ea8c73677a5a008`.
- Planned stacked-PR slice 3: commits `452426305d3bb64bf8b6ba3c720d01960d235f63` and `96845ac53e17f15c4bb9db5f2d3cf83867be1f13`.
- Planned stacked-PR slice 4: commits `1a55ba8c2249f1e3e2aff07db361f6ca7276e011`, `90bf6f6f4d6f10aa6acf24527b9f6af6a23d91b3`, `2bfc28205036ed40d38b242d748e8e388c94c39a`, and `3c23ffb5ee23622eb9f7c04c6d19dd75896e738e`.
- Planned stacked-PR slice 5: commits `8144b3f0d084507e745c1f11936c3730e33f7249` and `30494245190616a7eb7d96a661d7ae2bf4359db9`.
- Planned stacked-PR slice 6: commits `60253147ef1835e7d748953982d616009a930741`, `294b3b5e8434bca7f15806e9af05c4771145061b`, and `6b0466dbe06293814bbd7c9f2dbe56dcf6886a2b`.
- Planned stacked-PR slice 7: commits `a01332d` and `8e2f516`.
- Corrective commit: `96845ac53e17f15c4bb9db5f2d3cf83867be1f13` (`test(navigation): verify overlay route behavior`) replaced a brittle source-order assertion with route-output verification.
- Delivery and chain strategies selected.
- Original UX-1 through UX-3 implementation and proportional verification are complete; expanded hardening work is active.

## Next step

Resume UX-8 and UX-9.
