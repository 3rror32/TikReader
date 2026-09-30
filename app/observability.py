"""Logging rotativo y métricas pequeñas para diagnósticos locales."""
import logging
import time
from collections import Counter
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from threading import Lock


class RuntimeMetrics:
    def __init__(self):
        self.started_at = time.time(); self._counts = Counter(); self._lock = Lock()

    def increment(self, name, amount=1):
        with self._lock: self._counts[name] += amount

    def snapshot(self):
        with self._lock: counts = dict(self._counts)
        return {"uptime_seconds": round(time.time() - self.started_at), **counts}


def configure_logging(folder: Path, level="INFO"):
    folder.mkdir(parents=True, exist_ok=True)
    # The bundled app is a local service. Per-asset access lines can create
    # hundreds of thousands of entries during one broadcast without adding
    # diagnostic value; warnings and real application events remain visible.
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    logging.getLogger("engineio.server").setLevel(logging.WARNING)
    logging.getLogger("socketio.server").setLevel(logging.WARNING)
    logger = logging.getLogger("tikreader")
    if logger.handlers: return logger
    logger.setLevel(getattr(logging, level, logging.INFO))
    handler = TimedRotatingFileHandler(folder / "tikreader.log", when="midnight", backupCount=30, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    logger.addHandler(handler)
    return logger
