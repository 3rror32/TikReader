"""Configuración central de ejecución, sin secretos incrustados en el código."""
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
from app_paths import data_dir
DATA_DIR = data_dir()


def load_internal_env():
    """Only known internal options; environment variables take precedence."""
    allowed = {'TIKREADER_PORT', 'TIKREADER_LAN', 'TIKREADER_LOG_LEVEL',
               'TIKREADER_RVC_ROOT', 'TIKREADER_RVC_PYTHON'}
    path = DATA_DIR / '.env'
    if not path.is_file():
        return
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        key, separator, value = line.strip().partition('=')
        if separator and key.strip() in allowed:
            os.environ.setdefault(key.strip(), value.strip().strip('\"').strip("'"))


load_internal_env()

# MAJOR.MINOR.PATCH.BUILD. El cuarto componente identifica cada compilación.
APP_VERSION = "1.0.0.7"


def _boolean(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    return default if value is None else value.strip().lower() in {"1", "true", "yes", "si", "sí", "on"}


def _port() -> int:
    try:
        value = int(os.getenv("TIKREADER_PORT", "5000"))
    except ValueError as exc:
        raise RuntimeError("TIKREADER_PORT debe ser un número") from exc
    if not 1 <= value <= 65535:
        raise RuntimeError("TIKREADER_PORT debe estar entre 1 y 65535")
    return value


def load_or_create_secret(path: Path | None = None) -> str:
    target = path or DATA_DIR / ".flask-secret"
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        current = target.read_text(encoding="ascii").strip()
    except FileNotFoundError:
        current = ""
    if len(current) < 32:
        current = secrets.token_urlsafe(48)
        target.write_text(current, encoding="ascii")
    return current


@dataclass(frozen=True)
class RuntimeConfig:
    host: str
    port: int
    lan_enabled: bool
    log_level: str

    @property
    def local_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"


def runtime_config() -> RuntimeConfig:
    lan = _boolean("TIKREADER_LAN")
    return RuntimeConfig("0.0.0.0" if lan else "127.0.0.1", _port(), lan,
                         os.getenv("TIKREADER_LOG_LEVEL", "INFO").upper())
