import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from desktop_api import DesktopApi, DesktopApiError
from runtime_env import read_runtime_env, validate_runtime_env, write_runtime_env


class RuntimeEnvironmentTests(unittest.TestCase):
    def test_roundtrip_preserves_non_editable_lines(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / '.env'
            path.write_text('# Personal\nTIKREADER_RVC_ROOT=C:/models\nTIKREADER_PORT=5000\n', encoding='utf-8')
            saved = write_runtime_env(path, {
                'TIKREADER_PORT': '5198', 'TIKREADER_LAN': '1', 'TIKREADER_LOG_LEVEL': 'warning',
            })
            self.assertEqual(saved['TIKREADER_PORT'], '5198')
            self.assertEqual(saved['TIKREADER_LOG_LEVEL'], 'WARNING')
            text = path.read_text(encoding='utf-8')
            self.assertIn('TIKREADER_RVC_ROOT=C:/models', text)
            self.assertEqual(read_runtime_env(path), saved)
            self.assertFalse(path.with_name('.env.tmp').exists())

    def test_invalid_values_are_rejected_before_write(self):
        for values in ({'TIKREADER_PORT': '0'}, {'TIKREADER_LAN': 'maybe'},
                       {'TIKREADER_LOG_LEVEL': 'TRACE'}, {'SECRET': 'value'}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                validate_runtime_env(values)


class DesktopApiTests(unittest.TestCase):
    def test_feed_encodes_cursor_and_reads_json(self):
        response = io.BytesIO(json.dumps({'session': 'A', 'comments': []}).encode())
        with patch('desktop_api.urlopen', return_value=response) as request:
            payload = DesktopApi('http://127.0.0.1:5000').feed('A B', 8, 2)
        self.assertEqual(payload['session'], 'A')
        url = request.call_args.args[0].full_url
        self.assertIn('session=A+B', url)
        self.assertIn('after=8', url)

    def test_non_object_response_is_rejected(self):
        with patch('desktop_api.urlopen', return_value=io.BytesIO(b'[]')):
            with self.assertRaises(DesktopApiError):
                DesktopApi('http://127.0.0.1:5000').json('/status')

    def test_connection_failure_is_identified_for_safe_window_close(self):
        from urllib.error import URLError
        with patch('desktop_api.urlopen', side_effect=URLError('offline')):
            with self.assertRaises(DesktopApiError) as caught:
                DesktopApi('http://127.0.0.1:5000').json('/status')
        self.assertTrue(caught.exception.unreachable)


class DesktopWindowSafetyTests(unittest.TestCase):
    def test_windows_uses_tikreader_identity_instead_of_python(self):
        source = (Path(__file__).resolve().parents[1] / 'app' / 'desktop_window.py').read_text(
            encoding='utf-8'
        )
        self.assertIn('SetCurrentProcessExplicitAppUserModelID(WINDOWS_APP_ID)', source)
        self.assertIn('app.setWindowIcon(QIcon(str(icon)))', source)
        self.assertTrue((Path(__file__).resolve().parents[1] / 'assets' / 'icons' / 'tikreader.ico').is_file())

    def test_embedded_studio_routes_system_voice_outside_chromium(self):
        source = (Path(__file__).resolve().parents[1] / 'app' / 'desktop_window.py').read_text(
            encoding='utf-8'
        )
        self.assertIn('class NativeVoiceBridge(QObject):', source)
        self.assertIn('self.engine = QTextToSpeech(self)', source)
        self.assertIn('registerObject("nativeVoice", self._native_voice)', source)
        self.assertIn('page.renderProcessTerminated.connect(self._recover_renderer)', source)

        root = Path(__file__).resolve().parents[1]
        studio = (root / 'web' / 'static' / 'studio.js').read_text(encoding='utf-8')
        template = (root / 'web' / 'templates' / 'index.html').read_text(encoding='utf-8')
        self.assertIn('if(nativeVoiceReady){speakNative(item,generation,character);return;}', studio)
        self.assertIn('qrc:///qtwebchannel/qwebchannel.js', template)

    def test_embedded_studio_hides_the_browser_context_menu(self):
        source = (Path(__file__).resolve().parents[1] / 'app' / 'desktop_window.py').read_text(
            encoding='utf-8'
        )
        self.assertIn('self.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)', source)


class NativeRouteTests(unittest.TestCase):
    def test_invalid_live_user_is_rejected_without_starting_thread(self):
        import server
        response = server.app.test_client().post('/live/start', json={'username': '@'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()['details']['code'], 'INVALID_USERNAME')

    def test_runtime_config_is_external_and_restart_aware(self):
        import release_support
        import server
        with tempfile.TemporaryDirectory() as folder, patch.object(release_support, 'data_dir', return_value=Path(folder)):
            client = server.app.test_client()
            response = client.post('/system/runtime-config', json={
                'TIKREADER_PORT': '5050', 'TIKREADER_LAN': '0', 'TIKREADER_LOG_LEVEL': 'INFO',
            })
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.get_json()['restart_required'])
            self.assertIn('TIKREADER_PORT=5050', (Path(folder) / '.env').read_text())


if __name__ == '__main__':
    unittest.main()
