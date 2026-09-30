"""Ephemeral microphone captions received from the local operator browser."""
import importlib.util
import json
import threading
import time

from flask import jsonify, render_template, request
from app_paths import microphone_speech_model


DEFAULTS = {
    'language': 'es-MX',
    'duration': 5,
    'position': 'bottom',
    'font_size': 48,
    'text_color': '#ffffff',
    'background': '#101925',
    'show_background': True,
    'pause_during_voice': True,
    'font_family': 'system',
    'text_style': 'solid',
    'shadow': 'soft',
    'animation': 'fade',
}

LANGUAGES = {'es-MX', 'es-US', 'es-ES', 'en-US'}
POSITIONS = {'top', 'center', 'bottom'}
FONT_FAMILIES = {'system', 'impact', 'rounded', 'mono', 'serif', 'handwritten', 'condensed', 'futuristic'}
TEXT_STYLES = {'solid', 'outline', 'neon', 'label'}
SHADOWS = {'none', 'soft', 'strong', 'glow'}
ANIMATIONS = {
    'none', 'fade', 'slide', 'pop', 'typewriter', 'drop',
    'left', 'right', 'bounce', 'flip', 'blur', 'swing',
}


def validate_settings(data, current=None):
    if not isinstance(data, dict):
        raise ValueError('Configuración inválida')
    out = {**DEFAULTS, **(current or {})}
    if 'language' in data:
        value = str(data['language'])
        if value not in LANGUAGES:
            raise ValueError('Idioma no compatible')
        out['language'] = value
    if 'position' in data:
        value = str(data['position'])
        if value not in POSITIONS:
            raise ValueError('Posición inválida')
        out['position'] = value
    for key, choices, message in (
        ('font_family', FONT_FAMILIES, 'Fuente inválida'),
        ('text_style', TEXT_STYLES, 'Estilo de texto inválido'),
        ('shadow', SHADOWS, 'Sombra inválida'),
        ('animation', ANIMATIONS, 'Animación inválida'),
    ):
        if key in data:
            value = str(data[key])
            if value not in choices:
                raise ValueError(message)
            out[key] = value
    for key, low, high in (('duration', 2, 20), ('font_size', 20, 96)):
        if key in data:
            value = data[key]
            if isinstance(value, bool):
                raise ValueError('Valor inválido')
            try:
                value = int(value)
            except (TypeError, ValueError):
                raise ValueError('Valor inválido') from None
            out[key] = max(low, min(high, value))
    for key in ('text_color', 'background'):
        if key in data:
            value = str(data[key]).lower()
            if len(value) != 7 or value[0] != '#' or any(c not in '0123456789abcdef' for c in value[1:]):
                raise ValueError('Color inválido')
            out[key] = value
    for key in ('show_background', 'pause_during_voice'):
        if key in data:
            if type(data[key]) is not bool:
                raise ValueError('Opción inválida')
            out[key] = data[key]
    return out


class MicrophoneCaptions:
    def __init__(self, app, runtime):
        self.r = runtime
        self.lock = threading.RLock()
        self.settings = dict(DEFAULTS)
        self.text = ''
        self.interim = ''
        self.listening = False
        self.updated_at = 0.0
        self.visible_until = 0.0
        self.revision = 0
        self.model_path = microphone_speech_model()
        self.speech_model = None
        self.recognizer = None
        self.recognizer_language = None
        self.engine_error = ''
        self.register(app)

    def engine_status(self, language=None):
        language = language or self.settings['language']
        package_ready = importlib.util.find_spec('vosk') is not None
        model_ready = (self.model_path / 'am' / 'final.mdl').is_file()
        language_ready = language in LANGUAGES and language.startswith('es-')
        return {
            'available': package_ready and model_ready and language_ready,
            'package_ready': package_ready,
            'model_ready': model_ready,
            'language_ready': language_ready,
            'language': language,
            'model_language': 'es',
            'error': self.engine_error if language_ready else 'El motor local incluido reconoce español. Selecciona Español — México.',
        }

    def ensure_recognizer(self, language=None):
        language = language or self.settings['language']
        if language not in LANGUAGES or not language.startswith('es-'):
            raise RuntimeError('El motor local incluido reconoce español. Selecciona Español — México.')
        if self.recognizer is not None and self.recognizer_language == language:
            return self.recognizer
        if self.recognizer is not None:
            self.reset_recognizer(forget_language=True)
        status = self.engine_status(language)
        if not status['package_ready']:
            raise RuntimeError('El motor de subtítulos no está instalado')
        if not status['model_ready']:
            raise RuntimeError('El modelo de español no está instalado')
        try:
            from vosk import KaldiRecognizer, Model, SetLogLevel
            SetLogLevel(-1)
            if self.speech_model is None:
                self.speech_model = Model(str(self.model_path))
            self.recognizer = KaldiRecognizer(self.speech_model, 16000)
            self.recognizer.SetWords(False)
            self.recognizer_language = language
            self.engine_error = ''
            return self.recognizer
        except Exception as exc:
            self.engine_error = 'No se pudo iniciar el motor local'
            raise RuntimeError(self.engine_error) from exc

    def reset_recognizer(self, forget_language=False):
        if self.recognizer is not None:
            try:
                self.recognizer.Reset()
            except Exception:
                self.recognizer = None
                self.recognizer_language = None
        if forget_language:
            self.recognizer_language = None

    def apply_transcript(self, text, interim):
        text = ' '.join(str(text).split())[:300]
        if interim:
            self.interim = text
            # A provisional phrase is still being formed.  Do not spend the
            # configured display time until the recognizer confirms its end.
            self.visible_until = 0
        else:
            self.text = text
            self.interim = ''
        self.updated_at = time.time()
        if not interim:
            self.visible_until = self.updated_at + self.settings['duration'] if text else 0
        self.revision += 1
        self.emit()

    def accept_audio(self, pcm, finish=False, language=None):
        recognizer = self.ensure_recognizer(language)
        if finish:
            payload = json.loads(recognizer.FinalResult())
            recognizer.Reset()
            text = payload.get('text', '')
            if text:
                self.apply_transcript(text, False)
            return {'text': text, 'interim': False, 'final': bool(text)}
        completed = recognizer.AcceptWaveform(pcm)
        payload = json.loads(recognizer.Result() if completed else recognizer.PartialResult())
        text = payload.get('text' if completed else 'partial', '')
        if text:
            self.apply_transcript(text, not completed)
        return {'text': text, 'interim': not completed, 'final': completed and bool(text)}

    def restore(self):
        archive = getattr(self.r, 'archive', None)
        if not archive:
            return
        try:
            saved = archive.settings().get('microphone_caption_settings', {})
            self.settings = validate_settings(saved)
        except (ValueError, TypeError):
            self.settings = dict(DEFAULTS)

    def muted(self):
        production = getattr(self.r, 'production', None)
        settings = getattr(production, 'settings', {})
        return bool(settings.get('emergency') or settings.get('scene', 'talk') != 'talk')

    def snapshot(self, public=False):
        now = time.time()
        forming = bool(self.interim)
        visible = forming or self.visible_until > now
        text = (self.interim or self.text) if visible else ''
        if public and self.muted():
            text = ''
        return {
            'text': text,
            'final_text': self.text if visible else '',
            'interim': bool(forming and visible),
            'forming': bool(forming and visible),
            'listening': self.listening,
            'updated_at': self.updated_at,
            'visible_until': self.visible_until if text else 0,
            'revision': self.revision,
            'settings': dict(self.settings),
        }

    def emit(self):
        socketio = getattr(self.r, 'socketio', None)
        if socketio:
            socketio.emit('microphone_caption', self.snapshot(public=True))

    def register(self, app):
        @app.route('/microphone-captions/state', methods=['GET', 'POST', 'DELETE'])
        def microphone_caption_state():
            with self.lock:
                if request.method == 'DELETE':
                    self.reset_recognizer()
                    self.text = self.interim = ''
                    self.listening = False
                    self.visible_until = 0
                    self.updated_at = time.time()
                    self.revision += 1
                    self.emit()
                    return jsonify(self.snapshot())
                if request.method == 'POST':
                    data = request.get_json(silent=True)
                    if not isinstance(data, dict):
                        return jsonify(error='Datos inválidos'), 400
                    try:
                        if 'settings' in data:
                            previous_language = self.settings['language']
                            self.settings = validate_settings(data['settings'], self.settings)
                            if self.settings['language'] != previous_language:
                                self.reset_recognizer(forget_language=True)
                            archive = getattr(self.r, 'archive', None)
                            if archive:
                                archive.set_setting('microphone_caption_settings', self.settings)
                        if 'listening' in data:
                            if type(data['listening']) is not bool:
                                raise ValueError('Estado inválido')
                            self.listening = data['listening']
                        if 'text' in data:
                            interim = data.get('interim', False)
                            if type(interim) is not bool:
                                raise ValueError('Estado de transcripción inválido')
                            self.apply_transcript(data['text'], interim)
                        if data.get('clear') is True:
                            self.text = self.interim = ''
                            self.visible_until = 0
                    except ValueError as exc:
                        return jsonify(error=str(exc)), 400
                    if 'text' not in data:
                        self.revision += 1
                        self.emit()
                return jsonify(self.snapshot())

        @app.get('/microphone-captions/engine')
        def microphone_caption_engine():
            with self.lock:
                language = request.args.get('language', self.settings['language'])
                if language not in LANGUAGES:
                    return jsonify(error='Idioma no compatible'), 400
                return jsonify(self.engine_status(language))

        @app.route('/microphone-captions/audio', methods=['POST', 'DELETE'])
        def microphone_caption_audio():
            with self.lock:
                language = request.args.get('language', self.settings['language'])
                if language not in LANGUAGES:
                    return jsonify(error='Idioma no compatible'), 400
                if request.method == 'DELETE':
                    self.reset_recognizer()
                    self.interim = ''
                    return jsonify(ok=True, **self.engine_status(language))
                if request.content_length and request.content_length > 262144:
                    return jsonify(error='Fragmento de audio demasiado grande'), 413
                pcm = request.get_data(cache=False)
                finish = request.args.get('final') == '1'
                if not pcm and not finish:
                    return jsonify(error='Audio vacío'), 400
                try:
                    result = self.accept_audio(pcm, finish=finish, language=language)
                except RuntimeError as exc:
                    return jsonify(error=str(exc), **self.engine_status(language)), 503
                return jsonify(ok=True, **result)

        @app.get('/broadcast/microphone-captions')
        def microphone_caption_broadcast():
            with self.lock:
                return jsonify(self.snapshot(public=True))

        @app.get('/widget/microphone-captions')
        def microphone_caption_widget():
            return render_template('microphone_caption_widget.html')
