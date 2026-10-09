"""Safe local launcher: dependencies, single launch lock, health check, no forced termination."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error
import webbrowser
from app_config import runtime_config
from preflight import run as run_preflight
from app_paths import data_dir, installed

ROOT=Path(__file__).resolve().parent.parent
CONFIG=runtime_config()
URL=CONFIG.local_url
CHILD_LOG_MAX_BYTES = 2 * 1024 * 1024
CHILD_LOG_BACKUPS = 4


def rotate_child_log(path, max_bytes=CHILD_LOG_MAX_BYTES, backups=CHILD_LOG_BACKUPS):
    """Keep only a bounded recent tail of redirected child output."""
    path = Path(path)
    try:
        if not path.is_file() or path.stat().st_size < max_bytes:
            return False
        with path.open('rb') as source:
            source.seek(-max_bytes, os.SEEK_END)
            recent = source.read(max_bytes)
        oldest = path.with_name(path.name + f'.{backups}')
        if oldest.exists():
            oldest.unlink()
        for index in range(backups - 1, 0, -1):
            source = path.with_name(path.name + f'.{index}')
            if source.exists():
                source.replace(path.with_name(path.name + f'.{index + 1}'))
        backup = path.with_name(path.name + '.1')
        temporary = path.with_name(path.name + '.1.tmp')
        temporary.write_bytes(recent)
        temporary.replace(backup)
        path.unlink()
        return True
    except OSError:
        # Logging must never prevent the application from starting.
        return False

def health():
    try:
        with urllib.request.urlopen(URL+'/health',timeout=2) as response:
            payload=json.load(response)
            return isinstance(payload,dict) and payload.get('application')=='TikReader'
    except (OSError,ValueError):
        return False

def dependencies():
    packages = [('Flask','flask'),('Flask-SocketIO','flask_socketio'),
                ('TikTokLive','TikTokLive'),('simple-websocket','simple_websocket')]
    return [package for package,module in packages if importlib.util.find_spec(module) is None]

def _create_startup_splash():
    from startup_splash import show_startup_splash
    return show_startup_splash(ROOT)

def _wait_with_splash(seconds, splash=None):
    """Keep the Qt splash responsive while preserving the launch polling cadence."""
    deadline = time.monotonic() + max(0.0, float(seconds))
    while time.monotonic() < deadline:
        if splash is not None:
            splash.pump()
        time.sleep(min(.04, max(0.0, deadline - time.monotonic())))

def _health_with_splash(splash=None):
    """Run a potentially blocking health request without freezing the splash."""
    if splash is None:
        return health()
    outcome = {'healthy': False}

    def check():
        outcome['healthy'] = health()

    worker = threading.Thread(target=check, name='TikReader startup health check', daemon=True)
    worker.start()
    while worker.is_alive():
        splash.pump()
        worker.join(.03)
    splash.pump()
    return outcome['healthy']

def launch(open_browser=None):
    missing=dependencies()
    if open_browser is None and (importlib.util.find_spec('PySide6') is None or
            importlib.util.find_spec('PySide6.QtWebEngineWidgets') is None):
        missing.append('PySide6 con Qt WebEngine')
    if missing:
        action = 'Vuelve a ejecutar el instalador de TikReader.' if installed(ROOT) else 'Ejecuta: python -m pip install -r requirements.txt'
        raise RuntimeError('Faltan: '+', '.join(missing)+'. '+action)
    native_run = None
    if open_browser is None:
        # Importing Qt WebEngine can briefly monopolize the Python thread. Do
        # that before displaying the splash so its busy indicator never stalls.
        from desktop_window import run as native_run
    splash = _create_startup_splash() if native_run is not None else None
    try:
        if splash is not None:
            splash.set_status('Comprobando el servicio local…')
        lock_path=data_dir(ROOT)/'launcher.lock';lock_path.parent.mkdir(parents=True,exist_ok=True)
        with open(lock_path,'a+b') as lock:
            lock.seek(0);lock.write(b'0');lock.flush();lock.seek(0)
            if os.name=='nt':
                import msvcrt
                try:
                    msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
                except OSError:
                    raise RuntimeError('Otro lanzador está iniciando TikReader. Espera unos segundos.')
            try:
                if _health_with_splash(splash):
                    print('TikReader ya está funcionando. No se crea otro servidor.')
                    if splash is not None:
                        splash.set_status('Servicio listo · abriendo el estudio…')
                else:
                    if splash is not None:
                        splash.set_status('Iniciando el motor de TikReader…')
                    import socket
                    with socket.socket() as probe:
                        if probe.connect_ex(('127.0.0.1',CONFIG.port))==0:
                            raise RuntimeError(f'El puerto {CONFIG.port} está ocupado por un servicio no identificado o una versión anterior. No se detuvo ningún proceso.')
                    log_dir=data_dir(ROOT)/'logs';log_dir.mkdir(parents=True,exist_ok=True)
                    stamp=time.strftime('%Y-%m-%d')
                    output_log=log_dir/f'launcher-{stamp}-output.log';error_log=log_dir/f'launcher-{stamp}-error.log'
                    rotate_child_log(output_log);rotate_child_log(error_log)
                    child_env = os.environ.copy()
                    child_env.setdefault('PYTHONPYCACHEPREFIX', str(data_dir(ROOT) / 'pycache'))
                    with open(output_log,'ab') as out,open(error_log,'ab') as err:
                        child=subprocess.Popen([sys.executable,'-u',str(ROOT/'app'/'server.py')],cwd=ROOT,stdout=out,stderr=err,
                                               env=child_env,
                                               creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                    for _ in range(40):
                        if _health_with_splash(splash):
                            print('Servidor listo.')
                            if splash is not None:
                                splash.set_status('Servicio listo · preparando la interfaz…')
                            break
                        if child.poll() is not None:
                            raise RuntimeError(f'El servidor terminó al iniciar. Revisa data/logs/launcher-{stamp}-error.log.')
                        _wait_with_splash(.5, splash)
                    else:
                        raise RuntimeError(f'El servidor no confirmó disponibilidad. Revisa data/logs/launcher-{stamp}-error.log antes de reintentar.')
            finally:
                if os.name=='nt':
                    lock.seek(0);msvcrt.locking(lock.fileno(),msvcrt.LK_UNLCK,1)
        if open_browser is True:
            webbrowser.open(URL)
        elif open_browser is None:
            if splash is not None:
                splash.set_status('Cargando el estudio en vivo…')
                splash.pump()
            return native_run(URL, startup_splash=splash)
        return URL
    except Exception:
        if splash is not None:
            splash.close_immediately()
        raise

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--no-browser',action='store_true',help='Inicia solo el servicio local')
    parser.add_argument('--browser',action='store_true',help='Abre temporalmente la interfaz anterior')
    parser.add_argument('--check',action='store_true');args=parser.parse_args()
    try:
        if args.check:
            report=run_preflight(CONFIG);report['server_healthy']=health()
            if report['server_healthy']:
                for check in report['checks']:
                    if check['name']=='port':
                        check.update(ok=True,detail=f'TikReader ya está activo en el puerto {CONFIG.port}',action='')
                report['ok']=all(check['ok'] for check in report['checks'] if check['name']!='node')
            print(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(not report['ok'])
        mode = True if args.browser else False if args.no_browser else None
        result = launch(mode)
        if mode is not None:
            print(result)
    except Exception as exc:
        print('ERROR:',exc,file=sys.stderr);sys.exit(1)
