"""Entry point for the branded Windows app and its bundled Python runtime."""
import ctypes
from pathlib import Path
import sys
sys.dont_write_bytecode = True

frozen = bool(getattr(sys, 'frozen', False))
root = Path(sys.executable).resolve().parent if frozen else Path(__file__).resolve().parent
sys.path.insert(0, str(root / 'app'))
if frozen:
    # The embedded runtime owns the application's native wheels, including Qt.
    sys.path.insert(0, str(root / 'python' / 'Lib' / 'site-packages'))
try:
    from launcher import launch
    if frozen:
        # Keep the UI in TikReader.exe while the local server uses the bundled
        # Python runtime instead of restarting this frozen launcher.
        runtime = root / 'python' / 'python.exe'
        if not runtime.is_file():
            raise RuntimeError('No se encontró el entorno de Python incluido con TikReader.')
        sys.executable = str(runtime)
    launch()
except Exception as exc:
    ctypes.windll.user32.MessageBoxW(None, str(exc), 'TikReader · No se pudo iniciar', 0x10)
