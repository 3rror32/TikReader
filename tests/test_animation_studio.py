import io
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from flask import Flask
from history_store import HistoryStore
from production import Production
from animation_studio import AnimationStudio


class AnimationStudioTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.app=Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates'))
        self.runtime=SimpleNamespace(archive=HistoryStore(Path(self.tmp.name)/'history.sqlite3'),feed_session='session-a',feed_lock=threading.RLock(),state={'connected':False})
        self.runtime.production=Production(self.app,self.runtime)
        self.studio=AnimationStudio(self.app,self.runtime)
        self.studio.folder=Path(self.tmp.name)/'media'
        self.client=self.app.test_client()

    def template(self,**extra):
        return {**dict(name='Gracias',text='Gracias {usuario}: {regalo} ×{cantidad}',gift='Rose',amount=2,enabled=True),**extra}

    def save(self,**extra):
        response=self.client.post('/animation-studio',json=self.template(**extra))
        self.assertEqual(response.status_code,200)
        return response.get_json()['templates'][-1]

    def test_save_validates_and_restores_disabled(self):
        saved=self.save(enter_animation='bounce',idle_animation='glow',exit_animation='shrink')
        self.assertEqual((saved['enter_animation'],saved['idle_animation'],saved['exit_animation']),('bounce','glow','shrink'))
        self.studio.restore()
        self.assertEqual(len(self.studio.templates),1)
        self.assertFalse(self.studio.templates[0]['enabled'])
        for payload in [self.template(color='red'),self.template(asset='../secret'),self.template(size=500),self.template(animation='script'),self.template(duration='bad')]:
            self.assertEqual(self.client.post('/animation-studio',json=payload).status_code,400)
        for key in ('enter_animation','idle_animation','exit_animation'):
            self.assertEqual(self.client.post('/animation-studio',json=self.template(**{key:'script'})).status_code,400)

    def test_legacy_slide_animation_is_migrated(self):
        saved=self.save(animation='slide')
        self.assertEqual(saved['enter_animation'],'slide-up')

    def test_gift_threshold_exact_name_and_once_per_streak(self):
        self.save()
        for gift,count,event in [('Other',2,'x:2'),('Rose',1,'a:1'),('Rose',2,'a:2'),('Rose',3,'a:3')]:
            self.studio.gift({'gift':gift,'count':count,'user':'Alice'},event)
        result=self.client.get('/broadcast/alerts').get_json()
        self.assertEqual(len(result['events']),1)
        self.assertEqual(result['events'][0]['text'],'Gracias Alice: Rose ×2')

    def test_privacy_changes_apply_to_pending_alerts(self):
        self.save()
        self.studio.gift({'gift':'Rose','count':2,'user':'Alice'},'a:2')
        self.runtime.production.settings['hide_names']=True
        data=self.client.get('/broadcast/alerts').get_json()
        self.assertNotIn('Alice',str(data))
        self.assertIn('Participante',data['events'][0]['text'])
        self.runtime.production.settings['emergency']=True
        self.assertEqual(self.client.get('/broadcast/alerts').get_json()['events'],[])

    def test_disabled_and_emergency_do_not_emit(self):
        t=self.save()
        self.client.post('/animation-studio',json={**t,'enabled':False})
        self.studio.gift({'gift':'Rose','count':2},'a:2')
        self.assertEqual(self.studio.serial,0)
        self.client.post('/animation-studio',json=t)
        self.runtime.production.settings['emergency']=True
        self.studio.gift({'gift':'Rose','count':2},'b:2')
        self.assertEqual(self.studio.serial,0)

    def test_upload_types_paths_and_referenced_asset_deletion(self):
        self.assertEqual(self.client.post('/animation-studio/media',data={'file':(io.BytesIO(b'<svg onload="alert(1)">'),'bad.svg')}).status_code,400)
        response=self.client.post('/animation-studio/media',data={'file':(io.BytesIO(b'GIF89a'+b'\0'*20),'test.gif')})
        self.assertEqual(response.status_code,200)
        name=response.get_json()['name']
        with self.client.get('/broadcast/alert-media/'+name) as response:self.assertEqual(response.status_code,200)
        t=self.save(asset=name)
        self.assertEqual(self.client.delete('/animation-studio/media/'+name).status_code,409)
        self.client.delete('/animation-studio/templates/'+t['id'])
        self.assertEqual(self.client.delete('/animation-studio/media/'+name).status_code,200)
        self.assertEqual(self.client.get('/broadcast/alert-media/not-a-file').status_code,404)

    def test_private_controls_block_remote_and_cross_origin_requests(self):
        self.assertEqual(self.client.get('/animation-studio',environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)
        self.assertEqual(self.client.post('/animation-studio',json=self.template(),headers={'Origin':'https://other.invalid'}).status_code,403)
        remote={'REMOTE_ADDR':'192.0.2.1'}
        self.assertEqual(self.client.get('/broadcast/alerts',environ_overrides=remote).status_code,401)
        self.assertEqual(self.client.post('/broadcast/alerts/heartbeat',environ_overrides=remote).status_code,401)
        self.assertEqual(self.client.get('/broadcast/alerts?access='+self.runtime.production.view_token,
                                         environ_overrides=remote).status_code,200)
        self.assertEqual(self.client.post('/broadcast/alerts/heartbeat?access='+self.runtime.production.view_token,
                                          environ_overrides=remote).status_code,200)

    def test_new_session_resets_cooldown_without_replaying_previous_alerts(self):
        self.save()
        self.studio.gift({'gift':'Rose','count':2},'same:2')
        self.runtime.feed_session='session-b'
        self.studio.gift({'gift':'Rose','count':2},'same:2')
        self.assertEqual(self.studio.serial,2)
        self.assertEqual(len(self.studio.events),1)

    def test_follow_like_and_diamond_triggers(self):
        self.save(trigger='follow',gift='',text='{evento}: {usuario}')
        self.save(id='likes',trigger='like',gift='',amount=20,text='{usuario} envió {cantidad} likes')
        self.save(id='diamonds',diamonds=50,text='{regalo}: {diamantes} diamantes')
        self.studio.event('follow',{'user':'Ana'},'follow-1')
        self.studio.event('like',{'user':'Luis','count':10},'like-1')
        self.studio.event('like',{'user':'Luis','count':25},'like-2')
        self.studio.gift({'user':'Eva','gift':'Rose','count':2,'diamonds':20},'gift-low:2')
        self.studio.gift({'user':'Eva','gift':'Rose','count':2,'diamonds':60},'gift-high:2')
        data=self.client.get('/broadcast/alerts').get_json()
        self.assertEqual(len(data['events']),3)
        self.assertIn('Nuevo seguidor: Ana',[item['text'] for item in data['events']])
        self.assertIn('Luis envió 25 likes',[item['text'] for item in data['events']])
        self.assertIn('Rose: 60 diamantes',[item['text'] for item in data['events']])
        self.assertTrue(all(item['template']['enabled'] for item in data['events']))

    def test_source_heartbeat_stream_test_and_bulk_activation(self):
        saved=self.save()
        self.client.post('/animation-studio',json={**saved,'enabled':False})
        sample={**self.template(),'enabled':False}
        offline=self.client.post('/animation-studio/test',json=sample)
        self.assertEqual(offline.status_code,409)
        self.assertFalse(offline.get_json()['source_online'])
        self.assertEqual(self.client.post('/broadcast/alerts/heartbeat').status_code,200)
        sent=self.client.post('/animation-studio/test',json=sample)
        self.assertEqual(sent.status_code,200)
        self.assertTrue(sent.get_json()['source_online'])
        armed=self.client.post('/animation-studio/arm',json={'enabled':True}).get_json()
        self.assertEqual(armed['enabled_count'],1)
        self.assertTrue(armed['templates'][0]['enabled'])
        disarmed=self.client.post('/animation-studio/arm',json={'enabled':False}).get_json()
        self.assertEqual(disarmed['enabled_count'],0)

    def test_custom_audio_upload_and_reference_protection(self):
        wav=b'RIFF'+(24).to_bytes(4,'little')+b'WAVEfmt '+b'\0'*20
        response=self.client.post('/animation-studio/media',data={'file':(io.BytesIO(wav),'sound.wav')})
        self.assertEqual(response.status_code,200)
        name=response.get_json()['name']
        saved=self.save(sound='custom',sound_asset=name,volume=75)
        self.assertEqual(saved['sound_asset'],name)
        self.assertEqual(self.client.delete('/animation-studio/media/'+name).status_code,409)
        with self.client.get('/broadcast/alert-media/'+name) as served:
            self.assertEqual(served.mimetype,'audio/wav')
