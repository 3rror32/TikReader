import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import wave

from flask import Flask
from local_tts import LocalTTS, VOICES


class LocalTTSTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.app = Flask(__name__)
        self.tts = LocalTTS(self.app, Path(self.folder.name))
        self.addCleanup(self.tts.close)
        self.client = self.app.test_client()

    def test_missing_runtime_reports_unavailable_and_never_downloads(self):
        with patch('subprocess.Popen') as spawn:
            self.assertFalse(self.client.get('/local-tts').json['ready'])
            response = self.client.post('/local-tts/render', json={'voice': 'ef_dora', 'text': 'Hola'})
            self.assertEqual(response.status_code, 503)
            spawn.assert_not_called()

    def test_rejects_bad_input_before_starting_worker(self):
        bad = [[], 'text', {}, {'voice': '../model', 'text': 'Hola'},
               {'voice': 'ef_dora', 'text': ''}, {'voice': 'ef_dora', 'text': 'x' * 401},
               {'voice': 'ef_dora', 'text': ['hola']}, {'voice': [], 'text': 'hola'}]
        bad += [{'voice': 'ef_dora', 'text': 'Hola', 'speed': speed}
                for speed in [True, '1', None, 0, 4, float('nan')]]
        with patch.object(self.tts, 'start') as start:
            for payload in bad:
                self.assertEqual(self.client.post('/local-tts/render', json=payload).status_code, 400, payload)
            start.assert_not_called()

    def test_wav_response_and_no_cache_of_comments(self):
        out = io.BytesIO()
        with wave.open(out, 'wb') as wav:
            wav.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
            wav.writeframes(b'\x00\x00' * 100)
        with patch.object(self.tts, 'render', return_value=out.getvalue()) as render:
            result = self.client.post('/local-tts/render', json={'voice': 'em_alex', 'text': 'Hola', 'speed': 1.1})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.mimetype, 'audio/wav')
            render.assert_called_once_with('Hola', 'em_alex', 1.1)

    def test_catalog_excludes_unlicensed_and_deferred_voices(self):
        self.assertEqual(len(VOICES), 41)
        self.assertEqual([v for v in VOICES if v.startswith('e')], ['ef_dora', 'em_alex', 'em_santa'])
        self.assertFalse(any('sam' == v or 'dectalk' in v or 'edge' in v for v in VOICES))


if __name__ == '__main__':
    unittest.main()
