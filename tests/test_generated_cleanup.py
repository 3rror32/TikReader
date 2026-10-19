import os
from pathlib import Path
import tempfile
import time
import unittest
import subprocess
from unittest.mock import patch
from types import SimpleNamespace
from flask import Flask

from generated_cleanup import GeneratedCleanup, audio_workspace


class GeneratedCleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.override = patch.dict(os.environ, {'TIKREADER_DATA_DIR': str(self.root / 'data')})
        self.override.start()
        self.addCleanup(self.override.stop)
        self.cleaner = GeneratedCleanup(self.root)

    def old_file(self, relative, content=b'cache'):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        old = time.time() - 2 * 86400
        os.utime(path, (old, old))
        return path

    def test_preview_then_delete_only_owned_generated_files_and_repeat(self):
        cache = self.old_file('runtime/pycache/app.cpython-313.pyc')
        audio = self.old_file('data/generated-audio/tikreader-voice-abcdefgh/converted.wav')
        protected = [self.old_file(name) for name in ['data/history.sqlite3', 'data/backups/old.sqlite3',
                     'runtime/kokoro/model.bin', 'data/generated-audio/unrelated.wav',
                     'data/generated-audio/tikreader-voice-abcdefgh/model.pth', 'runtime/pycache/download.part']]
        preview = self.cleaner.scan()
        self.assertEqual(preview['count'], 2)
        self.assertEqual(preview['bytes'], 10)
        self.assertTrue(cache.exists())
        result = self.cleaner.clean(preview['token'])
        self.assertEqual((result['deleted'], result['bytes']), (2, 10))
        self.assertFalse(audio.exists())
        self.assertTrue(all(path.exists() for path in protected))
        self.assertEqual(self.cleaner.scan()['count'], 0)
        with self.assertRaises(ValueError):
            self.cleaner.clean(preview['token'])

    def test_active_audio_recent_files_and_replaced_candidates_are_preserved(self):
        old = self.old_file('runtime/pycache/old.pyc')
        preview = self.cleaner.scan()
        old.write_bytes(b'new audio or cache')
        with audio_workspace(self.root) as folder:
            active = self.old_file(str(Path(folder).relative_to(self.root) / 'source.wav'))
            self.assertEqual(self.cleaner.scan()['count'], 0)
            self.assertTrue(active.exists())
        # A new scan invalidates earlier preview authority.
        with self.assertRaises(ValueError):
            self.cleaner.clean(preview['token'])

    def test_failures_and_identity_changes_report_actual_results(self):
        first = self.old_file('runtime/pycache/one.pyc')
        second = self.old_file('runtime/pycache/two.pyc')
        preview = self.cleaner.scan()
        first.write_bytes(b'changed')
        with patch.object(self.cleaner, '_delete', side_effect=PermissionError('private path')):
            result = self.cleaner.clean(preview['token'])
        self.assertEqual(result['deleted'], 0)
        self.assertEqual(len(result['failures']), 1)
        self.assertEqual(result['skipped'], 1)
        self.assertNotIn('private path', str(result))
        self.assertTrue(first.exists() and second.exists())

    def test_reparse_roots_are_rejected_without_traversal(self):
        self.old_file('runtime/pycache/old.pyc')
        with patch('generated_cleanup._reparse', return_value=True):
            self.assertEqual(self.cleaner.scan()['count'], 0)

    def test_expired_previews_and_newly_active_audio_are_not_deleted(self):
        from generated_cleanup import ACTIVE
        audio = self.old_file('data/generated-audio/tikreader-voice-abcdefgh/source.wav')
        preview = self.cleaner.scan()
        ACTIVE.add(audio.parent)
        try:
            self.assertEqual(self.cleaner.clean(preview['token'])['skipped'], 1)
        finally:
            ACTIVE.discard(audio.parent)
        preview = self.cleaner.scan()
        with patch('generated_cleanup.time.monotonic', return_value=time.monotonic() + 400):
            with self.assertRaises(ValueError):
                self.cleaner.clean(preview['token'])
        self.assertTrue(audio.exists())

    def test_endpoint_requires_local_confirmation_and_ignores_no_paths(self):
        from release_support import register_release_routes
        app = Flask(__name__)
        runtime = SimpleNamespace(production=SimpleNamespace(local=lambda: True), platform_credentials=object())
        with patch('release_support.GeneratedCleanup', return_value=self.cleaner):
            register_release_routes(app, runtime)
        client = app.test_client()
        self.old_file('runtime/pycache/old.pyc')
        preview = client.get('/system/generated-cleanup').json
        self.assertEqual(client.post('/system/generated-cleanup', json={'confirm': True, 'token': preview['token'], 'path': '/'}).status_code, 400)
        runtime.production.local = lambda: False
        self.assertEqual(client.post('/system/generated-cleanup', json={'confirm': True, 'token': preview['token']}).status_code, 403)
        self.assertEqual(client.get('/system/generated-cleanup').status_code, 403)
        runtime.production.local = lambda: True
        result = client.post('/system/generated-cleanup', json={'confirm': True, 'token': preview['token']})
        self.assertEqual(result.json['deleted'], 1)

    def test_swapped_symlink_ancestor_preserves_outside_files(self):
        cache = self.old_file('runtime/pycache/nested/old.pyc')
        outside = self.old_file('outside/old.pyc', b'private')
        preview = self.cleaner.scan()
        cache.unlink()
        cache.parent.rmdir()
        try:
            cache.parent.symlink_to(outside.parent, target_is_directory=True)
        except OSError:
            if os.name != 'nt' or subprocess.run(
                    ['cmd', '/c', 'mklink', '/J', str(cache.parent), str(outside.parent)],
                    capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW).returncode:
                self.skipTest('Neither directory symlinks nor junctions are available')
        try:
            self.assertEqual(self.cleaner.clean(preview['token'])['skipped'], 1)
            self.assertTrue(outside.exists())
        finally:
            if os.name == 'nt':
                os.rmdir(cache.parent)
            else:
                cache.parent.unlink()

    def test_bounded_scan_marks_incomplete_and_rejects_unknown_token(self):
        for index in range(5):
            self.old_file(f'runtime/pycache/{index}.pyc')
        with patch('generated_cleanup.MAX_ENTRIES', 2):
            self.assertTrue(self.cleaner.scan()['limited'])
        with self.assertRaises(ValueError):
            self.cleaner.clean('arbitrary-path')
