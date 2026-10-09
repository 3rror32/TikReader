import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

import server


class PriorityAuditBackendTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_broadcast_state_uses_shared_studio_payload(self):
        studio = self.client.get('/studio/state')
        broadcast = self.client.get('/broadcast/state')

        self.assertEqual(studio.status_code, 200)
        self.assertEqual(broadcast.status_code, 200)
        studio_payload = studio.get_json()
        broadcast_payload = broadcast.get_json()
        self.assertEqual(broadcast_payload.pop('production')['session'], studio_payload['session'])
        self.assertEqual(broadcast_payload, studio_payload)

    def test_remote_request_churn_evicts_stale_and_bounds_ip_state(self):
        production = server.production
        production.remote_requests.clear()
        production.remote_readers.clear()

        with patch('production.time.time', return_value=1000):
            for address in range(1100):
                with server.app.test_request_context('/', environ_base={'REMOTE_ADDR': f'10.0.{address // 250}.{address % 250}'}):
                    self.assertTrue(production.allow_remote_read())
        self.assertLessEqual(len(production.remote_requests), 1000)

        with patch('production.time.time', return_value=1061):
            with server.app.test_request_context('/', environ_base={'REMOTE_ADDR': '192.0.2.1'}):
                self.assertTrue(production.allow_remote_read())
        self.assertNotIn('10.0.0.0', production.remote_requests)

    def test_remote_request_limit_remains_300_per_ip_per_minute(self):
        production = server.production
        production.remote_requests.clear()
        production.remote_readers.clear()

        with patch('production.time.time', return_value=1000):
            with server.app.test_request_context('/', environ_base={'REMOTE_ADDR': '192.0.2.2'}):
                for _ in range(300):
                    self.assertTrue(production.allow_remote_read())
                self.assertFalse(production.allow_remote_read())

    def test_concurrent_remote_request_pruning_does_not_delete_a_stale_ip_twice(self):
        production = server.production
        original_requests = production.remote_requests
        original_readers = production.remote_readers
        gate = Barrier(2)

        class CoordinatedRequestMap(dict):
            def items(self):
                snapshot = list(super().items())
                lock = getattr(production, 'remote_access_lock', None)
                if lock is None or not lock.locked():
                    gate.wait(timeout=3)
                return snapshot

        production.remote_requests = CoordinatedRequestMap({'198.51.100.1': [1000]})
        production.remote_readers = type(original_readers)()

        def request_from(address):
            with server.app.test_request_context('/', environ_base={'REMOTE_ADDR': address}):
                return production.allow_remote_read()

        try:
            with patch('production.time.time', return_value=1061):
                with ThreadPoolExecutor(max_workers=2) as workers:
                    results = list(workers.map(request_from, ('192.0.2.10', '192.0.2.11')))
            self.assertEqual(results, [True, True])
            self.assertEqual(set(production.remote_requests), {'192.0.2.10', '192.0.2.11'})
        finally:
            production.remote_requests = original_requests
            production.remote_readers = original_readers


if __name__ == '__main__':
    unittest.main()
