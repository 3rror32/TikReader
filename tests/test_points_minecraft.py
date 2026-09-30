import tempfile
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
        self.connector = MinecraftConnector(Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates')), self.runtime)

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


if __name__ == '__main__': unittest.main()
