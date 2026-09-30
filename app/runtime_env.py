"""Read and update the small, non-secret runtime configuration file."""
from __future__ import annotations

import os
from pathlib import Path


DEFAULTS = {
    "TIKREADER_PORT": "5000",
    "TIKREADER_LAN": "0",
    "TIKREADER_LOG_LEVEL": "INFO",
}
EDITABLE_KEYS = frozenset(DEFAULTS)
LOG_LEVELS = frozenset({"DEBUG", "INFO", "WARNING", "ERROR"})


def read_runtime_env(path: Path) -> dict[str, str]:
    values = dict(DEFAULTS)
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except FileNotFoundError:
        return values
    for line in lines:
        key, separator, value = line.strip().partition("=")
        if separator and key in EDITABLE_KEYS:
            values[key] = value.strip().strip('"').strip("'")
    return values


def validate_runtime_env(values: object) -> dict[str, str]:
    if not isinstance(values, dict) or any(key not in EDITABLE_KEYS for key in values):
        raise ValueError("Configuración desconocida")
    result = dict(DEFAULTS)
    result.update({key: str(value).strip() for key, value in values.items()})
    try:
        port = int(result["TIKREADER_PORT"])
    except ValueError as exc:
        raise ValueError("El puerto debe ser un número") from exc
    if not 1 <= port <= 65535:
        raise ValueError("El puerto debe estar entre 1 y 65535")
    lan = result["TIKREADER_LAN"].lower()
    if lan not in {"0", "1", "false", "true", "no", "yes", "off", "on"}:
        raise ValueError("La opción de red local no es válida")
    level = result["TIKREADER_LOG_LEVEL"].upper()
    if level not in LOG_LEVELS:
        raise ValueError("El nivel de registro no es válido")
    return {
        "TIKREADER_PORT": str(port),
        "TIKREADER_LAN": "1" if lan in {"1", "true", "yes", "on"} else "0",
        "TIKREADER_LOG_LEVEL": level,
    }


def write_runtime_env(path: Path, values: object) -> dict[str, str]:
    clean = validate_runtime_env(values)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        existing = path.read_text(encoding="utf-8-sig").splitlines()
    except FileNotFoundError:
        existing = []
    output: list[str] = []
    replaced: set[str] = set()
    for line in existing:
        key, separator, _ = line.strip().partition("=")
        if separator and key in EDITABLE_KEYS:
            if key not in replaced:
                output.append(f"{key}={clean[key]}")
                replaced.add(key)
        else:
            output.append(line)
    if output and output[-1].strip():
        output.append("")
    for key in DEFAULTS:
        if key not in replaced:
            output.append(f"{key}={clean[key]}")
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text("\n".join(output).rstrip() + "\n", encoding="utf-8")
    os.replace(temporary, path)
    return clean
