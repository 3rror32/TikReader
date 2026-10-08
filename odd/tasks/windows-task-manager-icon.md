# Windows Task Manager Icon

## Objective

Package TikReader's Windows desktop launcher as a branded executable so Task Manager shows TikReader's name and icon instead of Python's.

## Problem and Why

The installer currently launches the embedded `pythonw.exe` with `desktop_launch.pyw`. Qt's window icon and AppUserModelID brand the window, but Windows process-oriented views derive their identity from the executable image and therefore display Python.

## Authorized Scope

- Add the Windows executable packaging definition.
- Update the installer build and launch configuration to produce and run `TikReader.exe`.
- Add focused packaging regression coverage.
- Preserve all unrelated pre-existing working-tree changes.

## Constraints

- Reuse `assets/icons/tikreader.ico`.
- Keep the installed application self-contained and preserve current launcher behavior.
- Do not modify or commit unrelated dirty files.
- Generated binaries and installer artifacts remain untracked.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: under 200 authored changed lines, excluding generated artifacts.
- Branch: `codex/priority-audit-fixes` (existing non-default working branch).

## Tasks

- [ ] **WTI-1 — Ship a branded Windows launcher executable**
  - Route: delegated direct.
  - Trigger: the implementation requires coordinated non-trivial changes across the packaging definition, build script, installer configuration, and tests.
  - Acceptance criteria:
    - The Windows build produces `TikReader.exe` with TikReader's icon and product identity.
    - Installer shortcuts and post-install launch use `TikReader.exe`, not `pythonw.exe`.
    - The packaged executable runs the existing desktop launcher without spawning a separate Python-branded desktop process.
    - Focused regression tests cover the executable and installer contract.
  - Checks:
    - RED observed for the new packaging regression before implementation.
    - `python -m pytest tests/test_windows_packaging.py -q`
    - Structural inspection of the PyInstaller and Inno Setup configuration.
  - Evidence: the pre-change packaging contract failed because no PyInstaller spec existed; after implementation all four original focused contract checks passed when invoked directly. A follow-up semantic path test observed RED because the spec resolved ROOT to the parent of the repository, and an onedir-copy test observed RED because the copy function was absent. After correction, all six packaging contract checks passed when invoked directly. The PowerShell build script parsed cleanly and `git diff --check` passed. `python -m pytest tests/test_windows_packaging.py -q` could not run because the configured Python launcher was inaccessible and the available bundled Python has no pytest module. PyInstaller is not installed in the available Python environment, so no executable or FileVersionInfo values were produced; no dependencies were installed. Implementation, tests, and the newly tracked feature document in commit `d44bc66` total 226 authored changed lines (221 insertions plus 5 deletions).
  - Runtime harness: unavailable; PyInstaller is not installed, so the branded executable could not be built or launched.
  - Commit: `d44bc66` — `fix(packaging): brand Windows launcher executable`. Only the seven authorized paths were committed; unrelated staged changes remain untouched.
  - RDD assessment: disabled/unmanaged (clone-local mode reported off; no native review started).

## Progress

- Exploration completed: root cause verified in `packaging/TikReader.iss`; Qt window branding is already present in `app/desktop_window.py`.
- WTI-1 implementation is present in the PyInstaller definition, frozen launcher bootstrap, installer shortcuts/post-install action, and focused packaging contract tests. The follow-up correction fixes spec-root resolution and copies the full PyInstaller onedir distribution, including `_internal`, into the payload. Acceptance remains open until the Windows build runs and its executable metadata and runtime behavior can be observed. The authorized files are committed; pre-existing unrelated staged changes remain untouched.

## Next Step

Run the packaging tests and PyInstaller build on a Python 3.13 build environment with PyInstaller available, inspect the resulting executable's version metadata and runtime behavior, then close WTI-1 and record verification evidence.
