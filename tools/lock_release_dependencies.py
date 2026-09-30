"""Record the exact dependencies exercised by release validation."""
from importlib.metadata import distributions
from pathlib import Path

root = Path(__file__).resolve().parent.parent
for folder, output in (
    (root / 'release/TikReader/python/Lib/site-packages', 'requirements-win64.lock.txt'),
    (root / 'release/preview-data/runtimes/kokoro/Lib/site-packages', 'requirements-kokoro.lock.txt'),
):
    if not folder.is_dir():
        raise RuntimeError('Primero construye y valida el paquete y Kokoro.')
    lines = sorted(f'{dist.metadata["Name"]}=={dist.version}' for dist in distributions(path=[str(folder)]))
    (root / 'packaging' / output).write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(output, len(lines))
