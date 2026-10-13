import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from app_paths import data_dir, voice_models_dir, kokoro_assets, microphone_speech_model
from history_store import HistoryStore
from migrate_previous import migrate
from platform_credentials import PlatformCredentialStore


class ReleaseTests(unittest.TestCase):
    def test_platform_credentials_are_protected_and_public_status_never_reveals_them(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'credentials.bin'
            def protect(value):
                return b'protected:' + value[::-1]

            def unprotect(value):
                return value.removeprefix(b'protected:')[::-1]

            store = PlatformCredentialStore(target, protect=protect, unprotect=unprotect)
            store.save('youtube', {'api_key': 'youtube-private-key'})
            store.save('twitch', {'nickname': 'carlos', 'token': 'oauth:twitch-private-token'})
            store.save('kick', {'client_id': 'kick-client', 'client_secret': 'kick-private-secret',
                                'webhook_secret': 'webhook-private-secret'})
            self.assertNotIn(b'youtube-private-key', target.read_bytes())
            self.assertNotIn(b'twitch-private-token', target.read_bytes())
            self.assertNotIn(b'kick-private-secret', target.read_bytes())
            reopened = PlatformCredentialStore(target, protect=protect, unprotect=unprotect)
            self.assertEqual(reopened.get('youtube')['api_key'], 'youtube-private-key')
            self.assertEqual(reopened.get('twitch')['nickname'], 'carlos')
            public = str(reopened.snapshot())
            self.assertNotIn('private-key', public)
            self.assertNotIn('private-token', public)
            reopened.delete('youtube')
            self.assertFalse(reopened.public_status('youtube')['configured'])

    def test_installed_paths_are_independent_of_program_directory(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {}, clear=True):
            root = Path(folder) / 'program'
            root.mkdir()
            (root / 'distribution.json').write_text('{}')
            with patch.dict(os.environ, {'LOCALAPPDATA': str(Path(folder) / 'user')}):
                self.assertEqual(data_dir(root), Path(folder) / 'user' / 'TikReader')
                self.assertTrue(voice_models_dir(root).is_relative_to(data_dir(root)))
                self.assertTrue(kokoro_assets(root).is_relative_to(data_dir(root)))

    def test_installed_caption_model_falls_back_to_bundled_copy(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'program'
            bundled = root / 'assets' / 'speech' / 'vosk-model-small-es-0.42'
            (bundled / 'am').mkdir(parents=True)
            (bundled / 'am' / 'final.mdl').touch()
            (root / 'distribution.json').write_text('{}')
            with patch.dict(os.environ, {'LOCALAPPDATA': str(Path(folder) / 'user')}):
                self.assertEqual(microphone_speech_model(root), bundled)

    def test_migration_copies_history_media_and_models_without_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            source, target = Path(folder) / 'old', Path(folder) / 'new'
            (source / 'app').mkdir(parents=True)
            (source / 'app' / 'server.py').touch()
            store = HistoryStore(source / 'data' / 'history.sqlite3')
            store.set_setting('browser_preferences', {'tikreader.skin': 'light'})
            voice = source / 'assets' / 'voice_models' / 'sample' / 'sample.pth'
            voice.parent.mkdir(parents=True)
            voice.write_bytes(b'personal voice')
            self.assertTrue(migrate(source, target)['ok'])
            self.assertEqual((target / 'voice_models' / 'sample' / 'sample.pth').read_bytes(), voice.read_bytes())
            self.assertEqual(HistoryStore(target / 'history.sqlite3').settings()['browser_preferences'], {'tikreader.skin': 'light'})
            with self.assertRaisesRegex(ValueError, 'No se sobrescribió'):
                migrate(source, target)

    def test_preferences_and_diagnostics_keep_private_data_separate(self):
        import server
        with tempfile.TemporaryDirectory() as folder, patch.object(server, 'archive', HistoryStore(Path(folder) / 'history.sqlite3')):
            client = server.app.test_client()
            self.assertIn('tikreader.commentFontSize', client.get('/system/preferences').json['keys'])
            self.assertEqual(client.post('/system/preferences', json={'tikreader.commentFontSize': '18'}).status_code, 200)
            self.assertEqual(client.get('/system/preferences').json['values']['tikreader.commentFontSize'], '18')
            self.assertEqual(client.post('/system/preferences', json={'tikreader.skin': 'light'}).status_code, 200)
            self.assertEqual(client.get('/system/preferences').json['values']['tikreader.skin'], 'light')
            self.assertEqual(client.post('/system/preferences', json={'secret': 'never-share'}).status_code, 400)
            self.assertEqual(client.post('/system/preferences', json={}, headers={'Origin': 'https://untrusted.example'}).status_code, 403)
            server.archive.set_setting('private-key', 'never-share')
            with patch.dict(server.state, {'username': 'private-user'}):
                report = client.get('/diagnostics/export').get_data(as_text=True)
            for private in ('never-share', 'private-user', folder, 'browser_preferences'):
                self.assertNotIn(private, report)
            self.assertEqual(client.get('/diagnostics/export', environ_base={'REMOTE_ADDR': '10.0.0.2'}).status_code, 403)
            self.assertEqual(client.post('/system/exit', json={}).status_code, 400)

    def test_platform_credentials_routes_store_secrets_outside_history(self):
        import server
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'credentials.bin'
            def reverse(value):
                return value[::-1]

            store = PlatformCredentialStore(target, protect=reverse, unprotect=reverse)
            with patch.object(server, 'platform_credentials', store):
                client = server.app.test_client()
                response = client.post('/system/platform-credentials', json={
                    'platform': 'youtube', 'credentials': {'api_key': 'A' * 30}})
                self.assertEqual(response.status_code, 200)
                self.assertNotIn('A' * 30, response.get_data(as_text=True))
                response = client.post('/system/platform-credentials', json={
                    'platform': 'twitch', 'credentials': {'nickname': 'Carlos', 'token': 'oauth:' + 'b' * 24}})
                self.assertEqual(response.status_code, 200)
                response = client.post('/system/platform-credentials', json={
                    'platform': 'kick', 'credentials': {'client_id': 'kick-client-123', 'client_secret': 's' * 24}})
                self.assertEqual(response.status_code, 200)
                status = client.get('/system/platform-credentials').json
                self.assertEqual([item['configured'] for item in status['platforms']], [True, True, True])
                self.assertNotIn('oauth:', str(status))
                self.assertNotIn('s' * 24, str(status))
                self.assertEqual(store.get('twitch')['nickname'], 'carlos')
                export = client.get('/diagnostics/export').get_data(as_text=True)
                self.assertNotIn(store.get('kick')['client_secret'], export)
                self.assertNotIn(store.get('kick')['webhook_secret'], export)
                response = client.delete('/system/platform-credentials', json={'platform': 'youtube'})
                self.assertEqual(response.status_code, 200)
                self.assertFalse(store.public_status('youtube')['configured'])

    def test_platform_credential_routes_are_local_only(self):
        import server
        client = server.app.test_client()
        remote = {'REMOTE_ADDR': '10.0.0.2'}
        self.assertEqual(client.get('/system/platform-credentials', environ_base=remote).status_code, 403)
        self.assertEqual(client.post('/system/platform-credentials', json={
            'platform': 'kick', 'credentials': {'client_id': 'kick-client-123', 'client_secret': 's' * 24}},
            environ_base=remote).status_code, 403)
        self.assertEqual(client.delete('/system/platform-credentials', json={'platform': 'kick'},
                                       environ_base=remote).status_code, 403)

    def test_voice_download_requires_explicit_request(self):
        import server
        client = server.app.test_client()
        with patch.object(server.voice_downloads, 'install') as install:
            self.assertEqual(client.get('/system/voices').status_code, 200)
            self.assertEqual(client.post('/system/voices/install', json={}).status_code, 400)
            install.assert_not_called()
