"""Start only the isolated release preview; does not touch the active LIVE."""
from pathlib import Path
import os
import subprocess
import socket

root = Path(__file__).resolve().parent.parent
port = 5199
with socket.socket() as probe:
    if probe.connect_ex(('127.0.0.1', port)) == 0:
        raise SystemExit('La vista de prueba ya está abierta.')
environment = {**os.environ, 'TIKREADER_DATA_DIR': str(root / 'release' / 'preview-data'),
               'TIKREADER_PORT': str(port), 'TIKREADER_LAN': '0', 'PYTHONPATH': '', 'PYTHONHOME': ''}
with (root / 'release' / 'preview.log').open('a', encoding='utf-8') as log:
    process = subprocess.Popen([str(root / 'release' / 'TikReader' / 'python' / 'python.exe'), '-B',
                               str(root / 'release' / 'TikReader' / 'app' / 'server.py')],
        env=environment, cwd=root / 'release' / 'TikReader', stdout=log, stderr=log,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
print(process.pid)
