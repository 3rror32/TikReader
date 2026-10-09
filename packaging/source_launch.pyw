"""Branded UI bootstrap that delegates backend work to live source Python."""

import ctypes
import os
from pathlib import Path
import subprocess
import traceback


def _required_path(name: str, *, directory: bool) -> Path:
    raw = os.environ.get(name, "").strip()
    if not raw:
        raise RuntimeError(f"No se definio {name} para iniciar TikReader.")
    path = Path(raw).resolve()
    valid = path.is_dir() if directory else path.is_file()
    if not valid:
        raise RuntimeError(f"La ruta de {name} no existe: {path}")
    return path


def _child_creation_flags(platform_name: str | None = None) -> int:
    if (platform_name or os.name) == "nt":
        return getattr(subprocess, "CREATE_NO_WINDOW", 0)
    return 0


def main() -> int:
    source_root = _required_path("TIKREADER_SOURCE_ROOT", directory=True)
    backend_python = _required_path("TIKREADER_SOURCE_BACKEND_PYTHON", directory=False)
    launcher_file = source_root / "app" / "launcher.py"
    if not launcher_file.is_file():
        raise RuntimeError(f"No se encontro el launcher de origen: {launcher_file}")

    process = subprocess.Popen(
        [str(backend_python), str(launcher_file)],
        cwd=source_root,
        env=os.environ.copy(),
        creationflags=_child_creation_flags(),
    )
    return_code = process.wait()
    if return_code != 0:
        _handle_startup_failure(
            RuntimeError(f"Backend process exited with code {return_code}."),
            f"Backend process exited with code {return_code}.\n",
        )
    return return_code


def _handle_startup_failure(exc: Exception, formatted_traceback: str) -> int:
    source_root = Path(os.environ.get("TIKREADER_SOURCE_ROOT") or Path.cwd()).resolve()
    log_path = source_root / "runtime" / "source-launcher-error.log"
    message = str(exc)
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write("\n=== TikReader source launcher failure ===\n")
            log_file.write(formatted_traceback)
            if not formatted_traceback.endswith("\n"):
                log_file.write("\n")
        message = f"{message}\nDetalles guardados en: {log_path}"
    except Exception:
        pass
    try:
        ctypes.windll.user32.MessageBoxW(None, message, "TikReader · No se pudo iniciar", 0x10)
    except Exception:
        pass
    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        raise SystemExit(_handle_startup_failure(exc, traceback.format_exc()))
