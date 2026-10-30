"""Offline Whisper recognition. Network access exists only in explicit preparation."""
import array
import importlib.util
import math
import os
from pathlib import Path
import threading

from app_paths import microphone_whisper_models

MODELS = {'base': 'Base · rápido', 'small': 'Small · equilibrado',
          'medium': 'Medium · más recursos', 'turbo': 'Turbo · más recursos'}
# faster-whisper supplies default audio preprocessing when this optional config
# is absent (including the official Small conversion).
REQUIRED_FILES = ('model.bin', 'config.json', 'tokenizer.json')


def model_path(name):
    if name not in MODELS:
        raise ValueError('Modelo Whisper no compatible')
    return microphone_whisper_models() / name


def model_ready(path):
    return all((Path(path) / name).is_file() and (Path(path) / name).stat().st_size > 0
               for name in REQUIRED_FILES)


def package_ready():
    return importlib.util.find_spec('faster_whisper') is not None


def load_whisper_model(path):
    from faster_whisper import WhisperModel
    return WhisperModel(str(path), device='cpu', compute_type='int8',
                        cpu_threads=max(1, min(4, os.cpu_count() or 1)),
                        num_workers=1, local_files_only=True, use_auth_token=False)


class ModelPreparation:
    """One anonymous public download at a time; never called by listening."""
    def __init__(self):
        self.lock = threading.Lock()
        self.state = {'status': 'idle', 'model': '', 'error': ''}

    def snapshot(self):
        with self.lock:
            return dict(self.state)

    def start(self, name):
        target = model_path(name)
        if not package_ready():
            raise RuntimeError('Falta instalar faster-whisper. Actualiza TikReader o instala sus dependencias.')
        with self.lock:
            if self.state['status'] == 'downloading':
                raise RuntimeError('Ya hay una descarga de subtítulos en curso')
            self.state = {'status': 'downloading', 'model': name, 'error': ''}
        def download():
            try:
                from faster_whisper import download_model
                target.mkdir(parents=True, exist_ok=True)
                download_model(name, output_dir=str(target), use_auth_token=False)
                if not model_ready(target):
                    raise RuntimeError('La descarga está incompleta; vuelve a descargar el modelo.')
                result = {'status': 'ready', 'model': name, 'error': ''}
            except Exception:
                result = {'status': 'error', 'model': name,
                          'error': 'No se pudo descargar el modelo. Revisa internet y el espacio disponible y vuelve a intentarlo.'}
            with self.lock:
                self.state = result
        threading.Thread(target=download, daemon=True, name='caption-model-download').start()


class WhisperCaptionEngine:
    """Serialized utterances, bounded to eight seconds of mono 16 kHz PCM16.

    Flush after 700 ms silence or eight seconds of speech. Inference receives
    only a local numpy array and returns final phrases, without cloud services.
    """
    MAX_SAMPLES = 16000 * 8
    SILENCE_SAMPLES = 11200

    def __init__(self, path, name, language='es'):
        self.path = Path(path)
        self.name = name
        self.language = language
        self.model = None
        self.reset()

    def reset(self):
        self.samples = array.array('h')
        self.silence = 0
        self.has_voice = False

    def accept(self, pcm, finish=False):
        if len(pcm) % 2:
            raise RuntimeError('Audio PCM16 inválido')
        incoming = array.array('h')
        incoming.frombytes(pcm)
        completed = []
        # Small windows locate utterance boundaries even within a large request.
        for offset in range(0, len(incoming), 1600):
            chunk = incoming[offset:offset + 1600]
            voiced = math.sqrt(sum(float(v) * v for v in chunk) / max(1, len(chunk))) >= 220
            if voiced:
                self.has_voice = True
                self.silence = 0
            else:
                self.silence += len(chunk)
            if self.has_voice:
                self.samples.extend(chunk)
            if len(self.samples) >= self.MAX_SAMPLES or (self.has_voice and self.silence >= self.SILENCE_SAMPLES):
                completed.append(self.flush())
        if finish:
            completed.append(self.flush())
        text = ' '.join(part for part in completed if part)
        return {'text': text, 'interim': False, 'final': bool(text)}

    def flush(self):
        samples = self.samples
        has_voice = self.has_voice
        self.reset()
        if not has_voice or len(samples) < 1600:
            return ''
        if not model_ready(self.path):
            raise RuntimeError('Descarga primero el modelo Whisper seleccionado')
        try:
            import numpy as np
            if self.model is None:
                self.model = load_whisper_model(self.path)
            audio = np.asarray(samples, dtype=np.float32) / 32768.0
            segments, _ = self.model.transcribe(audio, language=self.language, task='transcribe',
                                               beam_size=3, condition_on_previous_text=False,
                                               vad_filter=False, temperature=0)
            return ' '.join(segment.text.strip() for segment in segments).strip()[:300]
        except Exception as exc:
            raise RuntimeError('No se pudo transcribir con Whisper. Revisa el modelo y los recursos del equipo.') from exc
