# Stream Buddy Sprite Refresh

## Objective
Improve all 80 stream buddy characters while preserving their identities, eight collection styles, pixel-art rendering, alpha transparency, anatomy rigs, and compatibility with the existing animation pipeline.

## Problem and rationale
The current sprite set is used by the live stream overlay and consists of 80 character atlases plus generated 24-pose animation strips. A generative edit can improve artwork but may change atlas geometry, so each result must be reconstructed into the project's exact cells before it can replace a source sprite.

## Scope and constraints
- Refresh all 80 source character atlases in `assets/sprites/walk/`.
- Rebuild corresponding active assets under `assets/sprites/walk-v3/` through the existing project generator.
- Preserve character identity, accessories, collection-specific art direction, 4-pose source sequence, 128x128 source cells, RGBA alpha, and current rig metadata.
- Do not change overlay behavior, anatomy, frame counts, or the authored 12-frame chibi knight override. The generator may reserialize generated metadata outputs to keep them synchronized.
- Keep each source atlas at 512x128 and each generated asset at its existing documented dimensions.
- Do not overwrite unrelated user work.

## Authorized scope
- `assets/sprites/walk/*.png`
- `assets/sprites/walk-v3/*.png`
- `assets/sprites/walk-v3/manifest.json`
- `assets/sprites/walk-v3/joint-tracks.json`
- `assets/sprites/walk-v3/review-data.js`
- `web/static/buddies_walk_metadata.js`
- `tools/reconstruct_buddy_atlas.py`
- `odd/tasks/stream-buddy-sprite-refresh.md`

## Acceptance criteria
- All 80 source atlases remain separate, transparent RGBA images at 512x128 with four 128x128 cells.
- Each refreshed character retains its recognizable identity, accessories, facing, and baseline.
- The generated animation assets match their prior frame counts and dimensions; the 12-frame knight override remains intact.
- Existing rig metadata remains applicable and no unrelated source or behavior changes are introduced.
- Visually inspect a preview covering all eight collections and a representative set of generated cycles.

## Tasks
- [x] T1 — Refresh and reconstruct all 80 source atlases, regenerate the active animation assets, and visually review the full collection.
- [x] T2 — Apply one scoped correction for independent review findings: restore original walk stride metadata, remove low-alpha background haze in `goblins-7`, assess detached leg fragments in `dinosaurios-4`, and align the `chibis-0` active strip scale with its idle sprite. The dinosaur asset was restored to its pre-refresh version because a safe pixel-level leg repair could not be distinguished from the authored foot without changing the rig.
- [ ] T3 — Regenerate the stale chibi review board and review metadata so they reflect the corrected 12-frame knight strip and restored stride values.

## Route and estimate
- Route: delegated direct. The change spans many image assets and requires image-generation, atlas reconstruction, and animation regeneration.
- Trigger evidence: 80 source characters plus generated animation assets across multiple files; the existing pipeline and rig metadata must be read together with implementation.
- Forecast: binary image changes; approximately 0 authored source lines excluding generated files. Delivery strategy: `ask-on-risk`.

## Checks and progress
- Initial inspection: `assets/sprites/README.md`, atlas previews, source atlas format, and rig files show eight collections, 80 characters, four 128x128 source poses, and 24-frame generated walks except the 12-frame chibi knight.
- The sample was reconstructable: it is 2172x724 RGBA, splits into four equal 543px pose regions, and significant alpha bounds for all four poses share baseline y=591. A temporary 512x128 RGBA nearest-neighbor reconstruction preserved the cat and its four poses, with transparent margins and a shared baseline, and passed visual inspection. The temporary candidate was removed; no source was replaced.
- User explicitly authorized installing Pillow, OpenCV, and SciPy into the repository-local `.venv` from public PyPI, without credentials. Exact local versions read back: Pillow 13.0.0, OpenCV 5.0.0, and SciPy 1.18.1.
- Refreshed and reconstructed all 80 source atlases across mascotas, chibis, cyborgs, dinosaurios, elfos, fantasia, goblins, and monstruos. Every accepted candidate was rebuilt to the existing 512x128 RGBA atlas layout and visually reviewed for identity before replacing its source. Rejected candidates were discarded; targeted retries corrected mascotas-2 identity drift, cyborgs-3 and elfos-8 background artifacts, goblins-1 and goblins-4 background artifacts, and the eyepatch added to goblins-8. Two elfos-4 retries lost the lute; a localized restoration using the candidate and original reference restored it in all poses. No identity exception remains pending.
- Regenerated active and idle assets for all 80 characters. The authored `chibis-0` 12-frame active strip received a careful image edit and was regenerated; its authored override metadata and 12-frame count remain unchanged. Eight collection review boards and representative active cycles were visually inspected.
- Structural readback covered all 80 manifest entries and each corresponding source, active, and idle PNG: all files exist, are RGBA with transparency, and match expected dimensions and manifest frame counts; 0 structural errors. No automated test suites were run, as instructed.
- Parent spot-check independently confirmed 80 source atlases, 80 manifest entries, and no dimension or mode errors. Native review was not run: `gentle-ai review mode status` and `gentle-ai review assess --cwd <repo> --json` both failed because `gentle-ai` is not recognized in this environment; no native review approval is claimed.
- Independent post-commit review identified four issues for T2: 20 manifest stride values changed from their prior values (affecting playback); `goblins-7` gained faint alpha haze; `dinosaurios-4` has detached leg fragments; and `chibis-0` active frame bounds grew beyond its unchanged idle sprite.
- Engram mirror: pending because no memory provider is available in this session.
- Work-unit commit: `e5ba3e6` (`feat(sprites): refresh all buddy atlases`).
- T2: restored all 20 changed `stride` fields in `assets/sprites/walk-v3/manifest.json` and `web/static/buddies_walk_metadata.js` to the values from `e5ba3e6^`; structural readback confirms the two metadata objects match and every stride equals its pre-refresh value.
- T2: removed all source `goblins-7` alpha values 1–15, regenerated its active and idle strips, and visually inspected the outputs. Structural readback found zero remaining alpha 1–15 pixels in all three assets.
- T2: scaled each cell of the authored `chibis-0` active strip to the original first-frame bound of 105×103, retaining 12 cells, RGBA transparency, and baseline y=120. Structural readback confirms 12 frames and the first-frame alpha bounds `(11, 17, 116, 120)`.
- T2 dinosaur exception: inspecting regenerated `dinosaurios-4` showed the near-hind foot separated from the leg in active frames. A sampled-color bridge introduced crude pixels and did not make a safe repair; the foot shape could not be safely separated from the authored leg artwork without changing the rig. Following the scoped correction instruction, restored the source, active/idle output, and per-character joint tracks from `e5ba3e6^`, then rebuilt the collection review board from its final assets. The refreshed dinosaur correction is deferred; the pre-refresh asset and its existing fragment remain.
- No test suites were run. Structural/visual checks passed for the three corrections above and verified the dinosaur baseline restoration. Native review remains pending because the `gentle-ai` CLI is unavailable in this environment; no native approval is claimed.
- Final independent review found two stale review-only outputs after T2: `assets/sprites/walk-v3/review-data.js` still contains the old stride values, and `review-chibis.png` shows the knight at its pre-correction scale. T3 will regenerate these from the current manifest and active strip.
- Engram mirror: pending because no memory provider is available in this session.
- Work-unit commits: `e5ba3e6` (`feat(sprites): refresh all buddy atlases`); `9c75952` (`fix(sprites): correct scoped walk refresh findings`).
- Next step: regenerate T3 outputs, then report native review unavailable and the deferred `dinosaurios-4` art repair.
