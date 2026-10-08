import unittest
from unittest.mock import patch, Mock
from types import SimpleNamespace
import server

class InteractiveTests(unittest.TestCase):
    def setUp(self):
        self.i=server.interactive;self.client=server.app.test_client()
        self.i.pending.clear();self.i.poll=None;self.i.usage.clear();self.i.audio_owner=None;self.i.audio_until=0;self.i.rules=[];self.i.seen.clear();self.i.last.clear();self.i.effects.clear();self.i.external=False
        self.i.remaining=0;self.i.running=False
        self.i.overlay_games['wheel'].update(options=['A','B','C','D'],angle=0,spin_start_angle=0,spin_delta=0,spinning=False,turns=5,duration=4.8,winner='',winner_index=-1)
        self.production=patch.dict(server.production.settings,emergency=False,scene='talk');self.production.start()
    def tearDown(self):self.i.rules=[];self.production.stop()
    def rule(self,**kw):
        return self.i.validate(dict(name='Test',event='gift',action='timer',amount=20,cooldown=1,enabled=True,**kw))
    def test_dedupe_cooldown_and_timer_limit(self):
        self.i.rules=[self.rule()];self.i.event('gift',{},'a');self.i.event('gift',{},'a');self.i.event('gift',{},'b')
        self.assertEqual(self.i.remaining,20)
        self.i.last.clear();self.i.remaining=86399;self.i.event('gift',{},'c');self.assertEqual(self.i.remaining,86400)
    def test_emergency_blocks_rules(self):
        self.i.rules=[self.rule()]
        with patch.dict(server.production.settings,emergency=True):self.i.event('gift',{},'panic')
        self.assertEqual(self.i.remaining,0)
    def test_audio_takeover_requires_confirmation_and_displaces_old_owner(self):
        def lease(**data):return self.client.post('/interactivity/audio-lease',json=data)
        self.assertTrue(lease(tab='old').get_json()['owner'])
        self.assertFalse(lease(tab='new').get_json()['owner'])
        self.assertEqual(lease(tab='new',takeover=True).status_code,400)
        self.assertTrue(lease(tab='new',takeover=True,confirmation='USAR AUDIO AQUI').get_json()['owner'])
        self.assertFalse(lease(tab='old').get_json()['owner'])
        self.assertTrue(lease(tab='new').get_json()['owner'])
    def test_remote_and_origin_protected(self):
        self.assertEqual(self.client.get('/interactivity',environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)
        self.assertEqual(self.client.post('/interactivity',json={'rules':[]},headers={'Origin':'https://evil.example'}).status_code,403)
    def test_validation_and_connector_consent(self):
        self.assertEqual(self.client.post('/interactivity',json={'rules':[{'event':'gift','action':'shell'}]}).status_code,400)
        self.assertEqual(self.client.post('/interactivity/connector',json={'enabled':True}).status_code,400)
        self.assertFalse(self.i.external)
        self.assertEqual(self.client.post('/interactivity/timer',json={'action':'set','seconds':'bad'}).status_code,400)
    def test_external_disabled_does_not_queue(self):
        self.i.rules=[self.i.validate(dict(name='external',event='gift',action='streamerbot',value='4af4bdef-f396-521f-a1a5-02983ae638cb',enabled=True))]
        self.i.event('gift',{},'x');self.assertTrue(self.i.jobs.empty())
    def test_filter_and_effect(self):
        self.i.rules=[self.i.validate(dict(name='hello',event='comment',action='animation',match='!hola',value='Hola',enabled=True))]
        self.i.event('comment',{'comment':'normal'},'1');self.assertEqual(len(self.i.effects),0)
        self.i.event('comment',{'comment':'!hola'},'2');self.assertEqual(self.i.effects[-1]['value'],'Hola')

    def test_simulation_has_no_side_effects(self):
        self.i.rules=[self.rule()]
        before=(self.i.remaining,len(self.i.effects),len(self.i.seen))
        data=self.client.post('/interactivity/simulate',json={'event':'gift','user':'Alice'}).get_json()
        self.assertTrue(data['dry_run']);self.assertEqual(data['results'][0]['result'],'Coincide')
        self.assertEqual(before,(self.i.remaining,len(self.i.effects),len(self.i.seen)))
        self.assertEqual(self.i.usage,{})

    def test_user_limit_and_budget(self):
        r=self.rule();r.update(user_limit=1,budget=2);self.i.rules=[r]
        for eid,user in [('1','@Alice'),('2','alice'),('3','bob'),('4','charlie')]:
            self.i.last.clear();self.i.event('gift',{'user':user},eid)
        self.assertEqual(self.i.remaining,40)

    def test_sequence_dispatch_order(self):
        r=self.i.validate(dict(name='sequence',event='gift',action='animation',value='first',enabled=True,
             steps=[{'action':'animation','value':'second'},{'action':'timer','amount':5}]))
        self.i.rules=[r];self.i.event('gift',{},'sequence')
        self.assertEqual([e['value'] for e in self.i.effects],['first','second'])
        self.assertEqual(self.i.remaining,5)

    def test_import_disabled_and_atomic(self):
        r=self.rule();self.i.rules=[r]
        response=self.client.post('/interactivity/import',json={'version':1,'rules':[r]})
        self.assertEqual(response.status_code,200)
        self.assertFalse(self.i.rules[-1]['enabled']);self.assertNotEqual(self.i.rules[0]['id'],self.i.rules[1]['id'])
        response=self.client.post('/interactivity/import',json={'version':1,'rules':[r,{'event':'bad'}]})
        self.assertEqual(response.status_code,400);self.assertEqual(len(self.i.rules),2)

    def test_audio_exclusive_and_expiry(self):
        def claim(tab):return self.client.post('/interactivity/audio-lease',json={'tab':tab}).get_json()['owner']
        self.assertTrue(claim('a'));self.assertFalse(claim('b'))
        self.i.audio_until=0;self.assertTrue(claim('b'));self.assertFalse(claim('a'))

    def test_media_delete_protects_references(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as folder, patch.object(self.i,'folder',Path(folder)):
            name='a'*32+'.wav';(Path(folder)/name).write_bytes(b'test')
            self.i.rules=[self.i.validate(dict(event='gift',action='sound',value=name))]
            self.assertEqual(self.client.delete('/interactivity/media/'+name).status_code,409)
            self.i.rules=[]
            self.assertEqual(self.client.delete('/interactivity/media/'+name).status_code,200)
            self.assertFalse((Path(folder)/name).exists())

    def test_delayed_step_and_emergency_cancel(self):
        import time
        self.i.rules=[self.i.validate(dict(name='delayed',event='gift',action='timer',amount=1,enabled=True,
            steps=[dict(action='timer',amount=5,delay=60)]))]
        self.i.event('gift',{},'delayed');self.assertEqual(self.i.remaining,1);self.assertEqual(len(self.i.pending),1)
        due=list(self.i.pending[0]);due[0]=time.monotonic()-1;self.i.pending=[tuple(due)];self.i.run_due()
        self.assertEqual(self.i.remaining,6)
        self.i.last.clear();self.i.event('gift',{},'second')
        with patch.dict(server.production.settings,emergency=True):self.i.run_due()
        self.assertEqual(self.i.pending,[])

    def test_poll_one_vote_per_user(self):
        self.assertEqual(self.client.post('/interactivity/poll',json={'action':'start','question':'Test','options':['A','B']}).status_code,200)
        for eid,user,comment in [('1','@Alice','1'),('2','alice','2'),('3','bob','2'),('4','','1')]:
            self.i.event('comment',{'user':user,'comment':comment},eid)
        self.assertEqual(self.i.poll_snapshot()['counts'],[1,1])
        self.assertNotIn('voters',self.i.poll_snapshot())
        self.client.post('/interactivity/poll',json={'action':'stop'})
        self.i.event('comment',{'user':'new','comment':'1'},'5')
        self.assertEqual(self.i.poll_snapshot()['counts'],[1,1])

    def test_random_audio_reference_blocks_delete(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as folder,patch.object(self.i,'folder',Path(folder)):
            name='b'*32+'.wav';(Path(folder)/name).write_bytes(b'test')
            self.i.rules=[self.i.validate(dict(event='gift',action='random_sound',value=name))]
            self.assertEqual(self.client.delete('/interactivity/media/'+name).status_code,409)

    def test_wheel_uses_exact_configured_full_turns_and_lands_on_winner(self):
        response=self.client.post('/interactivity/overlays',json={'game':'wheel','action':'configure','options':['A','B','C','D'],'turns':7,'duration':3,'title':'Test','show_result':True})
        self.assertEqual(response.status_code,200)
        with patch('interactivity.random.randrange',return_value=2):
            wheel=self.client.post('/interactivity/overlays',json={'game':'wheel','action':'spin'}).get_json()['wheel']
        self.assertEqual(wheel['spin_start_angle'],0)
        self.assertGreaterEqual(wheel['spin_delta'],7*360)
        self.assertLess(wheel['spin_delta'],8*360)
        self.assertAlmostEqual((wheel['angle']+(2.5*90))%360,0)
        self.assertEqual(wheel['winner'],'C')

    def test_wheel_rejects_fractional_turns_and_a_second_active_spin(self):
        bad=self.client.post('/interactivity/overlays',json={'game':'wheel','action':'configure','turns':3.5})
        self.assertEqual(bad.status_code,400)
        self.assertEqual(self.client.post('/interactivity/overlays',json={'game':'wheel','action':'spin'}).status_code,200)
        self.assertEqual(self.client.post('/interactivity/overlays',json={'game':'wheel','action':'spin'}).status_code,400)

    def test_drop_launch_deposits_score_and_uses_piggy_bank_slot(self):
        self.client.post('/interactivity/overlays',json={'game':'drop','action':'reset'})
        with patch('interactivity.random.randint',side_effect=[12,540]):
            drop=self.client.post('/interactivity/overlays',json={'game':'drop','action':'launch'}).get_json()['drop']
        self.assertEqual(drop['score'],1)
        self.assertEqual(drop['event']['drift'],12)
        self.assertEqual(drop['event']['rotation'],540)
        self.assertNotIn('value',drop['event'])
        self.assertEqual(drop['event']['gift'],'Rose')
        self.assertIn('image_url',drop['event'])
        self.assertNotIn('values',drop)
        self.assertNotIn('coin_symbol',drop)

    def test_drop_rule_preserves_tiktok_gift_image_through_delay(self):
        rule=self.i.validate(dict(name='Gift bank',event='gift',action='drop',enabled=True,delay=1))
        self.i.rules=[rule]
        record={'gift':'Galaxy','gift_id':'42','image_url':'https://example.com/tiktok-galaxy.webp','user':'Alice'}
        self.i.event('gift',record,'gift-image')
        self.assertEqual(len(self.i.pending),1)
        step=self.i.pending[0][4]
        self.i.dispatch(step,rule['name'])
        event=self.i.overlay_games['drop']['event']
        for key in ('gift','gift_id','image_url'):self.assertEqual(event[key],record[key])

    def test_manual_rose_uses_tiktok_catalog_image(self):
        with patch.dict(server.gift_catalog,{'5655':{'id':'5655','name':'Rose','image_url':'https://example.com/rose.webp'}},clear=True):
            self.i.overlay_action('drop','launch')
        self.assertEqual(self.i.overlay_games['drop']['event']['image_url'],'https://example.com/rose.webp')

    def test_bank_selection_is_validated_and_published(self):
        for bank in ('cochito','cochita','pato','oso','perro','gato'):
            response=self.client.post('/interactivity/overlays',json={'game':'drop','action':'configure','bank':bank})
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.get_json()['drop']['bank'],bank)
            self.assertEqual(self.client.get('/broadcast/overlay-games').get_json()['drop']['bank'],bank)
        bad=self.client.post('/interactivity/overlays',json={'game':'drop','action':'configure','bank':'../unknown'})
        self.assertEqual(bad.status_code,400)
        self.assertEqual(self.i.overlay_games['drop']['bank'],'gato')

    def test_custom_bank_transform_is_validated_and_persisted(self):
        original_archive=self.i.r.archive
        saved_settings={}
        archive=SimpleNamespace(settings=lambda:saved_settings,set_setting=lambda key,value:saved_settings.__setitem__(key,value))
        self.i.r.archive=archive
        self.addCleanup(setattr,self.i.r,'archive',original_archive)
        asset_id='a'*32+'.png'
        custom={'x':12.5,'y':77.25}
        entry={'x':43.5,'y':18.25}
        response=self.client.post('/interactivity/overlays',json={
            'game':'drop','action':'configure','bank':'custom','custom_bank_asset':asset_id,
            'bank_position':custom,'bank_scale':125,'entry_point':entry,
        })
        self.assertEqual(response.status_code,200,response.get_json())
        state=response.get_json()['drop']
        self.assertEqual(state['bank'],'custom')
        self.assertEqual(state['custom_bank_asset'],asset_id)
        self.assertEqual(state['bank_position'],custom)
        self.assertEqual(state['bank_scale'],125)
        self.assertEqual(state['entry_point'],entry)
        saved=archive.settings()['interactive_overlay_games']['drop']
        for key in ('custom_bank_asset','bank_position','bank_scale','bank_scales','entry_point'):
            self.assertEqual(saved[key],state[key])
        for key,value in (('bank_position',{'x':float('nan'),'y':50}),
                          ('entry_point',{'x':50,'y':101}),('bank_scale',201),
                          ('custom_bank_asset','../../secret.png')):
            invalid=self.client.post('/interactivity/overlays',json={
                'game':'drop','action':'configure',key:value,
            })
            self.assertEqual(invalid.status_code,400,(key,invalid.get_json()))

    def test_custom_bank_position_and_cavity_saves_compose_across_reload_in_either_order(self):
        import bank_storage
        from copy import deepcopy
        class MemoryArchive:
            def __init__(self): self.values={}
            def settings(self): return deepcopy(self.values)
            def set_setting(self,key,value): self.values[key]=deepcopy(value)
        previous_archive=self.i.r.archive
        archive=MemoryArchive();self.i.r.archive=archive
        self.addCleanup(setattr,self.i.r,'archive',previous_archive)
        asset_id='b'*32+'.png'
        position={'x':35.0,'y':62.0};entry={'x':43.0,'y':18.0};scale=85.0
        shape={'points':[[10,10],[30,10],[70,10],[90,30],[90,70],[10,70]],'slot':[43,18]}
        orders=(('configure','shape'),('shape','configure'))
        for first,second in orders:
            if first=='configure':
                config={'game':'drop','action':'configure','bank':'custom','custom_bank_asset':asset_id,
                        'bank_position':position,'bank_scale':scale,'entry_point':entry}
                cavity={'game':'drop','action':'shape','bank':'custom','shape':shape,'custom_bank_asset':asset_id,
                        'bank_position':position,'bank_scale':scale,'entry_point':entry}
            else:
                config={'game':'drop','action':'configure','bank':'custom','custom_bank_asset':asset_id,
                        'bank_position':position,'bank_scale':scale,'entry_point':entry}
                cavity={'game':'drop','action':'shape','bank':'custom','shape':shape,'custom_bank_asset':asset_id,
                        'bank_position':position,'bank_scale':scale,'entry_point':entry}
            self.assertEqual(self.client.post('/interactivity/overlays',json=(config if first=='configure' else cavity)).status_code,200)
            self.assertEqual(self.client.post('/interactivity/overlays',json=(cavity if second=='shape' else config)).status_code,200)
            saved=archive.settings()
            persisted=saved['interactive_overlay_games']['drop']
            self.assertEqual(persisted['bank'],'custom')
            self.assertEqual(persisted['custom_bank_asset'],asset_id)
            self.assertEqual(persisted['bank_position'],position)
            self.assertEqual(persisted['bank_scale'],scale)
            self.assertEqual(persisted['entry_point'],entry)
            self.i.overlay_games['drop'].update(bank='cochito',custom_bank_asset=None,
                bank_position={'x':50.0,'y':50.0},bank_scale=100.0,entry_point={'x':50.0,'y':16.0},shapes={})
            self.i.restore_overlays()
            bank_storage.restore(self.i.r,self.i.overlay_games['drop'])
            restored=self.i.overlay_games['drop']
            self.assertEqual(restored['bank'],'custom')
            self.assertEqual(restored['custom_bank_asset'],asset_id)
            self.assertEqual(restored['bank_position'],position)
            self.assertEqual(restored['bank_scale'],scale)
            self.assertEqual(restored['entry_point'],entry)
            self.assertEqual(restored['shapes']['custom'],shape)

    def test_custom_cavity_save_persists_the_carried_image_transform(self):
        import bank_storage
        from copy import deepcopy
        class MemoryArchive:
            def __init__(self): self.values={}
            def settings(self): return deepcopy(self.values)
            def set_setting(self,key,value): self.values[key]=deepcopy(value)
        previous_archive=self.i.r.archive
        archive=MemoryArchive();self.i.r.archive=archive
        self.addCleanup(setattr,self.i.r,'archive',previous_archive)
        asset_id='c'*32+'.png';position={'x':35.0,'y':62.0};entry={'x':43.0,'y':18.0};scale=85.0
        shape={'points':[[10,10],[30,10],[70,10],[90,30],[90,70],[10,70]],'slot':[43,18]}
        state=self.i.overlay_games['drop']
        state.update(bank='custom',custom_bank_asset=None,bank_position={'x':50.0,'y':50.0},
                     bank_scale=100.0,entry_point={'x':50.0,'y':16.0},shapes={})
        response=self.client.post('/interactivity/overlays',json={
            'game':'drop','action':'shape','bank':'custom','shape':shape,'custom_bank_asset':asset_id,
            'bank_position':position,'bank_scale':scale,'entry_point':entry,
        })
        self.assertEqual(response.status_code,200,response.get_json())
        saved=archive.settings()['interactive_overlay_games']['drop']
        self.assertEqual(saved['bank'],'custom')
        self.assertEqual(saved['custom_bank_asset'],asset_id)
        self.assertEqual(saved['bank_position'],position)
        self.assertEqual(saved['bank_scale'],scale)
        self.assertEqual(saved['entry_point'],entry)
        state.update(custom_bank_asset=None,bank_position={'x':50.0,'y':50.0},
                     bank_scale=100.0,entry_point={'x':50.0,'y':16.0},shapes={})
        self.i.restore_overlays();bank_storage.restore(self.i.r,state)
        self.assertEqual(state['bank'],'custom')
        self.assertEqual(state['custom_bank_asset'],asset_id)
        self.assertEqual(state['bank_position'],position)
        self.assertEqual(state['bank_scale'],scale)
        self.assertEqual(state['entry_point'],entry)
        self.assertEqual(state['shapes']['custom'],shape)

    def test_legacy_drop_settings_receive_custom_bank_defaults(self):
        archive=SimpleNamespace(settings=Mock(return_value={
            'interactive_overlay_games':{'drop':{'bank':'pato','size':72,'bank_scale':137}},
        }))
        self.i.overlay_games['drop'].update(bank='cochito',custom_bank_asset=None,
            bank_position={'x':50.0,'y':50.0},bank_scale=100.0,
            bank_scales={key:100.0 for key in ('cochito','cochita','pato','oso','perro','gato','custom')},
            entry_point={'x':50.0,'y':16.0})
        with patch.object(self.i.r,'archive',archive):
            self.i.restore_overlays()
        state=self.i.overlay_games['drop']
        self.assertEqual(state['bank'],'pato')
        self.assertIsNone(state['custom_bank_asset'])
        self.assertEqual(state['bank_position'],{'x':50.0,'y':50.0})
        self.assertEqual(state['bank_scale'],137.0)
        self.assertEqual(state['bank_scales']['pato'],137.0)
        self.assertEqual(state['bank_scales']['cochito'],100.0)
        self.assertEqual(state['entry_point'],{'x':50.0,'y':16.0})

if __name__=='__main__':unittest.main()
