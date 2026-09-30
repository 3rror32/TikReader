import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
from daily_diagnostics import DailyDiagnostics


class DailyDiagnosticsTests(unittest.TestCase):
    def test_retention_only_removes_owned_expired_logs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            names = ['tikreader-2026-07-01.log', 'tikreader-2026-08-01.log', 'tikreader-2026-08-30.log', 'server-error.log', 'tikreader-9999-99-99.log']
            for name in names:
                (root / name).write_text('test', encoding='utf-8')
            DailyDiagnostics(root).prune(datetime(2026, 8, 30).date())
            self.assertFalse((root / names[0]).exists())
            for name in names[1:]:
                self.assertTrue((root / name).exists())

    def test_daily_rollover_dedup_recovery_and_append(self):
        state = dict(connected=False, connecting=True, retry_count=0,
                     likes_source='recovered', likes_known=True, viewers_known=False,
                     like_count=12, viewer_count=0, comment_count=0, gift_count=0,
                     like_events=0, username='must-not-be-logged')
        with tempfile.TemporaryDirectory() as directory, patch('daily_diagnostics.datetime') as clock:
            clock.now.return_value = datetime(2026, 8, 30, 12, tzinfo=timezone.utc)
            log = DailyDiagnostics(directory)
            log.record(state, {'like': None}, 'test-session')
            log.record(state, {'like': None}, 'test-session')
            path = Path(directory) / 'tikreader-2026-08-30.log'
            rows = path.read_text(encoding='utf-8').splitlines()
            self.assertEqual(len(rows), 1)
            self.assertIn('recuperado', json.loads(rows[0])['likes_note'])
            self.assertNotIn('must-not-be-logged', rows[0])
            state.update(connected=True, connecting=False, viewers_known=True)
            log.record(state, {'viewers': 123}, 'test-session')
            self.assertEqual(len(path.read_text(encoding='utf-8').splitlines()), 2)
            log.last_write -= 61
            log.record(state, {}, 'test-session')
            self.assertEqual(len(path.read_text(encoding='utf-8').splitlines()), 3)
            DailyDiagnostics(directory).record(state, {}, 'test-session')
            self.assertEqual(len(path.read_text(encoding='utf-8').splitlines()), 4)
            clock.now.return_value = datetime(2026, 8, 31, 12, tzinfo=timezone.utc)
            log.record(state, {}, 'test-session')
            self.assertTrue((Path(directory) / 'tikreader-2026-08-31.log').is_file())

    def test_write_failure_does_not_interrupt_stream(self):
        state = dict(connected=False, connecting=False, retry_count=0,
                     likes_source='pending', likes_known=False, viewers_known=False,
                     like_count=0, viewer_count=0, comment_count=0, gift_count=0, like_events=0)
        with tempfile.TemporaryDirectory() as directory:
            log = DailyDiagnostics(directory)
            with patch.object(Path, 'mkdir', side_effect=PermissionError), patch('builtins.print') as output:
                log.record(state, {}, 'test')
                log.record(state, {}, 'test')
                output.assert_called_once()
            log.record(state, {}, 'test')
            self.assertFalse(log.failed)

    def test_idle_heartbeat_is_sparse_but_state_changes_are_immediate(self):
        state = dict(connected=False, connecting=False, retry_count=0,
                     likes_source='pending', likes_known=False, viewers_known=False,
                     like_count=0, viewer_count=0, comment_count=0, gift_count=0, like_events=0)
        with tempfile.TemporaryDirectory() as directory:
            log = DailyDiagnostics(directory)
            log.record(state, {}, 'idle')
            log.last_write -= 61
            log.record(state, {}, 'idle')
            path = next(Path(directory).glob('tikreader-*.log'))
            self.assertEqual(len(path.read_text(encoding='utf-8').splitlines()), 1)
            state['connecting'] = True
            log.record(state, {}, 'idle')
            self.assertEqual(len(path.read_text(encoding='utf-8').splitlines()), 2)


if __name__ == '__main__':
    unittest.main()
