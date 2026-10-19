import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from flask import Flask

from build_info import read_build_info


class BuildIdentityTests(unittest.TestCase):
    def test_known_metadata_is_allowlisted_and_version_reload_field_is_unchanged(self):
        from core_routes import register_core_routes
        from build_info import load_build_info
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            info = {'schema': 1, 'package_id': 'a' * 64, 'source_revision': 'b' * 40,
                    'source_dirty': True, 'built_at': '2026-01-02T03:04:05Z', 'provenance': 'git',
                    'release_version': '1.0.0.9', 'channel': 'beta', 'private': 'not-for-output'}
            (root / 'distribution.json').write_text(json.dumps({'version': '1.0.0.9', 'channel': 'beta', 'build_info': info}))
            asset = root / 'web' / 'static' / 'test.js'
            asset.parent.mkdir(parents=True); asset.write_text('test')
            app = Flask(__name__)
            runtime = SimpleNamespace(TIKTOKLIVE_AVAILABLE=False, TIKTOKLIVE_VERSION='unavailable')
            with patch('subprocess.run') as git:
                register_core_routes(app, runtime, root)
                first = app.test_client().get('/version').json
                self.assertEqual(app.test_client().get('/version').json, first)
                git.assert_not_called()
            self.assertEqual(first['build'], asset.stat().st_mtime_ns)
            self.assertIs(type(first['build']), int)
            self.assertEqual(first['build_info']['package_id'], 'a' * 64)
            self.assertNotIn('private', json.dumps(first))
            del info['source_dirty']
            (root / 'distribution.json').write_text(json.dumps({'version': '1.0.0.9', 'channel': 'beta', 'build_info': info}))
            self.assertEqual(read_build_info(root)['status'], 'invalid')
            load_build_info.cache_clear()

    def test_source_and_legacy_packages_remain_honest_and_runnable(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.assertEqual(read_build_info(root)['mode'], 'development')
            (root / 'distribution.json').write_text(json.dumps({'version': '1.0.0.9', 'channel': 'beta'}))
            info = read_build_info(root)
            self.assertEqual(info['status'], 'legacy')
            self.assertIsNone(info['package_id'])

    def test_malformed_packaged_fields_never_escape_to_diagnostics(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'distribution.json').write_text(json.dumps({'version': '1.0.0.9', 'channel': 'beta',
                'build_info': {'package_id': 'private-path-secret', 'source_revision': '../private', 'source_dirty': 'yes'}}))
            info = read_build_info(root)
            self.assertEqual(info['status'], 'invalid')
            self.assertNotIn('private', json.dumps(info))
            self.assertIsNone(info['package_id'])

