from pathlib import Path as _BootstrapPath
import sys as _bootstrap_sys
_bootstrap_sys.path.insert(0, str(_BootstrapPath(__file__).resolve().parent.parent / 'app'))
"""Mueve diagnósticos heredados de la raíz a data/diagnostics sin borrarlos."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / 'data' / 'diagnostics'


def organize() -> list[str]:
    TARGET.mkdir(parents=True, exist_ok=True)
    moved = []
    patterns = ('server-*.log', 'soak-*.log', 'soak-*.json')
    for pattern in patterns:
        for source in ROOT.glob(pattern):
            if not source.is_file():
                continue
            destination = TARGET / source.name
            if destination.exists():
                destination = TARGET / f'{source.stem}-legacy{source.suffix}'
            shutil.move(str(source), str(destination))
            moved.append(source.name)
    return moved


if __name__ == '__main__':
    result = organize()
    print(f'Diagnósticos organizados: {len(result)}')
