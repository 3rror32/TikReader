"""Load the creator update only while the exact workspace server is disconnected."""
import json
import sqlite3
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen
import psutil

ROOT=Path(__file__).resolve().parent.parent


def main():
    process=psutil.Process(int(sys.argv[1]))
    expected=(ROOT/'app'/'server.py').resolve()
    args=process.cmdline()
    if Path(process.cwd()).resolve()!=ROOT or not any(Path(arg).resolve()==expected for arg in args[1:] if arg.endswith('.py')):
        raise RuntimeError('El proceso no corresponde a este proyecto')
    with urlopen('http://127.0.0.1:5000/status',timeout=5) as response:
        status=json.load(response)
    if status.get('connected') or status.get('connecting'):
        raise RuntimeError('Hay una conexión TikTok activa; no se reinició')
    stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
    backup=ROOT/'data'/'backups'/f'before-creator-update-{stamp}.sqlite3'
    backup.parent.mkdir(exist_ok=True)
    source=sqlite3.connect(str(ROOT/'data'/'history.sqlite3'))
    destination=sqlite3.connect(str(backup))
    try:
        source.backup(destination)
    finally:
        source.close()
        destination.close()
    # Check again after the backup, immediately before stopping the process.
    with urlopen('http://127.0.0.1:5000/status',timeout=5) as response:
        status=json.load(response)
    if status.get('connected') or status.get('connecting'):
        raise RuntimeError('TikTok se conectó durante el respaldo; no se reinició')
    process.terminate()
    process.wait(timeout=15)
    log=ROOT/'runtime'/'creator-server-start.log'
    with log.open('ab') as output:
        child=subprocess.Popen([args[0],'-u',str(expected)],cwd=ROOT,stdin=subprocess.DEVNULL,
            stdout=output,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    for _ in range(30):
        time.sleep(.5)
        if child.poll() is not None:
            raise RuntimeError('Revisa runtime/creator-server-start.log: el servidor no inició')
        try:
            with urlopen('http://127.0.0.1:5000/creator-api/catalog',timeout=2) as response:
                catalog=json.load(response)
            print(json.dumps(dict(ok=True,process=child.pid,backup=str(backup),widgets=len(catalog['widgets']),profiles=len(catalog['profiles']))))
            return
        except OSError:
            pass
    raise RuntimeError('No se pudo confirmar el arranque; consulta el registro')


if __name__=='__main__':
    main()
