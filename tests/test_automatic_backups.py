import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace

from automatic_backups import AutomaticBackups
from history_store import HistoryStore


class AutomaticBackupTests(unittest.TestCase):
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
