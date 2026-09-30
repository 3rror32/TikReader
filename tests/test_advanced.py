import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import server
from history_store import HistoryStore


class AdvancedTests(unittest.TestCase):
    def test_restore_validates_merges_and_protects_current(self):
        import io
        with tempfile.TemporaryDirectory() as directory:
            store=HistoryStore(Path(directory)/'active.sqlite3')
            source=HistoryStore(Path(directory)/'source.sqlite3')
            source.start('old','test');source.start(server.feed_session,'test')
            source.save('old','comment',{'id':'one','user':'test','comment':'restored'})
            source.save(server.feed_session,'comment',{'id':'protected','comment':'skip'})
            path=Path(directory)/'backup.sqlite3';source.backup(path)
            client=server.app.test_client()
            with patch.object(server,'archive',store):
                def upload(confirm=''):
                    return client.post('/history/restore',data={'backup':(io.BytesIO(path.read_bytes()),'backup.sqlite3'),'confirmation':confirm})
                self.assertTrue(upload().get_json()['preview']);self.assertEqual(store.sessions(),[])
                self.assertEqual(upload('RESTAURAR').get_json()['imported'],2)
                self.assertEqual(upload('RESTAURAR').get_json()['imported'],0)
                self.assertEqual(store.records(server.feed_session),[])
                self.assertEqual(client.post('/history/restore',data={'backup':(io.BytesIO(b'invalid'),'bad.db')}).status_code,400)

    def test_retention_confirmation_age_and_privacy(self):
        with tempfile.TemporaryDirectory() as directory:
            store=HistoryStore(Path(directory)/'test.sqlite3')
            store.start('old','secret-user');store.start('new','test');store.start(server.feed_session,'test')
            with store.connect() as db:
                db.execute("UPDATE sessions SET started='2000-01-01' WHERE id != 'new'")
            client=server.app.test_client()
            with patch.object(server,'archive',store):
                self.assertEqual(client.get('/history/retention?days=90').get_json()['sessions'],1)
                self.assertEqual(client.post('/history/retention',json={'days':90}).status_code,400)
                self.assertEqual(client.post('/history/retention',json={'days':90,'confirmation':'LIMPIAR 90'}).get_json()['sessions'],1)
                self.assertEqual(len(store.sessions()),2)
                response=client.get('/diagnostics/export')
                self.assertNotIn('secret-user',response.text)
                self.assertNotIn('session',response.get_json()['stats'])
                self.assertEqual(client.get('/diagnostics/export',environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)

    def test_history_search_is_literalliteral_and_backup_survives_deletion(self):
        with tempfile.TemporaryDirectory() as directory:
            store=HistoryStore(Path(directory)/'test.sqlite3');store.start('old','test')
            store.save('old','comment',{'id':'one','user':'@Alice','comment':'Oferta 100% real'})
            self.assertEqual(len(store.search('%','alice')),1)
            self.assertEqual(store.search("' OR 1=1 --"),[])
            backup=Path(directory)/'backup.sqlite3';store.backup(backup)
            self.assertEqual(store.delete_session('old'),1)
            self.assertEqual(store.records('old'),[])
            self.assertEqual(len(HistoryStore(backup).records('old')),1)

    def test_delete_requires_confirmation_and_protects_current_session(self):
        with tempfile.TemporaryDirectory() as directory:
            store=HistoryStore(Path(directory)/'test.sqlite3');store.start('old','test')
            store.save('old','comment',{'id':'one','comment':'test','user':'@test'})
            client=server.app.test_client()
            with patch.object(server,'archive',store):
                self.assertEqual(client.delete('/history/old',json={}).status_code,400)
                self.assertEqual(client.delete('/history/'+server.feed_session,json={'confirmation':'ELIMINAR '+server.feed_session}).status_code,409)
                r=client.delete('/history/old',json={'confirmation':'ELIMINAR old'})
                self.assertEqual(r.status_code,200);self.assertEqual(r.get_json()['deleted'],1)
                self.assertEqual(len(list((Path(directory)/'backups').glob('*.sqlite3'))),1)

    def test_prepared_questions_can_be_answered_reopened_discarded(self):
        p=server.production;p.reset_session();client=server.app.test_client()
        with patch.object(p,'remote_queue',[{'id':'x','comment':'test'}]):
            for action,expected in [('answered',True),('reopen',False)]:
                r=client.post('/production/prepared',json={'id':'x','action':action})
                self.assertEqual(r.get_json()['prepared'][0]['answered'],expected)
            self.assertEqual(client.post('/production/prepared',json={'id':'x','action':'discard'}).get_json()['prepared'],[])
            self.assertEqual(client.post('/production/prepared',json={'id':'x','action':'discard'},environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)

    def test_like_units_are_distinct_from_room_total(self):
        from types import SimpleNamespace as S
        with patch.object(server,'state',dict(server.state,like_count=0,session_like_units=0,
                                             like_events=0,room_like_baseline=None)),patch.object(server.socketio,'emit'):
            server.update_room_stats({'like_count':100,'user_count':2})
            server.handle_like_event(S(count=3,total=103))
            stats=server.stats_payload()
            self.assertEqual(stats['likes'],3)
            self.assertEqual(stats['session_like_units'],3)
            self.assertEqual(stats['room_like_count'],100)


if __name__=='__main__': unittest.main()
