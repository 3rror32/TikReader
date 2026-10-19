"""Opt-in history backups with bounded retention."""
from __future__ import annotations

import sqlite3
import math
import threading
import time
from pathlib import Path
from uuid import uuid4


DEFAULTS = {"enabled": False, "interval_hours": 24, "keep": 7, "last_at": 0.0, "last_file": "", "last_error": "",
            "last_attempt_at": 0.0, "next_at": 0.0, "status_error": ""}
INTERVALS = {6, 12, 24, 72, 168}
RETENTION = {3, 7, 14, 30}


class AutomaticBackups:
    def __init__(self, runtime):
        self.runtime = runtime
        self.lock = threading.RLock()
        self.wake = threading.Event()
        self.stop_event = threading.Event()
        self.thread = None
        self.config = dict(DEFAULTS)
        self.failures = 0
        self.create_lock = threading.Lock()

    def load(self):
        archive = self.runtime.archive
        try:
            saved = archive.settings().get("automatic_backups", {}) if archive else {}
        except (OSError, ValueError, sqlite3.Error):
            self.config["status_error"] = "No se pudo leer la programación de respaldos."
            return
        def timestamp(value):
            try:
                number = float(value or 0)
                return max(0.0, number) if math.isfinite(number) else 0.0
            except (ValueError, TypeError):
                return 0.0
        if isinstance(saved, dict):
            enabled = saved.get("enabled") is True
            interval = saved.get("interval_hours", 24)
            keep = saved.get("keep", 7)
            # Legacy last_at also stored opt-in/attempt anchors, without proving success.
            # Derive a stable deadline before projecting the truthful success timestamp.
            legacy_anchor = timestamp(saved.get("last_attempt_at")) or timestamp(saved.get("last_at"))
            legacy_deadline = legacy_anchor + (interval if interval in INTERVALS else 24) * 3600
            self.config.update(
                enabled=enabled,
                interval_hours=interval if interval in INTERVALS else 24,
                keep=keep if keep in RETENTION else 7,
                last_at=timestamp(saved.get("last_at")) if saved.get("last_file") else 0.0,
                last_attempt_at=timestamp(saved.get("last_attempt_at")),
                next_at=timestamp(saved.get("next_at")) or legacy_deadline,
                last_file=str(saved.get("last_file", ""))[:180],
                last_error=str(saved.get("last_error", ""))[:300],
            )

    def start(self):
        self.load()
        if self.thread and self.thread.is_alive():
            return
        self.thread = threading.Thread(target=self._worker, daemon=True, name="automatic-backups")
        self.thread.start()

    def close(self):
        self.stop_event.set()
        self.wake.set()
        if self.thread and self.thread is not threading.current_thread():
            self.thread.join(timeout=3)

    def snapshot(self):
        with self.lock:
            result = dict(self.config)
        if not result["enabled"]:
            result["next_at"] = 0
        result["scope"] = "Solo la base de datos del historial y sus ajustes guardados; no incluye medios, modelos, credenciales ni archivos externos."
        result["available"] = self.runtime.archive is not None
        result["starts_disabled"] = True
        return result

    def configure(self, values):
        if not isinstance(values, dict) or not isinstance(values.get("enabled"), bool):
            raise ValueError("Indica si deseas activar los respaldos automáticos.")
        try:
            interval = int(values.get("interval_hours", 24))
            keep = int(values.get("keep", 7))
        except (TypeError, ValueError) as exc:
            raise ValueError("Configuración de respaldo inválida.") from exc
        if interval not in INTERVALS or keep not in RETENTION:
            raise ValueError("Elige una frecuencia y retención disponibles.")
        with self.lock:
            previous = dict(self.config)
            was_enabled = self.config["enabled"]
            self.config.update(enabled=values["enabled"], interval_hours=interval, keep=keep, last_error="")
            if values["enabled"] and not was_enabled:
                # Enabling schedules the first backup; it never creates one during the opt-in request.
                self.config["next_at"] = time.time() + interval * 3600
            elif values["enabled"] and interval != previous["interval_hours"]:
                self.config["next_at"] = time.time() + interval * 3600
            try:
                self._save()
            except (OSError, ValueError, sqlite3.Error):
                self.config = previous
                raise
        self.wake.set()
        return self.snapshot()

    def _save(self):
        if self.runtime.archive:
            self.runtime.archive.set_setting("automatic_backups", dict(self.config))

    def _save_status(self):
        try:
            self._save()
            self.config["status_error"] = ""
        except (OSError, ValueError, sqlite3.Error):
            self.config["status_error"] = "No se pudo guardar el estado; se mantiene en esta sesión."

    def create(self, manual=False):
        with self.create_lock:
            archive = self.runtime.archive
            if not archive:
                raise ValueError("El historial no está disponible.")
            now = time.time()
            with self.lock:
                self.config["last_attempt_at"] = now
            target = None
            try:
                folder = Path(archive.path).resolve().parent / "backups"
                folder.mkdir(parents=True, exist_ok=True)
                prefix = "tikreader-manual" if manual else "tikreader-auto"
                target = folder / f"{prefix}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:8]}.sqlite3"
                with self.runtime.feed_lock:
                    archive.backup(target)
            except (OSError, ValueError, sqlite3.Error):
                with self.lock:
                    self.failures = min(self.failures + 1, 5)
                    self.config.update(last_error="No se pudo crear el respaldo. Revisa espacio y disponibilidad del historial.",
                                       next_at=time.time() + min(3600, 300 * 2 ** (self.failures - 1)))
                    self._save_status()
                if target is not None:
                    try:
                        target.unlink(missing_ok=True)
                    except OSError:
                        pass
                raise
            with self.lock:
                self.failures = 0
                self.config.update(last_at=time.time(), last_file=target.name, last_error="",
                                   next_at=time.time() + self.config["interval_hours"] * 3600)
                self._save_status()
            if not manual:
                try:
                    self._prune(folder)
                except OSError:
                    with self.lock:
                        self.config["status_error"] = "Respaldo creado; no se pudo completar la retención."
            return target

    def _prune(self, folder):
        keep = self.snapshot()["keep"]
        files = sorted(folder.glob("tikreader-auto-*.sqlite3"), key=lambda item: item.stat().st_mtime, reverse=True)
        root = folder.resolve()
        for path in files[keep:]:
            if not path.is_symlink() and path.resolve().parent == root:
                path.unlink(missing_ok=True)

    def _worker(self):
        while not self.stop_event.is_set():
            state = self.snapshot()
            if state["enabled"] and state["available"]:
                remaining = state["next_at"] - time.time()
                if remaining <= 0:
                    try:
                        self.create()
                    except (OSError, ValueError, sqlite3.Error):
                        pass  # create recorded the attempt and scheduled a bounded retry.
                    continue
                timeout = min(remaining, 3600)
            else:
                timeout = 3600
            self.wake.wait(max(1, timeout))
            self.wake.clear()
