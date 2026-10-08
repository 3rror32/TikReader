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


def test_source_starter_uses_branded_executable_without_python_ui_fallback():
    starter = (ROOT / "Iniciar TikReader.cmd").read_text(encoding="utf-8")
    normalized = starter.lower()

    assert "source-launcher\\tikreader\\tikreader.exe" in normalized
    assert "source_backend_python" in normalized
    assert "source_backend_site_packages" in normalized
    assert ".venv\\scripts\\python.exe" in normalized
    assert "tools\\build_source_launcher.py" in normalized
    assert 'start "" /wait /b "%source_launcher%"' in normalized
    assert not re.search(r"start[^\r\n]*python(?:\.exe)?[^\r\n]*launcher\.py", normalized)
    assert not re.search(r"start[^\r\n]*py\s+-3[^\r\n]*launcher\.py", normalized)


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
        process.wait.return_value = 23

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
        process.wait.assert_called_once_with()
        assert exit_code == 23

        process.reset_mock()
        process.wait.return_value = 37
        with patch.dict(os.environ, expected_environment, clear=True), patch.object(
            namespace["subprocess"], "Popen", return_value=process
        ):
            try:
                runpy.run_path(str(source), run_name="__main__")
            except SystemExit as exc:
                assert exc.code == 37
            else:
                raise AssertionError("The branded parent must propagate the backend exit code")


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
