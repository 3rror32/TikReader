import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from contextlib import closing
import zipfile
import errno

import data_recovery
from history_store import HistoryStore


class RecoverySafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.environment = patch.dict(os.environ, {'TIKREADER_DATA_DIR': ''})
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def database(self, root=None):
        return HistoryStore((root or self.root) / 'data' / 'history.sqlite3')

    def package(self, root, output):
        files = {'history.sqlite3': root / 'data' / 'history.sqlite3'}
        files['media/test.wav'] = root / 'data' / 'media' / 'test.wav'
        files['media/test.wav'].parent.mkdir(parents=True, exist_ok=True)
        files['media/test.wav'].write_bytes(b'restored media')
        for path in (root / 'assets' / 'voice_models').rglob('*'):
            if path.is_file():
                files['voice_models/' + path.relative_to(root / 'assets' / 'voice_models').as_posix()] = path
        with zipfile.ZipFile(output, 'w') as archive:
            for name, path in files.items():
                archive.write(path, name)
            archive.writestr('manifest.json', json.dumps({'version': 1, 'files': {
                name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in files.items()}}))
        return output

    def test_startup_breaking_settings_rejected_read_only(self):
        store = self.database()
        for key, value in [('timer_checkpoint', 'broken'), ('timer_checkpoint', float('inf')),
                           ('gift_catalog_cache', 7), ('like_goal', []), ('gift_goal', 0),
                           ('global_limit', {}), ('external_ttl', -1), ('game_hotkey_profiles', None),
                           ('bank_contents', {'shapes': []}), ('production_config', {'scene': 'invalid'}),
                           ('chatbot', []), ('overlay_goals', {'goal-one': {'goal': 'bad'}})]:
            with self.subTest(key=key, value=value):
                store.set_setting(key, value)
                before = Path(store.path).read_bytes()
                with self.assertRaises(ValueError):
                    data_recovery.validate_database(Path(store.path))
                self.assertEqual(Path(store.path).read_bytes(), before)
                with store.connect() as db:
                    db.execute('DELETE FROM settings')

    def test_compatible_settings_unknown_json_and_explicit_legacy_schema(self):
        store = self.database()
        for key, value in {'timer_checkpoint': 1000000.5, 'like_goal': 5,
                           'gift_catalog_cache': [{'id': 1, 'name': 'Rose', 'diamonds': 1}],
                           'overlay_goals': {'goal-test': {'goal': 100, 'value': 0}},
                           'production_config': {'scene': 'talk', 'revision': 3, 'hide_names': False},
                           'future_setting': {'unrecognized': [1, 'safe', None]}}.items():
            store.set_setting(key, value)
        for version in ('1', '2'):
            with store.connect() as db:
                db.execute("UPDATE metadata SET value=? WHERE key='schema_version'", (version,))
            data_recovery.validate_database(Path(store.path))
            with closing(sqlite3.connect(store.path)) as db:
                self.assertEqual(db.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()[0], version)

    def test_raw_future_schema_and_missing_columns_are_rejected(self):
        store = self.database()
        with store.connect() as db:
            db.execute("UPDATE metadata SET value='99' WHERE key='schema_version'")
        with self.assertRaises(ValueError):
            data_recovery.validate_database(Path(store.path))

        with store.connect() as db:
            db.execute("UPDATE metadata SET value='2' WHERE key='schema_version'")
            db.execute('ALTER TABLE sessions DROP COLUMN username')
        with self.assertRaises(ValueError):
            data_recovery.validate_database(Path(store.path))

    def test_unsafe_schema_constraints_and_objects_are_rejected(self):
        store = self.database()
        for statement, cleanup in [
                ('CREATE UNIQUE INDEX idx_unexpected ON settings(value)', 'DROP INDEX idx_unexpected'),
                ('CREATE TRIGGER unsafe AFTER INSERT ON settings BEGIN DELETE FROM events; END', 'DROP TRIGGER unsafe')]:
            with store.connect() as db:
                db.execute(statement)
            with self.assertRaises(ValueError):
                data_recovery.validate_database(Path(store.path))
            with store.connect() as db:
                db.execute(cleanup)

    def test_invalid_restore_preserves_previous_database_and_media(self):
        source = self.root / 'source'
        store = self.database(source)
        store.set_setting('timer_checkpoint', {'bad': True})
        package = self.package(source, self.root / 'invalid.zip')
        target = self.root / 'target'
        old = self.database(target)
        old.set_setting('unknown', 'bootable')
        media = target / 'data' / 'media' / 'test.wav'
        media.parent.mkdir(parents=True)
        media.write_bytes(b'old media')
        before = Path(old.path).read_bytes()
        with self.assertRaises(ValueError):
            data_recovery.restore(package, target)
        self.assertEqual(Path(old.path).read_bytes(), before)
        self.assertEqual(media.read_bytes(), b'old media')

    def test_valid_restore_repairs_bad_old_settings_and_preserves_them_in_safety_copy(self):
        source, target = self.root / 'source', self.root / 'target'
        incoming = self.database(source)
        incoming.set_setting('timer_checkpoint', 5)
        package = data_recovery.backup(self.root / 'valid.zip', source)
        current = self.database(target)
        current.set_setting('timer_checkpoint', 'broken')
        safety = data_recovery.restore(package, target)
        self.assertEqual(current.settings()['timer_checkpoint'], 5)
        with zipfile.ZipFile(safety) as archive:
            old = self.root / 'old.sqlite3'
            old.write_bytes(archive.read('history.sqlite3'))
        with closing(sqlite3.connect(old)) as db:
            self.assertEqual(json.loads(db.execute("SELECT value FROM settings WHERE key='timer_checkpoint'").fetchone()[0]), 'broken')
        with self.assertRaises(ValueError):
            data_recovery.validate_database(old)

    def test_low_space_precedes_backup_and_restore_copy(self):
        source = self.root / 'source'
        self.database(source)
        package = self.package(source, self.root / 'source.zip')
        low = SimpleNamespace(total=100, used=100, free=0)
        with patch('data_recovery.shutil.disk_usage', return_value=low), patch('data_recovery.shutil.copyfileobj') as copy:
            with self.assertRaisesRegex(ValueError, 'espacio'):
                data_recovery.backup(self.root / 'backup.zip', source)
            with self.assertRaisesRegex(ValueError, 'espacio'):
                data_recovery.restore(package, self.root / 'target')
            copy.assert_not_called()
        self.assertFalse((self.root / 'backup.zip').exists())

    def test_publication_race_preserves_other_destination_and_cleans_own_partial(self):
        self.database()
        output = self.root / 'backup.zip'
        publish = data_recovery._publish_exclusive
        def race(partial, destination):
            destination.write_bytes(b'other writer')
            return publish(partial, destination)
        with patch('data_recovery._publish_exclusive', side_effect=race), self.assertRaises(FileExistsError):
            data_recovery.backup(output, self.root)
        self.assertEqual(output.read_bytes(), b'other writer')
        self.assertEqual(list(self.root.glob('*.partial-*')), [])

    def test_disk_full_corrupt_zip_and_partial_collision_never_publish(self):
        self.database()
        output = self.root / 'backup.zip'
        with patch('data_recovery.zipfile.ZipFile.write', side_effect=OSError(errno.ENOSPC, 'disk full')):
            with self.assertRaises(OSError):
                data_recovery.backup(output, self.root)
        self.assertFalse(output.exists())
        self.assertEqual(list(self.root.glob('*.partial-*')), [])
        verify = data_recovery._verify_package
        def corrupt(partial, database):
            partial.write_bytes(b'corrupted publication')
            verify(partial, database)
        with patch('data_recovery._verify_package', side_effect=corrupt), self.assertRaises(zipfile.BadZipFile):
            data_recovery.backup(output, self.root)
        self.assertFalse(output.exists())
        self.assertEqual(list(self.root.glob('*.partial-*')), [])
        other = output.with_name(output.name + '.partial-collision')
        other.write_bytes(b'other partial')
        with patch('data_recovery.uuid.uuid4', return_value=SimpleNamespace(hex='collision')), self.assertRaises(FileExistsError):
            data_recovery.backup(output, self.root)
        self.assertEqual(other.read_bytes(), b'other partial')

    def test_low_space_on_voice_volume_prevents_extraction(self):
        source, target = self.root / 'source', self.root / 'target'
        self.database(source)
        voice = source / 'assets' / 'voice_models' / 'test' / 'model.pth'
        voice.parent.mkdir(parents=True); voice.write_bytes(b'voice')
        package = self.package(source, self.root / 'voice.zip')
        (target / 'assets' / 'voice_models').mkdir(parents=True)
        def volume(path):
            return 'voice-volume' if 'assets' in Path(path).parts else 'data-volume'
        def free(path):
            return SimpleNamespace(free=0 if 'assets' in Path(path).parts else 10**12)
        with patch('data_recovery._filesystem_key', side_effect=volume), \
                patch('data_recovery.shutil.disk_usage', side_effect=free), \
                patch('data_recovery.shutil.copyfileobj') as copy, self.assertRaisesRegex(ValueError, 'espacio'):
            data_recovery.restore(package, target)
        copy.assert_not_called()
        self.assertFalse((target / 'data' / 'history.sqlite3').exists())

    def test_shared_volume_requirements_are_summed_with_one_reserve(self):
        with patch('data_recovery.shutil.disk_usage', return_value=SimpleNamespace(free=data_recovery.RESERVE_BYTES + 15)), \
                self.assertRaisesRegex(ValueError, 'espacio'):
            data_recovery._check_space([(self.root, 10), (self.root / 'child', 10)])

    @unittest.skipUnless(os.name == 'nt', 'Windows drive and UNC fallback')
    def test_windows_unc_fallback_does_not_merge_different_shares(self):
        from unittest.mock import Mock
        anchors = [Mock(), Mock()]
        for anchor, share in zip(anchors, ('one', 'two')):
            anchor.stat.return_value = SimpleNamespace(st_dev=0)
            anchor.resolve.return_value = '\\\\server\\' + share + '\\folder'
        with patch('data_recovery._existing', side_effect=anchors):
            self.assertNotEqual(data_recovery._filesystem_key(self.root), data_recovery._filesystem_key(self.root))

    def test_cross_volume_copy_failure_and_success_keep_targets_safe(self):
        source, target = self.root / 'source.wav', self.root / 'destination.wav'
        source.write_bytes(b'new'); target.write_bytes(b'old')
        with patch('data_recovery._filesystem_key', side_effect=['source', 'target']), \
                patch('data_recovery.shutil.copyfileobj', side_effect=OSError(errno.ENOSPC, 'disk full')), self.assertRaises(OSError):
            data_recovery._install_file(source, target)
        self.assertEqual(target.read_bytes(), b'old')
        self.assertEqual(list(self.root.glob('*.partial-*')), [])
        with patch('data_recovery._filesystem_key', side_effect=['source', 'target']):
            data_recovery._install_file(source, target)
        self.assertEqual(target.read_bytes(), b'new')
        self.assertTrue(source.exists())
