# Pokémon for Amigos del directo

## Objective
Add a small, selectable collection of animated Pokémon walking sprites to Amigos del directo, using the existing horizontal sprite-strip renderer.

## Problem and rationale
The widget currently animates bundled 128×128-frame PNG strips and has no Pokémon collection. The selected SpriteCollab source stores eight-direction walk and idle atlases, so the chosen side-walk row must be adapted before the widget can render it.

## Scope and constraints
- Add the emblematic roster selected in the conversation: Pikachu, Eevee, Charizard, Bulbasaur, Squirtle, Mewtwo, Gengar, and Snorlax.
- Adapt walking frames to the widget's transparent horizontal PNG strips and idle assets; preserve pixel-art edges and recognizable proportions.
- Add the collection to the existing character selection and stable per-viewer character assignment.
- Preserve all pre-existing working-tree changes, especially the pending chibi review outputs and `stream-buddy-sprite-refresh.md` task.
- Keep the change local; do not push, publish, or include remote operations.

## Authorized scope
`app/stream_buddies.py`
`web/static/stream_buddies_controls.js`
`web/static/buddies_walk_metadata.js`
`assets/sprites/walk-v3/pokemon-*.png`
`assets/sprites/walk-v3/pokemon-credits.json`
`assets/sprites/walk-v3/manifest.json`
`tests/test_stream_buddies.py`
`tests/test_stream_buddies.cjs`
`odd/tasks/stream-buddies-pokemon.md`

## Acceptance criteria
- Pokémon appears as a selectable collection in Amigos del directo, and assigned participants use only its eight characters.
- Each sprite uses the existing horizontal frame-strip contract, displays its idle image at zero speed, walks without broken scaling or frame selection, and retains its full source silhouette without touching a cell edge.
- Walk and idle frames share a per-species scale and align their visible baseline at y=120.
- Existing collections, assignment stability, and comments remain unchanged.
- Focused Python and Node tests pass; a structural readback confirms all referenced sprite files and metadata exist.

## Tasks
- [x] T1 — Add the eight adapted sprite assets, collection/catalog entries, metadata, and focused regression coverage, including the final bounded horizontal-margin correction.

## Route and estimate
- Route: delegated direct.
- Trigger evidence: the implementation spans backend catalog/settings, front-end controls and animation metadata, binary sprite assets, and focused tests.
- Forecast: fewer than 400 authored source lines, excluding generated image assets. Delivery strategy: ask-on-risk.

## Verification and progress
- Initial repository state: `main` had four local commits ahead of `origin/main` and three unrelated pre-existing modifications. Work is isolated on `codex/stream-buddies-pokemon`; those modifications remain untouched.
- Sprite contract mapped in `web/static/stream_buddies.js`: horizontal transparent PNG strips, 128×128 cells, frame count and stride supplied by `BUDDY_WALK_METADATA`; separate `-idle.png` asset at zero speed.
- Selected source: the user-provided `C:\Users\Carlos\Downloads\SpriteCollab-master.zip`. The top-level default folders for the eight requested species were used. Their Walk-Anim sheets contain 4, 6, or 7 frames across eight directional rows; row 2 is the east-facing side view. Walk and idle crops share one nearest-neighbor scale per species derived from shared visible reference bounds, and their visible alpha bottoms align to y=120 in transparent 128×128 cells. The first row-2 idle frame supplies each static idle asset.
- Frame counts: Bulbasaur 6, Eevee 7, Charizard 4, Squirtle 4, Pikachu 4, Mewtwo 6, Gengar 4, Snorlax 4. These counts are recorded in both metadata files and covered by the Node regression.
- Attribution: `assets/sprites/walk-v3/pokemon-credits.json` preserves source archive paths, species IDs, direction row, selected variant, source frame sizes/counts/durations, and relevant contributor records for Walk and Idle under CC BY-NC. The archive's `credit_names.txt` maps Mewtwo contributor ID `<@!702275233125630042>` to display name `JFain`, which is used in the attribution entry.
- Focused checks: `$env:PYTHONPATH='app'; .\.venv\Scripts\python.exe -m unittest tests.test_stream_buddies` and `node tests/test_stream_buddies.cjs`. Python tests check baseline, walk/idle visible scale, and at least a four-pixel horizontal alpha margin in every frame; Node checks all walk/idle PNG paths, RGBA alpha, horizontal strip dimensions, source frame counts, metadata, manifest, and attributions.
- Engram mirror: pending; no memory provider is available in this session.
- Native review mode: unknown because `gentle-ai` is unavailable in this environment.
- T1 complete: the backend exposes the eight named Pokémon while preserving existing collection order and the UI selector labels the 8-character Pokémon collection. Adapted walk and idle assets, metadata, manifest entries, attribution JSON, and focused regressions are present.
- Correction rationale: reviewer readback found that centered source cells left the visible sprites above the ground line and independent walk/idle scaling changed their apparent size. New deterministic Python checks were observed RED first: all eight baseline subtests failed, and the scale check failed for Pikachu and Eevee.
- Visual readback after correction: all eight exported walks and the Pikachu, Eevee, and Mewtwo idle images were rechecked. They face right, remain crisp and recognizable, share each species' scale across walking and idle, and meet the ground line at y=120. Temporary `pokemon-review-*` previews were removed; no preview files remain.
- Verification: `$env:PYTHONPATH='app'; .\.venv\Scripts\python.exe -m unittest tests.test_stream_buddies` passed (10 tests). `node tests/test_stream_buddies.cjs` passed (5 tests), including PNG dimensions/alpha, exact source frame counts, metadata, manifest, and attribution structure. The WindowsApps `python` shim was inaccessible, so the repository-local interpreter was used.
- Final correction rationale: an edge regression was added and observed RED for Bulbasaur, Mewtwo, Pikachu, and Squirtle. After reducing those shared scales, a four-pixel margin check also found Eevee at one pixel; Eevee's shared scale was reduced as evidence required. A temporary eight-pixel threshold also flagged Charizard's six-pixel margin, so the final deterministic threshold is four pixels and Charizard remains unchanged.
- Final visual/structural readback: the corrected species still use the same east-facing poses, source frame counts/durations, nearest-neighbor pixels, and y=120 baseline. Minimum horizontal margins are Bulbasaur 11px, Mewtwo 11px, Pikachu 11px, Squirtle 11px, Eevee 5px, Charizard 6px, Gengar 10px, and Snorlax 25px. All walk and idle files are transparent 128×128 cells with a shared per-species scale.
- Verification after the final correction: `$env:PYTHONPATH='app'; .\.venv\Scripts\python.exe -m unittest tests.test_stream_buddies` passed (11 tests). `node tests/test_stream_buddies.cjs` passed (5 tests). Structural checks confirmed every walk/idle cell has alpha bounds inside the four-pixel margin, every visible baseline is y=120, source frame counts match metadata, and Mewtwo's archive contributor ID resolves to JFain.
- Parent spot-check: `node tests/test_stream_buddies.cjs` passed (5 tests) and `git diff --check` passed. Independent final visual verification confirmed all 47 walk/idle frames preserve their source silhouettes, keep at least a 5px horizontal margin, share walk/idle scale per species, and align at y=120.
- Native risk assessment was unavailable because the `gentle-ai` executable is not installed; no native approval is claimed. Engram mirror remains pending because no memory provider is available.
- Work-unit commit: pending parent commit; the commit identity will be recorded in this task document after creation.
- Next step: commit the verified work unit on `codex/stream-buddies-pokemon`, then read back and record its identity. Preserve the pre-existing review artifacts and `stream-buddy-sprite-refresh.md`.
