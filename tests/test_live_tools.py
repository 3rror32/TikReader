import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import server
from history_store import HistoryStore

class LiveToolsTests(unittest.TestCase):
    def setUp(self):
        self.client=server.app.test_client();self.t=server.live_tools
        self.rules=patch.object(server.interactive,'rules',[]);self.rules.start();self.t.guided=None
    def tearDown(self):self.rules.stop()
    def test_templates_disabled_and_limited(self):
        r=self.client.post('/live-tools/templates/timer',json={});self.assertEqual(r.status_code,200)
        self.assertFalse(r.get_json()['rule']['enabled']);self.assertEqual(r.get_json()['rule']['amount'],30)
        self.assertEqual(self.client.post('/live-tools/templates/unknown',json={}).status_code,404)
    def test_guided_only_observed_events_and_explicit_audio(self):
        self.client.post('/live-tools/guided',json={'action':'start'})
        self.assertEqual(self.t.guided['manual'],{})
        with patch.dict(server.state,comment_count=server.state['comment_count']+1):
            result=self.client.get('/live-tools/guided').get_json()['test'];self.assertTrue(result['observed']['comments'])
        self.assertEqual(self.client.post('/live-tools/guided',json={'action':'mark','check':'audio','passed':True}).status_code,200)
        self.assertTrue(self.t.guided['manual']['audio']['passed'])
        with patch.object(server,'feed_session','different'):
            self.assertFalse(self.client.get('/live-tools/guided').get_json()['test']['same_session'])
    def test_asset_label_and_protected_delete(self):
        with tempfile.TemporaryDirectory() as folder:
            store=HistoryStore(Path(folder)/'history.db');media=Path(folder)/'media';media.mkdir();name='c'*32+'.mp4';(media/name).write_bytes(b'video')
            with patch.object(server,'archive',store),patch.object(server.interactive,'folder',media):
                self.assertEqual(self.client.post('/live-tools/assets',json={'name':name,'label':'Gracias'}).status_code,200)
                self.assertEqual(self.client.get('/live-tools/assets').get_json()['files'][0]['label'],'Gracias')
                server.interactive.rules=[server.interactive.validate(dict(event='gift',action='video',value=name))]
                self.assertEqual(self.client.delete('/live-tools/assets',json={'name':name,'confirmation':'ELIMINAR'}).status_code,409)
                server.interactive.rules=[]
                self.assertEqual(self.client.delete('/live-tools/assets',json={'name':name}).status_code,400)
                self.assertEqual(self.client.delete('/live-tools/assets',json={'name':name,'confirmation':'ELIMINAR'}).status_code,200)
    def test_effect_mode_validation_and_remote_protection(self):
        self.assertEqual(self.client.post('/live-tools/effects',json={'mode':'bad'}).status_code,400)
        self.assertEqual(self.client.post('/live-tools/effects',json={'mode':'skip'}).get_json()['mode'],'skip')
        self.t.effects_mode='enqueue'
        self.assertEqual(self.client.get('/live-tools/state',environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)
    def test_guided_saved_after_observations(self):
        with tempfile.TemporaryDirectory() as folder:
            store=HistoryStore(Path(folder)/'history.db')
            with patch.object(server,'archive',store):
                self.client.post('/live-tools/guided',json={'action':'start'})
                self.client.post('/live-tools/guided',json={'action':'save'})
                self.assertIn('observed',store.settings()['last_guided_test'])
