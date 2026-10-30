# Bedrock Connection Command Row

## Objective
Present the generated Bedrock connection command as a compact, single-line temporary output with a copy-only icon action.

## Problem and rationale
The current command output occupies two textarea rows and expands the preparation panel. A one-line control with visual truncation keeps the temporary command easy to scan while preserving the full value for copying.

## Authorized scope
- `web/static/minecraft.js`
- `web/static/minecraft.css`
- `tests/test_minecraft_controls.cjs`
- `odd/tasks/minecraft-bedrock-command-row.md`

Preserve the existing Bedrock UI work, preparation and cleanup flow, clipboard fallback, notices, connection state, and unrelated Minecraft navigation behavior.

## Acceptance criteria
- [x] The command uses a compact single-line control and long values are visually truncated with an ellipsis while the full value remains copyable.
- [x] The copy action is icon-only, keyboard accessible, and has the Spanish accessible name `Copiar comando de conexión` plus a useful Spanish tooltip.
- [x] The command and copy row remain hidden until preparation succeeds and are hidden again during cleanup.
- [x] Focus styling and mobile behavior remain usable without ornamental redesign.

## Tasks
- [x] `MC-CMD-ROW-1` Add focused regression assertions, observe a meaningful RED, implement the compact row, and verify the result.

## Route and design rationale
- Route: delegated direct.
- Trigger evidence: reading prepares a three-file behavior change, so one bounded writer is required; the parent supplied the exact allowed edit surfaces.
- Design plan: inherit the existing panel color and type tokens; keep the layout to one narrow command strip; use the copy icon as the only signature element.
- Critique: this constrained presentation should avoid adding a new palette, typography system, or decoration. The distinctive detail is the compact icon action, which directly serves the request.

## Verification
- `node --test tests/test_minecraft_controls.cjs` after focused assertions and before implementation (meaningful RED).
- `node --test tests/test_minecraft_controls.cjs` after implementation (GREEN).
- `node --check web/static/minecraft.js`.
- `git diff --check -- web/static/minecraft.js web/static/minecraft.css tests/test_minecraft_controls.cjs odd/tasks/minecraft-bedrock-command-row.md`.
- Structural readback of single-line control, ellipsis styling, icon-only accessible action, and hidden-before-prepare/show-after-success/cleanup behavior.

## Progress and delivery
- Forecast: approximately 80 authored changed lines across the authorized source, test, and task-document paths; generated files excluded.
- Delivery strategy: `single-pr`.
- RDD state: unknown (`gentle-ai` unavailable per parent evidence); independent verification is expected.
- Engram mirror: pending/unavailable in this worker context.
- Progress: focused assertions first produced RED (42 passed, 1 failed because the copy button still displayed `Copiar comando`); implementation then produced GREEN (43 passed, 0 failed). Preparation, copy success/fallback, hidden state, reprepare, and disconnect assertions pass.
- Verification: `node --test tests/test_minecraft_controls.cjs` passed (43/43); `node --check web/static/minecraft.js` passed; `git diff --check -- web/static/minecraft.js web/static/minecraft.css tests/test_minecraft_controls.cjs odd/tasks/minecraft-bedrock-command-row.md` passed. Structural readback confirmed the readonly text input, ellipsis and no-wrap CSS, icon-only button with Spanish accessible name/title, hidden row before preparation, reveal only after successful API return, and clearing/hiding on save/disconnect.
- Work-unit commit: `190b770` (`fix(minecraft): compact Bedrock connection command`). The commit contains only the three isolated source/test blobs; live concurrent changes remain unstaged in the shared checkout.
- Next step: open the Minecraft Bedrock panel, press **Preparar conexión**, and confirm the compact command strip appears only after preparation succeeds.

## Isolated artifact continuation
- Built from `git archive HEAD` into `.tmp/minecraft-bedrock-command-row/tree/`; the only files there are `web/static/minecraft.js`, `web/static/minecraft.css`, and `tests/test_minecraft_controls.cjs`.
- The artifacts preserve HEAD's authorization checkbox and navigation behavior. Their diff adds only the documented Bedrock setup instructions and starred requirements, temporary readonly command UI, compact icon copy action, lifecycle cleanup, and focused tests/fake-DOM support. No category C action picker, gift selector, simulator, status-strip, or automatic-connection edits are present.
- Verification: `node --test .tmp/minecraft-bedrock-command-row/tree/tests/test_minecraft_controls.cjs` passed (29/29); `node --check .tmp/minecraft-bedrock-command-row/tree/web/static/minecraft.js` passed. Three read-only diffs against the previously frozen pure snapshots showed only the scoped A+B changes. `git diff --no-index --check` reported no whitespace diagnostics; exit status 1 reflected expected differences, with only Git's LF/CRLF warnings for the baseline snapshots.
- HEAD and frozen snapshot blob IDs matched: JS `0aa01bf67b418ef8500e86acda3f88cd720f2652`, CSS `fc7f36b35aa64a38cb45c4849332d52514df4c55`, CJS `bcc793f53182b33f7d65a8760a4dd42bb330a1ac`.
- SHA256: JS `F6825A4647129257E7C6AE94C881F688A88F4A3AC20813395E509D30C073F0FE`; CSS `F62B6914B702F33EC7932137E962D2C899788D2C1FB841F4EBE64A8B431048BF`; CJS `EEC1C71ED13A414275F6E620820B38A1E103272236FC0893FCD368F2748D3492`.
- Immutability check: live JS/CSS/CJS blob IDs remain `96d4ad3d6ee436e60dd373dcb7953468bd9c98ca`, `776e131ce9dd6f231401f1755c538ea300176247`, and `5dd5dcdb6c4981d7f9c355dc80987400f5eb0722`, matching the pre-isolation values; `git diff --cached --name-only` is empty. No commit was created.
- Independent verification found no concrete findings, recomputed all three matching SHA256 values, passed the isolated suite (29/29) and JavaScript syntax check, and confirmed every HEAD-to-artifact hunk is limited to the documented Bedrock setup/copy work plus the compact row with no category C leakage.
- Parent spot check reran the isolated suite successfully (29/29) before staging.
- Commit isolation succeeded: Git recorded 75 additions and 20 deletions across exactly `web/static/minecraft.js`, `web/static/minecraft.css`, and `tests/test_minecraft_controls.cjs` in `190b770`; the ignored task document is recorded separately so it can cite the stable work-unit identity.
- Native assessment remains unavailable because `gentle-ai` is not installed in this environment; independent verification and the parent spot check are the verification of record, without a native approval claim.
