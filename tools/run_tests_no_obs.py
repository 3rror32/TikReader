from pathlib import Path as _BootstrapPath
import sys as _bootstrap_sys
_bootstrap_sys.path.insert(0, str(_BootstrapPath(__file__).resolve().parent.parent / 'app'))
"""Run backend tests without cases that exercise OBS views or broadcasts."""
import unittest

EXCLUDED = {
    'test_obs_panels_are_allowlisted_and_use_shared_readonly_view',
    'test_highlight_and_answered_state',  # Includes an overlay route assertion.
    'test_public_privacy_does_not_mutate_private_records',
    'test_emergency_and_non_talk_hide_public_messages',
}

def cases(suite):
    for test in suite:
        if isinstance(test, unittest.TestSuite):
            yield from cases(test)
        elif test._testMethodName not in EXCLUDED:
            yield test

if __name__ == '__main__':
    suite=unittest.TestLoader().discover(str(_BootstrapPath(__file__).resolve().parent.parent / 'tests'), pattern='test_*.py')
    result=unittest.TextTestRunner(verbosity=1).run(unittest.TestSuite(cases(suite)))
    raise SystemExit(0 if result.wasSuccessful() else 1)
