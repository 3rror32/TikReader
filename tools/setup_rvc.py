from pathlib import Path as _BootstrapPath
import sys as _bootstrap_sys
_bootstrap_sys.path.insert(0, str(_BootstrapPath(__file__).resolve().parent.parent / 'app'))
"""Instala el runtime oficial RVC en data/rvc, separado de TikReader."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / 'data' / 'rvc'


def run(command, cwd=None):
    subprocess.run(command, cwd=cwd or ROOT, check=True)


if __name__ == '__main__':
    if not shutil.which('git'):
        raise SystemExit('Git no está instalado.')
    try:
        import uv  # noqa: F401
    except ImportError:
        raise SystemExit('Falta uv. Ejecuta: python -m pip install uv')
    if not (TARGET / '.git').is_dir():
        run(['git', 'clone', '--depth', '1',
             'https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git', str(TARGET)])
    run([sys.executable, '-m', 'uv', 'venv', '--clear', '--python', '3.12', str(TARGET / '.venv')])
    python = TARGET / '.venv' / 'Scripts' / 'python.exe'
    requirements = TARGET / 'requirments_cu128_py312.txt'
    run([sys.executable, '-m', 'uv', 'pip', 'install', '--python', str(python),
         'torch==2.7.1+cu128', 'torchaudio==2.7.1+cu128',
         '--index-url', 'https://download.pytorch.org/whl/cu128'])
    run([sys.executable, '-m', 'uv', 'pip', 'install', '--python', str(python), '-r', str(requirements)])
    run([sys.executable, '-m', 'uv', 'pip', 'install', '--python', str(python), 'piper-tts'])
    piper = TARGET / 'assets' / 'piper'
    piper.mkdir(parents=True, exist_ok=True)
    run([str(python), '-m', 'piper.download_voices', 'es_MX-ald-medium',
         '--download-dir', str(piper)])
    hf = TARGET / '.venv' / 'Scripts' / 'hf.exe'
    run([str(hf), 'download', 'lj1995/VoiceConversionWebUI', '--revision', 'main',
         '--include', 'hubert_base/*', '--local-dir', str(TARGET / 'assets')])
    run([str(hf), 'download', 'lj1995/VoiceConversionWebUI', 'rmvpe.pt', '--revision', 'main',
         '--local-dir', str(TARGET / 'assets' / 'rmvpe')])
    downloader = TARGET / 'tools' / 'download_models.py'
    if downloader.is_file():
        run([str(python), str(downloader)], cwd=TARGET)
    print('Runtime RVC instalado. Reinicia TikReader y abre Voz > Modelo personalizado local.')
