import io
import json
import socket
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from flask import Flask
from history_store import HistoryStore
from interactivity import Interactivity
from live_counters import LiveCounters
from minecraft_connector import MinecraftConnector
from points_system import PointsSystem
from production import Production
from spotify_integration import Spotify


def runtime():
    return SimpleNamespace(archive=None, feed_session='A', feed_lock=threading.RLock(),
                           comment_history=[], production=SimpleNamespace(
                               settings=dict(emergency=False, scene='talk'), local=lambda: True))


class CompletionTests(unittest.TestCase):
    def setUp(self):
        self.r = runtime()
        self.app = Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates'))
        self.background = patch('threading.Thread.start')
        self.background.start()
        self.addCleanup(self.background.stop)

    def test_overlays_restore_and_finish_without_browser(self):
        i = Interactivity(self.app, self.r)
        self.r.archive = SimpleNamespace(settings=lambda: {'interactive_overlay_games':{'wheel':{'title':'Guardada'}}})
        i.restore_overlays()
        self.assertEqual(i.overlay_games['wheel']['title'], 'Guardada')
        i.overlay_action('wheel', 'spin')
        with patch('interactivity.time.time', return_value=time.time()+20):i.finish_wheel()
        i.overlay_action('wheel', 'spin')
        self.assertTrue(i.overlay_games['wheel']['spinning'])

    def test_emergency_hides_and_blocks_minigames(self):
        i = Interactivity(self.app, self.r)
        self.r.production.settings['emergency'] = True
        client = self.app.test_client()
        self.assertEqual(client.get('/broadcast/overlay-games').get_json(), {'muted':True})
        self.assertEqual(client.post('/interactivity/overlays',json={'game':'drop','action':'launch'}).status_code,400)
        self.assertEqual(i.overlay_games['drop']['score'],0)

    def test_gift_rules_trigger_games_once(self):
        i = Interactivity(self.app, self.r)
        i.rules = [i.validate(dict(event='gift', action='drop', enabled=True))]
        i.event('gift',{'user':'test'},'event');i.event('gift',{'user':'test'},'event')
        self.assertEqual(i.overlay_games['drop']['score'],1)

    def test_totals_outlive_feed_and_reset_with_session(self):
        counters = LiveCounters(self.app,self.r)
        for n in range(200):counters.event('gift',n,{'gift':'Rosa'},2,2)
        counters.event('gift',199,{'gift':'Rosa'},2,2)
        for kind in ('share','follow','subscribe'):counters.event(kind,kind)
        totals,gifts = counters.snapshot()
        self.assertEqual(gifts['rosa'],400)
        self.assertEqual(totals,dict(coins=400,shares=1,follows=1,subscribers=1))
        self.r.feed_session='B'
        self.assertEqual(counters.snapshot()[1],{})

    def test_goals_persist_and_validate(self):
        with tempfile.TemporaryDirectory() as folder:
            self.r.archive=HistoryStore(Path(folder)/'test.db')
            self.r.WIDGET_PANELS={'goal-custom-1'}
            counters=LiveCounters(self.app,self.r);client=self.app.test_client()
            self.assertEqual(client.post('/overlay-goals/goal-custom-1',json={'goal':50,'value':12}).status_code,200)
            counters.goals={};counters.restore()
            self.assertEqual(counters.goals['goal-custom-1']['value'],12)
            self.assertEqual(client.post('/overlay-goals/goal-custom-1',json={'value':'bad'}).status_code,400)

    def test_question_reopen_updates_history_and_prepared(self):
        with tempfile.TemporaryDirectory() as folder:
            self.r.archive=HistoryStore(Path(folder)/'test.db');self.r.archive.start('A','test')
            p=Production(self.app,self.r)
            for n in range(2):
                record=dict(id=str(n),user='test',comment='Pregunta?')
                self.r.comment_history.append(record);self.r.archive.save('A','comment',record);p.comment(record)
            p.remote_queue=[dict(self.r.comment_history[0])]
            for answered in (True,False):
                p.answer_question('Pregunta?',answered)
                self.assertEqual(p.remote_queue[0]['answered'],answered)
                self.assertTrue(all(x['answered']==answered for x in self.r.archive.records('A') if x['kind']=='comment'))

    def test_subscriber_bonus_does_not_survive_unconfirmed_session(self):
        with tempfile.TemporaryDirectory() as folder:
            self.r.archive=HistoryStore(Path(folder)/'test.db');p=PointsSystem(self.app,self.r)
            p.config.update(enabled=True,comment=1,subscriber_multiplier=3,subscribe=0)
            p.event('subscribe',{'user':'test'},'s');p.event('comment',{'user':'test'},'c1')
            self.r.feed_session='B';p.event('comment',{'user':'test'},'c2')
            self.assertEqual(p.snapshot()[0]['points'],4)
            self.assertFalse(p.snapshot()[0]['subscriber'])

    def test_minecraft_cancels_stale_session_scene_and_revision(self):
        m=MinecraftConnector(self.app,self.r);m.authorized=True;m.config['commands']={'test':'list'}
        m.enqueue('test');job=m.jobs.get_nowait()
        with patch.object(m,'execute') as execute:
            self.r.feed_session='B';m.run_job(job)
            self.r.feed_session='A';self.r.production.settings['scene']='pause';m.run_job(job)
            self.r.production.settings['scene']='talk';m.revision+=1;m.run_job(job)
            execute.assert_not_called()

    def test_minecraft_fragmented_tcp_roundtrip(self):
        self.background.stop()
        m=MinecraftConnector(self.app,self.r)
        errors=[];commands=[]
        with socket.socket() as listener:
            listener.bind(('127.0.0.1',0));listener.listen();listener.settimeout(3)
            m.config['port']=listener.getsockname()[1];m.password='test-only'
            def serve():
                try:
                    with listener.accept()[0] as peer:
                        peer.settimeout(3)
                        rid,kind,password=m.receive(peer)
                        self.assertEqual((kind,password),(3,'test-only'))
                        reply=m.packet(rid,2,'')
                        for byte in reply:peer.sendall(bytes([byte]))
                        rid,kind,command=m.receive(peer);commands.append(command)
                        peer.sendall(m.packet(rid,0,'There are 0 players online'))
                except Exception as exc:errors.append(exc)
            worker=threading.Thread(target=serve);worker.start()
            result=m.execute('list');worker.join(4)
            self.assertFalse(worker.is_alive());self.assertFalse(errors)
            self.assertEqual(commands,['list']);self.assertIn('0 players',result)

    def test_spotify_port_refresh_and_device_check(self):
        self.r.runtime_config_value=SimpleNamespace(port=5055)
        s=Spotify(self.app,self.r)
        self.assertEqual(s.redirect_uri,'http://127.0.0.1:5055/spotify/callback')
        s.tokens=dict(access_token='old',refresh_token='refresh',expires_at=0)
        class Response(io.BytesIO):
            status=200
        responses=[Response(json.dumps(dict(access_token='new',expires_in=3600)).encode()),
                   Response(json.dumps(dict(device={'is_active':True},is_playing=True)).encode())]
        with patch.object(s.opener,'open',side_effect=responses) as request:
            response=self.app.test_client().post('/spotify/check',json={})
            self.assertTrue(response.get_json()['ok'])
            self.assertEqual(request.call_args_list[1].args[0].get_method(),'GET')
            self.assertEqual(s.tokens['refresh_token'],'refresh')

    def test_spotify_callback_cookie_success_and_timeout_preserves_request(self):
        s=Spotify(self.app,self.r);c=self.app.test_client()
        c.post('/spotify/authorize',json={'client_id':'a'*32});state=s.pending['state']
        with patch.object(s,'token_request'):
            self.assertEqual(c.get('/spotify/callback',query_string={'state':state,'code':'code'}).status_code,200)
        s.comment({'user':'test','comment':'!song spotify:track:'+'a'*22})
        with patch.object(s,'player',side_effect=TimeoutError):
            self.assertEqual(c.post('/spotify/request',json={'action':'approve','id':s.requests[0]['id']}).status_code,502)
        self.assertEqual(len(s.requests),1)
        self.r.feed_session='B'
        self.assertEqual(c.get('/spotify/state').get_json()['requests'],[])
