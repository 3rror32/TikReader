import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from flask import Flask
import bank_storage
from chatbot import Chatbot
from history_store import HistoryStore
from obs_direct import OBSDirect, authentication

class BankPersistenceTests(unittest.TestCase):
    def test_contents_survive_restart_and_clear_preserves_shapes(self):
        with tempfile.TemporaryDirectory() as folder:
            runtime=SimpleNamespace(archive=HistoryStore(Path(folder)/'history.sqlite3'))
            state={};bank_storage.restore(runtime,state)
            shape={'points':[[10,10],[50,10],[90,10],[90,90],[50,90],[10,90]],'slot':[50,10]}
            state.update(score=333,contents=[{'id':7,'gift':'Rose','gift_id':'5655','image_url':'https://example.com/rose.png'}],shapes={'oso':bank_storage.validate_shape(shape)})
            bank_storage.persist(runtime,state)
            restored={};bank_storage.restore(runtime,restored)
            self.assertEqual(state,restored)
            restored.update(score=0,contents=[],epoch='reset');bank_storage.persist(runtime,restored)
            after={};bank_storage.restore(runtime,after)
            self.assertEqual(after['contents'],[]);self.assertEqual(after['score'],0);self.assertEqual(after['shapes'],state['shapes'])

    def test_crossed_contours_and_nonfinite_points_rejected(self):
        for points in ([[10,10],[90,90],[90,10],[10,90],[5,50],[10,20]],[[float('nan'),10]]*6):
            with self.assertRaises(ValueError):bank_storage.validate_shape({'points':points,'slot':[50,10]})

class OBSTests(unittest.TestCase):
    def setUp(self):
        self.runtime=SimpleNamespace(production=SimpleNamespace(settings={'emergency':False,'scene':'talk'}),feed_session='one')
        with patch('threading.Thread.start'):self.obs=OBSDirect(Flask(__name__),self.runtime)

    def test_handshake_uses_challenge_and_request_response(self):
        ws=MagicMock();ws.__enter__.return_value=ws
        ws.recv.side_effect=[json.dumps({'op':0,'d':{'authentication':{'salt':'salt','challenge':'challenge'}}}),json.dumps({'op':2,'d':{}}),json.dumps({'op':7,'d':{'requestId':'request','requestStatus':{'result':True},'responseData':{'scenes':[]}}})]
        self.obs.password='private'
        with patch('obs_direct.connect',return_value=ws),patch('obs_direct.uuid4',return_value=SimpleNamespace(hex='request')):
            self.assertEqual(self.obs.call('GetSceneList'),{'scenes':[]})
        sent=[json.loads(call.args[0]) for call in ws.send.call_args_list]
        self.assertEqual(sent[0]['d']['authentication'],authentication('private','salt','challenge'))
        self.assertNotIn('private',json.dumps(sent));self.assertEqual(sent[1]['d']['requestType'],'GetSceneList')

    def test_source_lookup_and_emergency(self):
        self.obs.enabled=True
        with patch.object(self.obs,'call',side_effect=[{'sceneItemId':17},{}]) as call:
            self.obs.execute('obs_show','Juego|Alcancía')
            self.assertEqual(call.call_args.args,('SetSceneItemEnabled',{'sceneName':'Juego','sceneItemId':17,'sceneItemEnabled':True}))
        self.runtime.production.settings['emergency']=True
        with patch.object(self.obs,'call') as call:
            with self.assertRaises(ValueError):self.obs.execute('obs_scene','Juego')
            call.assert_not_called()

class ChatbotTests(unittest.TestCase):
    def setUp(self):
        self.runtime=SimpleNamespace(archive=None,feed_session='live',state={'connected':True},production=SimpleNamespace(settings={'emergency':False,'scene':'talk'}))
        self.app=Flask(__name__)
        with patch('threading.Thread.start'):self.bot=Chatbot(self.app,self.runtime)
        self.bot.configure({'commands':[{'command':'!hola','reply':'Hola {usuario}','cooldown':30}]})
        self.bot.enabled=True;self.bot.api_key='secret-api';self.bot.oauth_token='secret-oauth'

    def test_reply_deduplicates_and_respects_pause_cooldown_and_echo(self):
        with patch.object(self.bot,'enqueue') as enqueue:
            self.bot.comment({'id':'1','comment':'!hola','user':'@Carlos'})
            enqueue.assert_called_once_with('Hola Carlos')
            self.bot.comment({'id':'1','comment':'!hola','user':'@Carlos'})
            self.bot.comment({'id':'2','comment':'!hola','user':'@Ana'})
            self.runtime.production.settings['emergency']=True
            self.bot.last.clear();self.bot.comment({'id':'3','comment':'!hola','user':'@Ana'})
            self.assertEqual(enqueue.call_count,1)

    def test_preview_does_not_send_and_credentials_never_return(self):
        with patch.object(self.bot,'enqueue') as enqueue,patch.object(self.bot,'send') as send:
            result=self.app.test_client().post('/chatbot/preview',json={'text':'!hola','user':'Ana'}).get_json()
            self.assertEqual(result,{'reply':'Hola Ana','published':False});enqueue.assert_not_called();send.assert_not_called()
        data=self.app.test_client().get('/chatbot').get_data(as_text=True)
        self.assertNotIn('secret-api',data);self.assertNotIn('secret-oauth',data)

if __name__=='__main__':unittest.main()
