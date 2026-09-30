import io
import json
import tempfile
import unittest
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import launcher
import preflight
import soak_test
from app_config import RuntimeConfig


class StartupValidationTests(unittest.TestCase):
    def test_health_rejects_other_services_and_malformed_json(self):
        for body, expected in [('{}', False), ('[]', False), ('null', False),
                               ('invalid', False), ('{"application":"TikReader"}', True)]:
            with self.subTest(body=body), patch.object(launcher.urllib.request, 'urlopen', return_value=io.StringIO(body)):
                self.assertEqual(launcher.health(), expected)

    def test_missing_dependencies_do_not_start_server(self):
        with patch.object(launcher, 'dependencies', return_value=['Flask']), patch.object(launcher.subprocess, 'Popen') as spawn:
            with self.assertRaisesRegex(RuntimeError, 'Flask'):
                launcher.launch(False)
            spawn.assert_not_called()

    def test_existing_server_is_reused(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(launcher, 'ROOT', Path(folder)), \
                patch.object(launcher, 'dependencies', return_value=[]), patch.object(launcher, 'health', return_value=True), \
                patch.object(launcher.subprocess, 'Popen') as spawn:
            self.assertEqual(launcher.launch(False), launcher.URL)
            spawn.assert_not_called()

    def test_native_launch_refuses_to_start_server_without_qt(self):
        with patch.object(launcher, 'dependencies', return_value=[]), \
                patch.object(launcher.importlib.util, 'find_spec', return_value=None), \
                patch.object(launcher.subprocess, 'Popen') as spawn:
            with self.assertRaisesRegex(RuntimeError, 'PySide6'):
                launcher.launch()
            spawn.assert_not_called()

    def test_default_launch_opens_native_window(self):
        native = SimpleNamespace(run=Mock(return_value=7))
        with tempfile.TemporaryDirectory() as folder, patch.object(launcher, 'ROOT', Path(folder)), \
                patch.object(launcher, 'dependencies', return_value=[]), \
                patch.object(launcher.importlib.util, 'find_spec', return_value=object()), \
                patch.object(launcher, 'health', return_value=True), \
                patch.dict(sys.modules, {'desktop_window': native}), \
                patch.object(launcher.subprocess, 'Popen') as spawn:
            self.assertEqual(launcher.launch(), 7)
            native.run.assert_called_once_with(launcher.URL)
            spawn.assert_not_called()

    def test_preflight_reports_missing_package_and_occupied_port(self):
        probe=Mock();probe.connect_ex.return_value=0
        with patch.object(preflight.importlib.util, 'find_spec', side_effect=lambda name: None if name=='flask' else object()), \
                patch.object(preflight.socket, 'socket') as socket, patch.object(preflight.shutil, 'which', return_value=None):
            socket.return_value.__enter__.return_value=probe
            report=preflight.run(RuntimeConfig('127.0.0.1', 5100, False, 'INFO'))
        checks={c['name']:c for c in report['checks']}
        self.assertFalse(report['ok'])
        self.assertIn('Flask', checks['dependencies']['detail'])
        self.assertFalse(checks['port']['ok'])
        probe.connect_ex.assert_called_once_with(('127.0.0.1',5100))

    def test_memory_growth_excludes_warmup_and_flags_excess(self):
        samples=[{'elapsed':0,'memory_rss_bytes':1}, {'elapsed':300,'memory_rss_bytes':200*1024**2},
                 {'elapsed':600,'memory_rss_bytes':220*1024**2}]
        self.assertEqual(soak_test.memory_summary(samples)['status'],'within_limit')
        self.assertEqual(soak_test.memory_summary(samples,max_growth_mb=10)['status'],'growth_exceeded')
        self.assertEqual(soak_test.memory_summary(samples[:2])['status'],'insufficient_data')

    def test_sampler_uses_configured_port_and_rejects_duplicates(self):
        feed={'session':'test','comments':[{'id':'same'},{'id':'same'}],'stats':{}}
        with tempfile.TemporaryDirectory() as folder, patch.object(soak_test.time,'monotonic',side_effect=[0,0,1,2,2]), \
                patch.object(soak_test,'runtime_config',return_value=RuntimeConfig('127.0.0.1',5100,False,'INFO')), \
                patch.object(soak_test.urllib.request,'urlopen',side_effect=[io.StringIO(json.dumps(feed)),io.StringIO('{"connected":false}')]) as request:
            output=Path(folder)/'nested'/'report.json'
            self.assertFalse(soak_test.run(1,1,output))
            report=json.loads(output.read_text())
            self.assertFalse(report['passed'])
            self.assertIn('Duplicate IDs in feed',report['errors'])
            self.assertEqual(request.call_args_list[0].args[0],'http://127.0.0.1:5100/feed')
