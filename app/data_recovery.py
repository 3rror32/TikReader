"""Offline, verified recovery of the complete database and user media."""
import argparse
import errno
import math
import re
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
from recovery_settings import validate_setting

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


# Version 1 used the same core columns; points gained subscriber_session lazily.
CORE_COLUMNS = {
    'sessions': [('id','TEXT',0,None,1),('username','TEXT',0,None,0),('started','TEXT',0,'CURRENT_TIMESTAMP',0)],
    'events': [('session','TEXT',0,None,1),('kind','TEXT',0,None,2),('id','TEXT',0,None,3),('payload','TEXT',0,None,0)],
    'settings': [('key','TEXT',0,None,1),('value','TEXT',0,None,0)],
    'metadata': [('key','TEXT',0,None,1),('value','TEXT',1,None,0)],
    'viewer_points': [('user','TEXT',0,None,1),('display_name','TEXT',1,None,0),('points','INTEGER',1,'0',0),
                      ('lifetime','INTEGER',1,'0',0),('subscriber','INTEGER',1,'0',0),('updated','REAL',1,None,0)],
    'point_events': [('event_id','TEXT',0,None,1),('created','REAL',1,None,0)],
}
RESERVE_BYTES = 64 * 1024**2


def strict_json(value):
    def invalid(_):
        raise ValueError('JSON no finito')
    return json.loads(value, parse_constant=invalid)


def validate_database(path):
    _inspect_database(path, admit_settings=True)


def _validate_preserved_database(path):
    # A safety copy preserves broken settings so a valid incoming recovery can repair them.
    _inspect_database(path, admit_settings=False)


def _inspect_database(path, admit_settings):
    try:
        with closing(sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)) as db:
            db.execute('PRAGMA trusted_schema=OFF')
            objects = db.execute('SELECT type,name,tbl_name,sql FROM sqlite_master').fetchall()
            tables = {name for kind,name,_,_ in objects if kind == 'table'}
            if not {'sessions','events','settings','metadata'} <= tables or tables - CORE_COLUMNS.keys():
                raise ValueError('Esquema de respaldo incompatible')
            for kind,name,table,sql in objects:
                if kind == 'index':
                    columns = [row[2] for row in db.execute('PRAGMA index_info("' + name.replace('"','""') + '")')]
                    expected = {'idx_events_session': ('events',['session']), 'idx_sessions_started': ('sessions',['started'])}
                    if not name.startswith('sqlite_autoindex_') and expected.get(name) != (table, columns):
                        raise ValueError('Índice de respaldo incompatible')
                elif kind != 'table' or re.search(r'\b(?:CHECK|REFERENCES|GENERATED|VIRTUAL)\b', sql or '', re.I):
                    raise ValueError('Objetos de base de datos inesperados')
            for table in tables:
                rows = db.execute('PRAGMA table_xinfo("' + table + '")').fetchall()
                actual = [(row[1],row[2].upper(),row[3],row[4],row[5]) for row in rows]
                for index in db.execute('PRAGMA index_list("' + table + '")'):
                    if index[3] == 'pk':
                        continue
                    if index[2] or index[4]:
                        raise ValueError('Restricción de índice incompatible')
                expected = CORE_COLUMNS[table]
                legacy_points = table == 'viewer_points' and actual == expected + [('subscriber_session','TEXT',1,"''",0)]
                if any(row[6] for row in rows) or not (actual == expected or legacy_points):
                    raise ValueError('Columnas de respaldo incompatibles')
            version = db.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()
            if version not in [('1',), ('2',)]:
                raise ValueError('Versión de respaldo incompatible')
            if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                raise ValueError('Base de datos dañada')
            if not admit_settings:
                return  # Integrity, schema and object safety remain mandatory for preserved snapshots.
            for key,value in db.execute('SELECT key,value FROM settings'):
                if not isinstance(key, str):
                    raise ValueError('Ajuste sin nombre válido')
                validate_setting(key, strict_json(value))
            for kind,payload in db.execute('SELECT kind,payload FROM events'):
                record = strict_json(payload)
                if not isinstance(record, dict):
                    raise ValueError('Evento guardado incompatible')
                if kind == 'gift':
                    for field in ('count','diamonds'):
                        value = record.get(field)
                        if value is not None and (type(value) not in (int,float) or not math.isfinite(value) or value < 0):
                            raise ValueError('Regalo guardado incompatible')
    except (sqlite3.Error, TypeError, OverflowError, json.JSONDecodeError):
        raise ValueError('Base de datos incompatible o dañada') from None


def _existing(path):
    path = Path(path).absolute()
    while not path.exists():
        if path.parent == path:
            raise ValueError('Unidad de almacenamiento no disponible')
        path = path.parent
    return path


def _filesystem_key(path):
    anchor = _existing(path)
    device = anchor.stat().st_dev
    # Windows st_dev identifies mounted volumes, including mountpoints on one drive.
    # Fall back to the drive/UNC share only when the filesystem does not expose it.
    return ('device', device) if device or os.name != 'nt' else ('drive', os.path.splitdrive(str(anchor.resolve()))[0].casefold())


def _check_space(requirements):
    volumes = {}
    for path, size in requirements:
        anchor = _existing(path)
        key = _filesystem_key(anchor)
        representative, total = volumes.get(key, (anchor, 0))
        volumes[key] = representative, total + max(0, int(size))
    for anchor, required in volumes.values():
        if shutil.disk_usage(anchor).free < required + RESERVE_BYTES:
            raise ValueError('No hay espacio suficiente en una unidad afectada; se requieren las copias temporales y 64 MB de reserva.')


def _database_bound(data):
    database = data / 'history.sqlite3'
    return sum(path.stat().st_size for path in (database, data / 'history.sqlite3-wal') if path.is_file())


def _source_files(root):
    files = {'history.sqlite3': data_dir(root) / 'history.sqlite3'}
    if not files['history.sqlite3'].is_file():
        raise ValueError('No hay base de datos')
    for folder in FOLDERS:
        base = data_target(root, folder)
        for path in base.rglob('*'):
            if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(base.resolve()):
                files[folder + '/' + path.relative_to(base).as_posix()] = path
                if len(files) >= 10000:
                    raise ValueError('Respaldo demasiado grande')
    return files


def _zip_bound(total, count, names=()):
    # Incompressible payload, ZIP headers/names and the bounded manifest, not compressed size.
    name_bytes = sum(len(name.encode('utf-8')) for name in names)
    return total + total // 1000 + count * 2048 + 4 * name_bytes + 4 * 1024**2


def _manifest(archive):
    entries = archive.infolist()
    if len(entries) > 10000 or sum(entry.file_size for entry in entries) > 100 * 1024**3:
        raise ValueError('Respaldo demasiado grande')
    if archive.getinfo('manifest.json').file_size > 4 * 1024**2:
        raise ValueError('Manifest demasiado grande')
    manifest = strict_json(archive.read('manifest.json'))
    if not isinstance(manifest, dict):
        raise ValueError('Manifest inválido')
    names = manifest.get('files', {})
    if type(manifest.get('version')) is not int or manifest.get('version') != 1 or not isinstance(names, dict) or 'history.sqlite3' not in names:
        raise ValueError('Manifest inválido')
    if (len(entries) != len(names) + 1 or set(archive.namelist()) != set(names) | {'manifest.json'} or
            any(not allowed(name) or not isinstance(checksum, str) or not re.fullmatch('[0-9a-f]{64}', checksum) for name,checksum in names.items()) or
            len({name.casefold() for name in names}) != len(names)):
        raise ValueError('Contenido inválido')
    return names, sum(entry.file_size for entry in entries)


def _verify_package(package, database, database_validator=validate_database):
    with zipfile.ZipFile(package) as archive:
        names, _ = _manifest(archive)
        for name, expected in names.items():
            checksum = hashlib.sha256()
            with archive.open(name) as source:
                if name == 'history.sqlite3':
                    with database.open('xb') as target:
                        for chunk in iter(lambda: source.read(1024**2), b''):
                            checksum.update(chunk); target.write(chunk)
                else:
                    for chunk in iter(lambda: source.read(1024**2), b''):
                        checksum.update(chunk)
            if checksum.hexdigest() != expected:
                raise ValueError('Checksum incorrecto')
    database_validator(database)


def _publish_exclusive(partial, output):
    if os.name == 'nt':
        os.rename(partial, output)  # Windows rename fails atomically when output already exists.
    else:
        os.link(partial, output)  # Exclusive publication on the sibling filesystem.
        partial.unlink()


def backup(output, root=ROOT):
    """Call while stopped; public exports always require startup-valid data."""
    return _create_backup(output, root, preserve_current=False)


def _create_backup(output, root, preserve_current):
    """The preservation branch is private to restore, never a CLI/API validation bypass."""
    output = Path(output)
    data = data_dir(root)
    files = _source_files(root)
    if output.resolve() in {path.resolve() for path in files.values()}:
        raise ValueError('El respaldo no puede sobrescribir datos de origen')
    if output.exists():
        raise FileExistsError('El destino del respaldo ya existe')
    database_bound = _database_bound(data)
    total = database_bound + sum(path.stat().st_size for name,path in files.items() if name != 'history.sqlite3')
    _check_space([(data, database_bound * 2), (output.parent, _zip_bound(total, len(files), files))])
    partial = output.with_name(output.name + '.partial-' + uuid.uuid4().hex)
    owned_partial = False
    try:
        with tempfile.TemporaryDirectory(dir=data) as temporary:
            database = Path(temporary) / 'history.sqlite3'
            with closing(sqlite3.connect((data / 'history.sqlite3').resolve().as_uri() + '?mode=ro', uri=True)) as source, closing(sqlite3.connect(database)) as destination:
                source.backup(destination)
            validator = _validate_preserved_database if preserve_current else validate_database
            validator(database)
            files['history.sqlite3'] = database
            with partial.open('xb') as stream:
                owned_partial = True
                with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED, allowZip64=True) as archive:
                    manifest = {name: digest(path) for name,path in files.items()}
                    for name,path in files.items():
                        archive.write(path, name)
                    archive.writestr('manifest.json', json.dumps({'version': 1, 'files': manifest}))
            if preserve_current:
                _verify_package(partial, Path(temporary) / 'verified.sqlite3', database_validator=_validate_preserved_database)
            else:
                _verify_package(partial, Path(temporary) / 'verified.sqlite3')
            with partial.open('rb+') as stream:
                os.fsync(stream.fileno())
            _publish_exclusive(partial, output)
    finally:
        if owned_partial:
            partial.unlink(missing_ok=True)
    return output


def _install_file(source, target):
    if _filesystem_key(source) == _filesystem_key(target.parent):
        os.replace(source, target)
        return
    partial = target.with_name(target.name + '.partial-' + uuid.uuid4().hex)
    owned_partial = False
    try:
        with source.open('rb') as incoming, partial.open('xb') as outgoing:
            owned_partial = True
            shutil.copyfileobj(incoming, outgoing)
            outgoing.flush(); os.fsync(outgoing.fileno())
        os.replace(partial, target)
    finally:
        if owned_partial:
            partial.unlink(missing_ok=True)


def _restore_space(root, names, stage_bytes=0, safety=True):
    data = data_dir(root)
    old_size = sum(data_target(root, name).stat().st_size for name in names if data_target(root, name).is_file())
    requirements = [(data, stage_bytes + old_size + _database_bound(data))]  # Extraction and rollback snapshots.
    if safety and (data / 'history.sqlite3').is_file():
        files = _source_files(root)
        bound = _database_bound(data)
        total = bound + sum(path.stat().st_size for name,path in files.items() if name != 'history.sqlite3')
        requirements.append((data, 3 * bound + _zip_bound(total, len(files), files)))
    data_volume = _filesystem_key(data)
    for name, size in names.items():
        target = data_target(root, name)
        if _filesystem_key(target.parent) != data_volume:
            requirements.append((target.parent, size + (target.stat().st_size if target.is_file() else 0)))
    _check_space(requirements)


def restore(package, root=ROOT):
    data = data_dir(root)
    data.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(package) as archive:
        names, uncompressed = _manifest(archive)
        sizes = {name: archive.getinfo(name).file_size for name in names}
        _restore_space(root, sizes, uncompressed)
        with tempfile.TemporaryDirectory(dir=data) as temporary:
            stage = Path(temporary)
            for name, expected in names.items():
                target = data_target(root, name)
                boundary = voice_models_dir(root) if PurePosixPath(name).parts[0] == 'voice_models' else data
                if target.is_symlink() or not target.resolve().is_relative_to(boundary.resolve()):
                    raise ValueError('Destino inseguro')
                path = stage / name; path.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(name) as source, path.open('xb') as destination:
                    shutil.copyfileobj(source, destination)
                if digest(path) != expected:
                    raise ValueError('Checksum incorrecto')
            validate_database(stage / 'history.sqlite3')
            _restore_space(root, sizes)
            previous = data / ('recovery-before-' + time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8] + '.zip')
            if (data / 'history.sqlite3').exists():
                _create_backup(previous, root, preserve_current=True)
            else:
                previous = None
            _restore_space(root, sizes, safety=False)
            if (data / 'history.sqlite3').exists():
                with closing(sqlite3.connect(data / 'history.sqlite3')) as db:
                    if db.execute('PRAGMA wal_checkpoint(TRUNCATE)').fetchone()[0]:
                        raise ValueError('Base de datos ocupada')
            replaced = []
            rollback = stage / 'rollback'
            try:
                for name in names:
                    target = data_target(root, name); old = rollback / name
                    if target.exists():
                        old.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(target, old)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    _install_file(stage / name, target); replaced.append(name)
            except Exception:
                for name in reversed(replaced):
                    target = data_target(root, name); old = rollback / name
                    if old.exists():
                        _install_file(old, target)
                    else:
                        target.unlink()
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
