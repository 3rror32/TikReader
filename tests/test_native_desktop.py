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
    def test_palette_refresh_is_load_triggered_without_repeating_timer(self):
        source = (Path(__file__).resolve().parents[1] / 'app' / 'desktop_window.py').read_text(
            encoding='utf-8'
        )
        tree = ast.parse(source)
        window = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'MainWindow')
        init = next(node for node in window.body if isinstance(node, ast.FunctionDef) and node.name == '__init__')

        repeating_palette_timers = {
            node.targets[0].attr
            for node in ast.walk(init)
            if isinstance(node, ast.Assign) and len(node.targets) == 1 and
            isinstance(node.targets[0], ast.Attribute) and isinstance(node.value, ast.Call) and
            isinstance(node.value.func, ast.Name) and node.value.func.id == 'QTimer'
        }
        self.assertNotIn('_skin_timer', repeating_palette_timers)

        load_refreshes = [
            node for node in ast.walk(init)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and
            node.func.attr == 'connect' and isinstance(node.func.value, ast.Attribute) and
            node.func.value.attr == 'loadFinished' and node.args and
            any(isinstance(child, ast.Attribute) and child.attr == '_refresh_desktop_skin'
                for child in ast.walk(node.args[0]))
        ]
        self.assertTrue(load_refreshes, 'successful studio load must refresh the cached palette')

    @staticmethod
    def _close_behavior_harness(response, api_error=None):
        source = (Path(__file__).resolve().parents[1] / 'app' / 'desktop_window.py').read_text(
            encoding='utf-8'
        )
        tree = ast.parse(source)
        window = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'MainWindow')
        methods = {node.name: node for node in window.body if isinstance(node, ast.FunctionDef) and node.name in {
            '_request_themed_close_confirmation', '_finish_close_confirmation',
            '_show_themed_close_confirmation', '_desktop_skin_script', '_remember_desktop_skin', 'closeEvent'
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
            Option = type('Option', (), {'DontUseNativeDialog': 1})
            def __init__(self, owner):
                self.owner = owner; self.response = response; self.stylesheet = ''; self.default = None
                type(self).instances.append(self)
            def setIcon(self, _value): pass
            def setWindowTitle(self, _value): pass
            def setText(self, _value): pass
            def setStandardButtons(self, _value): pass
            def button(self, value):
                return type('Button', (), {'setText': lambda button, text: setattr(self, 'label_' + str(value), text)})()
            def setOption(self, value, enabled): self.non_native = enabled
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
        namespace = {'QMessageBox': Dialog, 'QTimer': Timer, 'DesktopApiError': error_type,
                     '_apply_windows_dialog_theme': lambda dialog, *colors: setattr(dialog, 'frame_colors', colors)}
        for name, node in methods.items():
            module = ast.fix_missing_locations(ast.Module(body=[node], type_ignores=[]))
            exec(compile(module, '<desktop-close-method>', 'exec'), namespace)

        class Window:
            _desktop_skin_script = namespace['_desktop_skin_script']
            _remember_desktop_skin = namespace['_remember_desktop_skin']
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

    def test_close_dialog_forces_styled_rendering_and_spanish_actions(self):
        window, Event, Dialog = self._close_behavior_harness(2)
        window.closeEvent(Event())
        window.studio.web_page.callbacks[-1]({'raised': '#f0f5f7', 'accent': '#287f78',
            'accent_ink': '#f7fffd', 'border': '#b8c9d0', 'text': '#17313b'})
        dialog = Dialog.instances[-1]
        self.assertTrue(dialog.non_native)
        self.assertEqual(dialog.label_1, 'Sí')
        self.assertEqual(dialog.label_2, 'No')
        self.assertIn('background-color: #f0f5f7', dialog.stylesheet)
        self.assertEqual(dialog.frame_colors, ('#f0f5f7', '#17313b', '#b8c9d0'))

    def test_timeout_retains_known_skin_and_partial_palette_keeps_valid_colors(self):
        for colors in (None, {'raised': '#fcfeff', 'accent': 'invalid; color:red'}):
            with self.subTest(colors=colors):
                window, Event, Dialog = self._close_behavior_harness(2)
                window._desktop_skin_colors = {'raised': '#f0f5f7', 'accent': '#287f78',
                    'accent_ink': '#f7fffd', 'border': '#b8c9d0', 'text': '#17313b'}
                window.closeEvent(Event())
                if colors is None:
                    window._close_confirmation_timer.callback()
                else:
                    window.studio.web_page.callbacks[-1](colors)
                style = Dialog.instances[-1].stylesheet
                self.assertIn('background-color: ' + ('#fcfeff' if colors else '#f0f5f7'), style)
                self.assertIn('color: #17313b', style)
                self.assertIn('background-color: #287f78', style)
                self.assertNotIn('invalid', style)

    def test_latest_palette_replaces_cached_skin_before_close(self):
        window, Event, Dialog = self._close_behavior_harness(2)
        window._remember_desktop_skin({'raised': '#192231', 'accent': '#75d5c4',
            'accent_ink': '#071b19', 'border': '#34445a', 'text': '#eaf2ff'})
        window.closeEvent(Event())
        window.studio.web_page.callbacks[-1]({'raised': '#f0f5f7', 'accent': '#287f78',
            'accent_ink': '#f7fffd', 'border': '#b8c9d0', 'text': '#17313b'})
        self.assertIn('background-color: #f0f5f7', Dialog.instances[-1].stylesheet)
        self.assertEqual(window._desktop_skin_colors['text'], '#17313b')

    def test_serialized_skin_palette_and_invalid_payloads(self):
        window, Event, Dialog = self._close_behavior_harness(2)
        light = {'raised': '#f0f5f7', 'accent': '#287f78', 'accent_ink': '#f7fffd',
                 'border': '#b8c9d0', 'text': '#17313b'}
        self.assertEqual(window._remember_desktop_skin(json.dumps(light)), light)
        for payload in ('', '{', 'null', '[]', 'true'):
            self.assertEqual(window._remember_desktop_skin(payload), light)
        window.closeEvent(Event())
        window.studio.web_page.callbacks[-1](json.dumps(light))
        self.assertIn('background-color: #f0f5f7', Dialog.instances[-1].stylesheet)

    def test_actual_qt_callback_transports_selected_skin(self):
        import os
        import subprocess
        import sys

        script = r"""
import ast
from pathlib import Path
from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QApplication
from PySide6.QtWebEngineCore import QWebEnginePage
tree = ast.parse(Path('app/desktop_window.py').read_text(encoding='utf-8'))
window = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'MainWindow')
namespace = {}
for node in window.body:
    if isinstance(node, ast.FunctionDef) and node.name in ('_desktop_skin_script', '_remember_desktop_skin'):
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<skin>', 'exec'), namespace)
app = QApplication([])
page = QWebEnginePage()
owner = type('Owner', (), {})()
results = []
skins = [('#f0f5f7', '#287f78', '#17313b'), ('#192231', '#75d5c4', '#eaf2ff')]
def load_skin():
    raised, accent, text = skins[len(results)]
    page.setHtml('<body style="--skin-raised:'+raised+';--skin-accent:'+accent+';color:'+text+'"></body>')
def received(value):
    palette = namespace['_remember_desktop_skin'](owner, value)
    expected = skins[len(results)]
    assert tuple(palette[k] for k in ('raised', 'accent', 'text')) == tuple(
        'rgb(%d, %d, %d)' % tuple(int(c[i:i+2],16) for i in (1,3,5)) for c in expected), repr(value)
    results.append(palette)
    if len(results) == len(skins): app.quit()
    else: load_skin()
page.loadFinished.connect(lambda ok: page.runJavaScript(namespace['_desktop_skin_script'](owner), received))
load_skin()
QTimer.singleShot(10000, app.quit)
app.exec()
assert len(results) == 2, repr(results)
"""
        environment = dict(os.environ, QT_QPA_PLATFORM='offscreen',
                           QTWEBENGINE_CHROMIUM_FLAGS='--no-sandbox --disable-gpu')
        result = subprocess.run([sys.executable, '-c', script],
                                cwd=Path(__file__).resolve().parents[1], env=environment,
                                capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

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


class WindowsDialogThemeTests(unittest.TestCase):
    def helper(self):
        import sys
        source = (Path(__file__).resolve().parents[1] / 'app' / 'desktop_window.py').read_text(encoding='utf-8')
        tree = ast.parse(source)
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == '_apply_windows_dialog_theme')
        namespace = {'sys': sys}
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<dialog-theme>', 'exec'), namespace)
        return namespace['_apply_windows_dialog_theme']

    def test_caption_text_border_use_pointer_sized_handle_and_colorrefs(self):
        import ctypes
        from types import SimpleNamespace
        calls = []
        def set_attribute(hwnd, attribute, value, size):
            calls.append((hwnd, attribute, ctypes.cast(value, ctypes.POINTER(ctypes.c_uint32)).contents.value, size))
            return 0
        setter = unittest.mock.Mock(side_effect=set_attribute)
        dialog = SimpleNamespace(winId=lambda: 0x123456789)
        with patch('sys.platform', 'win32'), patch.object(ctypes, 'WinDLL', return_value=SimpleNamespace(DwmSetWindowAttribute=setter)):
            self.assertTrue(self.helper()(dialog, 'rgb(240, 245, 247)', '#17313b', 'rgba(184, 201, 208, 0.8)'))
        self.assertEqual(calls, [(0x123456789, 35, 0xf7f5f0, 4),
                                 (0x123456789, 36, 0x3b3117, 4), (0x123456789, 34, 0xd0c9b8, 4)])
        self.assertIs(setter.argtypes[0], ctypes.c_void_p)

    def test_unavailable_or_unsupported_native_theme_is_safe(self):
        import ctypes
        from types import SimpleNamespace
        dialog = SimpleNamespace(winId=lambda: 10)
        with patch('sys.platform', 'linux'):
            self.assertFalse(self.helper()(dialog, '#fff', '#000', '#888'))
        with patch('sys.platform', 'win32'), patch.object(ctypes, 'WinDLL', side_effect=OSError('unavailable')):
            self.assertFalse(self.helper()(dialog, '#fff', '#000', '#888'))
        setter = unittest.mock.Mock(return_value=-1)
        with patch('sys.platform', 'win32'), patch.object(ctypes, 'WinDLL', return_value=SimpleNamespace(DwmSetWindowAttribute=setter)):
            self.assertFalse(self.helper()(dialog, '#fff', '#000', '#888'))
            self.assertEqual(setter.call_count, 3)


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


class StartupReadinessTests(unittest.TestCase):
    def gate(self):
        source = (Path(__file__).resolve().parents[1] / 'app' / 'desktop_window.py').read_text(encoding='utf-8')
        tree = ast.parse(source)
        node = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'StartupReadiness')
        namespace = {}
        exec(compile(ast.fix_missing_locations(ast.Module(body=[node], type_ignores=[])), '<startup-readiness>', 'exec'), namespace)
        return namespace['StartupReadiness']()

    def test_load_and_partial_readiness_do_not_complete(self):
        gate = self.gate()
        gate.begin(0)
        token = gate.request()
        self.assertIsNone(gate.request())
        self.assertEqual(gate.accept(token, {'presentationReady': False}), 'waiting')
        self.assertFalse(gate.finished)
        token = gate.request()
        self.assertEqual(gate.accept(token, {'presentationReady': True}), 'ready')
        self.assertTrue(gate.finished)
        self.assertEqual(gate.accept(token, {'presentationReady': True}), 'ignored')

    def test_retry_ignores_stale_navigation_callbacks(self):
        gate = self.gate()
        gate.begin(0)
        old = gate.request()
        gate.begin(1)
        current = gate.request()
        self.assertEqual(gate.accept(old, {'presentationReady': True}), 'ignored')
        self.assertIsNone(gate.request())
        self.assertEqual(gate.accept(current, {}), 'waiting')
        self.assertFalse(gate.finished)

    def test_error_and_timeout_never_report_ready(self):
        gate = self.gate()
        gate.begin(0)
        token = gate.request()
        self.assertEqual(gate.accept(token, {'failureVisible': True}), 'waiting')
        token = gate.request()
        self.assertEqual(gate.accept(token, {'failureVisible': True}), 'error')
        gate.begin(0)
        self.assertTrue(gate.expired(30))
        self.assertFalse(gate.finished)
        gate.begin(31)
        self.assertFalse(gate.expired(31))
        token = gate.request()
        gate.stop()
        self.assertEqual(gate.accept(token, {'presentationReady': True}), 'ignored')

    def test_serialized_snapshot_and_malformed_values(self):
        gate = self.gate()
        gate.begin(0)
        for snapshot in ('', '{', 'null', '[]', 'true', '{"presentationReady": 1}'):
            with self.subTest(snapshot=snapshot):
                self.assertEqual(gate.accept(gate.request(), snapshot), 'waiting')
        self.assertEqual(gate.accept(gate.request(), '{"presentationReady": true}'), 'ready')

    def test_actual_qt_callback_completes_readiness(self):
        import os
        import subprocess
        import sys

        script = r"""
import ast
from pathlib import Path
from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QApplication
from PySide6.QtWebEngineCore import QWebEnginePage
source = Path('app/desktop_window.py').read_text(encoding='utf-8')
tree = ast.parse(source)
node = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'StartupReadiness')
namespace = {}
exec(compile(ast.Module(body=[node], type_ignores=[]), '<readiness>', 'exec'), namespace)
probe = next(n.value.value for n in ast.walk(tree) if isinstance(n, ast.Assign)
             and any(isinstance(t, ast.Name) and t.id == 'probe' for t in n.targets))
gate = namespace['StartupReadiness']()
gate.begin(0)
app = QApplication([])
page = QWebEnginePage()
results = []
def received(value):
    results.append(gate.accept(gate.request(), value))
    app.quit()
page.loadFinished.connect(lambda ok: page.runJavaScript(probe, received))
page.setHtml('<script>window.OperatorBoot={snapshot:()=>({presentationReady:true})}</script>')
QTimer.singleShot(10000, app.quit)
app.exec()
assert results == ['ready'], repr(results)
"""
        environment = dict(os.environ, QT_QPA_PLATFORM='offscreen',
                           QTWEBENGINE_CHROMIUM_FLAGS='--no-sandbox --disable-gpu')
        result = subprocess.run([sys.executable, '-c', script],
                                cwd=Path(__file__).resolve().parents[1], env=environment,
                                capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
