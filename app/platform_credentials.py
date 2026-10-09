"""Protected, local credentials for external live platforms.

Windows builds use DPAPI, so only the current Windows user can decrypt the
stored values. Other development platforms keep values in memory rather than
falling back to an unencrypted file.
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import threading

from app_paths import data_dir


class CredentialStoreError(RuntimeError):
    pass


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def _blob(value: bytes):
    buffer = ctypes.create_string_buffer(value)
    return _DataBlob(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte))), buffer


def _windows_protect(value: bytes) -> bytes:
    if os.name != "nt":
        raise CredentialStoreError("El almacenamiento protegido solo está disponible en Windows.")
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    source, source_buffer = _blob(value)
    output = _DataBlob()
    crypt32.CryptProtectData.argtypes = [ctypes.POINTER(_DataBlob), wintypes.LPCWSTR,
                                         ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
                                         wintypes.DWORD, ctypes.POINTER(_DataBlob)]
    crypt32.CryptProtectData.restype = wintypes.BOOL
    if not crypt32.CryptProtectData(ctypes.byref(source), "TikReader · Canales externos",
                                    None, None, None, 0x1, ctypes.byref(output)):
        raise CredentialStoreError(f"Windows no pudo proteger las credenciales ({ctypes.get_last_error()}).")
    try:
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        kernel32.LocalFree(output.pbData)
        del source_buffer


def _windows_unprotect(value: bytes) -> bytes:
    if os.name != "nt":
        raise CredentialStoreError("El almacenamiento protegido solo está disponible en Windows.")
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    source, source_buffer = _blob(value)
    output = _DataBlob()
    crypt32.CryptUnprotectData.argtypes = [ctypes.POINTER(_DataBlob), ctypes.c_void_p,
                                           ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
                                           wintypes.DWORD, ctypes.POINTER(_DataBlob)]
    crypt32.CryptUnprotectData.restype = wintypes.BOOL
    if not crypt32.CryptUnprotectData(ctypes.byref(source), None, None, None, None, 0x1,
                                      ctypes.byref(output)):
        raise CredentialStoreError(f"Windows no pudo abrir las credenciales ({ctypes.get_last_error()}).")
    try:
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        kernel32.LocalFree(output.pbData)
        del source_buffer


class PlatformCredentialStore:
    """Store only connector credentials, never session-specific channel data."""

    ALLOWED = {"youtube": {"api_key"}, "twitch": {"nickname", "token"},
               "kick": {"client_id", "client_secret", "webhook_secret"},
               "caption_ai": {"api_key"}}

    def __init__(self, path: Path | None = None, protect=None, unprotect=None):
        self.path = Path(path or data_dir() / "platform-credentials.bin")
        self._protect = protect or (_windows_protect if os.name == "nt" else None)
        self._unprotect = unprotect or (_windows_unprotect if os.name == "nt" else None)
        self.persistent = self._protect is not None and self._unprotect is not None
        self.lock = threading.RLock()
        self._memory: dict[str, dict[str, str]] = {}

    def _read(self) -> dict[str, dict[str, str]]:
        if not self.persistent or not self.path.is_file():
            return {key: dict(value) for key, value in self._memory.items()}
        try:
            decoded = json.loads(self._unprotect(self.path.read_bytes()).decode("utf-8"))
        except (OSError, ValueError, UnicodeError, CredentialStoreError) as exc:
            raise CredentialStoreError("No se pudieron leer las credenciales protegidas. Elimínalas y vuelve a configurarlas.") from exc
        if not isinstance(decoded, dict):
            raise CredentialStoreError("El archivo de credenciales no es válido.")
        return {
            platform: {key: str(value) for key, value in values.items() if key in self.ALLOWED.get(platform, set())}
            for platform, values in decoded.items() if isinstance(values, dict) and platform in self.ALLOWED
        }

    def _write(self, values: dict[str, dict[str, str]]):
        self._memory = {key: dict(value) for key, value in values.items()}
        if not self.persistent:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        protected = self._protect(json.dumps(values, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        temporary.write_bytes(protected)
        try:
            temporary.chmod(0o600)
        except OSError:
            pass
        os.replace(temporary, self.path)

    def get(self, platform: str) -> dict[str, str]:
        platform = str(platform or "").casefold()
        with self.lock:
            return dict(self._read().get(platform, {}))

    def save(self, platform: str, values: dict) -> dict:
        platform = str(platform or "").casefold()
        allowed = self.ALLOWED.get(platform)
        if not allowed or not isinstance(values, dict):
            raise ValueError("Plataforma o credenciales inválidas.")
        clean = {key: str(values.get(key) or "").strip() for key in allowed}
        with self.lock:
            current = self._read()
            current[platform] = clean
            self._write(current)
        return self.public_status(platform)

    def delete(self, platform: str):
        platform = str(platform or "").casefold()
        if platform not in self.ALLOWED:
            raise ValueError("Plataforma inválida.")
        with self.lock:
            current = self._read()
            current.pop(platform, None)
            self._write(current)
            if self.persistent and not current:
                try:
                    self.path.unlink()
                except FileNotFoundError:
                    pass

    def public_status(self, platform: str) -> dict:
        platform = str(platform or "").casefold()
        values = self.get(platform)
        configured = (bool(values.get("api_key")) if platform in {"youtube", "caption_ai"} else
                      bool(values.get("nickname") and values.get("token")) if platform == "twitch" else
                      bool(values.get("client_id") and values.get("client_secret") and values.get("webhook_secret")))
        result = {"platform": platform, "configured": configured}
        if platform == "twitch" and values.get("nickname"):
            result["nickname"] = values["nickname"]
        if platform == "kick" and values.get("webhook_secret"):
            result["webhook_path"] = "/webhooks/kick/" + values["webhook_secret"]
        return result

    def snapshot(self) -> dict:
        return {
            "platforms": [self.public_status(platform) for platform in ("youtube", "twitch", "kick")],
            "storage": "windows-user" if self.persistent else "memory",
        }
