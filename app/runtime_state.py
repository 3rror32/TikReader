"""Contenedor para retirar el estado global gradualmente."""
from dataclasses import dataclass, field
from threading import RLock
from typing import Any


@dataclass
class RuntimeState:
    values: dict[str, Any]
    lock: RLock = field(default_factory=RLock)

    def snapshot(self, *keys):
        with self.lock:
            selected = keys or tuple(self.values)
            return {key: self.values[key] for key in selected}

    def update(self, **changes):
        with self.lock: self.values.update(changes)
