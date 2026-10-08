from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


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
