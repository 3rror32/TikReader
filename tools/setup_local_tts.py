"""Explicit, one-time installation. Speech generation never downloads files."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import urllib.request
import venv

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / 'runtime' / 'kokoro'
ASSETS = ROOT / 'assets' / 'kokoro'
RELEASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'


def main():
    python = RUNTIME / ('Scripts/python.exe' if sys.platform == 'win32' else 'bin/python')
    if not python.exists():
        venv.EnvBuilder(with_pip=True).create(RUNTIME)
    subprocess.run([str(python), '-m', 'pip', 'install', 'kokoro-onnx==0.4.9'], check=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    sources = {
        'kokoro-v1.0.onnx': RELEASE + 'kokoro-v1.0.onnx',
        'voices-v1.0.bin': RELEASE + 'voices-v1.0.bin',
        'MODEL_LICENSE': 'https://www.apache.org/licenses/LICENSE-2.0.txt',
        'MODEL_CARD.md': 'https://huggingface.co/hexgrad/Kokoro-82M/raw/main/README.md',
        'VOICES.md': 'https://huggingface.co/hexgrad/Kokoro-82M/raw/main/VOICES.md',
        'ENGINE_LICENSE': 'https://raw.githubusercontent.com/thewh1teagle/kokoro-onnx/main/LICENSE',
    }
    manifest = {}
    for name, url in sources.items():
        path = ASSETS / name
        if not path.exists():
            print('Descargando ' + name, flush=True)
            temporary = path.with_suffix(path.suffix + '.part')
            with urllib.request.urlopen(url, timeout=90) as response, temporary.open('wb') as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            temporary.replace(path)
        manifest[name] = {'url': url, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    (ASSETS / 'sources.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('Kokoro local instalado. Reinicia TikReader para ver las voces.', flush=True)


if __name__ == '__main__':
    main()
