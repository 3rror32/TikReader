"""Entry point launched by the bundled pythonw; no console or system Python."""
import ctypes
from pathlib import Path
import sys
sys.dont_write_bytecode = True

root = Path(__file__).resolve().parent
sys.path.insert(0, str(root / 'app'))
try:
    from launcher import launch
    launch()
except Exception as exc:
    ctypes.windll.user32.MessageBoxW(None, str(exc), 'TikReader · No se pudo iniciar', 0x10)
