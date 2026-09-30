"""Diagnóstico previo sin modificar el equipo ni iniciar servicios."""
from __future__ import annotations

import importlib.util
import shutil
import socket
import sys
from dataclasses import asdict, dataclass


@dataclass
class Check:
    name: str
    ok: bool
    detail: str
    action: str = ""


def run(config) -> dict:
    checks = []
    version_ok = sys.version_info >= (3, 10)
    checks.append(Check('python', version_ok, sys.version.split()[0],
                        'Instala Python 3.10 o posterior.' if not version_ok else ''))
    packages = [('Flask', 'flask'), ('Flask-SocketIO', 'flask_socketio'),
                ('TikTokLive', 'TikTokLive'), ('simple-websocket', 'simple_websocket'),
                ('PySide6-Essentials', 'PySide6'), ('PySide6-Addons', 'PySide6.QtWebEngineWidgets')]
    missing = [label for label, module in packages if importlib.util.find_spec(module) is None]
    checks.append(Check('dependencies', not missing,
                        'Disponibles' if not missing else 'Faltan: ' + ', '.join(missing),
                        'Ejecuta tools/Instalar TikReader.cmd.' if missing else ''))
    node = shutil.which('node')
    checks.append(Check('node', bool(node), node or 'No encontrado',
                        'Node solo es necesario para ejecutar las pruebas del navegador.' if not node else ''))
    with socket.socket() as probe:
        occupied = probe.connect_ex(('127.0.0.1', config.port)) == 0
    checks.append(Check('port', not occupied, f'Puerto {config.port} ' + ('ocupado' if occupied else 'disponible'),
                        'Cierra el servicio que usa el puerto o configura TIKREADER_PORT.' if occupied else ''))
    checks.append(Check('network_mode', True,
                        'LAN habilitada' if config.lan_enabled else 'Solo este equipo'))
    payload = {'ok': all(c.ok for c in checks if c.name != 'node'),
               'checks': [asdict(c) for c in checks]}
    return payload
