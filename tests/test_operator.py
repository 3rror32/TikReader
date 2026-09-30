import tempfile
import unittest
import zipfile
import json
from pathlib import Path
from unittest.mock import patch
import server
from history_store import HistoryStore
import maintenance

class OperatorTests(unittest.TestCase):
    def setUp(self):
        self.c=server.app.test_client();self.i=server.interactive
        self.rules=patch.object(self.i,'rules',[]);self.rules.start()
    def tearDown(self):self.rules.stop()
    def rule(self,**kw):return self.i.validate(dict(name='test',event='comment',action='animation',value='private',enabled=True,**kw))
    def test_preview_does_not_publish(self):
        r=self.rule();self.i.rules=[r];before=self.i.serial
        d=self.c.post('/operator/preview',json={'id':r['id']}).get_json()
        self.assertTrue(d['private']);self.assertEqual(self.i.serial,before)
    def test_manual_requires_confirmation_enabled_and_emission(self):
        r=self.rule();self.i.rules=[r]
        self.assertEqual(self.c.post('/operator/trigger',json={'id':r['id']}).status_code,400)
        with patch.dict(server.production.settings,emergency=True):
            self.assertEqual(self.c.post('/operator/trigger',json={'id':r['id'],'confirmation':'EJECUTAR'}).status_code,409)
    def test_conflicts(self):
        self.i.rules=[self.rule(),self.rule(match='hello')]
        self.assertEqual(len(self.c.get('/operator/audit').get_json()['possible_conflicts']),1)
    def test_profile_fail_atomic_and_success_safe(self):
        r=self.rule();self.i.rules=[r]
        self.assertEqual(self.c.post('/operator/profile',json={'rules':[{'event':'bad'}]}).status_code,400)
        self.assertEqual(self.i.rules,[r])
        with patch.object(server.production,'settings',dict(server.production.settings)):
            result=self.c.post('/operator/profile',json={'rules':[r],'production':{'hide_names':True}})
            self.assertEqual(result.status_code,200);self.assertFalse(self.i.rules[0]['enabled']);self.assertTrue(server.production.settings['emergency'])
    def test_summary_private(self):
        with tempfile.TemporaryDirectory() as folder:
            store=HistoryStore(Path(folder)/'test.db');store.start('s','secret')
            store.save('s','comment',dict(id='a',user='secret',comment='private?'))
            with patch.object(server,'archive',store):
                response=self.c.get('/operator/summary/s');self.assertEqual(response.get_json()['unanswered_questions'],1)
                self.assertNotIn('secret',response.text);self.assertNotIn('private',response.text)
    def test_remote_denied(self):
        self.assertEqual(self.c.get('/operator/audit',environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)

class MaintenanceTests(unittest.TestCase):
    def test_package_roundtrip_and_paths(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'app').mkdir();(root/'app'/'server.py').write_text('original');(root/'data').mkdir();(root/'data'/'secret').write_text('secret')
            package=maintenance.snapshot(root);files=maintenance.read_package(package)
            self.assertEqual(files['app/server.py'],b'original');self.assertNotIn('data/secret',files)
            self.assertFalse(maintenance.allowed('../server.py'));self.assertFalse(maintenance.allowed('data/history.sqlite3'))
    def test_tampered_hash_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'bad.zip'
            with zipfile.ZipFile(p,'w') as z:
                z.writestr('manifest.json',json.dumps({'version':1,'files':{'server.py':'bad'}}));z.writestr('server.py','changed')
            with self.assertRaises(ValueError):maintenance.read_package(p)

    def test_apply_and_restore_code_without_touching_data(self):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as package_folder:
            root=Path(folder);(root/'app').mkdir();source=Path(package_folder);(source/'app').mkdir()
            (root/'app'/'server.py').write_text('old');(root/'data').mkdir();(root/'data'/'private').write_text('keep')
            (source/'app'/'server.py').write_text('new');package=maintenance.snapshot(source)
            with patch('maintenance.socket.socket') as sock:
                sock.return_value.__enter__.return_value.connect_ex.return_value=1
                previous=maintenance.apply(package,root)
                self.assertEqual((root/'app'/'server.py').read_text(),'new')
                maintenance.apply(previous,root)
            self.assertEqual((root/'app'/'server.py').read_text(),'old')
            self.assertEqual((root/'data'/'private').read_text(),'keep')
