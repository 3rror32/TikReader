import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
from local_caption_engine import WhisperCaptionEngine, model_ready

class WhisperEngineTests(unittest.TestCase):
    def test_readiness_accepts_model_without_optional_preprocessor(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ('model.bin', 'config.json', 'tokenizer.json'):
                (root / name).write_text('{}')
            self.assertTrue(model_ready(root))

    def test_readiness_rejects_missing_or_empty_required_artifacts(self):
        import tempfile
        for missing in ('model.bin', 'config.json', 'tokenizer.json'):
            with self.subTest(artifact=missing), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                for name in ('model.bin', 'config.json', 'tokenizer.json'):
                    (root / name).write_text('{}')
                (root / missing).unlink()
                self.assertFalse(model_ready(root))
                (root / missing).touch()
                self.assertFalse(model_ready(root))

    def test_silence_flush_and_local_loading(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ('model.bin', 'config.json', 'tokenizer.json', 'preprocessor_config.json'):
                (root / name).write_text('{}')
            calls = []
            model = SimpleNamespace(transcribe=lambda audio, **kw: (calls.append((audio, kw)) or [SimpleNamespace(text=' Hola mundo. ')], None))
            with patch('local_caption_engine.load_whisper_model', return_value=model) as load:
                engine = WhisperCaptionEngine(root, 'small')
                self.assertEqual(engine.accept(b'\x00\x10' * 8000)['text'], '')
                result = engine.accept(b'\x00\x00' * 16000)
                self.assertEqual(result['text'], 'Hola mundo.')
                self.assertTrue(result['final'])
                self.assertEqual(calls[0][1]['language'], 'es')
                self.assertEqual(calls[0][1]['task'], 'transcribe')
                self.assertEqual(engine.accept(b'', finish=True)['text'], '')
                load.assert_called_once_with(root)

    def test_input_is_bounded_and_odd_pcm_rejected(self):
        engine = WhisperCaptionEngine(Path('missing'), 'base')
        with self.assertRaisesRegex(RuntimeError, 'PCM'):
            engine.accept(b'x')

    def test_constructor_is_offline_cpu_int8(self):
        from local_caption_engine import load_whisper_model
        fake = SimpleNamespace(WhisperModel=lambda *a, **kw: (a, kw))
        with patch.dict(sys.modules, {'faster_whisper': fake}):
            args, kwargs = load_whisper_model(Path('model'))
        self.assertTrue(kwargs['local_files_only'])
        self.assertEqual(kwargs['device'], 'cpu')
        self.assertEqual(kwargs['compute_type'], 'int8')
        self.assertFalse(kwargs['use_auth_token'])

if __name__ == '__main__': unittest.main()
