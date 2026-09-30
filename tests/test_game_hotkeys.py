import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
import server
from history_store import HistoryStore
from game_hotkeys import normalize, key_code, press_keys, ALLOWED, MODIFIERS, SPECIAL

class GameHotkeyTests(unittest.TestCase):
    def setUp(self):
        self.g=server.game_hotkeys;self.client=server.app.test_client();self.g.mappings=[];self.g.profiles=['General'];self.g.active_profile='General';self.g.authorized=False;self.g.last.clear();self.g.usage.clear();self.g.log.clear()
        self.g.session=server.feed_session;self.g.injector=lambda keys,hold,hwnd:None
        self.production=patch.dict(server.production.settings,emergency=False,scene='talk');self.production.start()
    def tearDown(self):self.g.mappings=[];self.g.authorized=False;self.production.stop()
    def mapping(self,**extra):
        data=dict(name='Rosa salta',profile='General',gift='Rose',sequence=[{'keys':['CTRL','F1'],'hold_ms':60,'delay_ms':0}],window='Metal Slug',amount=2,condition='minimum',cooldown=10,budget=3,priority=50,enabled=True);data.update(extra);return self.g.validate(data)
    def test_validation_restricts_key_and_target(self):
        self.assertEqual(self.mapping()['sequence'][0]['keys'],['CTRL','F1'])
        with self.assertRaises(ValueError):self.mapping(sequence=[{'keys':['CTRL','ALT']}])
        with self.assertRaises(ValueError):self.mapping(sequence=[{'keys':['A','B']}])
        with self.assertRaises(ValueError):self.mapping(sequence=[{'keys':['CTRL','DELETE']}])
        with self.assertRaises(ValueError):self.mapping(window='')
    def test_gift_queues_only_authorized_matching_threshold(self):
        self.g.mappings=[self.mapping()]
        self.g.gift({'gift':'rose','count':2},'unauthorized');self.assertTrue(self.g.jobs.empty())
        self.g.authorized=True;self.g.gift({'gift':'other','count':2},'other');self.g.gift({'gift':'ROSE','count':1},'small');self.assertTrue(self.g.jobs.empty())
        self.g.gift({'gift':'Ｒｏｓｅ','count':2},'match');job=self.g.jobs.get_nowait()[2];self.g.jobs.task_done();self.assertEqual(job['mapping']['sequence'][0]['keys'],['CTRL','F1'])
    def test_execution_requires_foreground_and_current_safe_state(self):
        called=[];self.g.authorized=True;self.g.injector=lambda keys,hold,hwnd:called.append((keys,hold,hwnd));job=dict(mapping=self.mapping(),session=server.feed_session,created=time.monotonic(),event='x')
        self.g.mappings=[job['mapping']]
        with patch('game_hotkeys.foreground',return_value=(1,'OBS - Notepad')):self.assertFalse(self.g.execute(job))
        with patch('game_hotkeys.foreground',return_value=(1,'Metal Slug X')):self.assertTrue(self.g.execute(job))
        self.assertEqual(called,[(['CTRL','F1'],60,0)])
        job['created']-=10
        with patch('game_hotkeys.foreground',return_value=(1,'Metal Slug X')):self.assertFalse(self.g.execute(job))
    def test_cooldown_budget_and_session_reset(self):
        self.g.authorized=True;self.g.mappings=[self.mapping(cooldown=1,budget=1)]
        self.g.gift({'gift':'Rose','count':2},'1');self.g.gift({'gift':'Rose','count':2},'2');self.assertEqual(self.g.jobs.qsize(),1)
        self.g.jobs.get_nowait();self.g.jobs.task_done()
    def test_endpoints_require_confirmation_and_local_origin(self):
        self.assertEqual(self.client.post('/game-hotkeys/authorize',json={'enabled':True}).status_code,400)
        self.assertEqual(self.client.post('/game-hotkeys/test',json={'confirmation':'PROBAR HOTKEY'}).status_code,404)
        self.assertEqual(self.client.get('/game-hotkeys',environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)
        self.assertEqual(self.client.post('/game-hotkeys',json={'mappings':[]},headers={'Origin':'https://evil.example'}).status_code,403)
    def test_save_and_restart_are_disabled(self):
        m=self.mapping();store=None
        with tempfile.TemporaryDirectory() as folder:
            store=HistoryStore(Path(folder)/'history.sqlite3')
            with patch.object(server,'archive',store):
                self.assertEqual(self.client.post('/game-hotkeys',json={'mappings':[m],'profiles':['General'],'active_profile':'General'}).status_code,200)
                self.g.authorized=True;self.g.restore()
                self.assertFalse(self.g.authorized);self.assertFalse(self.g.mappings[0]['enabled'])
    def test_profile_can_be_deleted_with_all_its_mappings(self):
        arcade=self.mapping(profile='Arcade')
        created=self.client.post('/game-hotkeys',json={'mappings':[arcade],'profiles':['General','Arcade'],'active_profile':'Arcade'})
        self.assertEqual(created.status_code,200)
        deleted=self.client.post('/game-hotkeys',json={'mappings':[],'profiles':['General'],'active_profile':'General'})
        self.assertEqual(deleted.status_code,200)
        self.assertEqual(deleted.get_json()['profiles'],['General'])
        self.assertEqual(deleted.get_json()['active_profile'],'General')
        self.assertEqual(deleted.get_json()['mappings'],[])
    def test_manual_endpoint_uses_real_key_conversion_and_sender(self):
        self.g.mappings=[self.mapping(sequence=[{'keys':['CTRL','SHIFT','F2']}])]
        self.g.authorized=True;self.g.paused=False;self.g.injector=press_keys
        native=Mock()
        with patch('game_hotkeys.user32',return_value=native),patch('game_hotkeys.foreground',return_value=(1,'Metal Slug X')),patch('game_hotkeys.time.sleep') as wait:
            response=self.client.post('/game-hotkeys/test',json={'id':self.g.mappings[0]['id'],'confirmation':'PROBAR HOTKEY'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(wait.call_args_list[0].args,(5,))
        self.assertEqual([c.args[0] for c in native.keybd_event.call_args_list],[17,16,113,113,16,17])

    def test_sequence_stops_when_focus_changes(self):
        self.g.authorized=True;self.g.paused=False;calls=[]
        self.g.injector=lambda *args:calls.append(args)
        job=dict(mapping=self.mapping(sequence=[{'keys':['A']},{'keys':['B']}]),session=server.feed_session,created=time.monotonic())
        self.g.mappings=[job['mapping']]
        with patch('game_hotkeys.foreground',side_effect=[(1,'Metal Slug'),(1,'Metal Slug'),(2,'Chrome')]):
            self.assertFalse(self.g.execute(job))
        self.assertEqual(len(calls),1)

    def test_sequence_stops_when_paused_between_steps(self):
        self.g.authorized=True;self.g.paused=False;calls=[]
        def send(*args):calls.append(args);self.g.paused=True
        self.g.injector=send
        job=dict(mapping=self.mapping(sequence=[{'keys':['A']},{'keys':['B']}]),session=server.feed_session,created=time.monotonic())
        self.g.mappings=[job['mapping']]
        with patch('game_hotkeys.foreground',return_value=(1,'Metal Slug')):
            self.assertFalse(self.g.execute(job))
        self.assertEqual(len(calls),1);self.g.paused=False

    def test_local_only_mapping_cannot_be_enabled_for_live(self):
        self.assertFalse(self.mapping(gift='__prueba_local__',enabled=True)['enabled'])

    def test_global_switch_covers_all_profiles_and_invalidates_old_jobs(self):
        self.g.mappings=[self.mapping(enabled=False),self.mapping(id='other',profile='Arcade',enabled=False),self.mapping(id='local',gift='__prueba_local__')]
        self.g.profiles=['General','Arcade'];self.g.paused=True
        with patch.object(server,'archive',None):
            response=self.client.post('/game-hotkeys/all',json={'enabled':True,'confirmation':'AUTORIZAR HOTKEYS'})
            self.assertEqual(response.status_code,200)
            self.assertTrue(self.g.authorized);self.assertFalse(self.g.paused)
            self.assertEqual([m['enabled'] for m in self.g.mappings],[True,True,False])
            job=dict(mapping=self.g.mappings[0],session=server.feed_session,revision=self.g.revision,created=time.monotonic(),event='gift')
            self.assertEqual(self.client.post('/game-hotkeys/all',json={'enabled':False}).status_code,200)
            self.assertFalse(self.g.authorized);self.assertFalse(any(m['enabled'] for m in self.g.mappings))
            self.client.post('/game-hotkeys/all',json={'enabled':True,'confirmation':'AUTORIZAR HOTKEYS'})
            self.assertFalse(self.g.job_allowed(job),'Old queued jobs must stay cancelled after reactivation')

    def test_mgba_changing_fps_does_not_block_the_configured_game(self):
        m=self.mapping(window='mGBA - Pokemon (60.9 fps) - 0.10.5',sequence=[{'keys':['ENTER']}])
        with patch('game_hotkeys.foreground',return_value=(42,'mGBA - Pokemon (59.8 fps) - 0.10.5')):
            self.assertEqual(self.g.target(m)[0],42)
        with patch('game_hotkeys.foreground',return_value=(43,'mGBA - Another game (60.9 fps) - 0.10.5')):
            self.assertEqual(self.g.target(m)[0],0)
        m['target']='background'
        with patch('game_hotkeys.windows',return_value=[(42,'mGBA - Pokemon (60,1 fps) - 0.10.5')]):
            self.assertEqual(self.g.target(m)[0],42)

    def test_global_switch_validates_authorization_and_can_disable_without_mappings(self):
        self.assertEqual(self.client.post('/game-hotkeys/all',json={'enabled':True}).status_code,400)
        self.assertEqual(self.client.post('/game-hotkeys/all',json={'enabled':'false'}).status_code,400)
        self.assertEqual(self.client.post('/game-hotkeys/all',json={'enabled':True,'confirmation':'AUTORIZAR HOTKEYS'}).status_code,409)
        with patch.object(server,'archive',None):
            self.assertEqual(self.client.post('/game-hotkeys/all',json={'enabled':False}).status_code,200)

    def test_gift_reports_disabled_rule_and_missing_gift_instead_of_silence(self):
        self.g.mappings=[self.mapping(enabled=False)]
        result=self.g.gift({'gift':'Rose','count':2},'disabled')
        self.assertIn('desactivada',result[0]['result'])
        result=self.g.gift({'gift':'Other','count':2},'missing')
        self.assertIn('No hay una acción',result[0]['result'])
        self.assertTrue(self.g.jobs.empty())

    def test_normalization_is_literal_not_regex(self):self.assertEqual(normalize(' Ｒｏｓｅ '),'rose')
    def test_manual_test_waits_before_injection_and_rechecks_safety(self):
        self.g.mappings=[self.mapping()];self.g.authorized=True;self.g.paused=False
        calls=[];self.g.injector=lambda *args:calls.append('keys')
        def wait(seconds):
            self.assertGreaterEqual(seconds,5);self.assertEqual(calls,[]);calls.append('wait')
        data={'id':self.g.mappings[0]['id'],'confirmation':'PROBAR HOTKEY'}
        with patch('game_hotkeys.time.sleep',side_effect=wait),patch('game_hotkeys.foreground',return_value=(1,'Metal Slug X')):
            self.assertEqual(self.client.post('/game-hotkeys/test',json=data).status_code,200)
        self.assertEqual(calls,['wait','keys'])
        calls.clear()
        def revoke(seconds):self.g.authorized=False
        with patch('game_hotkeys.time.sleep',side_effect=revoke),patch('game_hotkeys.foreground',return_value=(1,'Metal Slug X')):
            response=self.client.post('/game-hotkeys/test',json=data)
        self.assertEqual(response.status_code,409);self.assertIn('error',response.get_json());self.assertEqual(calls,[])

    def test_manual_test_elapsed_time_is_at_least_five_seconds(self):
        self.g.mappings=[self.mapping()];self.g.authorized=True;self.g.paused=False
        started=time.monotonic();fired=[]
        self.g.injector=lambda *args:fired.append(time.monotonic()-started)
        with patch('game_hotkeys.foreground',return_value=(1,'Metal Slug X')):
            response=self.client.post('/game-hotkeys/test',json={'id':self.g.mappings[0]['id'],'confirmation':'PROBAR HOTKEY'})
        self.assertEqual(response.status_code,200);self.assertEqual(len(fired),1);self.assertGreaterEqual(fired[0],5)

    def test_manual_test_blocks_wrong_window_after_wait(self):
        self.g.mappings=[self.mapping()];self.g.authorized=True;self.g.paused=False
        with patch('game_hotkeys.time.sleep') as wait,patch('game_hotkeys.foreground',return_value=(1,'Chrome')),patch.object(self.g,'injector') as inject:
            response=self.client.post('/game-hotkeys/test',json={'id':self.g.mappings[0]['id'],'confirmation':'PROBAR HOTKEY'})
        wait.assert_called_once_with(5);inject.assert_not_called();self.assertEqual(response.status_code,409)
    def test_exact_multiple_and_once_per_streak_dry_run(self):
        self.g.mappings=[self.mapping(condition='exact',amount=3),self.mapping(id='multiple',condition='multiple',amount=2)]
        names={x['id']:x['result'] for x in self.g.gift({'gift':'Rose','count':4},'streak:4',dry=True)}
        self.assertEqual(names[self.g.mappings[0]['id']],'Cantidad no coincide');self.assertEqual(names['multiple'],'Coincide')
        self.assertTrue(self.g.jobs.empty())
    def test_sequence_profile_and_priority_validation(self):
        m=self.mapping(profile='Arcade',priority=99,target='background',sequence=[{'keys':['A'],'hold_ms':500,'delay_ms':25},{'keys':['CTRL','B'],'hold_ms':50,'delay_ms':100}])
        self.assertEqual(len(m['sequence']),2);self.assertEqual(m['priority'],99);self.assertEqual(m['target'],'background')
    def test_simulation_endpoint_never_authorizes_or_enqueues(self):
        self.g.mappings=[self.mapping()];before=self.g.jobs.qsize()
        d=self.client.post('/game-hotkeys/simulate',json={'gift':'Rose','count':2}).get_json()
        self.assertTrue(d['dry_run']);self.assertEqual(before,self.g.jobs.qsize());self.assertFalse(self.g.authorized)


class NativeKeyTests(unittest.TestCase):
    def test_every_allowed_key_has_the_correct_windows_code(self):
        expected={**MODIFIERS,**SPECIAL,**{chr(k):k for k in range(65,91)},
                  **{str(k):48+k for k in range(10)},**{f'F{k}':111+k for k in range(1,25)}}
        self.assertEqual(set(expected),ALLOWED)
        for key,code in expected.items():
            with self.subTest(key=key):self.assertEqual(key_code(key),code)
        for key in ['', 'F0', 'F25', 'DELETE', 'ctrl']:
            with self.subTest(invalid=key),self.assertRaises(ValueError):key_code(key)

    def test_actual_press_function_sends_combo_and_releases_in_reverse_order(self):
        native=Mock()
        with patch('game_hotkeys.user32',return_value=native),patch('game_hotkeys.time.sleep') as sleep:
            press_keys(['CTRL','SHIFT','F2'],60)
        self.assertEqual([c.args for c in native.keybd_event.call_args_list],
                         [(17,0,0,0),(16,0,0,0),(113,0,0,0),(113,0,2,0),(16,0,2,0),(17,0,2,0)])
        sleep.assert_called_once_with(.06)

    def test_actual_press_function_handles_every_special_key(self):
        for key,code in SPECIAL.items():
            with self.subTest(key=key):
                native=Mock()
                with patch('game_hotkeys.user32',return_value=native),patch('game_hotkeys.time.sleep'):
                    press_keys([key])
                self.assertEqual([c.args for c in native.keybd_event.call_args_list],[(code,0,0,0),(code,0,2,0)])

    def test_failure_releases_modifiers_already_pressed(self):
        native=Mock();native.keybd_event.side_effect=[None,RuntimeError('failed'),None]
        with patch('game_hotkeys.user32',return_value=native),self.assertRaises(RuntimeError):
            press_keys(['CTRL','F2'])
        self.assertEqual(native.keybd_event.call_args_list[-1].args,(17,0,2,0))

    def test_release_failure_still_attempts_other_modifiers(self):
        native=Mock();native.keybd_event.side_effect=[None,None,RuntimeError('failed'),None]
        with patch('game_hotkeys.user32',return_value=native),patch('game_hotkeys.time.sleep'),self.assertRaises(RuntimeError):
            press_keys(['CTRL','F2'])
        self.assertEqual(native.keybd_event.call_args_list[-1].args,(17,0,2,0))

    def test_background_rejection_is_not_reported_as_success(self):
        native=Mock();native.PostMessageW.return_value=0
        with patch('game_hotkeys.user32',return_value=native),self.assertRaises(RuntimeError):
            press_keys(['F1'],hwnd=123)
        native.keybd_event.assert_not_called()

    def test_invalid_key_never_sends_partial_combo(self):
        native=Mock()
        with patch('game_hotkeys.user32',return_value=native),self.assertRaises(ValueError):
            press_keys(['CTRL','INVALID'])
        native.keybd_event.assert_not_called()


class WindowsReceiverTests(unittest.TestCase):
    @unittest.skipUnless(__import__('os').name=='nt','Requires Windows')
    def test_native_messages_arrive_at_an_isolated_receiver(self):
        # A message-only window never takes focus and cannot type in user apps.
        import ctypes
        from ctypes import wintypes
        from game_hotkeys import user32
        u=user32()
        u.CreateWindowExW.argtypes=[wintypes.DWORD,wintypes.LPCWSTR,wintypes.LPCWSTR,wintypes.DWORD,
                                   ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,
                                   wintypes.HWND,wintypes.HMENU,wintypes.HINSTANCE,wintypes.LPVOID]
        u.CreateWindowExW.restype=wintypes.HWND
        u.DestroyWindow.argtypes=[wintypes.HWND]
        u.PeekMessageW.argtypes=[ctypes.POINTER(wintypes.MSG),wintypes.HWND,wintypes.UINT,wintypes.UINT,wintypes.UINT]
        hwnd=u.CreateWindowExW(0,'STATIC','TikReader isolated test receiver',0,0,0,0,0,-3,None,None,None)
        self.assertTrue(hwnd,'Could not create isolated Windows receiver')
        try:
            press_keys(['CTRL','SHIFT','F2'],20,hwnd)
            msg=wintypes.MSG();received=[]
            while u.PeekMessageW(ctypes.byref(msg),hwnd,0x100,0x101,1):
                received.append((msg.message,msg.wParam))
            self.assertEqual(received,[(0x100,17),(0x100,16),(0x100,113),(0x101,113),(0x101,16),(0x101,17)])
        finally:u.DestroyWindow(hwnd)


class WorkerRecoveryTests(unittest.TestCase):
    def test_worker_continues_after_an_unexpected_job_failure(self):
        from game_hotkeys import GameHotkeys
        worker=object.__new__(GameHotkeys)
        worker.jobs=Mock();worker.jobs.get.side_effect=[(0,0,{'id':'bad'}),(0,1,{'id':'next'}),StopIteration]
        worker.execute=Mock(side_effect=[RuntimeError('unexpected'),True]);worker.note=Mock()
        with self.assertRaises(StopIteration):worker.worker()
        self.assertEqual(worker.execute.call_count,2)
        self.assertEqual(worker.jobs.task_done.call_count,2)
        worker.note.assert_called_once()
