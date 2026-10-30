# Release main 1.0.0.9

## Objective

Consolidate the authorized local changes on `main`, document the new user-facing capabilities with current screenshots, build the Windows installer for version 1.0.0.9, and publish the commit and installer to GitHub.

## Problem and why

The current feature branch is fifteen commits ahead of local `main` and also contains a large mixed working-tree diff spanning voice, desktop startup, Minecraft controls, overlay animation, gift/bank tooling, shared UI, tests, and packaging. The repository README does not yet showcase the latest capabilities, and the current installer must be rebuilt from the final reviewed bytes before publishing.

## Authorized scope

- Commit all intentional tracked and new product source, test, documentation, and product asset changes currently present in the worktree.
- Exclude `.tmp/` and all generated caches, preserved installers, backups, local tokens, and other temporary artifacts.
- Improve `README.md` and add current product screenshots under `docs/screenshots/`.
- Fast-forward local `main` to the completed feature branch.
- Build `release/TikReader-1.0.0.9-Beta-Setup.exe` from the final `main` candidate.
- Push `main` to `origin` using the user-authorized configured HTTPS session.
- Create or update the GitHub prerelease for version 1.0.0.9 and upload the installer.

## Constraints

- Preserve all existing user changes.
- Do not commit or publish `.tmp/`, secrets, credentials, local tokens, caches, backups, or generated payload directories.
- Keep source, tests, documentation, and release metadata consistent.
- Remote operations are limited to `https://github.com/3rror32/TikReader.git`, branch `main`, and the 1.0.0.9 release artifact.
- The project skill registry is stale; referenced commit and documentation skills are unavailable (`skill_resolution: none`).
- Engram mirror is pending because no Engram memory tools are available in this session.

## Delivery strategy

`exception-ok`: the user explicitly requested that all authorized changes be delivered directly to `main` and published as one 1.0.0.9 release. Forecast exceeds 400 authored lines because the existing worktree contains approximately 3,236 additions and 963 deletions. Work-unit commits remain logically separated before the final fast-forward.

## Tasks

- [x] `RM-01` Consolidate the existing intentional changes into coherent work-unit commits and run focused source/test verification.
  - Route: delegated direct.
  - Trigger: mixed multi-feature diff across more than two non-trivial files; delegated mapping and verification required.
  - Acceptance: every intended product change is committed; `.tmp/` and generated/local artifacts are excluded; focused tests and `git diff --check` are observed.
  - Outcome: complete. Eight commits on `codex/minecraft-command-results`: `ac9e16f` `feat(voice): add local captions and voice ripples`; `7c265a6` `feat(desktop): add startup readiness flow`; `dff566f` `feat(minecraft): improve command controls and results`; `6edd981` `feat(overlays): improve animation controls`; `07f1742` `feat(gifts): refine bank editor and arcade assets`; `f34287a` `build: package local caption runtime`; `206fba5` `feat(ui): refine shared widgets and controls`; `9bd5db0` `test(overlays): supply activation helper to preview harness`.
  - Grouping note: `app/app_paths.py` was placed with dependencies and packaging because its added model-storage path is shared with the packaged local caption runtime.
  - Verification: `python -m pytest tests/test_microphone_captions.py tests/test_local_caption_engine.py tests/test_voice_ripples.py tests/test_startup_splash.py tests/test_native_desktop.py tests/test_minecraft_bedrock.py tests/test_overlay_animations.py tests/test_bank_assets.py tests/test_bank_live_sync.py tests/test_interactivity.py tests/test_server.py tests/test_source_launcher.py tests/test_build_release.py` could not start: Windows denied access to the `python.exe` WindowsApps launcher. `py -3 -m pytest` was also unavailable for the same launcher access denial. `node tests/test_microphone_captions.cjs`, `node tests/test_microphone_caption_runtime.cjs`, `node tests/test_voice_ripples.cjs`, `node tests/test_voice_ripple_runtime.cjs`, `node tests/test_voice_ripple_widget.cjs`, `node tests/test_minecraft_controls.cjs` (44 passed), `node tests/test_animation_preview.cjs` (9 passed after supplying its missing activation-helper dependency), `node tests/test_overlay_activation_controls.cjs` (3 passed), `node tests/test_overlay_gallery.cjs` (24 passed), `node tests/test_overlay_transitions.cjs` (4 passed), `node tests/test_bank_editor.cjs` (30 passed), `node tests/test_gift_cannon.cjs` (13 passed), `node tests/test_piggy_motion.cjs` (22 passed), `node tests/test_widgets.cjs` (15 passed), `node tests/test_operator_startup.cjs` (13 passed), `node tests/test_connection_button_states.cjs` (5 passed), `node tests/test_production_controls.cjs` (7 passed), and `node tests/test_theme_accessibility.cjs` (10 passed) all exited 0. `git diff --check` exited 0.
  - RDD: unavailable; `gentle-ai` is not installed or found on PATH.
  - Safety: `.tmp/` matches `git check-ignore`; it remains untracked and was not staged. The staging and commit path lists contained no `.tmp/` entries.
- [ ] `RM-02` Update the README and add current screenshots that highlight the main studio, gift simulation, Minecraft results, overlay animation controls, and microphone captions where demonstrable.
  - Route: delegated direct.
  - Trigger: documentation plus multiple new binary assets and live UI capture.
  - Acceptance: README highlights the new capabilities, all referenced local images exist, and the Markdown asset links pass structural validation.
- [ ] `RM-03` Fast-forward local `main`, run release preflight, and build the 1.0.0.9 Windows installer from the final candidate.
  - Route: delegated direct.
  - Trigger: build execution and release artifact verification must run in a fresh worker context.
  - Acceptance: version checks pass and `release/TikReader-1.0.0.9-Beta-Setup.exe` is produced with recorded size and checksum.
- [ ] `RM-04` Push `main` and publish the installer to the GitHub 1.0.0.9 prerelease.
  - Route: direct inline remote state operation after all local checks and review requirements are satisfied.
  - Acceptance: GitHub confirms the updated `main` commit and a release asset identity/URL for the installer.

## Applicable checks

- Focused Python and Node test groups covering captions/ripples, startup/native desktop, Minecraft, overlays, banks/gifts, widgets, and packaging.
- `git diff --check`
- `python tools/check_changes.py`
- `python -m unittest tests.test_build_release`
- `./packaging/build_installer.ps1 -CheckOnly`
- README relative-link and screenshot existence validation.
- Installer existence, size, SHA-256, and distribution metadata inspection.
- Parent spot-check of at least one reported verification command.

## Progress and evidence

- Exploration: local `main` (`986e05a`) is the exact merge base; the initial branch head (`714257f`) was fifteen commits ahead and zero behind.
- Safety audit: `.tmp/` contains approximately 8,384 files and 1.34 GB of caches, QA output, preserved installers, and local secret-like files; it is excluded from every work unit.
- Release map: version sources agree on 1.0.0.9 and the expected installer path is `release/TikReader-1.0.0.9-Beta-Setup.exe`.

## Next step

Proceed to `RM-02`: update `README.md` and add the requested current screenshots.
