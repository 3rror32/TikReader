"""Exercise the bundled Python with fresh data and without system Python on PATH."""
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
PAYLOAD = ROOT / 'release' / 'TikReader'
DATA = ROOT / 'release' / ('validation-data-' + str(time.time_ns()))
URL = 'http://127.0.0.1:5198'


def api(path, data=None):
    req = urllib.request.Request(URL + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json'} if data is not None else {})
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.load(response)


def start(log):
    environment = {**os.environ, 'TIKREADER_DATA_DIR': str(DATA), 'TIKREADER_PORT': '5198',
                   'TIKREADER_LAN': '0', 'PATH': os.environ.get('SystemRoot', 'C:/Windows') + '/System32',
                   'PYTHONPATH': '', 'PYTHONHOME': ''}
    process = subprocess.Popen([str(PAYLOAD / 'python' / 'python.exe'), '-B', str(PAYLOAD / 'app' / 'server.py')],
        cwd=PAYLOAD, env=environment, stdout=log, stderr=log,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    for _ in range(40):
        if process.poll() is not None:
            raise RuntimeError('El paquete no arrancó; revisa validation-server.log')
        try:
            if api('/health')['application'] == 'TikReader':
                return process
        except OSError:
            time.sleep(.5)
    process.terminate()
    process.wait(10)
    raise RuntimeError('Arranque agotó el tiempo de espera.')


def main():
    report = {'scope': 'Paquete aislado en el equipo de desarrollo; no sustituye Windows limpio.', 'checks': []}
    process = None
    if DATA.exists():
        raise RuntimeError('La carpeta de validación ya existe; usa una carpeta nueva para validar instalación limpia.')
    try:
        with (ROOT / 'release' / 'validation-server.log').open('w', encoding='utf-8') as log:
            process = start(log)
            report['checks'].append('Inicio con Python incluido y sin Python del sistema en PATH')
            assert api('/version')['app_version'] == '1.0.0.8'
            assert api('/microphone-captions/engine')['available']
            report['checks'].append('Motor Vosk y modelo español incluidos')
            assert not api('/local-tts')['ready']
            api('/system/preferences', {'tikreader.skin': 'light', 'tikreader.preferences': '{"tts-rate":1.1}'})
            report['checks'].append('Guardado de preferencias en carpeta externa')
            diagnostics = api('/diagnostics/export')
            assert 'username' not in diagnostics and 'version' in diagnostics
            report['checks'].append('Diagnóstico con campos permitidos')
            api('/system/exit', {'confirm': True})
            assert process.wait(15) == 0
            report['checks'].append('Cierre completo del servidor')
            process = start(log)
            assert api('/system/preferences')['values']['tikreader.skin'] == 'light'
            assert api('/health')['archive']['integrity'] == 'ok'
            report['checks'].append('Reapertura conserva preferencias y base íntegra')
            api('/system/exit', {'confirm': True})
            assert process.wait(15) == 0
            report['passed'] = True
    finally:
        if process and process.poll() is None:
            process.terminate()
            process.wait(15)
        (ROOT / 'release' / 'validation-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
