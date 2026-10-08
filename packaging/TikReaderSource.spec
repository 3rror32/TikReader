# Branded source-workflow UI executable; application modules remain live files.
import os
from pathlib import Path

ROOT = Path(SPECPATH).resolve().parent
BACKEND_PYTHON = Path(os.environ["TIKREADER_SOURCE_BACKEND_PYTHON"]).resolve()
ICON = ROOT / "assets" / "icons" / "tikreader.ico"
VERSION = ROOT / "packaging" / "TikReaderVersion.txt"
APP_MODULES = [path.stem for path in (ROOT / "app").glob("*.py")]

if not BACKEND_PYTHON.is_file():
    raise RuntimeError("The selected source backend Python is unavailable.")
if not ICON.is_file() or not VERSION.is_file():
    raise RuntimeError("The TikReader icon or version resource is missing.")

a = Analysis(
    [str(ROOT / "packaging" / "source_launch.pyw")],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=APP_MODULES,
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="TikReader",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(ICON),
    version=str(VERSION),
)
COLLECT(exe, a.binaries, a.datas, strip=False, upx=True, upx_exclude=[], name="TikReader")
