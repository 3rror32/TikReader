import copy
import json
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace as NS
from unittest.mock import patch

import server
from history_store import HistoryStore
from creator_analytics import community_report
from creator_suite import CreatorSuite


class CreatorSuiteTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.store=HistoryStore(Path(self.temp.name)/'history.sqlite3')
        self.patches=[patch.object(server,'archive',self.store),patch.object(server.interactive,'rules',[]),
            patch.object(server.interactive,'folder',Path(self.temp.name)/'media'),
            patch.dict(server.production.settings,emergency=False,hide_names=False),patch.dict(server.state,username='creator',connected=False)]
        for p in self.patches:
            p.start()
        self.c=server.app.test_client()
        self.s=server.creator_suite
        self.s.battles.latest=None
        self.s.battles.session=None
        self.s.arena=None

    def tearDown(self):
        self.s.arena=None
        self.s.battles.latest=None
        for p in reversed(self.patches):
            p.stop()
        self.temp.cleanup()

    def scene(self):
        return dict(name='Scene',width=1080,height=1920,layers=[dict(id='one',kind='widget',widget='chat',x=20,y=20,width=400,height=300)])

    def test_scene_draft_publication_isolation_and_revision_conflict(self):
        saved=self.c.post('/creator-api/scenes',json=dict(revision=0,scene=self.scene())).get_json()
        sid=saved['selected']
        self.assertEqual(self.c.get('/broadcast/scene/'+sid).status_code,404)
        published=self.c.post('/creator-api/scenes',json=dict(id=sid,revision=1,action='publish'))
        self.assertEqual(published.status_code,200)
        changed=self.scene();changed['name']='Changed'
        self.assertEqual(self.c.post('/creator-api/scenes',json=dict(id=sid,revision=1,scene=changed)).status_code,409)
        self.c.post('/creator-api/scenes',json=dict(id=sid,revision=2,scene=changed))
        self.assertEqual(self.c.get('/broadcast/scene/'+sid).get_json()['scene']['name'],'Scene')
        # Reconstructed service reads persisted data; no in-memory-only success.
        other=object.__new__(CreatorSuite);other.r=server
        self.assertEqual(other.read('scenes')['items'][sid]['draft']['name'],'Changed')

    def test_scene_rejects_external_sources_nan_overflow_and_duplicates(self):
        cases=[]
        d=self.scene();d['layers'][0]['widget']='https://example.com';cases.append(d)
        d=self.scene();d['layers'][0]['width']=5000;cases.append(d)
        d=self.scene();d['layers'][0]['x']=float('nan');cases.append(d)
        d=self.scene();d['layers'].append(copy.deepcopy(d['layers'][0]));cases.append(d)
        for data in cases:
            with self.subTest(data=data):
                self.assertEqual(self.c.post('/creator-api/scenes',json=dict(revision=0,scene=data)).status_code,400)
        self.assertEqual(self.s.read('scenes')['revision'],0)

    def test_private_routes_remote_protection_and_origin(self):
        for path in ('/creator','/creator-api/calendar','/creator-api/community','/creator-api/battles','/creator-api/contacts'):
            self.assertEqual(self.c.get(path,environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)
        self.assertEqual(self.c.post('/creator-api/scenes',json={},headers={'Origin':'https://evil.example'}).status_code,403)

    def test_starter_profiles_are_additive_disabled_and_repeatable(self):
        server.interactive.rules=[server.interactive.validate(dict(id='existing',name='Keep',event='gift',action='voice',value='Hola',enabled=True))]
        preview=self.c.post('/creator-api/profiles/charla',json={}).get_json()
        self.assertEqual(len(preview['scenes']),2)
        self.assertEqual(self.s.read('scenes')['items'],{})
        self.assertEqual(self.c.post('/creator-api/profiles/charla',json={'action':'apply'}).status_code,200)
        self.c.post('/creator-api/profiles/charla',json={'action':'apply'})
        self.assertEqual(len(server.interactive.rules),3)
        self.assertTrue(server.interactive.rules[0]['enabled'])
        self.assertTrue(all(not r['enabled'] for r in server.interactive.rules[1:]))
        self.assertEqual(len(self.s.read('scenes')['items']),2)
        self.assertTrue(all('published' not in s for s in self.s.read('scenes')['items'].values()))

    def test_community_deduplicates_recovered_streaks_and_separates_accounts(self):
        for sid,owner in [('s1','creator'),('s2','creator'),('s3','other')]:
            self.store.start(sid,owner)
        now=time.time()
        for sid,count in [('s1',2),('s2',5),('s3',3)]:
            self.store.save(sid,'gift',dict(id='same-streak',user='@Alice',count=count,diamonds=count*10,gift='Rose',occurred_at=now))
        self.store.save('s1','gift',dict(id='unknown',user='@Bob',count=1,diamonds=None))
        result=community_report(self.store,'creator')
        self.assertEqual(result['coins'],50)
        self.assertEqual(result['people'][0]['gifts'],5)
        self.assertEqual(result['unknown_value'],1)
        self.assertEqual(community_report(self.store)['coins'],80)

    def test_contact_birthday_validation_and_private_notes(self):
        payload=dict(revision=0,key='creator:alice',birthday='02-30',tags=['VIP'],notes='Private')
        self.assertEqual(self.c.post('/creator-api/contacts',json=payload).status_code,400)
        payload['birthday']='02-29'
        self.assertEqual(self.c.post('/creator-api/contacts',json=payload).status_code,200)
        self.assertEqual(self.c.post('/creator-api/contacts',json=payload).status_code,409)
        self.assertEqual(self.store.settings()['creator_contacts']['items']['creator:alice']['notes'],'Private')

    def test_calendar_utc_export_escaping_and_revision(self):
        payload=dict(revision=0,title='Directo, especial\nBEGIN:BAD',start=1800000000,duration=60,remind=15,notes='a;b',scene='',profile='charla')
        self.assertEqual(self.c.post('/creator-api/calendar',json=payload).status_code,200)
        self.assertEqual(self.c.post('/creator-api/calendar',json=payload).status_code,409)
        output=self.c.get('/creator-api/calendar.ics').data.decode()
        self.assertIn('BEGIN:VALARM',output)
        self.assertIn('TRIGGER:-PT15M',output)
        self.assertIn('Directo\\, especial\\nBEGIN:BAD',output)
        self.assertNotIn('\r\nBEGIN:BAD',output)
        self.assertIn('DESCRIPTION:a\\;b',output)

    def test_manual_battle_result_and_restart_hides_old_live(self):
        d=self.c.post('/creator-api/battles',json=dict(revision=0,opponent='Rival',mine=30,rival=10,status='finished',notes='PRIVATE')).get_json()
        b=next(iter(d['items'].values()))
        self.assertEqual(b['result'],'win')
        public=self.c.get('/broadcast/creator/battle').get_json()
        self.assertNotIn('PRIVATE',json.dumps(public))
        with patch.object(server,'feed_session','next-session'):
            self.assertIsNone(self.c.get('/broadcast/creator/battle').get_json()['data'])

    def test_battle_adapter_real_proto_and_out_of_order_events(self):
        from TikTokLive.events import LinkMicBattleEvent,LinkMicArmiesEvent
        from TikTokLiveProto.v3.webcast.model.message.battle import BattleSetting,BattleUserArmies,BattleUserArmy
        start=LinkMicBattleEvent(battle_id=123,action=4,battle_settings=BattleSetting(start_time_ms=int(time.time()*1000),duration=300))
        self.s.battles.receive(start,'battle')
        score=LinkMicArmiesEvent(battle_id=123,armies={11:BattleUserArmies(hostscore=55,user_armies=[BattleUserArmy(nickname='Alice',score=55)]),22:BattleUserArmies(hostscore=40)})
        self.s.battles.receive(score,'armies')
        self.assertEqual(self.s.battles.latest['sides']['11']['score'],55)
        self.assertIsNone(self.s.battles.latest['bonus'])
        self.s.battles.receive(LinkMicBattleEvent(battle_id=123,action=5),'battle')
        self.s.battles.receive(score,'armies')
        self.assertEqual(self.s.battles.latest['status'],'finished')
        self.assertEqual(len(self.s.read('battles')['items']),1)

    def test_battle_duplicate_and_stale_score(self):
        tracker=self.s.battles
        def event(mid,at,score):
            return NS(battle_id=8,common=NS(msg_id=mid,create_time=at),armies={1:NS(hostscore=score,user_armies=[])})
        tracker.receive(event(1,200,20),'armies')
        tracker.receive(event(1,200,100),'armies')
        tracker.receive(event(2,100,5),'armies')
        self.assertEqual(tracker.latest['sides']['1']['score'],20)

    def test_arena_votes_dedupe_gift_deltas_and_emergency(self):
        self.c.post('/creator-api/arena',json=dict(mode='race',duration=60,gifts=True,title='Race'))
        s=self.s
        s.audience_event('comment',dict(user='@a',comment='!rojo'),'1')
        s.audience_event('comment',dict(user='@a',comment='!azul'),'2')
        s.audience_event('gift',dict(user='@a'),'g:3',3)
        s.audience_event('gift',dict(user='@a'),'g:3',3)
        self.assertEqual(s.arena['scores'],dict(rojo=4,azul=0))
        with patch.dict(server.production.settings,emergency=True):
            s.audience_event('gift',dict(user='@a'),'g:5',2)
            self.assertTrue(self.c.get('/broadcast/creator/arena').get_json()['muted'])
        self.assertEqual(s.arena['scores']['rojo'],4)
        with patch.object(server,'feed_session','other'):
            self.assertFalse(s.arena_state()['running'])

    def test_trivia_answer_not_public_and_names_hidden(self):
        self.c.post('/creator-api/arena',json=dict(mode='trivia',duration=60,answer='París',title='Capital'))
        self.s.audience_event('comment',dict(user='@alice',comment=' PARÍS '),'a')
        self.s.audience_event('comment',dict(user='@alice',comment='París'),'b')
        self.assertEqual(self.s.arena['correct'],1)
        with patch.dict(server.production.settings,hide_names=True):
            output=self.c.get('/broadcast/creator/arena').data.decode()
            self.assertNotIn('alice',output)
            self.assertNotIn('París',output)

    def test_builtin_sounds_are_wav_and_disabled_rules(self):
        audio=self.c.get('/creator-api/sounds/chime')
        self.assertEqual(audio.status_code,200)
        self.assertEqual(audio.data[:4],b'RIFF')
        self.assertTrue(self.c.post('/creator-api/sounds/chime',json={}).get_json()['added'])
        self.assertFalse(self.c.post('/creator-api/sounds/chime',json={}).get_json()['added'])
        self.assertFalse(server.interactive.rules[0]['enabled'])
        self.assertEqual(len(list(server.interactive.folder.glob('*.wav'))),1)

    def test_no_archive_returns_clear_failure(self):
        with patch.object(server,'archive',None):
            self.assertEqual(self.c.get('/creator-api/community').status_code,503)

    def test_profile_roundtrip_includes_drafts_without_replacing_published_scene(self):
        saved=self.c.post('/creator-api/scenes',json=dict(revision=0,scene=self.scene())).get_json()
        sid=saved['selected']
        self.c.post('/creator-api/scenes',json=dict(revision=1,id=sid,action='publish'))
        profile=self.c.get('/operator/profile').get_json()
        profile['settings']['creator_scenes'][sid]['name']='Imported draft'
        response=self.c.post('/operator/profile',json=profile)
        self.assertEqual(response.status_code,200,response.data)
        stored=self.s.read('scenes')['items'][sid]
        self.assertEqual(stored['draft']['name'],'Imported draft')
        self.assertEqual(stored['published']['name'],'Scene')

    def test_scene_media_protection_includes_published_versions(self):
        with patch.object(server.animation_studio,'folder',Path(self.temp.name)):
            name='a'*32+'.png'
            (Path(self.temp.name)/name).write_bytes(b'\x89PNG\r\n\x1a\n')
            scene=self.scene();scene['layers'][0].update(kind='media',asset=name)
            saved=self.c.post('/creator-api/scenes',json=dict(revision=0,scene=scene)).get_json()
            sid=saved['selected']
            self.c.post('/creator-api/scenes',json=dict(revision=1,id=sid,action='publish'))
            scene['layers']=[]
            self.c.post('/creator-api/scenes',json=dict(revision=2,id=sid,scene=scene))
            self.assertEqual(self.c.delete('/animation-studio/media/'+name).status_code,409)
            self.c.post('/creator-api/scenes',json=dict(revision=3,id=sid,action='publish'))
            self.assertEqual(self.c.delete('/animation-studio/media/'+name).status_code,200)

    def test_boosters_keep_expiry_and_used_state(self):
        response=self.c.post('/creator-api/boosters',json=dict(revision=0,user='Alice',name='Guante',expires=time.time()+3600))
        self.assertEqual(response.status_code,200)
        bid=next(iter(response.get_json()['items']))
        response=self.c.post('/creator-api/boosters',json=dict(revision=1,id=bid,action='used'))
        self.assertTrue(response.get_json()['items'][bid]['used'])
        self.assertEqual(self.c.post('/creator-api/boosters',json=dict(revision=1,id=bid,action='used')).status_code,409)

    def test_battle_reconnect_reuses_persisted_identity(self):
        event=NS(battle_id=8,common=NS(msg_id=1,create_time=200),armies={1:NS(hostscore=20,user_armies=[])})
        self.s.battles.receive(event,'armies')
        self.s.battles.latest=None
        self.s.battles.seen.clear()
        self.s.battles.receive(event,'armies')
        self.assertEqual(len(self.s.read('battles')['items']),1)


if __name__=='__main__':
    unittest.main()
