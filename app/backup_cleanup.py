"""Explicit selection of old app-managed backups, with newest-per-type protection."""
from contextlib import ExitStack
from datetime import datetime
import os
from pathlib import Path
import re
import secrets
import stat
import threading
import time

from app_paths import ROOT
from generated_cleanup import Candidate, _data_root, _identity, _safe, delete_inspected, inspected_file

MAX_ENTRIES = 2500
MAX_FILES = 400
MAX_SELECTED = 50
KINDS = {'automatic': 'Historial automático', 'manual': 'Historial manual',
         'history-safety': 'Seguridad del historial', 'creator-safety': 'Antes de actualizar Creator',
         'code': 'Código de la aplicación', 'recovery': 'Antes de recuperar datos'}
STAMP = r'(\d{8}-\d{6})'
IDENTIFIER = r'-[0-9a-f]{8}'
PATTERNS = {
    'backups': [('automatic', rf'tikreader-auto-{STAMP}{IDENTIFIER}\.sqlite3'),
                ('manual', rf'tikreader-manual-{STAMP}{IDENTIFIER}\.sqlite3'),
                ('history-safety', rf'tikreader-{STAMP}{IDENTIFIER}\.sqlite3'),
                ('creator-safety', rf'before-creator-update-{STAMP}\.sqlite3')],
    'code-backups': [('code', rf'{STAMP}{IDENTIFIER}\.zip')],
    '': [('recovery', rf'recovery-before-{STAMP}{IDENTIFIER}\.zip')],
}


class BackupCleanup:
    def __init__(self, root=ROOT):
        self.root = Path(root).absolute()
        self.lock = threading.RLock()
        self.preview = None

    def _inventory(self):
        found, visited, limited = [], 0, False
        deadline = time.monotonic() + .3
        for subfolder, patterns in PATTERNS.items():
            root = _data_root(self.root) / subfolder
            try:
                if not _safe(root, root):
                    limited = True
                    continue
                if not root.exists():
                    continue
                with os.scandir(root) as entries:
                    for entry in entries:
                        visited += 1
                        if visited > MAX_ENTRIES or len(found) >= MAX_FILES or time.monotonic() > deadline:
                            return found, True
                        match = next(((kind, re.fullmatch(pattern, entry.name)) for kind, pattern in patterns
                                      if re.fullmatch(pattern, entry.name)), None)
                        if not match:
                            continue
                        kind, captured = match
                        try:
                            datetime.strptime(captured.group(1), '%Y%m%d-%H%M%S')
                            path = Path(entry.path)
                            if not _safe(path, root):
                                limited = True
                                continue
                            info = path.lstat()
                            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                                limited = True
                                continue
                            found.append(Candidate(path, root, kind, _identity(info), info.st_size))
                        except ValueError:
                            continue
            except OSError:
                limited = True
        return found, limited

    @staticmethod
    def _newest(files):
        newest = {}
        for candidate in files:
            newest[candidate.kind] = max(newest.get(candidate.kind, candidate.identity[3]), candidate.identity[3])
        return newest

    @staticmethod
    def _reason(candidate, newest, limited):
        if limited:
            return 'Análisis incompleto; no se puede asegurar cuál es el más reciente.'
        if candidate.identity[3] == newest.get(candidate.kind):
            return 'Más reciente de este tipo; se conserva también cualquier empate.'
        if time.time() * 1e9 - candidate.identity[3] < 86400 * 1e9:
            return 'Reciente (menos de 24 horas) o posiblemente en uso.'
        return ''

    def scan(self):
        with self.lock:
            files, limited = self._inventory()
            newest = self._newest(files)
            mapping, rows = {}, []
            for candidate in sorted(files, key=lambda item: (-item.identity[3], item.kind, item.path.name)):
                key = secrets.token_urlsafe(12)
                reason = self._reason(candidate, newest, limited)
                mapping[key] = candidate, not reason
                rows.append({'id': key, 'name': candidate.path.name, 'kind': candidate.kind,
                             'type': KINDS[candidate.kind], 'modified_at': candidate.identity[3] / 1e9,
                             'bytes': candidate.size, 'selectable': not reason, 'reason': reason})
            token = secrets.token_urlsafe(24)
            self.preview = token, time.monotonic(), mapping
            return {'token': token, 'files': rows, 'limited': limited, 'max_selected': MAX_SELECTED,
                    'scope': 'Solo respaldos reconocidos de TikReader. Fecha y orden: última modificación del archivo.'}

    def clean(self, token, selected):
        with self.lock:
            preview = self.preview
            if not preview or token != preview[0] or time.monotonic() - preview[1] > 300:
                raise ValueError('Actualiza la lista de respaldos antes de confirmar.')
            if (not isinstance(selected, list) or not 1 <= len(selected) <= MAX_SELECTED or
                    any(not isinstance(key, str) or len(key) > 64 for key in selected) or
                    len(set(selected)) != len(selected) or
                    any(key not in preview[2] or not preview[2][key][1] for key in selected)):
                raise ValueError('Selecciona solo respaldos antiguos habilitados, sin duplicados.')
            self.preview = None
            candidates = [preview[2][key][0] for key in selected]
            result = {'deleted': 0, 'bytes': 0, 'skipped': 0, 'failures': []}
            inventory, limited = self._inventory()
            if limited:
                result['skipped'] = len(candidates)
                return result
            newest = self._newest(inventory)
            kinds = {candidate.kind for candidate in candidates}
            # Holding the newest files prevents a concurrent Windows delete from making
            # a selected old file the only surviving backup between inventory and deletion.
            with ExitStack() as leases:
                blocked = set()
                for anchor in inventory:
                    if anchor.kind in kinds and anchor.identity[3] == newest.get(anchor.kind):
                        try:
                            if leases.enter_context(inspected_file(anchor)) is None:
                                blocked.add(anchor.kind)
                        except OSError:
                            blocked.add(anchor.kind)
                deadline = time.monotonic() + 2
                for key, candidate in zip(selected, candidates):
                    try:
                        if candidate.kind in blocked or time.monotonic() > deadline:
                            result['skipped'] += 1
                            continue
                        current, limited = self._inventory()
                        live = next((item for item in current if item.path == candidate.path), None)
                        if (live is None or live.identity != candidate.identity or
                                self._reason(live, self._newest(current), limited) or not delete_inspected(live)):
                            result['skipped'] += 1
                            continue
                        result['deleted'] += 1
                        result['bytes'] += candidate.size
                    except FileNotFoundError:
                        result['skipped'] += 1
                    except OSError:
                        result['failures'].append({'id': key, 'error': 'No se pudo eliminar; puede estar en uso.'})
            return result
