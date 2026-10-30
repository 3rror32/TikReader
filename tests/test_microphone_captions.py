import sys
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
from microphone_captions import AI_DEFAULT_INSTRUCTION, MicrophoneCaptions, validate_settings


class FakeSocket:
    def __init__(self):
        self.events = []

    def emit(self, name, payload):
        self.events.append((name, payload))


class FakeCredentials:
    def __init__(self):
        self.values = {}

    def get(self, name):
        return dict(self.values.get(name, {}))

    def save(self, name, values):
        self.values[name] = dict(values)

    def delete(self, name):
        self.values.pop(name, None)


class FakeArchive:
    def __init__(self):
        self.values = {}

    def settings(self):
        return dict(self.values)

    def set_setting(self, name, value):
        self.values[name] = dict(value)


class MicrophoneCaptionTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1]
        self.app = Flask(__name__, template_folder=str(root / 'web' / 'templates'))
        self.runtime = SimpleNamespace(
            archive=FakeArchive(),
            socketio=FakeSocket(),
            production=SimpleNamespace(settings={'emergency': False, 'scene': 'talk'}),
            platform_credentials=FakeCredentials(),
        )
        self.captions = MicrophoneCaptions(self.app, self.runtime)
        self.client = self.app.test_client()

    def test_settings_are_validated_and_clamped(self):
        self.assertEqual(validate_settings({})['language'], 'es-MX')
        settings = validate_settings({'language': 'es-MX', 'font_size': 999, 'duration': 1})
        self.assertEqual(settings['font_size'], 96)
        self.assertEqual(settings['duration'], 2)
        with self.assertRaisesRegex(ValueError, 'Color'):
            validate_settings({'text_color': 'red'})
        with self.assertRaisesRegex(ValueError, 'Fuente'):
            validate_settings({'font_family': 'comic-sans'})
        styled = validate_settings({'font_family': 'rounded', 'text_style': 'neon', 'shadow': 'glow', 'animation': 'typewriter'})
        self.assertEqual(styled['animation'], 'typewriter')
        expanded = validate_settings({'font_family': 'futuristic', 'animation': 'flip'})
        self.assertEqual(expanded['font_family'], 'futuristic')
        self.assertEqual(expanded['animation'], 'flip')
        processing = validate_settings({
            'noise_suppression': False,
            'echo_cancellation': False,
            'auto_gain_control': False,
        })
        self.assertFalse(processing['noise_suppression'])
        self.assertFalse(processing['echo_cancellation'])
        self.assertFalse(processing['auto_gain_control'])
        with self.assertRaisesRegex(ValueError, 'Opción'):
            validate_settings({'noise_suppression': 'false'})
        ai = validate_settings({
            'ai_enabled': True,
            'ai_endpoint': 'http://127.0.0.1:11434/v1/',
            'ai_model': 'local-caption-model',
            'ai_instruction': 'Corrige el texto.',
        })
        self.assertEqual(ai['ai_endpoint'], 'http://127.0.0.1:11434/v1')
        with self.assertRaisesRegex(ValueError, 'nombre del modelo'):
            validate_settings({'ai_enabled': True})
        with self.assertRaisesRegex(ValueError, 'HTTPS'):
            validate_settings({'ai_endpoint': 'http://example.com/v1'})

    def test_ai_modes_validate_and_migrate_legacy_instructions(self):
        defaults = validate_settings({})
        self.assertEqual(defaults['ai_mode'], 'correct')
        self.assertEqual(defaults['ai_target_language'], 'en')
        self.assertEqual(validate_settings({'ai_mode': 'translate', 'ai_target_language': 'es'})['ai_target_language'], 'es')
        with self.assertRaisesRegex(ValueError, '[Mm]odo'):
            validate_settings({'ai_mode': 'summarize'})
        with self.assertRaisesRegex(ValueError, '[Ii]dioma'):
            validate_settings({'ai_target_language': 'fr'})

        legacy_custom = validate_settings({'ai_instruction': 'Usa palabras sencillas.'})
        self.assertEqual(legacy_custom['ai_mode'], 'custom')
        legacy_default = validate_settings({'ai_instruction': AI_DEFAULT_INSTRUCTION})
        self.assertEqual(legacy_default['ai_mode'], 'correct')
        self.assertEqual(validate_settings({}, {'ai_instruction': 'Instrucción antigua.'})['ai_mode'], 'custom')

        current = validate_settings({'ai_mode': 'translate', 'ai_target_language': 'es'})
        updated = validate_settings({'ai_model': 'caption-model'}, current)
        self.assertEqual(updated['ai_mode'], 'translate')
        self.assertEqual(updated['ai_target_language'], 'es')

    def test_external_processing_is_refused_without_network(self):
        with self.assertRaisesRegex(RuntimeError, 'locales'):
            self.captions.call_external_model('Hola', {'ai_model': 'legacy'})
        with patch.object(self.captions, 'call_external_model') as external:
            response = self.client.post('/microphone-captions/ai/refine', json={'text': 'hola'})
        self.assertEqual(response.status_code, 409)
        external.assert_not_called()

    def test_whisper_selection_is_saved_without_loading_or_download(self):
        with patch('microphone_captions.WhisperCaptionEngine') as engine, patch.object(self.captions.preparation, 'start') as download:
            response = self.client.post('/microphone-captions/state', json={'settings': {'engine': 'whisper', 'whisper_model': 'base'}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['settings']['whisper_model'], 'base')
        engine.assert_not_called()
        download.assert_not_called()

    def test_stale_audio_generation_is_rejected(self):
        session = self.client.delete('/microphone-captions/audio').json['generation']
        self.client.delete('/microphone-captions/audio')
        with patch.object(self.captions, 'accept_audio') as accept:
            response = self.client.post('/microphone-captions/audio?generation=' + str(session), data=b'\x00\x00')
        self.assertEqual(response.status_code, 409)
        accept.assert_not_called()

    def test_whisper_status_separates_missing_package_and_missing_model(self):
        self.captions.settings['engine'] = 'whisper'
        with patch('microphone_captions.package_ready', return_value=True), patch('microphone_captions.model_ready', return_value=False):
            status = self.client.get('/microphone-captions/engine').json
        self.assertFalse(status['available'])
        self.assertTrue(status['package_ready'])
        self.assertFalse(status['model_ready'])
        self.assertIn('Descarga', status['error'])

    def test_ai_mode_and_target_language_save_load_and_stay_private(self):
        config = {
            'ai_enabled': True,
            'ai_endpoint': 'https://models.example.test/v1',
            'ai_model': 'caption-editor',
            'ai_mode': 'bilingual',
            'ai_target_language': 'es',
            'ai_instruction': 'No se usa en este modo.',
        }
        saved = self.client.post('/microphone-captions/ai', json=config)
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json['settings']['ai_mode'], 'bilingual')
        self.assertEqual(saved.json['settings']['ai_target_language'], 'es')
        self.assertEqual(self.runtime.archive.settings()['microphone_caption_settings']['ai_mode'], 'bilingual')

        restored_app = Flask(__name__ + '_restored')
        restored = MicrophoneCaptions(restored_app, self.runtime)
        restored.restore()
        self.assertEqual(restored.settings['ai_mode'], 'bilingual')
        self.assertEqual(restored.settings['ai_target_language'], 'es')
        restored.apply_transcript('Original: Hello\nTraducción (español): Hola', False)
        self.assertEqual(restored.text, 'Original: Hello\nTraducción (español): Hola')
        public = self.client.get('/broadcast/microphone-captions').json['settings']
        self.assertNotIn('ai_mode', public)
        self.assertNotIn('ai_target_language', public)

    def test_external_ai_configuration_is_private_and_can_refine_text(self):
        config = {
            'ai_enabled': True,
            'ai_endpoint': 'https://models.example.test/v1',
            'ai_model': 'caption-editor',
            'ai_instruction': 'Corrige la frase sin cambiar su sentido.',
            'api_key': 'private-caption-key',
        }
        tested = self.client.post('/microphone-captions/ai', json={**config, 'test': True})
        self.assertEqual(tested.status_code, 503)
        self.assertIn('locales', tested.json['error'])

        saved = self.client.post('/microphone-captions/ai', json=config)
        self.assertEqual(saved.status_code, 200)
        self.assertTrue(saved.json['ai_key_configured'])
        self.assertEqual(self.runtime.platform_credentials.get('caption_ai')['api_key'], 'private-caption-key')
        self.assertNotIn('api_key', str(saved.json))

        with patch.object(self.captions, 'call_external_model', return_value='Hola, mundo.'):
            refined = self.client.post('/microphone-captions/ai/refine', json={'text': 'hola mundo'})
        self.assertEqual(refined.status_code, 409)
        self.assertIn('locales', refined.json['error'])

        public = self.client.get('/broadcast/microphone-captions').json
        self.assertNotIn('ai_endpoint', public['settings'])
        self.assertNotIn('ai_model', public['settings'])
        self.assertNotIn('ai_key_configured', public)

    def test_local_engine_is_explicitly_spanish_and_receives_mexican_locale(self):
        spanish = self.client.get('/microphone-captions/engine?language=es-MX').json
        self.assertEqual(spanish['language'], 'es-MX')
        self.assertEqual(spanish['model_language'], 'es')
        english = self.client.get('/microphone-captions/engine?language=en-US').json
        self.assertFalse(english['available'])
        self.assertFalse(english['language_ready'])
        self.assertIn('español', english['error'])

        recognizer = SimpleNamespace(
            AcceptWaveform=lambda _pcm: False,
            PartialResult=lambda: '{"partial":"hola mundo"}',
        )
        with patch.object(self.captions, 'ensure_recognizer', return_value=recognizer) as ensure:
            response = self.client.post(
                '/microphone-captions/audio?language=es-MX',
                data=b'\x00\x00',
                content_type='audio/pcm',
            )
        self.assertEqual(response.status_code, 200)
        ensure.assert_called_once_with('es-MX')

    def test_changing_language_invalidates_the_active_recognizer(self):
        self.captions.recognizer = SimpleNamespace(Reset=lambda: None)
        self.captions.recognizer_language = 'es-ES'
        self.captions.settings['language'] = 'es-ES'
        response = self.client.post('/microphone-captions/state', json={
            'settings': {'language': 'es-MX'},
        })
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(self.captions.recognizer_language)

    def test_transcript_is_ephemeral_and_sent_to_widget(self):
        response = self.client.post('/microphone-captions/state', json={'text': '  Hola   LIVE  ', 'interim': False})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['text'], 'Hola LIVE')
        self.assertEqual(self.runtime.socketio.events[-1][0], 'microphone_caption')
        self.captions.visible_until = time.time() - 1
        self.assertEqual(self.client.get('/broadcast/microphone-captions').json['text'], '')

    def test_visible_time_starts_only_after_the_phrase_is_final(self):
        response = self.client.post(
            '/microphone-captions/state',
            json={'text': 'Esto es', 'interim': True},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['text'], 'Esto es')
        self.assertTrue(response.json['forming'])
        self.assertEqual(response.json['visible_until'], 0)

        response = self.client.post(
            '/microphone-captions/state',
            json={'text': 'Esto es un texto', 'interim': False},
        )
        self.assertFalse(response.json['forming'])
        self.assertFalse(response.json['interim'])
        self.assertGreater(response.json['visible_until'], time.time())

    def test_public_overlay_obeys_emergency_and_scene_mute(self):
        self.client.post('/microphone-captions/state', json={'text': 'Texto privado', 'interim': False})
        self.runtime.production.settings['emergency'] = True
        self.assertEqual(self.client.get('/broadcast/microphone-captions').json['text'], '')
        self.assertEqual(self.client.get('/microphone-captions/state').json['text'], 'Texto privado')
        self.runtime.production.settings.update(emergency=False, scene='pause')
        self.assertEqual(self.client.get('/broadcast/microphone-captions').json['text'], '')

    def test_widget_route_is_available(self):
        response = self.client.get('/widget/microphone-captions')
        self.assertEqual(response.status_code, 200)
        self.assertIn('TikReader', response.get_data(as_text=True))


if __name__ == '__main__':
    unittest.main()
