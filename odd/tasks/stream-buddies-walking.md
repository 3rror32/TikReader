# Stream Buddies Walking

## Objective
Correct Stream Buddies walking poses and sprite playback for biped and quadruped characters, using documented gait mechanics and visual evidence. Repair one dragon first, verify its full walking cycle, and only then adapt the remaining nine dragons.

## Problem and rationale
The existing v3 generator reverses biped pelvis timing and uses diagonal rather than typical lateral quadruped footfall order. Limb silhouettes also need visual inspection: numeric joint constraints alone cannot prove readable animation. Preserve the existing distance-driven playback and the authored twelve-frame knight override.

## Authorized scope and constraints
Local implementation and local verification only. Preserve all pre-existing dirty files. Use a single writer and exact scoped commits on codex/stream-buddies-walking. No push, PR, merge, remote execution, or unrelated controls. Generated technical artifacts use English. Do not modify source atlases, authored overrides, base artwork, or chibis-0 authored PNGs.

## Delivery
Strategy: ask-on-risk; user selected feature-branch-chain (small parts on the current feature branch) when the dragon correction forecast exceeded 400 accumulated authored lines. Cache this choice; do not ask again. Branch point: d89f85a. WALK-1 implementation authored change count: 283; dragon prototype forecast: another 320–380 authored lines plus per-character rig configuration. Generated sprites and automated reports are excluded; manually authored rig configuration counts as authored. Use coherent local work-unit commits for prototype and rollout. No push or PR requested or authorized; remote delivery remains a separate decision.

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
  - Work-unit commit: prototype commit identity recorded by parent immediately after commit.
- [ ] WALK-3 — Adapt the verified dragon approach to fantasia-1 through fantasia-9 with per-character anatomy and inspect every dragon.
  - Route: delegated direct, single writer after WALK-2 visual gate.
  - Acceptance: all ten dragon cycles checked at slow/normal speeds and both directions; no non-dragon sprite changes; metadata, cache references and tests agree; no user approval substituted by joint traces or static screenshot alone.
  - Evidence and work-unit commit: pending.

## Research
- https://www.hyperpad.com/documentation/art-studio-tutorial-create-a-walk-animation — biped contact, down, passing, up timing and backwards support-foot travel.
- https://vanat.ahc.umn.edu/gaits/walk.html — canine four-beat walk and alternating support counts.
- https://horses.extension.org/horse-walk/ — lateral footfall order: RH, RF, LH, LF.
- https://www.adobe.com/uk/creativecloud/animation/discover/animation-walk-cycle.html — creature-specific walking poses.

## Recovery and tooling
Engram tools are unavailable; full-document mirror odd/stream-buddies-walking/tasks is pending. Registry entry for work-unit-commits points to a missing file; targeted skill-directory search found no replacement. Continue within authorized scope using supplied workflow instructions. Native review assessment and mode reads fail because gentle-ai is not installed/on PATH. Preserve unavailable status rather than inventing a verdict.

## Progress and next step
WALK-1 mechanics completed, but user confirmed dragon visual motion remained unacceptable. WALK-2 now accepted by independent visual gate after explicit four-limb rigging and chronological actual-playback inspection. Next: WALK-3 individually adapted rigs for fantasia-1 through fantasia-9, preserving the accepted prototype and all non-dragons. Prototype preview: http://127.0.0.1:5000/static/stream-buddies/walk-v3/dragon-prototype.html. Full catalog: http://127.0.0.1:5000/static/stream-buddies/walk-v3/review.html. Engram mirror remains pending because its tools are unavailable.

## Verification environment and limitations
Python 3.14 at C:/Users/Carlos/AppData/Local/Python/pythoncore-3.14-64/python.exe supplies image dependencies; adding .venv/Lib/site-packages after its normal search paths supplies pytest. Bundled Node ran the JavaScript checks; repository .venv Python ran backend checks. No dependencies were installed. Initial browser sandbox navigation was denied; approved local-only execution completed browser QA. Initial random Windows file replacement failures were resolved with atomic output publication and a full successful regeneration. Independent verifier intentionally did not repeat generator mutation or full browser QA; it read the completed browser report and ran focused tests and offline validation. Native review unavailable; no native approval claimed. Sprites remain stylized cutout animation, especially for short limbs and robes; pose screenshots alone do not prove continuous playback smoothness.
