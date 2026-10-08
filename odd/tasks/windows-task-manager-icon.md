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

- Strategy: `ask-on-risk`; selected chain strategy: `stacked-to-main` (existing choice for future independent PR slices).
- Next work-unit/slice boundary: WTI-3's source-workflow console behavior; do not create a PR or push as part of this task.
- Forecast: approximately 627 authored changed lines, excluding generated artifacts; the existing `stacked-to-main` choice applies above the review slice budget.
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

- [x] **WTI-2 — Brand the live-source launcher process**
  - Route: delegated direct.
  - Trigger: the active source workflow requires coordinated changes to the starter, a dedicated source launcher executable, build freshness handling, and regression coverage.
  - Reason reopened: user runtime evidence showed `Iniciar TikReader.cmd` still launches system `python.exe app\launcher.py`; WTI-1 only corrected the packaged installer path.
  - Acceptance criteria:
    - `Iniciar TikReader.cmd` launches a branded `TikReader.exe` UI process instead of Python.
    - The branded launcher loads the live workspace source and uses the selected virtual-environment or system Python only for backend children and dependencies.
    - Missing or stale generated launchers are rebuilt or fail visibly; the starter never silently falls back to a Python UI process.
    - Generated launcher artifacts remain ignored under `runtime/`.
    - Focused regression tests and a Windows process-identity smoke test pass.
  - Checks:
    - RED observed for source-launcher and freshness contracts before implementation.
    - Focused source-launcher contract tests: latest 11/11 passed through the bundled Python runtime; command: direct `runpy` invocation of `tests/test_source_launcher.py`.
    - PyInstaller source-launcher build with the active Python environment.
    - Runtime observation of `TikReader.exe` as the UI process.
  - Evidence: Initial RED was 0/4 before WTI-2 implementation. The semantic spec test reproduced the root path defect; local-tool contracts were RED before path resolution was added. A Windows subprocess probe later reproduced CMD environment discovery failure because a WindowsApps `py` alias could not execute, and `site.getsitepackages()[0]` was not the actual packages directory. The corrected starter probe resolves Python 3.14.7 at `C:\Users\Carlos\AppData\Local\Python\pythoncore-3.14-64\python.exe` and its existing `Lib\site-packages`; the focused suite passed 8/8. Parent observed the pure-Python bootstrap remain alive for 12 seconds with Python server and QtWebEngine children, while the bundled-Qt `TikReader.exe` exited cleanly before eight seconds. The thin source spec excluded Qt and the bootstrap logged fatal tracebacks, but normal starter smoke then showed missing dynamic stdlib `webbrowser`. A broad `sys.stdlib_module_names` hidden-import fix made the UI process stay alive without spawning the backend or writing application data; parent found `_internal/PySide6` and matplotlib dependencies had been transitively collected, recreating a mixed runtime. New subprocess-shim contracts observed RED at 8/11 before implementation. A follow-up check also caught RED when the executable entrypoint ignored the child exit code; `SystemExit(main())` now propagates it. The final design uses `TikReader.exe` only as a branded parent shim that validates the source root/backend Python, launches `[backend_python, app/launcher.py]` in the workspace root with inherited environment, waits, and returns the child exit code. The spec uses static analysis only, empty hidden imports, no backend site-packages path, and continues excluding app modules. After implementation, focused tests passed 11/11; Python compile and spec parse passed; scoped `git diff --check` passed. The normal starter rebuilt the shim in about 12 seconds and produced the verified tree `TikReader.exe` -> live launcher Python -> server Python plus QtWebEngine. `/health` reported TikReader with archive integrity `ok` about 7.3 seconds after start, SocketIO connected, the tree remained alive for 12 seconds after readiness, no fresh shim error was written, and the generated runtime contained no PySide6, shiboken6, or matplotlib. The executable retained TikReader metadata, version 1.0.0.8, GUI subsystem, and seven icon resources. Earlier restricted-smoke failures were traced to Winsock 10013 loopback denial and reproduced against the direct baseline; the final approved unrestricted smoke passed.
  - Work-unit/slice boundary: this WTI-2 commit follows the WTI-1 boundary; future independent PR slices use the existing `stacked-to-main` choice. No PR or push was created.
  - Authored changed lines: 668 (628 insertions plus 40 deletions in the work-unit commit; generated files excluded).
  - Commit: `6ab6d3e` — `fix(launcher): brand source process tree`; documentation evidence is recorded in a follow-up commit.
  - RDD assessment: `disabled/unmanaged` (clone-local mode remains off; no native review started).

- [x] **WTI-3 — Keep source-launch startup console-free and failures visible**
  - Objective: ensure the normal source starter releases its batch console promptly while the branded parent runs the backend without a console window and still reports/persists backend failures.
  - Route: delegated direct.
  - Trigger: the behavior crosses the Windows starter, frozen parent process options, startup error handling, and focused tests.
  - Acceptance criteria:
    - Normal `Iniciar TikReader.cmd` startup returns after launching the GUI without waiting for its lifetime; probe/build failures remain visible and `--probe-environment` is unchanged.
    - The branded shim starts selected backend Python with `subprocess.CREATE_NO_WINDOW` on Windows and `0` elsewhere.
    - Nonzero backend completion is surfaced through a GUI error and persistent `runtime/source-launcher-error.log` entry.
    - The `TikReader.exe` process-tree root remains branded, with no additional permanent launcher file.
  - Checks:
    - Observe RED for non-waiting CMD, platform flags, and failure reporting/persistence contracts before implementation.
    - Focused source-launcher tests: latest 18/18 passed through the bundled Python runtime; command: direct `runpy` invocation of `tests/test_source_launcher.py`.
    - Compile/parse Python files and spec; run scoped `git diff --check`.
    - Parent performs runtime smoke and commits; no build, stage, or commit in this work unit.
  - Evidence: New contracts observed RED at 9/14 before implementation, covering `/wait`, missing Windows creation flags, and absent child-failure reporting. The starter now exits promptly after a verified `Start-Process -PassThru` launch; the shim passes `CREATE_NO_WINDOW` on Windows and zero elsewhere, and nonzero child completion is logged and shown through the GUI. Parent runtime verification then exposed fixed shared discovery files causing concurrent CMD probes to report sharing violations and falsely claim Python was unavailable. Each invocation now atomically creates a randomized private runtime directory for discovery output and stderr, with cleanup on handled success/failure paths. A later independent check found the builder deleted the active onedir before building, allowing locked DLL failures to leave partial output. The helper now builds into a unique same-filesystem staging tree, serializes promotion, moves the old complete tree only after staging succeeds, and rolls back with bounded retries/fallback rename. Windows may rename an active canonical directory while retaining a byte-identical backup until the old process releases its file locks; no partial deletion occurred. The final shared-handle defect was the fixed starter log inherited by the GUI; logs are now collision-resistant per-invocation files and remain independently readable. Promotion and starter regressions observed RED before implementation. The final focused suite passed 18/18; Python compilation and scoped `git diff --check` passed. Exact normal-starter verification rebuilt/promoted the canonical launcher in 9.12 seconds, then CMD and PowerShell exited zero promptly after launching TikReader.exe. The branded tree reached health in 6.42 seconds, connected SocketIO, and stayed alive 12 seconds afterward. No owned `ConsoleWindowClass`, lingering CMD/PowerShell, or fresh shim error was observed; headless conhost processes had no visible windows. The unique starter log recorded the correct PID and remained readable while the GUI ran, and a concurrent real environment probe exited zero with empty stderr. Controlled nonzero-child verification persisted the error, displayed the GUI failure dialog, and exited nonzero without a visible console.
  - Work-unit/slice boundary: independent correction after WTI-2; future PR slices retain the existing `stacked-to-main` strategy.
  - Commit: pending work-unit commit; identity will be recorded in a documentation evidence update.

## Progress

- Exploration completed: root cause verified in `packaging/TikReader.iss`; Qt window branding is already present in `app/desktop_window.py`.
- WTI-1 is complete. The PyInstaller definition, frozen launcher bootstrap, installer shortcuts/post-install action, full onedir payload copy, focused contracts, successful Windows build, executable metadata, icon, and runtime process identity were verified. Pre-existing unrelated staged changes remain untouched.
- WTI-2 is complete. The minimal branded parent owns the live Python launcher/backend process tree, the exact normal starter reached application health and SocketIO readiness, and the generated shim excludes Qt/backend packages while retaining TikReader metadata and icon resources.
- WTI-3 is complete. The starter and its PowerShell helper exit promptly, backend Python has no visible console, concurrent probes/logs no longer collide, active launcher refresh is staged safely, and both success and failure paths were verified.

## Next Step

Create the WTI-3 work-unit commit and record its identity; no PR or push is requested.
