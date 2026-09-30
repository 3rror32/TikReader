"""Read-only checks used by the pre-live control room."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import shutil
import time

from app_paths import data_dir, kokoro_assets, microphone_speech_model


OVERLAY_BUILD = ("runtime.js", "broadcast.js", "broadcast.css", "studio.js", "controlCenter.js", "platformConnectors.js")


def _check(identifier, title, status, detail, action="", required=True):
    return {
        "id": identifier,
        "title": title,
        "status": status,
        "detail": detail,
        "action": action,
        "required": required,
    }


def _latest_backup(root: Path):
    files = [path for path in (root / "backups").glob("*") if path.is_file()]
    return max(files, key=lambda path: path.stat().st_mtime, default=None)


def inspect(runtime, root: Path | None = None) -> dict:
    """Return bounded, non-private readiness information without changing state."""
    root = Path(root or runtime.PROJECT_ROOT)
    storage = data_dir(root)
    checks = []

    try:
        free = shutil.disk_usage(storage).free
        if free < 1024**3:
            checks.append(_check("storage", "Espacio para operar", "fail",
                                 f"Solo quedan {free / 1024**3:.1f} GB libres.",
                                 "Libera al menos 1 GB antes del directo."))
        elif free < 3 * 1024**3:
            checks.append(_check("storage", "Espacio para operar", "warn",
                                 f"Quedan {free / 1024**3:.1f} GB libres.",
                                 "Revisa los motores de voz instalados."))
        else:
            checks.append(_check("storage", "Espacio para operar", "ok",
                                 f"{free / 1024**3:.1f} GB libres."))
    except OSError:
        checks.append(_check("storage", "Espacio para operar", "fail",
                             "No se pudo consultar el almacenamiento.",
                             "Comprueba el acceso a la carpeta de datos."))

    archive = getattr(runtime, "archive", None)
    health = archive.health() if archive else {"available": False}
    archive_ok = health.get("available") and health.get("integrity") == "ok"
    checks.append(_check("archive", "Historial local", "ok" if archive_ok else "fail",
                         f"Base íntegra · {health.get('sessions', 0)} sesiones" if archive_ok else
                         "El historial no está disponible o requiere reparación.",
                         "Crea un respaldo y revisa Diagnóstico." if not archive_ok else ""))

    missing = [name for name in OVERLAY_BUILD if not (root / "web" / "static" / "build" / name).is_file()]
    checks.append(_check("overlays", "Overlays compilados", "ok" if not missing else "fail",
                         "Fuentes de transmisión listas." if not missing else "Faltan: " + ", ".join(missing),
                         "Ejecuta la validación completa." if missing else ""))

    tiktok_ok = bool(getattr(runtime, "TIKTOKLIVE_AVAILABLE", False))
    checks.append(_check("tiktok", "Motor de TikTok", "ok" if tiktok_ok else "fail",
                         f"TikTokLive {getattr(runtime, 'TIKTOKLIVE_VERSION', 'desconocida')}" if tiktok_ok else
                         "TikTokLive no está disponible.", "Reinstala los componentes del programa." if not tiktok_ok else ""))

    production = getattr(runtime, "production", None)
    lan = bool(getattr(getattr(runtime, "runtime_config_value", None), "lan_enabled", False))
    protected = bool(getattr(production, "view_token", ""))
    checks.append(_check("lan", "Acceso desde la red", "ok" if not lan or protected else "fail",
                         "Desactivado; el panel solo escucha en este equipo." if not lan else
                         "Activado con clave para overlays y datos públicos." if protected else
                         "La red local está activa sin una clave de lectura.",
                         "Desactiva LAN hasta configurar una clave." if lan and not protected else ""))

    connected = bool(runtime.state.get("connected"))
    checks.append(_check("live", "Conexión del directo", "ok" if connected else "warn",
                         "LIVE conectado y recibiendo datos." if connected else
                         "Sin LIVE; puedes terminar la preparación y probar localmente.",
                         "Abre Transmisión para conectar." if not connected else "", required=False))

    voices_ready = bool(getattr(runtime, "local_tts", None) and runtime.local_tts.ready())
    model_ready = all((kokoro_assets(root) / name).is_file()
                      for name in ("kokoro-v1.0.onnx", "voices-v1.0.bin"))
    checks.append(_check("voice", "Voz local", "ok" if voices_ready else "warn",
                         "Motor local verificado." if voices_ready else
                         "Modelos presentes; falta verificar el motor." if model_ready else
                         "La voz local de alta calidad es opcional y no está instalada.",
                         "Instala o revisa la voz desde Componentes." if not voices_ready else "", required=False))

    microphone_ready = (microphone_speech_model(root) / "am" / "final.mdl").is_file()
    checks.append(_check("captions", "Subtítulos del micrófono", "ok" if microphone_ready else "warn",
                         "Modelo español disponible." if microphone_ready else
                         "Modelo local no instalado; los subtítulos son opcionales.", required=False))

    backup = _latest_backup(storage)
    if backup:
        age_days = max(0, int((time.time() - backup.stat().st_mtime) / 86400))
        status = "ok" if age_days <= 7 else "warn"
        detail = "Respaldo de hoy." if age_days == 0 else f"Último respaldo hace {age_days} días."
    else:
        status, detail = "warn", "Todavía no hay un respaldo local."
    checks.append(_check("backup", "Respaldo reciente", status, detail,
                         "Crea un respaldo desde Historial." if status == "warn" else "", required=False))

    required = [item for item in checks if item["required"]]
    return {
        "ready": all(item["status"] != "fail" for item in required),
        "checks": checks,
        "summary": {name: sum(item["status"] == name for item in checks) for name in ("ok", "warn", "fail")},
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
