import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from flask import Flask
from history_store import HistoryStore
from points_system import PointsSystem
from user_info_overlay import UserInfoOverlay


class UserInfoTests(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory();self.addCleanup(tmp.cleanup)
        self.app=Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates'))
        self.r=SimpleNamespace(feed_lock=threading.RLock(),feed_session='a',archive=HistoryStore(Path(tmp.name)/'test.sqlite3'),
            production=SimpleNamespace(settings={'emergency':False,'scene':'talk'},sanitize=lambda d:d))
        self.r.points=PointsSystem(self.app,self.r);self.r.points.config.update(enabled=True,comment=100)
        for i in range(110):self.r.points.event('comment',{'user':'u'+str(i)},str(i))
        self.overlay=UserInfoOverlay(self.app,self.r);self.client=self.app.test_client()

    def test_exact_lookup_outside_first_hundred_and_ties(self):
        result=self.overlay.lookup({'user':'@U109'})
        self.assertEqual((result['points'],result['rank'],result['level']),(100,1,2))
        self.r.points.event('comment',{'user':'winner'},'win',units=2)
        self.assertEqual(self.overlay.lookup({'user':'u109'})['rank'],2)
        self.assertIsNone(self.overlay.lookup({'user':'new'})['rank'])

    def test_command_expiry_session_and_configuration(self):
        self.overlay.command({'user':'u109','comment':' !SCORE '})
        self.assertIsNotNone(self.client.get('/broadcast/user-info').get_json()['info'])
        original=self.overlay.current
        self.overlay.command({'user':'u109','comment':'!score'})
        self.assertEqual(self.overlay.current,original)
        self.overlay.current=(original[0],0)
        self.assertIsNone(self.client.get('/broadcast/user-info').get_json()['info'])
        self.assertEqual(self.client.post('/user-info-overlay',json={'command':'!puntos','duration':8,'canvas_format':'vertical'}).status_code,200)
        self.overlay.restore();self.assertEqual(self.overlay.settings['command'],'!puntos')
        self.assertEqual(self.overlay.settings['canvas_format'],'vertical')
        self.overlay.command({'user':'u1','comment':'!puntos'})
        self.r.feed_session='b'
        self.assertIsNone(self.client.get('/broadcast/user-info').get_json()['info'])
        self.assertEqual(self.client.get('/widget/user-info?preview=1').status_code,200)
        self.assertEqual(self.client.post('/user-info-overlay',json={'command':'bad command'}).status_code,400)
        self.assertEqual(self.client.post('/user-info-overlay',json={'canvas_format':'auto'}).status_code,400)


if __name__=='__main__':unittest.main()
