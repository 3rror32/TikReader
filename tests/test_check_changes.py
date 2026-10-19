import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

import check_changes


def alive(pid):
    if os.name != 'nt':
        try:
            os.kill(pid, 0)
            status = Path(f'/proc/{pid}/stat')
            return not status.exists() or status.read_text().split()[2] != 'Z'
        except ProcessLookupError:
            return False
    import ctypes
    from ctypes import wintypes as w
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    opener = kernel.OpenProcess; opener.argtypes = [w.DWORD,w.BOOL,w.DWORD]; opener.restype = w.HANDLE
    handle = opener(0x1000,False,pid)
    if not handle:
        return False
    try:
        code = w.DWORD()
        query = kernel.GetExitCodeProcess; query.argtypes = [w.HANDLE,ctypes.POINTER(w.DWORD)]
        return bool(query(handle,ctypes.byref(code))) and code.value == 259
    finally:
        closer = kernel.CloseHandle; closer.argtypes = [w.HANDLE]; closer(handle)


class CheckerStagesTests(unittest.TestCase):
    def test_selection_validation_and_unrun_statuses(self):
        with tempfile.TemporaryDirectory() as folder:
            stages = [check_changes.Stage('first', [[sys.executable, '-c', 'raise SystemExit(4)']], 5),
                      check_changes.Stage('second', [[sys.executable, '-c', 'print("ok")']], 5)]
            with self.assertRaises(ValueError):
                check_changes.run(stages, stage='unknown', log_root=Path(folder))
            self.assertEqual(list(Path(folder).iterdir()), [])
            self.assertEqual(check_changes.run(stages, from_stage='second', log_root=Path(folder)), 0)
            report = json.loads((Path(folder) / 'latest.json').read_text())
            self.assertEqual([row['status'] for row in report['stages']], ['not_selected', 'passed'])
            self.assertGreaterEqual(report['stages'][1]['duration_seconds'], 0)

    def test_logs_are_bounded_and_optional_skips_are_explicit(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(check_changes, 'MAX_LOG_BYTES', 1024):
            stages = [check_changes.Stage('output', [[sys.executable, '-c', 'print("x"*100000)']], 5),
                      check_changes.Stage('optional', [], 5, skip='Optional dependency unavailable')]
            self.assertEqual(check_changes.run(stages, log_root=Path(folder)), 0)
            report = json.loads((Path(folder) / 'latest.json').read_text())
            self.assertTrue(report['stages'][0]['log_truncated'])
            self.assertEqual(report['stages'][1]['status'], 'skipped')
            self.assertLessEqual((Path(folder) / report['stages'][0]['log']).stat().st_size, 1024)
            self.assertNotIn('commands', str(report))

    def test_timeout_terminates_owned_parent_and_descendant(self):
        with tempfile.TemporaryDirectory() as folder:
            pidfile = Path(folder) / 'child.pid'
            script = ('import subprocess,sys,time,pathlib; '
                      'p=subprocess.Popen([sys.executable,"-c","import time; time.sleep(60)"]); '
                      f'pathlib.Path({str(pidfile)!r}).write_text(str(p.pid)); time.sleep(60)')
            stage = check_changes.Stage('timeout', [[sys.executable, '-c', script]], 1)
            self.assertEqual(check_changes.run([stage], log_root=Path(folder)), 1)
            report = json.loads((Path(folder) / 'latest.json').read_text())
            self.assertEqual(report['stages'][0]['status'], 'timeout')
            self.assertTrue(pidfile.exists())
            pid = int(pidfile.read_text())
            deadline = time.monotonic() + 3
            while alive(pid) and time.monotonic() < deadline:
                time.sleep(.05)
            self.assertFalse(alive(pid))

    def test_coverage_selection_adds_prerequisites_and_failure_blocks_consumers(self):
        stages = check_changes.default_stages()
        selected = check_changes.select_stages(stages, stage='coverage-report')
        self.assertTrue({'coverage-erase', 'coverage-tests', 'coverage-report'} <= selected)
        with tempfile.TemporaryDirectory() as folder:
            fake = [check_changes.Stage('coverage-erase', [[sys.executable, '-c', 'raise SystemExit(2)']], 5),
                    check_changes.Stage('coverage-tests', [[sys.executable, '-c', 'raise SystemExit(0)']], 5,
                                        depends=('coverage-erase',))]
            self.assertEqual(check_changes.run(fake, log_root=Path(folder)), 1)
            report = json.loads((Path(folder) / 'latest.json').read_text())
            self.assertEqual(report['stages'][1]['status'], 'blocked')
