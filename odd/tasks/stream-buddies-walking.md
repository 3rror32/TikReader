# Stream Buddies Walking

## Objective
Correct Stream Buddies walking poses and sprite playback for biped and quadruped characters, using documented gait mechanics and visual evidence. Repair one dragon first, verify its full walking cycle, and only then adapt the remaining nine dragons.

## Problem and rationale
The existing v3 generator reverses biped pelvis timing and uses diagonal rather than typical lateral quadruped footfall order. Limb silhouettes also need visual inspection: numeric joint constraints alone cannot prove readable animation. Preserve the existing distance-driven playback and the authored twelve-frame knight override.

## Authorized scope and constraints
Local implementation and local verification only. Preserve all pre-existing dirty files. Use a single writer and exact scoped commits on codex/stream-buddies-walking. No push, PR, merge, remote execution, or unrelated controls. Generated technical artifacts use English. Do not modify source atlases, authored overrides, base artwork, or chibis-0 authored PNGs.

## Delivery
Strategy: ask-on-risk; user selected feature-branch-chain (small parts on the current feature branch) when the dragon correction forecast exceeded 400 accumulated authored lines. Cache this choice; do not ask again. Branch point: d89f85a. Observed implementation authored deltas: WALK-1 283, WALK-2 297, WALK-3 299 (879 total, plus recovery-document updates). Generated sprites and automated reports are excluded; manually authored rig configuration is included. Local slice boundaries: prototype e28f75e; rollout commit recorded below. Unrelated user commit bd5ef97 is preserved. No push or PR requested or authorized; remote delivery remains a separate decision.

## Tasks
- [x] WALK-1 — Correct biped pose timing and quadruped footfalls; regenerate procedural sprites; make QA respect per-character metadata; verify all characters and visually inspect representative cycles.
  - Route: delegated direct. Evidence: generator/test/QA changes span multiple non-trivial files; investigation and visual validation require focused workers.
  - Acceptance: deterministic pelvis and footfall tests demonstrate RED then GREEN; support feet keep consistent ground contact; all 80 metadata entries use valid frames; authored knight remains unchanged; representative two/four-legged sprites visibly articulate legs in both directions at slow and normal speeds. Dragon visual acceptance was subsequently invalidated by user observation; WALK-2 and WALK-3 own that correction.
  - Checks: python -m pytest tests/test_buddies_gait.py -q; python tools/anatomical_buddies.py; python tools/verify_buddies_walk.py; node --test tests/test_stream_buddies.cjs; python -m pytest tests/test_stream_buddies.py -q; node tools/qa_all_buddies.cjs; independent verification and parent spot check.
  - Evidence: observed RED 7 failed / 4 passed, then GREEN 11 passed; Node runtime 4 passed; backend 7 passed; offline verification 80 cycles / 1,908 frames passed with zero reported planted-foot drift. Browser QA: 80 characters, four speed/direction runs with six representatives each, 32 overlay combinations, no page errors. Writer inspected four collection boards and two browser screenshots; independent verifier inspected all eight boards and both screenshots. Parent spot check repeated gait tests: 11 passed. Scoped whitespace check passed. Authored knight, authored overrides, and source artwork unchanged.
  - Work-unit commit: e64610a (fix: correct stream buddies walking gait and sprites).
  - Native assessment: unavailable (gentle-ai executable missing); RDD mode unknown. Do not claim native approval. Independent verification required.
- [x] WALK-2 — Repair fantasia-0 with explicit fore/hind anatomy and inspect its complete walk before changing any other dragon.
  - Route: delegated direct. Trigger: multi-file generator, rig configuration, tests and visual playback validation.
  - Acceptance: four identifiable limb chains with separate shoulder/hip anchors; correct bending and planted support; no duplicated body scraps masquerading as legs; dragon-specific slow/normal playback in both directions; source artwork, authored knight and all other character sprites unchanged during prototype.
  - Verification: meaningful failing regression before correction, focused gait/runtime/backend tests, actual local browser playback and chronological full-cycle visual evidence, independent assessment before rollout.
  - Evidence: dragon regression RED 2 failed; final combined GREEN 14 passed (dragon 3, prior gait 11), Node 4 passed, backend 7 passed, offline 80 cycles / 1,908 frames passed; parent spot check 14 passed. Independent visual gate accepted all 24 chronological poses and sampled frames from actual 7.833-second / 470-frame browser recording at speeds 4 and 18 in both directions; errors empty. Four source cutouts, separate roots and four-point joints, cleared original claws and coherent near/far layers confirmed. Other 79 sprites and unselected metadata unchanged. Continuous video was sampled, not watched through a playback surface; no claim of photorealistic anatomy.
  - Authored delta: 297 lines including manual rig configuration and prototype HTML.
  - Work-unit commit: e28f75e (fix: rig four distinct legs for the fire dragon). Native assessment remains unavailable; independent gate accepted, no native approval claimed.
- [x] WALK-3 — Adapt the verified dragon approach to fantasia-1 through fantasia-9 with per-character anatomy and inspect every dragon.
  - Route: delegated direct, single writer after WALK-2 visual gate.
  - Acceptance: all ten dragon cycles checked at slow/normal speeds and both directions; no non-dragon sprite changes; metadata, cache references and tests agree; no user approval substituted by joint traces or static screenshot alone.
  - Authored implementation delta: 299 lines including manual rig data and review HTML. User delivery choice already cached; do not ask again.
  - Evidence: initial RED 9 failed / 25 passed; targeted fantasia-4 background regression RED 1 failed / 35 passed. Final current-worktree tests: 37 gait/anatomy/pixel passed, 4 Node passed, 7 backend passed; offline 80 cycles / 1,908 frames passed. Parent spot check: 37 passed. Browser proof covers 40 complete dragon/speed/direction cases, all 24 poses each, no page/HTTP errors; all-80 QA covers 32 overlays and 4 detailed runs with no errors. Movie is 1,196 frames at 60 FPS, 19.933 seconds, 1280x1560, all ten visible. Independent reviewer inspected all ten chronological sheets and actual movie samples; targeted validator accepted the corrected blue/yellow dragon after inspecting frames 0/6/12/18 and movie samples in both directions/speeds. Removed 53 opaque background pixels with zero blue/gold pixels removed. No review-only speed cap; production stride/cap behavior retained.
  - Preservation: accepted fantasia-0 and idle byte-identical to e28f75e; all 70 non-dragons, source artwork, authored knight and overrides unchanged. Only fantasia-1..9 entries changed in metadata/traces. Dragon idle-4/5/6 cleanups remain within scope. Unrelated user files and bd5ef97 retained.
  - Final work-unit commit: 095e812 (fix: fit individual walking rigs for all dragons). Native review unavailable; independent gate accepted, no native approval claimed.

## Research
- https://www.hyperpad.com/documentation/art-studio-tutorial-create-a-walk-animation — biped contact, down, passing, up timing and backwards support-foot travel.
- https://vanat.ahc.umn.edu/gaits/walk.html — canine four-beat walk and alternating support counts.
- https://horses.extension.org/horse-walk/ — lateral footfall order: RH, RF, LH, LF.
- https://www.adobe.com/uk/creativecloud/animation/discover/animation-walk-cycle.html — creature-specific walking poses.

## Recovery and tooling
Engram tools are unavailable; full-document mirror odd/stream-buddies-walking/tasks is pending. Registry entry for work-unit-commits points to a missing file; targeted skill-directory search found no replacement. Continue within authorized scope using supplied workflow instructions. Native review assessment and mode reads fail because gentle-ai is not installed/on PATH. Preserve unavailable status rather than inventing a verdict.

## Progress and next step
All implementation complete. Prototype accepted first, then nine individually fitted dragon rigs and one bounded background-artifact correction passed independent validation. Final preview: http://127.0.0.1:5000/static/stream-buddies/walk-v3/dragon-walk-review.html?v=dragon-walk-3. Final evidence: assets/sprites/walk-v3/dragon-walk-playback.webm, dragon-walk-fantasia-0-poses.png through dragon-walk-fantasia-9-poses.png, and dragon-walk-validation.json. Local static-only preview restored after interruption in exec session 49130, bound to 127.0.0.1:5000 with no live integrations; review HTML and corrected sprite returned HTTP 200. Engram mirror remains pending because its tools are unavailable. No further source changes or remote delivery pending.

## Verification environment and limitations
Python 3.14 at C:/Users/Carlos/AppData/Local/Python/pythoncore-3.14-64/python.exe supplies image dependencies; adding .venv/Lib/site-packages after its normal search paths supplies pytest. Bundled Node ran the JavaScript checks; repository .venv Python ran backend checks. No dependencies were installed. Initial browser sandbox navigation was denied; approved local-only execution completed browser QA. Initial random Windows file replacement failures were resolved with atomic output publication and a full successful regeneration. Independent verifier intentionally did not repeat generator mutation or full browser QA; it read the completed browser report and ran focused tests and offline validation. Native review unavailable; no native approval claimed. Sprites remain stylized cutout animation, especially for short limbs and robes; pose screenshots alone do not prove continuous playback smoothness.
