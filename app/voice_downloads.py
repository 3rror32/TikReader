"""Explicit optional Kokoro installation into user storage, with verified models."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
import time
import urllib.request
import zipfile
from flask import jsonify, request
from app_paths import ROOT, data_dir, installed, kokoro_assets, kokoro_runtime, microphone_speech_model, voice_models_dir

MODELS = {
    'kokoro-v1.0.onnx': (325532387, '7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5'),
    'voices-v1.0.bin': (28214398, 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d'),
}
RELEASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'


class InstallationCancelled(RuntimeError):
    """The user stopped an optional voice installation."""


def file_hash(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def folder_size(path):
    path = Path(path)
    if path.is_file():
        return path.stat().st_size
    total = 0
    if path.is_dir():
        for directory, _, files in os.walk(path, onerror=lambda _: None):
            for name in files:
                try:
                    total += (Path(directory) / name).stat().st_size
                except OSError:
                    pass
    return total


class VoiceDownloads:
    def __init__(self, app, runtime):
        self.r = runtime
        self.lock = threading.Lock()
        self.state = {'status': 'idle', 'detail': '', 'downloaded': 0,
                      'model_bytes': sum(item[0] for item in MODELS.values())}
        self.cancel_event = threading.Event()
        self.component_cache = (0.0, {})
        self.register(app)

    def busy(self):
        return self.state['status'] == 'installing'

    def snapshot(self):
        return {**self.state, 'ready': self.r.local_tts.ready(),
                'can_cancel': self.busy(),
                'available': installed(), 'required_free_bytes': 2 * 1024**3,
                'engine': 'Kokoro 1.0', 'license': 'Apache-2.0 · motor MIT',
                'download_note': '354 MB de modelos más el motor y sus dependencias. Reserva 2 GB libres.'}

    def components(self):
        root = data_dir().resolve()
        definitions = [
            ('kokoro', 'Voz local Kokoro', [kokoro_assets(), kokoro_runtime()],
             'Voces naturales sin enviar texto a Internet.', installed()),
            ('rvc', 'Conversión de voz RVC', [data_dir() / 'rvc'],
             'Motor aislado y caché para modelos de personaje.', True),
            ('captions', 'Subtítulos locales', [microphone_speech_model()],
             'Reconocimiento de micrófono en español.', False),
            ('models', 'Modelos de voz personales', [voice_models_dir()],
             'Pesos e índices añadidos por el usuario.', False),
        ]
        rows = []
        cached_at, cached_sizes = getattr(self, 'component_cache', (0.0, {}))
        refresh_sizes = time.monotonic() - cached_at >= 300
        next_sizes = {} if refresh_sizes else dict(cached_sizes)
        for key, name, paths, description, removable in definitions:
            unique = []
            for path in map(Path, paths):
                resolved = path.resolve()
                if resolved not in unique:
                    unique.append(resolved)
            present = [path for path in unique if path.exists()]
            safe_removal = removable and bool(present) and all(path.is_relative_to(root) for path in present)
            if refresh_sizes or key not in next_sizes:
                next_sizes[key] = sum(folder_size(path) for path in present)
            rows.append({'id': key, 'name': name, 'description': description,
                         'installed': bool(present), 'bytes': next_sizes[key],
                         'removable': safe_removal,
                         'bundled': bool(present) and not all(path.is_relative_to(root) for path in present),
                         'action': 'install-kokoro' if key == 'kokoro' and not present else
                                   'manage-models' if key == 'models' else ''})
        if refresh_sizes:
            self.component_cache = (time.monotonic(), next_sizes)
        return {'components': rows, 'free_bytes': shutil.disk_usage(root).free,
                'busy': self.busy(), 'scope': 'Los modelos personales se eliminan individualmente desde Voz.'}

    def remove_component(self, key):
        confirmations = {'kokoro': 'ELIMINAR KOKORO', 'rvc': 'ELIMINAR RVC'}
        if key not in confirmations:
            raise ValueError('Este componente no se puede eliminar desde aquí.')
        if self.busy():
            raise ValueError('Espera a que termine la instalación de voces.')
        root = data_dir().resolve()
        targets = [kokoro_assets(), kokoro_runtime()] if key == 'kokoro' else [data_dir() / 'rvc']
        resolved = [Path(path).resolve() for path in targets]
        if any(not path.is_relative_to(root) or path == root or path.is_symlink() for path in resolved):
            raise ValueError('El componente forma parte del programa y no se puede quitar aquí.')
        if key == 'kokoro':
            self.r.local_tts.close()
        else:
            self.r.voice_models._stop_worker()
        for path in resolved:
            if path.is_dir():
                shutil.rmtree(path)
            elif path.exists():
                path.unlink()
        self.component_cache = (0.0, {})
        self.state.update(status='idle', detail='', downloaded=0)
        return confirmations[key]

    def install(self):
        target = kokoro_runtime()
        assets = kokoro_assets()
        try:
            data_dir().mkdir(parents=True, exist_ok=True)
            if shutil.disk_usage(data_dir()).free < 2 * 1024**3:
                raise ValueError('Se necesitan al menos 2 GB libres.')
            bundle = ROOT / 'python-runtime.zip'
            manifest = json.loads((ROOT / 'distribution.json').read_text(encoding='utf-8'))
            if file_hash(bundle) != manifest['python_sha256']:
                raise ValueError('El motor incluido está dañado. Reinstala TikReader.')
            self.state.update(detail='Preparando el motor de voz…', downloaded=0)
            target.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(bundle) as package:
                for member in package.infolist():
                    if not (target / member.filename).resolve().is_relative_to(target.resolve()):
                        raise ValueError('Motor inválido.')
                package.extractall(target)
            python = target / 'python.exe'
            pth = next(target.glob('python*._pth'))
            pth.write_text(pth.stem + '.zip\n.\nLib/site-packages\nimport site\n', encoding='ascii')
            packages = target / 'Lib' / 'site-packages'
            packages.mkdir(parents=True, exist_ok=True)
            # Bootstrap only pip from the application; the voice engine has an
            # isolated environment and cannot replace application dependencies.
            shutil.copytree(ROOT / 'python' / 'Lib' / 'site-packages' / 'pip', packages / 'pip', dirs_exist_ok=True)
            logs = data_dir() / 'logs'
            logs.mkdir(exist_ok=True)
            self.state['detail'] = 'Descargando el motor de voz y sus dependencias…'
            with (logs / 'voice-install.log').open('w', encoding='utf-8') as output:
                process = subprocess.Popen([str(python), '-m', 'pip', '--isolated', 'install', '--disable-pip-version-check',
                                            '--only-binary=:all:', '--index-url', 'https://pypi.org/simple',
                                            '--target', str(packages), '--upgrade',
                                            '-r', str(ROOT / 'docs' / 'requirements-kokoro.lock.txt')],
                                           stdout=output, stderr=subprocess.STDOUT,
                                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                started = time.monotonic()
                while process.poll() is None:
                    if self.cancel_event.wait(.25):
                        process.terminate()
                        try:
                            process.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            process.kill()
                        raise InstallationCancelled()
                    if time.monotonic() - started > 1200:
                        process.kill()
                        raise ValueError('La instalación del motor excedió el tiempo permitido.')
                if process.returncode:
                    raise subprocess.CalledProcessError(process.returncode, process.args)
            assets.mkdir(parents=True, exist_ok=True)
            for name, (size, expected) in MODELS.items():
                path = assets / name
                if path.is_file() and path.stat().st_size == size and file_hash(path) == expected:
                    self.state['downloaded'] += size
                    continue
                self.state['detail'] = 'Descargando ' + name
                self._download_model(path, size, expected)
            shutil.copy2(ROOT / 'docs' / 'KOKORO_MODEL_LICENSE.txt', assets / 'MODEL_LICENSE')
            (assets / 'sources.json').write_text(json.dumps({name: {'url': RELEASE + name, 'sha256': entry[1]}
                for name, entry in MODELS.items()}), encoding='utf-8')
            self.state['detail'] = 'Verificando la generación de voz…'
            self.r.local_tts.render('Las voces de TikReader están listas.', 'ef_dora', 1)
            self.r.local_tts.close()
            self.component_cache = (0.0, {})
            self.state.update(status='complete', detail='Voces instaladas y verificadas. Ya puedes elegirlas en Voz.')
        except InstallationCancelled:
            self.state.update(status='cancelled', detail='Descarga detenida. El avance se conservará para continuar después.')
        except Exception as exc:
            self.state.update(status='failed', detail=str(exc) if isinstance(exc, ValueError) else
                'No se completó la instalación. Comprueba internet y el espacio disponible; puedes reintentar.')

    def _download_model(self, path, size, expected):
        """Download a verified model, preserving a safe partial file for a later retry."""
        temporary = path.with_suffix(path.suffix + '.part')
        offset = temporary.stat().st_size if temporary.is_file() else 0
        if offset > size:
            temporary.unlink(missing_ok=True)
            offset = 0
        headers = {'Range': f'bytes={offset}-'} if offset else {}
        response = urllib.request.urlopen(urllib.request.Request(RELEASE + path.name, headers=headers), timeout=90)
        status = getattr(response, 'status', response.getcode())
        if offset and status != 206:
            response.close()
            temporary.unlink(missing_ok=True)
            offset = 0
            response = urllib.request.urlopen(urllib.request.Request(RELEASE + path.name), timeout=90)
        self.state['downloaded'] += offset
        try:
            with response, temporary.open('ab' if offset else 'wb') as output:
                received = offset
                while chunk := response.read(1024 * 1024):
                    if self.cancel_event.is_set():
                        raise InstallationCancelled()
                    received += len(chunk)
                    if received > size:
                        raise ValueError('La descarga excede el tamaño esperado.')
                    output.write(chunk)
                    self.state['downloaded'] += len(chunk)
            if received != size or file_hash(temporary) != expected:
                temporary.unlink(missing_ok=True)
                raise ValueError('La descarga no superó la verificación. Puedes reintentar.')
            temporary.replace(path)
        except InstallationCancelled:
            raise
        except Exception:
            if temporary.is_file() and temporary.stat().st_size >= size:
                temporary.unlink(missing_ok=True)
            raise

    def register(self, app):
        @app.get('/system/voices')
        def voice_download_status():
            if not self.r.production.local():
                return jsonify(error='Solo disponible desde este equipo.'), 403
            return jsonify(self.snapshot())

        @app.post('/system/voices/install')
        def voice_download_install():
            if not self.r.production.local() or request.get_json(silent=True) != {'confirm': True}:
                return jsonify(error='Confirma la descarga de voces.'), 400
            if not installed():
                return jsonify(error='La descarga guiada está disponible en la versión instalada.'), 409
            with self.lock:
                if self.busy():
                    return jsonify(error='Ya hay una descarga en curso.'), 409
                if self.r.local_tts.ready():
                    return jsonify(self.snapshot())
                self.cancel_event.clear()
                self.state.update(status='installing', detail='Preparando descarga…', downloaded=0)
                threading.Thread(target=self.install, daemon=True).start()
            return jsonify(self.snapshot()), 202

        @app.post('/system/voices/cancel')
        def voice_download_cancel():
            if not self.r.production.local() or request.get_json(silent=True) != {'confirm': True}:
                return jsonify(error='Confirma que deseas detener la descarga.'), 400
            if not self.busy():
                return jsonify(error='No hay una descarga en curso.'), 409
            self.cancel_event.set()
            self.state['detail'] = 'Deteniendo la descarga de forma segura…'
            return jsonify(self.snapshot()), 202

        @app.get('/system/components')
        def component_status():
            if not self.r.production.local():
                return jsonify(error='Solo disponible desde este equipo.'), 403
            return jsonify(self.components())

        @app.delete('/system/components/<key>')
        def component_remove(key):
            data = request.get_json(silent=True) or {}
            expected = {'kokoro': 'ELIMINAR KOKORO', 'rvc': 'ELIMINAR RVC'}.get(key)
            if not self.r.production.local() or not expected or data.get('confirmation') != expected:
                return jsonify(error='Escribe la confirmación completa para liberar el espacio.'), 400
            try:
                self.remove_component(key)
            except (ValueError, OSError) as exc:
                return jsonify(error=str(exc)), 409
            return jsonify(ok=True, **self.components())
