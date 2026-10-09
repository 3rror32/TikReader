from pathlib import Path
import unittest
import hashlib
import threading
from types import SimpleNamespace
from flask import Flask
from seasonal_overlay import SeasonalOverlay


class SeasonalTests(unittest.TestCase):
    def setUp(self):
        self.saved = {}
        self.runtime = SimpleNamespace(feed_lock=threading.RLock(),
            archive=SimpleNamespace(settings=lambda:self.saved,set_setting=lambda k,v:self.saved.update({k:v})),
            production=SimpleNamespace(settings={'emergency':False,'scene':'talk'}))
        self.app = Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates'))
        self.overlay = SeasonalOverlay(self.app,self.runtime)
        self.client = self.app.test_client()

    def test_routes_and_independent_saved_settings(self):
        for k in ('snow','leaves','wind','rain','rain-original','fireflies','aurora','fog',
                  'embers','stars','petals','bubbles','digital-rain'):
            self.assertEqual(self.client.get('/widget/seasonal-'+k+'?preview=1').status_code,200)
        self.assertEqual(self.client.post('/seasonal-overlays/snow',json={'density':100,'wind':-20,'direction':-90,'speed':65,'canvas_format':'vertical'}).status_code,200)
        self.overlay.restore()
        self.assertEqual(self.overlay.settings['snow']['density'],100)
        self.assertEqual(self.overlay.settings['snow']['direction'],-90)
        self.assertEqual(self.overlay.settings['snow']['speed'],65)
        self.assertEqual(self.overlay.settings['snow']['canvas_format'],'vertical')
        self.assertEqual(self.overlay.settings['leaves']['density'],70)
        self.assertEqual(self.client.get('/widget/seasonal-invalid').status_code,404)

    def test_new_ambient_effects_have_independent_colors_and_defaults(self):
        response = self.client.post('/seasonal-overlays/aurora', json={
            'primary_color':'#112233', 'secondary_color':'#AABBCC', 'density':9
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.overlay.settings['aurora']['primary_color'], '#112233')
        self.assertEqual(self.overlay.settings['aurora']['secondary_color'], '#aabbcc')
        self.assertEqual(self.overlay.settings['fireflies']['primary_color'], '#ffd86b')
        self.assertEqual(self.overlay.settings['embers']['direction'], 180)
        bubbles = self.client.post('/seasonal-overlays/bubbles', json={
            'primary_color': '#22AADD', 'secondary_color': '#FFF1C7'
        })
        self.assertEqual(bubbles.status_code, 200)
        self.overlay.restore()
        self.assertEqual(self.overlay.settings['bubbles']['primary_color'], '#22aadd')
        self.assertEqual(self.overlay.settings['bubbles']['secondary_color'], '#fff1c7')
        for value in ('red', '#12345g', 123):
            self.assertEqual(self.client.post('/seasonal-overlays/stars', json={'primary_color':value}).status_code, 400)

    def test_fog_presets_and_clear_zone_are_saved_and_validated(self):
        self.assertEqual(self.overlay.settings['fog']['size'], 45)
        self.assertEqual(self.overlay.settings['fog']['wind'], 0)
        response = self.client.post('/seasonal-overlays/fog', json={
            'fog_style': 'cinematic', 'fog_clear_zone': 'left'
        })
        self.assertEqual(response.status_code, 200)
        self.overlay.restore()
        self.assertEqual(self.overlay.settings['fog']['fog_style'], 'cinematic')
        self.assertEqual(self.overlay.settings['fog']['fog_clear_zone'], 'left')
        for data in ({'fog_style':'clouds'}, {'fog_clear_zone':'top'}):
            self.assertEqual(self.client.post('/seasonal-overlays/fog', json=data).status_code, 400)

    def test_rain_controls_restore_and_validation(self):
        values = dict(density=140, speed=100, thickness=0.4, glass_count=0, glass_speed=12)
        response = self.client.post('/seasonal-overlays/rain', json=values)
        self.assertEqual(response.status_code, 200)
        self.overlay.restore()
        for key, value in values.items():
            self.assertEqual(self.overlay.settings['rain'][key], value)
        self.assertEqual(self.overlay.settings['snow']['density'], 70)
        for data in ({'glass_count':181}, {'glass_count':-1}, {'thickness':0.2},
                     {'thickness':float('nan')}, {'glass_speed':0}):
            self.assertEqual(self.client.post('/seasonal-overlays/rain', json=data).status_code, 400)
        self.assertIn(b'rain_atmosphere.js', self.client.get('/widget/seasonal-rain').data)

    def test_original_is_separate(self):
        bundle = Path(__file__).resolve().parent.parent / 'web/static/vendor/raindrop-fx/original.js'
        integration = Path(__file__).resolve().parent.parent / 'web/static/rain_original.js'
        integration_source = integration.read_text(encoding='utf-8')
        self.assertEqual(hashlib.sha256(bundle.read_bytes()).hexdigest(), 'cbe3df720636639d5bec28855bac5cc5395f0593f6b731c9fad98ab1de68100b')
        self.assertNotIn('matrlCompose.setPipelineStateOverride', integration_source)
        self.assertIn('new ResizeObserver(scheduleResize)', integration_source)
        self.assertIn('canvas.getBoundingClientRect()', integration_source)
        self.assertNotIn('fx.resize(innerWidth,innerHeight)', integration_source)
        original = self.client.get('/widget/seasonal-rain-original')
        self.assertIn(b'/original.js', original.data)
        self.assertIn(b'rain_original.js?v=responsive-2', original.data)
        self.assertNotIn(b'/rain_atmosphere.js', original.data)
        self.assertEqual(self.client.post('/seasonal-overlays/rain-original', json={'glass_count':2000,'size':100}).status_code,200)
        self.assertEqual(self.overlay.settings['rain']['glass_count'],45)
        self.assertEqual(self.client.post('/seasonal-overlays/rain-original',json={'background_visible':False}).status_code,200)
        self.overlay.restore()
        self.assertFalse(self.overlay.settings['rain-original']['background_visible'])
        self.assertEqual(self.client.post('/seasonal-overlays/rain-original',json={'background_visible':'no'}).status_code,400)
        self.assertEqual(self.client.post('/seasonal-overlays/rain-original', json={'background_image':'https://example.com/picture'}).status_code,400)

    def test_bounds_and_mute(self):
        for data in ({'direction':181},{'direction':-181},{'direction':True},{'density':999},{'speed':0},{'size':float('nan')},{'enabled':'yes'},{'motion':'invalid'},{'canvas_format':'auto'}):
            self.assertEqual(self.client.post('/seasonal-overlays/snow',json=data).status_code,400)
        for key,value in [('emergency',True),('scene','pause')]:
            self.runtime.production.settings[key]=value
            self.assertTrue(self.client.get('/broadcast/seasonal/snow').get_json()['muted'])
            self.runtime.production.settings.update(emergency=False,scene='talk')
        self.client.post('/seasonal-overlays/snow',json={'enabled':False})
        self.assertTrue(self.client.get('/broadcast/seasonal/snow').get_json()['muted'])


if __name__ == '__main__': unittest.main()
