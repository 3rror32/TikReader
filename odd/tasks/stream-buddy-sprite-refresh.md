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
- Engram mirror: pending because no memory provider is available in this session.
- Work-unit commit: `e5ba3e6` (`feat(sprites): refresh all buddy atlases`).
- Next step: no sprite refresh work remains; native review CLI availability is an environment limitation.
