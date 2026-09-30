"""Build a clean Windows x64 payload; never package workspace user data."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'release'
CACHE = OUT / 'cache'
PAYLOAD = OUT / 'TikReader'
PY_VERSION = '3.13.15'
PY_SHA256 = 'd1f04d990aee1253d8569e8e5104e30fa9f5fa830899f14843448872d936a2cf'
OVERLAY_BUILD = ('runtime.js', 'broadcast.js', 'broadcast.css', 'studio.js', 'controlCenter.js')
SPEECH_MODEL = 'vosk-model-small-es-0.42'


def build_overlays():
    """Compile when Node is available; otherwise require a checked-in production build."""
    npm = shutil.which('npm.cmd') or shutil.which('npm')
    if npm:
        subprocess.run([npm, 'run', 'build:overlays'], cwd=ROOT, check=True)
    missing = [name for name in OVERLAY_BUILD if not (ROOT / 'web' / 'static' / 'build' / name).is_file()]
    if missing:
        raise RuntimeError('Falta compilar los overlays: ' + ', '.join(missing))


def download_python():
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f'python-{PY_VERSION}-embed-amd64.zip'
    if not path.exists():
        with urllib.request.urlopen(f'https://www.python.org/ftp/python/{PY_VERSION}/{path.name}', timeout=90) as response:
            with path.with_suffix('.part').open('wb') as output:
                shutil.copyfileobj(response, output)
        path.with_suffix('.part').replace(path)
    if hashlib.sha256(path.read_bytes()).hexdigest() != PY_SHA256:
        raise RuntimeError('El paquete Python no coincide con el SHA-256 publicado por Python.org.')
    return path


def copy_speech_model():
    """Copy the approved local caption model after checking every file."""
    speech = ROOT / 'data' / 'speech'
    source = speech / SPEECH_MODEL
    manifest_path = speech / 'model-sha256.json'
    if not manifest_path.is_file():
        raise RuntimeError('Falta el manifiesto del modelo español de subtítulos.')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    actual = {path.relative_to(source).as_posix() for path in source.rglob('*') if path.is_file()}
    if actual != set(manifest):
        raise RuntimeError('Los archivos del modelo español no coinciden con el manifiesto aprobado.')
    for relative, expected in manifest.items():
        path = source / relative
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise RuntimeError(f'El modelo español no superó la verificación: {relative}')
    target = PAYLOAD / 'assets' / 'speech'
    shutil.copytree(source, target / SPEECH_MODEL, dirs_exist_ok=True)
    shutil.copy2(speech / 'sources.json', target / 'sources.json')
    shutil.copy2(manifest_path, target / manifest_path.name)


def build():
    build_overlays()
    archive = download_python()
    PAYLOAD.mkdir(parents=True, exist_ok=True)
    runtime = PAYLOAD / 'python'
    runtime.mkdir(exist_ok=True)
    if not (runtime / 'python.exe').exists():
        with zipfile.ZipFile(archive) as package:
            package.extractall(runtime)
    (runtime / 'python313._pth').write_text('python313.zip\n.\nLib/site-packages\n../app\nimport site\n', encoding='ascii')
    packages = runtime / 'Lib' / 'site-packages'
    requirement_files = [ROOT / 'requirements.txt'] + sorted((ROOT / 'packaging').glob('requirements-*.lock.txt'))
    dependency_fingerprint = hashlib.sha256(
        (PY_VERSION + '\n').encode('ascii') + b''.join(path.read_bytes() for path in requirement_files)
    ).hexdigest()
    dependency_marker = CACHE / 'dependencies-ready'
    marker_matches = dependency_marker.is_file() and dependency_marker.read_text(encoding='ascii').strip() == dependency_fingerprint
    if not marker_matches or not (packages / 'PySide6' / 'QtWebEngineWidgets.pyd').is_file():
        # These pure-Python dependencies are published only as source; build
        # their wheels here, never on the destination computer.
        for requirement in ('protobuf3-to-dict==0.1.5', 'srt==3.5.3'):
            subprocess.run([sys.executable, '-m', 'pip', 'wheel', '--no-deps',
                            '--wheel-dir', str(CACHE), requirement], check=True)
        subprocess.run([sys.executable, '-m', 'pip', 'install', '--disable-pip-version-check',
                        '--only-binary=:all:', '--python-version', '3.13', '--platform', 'win_amd64',
                        '--implementation', 'cp', '--target', str(packages), '--no-compile',
                        '--find-links', str(CACHE), '-r', str(ROOT / 'requirements.txt'),
                        *(['-c', str(ROOT / 'packaging/requirements-win64.lock.txt')] if (ROOT / 'packaging/requirements-win64.lock.txt').exists() else []),
                        'pip==25.3'], check=True)
        dependency_marker.write_text(dependency_fingerprint, encoding='ascii')
    for name in ('app', 'web', 'assets/icons', 'assets/sprites'):
        shutil.copytree(ROOT / name, PAYLOAD / name, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '*.log'))
    copy_speech_model()
    (PAYLOAD / 'docs').mkdir(exist_ok=True)
    for document in (ROOT / 'docs').glob('*.md'):
        shutil.copy2(document, PAYLOAD / 'docs' / document.name)
    shutil.copytree(ROOT / 'packaging' / 'licenses', PAYLOAD / 'docs' / 'licenses', dirs_exist_ok=True)
    for lockfile in (ROOT / 'packaging').glob('requirements-*.lock.txt'):
        shutil.copy2(lockfile, PAYLOAD / 'docs' / lockfile.name)
    shutil.copy2(ROOT / 'packaging' / 'licenses' / 'KOKORO_MODEL_LICENSE.txt', PAYLOAD / 'docs' / 'KOKORO_MODEL_LICENSE.txt')
    for name in ('desktop_launch.pyw', '.env.example'):
        shutil.copy2(ROOT / 'packaging' / name, PAYLOAD / name)
    shutil.copy2(archive, PAYLOAD / 'python-runtime.zip')
    sys.path.insert(0, str(ROOT / 'app'))
    from app_config import APP_VERSION
    (PAYLOAD / 'distribution.json').write_text(json.dumps({'version': APP_VERSION, 'channel': 'beta',
        'python': PY_VERSION, 'python_sha256': PY_SHA256, 'architecture': 'x64'}), encoding='utf-8')
    forbidden = [p for p in PAYLOAD.rglob('*') if p.name in ('.env', '.flask-secret', 'history.sqlite3') or p.suffix in ('.pth', '.onnx', '.index')]
    # Python's isolation files end in ._pth, not .pth. Personal voice weights
    # never ship; the approved Vosk model uses its own verified manifest.
    if forbidden:
        raise RuntimeError('El paquete contiene archivos personales o modelos: ' + str(forbidden))
    manifest = {p.relative_to(PAYLOAD).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in PAYLOAD.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc'}
    (OUT / 'payload-sha256.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Payload listo: {PAYLOAD}', flush=True)


if __name__ == '__main__':
    build()
