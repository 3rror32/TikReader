import tempfile
import threading
import unittest
import sqlite3
from unittest.mock import patch, MagicMock
from pathlib import Path
from types import SimpleNamespace

from automatic_backups import AutomaticBackups
from history_store import HistoryStore


class AutomaticBackupTests(unittest.TestCase):
    def test_legacy_deadlines_do_not_move_on_restart_or_fabricate_success(self):
        for last_file in ('tikreader-auto-existing.sqlite3', ''):
            with self.subTest(last_file=last_file), tempfile.TemporaryDirectory() as folder:
                runtime = self.runtime(folder)
                runtime.archive.set_setting('automatic_backups', {
                    'enabled': True, 'interval_hours': 24, 'keep': 7,
                    'last_at': 1000, 'last_file': last_file,
                })
                for now in (100000, 150000):
                    with patch('automatic_backups.time.time', return_value=now):
                        manager = AutomaticBackups(runtime)
                        manager.load()
                    state = manager.snapshot()
                    self.assertEqual(state['next_at'], 87400)
                    self.assertLess(state['next_at'], now)
                    self.assertEqual(state['last_at'], 1000 if last_file else 0)

    def test_backup_publishes_atomically_and_success_survives_status_write_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            runtime = self.runtime(folder)
            target = Path(folder) / 'existing.sqlite3'
            target.write_bytes(b'previous successful copy')
            source = MagicMock()
            source.__enter__.return_value.backup.side_effect = sqlite3.OperationalError('locked')
            with patch.object(runtime.archive, 'connect', return_value=source):
                with self.assertRaises(sqlite3.Error):
                    runtime.archive.backup(target)
            self.assertEqual(target.read_bytes(), b'previous successful copy')
            self.assertEqual(list(Path(folder).glob('*.partial-*')), [])
            manager = AutomaticBackups(runtime)
            with patch.object(runtime.archive, 'set_setting', side_effect=sqlite3.OperationalError('locked')):
                created = manager.create()
            self.assertTrue(created.is_file())
            self.assertGreater(manager.snapshot()['last_at'], 0)
            self.assertIn('estado', manager.snapshot()['status_error'])

    def test_enabling_and_failed_attempt_never_claim_success(self):
        with tempfile.TemporaryDirectory() as folder:
            manager = AutomaticBackups(self.runtime(folder))
            manager.configure({'enabled': True})
            self.assertEqual(manager.snapshot()['last_at'], 0)
            self.assertGreater(manager.snapshot()['next_at'], 0)
            with patch.object(manager.runtime.archive, 'backup', side_effect=sqlite3.OperationalError('private-path')):
                with self.assertRaises(sqlite3.Error):
                    manager.create()
            state = manager.snapshot()
            self.assertEqual(state['last_at'], 0)
            self.assertGreater(state['last_attempt_at'], 0)
            self.assertGreater(state['next_at'], state['last_attempt_at'])
            self.assertNotIn('private-path', state['last_error'])

    def test_scheduler_survives_backup_and_error_persistence_failures(self):
        with tempfile.TemporaryDirectory() as folder:
            manager = AutomaticBackups(self.runtime(folder))
            manager.config.update(enabled=True, next_at=1)
            def stop_after_wait(timeout):
                manager.stop_event.set()
            with patch.object(manager.runtime.archive, 'backup', side_effect=sqlite3.OperationalError('locked')), \
                    patch.object(manager.runtime.archive, 'set_setting', side_effect=sqlite3.OperationalError('locked')), \
                    patch.object(manager.wake, 'wait', side_effect=stop_after_wait):
                manager._worker()
            self.assertGreater(manager.snapshot()['next_at'], 1)
            self.assertTrue(manager.snapshot()['last_error'])

    def runtime(self, folder):
        return SimpleNamespace(
            archive=HistoryStore(Path(folder) / "history.sqlite3"),
            feed_lock=threading.RLock(),
        )

    def test_backups_start_disabled_and_opt_in_does_not_run_immediately(self):
        with tempfile.TemporaryDirectory() as folder:
            manager = AutomaticBackups(self.runtime(folder))
            manager.load()
            self.assertFalse(manager.snapshot()["enabled"])
            self.assertTrue(manager.snapshot()["starts_disabled"])
            manager.configure({"enabled": True, "interval_hours": 24, "keep": 7})
            self.assertTrue(manager.snapshot()["enabled"])
            self.assertEqual(list((Path(folder) / "backups").glob("*.sqlite3")), [])

    def test_manual_backup_is_available_while_automatic_mode_is_off(self):
        with tempfile.TemporaryDirectory() as folder:
            manager = AutomaticBackups(self.runtime(folder))
            manager.load()
            target = manager.create(manual=True)
            self.assertTrue(target.is_file())
            self.assertTrue(target.name.startswith("tikreader-manual-"))
            self.assertFalse(manager.snapshot()["enabled"])

    def test_configuration_is_persisted(self):
        with tempfile.TemporaryDirectory() as folder:
            runtime = self.runtime(folder)
            first = AutomaticBackups(runtime)
            first.load()
            first.configure({"enabled": True, "interval_hours": 72, "keep": 14})
            second = AutomaticBackups(runtime)
            second.load()
            self.assertTrue(second.snapshot()["enabled"])
            self.assertEqual(second.snapshot()["interval_hours"], 72)
            self.assertEqual(second.snapshot()["keep"], 14)


if __name__ == "__main__":
    unittest.main()
