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

- [x] **WTI-1 — Ship a branded Windows launcher executable**
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
  - Evidence: the pre-change packaging contract failed because no PyInstaller spec existed. A follow-up semantic path test observed RED because the spec resolved ROOT outside the repository, and an onedir-copy test observed RED because the copy function was absent. After correction, all six packaging contract checks passed through the available Python runtime. PyInstaller 6.20.0 then built the launcher successfully with Python 3.13.15. Windows reported `ProductName=TikReader`, `FileDescription=TikReader`, `OriginalFilename=TikReader.exe`, and version `1.0.0.8`; the extracted executable icon matched the TikReader `TR` icon. The PowerShell build script parsed cleanly and `git diff --check` passed. `pytest` remained unavailable, so the six plain assertion tests were invoked directly. The complete candidate totals 295 authored changed lines (290 insertions plus 5 deletions).
  - Runtime harness: a temporary assembled payload launched the generated executable offscreen. After eight seconds the process remained active as `TikReader.exe` from the generated path, with no Python child process observed; the exact verification process was then stopped.
  - Commits: `d44bc66` — `fix(packaging): brand Windows launcher executable`; `b8ef007` — `fix(packaging): resolve launcher distribution paths`; documentation evidence commits `5dad3d8` and `4ab855a`. Only authorized paths were committed; unrelated staged changes remain untouched.
  - RDD assessment: disabled/unmanaged (clone-local mode reported off; no native review started).

## Progress

- Exploration completed: root cause verified in `packaging/TikReader.iss`; Qt window branding is already present in `app/desktop_window.py`.
- WTI-1 is complete. The PyInstaller definition, frozen launcher bootstrap, installer shortcuts/post-install action, full onedir payload copy, focused contracts, successful Windows build, executable metadata, icon, and runtime process identity were verified. Pre-existing unrelated staged changes remain untouched.

## Next Step

Rebuild and distribute the installer through the project's normal release process when the user chooses to publish this change.
