"""Copy an older source installation into an empty user data directory."""
import argparse
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile
from contextlib import closing
from app_paths import data_dir
from runtime_guard import InstanceGuard


def migrate(source, destination=None):
    source = Path(source).resolve()
    destination = Path(destination or data_dir()).resolve()
    database = source / 'data' / 'history.sqlite3'
    if not database.is_file() or not (source / 'app' / 'server.py').is_file():
        raise ValueError('Selecciona la carpeta anterior que contiene app y data.')
    if destination.is_relative_to(source) or source.is_relative_to(destination):
        raise ValueError('El origen y el destino deben ser carpetas independientes.')
    destination.mkdir(parents=True, exist_ok=True)
    source_guard = InstanceGuard(source / 'data' / 'server.lock', port=None)
    target_guard = None
    try:
        target_guard = InstanceGuard(destination / 'server.lock', port=None)
        names = ['history.sqlite3', 'media', 'alert_media', 'voice_models']
        if any((destination / name).exists() for name in names):
            raise ValueError('Ya hay datos en el destino. No se sobrescribió nada.')
        with tempfile.TemporaryDirectory(dir=destination, prefix='migration-') as temporary:
            stage = Path(temporary)
            with closing(sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True)) as db, closing(sqlite3.connect(stage / 'history.sqlite3')) as output:
                db.backup(output)
                if output.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                    raise ValueError('La base anterior no superó la comprobación de integridad.')
            for name in names[1:]:
                folder = source / ('assets' if name == 'voice_models' else 'data') / name
                if folder.is_dir():
                    for item in folder.rglob('*'):
                        if item.is_symlink() or not item.resolve().is_relative_to(folder.resolve()):
                            raise ValueError('La carpeta anterior contiene enlaces externos.')
                    shutil.copytree(folder, stage / name)
            moved = []
            try:
                for name in names:
                    if (stage / name).exists():
                        os.replace(stage / name, destination / name)
                        moved.append(name)
            except Exception:
                for name in reversed(moved):
                    os.replace(destination / name, stage / name)
                raise
        return {'ok': True, 'copied': moved, 'original_preserved': True}
    finally:
        source_guard.close()
        if target_guard:
            target_guard.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    args = parser.parse_args()
    try:
        print(json.dumps(migrate(args.source)))
    except Exception as exc:
        print(str(exc))
        raise SystemExit(1)
