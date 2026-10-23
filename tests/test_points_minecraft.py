import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask

from history_store import HistoryStore
from minecraft_connector import MinecraftConnector
from points_system import PointsSystem


class Production:
    settings = {'emergency': False}
    @staticmethod
    def local(): return True


class PointsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.archive = HistoryStore(Path(self.temp.name) / 'history.sqlite3')
        self.runtime = SimpleNamespace(archive=self.archive, production=Production())
        self.app = Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates'))
        self.points = PointsSystem(self.app, self.runtime)
        self.points.config.update(enabled=True, comment=2, subscribe=50, subscriber_multiplier=3)

    def tearDown(self): self.temp.cleanup()

    def test_deduplicates_and_applies_subscriber_bonus(self):
        self.points.event('comment', {'user': '@Alice'}, 'comment:1')
        self.points.event('comment', {'user': '@Alice'}, 'comment:1')
        self.points.event('subscribe', {'user': 'Alice'}, 'subscribe:1')
        self.points.event('comment', {'user': 'Alice'}, 'comment:2')
        row = self.points.snapshot('Alice')[0]
        self.assertEqual(row['points'], 58)
        self.assertTrue(row['subscriber'])

    def test_level_and_manual_adjustment(self):
        self.points.config['points_per_level'] = 10
        client = self.app.test_client()
        self.assertEqual(client.post('/points/adjust', json={'user':'Bob','amount':25}).status_code, 200)
        self.assertEqual(self.points.snapshot('Bob')[0]['level'], 3)


class MinecraftTests(unittest.TestCase):
    def setUp(self):
        self.runtime = SimpleNamespace(archive=None, production=Production())
        self.app = Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates'))
        self.connector = MinecraftConnector(self.app, self.runtime)

    def test_rejects_public_address(self):
        with self.assertRaises(ValueError):
            self.connector.validate({'host':'8.8.8.8','port':25575,'commands':{}})

    def test_only_queues_authorized_alias_and_substitutes_values(self):
        self.connector.config = {'host':'127.0.0.1','port':25575,'commands':{'hello':'say Hola {user}'}}
        self.assertFalse(self.connector.enqueue('hello', {'user':'Ana'}))
        self.connector.authorized = True
        with patch.object(self.connector.jobs, 'put_nowait') as put:
            self.assertTrue(self.connector.enqueue('hello', {'user':'Ana'}))
            self.assertEqual(put.call_args.args[0][1], 'say Hola Ana')
        self.assertFalse(self.connector.enqueue('op', {}))

    def run_response(self, response='', command='list', error=None):
        self.connector.authorized = True
        job = ('probe', command, time.monotonic(), None, self.connector.revision)
        with patch.object(self.connector, 'execute', return_value=response, side_effect=error):
            self.connector.run_job(job)
        return self.connector.log[0]

    def test_command_outcomes_preserve_response_and_do_not_assume_success(self):
        cases = [
            ('list', 'There are 0 of a max of 20 players online:', 'success'),
            ('summon zombie', 'Summoned new Zombie', 'success'),
            ('give Alex diamond', 'Gave 1 [Diamond] to Alex', 'success'),
            ('weather clear', 'Set the weather to clear', 'success'),
            ('oops', 'Unknown or incomplete command, see below for error', 'rejected'),
            ('give Nobody diamond', 'No player was found', 'rejected'),
            ('list', '', 'unconfirmed'),
            ('list', 'Hay 0 jugadores conectados', 'unconfirmed'),
            ('custom', 'Operation completed', 'unconfirmed'),
            ('custom', 'Expected reward delivered', 'unconfirmed'),
            ('custom', 'Invalid items were removed successfully', 'unconfirmed'),
            ('say Unknown command', '[Server] Unknown command', 'unconfirmed'),
            ('custom', 'Summoned new Zombie', 'unconfirmed'),
            ('list', 'There are 0 of a max of 20 players online:\nUnknown command', 'unconfirmed'),
        ]
        for command, response, outcome in cases:
            with self.subTest(command=command, response=response):
                row = self.run_response(response, command)
                self.assertEqual(row['outcome'], outcome)
                self.assertEqual(row['response'], response)
                self.assertEqual(row['alias'], 'probe')
                self.assertIn('at', row)
                self.assertIn(response or 'sin respuesta', row['text'])

    def test_transport_failure_is_distinct_from_rejection(self):
        for error in (OSError('offline'), PermissionError('bad password')):
            with self.subTest(error=error), self.assertLogs('minecraft_connector', level='ERROR'):
                row = self.run_response(error=error)
            self.assertEqual(row['outcome'], 'connection_error')
            self.assertEqual(row['response'], '')
            self.assertIn(type(error).__name__, row['text'])

    def test_cancelled_job_never_executes_and_has_outcome(self):
        self.connector.authorized = True
        job = ('probe', 'list', time.monotonic()-11, None, self.connector.revision)
        with patch.object(self.connector, 'execute') as execute:
            self.connector.run_job(job)
        execute.assert_not_called()
        self.assertEqual(self.connector.log[0]['outcome'], 'cancelled')

    def test_session_revision_scene_and_emergency_still_cancel_jobs(self):
        self.connector.authorized = True
        self.runtime.production = SimpleNamespace(settings={'emergency': False, 'scene': 'talk'})
        for session, revision, emergency, scene in [
                ('old-session', self.connector.revision, False, 'talk'),
                (None, self.connector.revision-1, False, 'talk'),
                (None, self.connector.revision, True, 'talk'),
                (None, self.connector.revision, False, 'pause')]:
            with self.subTest(scene=scene, emergency=emergency, session=session, revision=revision):
                self.runtime.production.settings.update(emergency=emergency, scene=scene)
                with patch.object(self.connector, 'execute') as execute:
                    self.connector.run_job(('probe', 'list', time.monotonic(), session, revision))
                execute.assert_not_called()
                self.assertEqual(self.connector.log[0]['outcome'], 'cancelled')

    def test_structured_history_is_bounded_and_available_to_polling(self):
        self.run_response('Unknown command', 'oops')
        result = self.app.test_client().get('/minecraft').get_json()
        self.assertEqual(result['log'][0]['outcome'], 'rejected')
        self.assertNotIn('password', result)
        for _ in range(55):
            self.connector.note('status')
        self.assertEqual(len(self.connector.log), 50)


if __name__ == '__main__': unittest.main()
