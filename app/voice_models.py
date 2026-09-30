"""Conector local y aislado para modelos RVC; nunca expone rutas arbitrarias."""
from __future__ import annotations

import os
import json
from pathlib import Path
import re
import subprocess
import tempfile
import atexit
import queue
import threading
from uuid import uuid4

from flask import jsonify, request, send_file
from app_paths import data_dir, voice_models_dir


class VoiceModels:
    def __init__(self, app, root: Path):
        self.root = root.resolve()
        self.models = voice_models_dir(self.root).resolve()
        self.models.mkdir(parents=True, exist_ok=True)
        self.rvc_root = Path(os.getenv('TIKREADER_RVC_ROOT', data_dir(self.root) / 'rvc')).resolve()
        self.rvc_python = Path(os.getenv('TIKREADER_RVC_PYTHON', self.rvc_root / '.venv' / 'Scripts' / 'python.exe')).resolve()
        self.cli = self.rvc_root / 'infer' / 'cli.py'
        self.gpu_runner = Path(__file__).with_name('rvc_gpu_runner.py')
        self.last_gpu = None
        self.keep_warm = False
        self._worker = None
        self._worker_model = None
        self._replies = None
        self._release_generation = 0
        self._render_lock = threading.Lock()
        atexit.register(self._stop_worker)
        self.register(app)

    def catalog(self):
        rows = []
        for model in self.models.glob('*/*.pth'):
            if not model.is_file():
                continue
            indexes = sorted(model.parent.glob('*.index'))
            name = model.parent.name.replace('_', ' ').replace('-', ' ').title()
            try:
                metadata = json.loads((model.parent / 'name.json').read_text(encoding='utf-8'))
                if isinstance(metadata, str) and metadata.strip():
                    name = metadata
            except (OSError, ValueError):
                pass
            rows.append({
                'id': model.parent.name,
                'name': name,
                'model': model.name,
                'index': indexes[0].name if indexes else None,
                'bytes': model.stat().st_size + sum(path.stat().st_size for path in indexes),
            })
        return sorted(rows, key=lambda row: row['name'].casefold())

    def runtime(self):
        required = [self.cli, self.rvc_python,
                    self.rvc_root / 'assets' / 'hubert_base' / 'config.json',
                    self.rvc_root / 'assets' / 'rmvpe' / 'rmvpe.pt',
                    self.rvc_root / 'assets' / 'piper' / 'es_MX-ald-medium.onnx']
        ready = all(path.is_file() for path in required)
        return {
            'ready': ready,
            'device': ('Solo GPU CUDA · ' + self.last_gpu['name']) if self.last_gpu else 'Solo GPU CUDA · pendiente de comprobar al convertir',
            'gpu_only': True,
            'last_gpu': self.last_gpu,
            'keep_warm': self.keep_warm,
            'warm_loaded': self._worker is not None and self._worker.poll() is None,
            'detail': 'Motor RVC listo.' if ready else 'Falta instalar el runtime RVC aislado.',
            'models': self.catalog(),
        }

    def resolve_model(self, model_id):
        if not isinstance(model_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', model_id):
            raise ValueError('Modelo inválido')
        folder = (self.models / model_id).resolve()
        if folder.parent != self.models:
            raise ValueError('Modelo inválido')
        model = next(folder.glob('*.pth'), None)
        index = next(folder.glob('*.index'), None)
        if not model or not model.is_file():
            raise ValueError('Modelo no encontrado')
        return model, index

    def delete_model(self, model_id):
        with self._render_lock:
            model, _ = self.resolve_model(model_id)
            folder = model.parent
            files = [*folder.glob('*.pth'), *folder.glob('*.index')]
            if (folder / 'name.json').exists():
                files.append(folder / 'name.json')
            if any(path.resolve().parent != folder for path in files):
                raise ValueError('Modelo inválido')
            if self._worker_model is not None and self._worker_model.parent == folder:
                self._stop_worker()
            for path in files:
                path.unlink()
            if not any(folder.iterdir()):
                folder.rmdir()

    def synthesize_base(self, text, output):
        # Piper crea una voz base local; RVC transforma después el timbre.
        piper_model = self.rvc_root / 'assets' / 'piper' / 'es_MX-ald-medium.onnx'
        if not piper_model.is_file():
            raise RuntimeError('Falta la voz base Piper en español')
        subprocess.run(
            [str(self.rvc_python), '-m', 'piper', '--model', str(piper_model),
             '--output-file', str(output), '--length-scale', '1.05'],
            input=text + '\n', text=True, check=True, timeout=30, capture_output=True,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
        )

    def _stop_worker(self):
        process = self._worker
        self._worker = None
        self._worker_model = None
        if process is not None:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
            process.stdin.close()
            process.stdout.close()

    def set_keep_warm(self, enabled):
        if not isinstance(enabled, bool):
            raise ValueError('El ajuste debe ser verdadero o falso')
        self.keep_warm = enabled
        # Never interrupt an ongoing conversion. Its finally block releases it.
        if not enabled and self._render_lock.acquire(blocking=False):
            try:
                self._stop_worker()
            finally:
                self._render_lock.release()

    def unload(self):
        """Invalidate queued conversions and release the worker after current work."""
        self._release_generation += 1
        self.keep_warm = False
        with self._render_lock:
            self.keep_warm = False
            self._stop_worker()
            return self.runtime()

    def _start_worker(self, model, index):
        if self._worker_model != model or self._worker is None or self._worker.poll() is not None:
            self._stop_worker()
            command = [str(self.rvc_python), str(self.gpu_runner), str(self.rvc_root),
                       '--worker', '--model', str(model), '--index-rate', '0.75' if index else '0']
            if index:
                command += ['--index', str(index)]
            process = subprocess.Popen(command, cwd=self.rvc_root, stdin=subprocess.PIPE,
                                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                       text=True, encoding='utf-8',
                                       env={**os.environ, 'PYTHONUTF8': '1', 'PYTHONIOENCODING': 'utf-8',
                                            'TIKREADER_PARENT_PID': str(os.getpid())},
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            replies = queue.Queue()
            self._worker, self._worker_model, self._replies = process, model, replies

            def read_replies():
                try:
                    for line in process.stdout:
                        if line.startswith(('TIKREADER_READY=', 'TIKREADER_RESULT=')):
                            replies.put(json.loads(line.split('=', 1)[1]))
                finally:
                    replies.put({'ok': False})
            threading.Thread(target=read_replies, daemon=True).start()
            try:
                ready = replies.get(timeout=90)
            except queue.Empty as exc:
                raise RuntimeError('RVC agotó el tiempo de precarga') from exc
            if not ready.get('ok') or not ready.get('gpu', {}).get('device', '').startswith('cuda:'):
                raise RuntimeError('RVC no pudo precargarse en CUDA')
            self.last_gpu = ready['gpu']
        return self._worker

    def preload(self, model_id):
        generation = self._release_generation
        with self._render_lock:
            if generation != self._release_generation:
                raise RuntimeError('La selección de voz cambió durante la precarga.')
            if not self.runtime()['ready']:
                raise RuntimeError('Falta instalar el runtime RVC aislado.')
            model, index = self.resolve_model(model_id)
            self.keep_warm = True
            try:
                self._start_worker(model, index)
                if generation != self._release_generation:
                    self.keep_warm = False
                    self._stop_worker()
            except Exception:
                self._stop_worker()
                raise
            return self.runtime()

    def _render_warm(self, model, index, text, target, pitch):
        self._start_worker(model, index)
        self._worker.stdin.write(json.dumps({'text': text, 'output': str(target), 'pitch': pitch}) + '\n')
        self._worker.stdin.flush()
        try:
            reply = self._replies.get(timeout=90)
        except queue.Empty as exc:
            raise RuntimeError('RVC agotó el tiempo de espera') from exc
        if not reply.get('ok') or not reply.get('gpu', {}).get('device', '').startswith('cuda:'):
            raise RuntimeError('RVC no confirmó conversión CUDA')
        self.last_gpu = reply['gpu']

    def render(self, text, model_id, pitch=0):
        generation = self._release_generation
        with self._render_lock:
            if generation != self._release_generation:
                raise RuntimeError('La selección de voz cambió; lectura cancelada.')
            try:
                return self._render(text, model_id, pitch)
            except Exception:
                self._stop_worker()
                raise
            finally:
                if not self.keep_warm:
                    self._stop_worker()

    def _render(self, text, model_id, pitch=0):
        status = self.runtime()
        if not status['ready']:
            raise RuntimeError(status['detail'])
        model, index = self.resolve_model(model_id)
        with tempfile.TemporaryDirectory(prefix='tikreader-voice-') as folder:
            source = Path(folder) / 'source.wav'
            target = Path(folder) / 'converted.wav'
            if self.keep_warm:
                self._render_warm(model, index, text, target, pitch)
                if not target.is_file() or target.stat().st_size < 44:
                    raise RuntimeError('RVC no produjo audio')
                return target.read_bytes()
            self.synthesize_base(text, source)
            command = [str(self.rvc_python), str(self.gpu_runner), str(self.rvc_root), '--model', str(model),
                       '--input', str(source), '--output', str(target), '--pitch', str(pitch),
                       '--f0-method', 'rmvpe', '--index-rate', '0.75', '--overwrite']
            if index:
                command += ['--index', str(index)]
            environment = {**os.environ, 'PYTHONUTF8': '1', 'PYTHONIOENCODING': 'utf-8',
                           'TIKREADER_PARENT_PID': str(os.getpid())}
            result = subprocess.run(command, cwd=self.rvc_root, check=True, timeout=90, capture_output=True,
                           env=environment,
                           creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            output = result.stdout.decode('utf-8', errors='replace')
            gpu_lines = [line for line in output.splitlines() if line.startswith('TIKREADER_GPU=')]
            if not gpu_lines:
                raise RuntimeError('RVC no confirmó inferencia CUDA.')
            self.last_gpu = json.loads(gpu_lines[-1].split('=', 1)[1])
            if not target.is_file() or target.stat().st_size < 44:
                raise RuntimeError('RVC no produjo audio')
            return target.read_bytes()

    def register(self, app):
        @app.post('/voice-models/unload')
        def unload_voice_model():
            try:
                return jsonify(self.unload())
            except (OSError, subprocess.SubprocessError):
                return jsonify(error='No se pudo confirmar la liberación de RVC.'), 503

        @app.post('/voice-models/settings')
        def voice_model_settings():
            data = request.get_json(silent=True)
            try:
                self.set_keep_warm(data.get('keep_warm') if isinstance(data, dict) else None)
            except ValueError as exc:
                return jsonify(error=str(exc)), 400
            return jsonify(self.runtime())

        @app.get('/voice-models')
        def voice_models():
            return jsonify(self.runtime())

        @app.post('/voice-models/preload')
        def preload_voice_model():
            data = request.get_json(silent=True) or {}
            try:
                return jsonify(self.preload(data.get('model')))
            except ValueError as exc:
                return jsonify(error=str(exc)), 400
            except (RuntimeError, OSError, subprocess.SubprocessError):
                return jsonify(error='No se pudo precargar RVC en la GPU CUDA.'), 503

        @app.post('/voice-models/upload')
        def upload_voice_model():
            if request.content_length is None or request.content_length > 125 * 1024 * 1024:
                return jsonify(error='El límite total es 125 MB'), 413
            model = request.files.get('model')
            index = request.files.get('index')
            name = request.form.get('name', '').strip()
            if not model or not model.filename.lower().endswith('.pth'):
                return jsonify(error='Selecciona un modelo .pth'), 400
            if index and not index.filename.lower().endswith('.index'):
                return jsonify(error='El índice debe terminar en .index'), 400
            slug = re.sub(r'[^A-Za-z0-9_-]+', '-', name).strip('-')[:60] or f'modelo-{uuid4().hex[:8]}'
            folder = self.models / slug
            if folder.resolve().parent != self.models:
                return jsonify(error='Nombre de modelo inválido'), 400
            if folder.exists() and any(folder.glob('*.pth')):
                return jsonify(error='Ya existe un modelo con ese nombre'), 409
            folder.mkdir(exist_ok=True)
            model.save(folder / 'model.pth')
            if index:
                index.save(folder / 'model.index')
            (folder / 'name.json').write_text(json.dumps(name or slug, ensure_ascii=False), encoding='utf-8')
            return jsonify(ok=True, model=slug, runtime=self.runtime()), 201

        @app.delete('/voice-models/<model_id>')
        def delete_voice_model(model_id):
            try:
                self.delete_model(model_id)
            except ValueError as exc:
                return jsonify(error=str(exc)), 400
            except (OSError, subprocess.SubprocessError):
                return jsonify(error='No se pudo borrar el modelo. Comprueba que ningún otro programa lo tenga abierto.'), 503
            return jsonify(ok=True, runtime=self.runtime())

        @app.post('/voice-models/render')
        def render_voice_model():
            data = request.get_json(silent=True) or {}
            text = str(data.get('text', '')).strip()
            if not text or len(text) > 400:
                return jsonify(error='El texto debe tener entre 1 y 400 caracteres'), 400
            try:
                pitch = max(-12, min(12, int(data.get('pitch', 0))))
                audio = self.render(text, data.get('model'), pitch)
            except ValueError as exc:
                return jsonify(error=str(exc)), 400
            except (RuntimeError, OSError, subprocess.SubprocessError):
                return jsonify(error='RVC requiere GPU CUDA. La conversión falló; no se usó una voz alternativa.'), 503
            from io import BytesIO
            return send_file(BytesIO(audio), mimetype='audio/wav', download_name='voz-rvc.wav')
