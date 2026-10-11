"""Regression contracts for the branded live-source desktop launcher."""

from pathlib import Path
import ast
import os
import re
import runpy
import subprocess
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[1]


def _mock_starter_launch(scenario):
    """Run only the authored PowerShell command, never the CMD build or real EXE."""
    assert os.name == "nt", "Process-image validation is Windows-specific."
    starter = (ROOT / "Iniciar TikReader.cmd").read_text(encoding="utf-8")
    launch_line = next(line for line in starter.splitlines() if "Start-Process" in line)
    command = launch_line.partition('-Command "')[2].rsplit('"', 1)[0]
    assert command, "The authored PowerShell launch command must be present"
    mock = r"""
$script:startCalls=0; $script:sleepCalls=0
$script:fake=[pscustomobject]@{Id=4242; Path=$null; HasExited=$false; RefreshCount=0}
if ($env:STARTER_TEST_SCENARIO -eq 'correct') { $script:fake.Path=$env:TIKREADER_SOURCE_LAUNCHER }
if ($env:STARTER_TEST_SCENARIO -eq 'wrong') { $script:fake.Path=Join-Path $env:TIKREADER_SOURCE_ROOT 'Other.exe' }
$script:fake | Add-Member -MemberType ScriptMethod -Name Refresh -Value {
    $this.RefreshCount++
    if ($env:STARTER_TEST_SCENARIO -eq 'null' -or
        ($env:STARTER_TEST_SCENARIO -eq 'delayed' -and $this.RefreshCount -ge 3)) {
        $this.Path=$env:TIKREADER_SOURCE_LAUNCHER
    }
    if ($env:STARTER_TEST_SCENARIO -eq 'exited') { $this.HasExited=$true }
}
function Start-Process {
    param($FilePath, $WorkingDirectory, [switch]$PassThru, [switch]$Wait, $ErrorAction)
    $script:startCalls++
    if ($Wait) { throw 'The starter must not wait for GUI exit' }
    if ($env:STARTER_TEST_SCENARIO -eq 'launch-failure') { throw 'mock launch failure' }
    if ($FilePath -ne $env:TIKREADER_SOURCE_LAUNCHER) { throw 'unexpected configured path' }
    return $script:fake
}
function Start-Sleep {
    param($Milliseconds)
    if ($Milliseconds -ne 50) { throw 'Metadata retry delay must be 50 ms' }
    $script:sleepCalls++
}
"""
    script = mock + "\ntry {\n" + command + "\n} finally {\n" + (
        "Write-Output ('MOCK_COUNTS:'+$script:startCalls+','+"
        "$script:fake.RefreshCount+','+$script:sleepCalls)\n}"
    )
    work_parent = ROOT / "runtime" / "source-launcher-work"
    work_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work_parent) as temporary:
        folder = Path(temporary)
        environment = {
            **os.environ,
            "STARTER_TEST_SCENARIO": scenario,
            "TIKREADER_SOURCE_ROOT": str(folder),
            "TIKREADER_SOURCE_LAUNCHER": str(folder / "TikReader.exe"),
            "TIKREADER_STARTER_LOG": str(folder / "launcher.log"),
        }
        if scenario == "invalid-path":
            environment["TIKREADER_SOURCE_LAUNCHER"] = '"invalid.exe"'
        completed = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
            env=environment, capture_output=True, text=True, timeout=15,
        )
        counts = re.search(r"MOCK_COUNTS:(\d+),(\d+),(\d+)", completed.stdout)
        assert counts, completed.stdout + completed.stderr
        log = folder / "launcher.log"
        log_text = log.read_text() if log.exists() else ""
        return completed, tuple(map(int, counts.groups())), log_text


def test_starter_accepts_known_image_without_retry_delay():
    completed, counts, log = _mock_starter_launch("correct")
    assert completed.returncode == 0, completed.stderr + log
    assert counts == (1, 1, 0)
    assert "Started TikReader.exe PID 4242" in log


def test_starter_refreshes_initially_null_process_image():
    completed, counts, log = _mock_starter_launch("null")
    assert completed.returncode == 0, completed.stderr + log
    assert counts == (1, 1, 0)
    assert "Started TikReader.exe PID 4242" in log


def test_starter_retries_delayed_image_without_waiting_for_gui_exit():
    completed, counts, log = _mock_starter_launch("delayed")
    assert completed.returncode == 0, completed.stderr + log
    assert counts == (1, 3, 2)
    assert "Started TikReader.exe PID 4242" in log


def test_starter_bounds_persistently_unavailable_image_retries():
    completed, counts, log = _mock_starter_launch("unavailable")
    assert completed.returncode != 0
    assert counts == (1, 20, 19)
    assert "Process image unavailable" in log
    assert "Started TikReader.exe" not in log


def test_starter_reports_process_exit_before_image_validation():
    completed, counts, log = _mock_starter_launch("exited")
    assert completed.returncode != 0
    assert counts == (1, 1, 0)
    assert "Process exited before image validation" in log


def test_starter_rejects_wrong_image_and_reports_launch_failures():
    for scenario, diagnostic in [("wrong", "Unexpected process image"),
                                 ("launch-failure", "Launch failure")]:
        completed, counts, log = _mock_starter_launch(scenario)
        assert completed.returncode != 0
        assert counts[0] == 1
        assert counts[2] == 0, "Known wrong images and launch failures must not be retried"
        assert diagnostic in log
        assert "Started TikReader.exe" not in log


def test_starter_validates_configured_path_before_launch():
    completed, counts, log = _mock_starter_launch("invalid-path")
    assert completed.returncode != 0
    assert counts == (0, 0, 0)
    assert "Invalid source launcher path" in log


def test_source_starter_uses_branded_executable_without_python_ui_fallback():
    starter = (ROOT / "Iniciar TikReader.cmd").read_text(encoding="utf-8")
    normalized = starter.lower()

    assert "source-launcher\\tikreader\\tikreader.exe" in normalized
    assert "source_backend_python" in normalized
    assert "source_backend_site_packages" in normalized
    assert ".venv\\scripts\\python.exe" in normalized
    assert "tools\\build_source_launcher.py" in normalized
    assert "start-process" in normalized
    assert "-passthru" in normalized
    assert "$process.path" in normalized
    assert "source-launcher-logs" in normalized
    assert "runtime\\launcher.log" not in normalized
    assert not re.search(r"start[^\r\n]*source_launcher[^\r\n]*/wait", normalized)
    assert not re.search(r"start[^\r\n]*python(?:\.exe)?[^\r\n]*launcher\.py", normalized)
    assert not re.search(r"start[^\r\n]*py\s+-3[^\r\n]*launcher\.py", normalized)


def test_source_starter_keeps_startup_errors_visible_without_waiting_for_gui():
    starter = (ROOT / "Iniciar TikReader.cmd").read_text(encoding="utf-8")
    normalized = starter.lower()
    launch_line = next(
        line for line in normalized.splitlines()
        if "start-process" in line and "source_launcher" in line
    )

    assert "-passthru" in launch_line
    assert "$process.path" in launch_line
    launch_tail = normalized[normalized.index(launch_line):]
    assert "if errorlevel 1" in launch_tail
    assert "pause" in launch_tail
    assert "source-launcher-error.log" in (ROOT / "packaging" / "source_launch.pyw").read_text(encoding="utf-8").lower()


def test_starter_probe_resolves_real_backend_and_lib_site_packages():
    assert os.name == "nt", "This production starter probe is Windows-specific."
    starter = ROOT / "Iniciar TikReader.cmd"
    completed = subprocess.run(
        f'cmd.exe /d /c call "{starter.name}" --probe-environment',
        executable=os.environ.get("COMSPEC", "cmd.exe"),
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=20,
        stdin=subprocess.DEVNULL,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    values = {}
    for line in completed.stdout.splitlines():
        if line.startswith("SOURCE_BACKEND_PYTHON="):
            values["backend"] = line.partition("=")[2].strip()
        elif line.startswith("SOURCE_BACKEND_SITE_PACKAGES="):
            values["site_packages"] = line.partition("=")[2].strip()

    assert Path(values["backend"]).is_file()
    site_packages = Path(values["site_packages"])
    assert site_packages.is_dir()
    assert site_packages.name.lower() == "site-packages"
    assert site_packages.parent.name.lower() == "lib"


def test_overlapping_starter_probes_resolve_backend_without_leftover_files():
    assert os.name == "nt", "Concurrent production starter probes are Windows-specific."
    starter = ROOT / "Iniciar TikReader.cmd"
    runtime = ROOT / "runtime"
    probe_pattern = "source-launch-probe-*"
    before = {path.name for path in runtime.glob(probe_pattern)}
    logs_root = runtime / "source-launcher-logs"
    before_logs = {path.name for path in logs_root.glob("run-*")} if logs_root.is_dir() else set()
    command = f'cmd.exe /d /c call "{starter.name}" --probe-environment'
    processes = []
    try:
        for _ in range(2):
            processes.append(subprocess.Popen(
                command,
                executable=os.environ.get("COMSPEC", "cmd.exe"),
                cwd=ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            ))

        results = [process.communicate(timeout=30) for process in processes]
        for process, (stdout, stderr) in zip(processes, results):
            assert process.returncode == 0, stdout + stderr
            values = {}
            for line in stdout.splitlines():
                if line.startswith("SOURCE_BACKEND_PYTHON="):
                    values["backend"] = line.partition("=")[2].strip()
                elif line.startswith("SOURCE_BACKEND_SITE_PACKAGES="):
                    values["site_packages"] = line.partition("=")[2].strip()
            assert Path(values["backend"]).is_file()
            site_packages = Path(values["site_packages"])
            assert site_packages.is_dir()
            assert site_packages.name.lower() == "site-packages"
            assert site_packages.parent.name.lower() == "lib"
    finally:
        for process in processes:
            if process.poll() is None:
                process.kill()
                process.communicate()

    after = {path.name for path in runtime.glob(probe_pattern)}
    assert after == before, f"Probe artifacts remained: {after - before}"
    after_logs = {path.name for path in logs_root.glob("run-*")}
    new_logs = after_logs - before_logs
    assert len(new_logs) == 2, f"Expected two retained invocation logs, found {new_logs}"
    assert all((logs_root / name / "launcher.log").is_file() for name in new_logs)
    starter_text = starter.read_text(encoding="utf-8").lower()
    assert "runtime\\launcher.log" not in starter_text
    launch_command = next(line for line in starter_text.splitlines() if "start-process" in line)
    assert "2>>" not in launch_command and ">>" not in launch_command
    for fixed_name in (
        "source-backend-path.tmp",
        "source-python-candidates.tmp",
        "source-site-packages.tmp",
    ):
        assert fixed_name not in starter_text


def test_source_spec_bundles_ui_runtime_but_excludes_live_app_modules():
    spec = (ROOT / "packaging" / "TikReaderSource.spec").read_text(encoding="utf-8")
    normalized = spec.lower()

    assert "desktop_launch" not in normalized
    assert "source_launch.pyw" in normalized
    assert "source_backend_python" in normalized
    assert "excludes=app_modules" in normalized
    assert 'name="tikreader"' in normalized
    assert "tikreader.ico" in normalized
    assert "tikreaderversion.txt" in normalized
    assert "collect(" in normalized


def test_source_spec_does_not_bundle_backend_qt_runtime():
    spec_path = ROOT / "packaging" / "TikReaderSource.spec"
    tree = ast.parse(spec_path.read_text(encoding="utf-8"), filename=str(spec_path))
    analysis = next(
        node for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "Analysis"
    )
    keywords = {keyword.arg: keyword.value for keyword in analysis.keywords}
    assert ast.literal_eval(keywords["pathex"]) == []
    assert ast.literal_eval(keywords["hiddenimports"]) == []
    spec = spec_path.read_text(encoding="utf-8").lower()
    for module in ("stdlib_module_names", "pyside6", "shiboken6", "matplotlib"):
        assert module not in spec
    assert "backend_site_packages" not in spec


def test_source_bootstrap_runs_live_backend_as_child_and_returns_exit_code():
    source = ROOT / "packaging" / "source_launch.pyw"
    namespace = runpy.run_path(str(source))
    work_parent = ROOT / "runtime" / "source-launcher-work"
    work_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work_parent) as temporary:
        source_root = Path(temporary)
        launcher = source_root / "app" / "launcher.py"
        launcher.parent.mkdir()
        launcher.write_text("# live launcher test fixture\n", encoding="utf-8")
        backend = source_root / "python.exe"
        backend.write_bytes(b"fake backend")
        expected_environment = os.environ.copy()
        expected_environment["TIKREADER_SOURCE_ROOT"] = str(source_root)
        expected_environment["TIKREADER_SOURCE_BACKEND_PYTHON"] = str(backend)
        expected_environment["TIKREADER_TEST_INHERITED"] = "preserved"
        process = Mock()
        process.wait.return_value = 0

        with patch.dict(os.environ, expected_environment, clear=True), patch.object(
            namespace["subprocess"], "Popen", return_value=process
        ) as popen:
            exit_code = namespace["main"]()

        popen.assert_called_once()
        command = popen.call_args.args[0]
        options = popen.call_args.kwargs
        assert command == [str(backend.resolve()), str(launcher.resolve())]
        assert options["cwd"] == source_root.resolve()
        assert options["env"]["TIKREADER_TEST_INHERITED"] == "preserved"
        assert options["creationflags"] == namespace["_child_creation_flags"]()
        process.wait.assert_called_once_with()
        assert exit_code == 0

        process.reset_mock()
        process.wait.return_value = 37
        message_box = Mock()
        fake_windll = SimpleNamespace(user32=SimpleNamespace(MessageBoxW=message_box))
        with patch.dict(os.environ, expected_environment, clear=True), patch.object(
            namespace["subprocess"], "Popen", return_value=process
        ), patch.object(namespace["ctypes"], "windll", fake_windll, create=True):
            # The executable wrapper must propagate the backend result even
            # while separately reporting its nonzero completion.
            try:
                runpy.run_path(str(source), run_name="__main__")
            except SystemExit as exc:
                assert exc.code == 37
            else:
                raise AssertionError("The branded parent must propagate the backend exit code")
        log_path = source_root / "runtime" / "source-launcher-error.log"
        assert "37" in log_path.read_text(encoding="utf-8")
        message_box.assert_called_once()


def test_source_bootstrap_uses_platform_correct_no_console_flag():
    namespace = runpy.run_path(str(ROOT / "packaging" / "source_launch.pyw"))
    no_console = 0x08000000
    with patch.object(namespace["subprocess"], "CREATE_NO_WINDOW", no_console, create=True):
        assert namespace["_child_creation_flags"]("nt") == no_console
        assert namespace["_child_creation_flags"]("posix") == 0


def test_nonzero_backend_exit_is_logged_and_reported_to_gui():
    source = ROOT / "packaging" / "source_launch.pyw"
    namespace = runpy.run_path(str(source))
    work_parent = ROOT / "runtime" / "source-launcher-work"
    work_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work_parent) as temporary:
        source_root = Path(temporary)
        launcher = source_root / "app" / "launcher.py"
        launcher.parent.mkdir()
        launcher.write_text("# failure fixture\n", encoding="utf-8")
        backend = source_root / "python.exe"
        backend.write_bytes(b"fake backend")
        child = Mock()
        child.wait.return_value = 17
        message_box = Mock()
        fake_windll = SimpleNamespace(user32=SimpleNamespace(MessageBoxW=message_box))
        env = {
            "TIKREADER_SOURCE_ROOT": str(source_root),
            "TIKREADER_SOURCE_BACKEND_PYTHON": str(backend),
        }
        with patch.dict(os.environ, env, clear=True), patch.object(
            namespace["subprocess"], "Popen", return_value=child
        ), patch.object(namespace["ctypes"], "windll", fake_windll, create=True):
            exit_code = namespace["main"]()

        log_path = source_root / "runtime" / "source-launcher-error.log"
        assert exit_code == 17
        assert log_path.is_file()
        assert "17" in log_path.read_text(encoding="utf-8")
        message_box.assert_called_once()


def test_source_spec_resolves_repo_root_from_packaging_spec_directory():
    spec_path = ROOT / "packaging" / "TikReaderSource.spec"
    tree = ast.parse(spec_path.read_text(encoding="utf-8"), filename=str(spec_path))
    assignments = []
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            assignments.append(node)
        elif isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id in {"ROOT", "ICON", "VERSION"}
            for target in node.targets
        ):
            assignments.append(node)
    namespace = {"SPECPATH": str(ROOT / "packaging")}
    exec(compile(ast.Module(body=assignments, type_ignores=[]), str(spec_path), "exec"), namespace)

    assert namespace["ROOT"] == ROOT.resolve()
    assert namespace["ICON"] == ROOT / "assets" / "icons" / "tikreader.ico"
    assert namespace["VERSION"] == ROOT / "packaging" / "TikReaderVersion.txt"


def test_source_bootstrap_requires_paths_and_delegates_to_live_launcher():
    bootstrap = (ROOT / "packaging" / "source_launch.pyw").read_text(encoding="utf-8")
    normalized = bootstrap.lower()

    for env_name in (
        "tikreader_source_root",
        "tikreader_source_backend_python",
    ):
        assert env_name in normalized
    assert "subprocess.popen" in normalized
    assert "process.wait()" in normalized
    assert "importlib" not in normalized
    assert "launcher.py" in normalized
    assert "is_dir()" in normalized or "is_file()" in normalized


def test_source_bootstrap_logs_fatal_traceback_and_returns_nonzero():
    source = ROOT / "packaging" / "source_launch.pyw"
    source_text = source.read_text(encoding="utf-8")
    tree = ast.parse(source_text, filename=str(source))
    assert any(
        isinstance(node, ast.FunctionDef) and node.name == "_handle_startup_failure"
        for node in tree.body
    )
    namespace = runpy.run_path(str(source))
    work_parent = ROOT / "runtime" / "source-launcher-work"
    work_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work_parent) as temporary:
        message_box = Mock()
        fake_windll = SimpleNamespace(user32=SimpleNamespace(MessageBoxW=message_box))
        with patch.dict(os.environ, {"TIKREADER_SOURCE_ROOT": temporary}), patch.object(
            namespace["ctypes"], "windll", fake_windll, create=True
        ):
            exit_code = namespace["_handle_startup_failure"](
                RuntimeError("bootstrap failed"),
                "Traceback (most recent call last):\\nRuntimeError: bootstrap failed\\n",
            )

        log_path = Path(temporary) / "runtime" / "source-launcher-error.log"
        assert exit_code == 1
        assert log_path.is_file()
        assert "RuntimeError: bootstrap failed" in log_path.read_text(encoding="utf-8")
        message_box.assert_called_once()
    assert "raise SystemExit(_handle_startup_failure(" in source_text


def test_build_helper_tracks_freshness_and_uses_selected_backend():
    helper = ROOT / "tools" / "build_source_launcher.py"
    source = helper.read_text(encoding="utf-8")
    normalized = source.lower()

    assert "tikreadersource.spec" in normalized
    assert "source_launch.pyw" in normalized
    assert "tikreaderversion.txt" in normalized
    assert "tikreader.ico" in normalized
    assert "sha256" in normalized
    assert "runtime" in normalized
    assert "source-launcher-tools" in normalized
    assert "tikreader_pyinstaller_tools" in normalized
    assert "source_backend_python" in normalized
    assert "pyinstaller" in normalized
    assert "subprocess" in normalized
    assert "actionable" in normalized or "install pyinstaller" in normalized or "pip install" in normalized


def test_build_helper_uses_local_pyinstaller_tools_when_backend_has_none():
    helper = runpy.run_path(str(ROOT / "tools" / "build_source_launcher.py"))
    backend = Path(sys.executable)
    assert helper["DEFAULT_PYINSTALLER_TOOLS"] == ROOT / "runtime" / "source-launcher-tools"
    work_parent = ROOT / "runtime" / "source-launcher-work"
    work_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work_parent) as temporary:
        tool_root = Path(temporary) / "source-launcher-tools"
        package = tool_root / "PyInstaller"
        package.mkdir(parents=True)
        (package / "__main__.py").write_text("", encoding="utf-8")
        with patch.dict(os.environ, {helper["PYINSTALLER_TOOLS_ENV"]: str(tool_root)}):
            resolved = helper["_resolve_pyinstaller_tools"]()
        assert resolved == tool_root.resolve()

        calls = []

        def fake_run(command, **kwargs):
            calls.append((command, kwargs))
            return subprocess.CompletedProcess(command, 1 if len(calls) == 1 else 0, stdout="6.20.0")

        with patch.object(helper["subprocess"], "run", side_effect=fake_run):
            probe, environment, source = helper["_probe_pyinstaller"](backend, resolved)

        assert probe.returncode == 0
        assert source == "local"
        assert calls[0][0] == calls[1][0] == [str(backend), "-m", "PyInstaller", "--version"]
        assert environment["PYTHONPATH"].split(os.pathsep)[0] == str(resolved)


def test_build_helper_fails_visibly_without_backend_or_local_pyinstaller():
    helper = runpy.run_path(str(ROOT / "tools" / "build_source_launcher.py"))
    backend = Path(sys.executable)
    completed = subprocess.CompletedProcess([], 1, stderr="No module named PyInstaller")
    with patch.object(helper["subprocess"], "run", return_value=completed):
        try:
            helper["_probe_pyinstaller"](backend, None)
        except RuntimeError as exc:
            assert "PyInstaller" in str(exc)
            assert "no python ui fallback" in str(exc).lower()
        else:
            raise AssertionError("Missing PyInstaller sources must stop launcher builds visibly")


def test_build_helper_preserves_active_target_when_atomic_promotion_is_locked():
    helper = runpy.run_path(str(ROOT / "tools" / "build_source_launcher.py"))
    work_parent = ROOT / "runtime" / "source-launcher-work"
    work_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work_parent) as temporary:
        root = Path(temporary)
        target = root / "TikReader"
        staged = root / "staged" / "TikReader"
        (target / "_internal").mkdir(parents=True)
        (target / "TikReader.exe").write_bytes(b"active executable")
        (target / "_internal" / "libffi-8.dll").write_bytes(b"locked dll bytes")
        (target / ".source-launcher.sha256").write_bytes(b"old fingerprint")
        staged.mkdir(parents=True)
        (staged / "TikReader.exe").write_bytes(b"new executable")
        before = {path.relative_to(target): path.read_bytes() for path in target.rglob("*") if path.is_file()}
        real_replace = helper["os"].replace

        def reject_active_target(source, destination):
            if Path(source) == target:
                raise PermissionError("target is in use")
            return real_replace(source, destination)

        with patch.object(helper["os"], "replace", side_effect=reject_active_target):
            try:
                helper["_promote_staged_directory"](staged, target)
            except RuntimeError as exc:
                assert "close tikreader" in str(exc).lower()
            else:
                raise AssertionError("An active target must block promotion")

        after = {path.relative_to(target): path.read_bytes() for path in target.rglob("*") if path.is_file()}
        assert after == before
        assert (staged / "TikReader.exe").read_bytes() == b"new executable"


def test_build_helper_promotes_complete_staged_output():
    helper = runpy.run_path(str(ROOT / "tools" / "build_source_launcher.py"))
    work_parent = ROOT / "runtime" / "source-launcher-work"
    work_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work_parent) as temporary:
        root = Path(temporary)
        target = root / "TikReader"
        staged = root / "staged" / "TikReader"
        (target / "_internal").mkdir(parents=True)
        (target / "TikReader.exe").write_bytes(b"old executable")
        (target / "_internal" / "runtime.dll").write_bytes(b"old runtime")
        staged.mkdir(parents=True)
        (staged / "TikReader.exe").write_bytes(b"new executable")
        (staged / "_internal").mkdir()
        (staged / "_internal" / "runtime.dll").write_bytes(b"new runtime")
        (staged / ".source-launcher.sha256").write_text("new fingerprint", encoding="ascii")

        helper["_promote_staged_directory"](staged, target)

        assert (target / "TikReader.exe").read_bytes() == b"new executable"
        assert (target / "_internal" / "runtime.dll").read_bytes() == b"new runtime"
        assert (target / ".source-launcher.sha256").read_text(encoding="ascii") == "new fingerprint"
        assert not staged.exists()
        assert not list(root.glob(".TikReader-backup-*"))


def test_build_helper_retries_transient_rollback_failure_without_losing_target():
    helper = runpy.run_path(str(ROOT / "tools" / "build_source_launcher.py"))
    work_parent = ROOT / "runtime" / "source-launcher-work"
    work_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work_parent) as temporary:
        root = Path(temporary)
        target = root / "TikReader"
        staged = root / "staged" / "TikReader"
        target.mkdir(parents=True)
        (target / "TikReader.exe").write_bytes(b"original executable")
        (target / "_internal.dll").write_bytes(b"original runtime")
        staged.mkdir(parents=True)
        (staged / "TikReader.exe").write_bytes(b"candidate executable")
        real_replace = helper["os"].replace
        calls = 0

        def fail_candidate_and_one_rollback(source, destination):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("temporary promotion failure")
            if calls == 3:
                raise OSError("temporary rollback failure")
            return real_replace(source, destination)

        with patch.object(helper["os"], "replace", side_effect=fail_candidate_and_one_rollback):
            try:
                helper["_promote_staged_directory"](staged, target)
            except RuntimeError as exc:
                assert "restored" in str(exc).lower()
            else:
                raise AssertionError("A failed promotion must report after restoring the previous target")

        assert calls == 4
        assert (target / "TikReader.exe").read_bytes() == b"original executable"
        assert (target / "_internal.dll").read_bytes() == b"original runtime"
        assert not list(root.glob(".TikReader-backup-*"))
