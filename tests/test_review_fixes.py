import ast
import copy
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask
import data_recovery
import maintenance
from game_hotkeys import GameHotkeys
from history_store import HistoryStore
from interactivity import Interactivity
from live_counters import LiveCounters
from points_system import PointsSystem
from spotify_integration import Spotify


def runtime():
    return SimpleNamespace(archive=None,feed_session='A',feed_lock=threading.RLock(),
        production=SimpleNamespace(settings={'emergency':False,'scene':'talk'},local=lambda:True))


class ReviewFixes(unittest.TestCase):
    def setUp(self):
        self.app=Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates'));self.r=runtime()
        self.background=patch('threading.Thread.start');self.background.start()
        self.addCleanup(self.background.stop)

    def test_packaged_modules_cover_all_local_imports_and_images(self):
        root=Path(__file__).parent.parent
        for name in maintenance.ROOT_FILES:
            if not name.endswith('.py') or not (root/name).exists():continue
            for node in ast.walk(ast.parse((root/name).read_text(encoding='utf-8-sig'))):
                if isinstance(node,ast.ImportFrom) and node.module and (root/'app'/(node.module+'.py')).exists():
                    self.assertTrue(maintenance.allowed('app/'+node.module+'.py'),node.module)
        self.assertTrue(maintenance.allowed('web/static/piggy-bank-glass.png'))
        self.assertTrue(maintenance.allowed('assets/icons/avatar.webp'))
        self.assertFalse(maintenance.allowed('static/../../data/.flask-secret'))

    def test_custom_port_blocks_code_update(self):
        with tempfile.TemporaryDirectory() as folder,patch.dict('os.environ',TIKREADER_PORT='5987'),patch('maintenance.socket.socket') as sock:
            sock.return_value.__enter__.return_value.connect_ex.return_value=0
            with self.assertRaises(ValueError):maintenance.apply(Path('unused'),Path(folder))
            sock.return_value.__enter__.return_value.connect_ex.assert_called_with(('127.0.0.1',5987))

    def test_hotkey_cancelled_after_removal_profile_switch_or_scene_change(self):
        g=GameHotkeys(self.app,self.r);g.authorized=True
        m=g.validate(dict(name='jump',gift='Rose',window='Minecraft',enabled=True,sequence=[{'keys':['A']}]))
        g.mappings=[m];g.injector=lambda *args:self.fail('No key should be sent')
        job=dict(mapping=copy.deepcopy(m),session='A',created=time.monotonic(),revision=g.revision)
        with patch.object(g,'target',return_value=(1,'Minecraft')):
            g.mappings=[];self.assertFalse(g.execute(job))
            g.mappings=[m];g.active_profile='Other';self.assertFalse(g.execute(job))
            g.active_profile='General';self.r.production.settings['scene']='pause';self.assertFalse(g.execute(job))
            self.r.production.settings['scene']='talk';g.save([m],['General'],'General');self.assertFalse(g.execute(job))

    def test_sequence_rechecks_deleted_rule_between_steps(self):
        g=GameHotkeys(self.app,self.r);g.authorized=True
        m=g.validate(dict(name='jump',gift='Rose',window='Minecraft',enabled=True,sequence=[{'keys':['A']},{'keys':['B']}]))
        g.mappings=[m];calls=[]
        def inject(*args):calls.append(args);g.mappings=[]
        g.injector=inject
        with patch.object(g,'target',return_value=(1,'Minecraft')):
            self.assertFalse(g.execute(dict(mapping=m,session='A',created=time.monotonic())))
        self.assertEqual(len(calls),1)

    def test_spotify_network_wait_does_not_block_song_intake(self):
        s=Spotify(self.app,self.r);entered=threading.Event();release=threading.Event()
        def player(*args,**kwargs):entered.set();release.wait(2)
        self.background.stop()
        result=[]
        with patch.object(s,'player',side_effect=player):
            thread=threading.Thread(target=lambda:result.append(self.app.test_client().post('/spotify/request',json={'action':'skip'}).status_code))
            thread.start()
            try:
                self.assertTrue(entered.wait(1))
                s.comment({'user':'viewer','comment':'!song spotify:track:'+'a'*22})
                self.assertFalse(release.is_set());self.assertEqual(len(s.requests),1)
                self.assertTrue(thread.is_alive())
            finally:release.set();thread.join(3)
        self.assertEqual(result,[200])

    def test_timer_finishes_and_can_restart_with_added_time(self):
        i=Interactivity(self.app,self.r);i.remaining=.1;i.running=True;i.tick=time.monotonic()-1
        self.assertEqual(i.timer(),0);self.assertFalse(i.running)
        c=self.app.test_client();c.post('/interactivity/timer',json={'action':'set','seconds':10})
        self.assertTrue(c.post('/interactivity/timer',json={'action':'start'}).get_json()['running'])

    def test_counter_restart_history_and_persistent_deduplication(self):
        with tempfile.TemporaryDirectory() as folder:
            self.r.archive=HistoryStore(Path(folder)/'history.db');self.r.archive.start('A','host')
            a=LiveCounters(self.app,self.r);a.event('gift','one',{'gift':'Rose'},3,6);a.event('follow','follow')
            b=LiveCounters(Flask('restored'),self.r)
            self.assertEqual(b.snapshot(),({'shares':0,'follows':1,'subscribers':0,'coins':6},{'rose':3}))
            b.seen.clear();b.event('gift','one',{'gift':'Rose'},3,6)
            self.assertEqual(b.snapshot()[0]['coins'],6)
            self.r.feed_session='B';self.assertEqual(b.snapshot()[1],{})
            response=self.app.test_client().get('/live-counters/A')
            self.assertEqual(response.get_json()['totals']['coins'],6)

    def test_full_recovery_restores_points_settings_and_media_on_new_install(self):
        with tempfile.TemporaryDirectory() as source,tempfile.TemporaryDirectory() as destination:
            root=Path(source);data=root/'data';data.mkdir()
            self.r.archive=HistoryStore(data/'history.sqlite3');self.r.archive.start('A','host')
            points=PointsSystem(self.app,self.r);points.config['enabled']=True;points.event('comment',{'user':'viewer'},'one')
            self.r.archive.set_setting('points_config',points.config)
            media=data/'alert_media';media.mkdir();(media/'image.png').write_bytes(b'image')
            with patch.dict('os.environ',TIKREADER_DATA_DIR=''):
                package=data_recovery.backup(root/'full.zip',root)
            target=Path(destination)
            with patch.dict('os.environ',TIKREADER_DATA_DIR=''):
                self.assertIsNone(data_recovery.restore(package,target))
            store=HistoryStore(target/'data'/'history.sqlite3')
            self.assertTrue(store.settings()['points_config']['enabled'])
            with store.connect() as db:self.assertEqual(db.execute('SELECT points FROM viewer_points').fetchone()[0],1)
            self.assertEqual((target/'data'/'alert_media'/'image.png').read_bytes(),b'image')
            store.set_setting('points_config',{'enabled':False})
            with patch.dict('os.environ',TIKREADER_DATA_DIR=''):
                previous=data_recovery.restore(package,target)
            self.assertTrue(previous.is_file());self.assertTrue(store.settings()['points_config']['enabled'])

    def test_recovery_rolls_back_when_replacement_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);data=root/'data';data.mkdir()
            store=HistoryStore(data/'history.sqlite3');store.set_setting('x',1)
            media=data/'media';media.mkdir();(media/'a.wav').write_bytes(b'old')
            with patch.dict('os.environ',TIKREADER_DATA_DIR=''):
                package=data_recovery.backup(root/'full.zip',root)
            store.set_setting('x',2)
            original=data_recovery.os.replace;calls=[]
            def replace(source,target):
                calls.append(str(target))
                if len(calls)==2:raise OSError('simulated disk failure')
                return original(source,target)
            with patch.dict('os.environ',TIKREADER_DATA_DIR=''), \
                    patch('data_recovery.os.replace',side_effect=replace),self.assertRaises(OSError):
                data_recovery.restore(package,root)
            self.assertEqual(store.settings()['x'],2)


class ProfileFixes(unittest.TestCase):
    def test_complete_profile_roundtrip_and_invalid_settings_are_atomic(self):
        import server
        with tempfile.TemporaryDirectory() as folder,patch.object(server,'archive',HistoryStore(Path(folder)/'history.db')):
            c=server.app.test_client();profile=c.get('/operator/profile').get_json()
            for key in ('points_config','minecraft_config','animation_templates','overlay_goals','widget_customizations','interactive_overlay_games'):
                self.assertIn(key,profile['settings'])
            profile['settings']['points_config']['currency']='Stars'
            profile['settings']['overlay_goals']={'goal-custom-1':{'goal':55,'value':4}}
            profile['settings']['minecraft_config']={'host':'127.0.0.1','port':25575,'commands':{'players':'list'}}
            with patch.object(server.points,'config',dict(server.points.config)),patch.object(server.minecraft,'config',dict(server.minecraft.config)),patch.object(server.production,'settings',dict(server.production.settings)),patch.object(server.live_counters,'goals',{}):
                self.assertEqual(c.post('/operator/profile',json=profile).status_code,200)
                self.assertEqual(server.points.config['currency'],'Stars')
                self.assertEqual(server.live_counters.goals['goal-custom-1']['goal'],55)
                self.assertFalse(server.minecraft.authorized)
                before=server.archive.settings();profile['settings']['widget_customizations']={'bad-panel':{}}
                self.assertEqual(c.post('/operator/profile',json=profile).status_code,400)
                self.assertEqual(server.archive.settings(),before)


if __name__=='__main__':unittest.main()
