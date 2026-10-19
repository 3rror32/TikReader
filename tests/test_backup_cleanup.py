import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from flask import Flask

from backup_cleanup import BackupCleanup


class BackupCleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.override = patch.dict(os.environ, {'TIKREADER_DATA_DIR': str(self.root / 'data')})
        self.override.start()
        self.addCleanup(self.override.stop)
        self.manager = BackupCleanup(self.root)

    def backup(self, name, age=3 * 86400, content=b'backup'):
        path = self.root / 'data' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        at = time.time() - age
        os.utime(path, (at, at))
        return path

    def pair(self):
        old = self.backup('backups/tikreader-auto-20260101-000000-aaaaaaaa.sqlite3')
        new = self.backup('backups/tikreader-auto-20260102-000000-bbbbbbbb.sqlite3', 2 * 86400)
        return old, new

    def test_all_producer_groups_protect_newest_and_unknown_files(self):
        groups = ['backups/tikreader-auto-{}-aaaaaaaa.sqlite3', 'backups/tikreader-manual-{}-aaaaaaaa.sqlite3',
                  'backups/tikreader-{}-aaaaaaaa.sqlite3', 'backups/before-creator-update-{}.sqlite3',
                  'code-backups/{}-aaaaaaaa.zip', 'recovery-before-{}-aaaaaaaa.zip']
        for pattern in groups:
            self.backup(pattern.format('20260101-000000'))
            self.backup(pattern.format('20260102-000000'), 2 * 86400)
        unknown = self.backup('backups/tikreader-auto-unrecognized.sqlite3')
        self.backup('code-backups/20260102-000000-aaaaaaaa.zip.partial')
        self.backup('external/export.zip')
        preview = self.manager.scan()
        self.assertEqual(len(preview['files']), 12)
        self.assertEqual(sum(row['selectable'] for row in preview['files']), 6)
        self.assertEqual(len({row['kind'] for row in preview['files']}), 6)
        self.assertTrue(unknown.exists())

    def test_selection_subset_totals_and_replay(self):
        old, newest = self.pair()
        unselected = self.backup('backups/tikreader-auto-20251201-000000-cccccccc.sqlite3', 4 * 86400)
        preview = self.manager.scan()
        selected = [row['id'] for row in preview['files'] if row['name'] == old.name]
        result = self.manager.clean(preview['token'], selected)
        self.assertEqual((result['deleted'], result['bytes']), (1, 6))
        self.assertFalse(old.exists())
        self.assertTrue(newest.exists())
        self.assertTrue(unselected.exists())
        with self.assertRaises(ValueError):
            self.manager.clean(preview['token'], selected)

    def test_all_selection_is_validated_before_any_deletion(self):
        old, _ = self.pair()
        preview = self.manager.scan()
        eligible = next(row['id'] for row in preview['files'] if row['selectable'])
        protected = next(row['id'] for row in preview['files'] if not row['selectable'])
        for ids in ([eligible, protected], [eligible, 'unknown'], [eligible, eligible], [], '../file'):
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                self.manager.clean(preview['token'], ids)
            self.assertTrue(old.exists())

    def test_newest_is_recomputed_when_previous_newest_disappears(self):
        old, newest = self.pair()
        preview = self.manager.scan()
        selected = [row['id'] for row in preview['files'] if row['selectable']]
        newest.unlink()
        result = self.manager.clean(preview['token'], selected)
        self.assertEqual(result['skipped'], 1)
        self.assertTrue(old.exists())

    def test_ties_recent_and_incomplete_inventory_fail_safe(self):
        first, second = self.pair()
        info = first.stat()
        os.utime(second, ns=(info.st_atime_ns, info.st_mtime_ns))
        self.assertTrue(all(not row['selectable'] for row in self.manager.scan()['files']))
        recent = self.backup('backups/tikreader-manual-20260103-000000-cccccccc.sqlite3', 10)
        self.assertTrue(all(not row['selectable'] for row in self.manager.scan()['files']))
        with patch('backup_cleanup.MAX_ENTRIES', 1):
            preview = self.manager.scan()
        self.assertTrue(preview['limited'])
        self.assertTrue(all(not row['selectable'] for row in preview['files']))
        self.assertTrue(recent.exists())

    def test_expired_changed_and_locked_candidates_preserve_data(self):
        old, _ = self.pair()
        preview = self.manager.scan()
        ids = [row['id'] for row in preview['files'] if row['selectable']]
        with patch('backup_cleanup.time.monotonic', return_value=time.monotonic() + 400), self.assertRaises(ValueError):
            self.manager.clean(preview['token'], ids)
        preview = self.manager.scan()
        ids = [row['id'] for row in preview['files'] if row['selectable']]
        old.write_bytes(b'changed')
        self.assertEqual(self.manager.clean(preview['token'], ids)['skipped'], 1)
        os.utime(old, (time.time() - 4 * 86400,) * 2)
        preview = self.manager.scan()
        ids = [row['id'] for row in preview['files'] if row['selectable']]
        with patch('backup_cleanup.delete_inspected', side_effect=PermissionError('private-path')):
            result = self.manager.clean(preview['token'], ids)
        self.assertEqual(len(result['failures']), 1)
        self.assertNotIn('private-path', str(result))
        self.assertTrue(old.exists())

    def test_strict_routes_and_stale_preview_never_accept_paths(self):
        from release_support import register_release_routes
        app = Flask(__name__)
        runtime = SimpleNamespace(production=SimpleNamespace(local=lambda: True), platform_credentials=object())
        with patch('release_support.BackupCleanup', return_value=self.manager):
            register_release_routes(app, runtime)
        client = app.test_client()
        old, _ = self.pair()
        preview = client.get('/system/backup-cleanup').json
        ids = [row['id'] for row in preview['files'] if row['selectable']]
        payload = {'confirm': True, 'token': preview['token'], 'selected': ids}
        self.assertEqual(client.post('/system/backup-cleanup', json={**payload, 'path': str(old)}).status_code, 400)
        self.assertEqual(client.post('/system/backup-cleanup', json={**payload, 'confirm': False}).status_code, 400)
        self.assertEqual(client.post('/system/backup-cleanup', json=payload, headers={'Origin': 'https://example.invalid'}).status_code, 403)
        runtime.production.local = lambda: False
        self.assertEqual(client.get('/system/backup-cleanup').status_code, 403)
        self.assertEqual(client.post('/system/backup-cleanup', json=payload).status_code, 403)
        runtime.production.local = lambda: True
        client.get('/system/backup-cleanup')
        self.assertEqual(client.post('/system/backup-cleanup', json=payload).status_code, 409)
        self.assertTrue(old.exists())

    def test_current_incomplete_scan_and_hardlinks_disable_deletion(self):
        old, newest = self.pair()
        preview = self.manager.scan()
        ids = [row['id'] for row in preview['files'] if row['selectable']]
        with patch('backup_cleanup.MAX_ENTRIES', 1):
            self.assertEqual(self.manager.clean(preview['token'], ids)['skipped'], 1)
        link = old.with_name('tikreader-auto-20260103-000000-cccccccc.sqlite3')
        try:
            os.link(old, link)
        except OSError:
            self.skipTest('Hardlink creation is unavailable on this host')
        preview = self.manager.scan()
        self.assertTrue(preview['limited'])
        self.assertTrue(all(not row['selectable'] for row in preview['files']))
        self.assertTrue(old.exists() and newest.exists())

    def test_reparse_roots_fail_safe_and_partial_results_count_only_deleted_files(self):
        from generated_cleanup import delete_inspected
        old, _ = self.pair()
        other = self.backup('backups/tikreader-manual-20260101-000000-aaaaaaaa.sqlite3', content=b'1234')
        self.backup('backups/tikreader-manual-20260102-000000-bbbbbbbb.sqlite3', 2 * 86400)
        with patch('generated_cleanup._reparse', return_value=True):
            self.assertTrue(self.manager.scan()['limited'])
        preview = self.manager.scan()
        ids = [row['id'] for row in preview['files'] if row['selectable']]
        def remove(candidate):
            if candidate.path == old:
                raise PermissionError('private-path')
            return delete_inspected(candidate)
        with patch('backup_cleanup.delete_inspected', side_effect=remove):
            result = self.manager.clean(preview['token'], ids)
        self.assertEqual((result['deleted'], result['bytes'], len(result['failures'])), (1, 4, 1))
        self.assertTrue(old.exists())
        self.assertFalse(other.exists())

    @unittest.skipUnless(os.name == 'nt', 'Windows file-sharing semantics')
    def test_windows_writer_blocks_deletion_and_newest_is_held_during_execution(self):
        from generated_cleanup import delete_inspected
        old, newest = self.pair()
        preview = self.manager.scan()
        ids = [row['id'] for row in preview['files'] if row['selectable']]
        with old.open('r+b'):
            result = self.manager.clean(preview['token'], ids)
        self.assertEqual(len(result['failures']), 1)
        self.assertTrue(old.exists())
        preview = self.manager.scan()
        ids = [row['id'] for row in preview['files'] if row['selectable']]
        def inspect_lease(candidate):
            with self.assertRaises(PermissionError):
                newest.unlink()
            return delete_inspected(candidate)
        with patch('backup_cleanup.delete_inspected', side_effect=inspect_lease):
            self.assertEqual(self.manager.clean(preview['token'], ids)['deleted'], 1)
        self.assertTrue(newest.exists())
