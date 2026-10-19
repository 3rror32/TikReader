"""Licensed Kokoro voices, generated locally through an isolated CPU worker."""
import atexit
import base64
import io
import json
import math
import logging
from time import monotonic
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


VOICE_ERRORS = {
    'RUNTIME_MISSING': 'Instala el motor Kokoro desde Voz y vuelve a probar.',
    'ENGINE_LOAD': 'Kokoro no pudo cargar sus modelos. Revisa la instalación del motor local.',
    'WORKER_START': 'No se pudo iniciar Kokoro. Reinicia TikReader y revisa la instalación local.',
    'WORKER_EXITED': 'El motor local se cerró. Vuelve a probar la voz.',
    'VOICE_TIMEOUT': 'La voz local agotó la espera. Reduce el texto o reinicia el motor.',
    'INVALID_JOB': 'El motor rechazó la solicitud. Vuelve a seleccionar la voz.',
    'SYNTHESIS_FAILED': 'Kokoro no pudo generar audio. Vuelve a seleccionar la voz y pulsa Probar.',
    'INVALID_AUDIO': 'El motor devolvió audio inválido. Reinicia la voz local y vuelve a probar.',
    'WORKER_PROTOCOL': 'El motor local no respondió correctamente. Reinicia TikReader.',
}


class LocalVoiceError(RuntimeError):
    def __init__(self, code, phase, elapsed_ms):
        self.code = code if isinstance(code, str) and code in VOICE_ERRORS else 'WORKER_PROTOCOL'
        self.phase = phase if phase in {'startup', 'synthesis', 'protocol'} else 'protocol'
        self.elapsed_ms = max(0, min(600000, int(elapsed_ms)))
        super().__init__(VOICE_ERRORS[self.code])

    def payload(self):
        return {'error': str(self), 'code': self.code, 'phase': self.phase, 'elapsed_ms': self.elapsed_ms}


def worker_error(reply, phase, started):
    diagnostic = reply.get('diagnostic', {}) if isinstance(reply, dict) else {}
    if not isinstance(diagnostic, dict):
        diagnostic = {}
    return LocalVoiceError(diagnostic.get('code'), phase, (monotonic() - started) * 1000)


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
                replies.put({'diagnostic': {'code': 'WORKER_EXITED'}})

        threading.Thread(target=read, daemon=True).start()
        started = monotonic()
        reply = replies.get(timeout=60)
        if not isinstance(reply, dict) or not reply.get('ready'):
            raise worker_error(reply, 'startup', started)

    def render(self, text, voice, speed):
        if not isinstance(text, str) or not 1 <= len(text.strip()) <= 400:
            raise ValueError('Escribe entre 1 y 400 caracteres.')
        if not isinstance(voice, str) or voice not in VOICES:
            raise ValueError('Voz local desconocida.')
        if isinstance(speed, bool) or not isinstance(speed, (int, float)) or not math.isfinite(speed) or not .6 <= speed <= 1.6:
            raise ValueError('La velocidad debe estar entre 0.6 y 1.6.')
        started = monotonic()
        if not self.ready():
            error = LocalVoiceError('RUNTIME_MISSING', 'startup', 0)
            self._diagnostic(error)
            raise error
        with self.lock:
            phase = "startup"
            try:
                self.start()
                phase = "synthesis"
                self.process.stdin.write(json.dumps({'text': text.strip(), 'voice': voice,
                                                    'speed': speed, 'lang': VOICES[voice]['lang']}) + '\n')
                self.process.stdin.flush()
                reply = self.replies.get(timeout=90)
                if not isinstance(reply, dict) or 'audio' not in reply:
                    raise worker_error(reply, phase, started)
                try:
                    audio = base64.b64decode(reply['audio'], validate=True)
                except (ValueError, TypeError):
                    raise LocalVoiceError('INVALID_AUDIO', 'protocol', (monotonic() - started) * 1000)
                if len(audio) < 44 or audio[:4] != b'RIFF':
                    raise LocalVoiceError('INVALID_AUDIO', 'protocol', (monotonic() - started) * 1000)
                return audio
            except Exception as exc:
                if isinstance(exc, LocalVoiceError):
                    error = exc
                else:
                    code = 'VOICE_TIMEOUT' if isinstance(exc, queue.Empty) else 'WORKER_START' if phase == 'startup' else 'SYNTHESIS_FAILED'
                    error = LocalVoiceError(code, phase, (monotonic() - started) * 1000)
                self._diagnostic(error)
                self.close()
                raise error from None

    @staticmethod
    def _diagnostic(error):
        logging.getLogger('tikreader').warning('local_voice_failure code=%s phase=%s elapsed_ms=%d',
                                              error.code, error.phase, error.elapsed_ms)

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
            except LocalVoiceError as exc:
                return jsonify(exc.payload()), 503
            except ValueError as exc:
                return jsonify(error=str(exc)), 400
            except (RuntimeError, OSError, subprocess.SubprocessError, queue.Empty):
                return jsonify(error='No se pudo generar la voz local. No se usó ningún servicio en línea.'), 503
            response = send_file(io.BytesIO(audio), mimetype='audio/wav', download_name='voz-local.wav')
            response.headers['Cache-Control'] = 'no-store'
            return response
