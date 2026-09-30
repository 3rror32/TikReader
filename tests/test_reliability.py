import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
import time
import server
from history_store import HistoryStore
from runtime_guard import InstanceGuard

class ReliabilityTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.archive=HistoryStore(Path(self.temp.name)/'history.sqlite3')
        self.p=patch.object(server,'archive',self.archive);self.p.start();self.addCleanup(self.p.stop)
        self.i=server.interactive;self.r=server.reliability;self.client=server.app.test_client()
        self.old=copy.deepcopy(self.r.snapshot());self.old_undo=self.r.undo;self.old_draft=self.r.draft
        self.r.undo=[];self.r.draft=None;self.i.rules=[];self.i.global_times.clear();self.i.trace.clear();self.i.global_limit=120
        self.muted=patch.dict(server.production.settings,emergency=False,scene='talk');self.muted.start();self.addCleanup(self.muted.stop)
        self.addCleanup(self.restore)
    def restore(self):
        self.i.rules=self.old['rules'];self.i.global_limit=self.old['global_limit'];self.i.external_ttl=self.old['external_ttl'];self.i.global_times.clear();self.r.undo=self.old_undo;self.r.draft=self.old_draft
    def get(self):return self.client.get('/reliability/config').get_json()
    def post(self,**data):return self.client.post('/reliability/config',json=data)
    def test_draft_publish_undo_and_persistence(self):
        before=self.get();c=copy.deepcopy(before['config']);c['global_limit']=7;c['voice']={'blocked-words':'spam'}
        self.assertEqual(self.post(action='save',base=before['revision'],config=c).status_code,200)
        self.assertEqual(self.i.global_limit,120)
        self.assertEqual(self.post(action='publish',confirmation='PUBLICAR').status_code,200)
        self.assertEqual(self.i.global_limit,7);self.assertEqual(self.archive.settings()['draft_voice'],c['voice'])
        self.assertEqual(self.post(action='undo',confirmation='DESHACER').status_code,200)
        self.assertEqual(self.i.global_limit,120)
    def test_conflict_prevents_overwriting_changes(self):
        before=self.get();self.post(action='save',base=before['revision'],config=before['config']);self.i.global_limit=33
        self.assertEqual(self.post(action='publish',confirmation='PUBLICAR').status_code,409);self.assertEqual(self.i.global_limit,33)
    def test_invalid_draft_and_missing_confirmation(self):
        c=self.get()['config'];c['external_ttl']=0
        self.assertEqual(self.post(action='save',config=c).status_code,400)
        self.assertEqual(self.post(action='publish').status_code,400)
    def test_global_budget_covers_manual_and_scheduled_dispatch(self):
        self.i.global_limit=1;step={'action':'timer','amount':1};before=self.i.remaining
        self.i.dispatch(step,'one');self.i.dispatch(step,'two')
        self.assertEqual(self.i.remaining,before+1)
        self.assertIn('límite global',self.i.trace[0]['outcome'])
    def test_rehearsal_is_isolated(self):
        c=self.get()['config'];c['rules']=[self.i.validate(dict(name='test',event='comment',action='timer',amount=99,enabled=True))];c['voice']={'blocked-words':'spam'}
        before=(self.i.remaining,len(self.i.effects),len(self.i.seen),len(self.i.global_times))
        result=self.r.rehearse([{'kind':'comment','user':'test','comment':'spam'},{'kind':'comment','comment':'hola'}],c)
        self.assertFalse(result['results'][0]['voice']);self.assertTrue(result['results'][1]['voice'])
        self.assertEqual(before,(self.i.remaining,len(self.i.effects),len(self.i.seen),len(self.i.global_times)))
    def test_support_excludes_content_and_trace_bounded(self):
        for _ in range(510):self.i.record_trace('private rule','result')
        self.assertEqual(len(self.i.trace),500)
        data=self.client.get('/reliability/support').get_json();self.assertNotIn('private rule',str(data));self.assertNotIn('username',data)
    def test_endpoint_rejects_remote_and_cross_origin(self):
        self.assertEqual(self.client.get('/reliability/support',environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)
        self.assertEqual(self.client.post('/reliability/config',json={},headers={'Origin':'https://evil.example'}).status_code,403)
    def test_instance_lock_rejects_duplicate_and_releases(self):
        path=Path(self.temp.name)/'server.lock';a=InstanceGuard(path,port=0)
        try:
            with self.assertRaises(RuntimeError):InstanceGuard(path,port=0)
        finally:a.close()
        b=InstanceGuard(path,port=0);b.close()
    def test_extended_profile_roundtrip(self):
        d=self.client.get('/operator/profile').get_json();d['extras']['effects_mode']='skip';d['extras']['media_labels']={'example.wav':'Prueba'}
        self.assertEqual(self.client.post('/operator/profile',json=d).status_code,200)
        self.assertEqual(self.client.get('/operator/profile').get_json()['extras']['effects_mode'],'skip')
        self.assertEqual(self.archive.settings()['media_labels'],{'example.wav':'Prueba'})

    def test_expired_external_action_never_opens_connection(self):
        opener=Mock()
        with patch.object(self.i,'external',True):
            self.i.send_external(opener,('action',server.feed_session,time.monotonic()-100,'expired'))
        opener.open.assert_not_called()
        self.assertEqual(self.i.trace[0]['outcome'],'Caducada antes del envío')
    def test_database_failure_does_not_publish_partial_config(self):
        before=self.get();c=copy.deepcopy(before['config']);c['global_limit']=8
        self.post(action='save',base=before['revision'],config=c)
        with patch.object(self.archive,'connect',side_effect=RuntimeError('Disk unavailable')):
            with self.assertRaises(RuntimeError):self.r.commit(c,[],None)
        self.assertEqual(self.i.global_limit,120)
