import io
import logging
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import launcher
from desktop_api import DesktopApi
from voice_downloads import VoiceDownloads


class OperationalCoreTests(unittest.TestCase):
    def test_health_uses_canonical_identity_and_modular_routes_are_registered(self):
        import server

        client = server.app.test_client()
        self.assertEqual(client.get('/health').get_json()['application'], 'TikReader')
        routes = {rule.rule for rule in server.app.url_map.iter_rules()}
        for route in ('/history', '/studio/state', '/widget/<panel>', '/diagnostics/logs/today'):
            self.assertIn(route, routes)

    def test_child_log_rotation_is_bounded_and_preserves_recent_files(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'launcher-error.log'
            path.write_bytes(b'newest-log')
            path.with_name(path.name + '.1').write_bytes(b'older-log')
            self.assertTrue(launcher.rotate_child_log(path, max_bytes=4, backups=2))
            self.assertFalse(path.exists())
            self.assertEqual(path.with_name(path.name + '.1').read_bytes(), b'-log')
            self.assertLessEqual(path.with_name(path.name + '.1').stat().st_size, 4)
            self.assertEqual(path.with_name(path.name + '.2').read_bytes(), b'older-log')

    def test_routine_http_access_logging_is_suppressed(self):
        from observability import configure_logging

        with tempfile.TemporaryDirectory() as folder:
            configure_logging(Path(folder))
        self.assertGreaterEqual(logging.getLogger('werkzeug').level, logging.WARNING)
        self.assertGreaterEqual(logging.getLogger('engineio.server').level, logging.WARNING)
        self.assertGreaterEqual(logging.getLogger('socketio.server').level, logging.WARNING)

    def test_desktop_stop_uses_local_post_contract(self):
        response = io.BytesIO(b'{"ok":true}')
        with patch('desktop_api.urlopen', return_value=response) as request:
            payload = DesktopApi('http://127.0.0.1:5000').stop_live()
        sent = request.call_args.args[0]
        self.assertEqual(payload, {'ok': True})
        self.assertEqual(sent.method, 'POST')
        self.assertEqual(sent.full_url, 'http://127.0.0.1:5000/live/stop')

    def test_voice_install_stops_before_writing_when_space_is_insufficient(self):
        download = VoiceDownloads.__new__(VoiceDownloads)
        download.r = SimpleNamespace(local_tts=Mock())
        download.state = {'status': 'installing', 'detail': '', 'downloaded': 0, 'model_bytes': 1}
        with tempfile.TemporaryDirectory() as folder, \
                patch('voice_downloads.data_dir', return_value=Path(folder)), \
                patch('voice_downloads.shutil.disk_usage', return_value=SimpleNamespace(free=1024)):
            download.install()
        self.assertEqual(download.state['status'], 'failed')
        self.assertIn('2 GB', download.state['detail'])
        download.r.local_tts.render.assert_not_called()

    def test_component_manager_only_removes_named_user_runtime(self):
        download = VoiceDownloads.__new__(VoiceDownloads)
        download.r = SimpleNamespace(local_tts=Mock(), voice_models=Mock())
        download.lock = __import__('threading').Lock()
        download.state = {'status': 'idle', 'detail': '', 'downloaded': 0, 'model_bytes': 1}
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'TIKREADER_DATA_DIR': folder}):
            root = Path(folder)
            (root / 'rvc' / 'engine').mkdir(parents=True)
            (root / 'rvc' / 'engine' / 'model.bin').write_bytes(b'x' * 128)
            rows = {row['id']: row for row in download.components()['components']}
            self.assertTrue(rows['rvc']['removable'])
            self.assertGreaterEqual(rows['rvc']['bytes'], 128)
            download.remove_component('rvc')
            self.assertFalse((root / 'rvc').exists())
            download.r.voice_models._stop_worker.assert_called_once()
            with self.assertRaises(ValueError):
                download.remove_component('models')


if __name__ == '__main__':
    unittest.main()
