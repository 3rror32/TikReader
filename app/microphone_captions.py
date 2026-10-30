"""Ephemeral microphone captions received from the local operator browser."""
import importlib.util
import json
import threading
import time
from urllib.parse import urlsplit

from flask import jsonify, render_template, request
from app_paths import microphone_speech_model
from local_caption_engine import MODELS, ModelPreparation, WhisperCaptionEngine, model_path, model_ready, package_ready


AI_DEFAULT_INSTRUCTION = (
    'Corrige puntuación, mayúsculas y errores evidentes sin cambiar el sentido ni añadir información. '
    'Devuelve únicamente el subtítulo corregido.'
)
AI_MODE_INSTRUCTIONS = {
    'correct': AI_DEFAULT_INSTRUCTION,
    'simplify': (
        'Reescribe el subtítulo con palabras más sencillas y de forma más breve, '
        'sin cambiar el sentido ni añadir información. Devuelve únicamente el texto simplificado.'
    ),
}


DEFAULTS = {
    'engine': 'vosk',
    'whisper_model': 'small',
    'language': 'es-MX',
    'duration': 5,
    'position': 'bottom',
    'font_size': 48,
    'text_color': '#ffffff',
    'background': '#101925',
    'show_background': True,
    'pause_during_voice': True,
    'noise_suppression': True,
    'echo_cancellation': True,
    'auto_gain_control': True,
    'font_family': 'system',
    'text_style': 'solid',
    'shadow': 'soft',
    'animation': 'fade',
    'ai_enabled': False,
    'ai_endpoint': 'https://api.openai.com/v1',
    'ai_model': '',
    'ai_mode': 'correct',
    'ai_target_language': 'en',
    'ai_instruction': AI_DEFAULT_INSTRUCTION,
}

LANGUAGES = {'es-MX', 'es-US', 'es-ES', 'en-US'}
AI_MODES = {'correct', 'translate', 'bilingual', 'simplify', 'custom'}
AI_TARGET_LANGUAGES = {'en', 'es'}
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
    current = current or {}
    for key, choices in (('engine', {'vosk', 'whisper'}), ('whisper_model', MODELS)):
        if key in data:
            if data[key] not in choices:
                raise ValueError('Motor o modelo de subtítulos inválido')
            out[key] = data[key]
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
    for key in (
        'show_background', 'pause_during_voice', 'noise_suppression',
        'echo_cancellation', 'auto_gain_control', 'ai_enabled',
    ):
        if key in data:
            if type(data[key]) is not bool:
                raise ValueError('Opción inválida')
            out[key] = data[key]
    if 'ai_endpoint' in data:
        value = str(data['ai_endpoint'] or '').strip().rstrip('/')
        parsed = urlsplit(value)
        host = (parsed.hostname or '').casefold()
        local_hosts = {'localhost', '127.0.0.1', '::1'}
        if (not value or len(value) > 500 or parsed.username or parsed.password or parsed.query or parsed.fragment
                or parsed.scheme not in {'http', 'https'} or not host
                or (parsed.scheme == 'http' and host not in local_hosts)):
            raise ValueError('Usa una dirección HTTPS válida o un servicio local')
        out['ai_endpoint'] = value
    if 'ai_model' in data:
        value = str(data['ai_model'] or '').strip()
        if len(value) > 120:
            raise ValueError('El nombre del modelo es demasiado largo')
        out['ai_model'] = value
    if 'ai_instruction' in data:
        value = ' '.join(str(data['ai_instruction'] or '').split())
        if not 1 <= len(value) <= 500:
            raise ValueError('La instrucción debe tener entre 1 y 500 caracteres')
        out['ai_instruction'] = value
    if 'ai_mode' in data:
        value = str(data['ai_mode'])
    elif 'ai_mode' in current:
        value = current['ai_mode']
    else:
        legacy_instruction = ' '.join(str(out['ai_instruction']).split())
        value = 'custom' if legacy_instruction != AI_DEFAULT_INSTRUCTION else 'correct'
    if value not in AI_MODES:
        raise ValueError('Modo de IA inválido')
    out['ai_mode'] = value
    if 'ai_target_language' in data:
        value = str(data['ai_target_language'])
    else:
        value = out['ai_target_language']
    if value not in AI_TARGET_LANGUAGES:
        raise ValueError('Idioma de destino inválido')
    out['ai_target_language'] = value
    if out.get('ai_enabled') and not out.get('ai_model'):
        raise ValueError('Indica el nombre del modelo antes de activar la IA externa')
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
        self.whisper = None
        self.preparation = ModelPreparation()
        self.audio_generation = 0
        self.register(app)

    def ai_key(self):
        store = getattr(self.r, 'platform_credentials', None)
        if not store:
            return ''
        try:
            return str(store.get('caption_ai').get('api_key') or '')
        except (OSError, RuntimeError, ValueError):
            return ''

    def ai_key_configured(self):
        return bool(self.ai_key())

    def save_ai_key(self, value):
        store = getattr(self.r, 'platform_credentials', None)
        if not store:
            raise RuntimeError('El almacenamiento protegido todavía no está disponible')
        value = str(value or '').strip()
        if len(value) > 1000:
            raise ValueError('La clave API es demasiado larga')
        store.save('caption_ai', {'api_key': value})

    def call_external_model(self, text, config=None, api_key=None, test=False):
        raise RuntimeError('Los subtítulos son completamente locales. El procesamiento externo está desactivado.')

    def engine_status(self, language=None):
        language = language or self.settings['language']
        if self.settings['engine'] == 'whisper':
            ready = model_ready(model_path(self.settings['whisper_model']))
            installed = package_ready()
            return {
                'available': installed and ready, 'package_ready': installed,
                'model_ready': ready, 'language_ready': language in LANGUAGES,
                'language': language, 'model_language': language.split('-')[0],
                'engine': 'whisper', 'model': self.settings['whisper_model'],
                'preparation': self.preparation.snapshot(),
                'error': '' if installed and ready else ('Descarga el modelo seleccionado para usarlo sin internet.' if installed else 'Falta faster-whisper. Actualiza TikReader o instala sus dependencias.'),
            }
        package_ready_vosk = importlib.util.find_spec('vosk') is not None
        vosk_ready = (self.model_path / 'am' / 'final.mdl').is_file()
        language_ready = language in LANGUAGES and language.startswith('es-')
        return {
            'available': package_ready_vosk and vosk_ready and language_ready,
            'package_ready': package_ready_vosk,
            'model_ready': vosk_ready,
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
        self.audio_generation += 1
        if self.whisper is not None:
            self.whisper.reset()
        if forget_language:
            self.whisper = None
        if self.recognizer is not None:
            try:
                self.recognizer.Reset()
            except Exception:
                self.recognizer = None
                self.recognizer_language = None
        if forget_language:
            self.recognizer = None
            self.recognizer_language = None

    def apply_transcript(self, text, interim):
        if self.settings.get('ai_mode') == 'bilingual':
            text = '\n'.join(' '.join(line.split()) for line in str(text).splitlines() if line.strip())[:300]
        else:
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
        if len(pcm) % 2:
            raise RuntimeError('Audio PCM16 inválido')
        if self.settings['engine'] == 'whisper':
            if self.whisper is None:
                name = self.settings['whisper_model']
                self.whisper = WhisperCaptionEngine(model_path(name), name, (language or self.settings['language']).split('-')[0])
            result = self.whisper.accept(pcm, finish=finish)
            if result['text']:
                self.apply_transcript(result['text'], False)
            return result
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
        visible_settings = dict(self.settings)
        if public:
            for key in ('ai_enabled', 'ai_endpoint', 'ai_model', 'ai_instruction', 'ai_mode', 'ai_target_language'):
                visible_settings.pop(key, None)
        result = {
            'text': text,
            'final_text': self.text if visible else '',
            'interim': bool(forming and visible),
            'forming': bool(forming and visible),
            'listening': self.listening,
            'updated_at': self.updated_at,
            'visible_until': self.visible_until if text else 0,
            'revision': self.revision,
            'settings': visible_settings,
        }
        if not public:
            result['ai_key_configured'] = self.ai_key_configured()
        return result

    def emit(self):
        socketio = getattr(self.r, 'socketio', None)
        if socketio:
            socketio.emit('microphone_caption', self.snapshot(public=True))

    def register(self, app):
        @app.route('/microphone-captions/state', methods=['GET', 'POST', 'DELETE'])
        def microphone_caption_state():
            with self.lock:
                if request.method == 'DELETE':
                    self.reset_recognizer(forget_language=True)
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
                            previous_engine = tuple(self.settings[key] for key in ('language', 'engine', 'whisper_model'))
                            self.settings = validate_settings(data['settings'], self.settings)
                            if tuple(self.settings[key] for key in ('language', 'engine', 'whisper_model')) != previous_engine:
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

        @app.post('/microphone-captions/models/download')
        def microphone_caption_download():
            data = request.get_json(silent=True) or {}
            try:
                self.preparation.start(data.get('model', self.settings['whisper_model']))
                return jsonify(self.preparation.snapshot()), 202
            except (ValueError, RuntimeError) as exc:
                return jsonify(error=str(exc)), 400

        @app.route('/microphone-captions/audio', methods=['POST', 'DELETE'])
        def microphone_caption_audio():
            with self.lock:
                language = request.args.get('language', self.settings['language'])
                if language not in LANGUAGES:
                    return jsonify(error='Idioma no compatible'), 400
                if request.method == 'DELETE':
                    self.reset_recognizer(forget_language=True)
                    self.interim = ''
                    return jsonify(ok=True, generation=self.audio_generation, **self.engine_status(language))
                generation = request.args.get('generation')
                if generation is not None and generation != str(self.audio_generation):
                    return jsonify(error='La sesión de audio cambió; vuelve a activar el micrófono.'), 409
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

        @app.route('/microphone-captions/ai', methods=['POST', 'DELETE'])
        def microphone_caption_ai():
            production = getattr(self.r, 'production', None)
            local_check = getattr(production, 'local', None)
            if callable(local_check) and not local_check():
                return jsonify(error='Solo disponible desde este equipo'), 403
            if request.method == 'DELETE':
                with self.lock:
                    store = getattr(self.r, 'platform_credentials', None)
                    if store:
                        store.delete('caption_ai')
                    self.settings['ai_enabled'] = False
                    archive = getattr(self.r, 'archive', None)
                    if archive:
                        archive.set_setting('microphone_caption_settings', self.settings)
                    return jsonify(ok=True, **self.snapshot())
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return jsonify(error='Datos inválidos'), 400
            try:
                with self.lock:
                    config = validate_settings({
                        key: data[key] for key in (
                            'ai_enabled', 'ai_endpoint', 'ai_model', 'ai_instruction',
                            'ai_mode', 'ai_target_language',
                        )
                        if key in data
                    }, self.settings)
                supplied_key = str(data.get('api_key') or '').strip()
                if data.get('test') is True:
                    # Network I/O intentionally stays outside the caption lock so a
                    # slow provider never pauses the live microphone pipeline.
                    self.call_external_model('Prueba de conexión', config, supplied_key or None, test=True)
                    return jsonify(ok=True, message='Conexión confirmada')
                with self.lock:
                    if supplied_key:
                        self.save_ai_key(supplied_key)
                    self.settings = config
                    archive = getattr(self.r, 'archive', None)
                    if archive:
                        archive.set_setting('microphone_caption_settings', self.settings)
                    self.revision += 1
                    return jsonify(ok=True, **self.snapshot())
            except ValueError as exc:
                return jsonify(error=str(exc)), 400
            except (OSError, RuntimeError) as exc:
                return jsonify(error=str(exc)), 503

        @app.post('/microphone-captions/ai/refine')
        def microphone_caption_ai_refine():
            return jsonify(error='Los subtítulos son completamente locales. El procesamiento externo está desactivado.'), 409

        @app.get('/broadcast/microphone-captions')
        def microphone_caption_broadcast():
            with self.lock:
                return jsonify(self.snapshot(public=True))

        @app.get('/widget/microphone-captions')
        def microphone_caption_widget():
            return render_template('microphone_caption_widget.html')
