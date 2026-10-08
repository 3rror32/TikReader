import unittest
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


if __name__ == '__main__':
    unittest.main()
