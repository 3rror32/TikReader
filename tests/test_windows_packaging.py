import ast
from pathlib import Path
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]


def test_pyinstaller_spec_resolves_all_inputs_from_the_repository_root():
    spec_path = ROOT / "packaging" / "TikReader.spec"
    tree = ast.parse(spec_path.read_text(encoding="utf-8"), filename=str(spec_path))
    setup = [
        node for node in tree.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id in {"ROOT", "PAYLOAD", "ICON", "VERSION"}
                for target in node.targets)
    ]
    namespace = {"Path": Path, "SPECPATH": str(spec_path.parent)}
    exec(compile(ast.Module(body=setup, type_ignores=[]), str(spec_path), "exec"), namespace)

    assert namespace["ROOT"] == ROOT
    assert namespace["PAYLOAD"] == ROOT / "release" / "TikReader"
    assert namespace["ICON"] == ROOT / "assets" / "icons" / "tikreader.ico"
    assert namespace["VERSION"] == ROOT / "packaging" / "TikReaderVersion.txt"


def test_installer_build_copies_the_entire_onedir_distribution():
    build_script = ROOT / "packaging" / "build_installer.ps1"
    powershell = shutil.which("pwsh.exe") or shutil.which("powershell.exe")
    assert powershell, "PowerShell is required to exercise the installer copy function."
    with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
        temporary_path = Path(temporary)
        source = temporary_path / "onedir"
        destination = temporary_path / "payload"
        (source / "_internal" / "nested").mkdir(parents=True)
        (source / "TikReader.exe").write_bytes(b"branded launcher")
        (source / "_internal" / "python.dll").write_bytes(b"runtime")
        (source / "_internal" / "nested" / "qtwebengine.dll").write_bytes(b"qt runtime")
        quote = lambda value: str(value).replace("'", "''")
        command = rf"""
$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile('{quote(build_script)}', [ref]$tokens, [ref]$errors)
if ($errors.Count) {{ throw $errors[0].Message }}
$definition = $ast.Find({{ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Copy-LauncherDistribution' }}, $true)
if (-not $definition) {{ throw 'Copy-LauncherDistribution function is missing.' }}
. ([scriptblock]::Create($definition.Extent.Text))
Copy-LauncherDistribution -SourcePath '{quote(source)}' -DestinationPath '{quote(destination)}'
"""
        result = subprocess.run(
            [powershell, "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stdout + result.stderr

        source_files = {path.relative_to(source) for path in source.rglob("*") if path.is_file()}
        destination_files = {path.relative_to(destination) for path in destination.rglob("*") if path.is_file()}
        assert destination_files == source_files
        for relative in source_files:
            assert (destination / relative).read_bytes() == (source / relative).read_bytes()


def test_pyinstaller_definition_brands_the_launcher_executable():
    spec = ROOT / "packaging" / "TikReader.spec"
    version = ROOT / "packaging" / "TikReaderVersion.txt"

    assert spec.is_file()
    assert version.is_file()
    spec_text = spec.read_text(encoding="utf-8")
    version_text = version.read_text(encoding="utf-8")

    assert "desktop_launch.pyw" in spec_text
    assert "TikReader" in spec_text
    assert "tikreader.ico" in spec_text
    assert "TikReaderVersion.txt" in spec_text
    assert "console=False" in spec_text
    assert "excludes=APP_MODULES" in spec_text
    for value in ("ProductName", "FileDescription", "OriginalFilename", "TikReader.exe"):
        assert value in version_text


def test_installer_shortcuts_and_postinstall_run_branded_executable():
    installer = (ROOT / "packaging" / "TikReader.iss").read_text(encoding="utf-8")

    icons = installer.split("[Icons]", 1)[1].split("[Run]", 1)[0]
    run = installer.split("[Run]", 1)[1].split("[Code]", 1)[0]
    assert icons.count('Filename: "{app}\\TikReader.exe"') == 2
    assert 'Filename: "{app}\\TikReader.exe"' in run
    assert 'Filename: "{app}\\python\\pythonw.exe"' not in icons + run


def test_frozen_launcher_uses_embedded_python_only_for_backend_child():
    launcher = (ROOT / "packaging" / "desktop_launch.pyw").read_text(encoding="utf-8")

    assert "getattr(sys, 'frozen', False)" in launcher
    assert "Path(sys.executable).resolve().parent" in launcher
    assert "root / 'python' / 'python.exe'" in launcher
    assert "root / 'python' / 'Lib' / 'site-packages'" in launcher
    assert "python.exe" in launcher
    assert "launch()" in launcher


def test_installer_build_runs_pyinstaller_before_compiling_setup():
    build = (ROOT / "packaging" / "build_installer.ps1").read_text(encoding="utf-8")

    assert "PyInstaller" in build
    assert "TikReader.spec" in build
