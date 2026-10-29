import ast
from collections import OrderedDict
from pathlib import Path
import queue
import threading
import time
from types import SimpleNamespace as S
import unittest
from dataclasses import replace
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from flask import Flask

from minecraft_connector import MinecraftConnector


class PresetTests(unittest.TestCase):
    def setUp(self):
        self.runtime=S(archive=None,feed_session='A',production=S(local=lambda:True,settings={'emergency':False,'scene':'talk'}))
        self.app=Flask(__name__)
        with patch('threading.Thread.start'):
            self.mc=MinecraftConnector(self.app,self.runtime)
        self.client=self.app.test_client();self.mc.authorized=True

    def save(self, enabled=True, gift='1', preset='tnt_rain', edition='java'):
        return self.client.post('/minecraft/presets',json={'edition':edition,'presets':{
            preset:{'gift_id':gift,'gift_name':'Rose','enabled':enabled}}})

    def gift(self, event_id='g', count=1, ongoing=False, gift_id='1'):
        self.mc.gift({'id':event_id,'gift_id':gift_id,'gift':'Rose','count':count,'ongoing':ongoing},event_id)

    def test_catalog_defaults_and_validated_local_only_mapping_updates(self):
        snapshot=self.client.get('/minecraft').get_json()
        self.assertEqual(len(snapshot['preset_catalog']),9)
        self.assertTrue(all(not row['enabled'] and not row['gift_id'] for row in snapshot['presets'].values()))
        with patch.object(self.mc.bedrock,'close') as close:
            revision=self.mc.revision;self.assertEqual(self.save().status_code,200)
            self.assertTrue(self.mc.authorized);self.assertEqual(self.mc.revision,revision);close.assert_not_called()
        for body in [
            {'edition':'bedrock','presets':{}}, {'edition':'java','presets':{'forged':{}}},
            {'edition':'java','presets':{'tnt_rain':{'gift_id':'','enabled':True}}},
            {'edition':'java','presets':{'tnt_rain':{'gift_id':'1','enabled':True,'commands':['op @a']}}}]:
            self.assertIn(self.client.post('/minecraft/presets',json=body).status_code,(400,409))
        for endpoint in ['/minecraft/presets','/minecraft/presets/test','/minecraft/presets/stop']:
            with patch.object(self.runtime.production,'local',return_value=False):
                self.assertEqual(self.client.post(endpoint,json={}).status_code,403)

    def test_final_gifts_are_deduplicated_by_id_and_session_not_name_or_count(self):
        self.save();self.gift(ongoing=True,count=100);self.assertTrue(self.mc.jobs.empty())
        self.gift(count=100);self.gift(count=101);self.assertEqual(self.mc.jobs.qsize(),1)
        self.gift('different-id',gift_id='2');self.assertEqual(self.mc.jobs.qsize(),1)
        self.runtime.feed_session='B';self.gift();self.assertEqual(self.mc.jobs.qsize(),2)
        self.save(False);self.gift('disabled');self.save(True);self.gift('disabled')
        self.assertEqual(self.mc.jobs.qsize(),2,'enabling must not replay a previously observed gift')
        self.mc.authorized=False;self.gift('unauthorized');self.mc.authorized=True;self.gift('unauthorized')
        self.assertEqual(self.mc.jobs.qsize(),2)

    def test_five_tnt_commands_are_one_atomic_job_without_quantity_multiplier(self):
        self.save();self.gift(count=1000000);self.assertEqual(self.mc.jobs.qsize(),1)
        job=self.mc.jobs.get_nowait()
        with patch.object(self.mc,'execute',return_value='custom feedback') as execute:
            self.mc.run_job(job)
        self.assertEqual(execute.call_count,5)
        self.assertEqual(len({call.args[0] for call in execute.call_args_list}),5)
        self.assertTrue(all(row['outcome']=='unconfirmed' for row in self.mc.log))
        self.mc.jobs=queue.Queue(1);self.gift('fills-queue');self.gift('full-queue')
        self.assertEqual(self.mc.jobs.qsize(),1)

    def test_each_step_rechecks_cancellation_without_blocking_mapping_or_stop(self):
        changes=[lambda:self.save(False),lambda:self.client.post('/minecraft/presets/stop',json={'edition':'java'}),
                 lambda:setattr(self.runtime,'feed_session','new'),
                 lambda:self.runtime.production.settings.update(emergency=True),
                 lambda:self.runtime.production.settings.update(scene='pause'),
                 lambda:self.client.post('/minecraft',json={'edition':'bedrock','select_only':True}),
                 lambda:self.mc._bedrock_changed()]
        for change in changes:
            with self.subTest(change=change):
                self.setUp();self.save();self.gift();job=self.mc.jobs.get_nowait()
                def execute(command):change();return 'sent'
                with patch.object(self.mc,'execute',side_effect=execute) as send:
                    self.mc.run_job(job)
                self.assertEqual(send.call_count,1)
                self.assertEqual(self.mc.log[0]['outcome'],'cancelled')

    def test_toggle_off_on_cannot_revive_queued_job_and_rejection_stops_burst(self):
        self.save();self.gift();job=self.mc.jobs.get_nowait();self.save(False);self.save(True)
        with patch.object(self.mc,'execute') as execute:self.mc.run_job(job)
        execute.assert_not_called()
        self.gift('next');job=self.mc.jobs.get_nowait()
        with patch.object(self.mc,'execute',return_value='Unknown command') as execute:self.mc.run_job(job)
        self.assertEqual(execute.call_count,1)
        self.gift('expired');job=self.mc.jobs.get_nowait()
        with patch.object(self.mc,'execute') as execute:self.mc.run_job(replace(job,created=time.monotonic()-11))
        execute.assert_not_called()

    def test_stop_and_mapping_updates_do_not_wait_for_network_execution_lock(self):
        self.save();self.gift();job=self.mc.jobs.get_nowait()
        entered,release=threading.Event(),threading.Event()
        def execute(command):entered.set();release.wait(2);return 'feedback'
        with patch.object(self.mc,'execute',side_effect=execute),ThreadPoolExecutor(2) as pool:
            running=pool.submit(self.mc.run_job,job)
            self.assertTrue(entered.wait(1))
            try:
                stop=pool.submit(lambda:self.app.test_client().post('/minecraft/presets/stop',json={'edition':'java'}))
                self.assertEqual(stop.result(.5).status_code,200)
                update=pool.submit(self.save,False)
                self.assertEqual(update.result(.5).status_code,200)
            finally:release.set()
            running.result(2)
        self.assertEqual(self.mc.log[0]['outcome'],'cancelled')

    def test_manual_test_is_explicit_and_profiles_survive_alias_saves_and_restore(self):
        self.assertEqual(self.client.post('/minecraft/presets/test',json={'edition':'java','id':'tnt_rain'}).status_code,200)
        self.assertEqual(self.mc.jobs.qsize(),1)
        self.assertEqual(self.client.post('/minecraft/presets/test',json={'edition':'java','id':'forged'}).status_code,400)
        self.save();saved=[];self.runtime.archive=S(set_setting=lambda key,value:saved.append(value))
        self.client.post('/minecraft',json={'host':'localhost','port':25575,'commands':{'manual':'list'}})
        self.assertTrue(self.client.get('/minecraft').get_json()['presets']['tnt_rain']['enabled'])
        self.client.post('/minecraft',json={'edition':'bedrock','select_only':True})
        self.assertFalse(self.client.get('/minecraft').get_json()['presets']['tnt_rain']['enabled'])
        self.runtime.archive.settings=lambda:{'minecraft_config':saved[-1]}
        self.mc.restore();self.assertEqual(self.mc.edition,'bedrock')
        self.client.post('/minecraft',json={'edition':'java','select_only':True})
        self.assertTrue(self.client.get('/minecraft').get_json()['presets']['tnt_rain']['enabled'])

    def test_bedrock_uses_edition_correct_fixed_effect_command_and_generation(self):
        self.client.post('/minecraft',json={'edition':'bedrock','select_only':True})
        self.mc.authorized=True;self.mc.authorized_generation=self.mc.bedrock.generation
        self.assertEqual(self.client.post('/minecraft/presets/test',json={'edition':'bedrock','id':'speed'}).status_code,200)
        with patch.object(self.mc.bedrock,'execute',return_value={'outcome':'success','response':'ok'}) as execute:
            self.mc.run_job(self.mc.jobs.get_nowait())
        self.assertEqual(execute.call_args.args[0],'effect @p speed 20 1')
        self.assertEqual(execute.call_args.kwargs['expected_generation'],self.mc.authorized_generation)

    def test_server_hook_dispatches_unchanged_count_final_and_simulation_path(self):
        # Compile the current function in isolation; importing server starts unrelated services.
        source=Path('app/server.py').read_text(encoding='utf-8')
        node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='handle_gift_event')
        noop=lambda *args,**kwargs:None
        service=S(audience_event=noop,event=noop,gift=noop)
        env=dict(time=time,feed_lock=threading.RLock(),gift_event_key=lambda *args:'stable',gift_counts={},
                 gift_history=OrderedDict(),gift_catalog={},state={'gift_count':0},gifter_totals={},gifter_diamonds={},
                 diagnostics={},observe_participant=noop,avatar_url=lambda user:'',image_url=lambda image:'',
                 remember_id=lambda cache,key,value:cache.__setitem__(key,value),creator_suite=service,
                 live_counters=service,interactive=service,points=service,game_hotkeys=S(gift=lambda *args:[]),
                 animation_studio=service,overlay_animations=service,archive=None,feed_session='A',
                 publish_gift_history=noop,publish_stats=noop,gift_revision=0,minecraft=self.mc)
        exec(compile(ast.Module(body=[node],type_ignores=[]),'app/server.py','exec'),env)
        self.save();event=S(user=S(unique_id='sender'),gift=S(id=1,name='Rose',type=1,diamond_count=1),
                            gift_id=1,repeat_count=5,repeat_end=False)
        env['handle_gift_event'](event,update_catalog=False);self.assertTrue(self.mc.jobs.empty())
        event.repeat_end=True;env['handle_gift_event'](event,update_catalog=False)
        env['handle_gift_event'](event,update_catalog=False)
        self.assertEqual(self.mc.jobs.qsize(),1)
        self.assertEqual(env['state']['gift_count'],5)


if __name__=='__main__':unittest.main()
