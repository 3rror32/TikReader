# UI copy trim

## Objective
Reduce redundant and self-evident Spanish UI copy across the creator studio while preserving operational guidance, privacy details, and safety warnings.

## Problem and rationale
Several screens repeat what adjacent controls already show, while a few introductions combine multiple instructions. Trimming these lines should make the interface easier to scan without removing useful exceptions or consequences.

## Scope and constraints
- Scope is limited to the reviewed Spanish copy in the allowed source files below.
- Preserve the user's existing unrelated working-tree changes; edit only the targeted copy.
- Keep warnings about real actions, privacy, credentials, deletion, backups, and operational limitations.
- Do not change behavior, styles, translations, or data flow.
- Forecast: approximately 60 authored changed lines, generated files excluded.
- Delivery strategy: ask-on-risk; this small copy-only slice is expected to stay below the delivery budget.

## Tasks
- [x] UI-COPY-1 — Remove or shorten redundant introductions, helper text, and duplicated reassurance in the reviewed screens. Kept the identity selector's effect on automatic greetings, follower-status exception, and real-action simulator warning. Independent structural review found no behavior changes.

## Authorized scope
- `web/templates/index.html`
- `web/static/custom_voice.js`
- `web/static/interactivity.js`
- `web/templates/simulation.html`
- `web/static/simulation.js`
- `web/templates/production.html`
- `web/static/overlay_gallery.js`
- `frontend/entries/control-center.ts`

## Acceptance criteria
- The agreed redundant copy is removed or condensed in the listed screens.
- Useful exception handling and operational warnings remain visible.
- No behavior or unrelated local changes are altered.

## Route and checks
- Route: delegated direct. Evidence trigger: copy review spans eight source files and reading prepares a coordinated edit.
- Applicable check: structural readback of the changed strings and `git diff --check`; no behavior tests apply to this passive copy edit.
- Review status: unavailable because the `gentle-ai` command is not present in this environment; mirror pending because no Engram memory tools are available.

## Progress and next step
- Source edits complete across seven files; `web/templates/production.html` was left unchanged because its guidance preserves useful operational/privacy context.
- `git diff --check` passed. No tests/builds were applicable to this passive copy edit.
- Independent read-only review found no blocking issue. Exact preservation of the existing desktop zoom hunks in `web/templates/index.html` cannot be independently confirmed because no pre-write diff was captured; the file was already dirty before this task.
- Engram mirror remains pending because memory tools are unavailable. Receipt-driven review is unavailable because the `gentle-ai` command is not installed.
- Next step: resynchronize the memory mirror and assess the copy-only work unit when those tools are available.
