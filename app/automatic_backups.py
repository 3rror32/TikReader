"""Opt-in history backups with bounded retention."""
from __future__ import annotations

import threading
import time
from pathlib import Path
from uuid import uuid4


DEFAULTS = {"enabled": False, "interval_hours": 24, "keep": 7, "last_at": 0.0, "last_file": "", "last_error": ""}
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

    def load(self):
        archive = self.runtime.archive
        saved = archive.settings().get("automatic_backups", {}) if archive else {}
        if isinstance(saved, dict):
            enabled = saved.get("enabled") is True
            interval = saved.get("interval_hours", 24)
            keep = saved.get("keep", 7)
            self.config.update(
                enabled=enabled,
                interval_hours=interval if interval in INTERVALS else 24,
                keep=keep if keep in RETENTION else 7,
                last_at=max(0.0, float(saved.get("last_at", 0) or 0)),
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
        interval = result["interval_hours"] * 3600
        result["next_at"] = result["last_at"] + interval if result["enabled"] else 0
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
            was_enabled = self.config["enabled"]
            self.config.update(enabled=values["enabled"], interval_hours=interval, keep=keep, last_error="")
            if values["enabled"] and not was_enabled:
                # Enabling schedules the first backup; it never creates one during the opt-in request.
                self.config["last_at"] = time.time()
            self._save()
        self.wake.set()
        return self.snapshot()

    def _save(self):
        if self.runtime.archive:
            self.runtime.archive.set_setting("automatic_backups", dict(self.config))

    def create(self, manual=False):
        archive = self.runtime.archive
        if not archive:
            raise ValueError("El historial no está disponible.")
        folder = Path(archive.path).resolve().parent / "backups"
        folder.mkdir(parents=True, exist_ok=True)
        prefix = "tikreader-manual" if manual else "tikreader-auto"
        target = folder / f"{prefix}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:8]}.sqlite3"
        with self.runtime.feed_lock:
            archive.backup(target)
        if not manual:
            with self.lock:
                self.config.update(last_at=time.time(), last_file=target.name, last_error="")
                self._save()
            self._prune(folder)
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
                    except (OSError, ValueError) as exc:
                        with self.lock:
                            self.config.update(last_at=time.time(), last_error=str(exc)[:300])
                            self._save()
                    continue
                timeout = min(remaining, 3600)
            else:
                timeout = 3600
            self.wake.wait(max(1, timeout))
            self.wake.clear()
