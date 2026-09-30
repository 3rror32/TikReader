import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app_config import load_or_create_secret, runtime_config
from history_store import HistoryStore


class ConfigurationTests(unittest.TestCase):
    def test_secret_is_generated_and_reused(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'secret'
            first = load_or_create_secret(path)
            self.assertGreaterEqual(len(first), 32)
            self.assertEqual(load_or_create_secret(path), first)

    def test_network_is_local_unless_explicitly_enabled(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(runtime_config().host, '127.0.0.1')
        with patch.dict(os.environ, {'TIKREADER_LAN': '1'}, clear=True):
            self.assertEqual(runtime_config().host, '0.0.0.0')

    def test_invalid_port_is_rejected(self):
        with patch.dict(os.environ, {'TIKREADER_PORT': '70000'}, clear=True):
            with self.assertRaises(RuntimeError):
                runtime_config()


class MigrationTests(unittest.TestCase):
    def test_database_has_version_and_indexes(self):
        with tempfile.TemporaryDirectory() as folder:
            store = HistoryStore(Path(folder) / 'history.sqlite3')
            health = store.health()
            self.assertEqual(health['integrity'], 'ok')
            self.assertEqual(health['schema_version'], HistoryStore.SCHEMA_VERSION)


class SystemRouteTests(unittest.TestCase):
    def test_health_has_security_headers_and_metrics(self):
        import server
        with tempfile.TemporaryDirectory() as folder:
            previous = server.archive
            server.archive = HistoryStore(Path(folder) / 'history.sqlite3')
            try:
                response = server.app.test_client().get('/health')
            finally:
                server.archive = previous
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
            self.assertEqual(response.headers['Cross-Origin-Resource-Policy'], 'same-origin')
            self.assertEqual(response.get_json()['archive']['integrity'], 'ok')

    def test_cross_site_mutation_is_rejected_globally(self):
        import server
        response = server.app.test_client().post(
            '/widget-settings/chat', json={},
            headers={'Sec-Fetch-Site': 'cross-site'},
        )
        self.assertEqual(response.status_code, 403)

    def test_readiness_is_local_and_has_actionable_checks(self):
        import server
        with tempfile.TemporaryDirectory() as folder, patch.object(server, 'archive', HistoryStore(Path(folder) / 'history.sqlite3')):
            response = server.app.test_client().get('/system/readiness')
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIsInstance(payload['ready'], bool)
        self.assertTrue({'storage', 'archive', 'overlays', 'lan'}.issubset({item['id'] for item in payload['checks']}))
        self.assertEqual(server.app.test_client().get(
            '/system/readiness', environ_overrides={'REMOTE_ADDR': '10.0.0.2'}).status_code, 403)

    def test_control_center_is_aggregated_and_backup_mode_starts_off(self):
        import server
        with tempfile.TemporaryDirectory() as folder, patch.object(server, 'archive', HistoryStore(Path(folder) / 'history.sqlite3')):
            server.automatic_backups.load()
            response = server.app.test_client().get('/system/control-center')
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue({'readiness', 'components', 'backups', 'lan', 'operations', 'update'}.issubset(payload))
        self.assertFalse(payload['backups']['enabled'])
        self.assertTrue(payload['backups']['starts_disabled'])

    def test_remote_overlay_requires_read_only_lan_key(self):
        import server
        client = server.app.test_client()
        remote = {'REMOTE_ADDR': '10.0.0.2'}
        self.assertEqual(client.get('/broadcast/feed', environ_overrides=remote).status_code, 401)
        response = client.get('/widget/chat?access=' + server.production.view_token, environ_overrides=remote)
        self.assertEqual(response.status_code, 200)
        self.assertIn('tikreader_lan_view=', response.headers.get('Set-Cookie', ''))
        access = client.get('/system/lan-access').get_json()
        self.assertEqual(access['token'], server.production.view_token)
        old_token = server.production.view_token
        rotated = client.post('/system/lan-access/rotate', json={'confirm': True}).get_json()
        self.assertNotEqual(rotated['token'], old_token)
        self.assertEqual(client.get('/system/lan-access', environ_overrides=remote).status_code, 403)


if __name__ == '__main__':
    unittest.main()
