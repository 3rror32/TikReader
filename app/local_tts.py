"""Licensed Kokoro voices, generated locally through an isolated CPU worker."""
import atexit
import base64
import io
import json
import math
import os
from pathlib import Path
import queue
import subprocess
import threading

from flask import jsonify, request, send_file
from app_paths import kokoro_assets, kokoro_python

# Only languages supported by the bundled offline espeak phonemizer.
GROUPS = [
    ('Español', 'es', 'ef_dora em_alex em_santa'),
    ('English · United States', 'en-us', 'af_heart af_alloy af_aoede af_bella af_jessica af_kore af_nicole af_nova af_river af_sarah af_sky am_adam am_echo am_eric am_fenrir am_liam am_michael am_onyx am_puck am_santa'),
    ('English · United Kingdom', 'en-gb', 'bf_alice bf_emma bf_isabella bf_lily bm_daniel bm_fable bm_george bm_lewis'),
    ('Français', 'fr-fr', 'ff_siwis'),
    ('Português · Brasil', 'pt-br', 'pf_dora pm_alex pm_santa'),
    ('Italiano', 'it', 'if_sara im_nicola'),
    ('हिन्दी · Hindi', 'hi', 'hf_alpha hf_beta hm_omega hm_psi'),
]
VOICES = {key: {'id': key, 'name': key.split('_', 1)[1].title(), 'language': label,
                'lang': lang, 'gender': 'Femenina' if key[1] == 'f' else 'Masculina'}
          for label, lang, keys in GROUPS for key in keys.split()}


class LocalTTS:
    def __init__(self, app, root):
        self.root = Path(root).resolve()
        self.assets = kokoro_assets(self.root)
        self.python = kokoro_python(self.root)
        self.process = None
        self.lock = threading.Lock()
        atexit.register(self.close)
        self.register(app)

    def ready(self):
        self.python = kokoro_python(self.root)
        return self.python.is_file() and all((self.assets / name).is_file() for name in
                                            ('kokoro-v1.0.onnx', 'voices-v1.0.bin', 'MODEL_LICENSE', 'sources.json'))

    def close(self):
        process, self.process = self.process, None
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

    def start(self):
        if self.process is not None and self.process.poll() is None:
            return
        self.close()
        replies = queue.Queue()
        self.replies = replies
        process = subprocess.Popen(
            [str(self.python), str(Path(__file__).with_name('local_tts_worker.py')), str(self.assets)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding='utf-8', env={**os.environ, 'PYTHONUTF8': '1', 'HF_HUB_OFFLINE': '1'},
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        self.process = process

        def read():
            try:
                for line in process.stdout:
                    try:
                        replies.put(json.loads(line))
                    except ValueError:
                        continue
            finally:
                replies.put({'error': 'El motor local se cerró.'})

        threading.Thread(target=read, daemon=True).start()
        if not replies.get(timeout=60).get('ready'):
            raise RuntimeError('No se pudo cargar Kokoro.')

    def render(self, text, voice, speed):
        if not isinstance(text, str) or not 1 <= len(text.strip()) <= 400:
            raise ValueError('Escribe entre 1 y 400 caracteres.')
        if not isinstance(voice, str) or voice not in VOICES:
            raise ValueError('Voz local desconocida.')
        if isinstance(speed, bool) or not isinstance(speed, (int, float)) or not math.isfinite(speed) or not .6 <= speed <= 1.6:
            raise ValueError('La velocidad debe estar entre 0.6 y 1.6.')
        if not self.ready():
            raise RuntimeError('Falta instalar el motor local Kokoro.')
        with self.lock:
            try:
                self.start()
                self.process.stdin.write(json.dumps({'text': text.strip(), 'voice': voice,
                                                    'speed': speed, 'lang': VOICES[voice]['lang']}) + '\n')
                self.process.stdin.flush()
                reply = self.replies.get(timeout=90)
                if 'audio' not in reply:
                    raise RuntimeError('Falló la síntesis local.')
                audio = base64.b64decode(reply['audio'], validate=True)
                if len(audio) < 44 or audio[:4] != b'RIFF':
                    raise RuntimeError('Audio local inválido.')
                return audio
            except Exception:
                self.close()
                raise

    def register(self, app):
        @app.get('/local-tts/credits')
        def local_tts_credits():
            path = self.root / 'docs' / 'LOCAL_TTS_LICENSES.md'
            return send_file(path, mimetype='text/plain; charset=utf-8')

        @app.get('/local-tts')
        def local_tts_catalog():
            return jsonify(ready=self.ready(), voices=list(VOICES.values()), engine='Kokoro 1.0',
                           license='Apache-2.0', offline=True)

        @app.post('/local-tts/render')
        def local_tts_render():
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return jsonify(error='Solicitud inválida.'), 400
            try:
                audio = self.render(data.get('text'), data.get('voice'), data.get('speed', 1))
            except ValueError as exc:
                return jsonify(error=str(exc)), 400
            except (RuntimeError, OSError, subprocess.SubprocessError, queue.Empty):
                return jsonify(error='No se pudo generar la voz local. No se usó ningún servicio en línea.'), 503
            response = send_file(io.BytesIO(audio), mimetype='audio/wav', download_name='voz-local.wav')
            response.headers['Cache-Control'] = 'no-store'
            return response
