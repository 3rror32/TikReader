import io
import tempfile
import unittest
import threading
import subprocess
import sys
import os
import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from unittest.mock import Mock, patch
from pathlib import Path

from flask import Flask

from voice_models import VoiceModels
from rvc_gpu_runner import require_cuda
from types import SimpleNamespace


class VoiceModelTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.app = Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates'))
        self.voice = VoiceModels(self.app, self.root)
        self.client = self.app.test_client()

    def tearDown(self):
        self.voice.set_keep_warm(False)
        self.temp.cleanup()

    def test_delete_releases_loaded_model_and_allows_reinstall(self):
        def upload():
            return self.client.post('/voice-models/upload', data={
                'name': 'Mi voz IA', 'model': (io.BytesIO(b'model'), 'voice.pth'),
                'index': (io.BytesIO(b'index'), 'voice.index'),
            })
        result = upload().get_json()
        model_id = result['model']
        self.assertEqual(result['runtime']['models'][0]['name'], 'Mi voz IA')
        folder = self.voice.models / model_id
        (folder / 'original.zip').write_bytes(b'backup')
        self.voice._worker_model = folder / 'model.pth'
        with patch.object(self.voice, '_stop_worker') as stop:
            response = self.client.delete('/voice-models/' + model_id)
            stop.assert_called_once()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['runtime']['models'], [])
        self.assertFalse((folder / 'model.pth').exists())
        self.assertFalse((folder / 'model.index').exists())
        self.assertTrue((folder / 'original.zip').exists())
        self.assertEqual(upload().status_code, 201)

    def test_delete_is_bounded_and_preserves_other_models(self):
        for name in ('uno', 'dos'):
            folder = self.voice.models / name
            folder.mkdir()
            (folder / 'model.pth').write_bytes(b'model')
        for invalid in ('..', '../dos', str(self.root), None):
            with self.assertRaises(ValueError):
                self.voice.delete_model(invalid)
        self.assertEqual(self.client.delete('/voice-models/uno').status_code, 200)
        self.assertFalse((self.voice.models / 'uno').exists())
        self.assertTrue((self.voice.models / 'dos' / 'model.pth').exists())
        self.assertEqual(self.client.delete('/voice-models/uno').status_code, 400)

    def test_keep_warm_defaults_off_and_validates_boolean(self):
        self.assertFalse(self.client.get('/voice-models').get_json()['keep_warm'])
        for value in ('true', 1, None):
            self.assertEqual(self.client.post('/voice-models/settings', json={'keep_warm': value}).status_code, 400)
        result = self.client.post('/voice-models/settings', json={'keep_warm': True})
        self.assertTrue(result.get_json()['keep_warm'])

    def test_disable_during_render_releases_after_conversion(self):
        self.voice.set_keep_warm(True)
        def convert(*args):
            self.voice.set_keep_warm(False)
            stop.assert_not_called()
            return b'audio'
        with patch.object(self.voice, '_stop_worker') as stop, patch.object(self.voice, '_render', side_effect=convert):
            self.assertEqual(self.voice.render('Prueba', 'modelo'), b'audio')
            stop.assert_called_once()

    def test_unload_endpoint_stops_worker_without_deleting_model(self):
        model = self.voice.models / 'one' / 'model.pth'
        model.parent.mkdir()
        model.write_bytes(b'model')
        process = SimpleNamespace(stdin=io.StringIO(), stdout=io.StringIO(),
                                  poll=Mock(return_value=None), terminate=Mock(), wait=Mock())
        self.voice._worker, self.voice._worker_model = process, model
        self.voice.keep_warm = True
        response = self.client.post('/voice-models/unload')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json['keep_warm'])
        self.assertFalse(response.json['warm_loaded'])
        process.terminate.assert_called_once()
        process.wait.assert_called_once()
        self.assertTrue(model.exists())
        self.assertEqual(self.client.post('/voice-models/unload').status_code, 200)

    def test_unload_waits_for_active_conversion_and_discards_preload(self):
        for operation in ('render', 'preload'):
            with self.subTest(operation=operation):
                started, finish = threading.Event(), threading.Event()
                def convert(*args):
                    started.set()
                    if not finish.wait(3):
                        raise RuntimeError('Test conversion timed out')
                    return b'audio'
                self.voice.keep_warm = True
                with patch.object(self.voice, '_render', side_effect=convert), \
                        patch.object(self.voice, '_start_worker', side_effect=convert), \
                        patch.object(self.voice, 'resolve_model', return_value=(Path('model.pth'), None)), \
                        patch.object(self.voice, 'runtime', side_effect=lambda: {'ready': True, 'keep_warm': self.voice.keep_warm}), \
                        patch.object(self.voice, '_stop_worker') as stop, ThreadPoolExecutor(2) as pool:
                    job = pool.submit(self.voice.render, 'hola', 'one') if operation == 'render' else pool.submit(self.voice.preload, 'one')
                    self.assertTrue(started.wait(2))
                    release = pool.submit(self.voice.unload)
                    try:
                        with self.assertRaises(FutureTimeout):release.result(timeout=.05)
                        self.assertFalse(self.voice.keep_warm)
                        stop.assert_not_called()
                    finally:
                        finish.set()
                    job.result(timeout=2)
                    self.assertFalse(release.result(timeout=2)['keep_warm'])
                    self.assertTrue(stop.called)

    @unittest.skipUnless(os.name == 'nt', 'Windows process ownership')
    def test_gpu_runner_exits_when_owner_is_terminated(self):
        # Exercise the real process watcher without loading torch or a voice model.
        child_code = ('from rvc_gpu_runner import watch_parent; import os,time; '
                      'watch_parent(os.getppid()); print("ready",flush=True); time.sleep(30)')
        parent_code = ('import subprocess,sys,time,json; '
                       f'p=subprocess.Popen([sys.executable,"-c",{child_code!r}],stdout=subprocess.PIPE,text=True); '
                       'print(json.dumps({"pid":p.pid,"state":p.stdout.readline().strip()}),flush=True); time.sleep(30)')
        env = {**os.environ, 'PYTHONPATH': str(Path(__file__).resolve().parent.parent / 'app')}
        owner = subprocess.Popen([sys.executable, '-c', parent_code], stdout=subprocess.PIPE, text=True, env=env)
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        kernel.WaitForSingleObject.restype = wintypes.DWORD
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = None
        try:
            state = json.loads(owner.stdout.readline())
            self.assertEqual(state['state'], 'ready')
            handle = kernel.OpenProcess(0x00100000, False, state['pid'])
            self.assertTrue(handle)
            owner.terminate()
            owner.wait(timeout=3)
            self.assertEqual(kernel.WaitForSingleObject(handle, 5000), 0)
        finally:
            if owner.poll() is None:owner.kill()
            owner.wait(timeout=3)
            owner.stdout.close()
            if handle:kernel.CloseHandle(handle)

    def test_warm_worker_reused_and_stopped_when_disabled(self):
        ready = 'TIKREADER_READY={"ok":true,"gpu":{"device":"cuda:0","name":"GPU de prueba"}}\n'
        reply = 'TIKREADER_RESULT={"ok":true,"gpu":{"device":"cuda:0","name":"GPU de prueba"}}\n'
        process = SimpleNamespace(stdin=io.StringIO(), stdout=io.StringIO(ready + reply * 2),
                                  poll=Mock(return_value=None), terminate=Mock(), wait=Mock())
        self.voice.set_keep_warm(True)
        with patch('voice_models.subprocess.Popen', return_value=process) as spawn:
            for _ in range(2):
                self.voice._render_warm(Path('model.pth'), None, 'Texto de prueba', Path('out.wav'), 0)
            spawn.assert_called_once()
            self.assertIn('--worker', spawn.call_args.args[0])
            self.assertIn('Texto de prueba', process.stdin.getvalue())
            self.assertEqual(self.voice.last_gpu['device'], 'cuda:0')
            self.voice.set_keep_warm(False)
            process.terminate.assert_called_once()
            process.wait.assert_called_once()
            self.assertIsNone(self.voice._worker)

    def test_preload_starts_worker_before_first_render(self):
        folder = self.root / 'assets' / 'voice_models' / 'homero'
        folder.mkdir(parents=True)
        model = folder / 'voice.pth'
        model.write_bytes(b'model')
        with patch.object(self.voice, 'runtime', return_value={'ready': True}), \
                patch.object(self.voice, '_start_worker') as start:
            result = self.voice.preload('homero')
        start.assert_called_once_with(model, None)
        self.assertTrue(self.voice.keep_warm)
        self.assertEqual(result, {'ready': True})

    def test_render_failure_discards_warm_worker(self):
        self.voice.set_keep_warm(True)
        with patch.object(self.voice, '_render', side_effect=RuntimeError('GPU error')), patch.object(self.voice, '_stop_worker') as stop:
            with self.assertRaises(RuntimeError):
                self.voice.render('Prueba', 'modelo')
            stop.assert_called_once()

    def test_gpu_only_rejects_cpu_and_directml(self):
        for device, dml in [('cpu', False), ('privateuseone:0', True), ('cuda:0', True)]:
            with self.assertRaises(RuntimeError):
                require_cuda(SimpleNamespace(device=device, dml=dml))
        config = SimpleNamespace(device='cuda:0', dml=False)
        self.assertIs(require_cuda(config), config)
        self.assertTrue(self.voice.runtime()['gpu_only'])

    def test_catalog_only_lists_bounded_model_folders(self):
        folder = self.root / 'assets' / 'voice_models' / 'padre_animado'
        folder.mkdir(parents=True)
        (folder / 'voice.pth').write_bytes(b'model')
        (folder / 'voice.index').write_bytes(b'index')
        data = self.client.get('/voice-models').get_json()
        self.assertEqual(data['models'][0]['id'], 'padre_animado')
        self.assertFalse(data['ready'])

    def test_render_rejects_missing_text_without_loading_model(self):
        response = self.client.post('/voice-models/render', json={'text': '', 'model': 'x'})
        self.assertEqual(response.status_code, 400)

    def test_gpu_failure_returns_error_without_alternative_audio(self):
        with patch.object(self.voice, 'render', side_effect=RuntimeError('CUDA unavailable')):
            response = self.client.post('/voice-models/render', json={
                'text': 'Prueba', 'model': 'homero_simpson_la',
            })
        self.assertEqual(response.status_code, 503)
        self.assertIn('no se usó una voz alternativa', response.get_json()['error'])

    def test_upload_validates_extensions_and_creates_model(self):
        bad = self.client.post('/voice-models/upload', data={
            'name': 'Prueba', 'model': (io.BytesIO(b'x'), 'voice.txt'),
        })
        self.assertEqual(bad.status_code, 400)
        good = self.client.post('/voice-models/upload', data={
            'name': 'Prueba segura', 'model': (io.BytesIO(b'model'), 'voice.pth'),
            'index': (io.BytesIO(b'index'), 'voice.index'),
        })
        self.assertEqual(good.status_code, 201)
        self.assertEqual(good.get_json()['model'], 'Prueba-segura')


if __name__ == '__main__':
    unittest.main()
