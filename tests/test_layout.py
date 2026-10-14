"""Integration checks for resource URLs and relocated voice backups."""
from pathlib import Path
import tempfile
import unittest
import zipfile
from unittest.mock import patch

import data_recovery
from history_store import HistoryStore
import maintenance
import server

ROOT = Path(__file__).resolve().parent.parent


class LayoutTests(unittest.TestCase):
    def test_page_and_every_bundled_resource_keep_their_urls(self):
        client = server.app.test_client()
        self.assertEqual(client.get('/').status_code, 200)
        for directory, prefix in (('web/static', '/static/'), ('assets/icons', '/static/icons/'),
                                  ('assets/sprites', '/static/stream-buddies/')):
            base = ROOT / directory
            for path in base.rglob('*'):
                if path.is_file():
                    with self.subTest(file=path.name):
                        response = client.get(prefix + path.relative_to(base).as_posix())
                        try:
                            self.assertEqual(response.status_code, 200)
                            self.assertEqual(response.data, path.read_bytes())
                        finally:
                            response.close()
        self.assertGreater(client.get('/version').get_json()['build'], 0)
        for url in ('/static/../../data/.flask-secret', '/static/icons/../../data/.flask-secret',
                    '/static/voice_models/model.pth'):
            self.assertEqual(client.get(url).status_code, 404)

    def test_voice_backup_restores_into_assets_and_preserves_archive_format(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, target = root / 'source', root / 'target'
            HistoryStore(source / 'data' / 'history.sqlite3')
            voice = source / 'assets' / 'voice_models' / 'example' / 'model.pth'
            voice.parent.mkdir(parents=True)
            voice.write_bytes(b'voice fixture')
            with patch.dict('os.environ', {'TIKREADER_DATA_DIR': ''}):
                package = data_recovery.backup(root / 'backup.zip', source)
            with zipfile.ZipFile(package) as archive:
                self.assertIn('voice_models/example/model.pth', archive.namelist())
            with patch.dict('os.environ', {'TIKREADER_DATA_DIR': ''}):
                data_recovery.restore(package, target)
            restored = target / 'assets' / 'voice_models' / 'example' / 'model.pth'
            self.assertEqual(restored.read_bytes(), b'voice fixture')
            self.assertFalse((target / 'data' / 'voice_models').exists())

    def test_code_package_covers_relocated_resources(self):
        for folder in ('app', 'web/static', 'web/templates', 'assets/icons', 'assets/sprites'):
            for path in (ROOT / folder).rglob('*'):
                if path.is_file() and '__pycache__' not in path.parts:
                    self.assertTrue(maintenance.allowed(path.relative_to(ROOT).as_posix()), str(path))
        self.assertFalse(maintenance.allowed('assets/voice_models/example/model.pth'))
