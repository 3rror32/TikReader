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
        self.now=1000
        clock=patch('minecraft_connector.time.monotonic',side_effect=lambda:self.now)
        clock.start();self.addCleanup(clock.stop)
        self.app=Flask(__name__)
        with patch('threading.Thread.start'):
            self.mc=MinecraftConnector(self.app,self.runtime)
        self.client=self.app.test_client();self.mc.authorized=True

    def save(self, enabled=True, gift='1', preset='tnt_rain', edition='java'):
        return self.client.post('/minecraft/presets',json={'edition':edition,'presets':{
            preset:{'gift_id':gift,'gift_name':'Rose','enabled':enabled}}})

    def gift(self, event_id='g', count=1, ongoing=False, gift_id='1'):
        self.mc.gift({'id':event_id,'gift_id':gift_id,'gift':'Rose','count':count,'ongoing':ongoing},event_id)

    def test_simulation_is_local_strict_atomic_and_names_donor(self):
        self.save(preset='zombie')
        body={'edition':'java','gift_id':'1','user':'Ana'}
        response=self.client.post('/minecraft/presets/simulate',json=body)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.get_json()['accepted'],True)
        self.assertEqual(self.runtime.feed_session,'A')
        job=self.mc.jobs.get_nowait()
        self.assertIn('CustomName:{text:"Ana"}',job.commands[0])
        self.assertEqual(self.client.post('/minecraft/presets/simulate',json=body).status_code,200)
        self.assertEqual(self.mc.jobs.qsize(),1)
        for value in [None,True,3,'x'*201]:
            self.assertEqual(self.client.post('/minecraft/presets/simulate',json={**body,'user':value}).status_code,400)
        with patch.object(self.runtime.production,'local',return_value=False):
            self.assertEqual(self.client.post('/minecraft/presets/simulate',json=body).status_code,403)

    def test_shared_limits_reserve_full_cost_across_queued_gifts(self):
        rules={key:{'gift_id':'1','gift_name':'Rose','enabled':True} for key in ('tnt_rain','zombie')}
        self.client.post('/minecraft/presets',json={'edition':'java','presets':rules})
        with patch('minecraft_connector.time.monotonic',return_value=100) as clock:
            self.gift(count=1);job=self.mc.jobs.get_nowait()
            self.assertEqual(len(job.commands),6)
            with patch.object(self.mc,'execute',return_value='ok'):self.mc.run_job(job)
            self.assertTrue(self.mc.enqueue_preset('rain'))
            rain=self.mc.jobs.get_nowait()
            self.assertEqual(rain.created,103)
            clock.return_value=103
            self.assertTrue(self.mc.enqueue_preset('tnt_rain'))
            tnt_one=self.mc.jobs.get_nowait()
            clock.return_value=106
            self.assertTrue(self.mc.enqueue_preset('tnt_rain'))
            tnt_two=self.mc.jobs.get_nowait()
            self.assertFalse(self.mc.enqueue_preset('tnt_rain'))
            self.assertTrue(self.mc.jobs.empty())
            with patch.object(self.mc,'execute',return_value='ok'), \
                    patch('minecraft_connector.time.sleep',side_effect=lambda delay: setattr(clock,'return_value',clock.return_value+delay)):
                self.mc.run_job(rain)
                self.mc.run_job(tnt_one)
                self.mc.run_job(tnt_two)

    def test_limit_settings_are_strict_preserved_and_do_not_revoke(self):
        body={'edition':'java','limits':{'interval':5,'per_minute':10},'name_format':'legacy'}
        self.assertEqual(self.client.post('/minecraft/presets/settings',json=body).status_code,200)
        self.assertTrue(self.mc.authorized)
        for limits in [{'interval':True,'per_minute':10},{'interval':0,'per_minute':10},{'interval':3,'per_minute':float('nan')}]:
            self.assertEqual(self.client.post('/minecraft/presets/settings',json={**body,'limits':limits}).status_code,400)
        self.client.post('/minecraft',json={'commands':{}})
        self.assertEqual(self.mc.config['limits'],body['limits'])
        self.assertEqual(self.mc.config['name_format'],'legacy')

    def test_name_codecs_are_literal_bounded_and_edition_specific(self):
        from minecraft_presets import commands_for, donor_name
        name=donor_name(' @\uff21na\n\u00a7c\u202e";\\Test ')
        self.assertNotIn('\n',name);self.assertNotIn('\u00a7',name);self.assertNotIn('\u202e',name)
        self.assertLessEqual(len(donor_name('\U0001f600'*100).encode('utf-8')),128)
        modern=commands_for('zombie','java',name,'modern')[0]
        legacy=commands_for('zombie','java',"O'Neil",'legacy')[0]
        bedrock=commands_for('zombie','bedrock','Ana')[0]
        self.assertIn('CustomName:{text:',modern)
        self.assertIn("O\\'Neil",legacy)
        self.assertEqual(bedrock,'execute @p ~ ~ ~ summon zombie "Ana" ~2 ~ ~')

    def test_successful_preset_announcements_are_native_json_and_quantity_aware(self):
        from minecraft_presets import announcement_for
        java=announcement_for('zombie','java','Ana"; tellraw @a',quantity=3,gift_count=2)
        self.assertEqual(java,'tellraw @p {"text":"Ana\\\" tellraw @a te envió 6 Zombis"}')
        self.assertEqual(announcement_for('zombie','java','Simulador'),
                         'tellraw @p {"text":"Simulador te envió 1 Zombie"}')
        bedrock=announcement_for('diamonds','bedrock','Simulador',quantity=1,gift_count=8)
        self.assertEqual(bedrock,'tellraw @p {"rawtext":[{"text":"Simulador te envió 5 diamantes"}]}')
        self.assertEqual(announcement_for('rain','java','Ana'),
                         'tellraw @p {"text":"Ana te envió Lluvia"}')

    def test_spawn_announcements_pluralize_mob_names_but_keep_tnt_invariant(self):
        from minecraft_presets import _MOBS, _MOB_PLURALS, announcement_for
        self.assertEqual(set(_MOB_PLURALS),set(_MOBS))
        self.assertIn('te envió 1 Zombie"', announcement_for('zombie','java','Ana',quantity=1))
        self.assertIn('te envió 6 Zombis"', announcement_for('zombie','java','Ana',quantity=3,gift_count=2))
        self.assertIn('te envió 6 Creepers"', announcement_for('creeper','java','Ana',quantity=3,gift_count=2))
        self.assertIn('te envió 1 Calamar brillante"', announcement_for('glow_squid','java','Ana'))
        self.assertIn('te envió 2 Calamares brillantes"', announcement_for('glow_squid','java','Ana',gift_count=2))
        self.assertIn('te envió 1 Gólem de hierro"', announcement_for('iron_golem','java','Ana'))
        self.assertIn('te envió 2 Gólems de hierro"', announcement_for('iron_golem','java','Ana',gift_count=2))
        self.assertIn('te envió 2 TNT"', announcement_for('tnt_rain','java','Ana',quantity=1,gift_count=2))

    def test_gift_presets_queue_in_fifo_with_interval_scheduling_and_preserve_counts(self):
        self.client.post('/minecraft/presets/settings',json={'edition':'java',
            'limits':{'interval':4,'per_minute':20},'name_format':'modern'})
        self.client.post('/minecraft/presets',json={'edition':'java','presets':{
            'creeper':{'gift_id':'awesome','gift_name':"You're awesome",'enabled':True,'quantity':3}}})
        self.gift('first-awesome',count=1,gift_id='awesome')
        self.gift('second-awesome',count=2,gift_id='awesome')
        self.assertEqual(self.mc.jobs.qsize(),2)
        first=self.mc.jobs.get_nowait();second=self.mc.jobs.get_nowait()
        self.assertEqual(first.gift_count,1)
        self.assertEqual(second.gift_count,2)
        self.assertEqual(len(first.commands),3)
        self.assertEqual(len(second.commands),6)
        self.assertIn('3 Creepers',first.announcements[0])
        self.assertIn('6 Creepers',second.announcements[0])
        self.assertEqual(second.created-first.created,4)
        delays=[];sent=[]
        with patch.object(self.mc,'execute',side_effect=lambda command:sent.append(command) or 'Summoned new Creeper'), \
                patch('minecraft_connector.time.sleep',side_effect=lambda delay: (delays.append(delay), setattr(self,'now',self.now+delay))):
            self.mc.run_job(first)
            self.mc.run_job(second)
        self.assertAlmostEqual(sum(delays),4)
        self.assertTrue(all(delay <= .1 for delay in delays))
        self.assertEqual(sent[:3],list(first.commands))
        self.assertEqual(sent[4:10],list(second.commands))

    def test_cancelled_waiting_job_retires_reservation_and_worker_reaches_next_job(self):
        self.assertTrue(self.mc.enqueue_preset('rain'))
        first=self.mc.jobs.get_nowait()
        self.assertTrue(self.mc.enqueue_preset('rain'))
        cancelled=self.mc.jobs.get_nowait()
        self.assertTrue(self.mc.enqueue_preset('rain'))
        next_job=self.mc.jobs.get_nowait()
        with patch.object(self.mc,'execute',return_value='ok'):
            self.mc.run_job(first)
        slept=[]
        def pause_and_cancel(delay):
            slept.append(delay)
            self.now+=delay
            self.runtime.production.settings['emergency']=True
        with patch('minecraft_connector.time.sleep',side_effect=pause_and_cancel), \
                patch.object(self.mc,'execute') as execute:
            self.mc.run_job(cancelled)
        self.assertTrue(slept)
        execute.assert_not_called()
        reservation=next(entry for entry in self.mc.preset_usage if entry['owner'] is cancelled.admission_id)
        self.assertIsNotNone(reservation['finished'])
        self.assertIs(self.mc.preset_owner,next_job.admission_id)
        self.runtime.production.settings['emergency']=False
        with patch.object(self.mc,'execute',return_value='ok'), \
                patch('minecraft_connector.time.sleep',side_effect=lambda delay: setattr(self,'now',self.now+delay)):
            self.mc.run_job(next_job)
        self.assertIsNone(self.mc.preset_owner)

    def test_stop_rebases_future_interval_schedule_for_new_jobs(self):
        self.client.post('/minecraft/presets/settings',json={'edition':'java',
            'limits':{'interval':60,'per_minute':20},'name_format':'modern'})
        jobs=[]
        for index in range(3):
            self.assertTrue(self.mc.enqueue_preset('rain'))
            jobs.append(self.mc.jobs.get_nowait())
        self.assertEqual([job.created for job in jobs],[1000,1060,1120])
        self.assertEqual(self.client.post('/minecraft/presets/stop',json={'edition':'java'}).status_code,200)
        self.assertTrue(self.mc.enqueue_preset('rain'))
        next_job=self.mc.jobs.get_nowait()
        self.assertEqual(next_job.created,self.now)

    def test_tnt_gift_mapping_is_admitted_and_executes_one_configured_tnt(self):
        self.client.post('/minecraft/presets',json={'edition':'java','presets':{
            'tnt_rain':{'gift_id':'awesome','gift_name':"You're awesome",'enabled':True,'quantity':1}}})
        self.gift('awesome-tnt',count=1,gift_id='awesome')
        self.assertEqual(self.mc.jobs.qsize(),1)
        job=self.mc.jobs.get_nowait()
        self.assertEqual(len(job.commands),1)
        sent=[]
        with patch.object(self.mc,'execute',side_effect=lambda command:sent.append(command) or 'ok'), \
                patch('minecraft_connector.time.sleep',side_effect=lambda delay: setattr(self,'now',self.now+delay)):
            self.mc.run_job(job)
        self.assertEqual(sent[0],job.commands[0])
        self.assertIn('1 TNT',job.announcements[0])

    def test_preset_job_keeps_one_announcement_per_selected_preset(self):
        self.client.post('/minecraft/presets',json={'edition':'java','presets':{
            'zombie':{'gift_id':'1','gift_name':'Rose','enabled':True,'quantity':2},
            'diamonds':{'gift_id':'1','gift_name':'Rose','enabled':True}}})
        self.assertTrue(self.mc.admit_presets(('zombie','diamonds'),'Simulador',automatic=True,gift_count=3))
        job=self.mc.jobs.get_nowait()
        self.assertEqual(len(job.commands),7)
        self.assertEqual(len(job.announcements),2)
        self.assertIn('6 Zombie',job.announcements[0])
        self.assertIn('5 diamantes',job.announcements[1])
        sent=[]
        def execute(command):
            sent.append(command)
            return 'Gave 5 [Diamond] to Ana' if command.startswith('give ') else 'Summoned new Zombie'
        with patch.object(self.mc,'execute',side_effect=execute):
            self.mc.run_preset(job)
        self.assertEqual(sent,list(job.commands)+list(job.announcements))
        self.assertEqual(len(sent)-len(job.commands),2)

    def test_announcements_follow_all_confirmed_actions_and_skip_unconfirmed_jobs(self):
        self.save(preset='zombie')
        self.gift(count=2)
        job=self.mc.jobs.get_nowait()
        sent=[]
        def execute(command):
            sent.append(command)
            return 'Summoned new Zombie'
        with patch.object(self.mc,'execute',side_effect=execute):
            self.mc.run_preset(job)
        self.assertEqual(sent,list(job.commands)+list(job.announcements))

        self.now+=3
        self.assertTrue(self.mc.admit_presets(('zombie',),'Ana'))
        job=self.mc.jobs.get_nowait();sent=[]
        with patch.object(self.mc,'execute',side_effect=lambda command: sent.append(command) or 'Respuesta localizada'):
            self.mc.run_preset(job)
        self.assertEqual(sent,list(job.commands))

        self.now+=3
        self.assertTrue(self.mc.admit_presets(('zombie',),'Ana'))
        job=self.mc.jobs.get_nowait();sent=[]
        with patch.object(self.mc,'execute',side_effect=lambda command: sent.append(command) or 'No entity was found'):
            self.mc.run_preset(job)
        self.assertEqual(sent,list(job.commands[:1]))

    def test_bedrock_announces_once_after_confirmed_action(self):
        self.mc.edition='bedrock'
        self.mc.authorized_generation=self.mc.bedrock.generation
        self.save(preset='zombie',edition='bedrock')
        self.gift()
        job=self.mc.jobs.get_nowait();sent=[]
        def execute(command, expected_generation=None):
            sent.append(command)
            return {'response':'Command executed','outcome':'success'}
        with patch.object(self.mc.bedrock,'execute',side_effect=execute):
            self.mc.run_preset(job)
        self.assertEqual(sent,list(job.commands)+list(job.announcements))
        self.assertTrue(sent[-1].startswith('tellraw @p {"rawtext":'))

    def test_java_wrapped_summons_require_strict_positive_feedback(self):
        classify=self.mc.response_outcome
        command='execute at @p run summon minecraft:zombie ~2 ~ ~ {CustomName:{text:"Ana"}}'
        self.assertEqual(classify(command,'Summoned new Zombie'), 'success')
        self.assertEqual(classify(command,'Summoned new Zombie\nextra'), 'unconfirmed')
        self.assertEqual(classify(command,'No entity was found'), 'rejected')

    def test_bedrock_zombie_quantity_uses_valid_legacy_execute_and_summon_order(self):
        from minecraft_presets import commands_for
        bedrock=commands_for('zombie','bedrock','Prueba',quantity=3)
        java=commands_for('zombie','java','Prueba',quantity=3)
        self.assertEqual(len(bedrock),3)
        self.assertEqual(bedrock,('execute @p ~ ~ ~ summon zombie "Prueba" ~2 ~ ~',)*3)
        self.assertEqual(len(java),3)
        self.assertTrue(all(command.startswith('execute at @p run summon minecraft:zombie ') for command in java))

    def test_running_owner_survives_stop_settings_and_stale_jobs(self):
        self.save(preset='zombie');self.gift();job=self.mc.jobs.get_nowait()
        entered,release=threading.Event(),threading.Event()
        def execute(command):entered.set();release.wait(2);return 'ok'
        with patch.object(self.mc,'execute',side_effect=execute),ThreadPoolExecutor(2) as pool:
            run=pool.submit(self.mc.run_job,job);self.assertTrue(entered.wait(1))
            try:
                self.now+=10
                self.client.post('/minecraft/presets/stop',json={'edition':'java'})
                self.assertTrue(self.mc.enqueue_preset('rain'))
                queued=self.mc.jobs.get_nowait()
                old=replace(job,admission_id=object())
                self.mc.run_job(old)
                self.assertIs(self.mc.preset_owner,queued.admission_id)
                body={'edition':'java','limits':{'interval':1,'per_minute':5},'name_format':'modern'}
                self.assertEqual(self.client.post('/minecraft/presets/settings',json=body).status_code,200)
                self.assertTrue(self.mc.enqueue_preset('rain'))
            finally:release.set()
            run.result(2)
        self.mc.run_job(queued)
        while not self.mc.jobs.empty():
            self.mc.run_job(self.mc.jobs.get_nowait())
        self.assertIsNone(self.mc.preset_owner)
        self.assertTrue(self.mc.enqueue_preset('rain'))

    def test_simulation_uses_all_rules_and_captures_two_donors_without_feed_mutation(self):
        self.save(preset='zombie')
        body={'edition':'java','gift_id':'1','user':'Ana'}
        self.assertEqual(self.client.post('/minecraft/presets/simulate',json={**body,'gift_id':'missing'}).get_json()['accepted'],False)
        self.assertTrue(self.mc.jobs.empty())
        self.mc.authorized=False
        self.assertEqual(self.client.post('/minecraft/presets/simulate',json=body).status_code,409)
        self.mc.authorized=True
        for user in ('Ana','Luis'):
            self.assertEqual(self.client.post('/minecraft/presets/simulate',json={**body,'user':user}).status_code,200)
            job=self.mc.jobs.get_nowait()
            self.assertEqual(job.donor,user)
            with patch.object(self.mc,'execute',return_value='ok') as execute:self.mc.run_job(job)
            self.assertIn(user,execute.call_args.args[0]);self.now+=3
        for extra in [{'commands':['op @a']},{'edition':'bedrock'},{'gift_id':True}]:
            self.assertIn(self.client.post('/minecraft/presets/simulate',json={**body,**extra}).status_code,(400,409))
        self.assertEqual(self.runtime.feed_session,'A')

    def test_budget_is_not_reset_by_stop_profile_switch_or_setting_saves(self):
        self.assertTrue(self.mc.enqueue_preset('tnt_rain'))
        with patch.object(self.mc,'execute',return_value='ok'):self.mc.run_job(self.mc.jobs.get_nowait())
        self.client.post('/minecraft/presets/stop',json={'edition':'java'})
        self.client.post('/minecraft/presets/settings',json={'edition':'java','limits':{'interval':1,'per_minute':5},'name_format':'modern'})
        self.now+=5;self.assertFalse(self.mc.enqueue_preset('rain'))
        self.client.post('/minecraft',json={'edition':'bedrock','select_only':True})
        self.mc.authorized=True;self.mc.authorized_generation=self.mc.bedrock.generation
        self.client.post('/minecraft/presets/settings',json={'edition':'bedrock','limits':{'interval':1,'per_minute':5},'name_format':'modern'})
        self.assertFalse(self.mc.enqueue_preset('rain'))
        self.now+=55;self.assertTrue(self.mc.enqueue_preset('rain'))

    def test_discarded_queue_jobs_do_not_leave_admission_permanently_busy(self):
        self.assertTrue(self.mc.enqueue_preset('rain'))
        abandoned=self.mc.jobs.get_nowait();self.mc.jobs.task_done()
        self.now+=3
        self.assertTrue(self.mc.enqueue_preset('rain'))
        owner=self.mc.preset_owner
        with patch.object(self.mc,'execute') as execute:self.mc.run_job(abandoned)
        execute.assert_not_called()
        self.assertIs(self.mc.preset_owner,owner)

    def test_minute_budget_waits_until_sixty_seconds_after_actual_completion(self):
        self.mc.config['limits']={'interval':3,'per_minute':5}
        self.assertTrue(self.mc.enqueue_preset('tnt_rain'))
        dispatched=[]
        def execute(command):
            dispatched.append(self.now)
            self.now+=1
            return 'ok'
        with patch.object(self.mc,'execute',side_effect=execute):
            self.mc.run_job(self.mc.jobs.get_nowait())
        self.assertEqual(dispatched,[1000,1001,1002,1003,1004])
        for instant in (1060,1064):
            self.now=instant
            self.assertFalse(self.mc.enqueue_preset('tnt_rain'))
            self.assertTrue(self.mc.jobs.empty())
        self.now=1065
        self.assertTrue(self.mc.enqueue_preset('tnt_rain'))

    def test_failed_cancelled_and_drained_activations_keep_full_reservation(self):
        for ending in ('failure','cancel','drain'):
            with self.subTest(ending=ending):
                self.setUp();self.mc.config['limits']={'interval':3,'per_minute':5}
                self.assertTrue(self.mc.enqueue_preset('tnt_rain'))
                job=self.mc.jobs.get_nowait()
                self.now=1004
                if ending=='drain':
                    self.mc.jobs.task_done()
                else:
                    if ending=='cancel':self.mc.preset_generation+=1
                    with patch.object(self.mc,'execute',side_effect=OSError):self.mc.run_job(job)
                # Recovery detects a drained pending reservation at this instant.
                self.assertFalse(self.mc.enqueue_preset('tnt_rain'))
                self.now=1060
                self.assertFalse(self.mc.enqueue_preset('tnt_rain'))
                self.now=1064
                self.assertTrue(self.mc.enqueue_preset('tnt_rain'))

    def test_quantity_migration_validation_and_old_mapping_posts_preserve_numbers(self):
        from minecraft_presets import mappings
        rows=mappings()
        self.assertEqual(rows['tnt_rain']['quantity'],5)
        self.assertEqual(rows['zombie']['quantity'],1)
        self.assertFalse(rows['chicken']['enabled'])
        body={'edition':'java','presets':{'zombie':{'gift_id':'1','enabled':True,'quantity':2}}}
        self.assertEqual(self.client.post('/minecraft/presets',json=body).status_code,200)
        self.save(preset='zombie')
        self.assertEqual(self.mc.config['presets']['zombie']['quantity'],2)
        self.save(preset='rain')
        self.assertEqual(self.mc.config['presets']['zombie']['quantity'],2)
        self.client.post('/minecraft',json={'commands':{},'presets':{'rain':{'enabled':False}}})
        self.assertEqual(self.mc.config['presets']['zombie']['quantity'],2)
        self.client.post('/minecraft',json={'edition':'bedrock','select_only':True})
        self.assertEqual(self.client.get('/minecraft').get_json()['presets']['zombie']['quantity'],1)
        self.client.post('/minecraft',json={'edition':'java','select_only':True})
        self.assertEqual(self.client.get('/minecraft').get_json()['presets']['zombie']['quantity'],2)
        for value in (True,False,0,21,2.0,'2',None):
            body['presets']['zombie']['quantity']=value
            self.assertEqual(self.client.post('/minecraft/presets',json=body).status_code,400)
        self.assertEqual(self.client.post('/minecraft/presets',json={'edition':'java','presets':{'rain':{'quantity':2}}}).status_code,400)

    def test_spawn_quantity_multiplies_only_final_gift_count_and_is_cost_first(self):
        rules={key:{'gift_id':'1','enabled':True,'quantity':2} for key in ('zombie','tnt_rain')}
        rules['rain']={'gift_id':'1','enabled':True}
        self.assertEqual(self.client.post('/minecraft/presets',json={'edition':'java','presets':rules}).status_code,200)
        self.gift(count=3,ongoing=True);self.assertTrue(self.mc.jobs.empty())
        self.gift(count=3);self.gift(count=3)
        job=self.mc.jobs.get_nowait()
        self.assertEqual(len(job.commands),13)
        self.assertEqual(job.gift_count,3)
        self.assertEqual(dict(job.quantities),{'tnt_rain':2,'zombie':2,'rain':1})
        self.assertEqual(sum('summon minecraft:zombie' in command for command in job.commands),6)
        self.assertEqual(sum('summon minecraft:tnt' in command for command in job.commands),6)
        self.assertEqual(job.commands.count('weather rain'),1)
        with patch.object(self.mc,'execute',return_value='ok'):self.mc.run_job(job)
        self.now+=3
        with patch('minecraft_connector.commands_for') as build:
            self.gift('oversize',count=10**100)
            self.assertTrue(self.mc.jobs.empty());build.assert_not_called()
        with patch('minecraft_connector.commands_for') as build:
            self.assertFalse(self.mc.admit_presets(('rain',),'Ana',gift_count=10**100))
            build.assert_not_called()
        for index,value in enumerate((True,False,0,-1,1.5,'3',None)):
            with patch('minecraft_connector.commands_for') as build:
                self.gift('bad-count'+str(index),count=value)
                self.assertTrue(self.mc.jobs.empty());build.assert_not_called()

    def test_all_allowlisted_mobs_use_literal_name_codecs_and_exact_quantities(self):
        from minecraft_presets import commands_for
        for mob in ('zombie','skeleton','creeper','spider','pig','cow','sheep','chicken'):
            for edition,style in (('java','modern'),('java','legacy'),('bedrock','modern')):
                with self.subTest(mob=mob,edition=edition,style=style):
                    sequence=commands_for(mob,edition,'Ana',style,quantity=2)
                    self.assertEqual(len(sequence),2)
                    self.assertTrue(all(('summon '+mob if edition=='bedrock' else 'minecraft:'+mob) in command and 'Ana' in command for command in sequence))
                    if edition=='bedrock':self.assertIn('"Ana" ~2 ~ ~',sequence[0])
                    elif style=='modern':self.assertIn('CustomName:{text:"Ana"}',sequence[0])
                    else:self.assertIn('CustomName:',sequence[0])
        for quantity in (1,5,20):
            sequence=commands_for('tnt_rain','bedrock',quantity=quantity)
            self.assertEqual(len(sequence),quantity)
            self.assertTrue(all(command.startswith('execute @p ~ ~ ~ summon tnt ') for command in sequence))

    def test_manual_tests_use_saved_quantity_when_disabled_and_simulation_uses_one_gift(self):
        body={'edition':'java','presets':{'pig':{'gift_id':'1','gift_name':'Rose','enabled':False,'quantity':3}}}
        self.assertEqual(self.client.post('/minecraft/presets',json=body).status_code,200)
        self.assertEqual(self.client.post('/minecraft/presets/test',json={'edition':'java','id':'pig'}).status_code,200)
        job=self.mc.jobs.get_nowait();self.assertEqual(len(job.commands),3)
        self.assertEqual(job.gift_count,1)
        with patch.object(self.mc,'execute',return_value='ok'):self.mc.run_job(job)
        self.now+=3
        self.save(preset='pig')
        response=self.client.post('/minecraft/presets/simulate',json={'edition':'java','gift_id':'1','user':'Ana'})
        self.assertEqual(response.status_code,200)
        job=self.mc.jobs.get_nowait();self.assertEqual(len(job.commands),3)
        self.assertTrue(all('Ana' in command for command in job.commands))

    def test_complete_catalog_categories_aliases_and_old_profile_migration(self):
        from minecraft_presets import catalog, categories, commands_for, mappings
        approved=set("""bee armadillo horse donkey mule camel rabbit cat wolf fox ocelot panda polar_bear goat llama trader_llama mooshroom parrot bat sniffer
        axolotl frog tadpole turtle dolphin squid glow_squid cod salmon tropical_fish pufferfish nautilus
        villager wandering_trader allay iron_golem snow_golem copper_golem
        drowned husk zombie_villager zombie_horse camel_husk zombie_nautilus stray bogged parched skeleton_horse
        cave_spider slime silverfish phantom witch pillager vindicator evoker vex ravager breeze creaking sulfur_cube guardian elder_guardian
        blaze ghast happy_ghast magma_cube hoglin zoglin piglin piglin_brute zombified_piglin wither_skeleton strider
        enderman endermite shulker warden wither ender_dragon""".split())
        existing={'zombie','skeleton','creeper','spider','pig','cow','sheep','chicken'}
        actions={'tnt_rain','rain','thunder','night','diamonds','speed','jump','heal'}
        rows=catalog();ids=[row['id'] for row in rows]
        self.assertEqual(set(ids),approved|existing|actions)
        self.assertEqual(len(ids),96);self.assertEqual(len(ids),len(set(ids)))
        self.assertEqual({row['id'] for row in categories()}, {'actions','animals','aquatic','helpers','undead','hostile','nether','end','bosses'})
        self.assertTrue(all(row['category'] in {c['id'] for c in categories()} for row in rows))
        old={key:{'gift_id':'saved-'+key,'gift_name':'Saved '+key,'enabled':True,
                  **({'quantity':7 if key=='tnt_rain' else 2} if key in existing|{'tnt_rain'} else {})}
             for key in existing|actions}
        restored=mappings(old)
        for key,value in old.items():self.assertEqual(restored[key],value)
        self.assertEqual(restored['zombie']['quantity'],2)
        self.assertTrue(all(not restored[key]['enabled'] and restored[key]['quantity']==1 for key in approved))
        for canonical,bedrock in [('evoker','evocation_illager'),('zombified_piglin','zombie_pigman'),('tropical_fish','tropicalfish'),('villager','villager'),('zombie_villager','zombie_villager')]:
            self.assertIn('summon '+bedrock+' "Ana" ~2',commands_for(canonical,'bedrock','Ana')[0])
            self.assertIn('minecraft:'+canonical+' ~2',commands_for(canonical,'java','Ana')[0])

    def test_public_fallback_matches_backend_and_cross_category_admission_remains_atomic(self):
        import json,re
        from minecraft_presets import catalog
        source=Path('web/static/minecraft.js').read_text(encoding='utf-8')
        fallback=json.loads(re.search(r'const defaultActions=(\[.*?\]);',source,re.S).group(1))
        expected={row['id']:(row['name'],row['category'],row.get('quantity_default'),row['section']) for row in catalog()}
        self.assertEqual({row['id']:(row['name'],row['category'],row.get('quantity'),row['section']) for row in fallback},expected)
        rules={key:{'gift_id':'1','enabled':True,'quantity':2} for key in ('cow','warden','evoker')}
        self.assertEqual(self.client.post('/minecraft/presets',json={'edition':'java','presets':rules}).status_code,200)
        self.gift(count=3);job=self.mc.jobs.get_nowait();self.assertEqual(len(job.commands),18)
        self.assertEqual(set(job.selected_ids),set(rules))
        self.client.post('/minecraft/presets/stop',json={'edition':'java'})
        with patch.object(self.mc,'execute') as execute:self.mc.run_job(job)
        execute.assert_not_called();self.now+=3
        with patch('minecraft_connector.commands_for') as build:
            self.gift('over-budget',count=4)
            build.assert_not_called();self.assertTrue(self.mc.jobs.empty())
        self.now+=60
        response=self.client.post('/minecraft/presets/simulate',json={'edition':'java','gift_id':'1','user':'Ana'})
        self.assertEqual(response.status_code,200)
        job=self.mc.jobs.get_nowait();self.assertEqual(len(job.commands),6)
        self.assertEqual(set(job.selected_ids),set(rules))

    def test_every_mob_template_supports_both_editions_and_three_literal_name_formats(self):
        from minecraft_presets import catalog, commands_for
        aliases={'evoker':'evocation_illager','zombified_piglin':'zombie_pigman','tropical_fish':'tropicalfish'}
        for row in catalog():
            if row['id']=='tnt_rain' or 'quantity_default' not in row:continue
            for edition,style in (('bedrock','modern'),('java','modern'),('java','legacy')):
                with self.subTest(mob=row['id'],edition=edition,style=style):
                    commands=commands_for(row['id'],edition,'Johnny',style,quantity=2)
                    entity=aliases.get(row['id'],row['id']) if edition=='bedrock' else row['id']
                    self.assertEqual(len(commands),2)
                    prefix=('execute @p ~ ~ ~ summon '+entity+' ' if edition=='bedrock'
                            else 'execute at @p run summon minecraft:'+entity+' ')
                    self.assertTrue(all(command.startswith(prefix) for command in commands))
                    self.assertTrue(all('Johnny' in command and '\n' not in command for command in commands))
                    if edition=='java':self.assertIn('CustomNameVisible:1b',commands[0])
                    else:self.assertIn('"Johnny" ~2 ~ ~',commands[0])

    def test_sections_reorganize_metadata_without_rewriting_profile_settings(self):
        import copy
        from minecraft_presets import catalog, sections
        expected={'environment':{'tnt_rain','rain','thunder','night'},'abilities':{'speed','jump','heal'},'items':{'diamonds'}}
        rows=catalog()
        self.assertEqual({row['id'] for row in sections()},{'environment','abilities','items','mobs'})
        for section,ids in expected.items():self.assertEqual({row['id'] for row in rows if row['section']==section},ids)
        self.assertEqual(len([row for row in rows if row['section']=='mobs']),88)
        self.save(preset='zombie');self.mc.config['presets']['zombie']['quantity']=2
        before=copy.deepcopy(self.mc.profiles)
        snapshot=self.client.get('/minecraft').get_json()
        self.assertEqual(self.mc.profiles,before)
        self.assertEqual(snapshot['presets']['zombie']['quantity'],2)
        self.assertEqual(snapshot['preset_sections'],sections())
        rules={key:{'gift_id':'all','enabled':True,**({'quantity':1} if key in ('tnt_rain','cow') else {})}
               for key in ('tnt_rain','speed','diamonds','cow')}
        self.client.post('/minecraft/presets',json={'edition':'java','presets':rules})
        result=self.client.post('/minecraft/presets/simulate',json={'edition':'java','gift_id':'all','user':'Ana'})
        self.assertEqual(result.status_code,200)
        self.assertEqual(set(self.mc.jobs.get_nowait().selected_ids),set(rules))

    def test_catalog_defaults_and_validated_local_only_mapping_updates(self):
        snapshot=self.client.get('/minecraft').get_json()
        self.assertEqual(len(snapshot['preset_catalog']),96)
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
        self.save();self.gift(ongoing=True,count=1);self.assertTrue(self.mc.jobs.empty())
        self.gift(count=1);self.gift(count=2);self.assertEqual(self.mc.jobs.qsize(),1)
        self.gift('different-id',gift_id='2');self.assertEqual(self.mc.jobs.qsize(),1)
        with patch.object(self.mc,'execute',return_value='ok'):self.mc.run_job(self.mc.jobs.get_nowait())
        self.now+=3
        self.runtime.feed_session='B';self.gift();self.assertEqual(self.mc.jobs.qsize(),1)
        self.save(False);self.gift('disabled');self.save(True);self.gift('disabled')
        self.assertEqual(self.mc.jobs.qsize(),1,'enabling must not replay a previously observed gift')
        self.mc.authorized=False;self.gift('unauthorized');self.mc.authorized=True;self.gift('unauthorized')
        self.assertEqual(self.mc.jobs.qsize(),1)

    def test_default_five_tnt_commands_remain_atomic_and_reject_oversized_streaks(self):
        self.save();self.gift(count=1000000);self.assertTrue(self.mc.jobs.empty())
        self.gift('bounded',count=1);self.assertEqual(self.mc.jobs.qsize(),1)
        job=self.mc.jobs.get_nowait()
        with patch.object(self.mc,'execute',return_value='custom feedback') as execute:
            self.mc.run_job(job)
        self.assertEqual(execute.call_count,5)
        self.assertEqual(len({call.args[0] for call in execute.call_args_list}),5)
        self.assertTrue(all(row['outcome']=='unconfirmed' for row in self.mc.log[:5]))
        self.assertEqual(self.mc.log[5]['outcome'],'cancelled')
        self.now+=3
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
        self.now+=3
        self.gift('next');job=self.mc.jobs.get_nowait()
        with patch.object(self.mc,'execute',return_value='Unknown command') as execute:self.mc.run_job(job)
        self.assertEqual(execute.call_count,1)
        self.now+=3
        self.gift('expired');job=self.mc.jobs.get_nowait()
        with patch.object(self.mc,'execute',return_value='ok') as execute, \
                patch('minecraft_connector.time.sleep'):
            self.mc.run_job(replace(job,created=time.monotonic()-11))
        execute.assert_called()

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
        self.assertEqual([call.args[0] for call in execute.call_args_list],
                         ['effect @p speed 20 1','tellraw @p {"rawtext":[{"text":"Prueba te envió Velocidad II"}]}'])
        self.assertTrue(all(call.kwargs['expected_generation']==self.mc.authorized_generation
                            for call in execute.call_args_list))

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
        self.save(preset='zombie');event=S(user=S(unique_id='sender'),gift=S(id=1,name='Rose',type=1,diamond_count=1),
                            gift_id=1,repeat_count=5,repeat_end=False)
        env['handle_gift_event'](event,update_catalog=False);self.assertTrue(self.mc.jobs.empty())
        event.repeat_end=True;env['handle_gift_event'](event,update_catalog=False)
        env['handle_gift_event'](event,update_catalog=False)
        self.assertEqual(self.mc.jobs.qsize(),1)
        self.assertEqual(env['state']['gift_count'],5)


if __name__=='__main__':unittest.main()
