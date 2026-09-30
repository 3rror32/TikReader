import sys
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
from microphone_captions import MicrophoneCaptions, validate_settings


class FakeSocket:
    def __init__(self):
        self.events = []

    def emit(self, name, payload):
        self.events.append((name, payload))


class MicrophoneCaptionTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1]
        self.app = Flask(__name__, template_folder=str(root / 'web' / 'templates'))
        self.runtime = SimpleNamespace(
            archive=None,
            socketio=FakeSocket(),
            production=SimpleNamespace(settings={'emergency': False, 'scene': 'talk'}),
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
