import ast
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
    @staticmethod
    def _close_behavior_harness(response, api_error=None):
        source = (Path(__file__).resolve().parents[1] / 'app' / 'desktop_window.py').read_text(
            encoding='utf-8'
        )
        tree = ast.parse(source)
        window = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'MainWindow')
        methods = {node.name: node for node in window.body if isinstance(node, ast.FunctionDef) and node.name in {
            '_request_themed_close_confirmation', '_finish_close_confirmation',
            '_show_themed_close_confirmation', 'closeEvent'
        }}

        class Event:
            def __init__(self): self.accepted = self.ignored = False
            def accept(self): self.accepted = True
            def ignore(self): self.ignored = True

        class Timer:
            @staticmethod
            def singleShot(_milliseconds, _callback): pass
            def __init__(self, parent): self.callback = None; self.stopped = False
            def setSingleShot(self, _value): pass
            @property
            def timeout(self): return self
            def connect(self, callback): self.callback = callback
            def start(self, _milliseconds): pass
            def stop(self): self.stopped = True
            def deleteLater(self): self.deleted = True

        class Dialog:
            instances = []
            StandardButton = type('StandardButton', (), {'Yes': 1, 'No': 2})
            Icon = type('Icon', (), {'Question': 3})
            def __init__(self, owner):
                self.owner = owner; self.response = response; self.stylesheet = ''; self.default = None
                type(self).instances.append(self)
            def setIcon(self, _value): pass
            def setWindowTitle(self, _value): pass
            def setText(self, _value): pass
            def setStandardButtons(self, _value): pass
            def setDefaultButton(self, value): self.default = value
            def setStyleSheet(self, value): self.stylesheet = value
            def exec(self):
                self.pending_during_modal = self.owner._close_confirmation_pending
                self.modal_event = Event()
                self.owner.closeEvent(self.modal_event)
                return self.response

        class Api:
            def __init__(self): self.calls = []
            def post(self, *args):
                self.calls.append(args)
                if api_error: raise api_error

        class Poll:
            def __init__(self): self.stopped = False
            def stop(self): self.stopped = True

        class Page:
            def __init__(self): self.callbacks = []; self.scripts = []
            def runJavaScript(self, script, callback): self.scripts.append(script); self.callbacks.append(callback)

        class Studio:
            def __init__(self): self.web_page = Page()
            def page(self): return self.web_page

        error_type = type(api_error) if api_error else type('DesktopApiError', (Exception,), {})
        namespace = {'QMessageBox': Dialog, 'QTimer': Timer, 'DesktopApiError': error_type}
        for name, node in methods.items():
            module = ast.fix_missing_locations(ast.Module(body=[node], type_ignores=[]))
            exec(compile(module, '<desktop-close-method>', 'exec'), namespace)

        class Window:
            _request_themed_close_confirmation = namespace['_request_themed_close_confirmation']
            _finish_close_confirmation = namespace['_finish_close_confirmation']
            _show_themed_close_confirmation = namespace['_show_themed_close_confirmation']
            closeEvent = namespace['closeEvent']
            def __init__(self):
                self.closing = self._close_confirmation_pending = self._close_confirmed = False
                self._close_dialog_open = False
                self._close_confirmation_generation = 0
                self._close_confirmation_timer = None
                self.api = Api(); self.poll = Poll(); self.studio = Studio()
            def close(self): self.close_event = Event(); self.closeEvent(self.close_event)
            def show_error(self, _message): pass

        Dialog.instances.clear()
        return Window(), Event, Dialog

    def test_close_confirmation_blocks_duplicate_close_during_modal_and_uses_accent_ink(self):
        window, Event, Dialog = self._close_behavior_harness(2)
        window.closeEvent(Event())
        callback = window.studio.web_page.callbacks[-1]
        callback({'raised': '#222222', 'accent': '#ffffff', 'accent_ink': '#111111',
                  'border': '#555555', 'text': '#fefefe'})

        self.assertTrue(Dialog.instances[0].pending_during_modal)
        self.assertTrue(Dialog.instances[0].modal_event.ignored)
        self.assertFalse(window._close_confirmation_pending)
        self.assertEqual(Dialog.instances[0].default, Dialog.StandardButton.No)
        self.assertIn('color: #111111', Dialog.instances[0].stylesheet)
        self.assertIn('--skin-accent-ink', window.studio.web_page.scripts[0])

    def test_stale_theme_callback_cannot_open_dialog_for_a_later_close_request(self):
        window, Event, Dialog = self._close_behavior_harness(2)
        window.closeEvent(Event())
        first_callback = window.studio.web_page.callbacks[-1]
        first_callback({'raised': '#222222', 'accent': '#ffffff', 'accent_ink': '#111111',
                        'border': '#555555', 'text': '#fefefe'})
        self.assertFalse(window._close_confirmation_pending)

        window.closeEvent(Event())
        second_callback = window.studio.web_page.callbacks[-1]
        first_callback({'raised': '#111111', 'accent': '#222222', 'accent_ink': '#ffffff',
                        'border': '#444444', 'text': '#eeeeee'})
        self.assertTrue(window._close_confirmation_pending)
        self.assertEqual(len(Dialog.instances), 1)
        second_callback({'raised': '#222222', 'accent': '#ffffff', 'accent_ink': '#111111',
                         'border': '#555555', 'text': '#fefefe'})
        self.assertEqual(len(Dialog.instances), 2)

    def test_yes_requests_exit_but_no_does_not(self):
        for answer, should_exit in ((1, True), (2, False)):
            with self.subTest(answer=answer):
                window, Event, _Dialog = self._close_behavior_harness(answer)
                window.closeEvent(Event())
                window.studio.web_page.callbacks[-1]({'raised': '#222222', 'accent': '#ffffff',
                    'accent_ink': '#111111', 'border': '#555555', 'text': '#fefefe'})
                self.assertEqual(bool(window.api.calls), should_exit)

    def test_yes_still_allows_exit_when_backend_is_unreachable(self):
        error = type('DesktopApiError', (Exception,), {'unreachable': True})('offline')
        window, Event, _Dialog = self._close_behavior_harness(1, api_error=error)
        window.closeEvent(Event())
        window.studio.web_page.callbacks[-1]({'raised': '#222222', 'accent': '#ffffff',
            'accent_ink': '#111111', 'border': '#555555', 'text': '#fefefe'})
        self.assertTrue(window.closing)
        self.assertTrue(window.poll.stopped)
        self.assertTrue(window.close_event.accepted)

    def test_windows_launcher_uses_nonblocking_powershell_process_validation(self):
        root = Path(__file__).resolve().parents[1]
        script = (root / 'Iniciar TikReader.cmd').read_text(encoding='utf-8')

        self.assertIn('powershell.exe -NoProfile -NonInteractive -Command', script)
        self.assertIn('Start-Process -FilePath $exe', script)
        self.assertIn('if ($actual -ne $exe)', script)
        self.assertNotIn('start "" /wait /b', script)
        self.assertNotIn('Start-Process -Wait', script)

    def test_native_startup_uses_a_branded_animated_splash(self):
        root = Path(__file__).resolve().parents[1]
        source = (root / 'app' / 'startup_splash.py').read_text(encoding='utf-8')
        launcher = (root / 'app' / 'launcher.py').read_text(encoding='utf-8')
        self.assertIn('tikreader-192.png', source)
        self.assertIn('QLabel("Desarrollado por")', source)
        self.assertIn('QLabel("3error32")', source)
        self.assertIn('class SignalProgressBar(QWidget):', source)
        self.assertNotIn('3rror32-avatar.png', source)
        self.assertNotIn('QLabel("TR")', source)
        self.assertNotIn('ESTUDIO EN VIVO', source)
        self.assertIn('self.progress.complete()', source)
        self.assertIn('QPropertyAnimation', source)
        self.assertIn('_health_with_splash(splash)', launcher)
        self.assertIn('Servicio listo · preparando la interfaz…', launcher)

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
