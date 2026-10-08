# PyInstaller spec for the branded desktop process. The target payload is
# assembled first so the launcher can use its embedded Python environment.
from pathlib import Path

ROOT = Path(SPECPATH).resolve().parent
PAYLOAD = ROOT / 'release' / 'TikReader'
ICON = ROOT / 'assets' / 'icons' / 'tikreader.ico'
VERSION = ROOT / 'packaging' / 'TikReaderVersion.txt'
# Keep the application's existing files beside the executable: their ROOT
# constants and asset paths are intentionally based on their on-disk location.
APP_MODULES = [path.stem for path in (ROOT / 'app').glob('*.py')]

a = Analysis(
    [str(ROOT / 'packaging' / 'desktop_launch.pyw')],
    pathex=[str(ROOT / 'app'), str(PAYLOAD / 'python' / 'Lib' / 'site-packages')],
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
    name='TikReader',
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
COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='TikReader',
)
