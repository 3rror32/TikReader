"""Offline, verified recovery of the complete database and user media."""
import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
import time
import uuid
import zipfile
from pathlib import Path, PurePosixPath
from contextlib import contextmanager, closing

from app_config import _port
from app_paths import data_dir, voice_models_dir
from runtime_guard import InstanceGuard

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = ('media', 'alert_media', 'voice_models')


def data_target(root, name):
    p = PurePosixPath(name)
    return voice_models_dir(root).joinpath(*p.parts[1:]) if p.parts[0] == 'voice_models' else (data_dir(root) / name)


def allowed(name):
    p = PurePosixPath(name)
    return (name == 'history.sqlite3' or len(p.parts) >= 2 and p.parts[0] in FOLDERS) and not (
        p.is_absolute() or '..' in p.parts or '\\' in name or ':' in name)


def digest(path):
    with path.open('rb') as stream:
        result=hashlib.sha256()
        for chunk in iter(lambda:stream.read(1024*1024),b''):result.update(chunk)
        return result.hexdigest()


@contextmanager
def stopped(root):
    guard = InstanceGuard(data_dir(root) / 'server.lock', _port())
    try:
        yield
    finally:
        guard.close()


def validate_database(path):
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        db.execute('PRAGMA trusted_schema=OFF')
        if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
            raise ValueError('Base de datos dañada')
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {'sessions', 'events', 'settings', 'metadata'} <= tables or tables - {
            'sessions', 'events', 'settings', 'metadata', 'viewer_points', 'point_events'}:
            raise ValueError('Esquema de respaldo incompatible')
        if db.execute("SELECT 1 FROM sqlite_master WHERE type IN ('trigger','view')").fetchone():
            raise ValueError('Objetos de base de datos inesperados')
        for value, in db.execute('SELECT value FROM settings'):
            json.loads(value)


def backup(output, root=ROOT):
    """Call while stopped; sqlite.backup includes any committed WAL pages."""
    data = data_dir(root)
    if not (data / 'history.sqlite3').is_file():raise ValueError('No hay base de datos')
    with tempfile.TemporaryDirectory() as temporary:
        database = Path(temporary) / 'history.sqlite3'
        with closing(sqlite3.connect(data / 'history.sqlite3')) as source, closing(sqlite3.connect(database)) as destination:
            source.backup(destination)
        files = {'history.sqlite3': database}
        for folder in FOLDERS:
            base = data_target(root, folder)
            for path in base.rglob('*'):
                if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(base.resolve()):
                    files[folder + '/' + path.relative_to(base).as_posix()] = path
        if output.resolve() in {p.resolve() for p in files.values()}:
            raise ValueError('El respaldo no puede sobrescribir datos de origen')
        with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED, allowZip64=True) as archive:
            manifest = {name: digest(path) for name, path in files.items()}
            for name, path in files.items():archive.write(path, name)
            archive.writestr('manifest.json', json.dumps({'version': 1, 'files': manifest}))
    return output


def restore(package, root=ROOT):
    data = data_dir(root);data.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=data) as temporary:
        stage = Path(temporary)
        with zipfile.ZipFile(package) as archive:
            entries = archive.infolist()
            if len(entries) > 10000 or sum(x.file_size for x in entries) > 100 * 1024**3:
                raise ValueError('Respaldo demasiado grande')
            manifest = json.loads(archive.read('manifest.json'))
            names = manifest.get('files', {})
            if manifest.get('version') != 1 or not isinstance(names, dict) or 'history.sqlite3' not in names:
                raise ValueError('Manifest inválido')
            if len(entries) != len(names)+1 or set(archive.namelist()) != set(names)|{'manifest.json'} or any(not allowed(n) for n in names):
                raise ValueError('Contenido inválido')
            if len({n.casefold() for n in names}) != len(names):raise ValueError('Rutas duplicadas')
            for name, expected in names.items():
                target = data_target(root, name)
                boundary = voice_models_dir(root) if PurePosixPath(name).parts[0] == 'voice_models' else data_dir(root)
                if target.is_symlink() or not target.resolve().is_relative_to(boundary.resolve()):raise ValueError('Destino inseguro')
                path = stage / name;path.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(name) as source, path.open('wb') as destination:shutil.copyfileobj(source, destination)
                if digest(path) != expected:raise ValueError('Checksum incorrecto')
        validate_database(stage / 'history.sqlite3')
        previous = data / ('recovery-before-' + time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8] + '.zip')
        if (data / 'history.sqlite3').exists():backup(previous, root)
        else:previous=None
        # Drain the previous database WAL before replacing its main file.
        if (data / 'history.sqlite3').exists():
            with closing(sqlite3.connect(data / 'history.sqlite3')) as db:
                if db.execute('PRAGMA wal_checkpoint(TRUNCATE)').fetchone()[0]:raise ValueError('Base de datos ocupada')
        replaced = []
        rollback = stage / 'rollback'
        try:
            for name in names:
                target = data_target(root, name);old = rollback / name
                if target.exists():old.parent.mkdir(parents=True, exist_ok=True);shutil.copy2(target, old)
                target.parent.mkdir(parents=True, exist_ok=True)
                os.replace(stage / name, target);replaced.append(name)
        except Exception:
            for name in reversed(replaced):
                target = data_target(root, name);old = rollback / name
                if old.exists():os.replace(old, target)
                else:target.unlink()
            raise
    return previous


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Cierra TikReader. Recupera puntos, ajustes, historial y medios locales.')
    parser.add_argument('action', nargs='?', choices=('backup', 'restore'))
    parser.add_argument('package', nargs='?', type=Path)
    args = parser.parse_args()
    try:
        if not args.action:args.action='restore' if input('1: Crear respaldo completo; 2: Recuperar respaldo: ').strip()=='2' else 'backup'
        if not args.package:args.package=Path(input('Ruta del archivo ZIP: ').strip().strip(chr(34)))
        with stopped(ROOT):
            if args.action == 'backup':print('Respaldo completo:', backup(args.package))
            else:
                if input('Escribe RESTAURAR TODO para reemplazar los datos con este respaldo: ') != 'RESTAURAR TODO':raise ValueError('Cancelado')
                print('Datos recuperados. Respaldo anterior:', restore(args.package))
                print('Abre TikReader. Importa y carga tus perfiles exportados para recuperar los ajustes del navegador.')
    except Exception as exc:
        print('No se completó:', exc);raise SystemExit(1)
