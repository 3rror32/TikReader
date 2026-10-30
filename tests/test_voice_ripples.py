import sys, unittest
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
from flask import Flask
from voice_ripples import VoiceRipples
class VoiceRippleTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        self.service = VoiceRipples(app, SimpleNamespace())
        self.client = app.test_client()
    def test_validation_and_expiry(self):
        for data in ({'amplitude': float('nan')}, {'amplitude': 2}, {'sensitivity': 0}, {'color': 'red'}, []):
            self.assertEqual(self.client.post('/voice-ripples', json=data).status_code, 400)
        self.assertEqual(self.client.post('/voice-ripples', json={'amplitude': .8, 'color': '#aabbcc'}).status_code, 200)
        self.assertEqual(self.service.snapshot()['amplitude'], .8)
        self.service.updated -= 2
        self.assertEqual(self.service.snapshot()['amplitude'], 0)
    def test_missing_amplitude_does_not_refresh_signal(self):
        self.client.post('/voice-ripples', json={'amplitude': .5})
        stamp = self.service.updated
        self.client.post('/voice-ripples', json={'color': '#ffffff'})
        self.assertEqual(self.service.updated, stamp)
    def test_huge_integer_is_rejected(self):
        self.assertEqual(self.client.post('/voice-ripples', json={'amplitude': 10**1000}).status_code, 400)
    def test_payload_bound(self):
        self.assertEqual(self.client.post('/voice-ripples', json={'extra': 'x' * 3000}).status_code, 413)
if __name__ == '__main__': unittest.main()

class ExpandedEffectsTests(VoiceRippleTests):
    def test_effect_settings_and_atomic_validation(self):
        for style in ['ripples', 'halo', 'particles', 'equalizer', 'silk', 'smoke', 'aura', 'avatar', 'lightning', 'camera-flashes', 'butterflies']:
            self.assertEqual(self.client.post('/voice-ripples', json={'style': style, 'intensity': 1.2, 'speed': .8, 'avatar': '🎙️'}).status_code, 200)
            self.assertEqual(self.service.snapshot()['style'], style)
        before = self.service.snapshot()
        for payload in [{'style':'bad'}, {'speed':0}, {'intensity':10**1000}, {'avatar':'x'*33}, {'bands':[0]*17}, {'bands':[False]*16}, {'bands':[2]*16}, {'bands':[.2]*16}]:
            self.assertEqual(self.client.post('/voice-ripples', json=dict(payload, color='#ffffff')).status_code, 400)
            self.assertEqual(self.service.snapshot(), before)
    def test_bands_expire_and_settings_do_not_refresh(self):
        self.client.post('/voice-ripples', json={'amplitude':.7, 'bands':[.4]*16})
        stamp = self.service.updated
        self.client.post('/voice-ripples', json={'style':'equalizer'})
        self.assertEqual(self.service.updated, stamp)
        self.assertEqual(self.service.snapshot()['bands'], [.4]*16)
        self.service.updated -= 2
        self.assertEqual(self.service.snapshot()['bands'], [0]*16)
