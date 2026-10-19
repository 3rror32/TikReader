"""Bounded cleanup of regenerable bytecode and app-owned orphaned voice audio."""
from contextlib import contextmanager
from dataclasses import dataclass
import os
from pathlib import Path
import re
import secrets
import stat
import tempfile
import threading
import time

from app_paths import ROOT, data_dir, installed

MIN_AGE = 86400
MAX_ENTRIES = 5000
MAX_FILES = 1000
LOCK = threading.RLock()
ACTIVE = set()


def _data_root(root):
    # Keep the lexical override so a configured junction cannot be hidden by resolve().
    override = os.environ.get('TIKREADER_DATA_DIR')
    return Path(override).expanduser().absolute() if override else data_dir(root).absolute()


def _reparse(info):
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, 'st_file_attributes', 0) & 0x400)


def _safe(path, root):
    path, root = Path(path).absolute(), Path(root).absolute()
    if not path.is_relative_to(root):
        return False
    # Reject reparse points on every existing ancestor, including the configured root.
    for ancestor in (path, *path.parents):
        try:
            if _reparse(ancestor.lstat()):
                return False
        except FileNotFoundError:
            continue
    return True


@contextmanager
def audio_workspace(root=ROOT):
    parent = _data_root(root) / 'generated-audio'
    with LOCK:
        if not _safe(parent, _data_root(root)):
            raise OSError('Unsafe generated audio directory')
        parent.mkdir(parents=True, exist_ok=True)
        temporary = tempfile.TemporaryDirectory(prefix='tikreader-voice-', dir=parent)
        folder = Path(temporary.name)
        ACTIVE.add(folder)
    try:
        yield str(folder)
    finally:
        with LOCK:
            try:
                temporary.cleanup()
            finally:
                ACTIVE.discard(folder)


@dataclass(frozen=True)
class Candidate:
    path: Path
    root: Path
    kind: str
    identity: tuple
    size: int


def _identity(info):
    return info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns


class GeneratedCleanup:
    def __init__(self, root=ROOT):
        self.root = Path(root).absolute()
        self.preview = None

    def roots(self):
        data = _data_root(self.root)
        roots = [(data / 'pycache', 'cache'), (data / 'generated-audio', 'audio')]
        if not installed(self.root):
            roots.append((self.root / 'runtime' / 'pycache', 'cache'))
        return roots

    def _eligible(self, path, root, kind, now):
        if not _safe(path, root):
            return None
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or now - info.st_mtime < MIN_AGE:
            return None
        relative = path.relative_to(root)
        if kind == 'cache':
            if path.suffix != '.pyc':
                return None
        elif (len(relative.parts) != 2 or
              not re.fullmatch(r'tikreader-voice-[a-z0-9_]{8}', relative.parts[0]) or
              path.name not in {'source.wav', 'converted.wav'} or path.parent in ACTIVE):
            return None
        return Candidate(path, root, kind, _identity(info), info.st_size)

    def scan(self):
        found, visited, limited, failures = [], 0, False, 0
        deadline, now = time.monotonic() + .25, time.time()
        with LOCK:
            for root, kind in self.roots():
                pending = [(root, 0)]
                while pending:
                    folder, depth = pending.pop()
                    try:
                        if not _safe(folder, root) or not folder.is_dir():
                            continue
                        with os.scandir(folder) as entries:
                            for entry in entries:
                                visited += 1
                                if visited > MAX_ENTRIES or len(found) >= MAX_FILES or time.monotonic() > deadline:
                                    limited = True
                                    break
                                path = Path(entry.path)
                                info = entry.stat(follow_symlinks=False)
                                if _reparse(info):
                                    continue
                                if stat.S_ISDIR(info.st_mode):
                                    if depth < 12 and (kind == 'cache' or depth == 0):
                                        pending.append((path, depth + 1))
                                    continue
                                candidate = self._eligible(path, root, kind, now)
                                if candidate:
                                    found.append(candidate)
                    except OSError:
                        failures += 1
                    if limited:
                        break
                if limited:
                    break
            token = secrets.token_urlsafe(24)
            self.preview = token, time.monotonic(), found
        return {'token': token, 'count': len(found), 'bytes': sum(item.size for item in found),
                'limited': limited, 'scan_failures': failures, 'minimum_age_hours': 24,
                'scope': 'Solo caché Python y audio temporal generado de más de 24 horas; se conservan archivos activos y datos personales.'}

    def _delete(self, candidate):
        path = candidate.path
        if os.name != 'nt':
            # Revalidate ancestors and file identity immediately before unlink.
            if not _safe(path, candidate.root) or _identity(path.lstat()) != candidate.identity:
                return False
            path.unlink()
            return True
        # Delete the inspected Windows handle, never a substituted path or junction target.
        import ctypes
        from ctypes import wintypes
        import msvcrt
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        create = kernel.CreateFileW
        create.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p,
                           wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        create.restype = wintypes.HANDLE
        handle = create(str(path), 0x80000000 | 0x10000, 3, None, 3, 0x00200000, None)
        if handle == wintypes.HANDLE(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        fd = msvcrt.open_osfhandle(handle, os.O_RDONLY | os.O_BINARY)
        try:
            if _identity(os.fstat(fd))[:4] != candidate.identity[:4] or not _safe(path, candidate.root):
                return False
            final = kernel.GetFinalPathNameByHandleW
            final.argtypes = [wintypes.HANDLE, wintypes.LPWSTR, wintypes.DWORD, wintypes.DWORD]
            final.restype = wintypes.DWORD
            buffer = ctypes.create_unicode_buffer(32768)
            length = final(handle, buffer, len(buffer), 0)
            if not 0 < length < len(buffer) or os.path.normcase(buffer.value.removeprefix('\\\\?\\')) != os.path.normcase(str(path)):
                return False
            disposition = wintypes.BOOL(True)
            remove = kernel.SetFileInformationByHandle
            remove.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
            remove.restype = wintypes.BOOL
            if not remove(handle, 4, ctypes.byref(disposition), ctypes.sizeof(disposition)):
                raise ctypes.WinError(ctypes.get_last_error())
            return True
        finally:
            os.close(fd)

    def clean(self, token):
        with LOCK:
            preview, self.preview = self.preview, None
            if not preview or token != preview[0] or time.monotonic() - preview[1] > 300:
                raise ValueError('Analiza de nuevo los archivos antes de confirmar.')
            result = {'deleted': 0, 'bytes': 0, 'skipped': 0, 'failures': []}
            for index, candidate in enumerate(preview[2]):
                try:
                    current = self._eligible(candidate.path, candidate.root, candidate.kind, time.time())
                    if current is None or current.identity != candidate.identity or not self._delete(candidate):
                        result['skipped'] += 1
                        continue
                    result['deleted'] += 1
                    result['bytes'] += candidate.size
                except FileNotFoundError:
                    result['skipped'] += 1
                except OSError:
                    result['failures'].append({'item': index + 1, 'kind': candidate.kind,
                                               'error': 'No se pudo eliminar; puede estar en uso.'})
            return result
