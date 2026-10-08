import io
from test_animation_studio import AnimationStudioTests
from live_counters import LiveCounters
from overlay_animations import OverlayAnimations


class OverlayAnimationTests(AnimationStudioTests):
    def setUp(self):
        super().setUp()
        self.runtime.animation_studio = self.studio
        self.runtime.live_counters = LiveCounters(self.app,self.runtime)
        self.runtime.studio_state = {'like_goal':100}
        self.effects = OverlayAnimations(self.app,self.runtime)
        self.runtime.overlay_animations = self.effects

    def enable(self,key,**values):
        r=self.client.post('/overlay-animations/'+key,json={'enabled':True,**values})
        self.assertEqual(r.status_code,200,r.get_json())

    def events(self,key):
        return self.client.get('/broadcast/animations/'+key).get_json()['events']

    def test_energy_ring_events_and_configuration(self):
        for trigger in ('gift','follow','comment','like','subscribe'):
            self.enable('energy-ring',trigger=trigger,secondary='#123456',speed=8,glow=0)
            self.effects.last.clear()
            self.effects.event(trigger,{'user':'Alice','avatar_url':'https://example.com/avatar','count':1},trigger)
            event=self.events('energy-ring')[0]
            self.assertEqual(event['record']['avatar_url'],'https://example.com/avatar')
            self.assertEqual(event['settings']['secondary'],'#123456')
            self.assertEqual(event['settings']['glow'],0)
        self.effects.restore()
        self.assertEqual(self.effects.settings['energy-ring']['speed'],8)
        for invalid in ({'speed':11},{'glow':-1},{'secondary':'red'}):
            self.assertEqual(self.client.post('/overlay-animations/energy-ring',json=invalid).status_code,400)
        self.assertEqual(self.client.get('/widget/animation-energy-ring').status_code,200)

    def test_effect_triggers_deduplicate_and_filter(self):
        self.enable('hearts',amount=5)
        self.effects.event('like',{'count':2},'a')
        self.assertEqual(self.events('hearts'),[])
        self.effects.event('like',{'count':5},'b')
        self.effects.last.clear()
        self.effects.event('like',{'count':5},'b')
        self.assertEqual(len(self.events('hearts')),1)
        self.enable('coins',gift='Rose',amount=2)
        self.effects.event('gift',{'gift':'Other','count':2},'gift:2')
        self.assertEqual(self.events('coins'),[])
        self.effects.event('gift',{'gift':'Rose','count':2},'gift:2')
        self.effects.last.clear()
        self.effects.event('gift',{'gift':'Rose','count':3},'gift:3')
        self.assertEqual(len(self.events('coins')),1)

    def test_motion_preference_is_persisted_and_delivered(self):
        for motion in ('full','reduced','system'):
            self.enable('hearts',motion=motion)
            self.effects.restore()
            self.effects.last.clear()
            self.effects.event('like',{'count':1},motion)
            self.assertEqual(self.events('hearts')[-1]['settings']['motion'],motion)
        self.assertEqual(self.client.post('/overlay-animations/hearts',json={'motion':'invalid'}).status_code,400)

    def test_canvas_format_is_persisted_and_validated(self):
        self.enable('hearts',canvas_format='vertical')
        self.effects.restore()
        self.assertEqual(self.effects.settings['hearts']['canvas_format'],'vertical')
        self.assertEqual(self.client.post('/overlay-animations/hearts',json={'canvas_format':'auto'}).status_code,400)

    def test_animation_can_be_limited_to_selected_scenes(self):
        self.enable('hearts', scenes=['talk', 'pause'])
        self.runtime.production.settings['scene'] = 'start'
        self.effects.event('like', {'count': 1}, 'start-like')
        self.assertEqual(self.events('hearts'), [])
        self.runtime.production.settings['scene'] = 'pause'
        self.effects.event('like', {'count': 1}, 'pause-like')
        self.assertEqual(len(self.events('hearts')), 1)
        self.assertEqual(self.effects.settings['hearts']['scenes'], ['talk', 'pause'])
        for scenes in ([], ['talk', 'unknown'], 'talk'):
            self.assertEqual(self.client.post('/overlay-animations/hearts', json={'scenes': scenes}).status_code, 400)

    def test_cannon_delivers_gift_image_and_owns_overlay_route(self):
        self.enable('cannon')
        self.effects.event('gift',{'gift':'Rosa','count':10,'image_url':'https://example.com/rose.png'},'rose:10')
        self.assertEqual(self.events('cannon')[0]['record']['image_url'],'https://example.com/rose.png')
        response=self.client.get('/widget/animation-cannon?preview=1')
        self.assertEqual(response.status_code,200)
        self.assertIn(b'gift_cannon.js',response.data)

    def test_follow_privacy_emergency_and_session(self):
        self.enable('welcome',message='Bienvenido {usuario}')
        self.effects.event('follow',{'user':'Alice','avatar_url':'https://example.com/avatar'},'1')
        self.assertEqual(self.events('welcome')[0]['settings']['message'],'Bienvenido {usuario}')
        self.runtime.production.settings.update(hide_names=True,hide_photos=True)
        e=self.events('welcome')[0]['record']
        self.assertEqual(e['user'],'Participante');self.assertIsNone(e['avatar_url'])
        self.runtime.production.settings['emergency']=True
        self.assertEqual(self.events('welcome'),[])
        self.runtime.production.settings['emergency']=False
        self.assertEqual(self.events('welcome'),[])
        self.runtime.feed_session='new'
        self.effects.event('follow',{},'1')
        self.assertEqual(len(self.events('welcome')),1)

    def test_goal_crossing_only_once_and_rearm(self):
        self.enable('celebration')
        self.runtime.state['like_count']=90
        self.assertEqual(self.events('celebration'),[])
        self.runtime.state['like_count']=100
        self.assertEqual(len(self.events('celebration')),1)
        self.effects.last.clear()
        self.assertEqual(len(self.events('celebration')),1)
        self.runtime.live_counters.goals['goal-likes']={'goal':200}
        self.events('celebration')
        self.runtime.state['like_count']=200
        self.assertEqual(len(self.events('celebration')),2)

    def test_custom_upload_restore_reference_and_preview(self):
        self.assertEqual(self.client.post('/overlay-animations/custom',json={'enabled':True}).status_code,400)
        r=self.client.post('/animation-studio/media',data={'file':(io.BytesIO(b'\x1a\x45\xdf\xa3webm'+b'\0'*20),'a.webm')})
        self.assertEqual(r.status_code,200)
        asset=r.get_json()['name']
        self.enable('custom',asset=asset)
        self.effects.restore()
        self.assertEqual(self.effects.settings['custom']['asset'],asset)
        self.assertEqual(self.client.delete('/animation-studio/media/'+asset).status_code,409)
        before=self.effects.serial
        self.assertEqual(self.client.get('/widget/animation-custom?preview=1').status_code,200)
        self.assertEqual(before,self.effects.serial)
        self.assertEqual(self.client.post('/overlay-animations/hearts',json={'duration':0}).status_code,400)
        self.assertEqual(self.client.get('/overlay-animations/hearts',environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)
        remote={'REMOTE_ADDR':'192.0.2.1'}
        self.assertEqual(self.client.get('/broadcast/animations/hearts',environ_overrides=remote).status_code,401)
        self.assertEqual(self.client.get('/broadcast/animations/hearts?access='+self.runtime.production.view_token,
                                         environ_overrides=remote).status_code,200)

    def test_fountain_likes_avatar_and_validation(self):
        self.enable('fountain', cooldown=0, color='#ff88aa', position='both')
        self.effects.event('like', {'count':5,'user':'Luna','avatar_url':'https://example.com/avatar.png'}, 'like-a')
        self.effects.event('like', {'count':2}, 'like-b')
        events=self.events('fountain')
        self.assertEqual(len(events),2)
        self.assertEqual(events[0]['record']['avatar_url'],'https://example.com/avatar.png')
        self.assertEqual(self.client.post('/overlay-animations/fountain',json={'color':'invalid'}).status_code,400)
        response=self.client.get('/widget/animation-fountain?preview=1')
        self.assertEqual(response.status_code,200)
        self.assertIn(b'like_fountain.js',response.data)
        self.assertNotIn(b'overlay_animation_widget.js',response.data)

    def test_subscription_celebrations_are_configurable_and_deduplicated(self):
        for key in ('vip-runway','vip-diamonds','vip-hearts'):
            self.enable(key,message='Gracias por apoyar',accent='#abcdef',density=25)
        self.effects.event('subscribe',{'user':'Luna','avatar_url':'https://example.com/a.png'},'sub-1')
        self.effects.last.clear()
        self.effects.event('subscribe',{'user':'Luna'},'sub-1')
        for key in ('vip-runway','vip-diamonds','vip-hearts'):
            events=self.events(key)
            self.assertEqual(len(events),1)
            self.assertEqual(events[0]['settings']['message'],'Gracias por apoyar')
            self.assertEqual(events[0]['record']['user'],'Luna')
            self.assertEqual(self.client.get('/widget/animation-'+key).status_code,200)
        self.assertEqual(self.client.post('/overlay-animations/vip-runway',json={'accent':'bad'}).status_code,400)
        self.assertEqual(self.client.post('/overlay-animations/vip-runway',json={'density':1000}).status_code,400)
