from pathlib import Path
import unittest
import threading
from types import SimpleNamespace
from flask import Flask
from emoji_overlay import EmojiOverlay


class EmojiTests(unittest.TestCase):
    def setUp(self):
        self.saved={}
        self.r=SimpleNamespace(feed_lock=threading.RLock(),feed_session='new',state={'comment_count':2},
            comment_history=[{'session':'old','sequence':1,'comment':'old'},
                             {'session':'new','sequence':2,'comment':'😍','avatar_url':'https://example.com/a.png',
                              'emotes':[{'id':'party','index':0,'url':'https://example.com/party.webp'}]}],
            archive=SimpleNamespace(settings=lambda:self.saved,set_setting=lambda k,v:self.saved.update({k:v})),
            production=SimpleNamespace(settings={'emergency':False,'scene':'talk'},sanitize=lambda d:d))
        app=Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates'));self.overlay=EmojiOverlay(app,self.r);self.client=app.test_client()

    def test_current_session_feed_settings_and_widget(self):
        d=self.client.get('/broadcast/emoji-overlay').get_json()
        self.assertEqual(len(d['comments']),1)
        self.assertEqual(d['comments'][0]['emotes'][0]['url'],'https://example.com/party.webp')
        self.assertEqual(d['serial'],2)
        self.assertEqual(self.client.get('/widget/chat-emojis?preview=1').status_code,200)
        self.assertEqual(self.client.post('/emoji-overlay',json={'show_avatar':False,'direction':'left','canvas_format':'vertical'}).status_code,200)
        self.overlay.restore()
        self.assertEqual(self.overlay.settings['direction'],'left')
        self.assertEqual(self.overlay.settings['canvas_format'],'vertical')
        self.assertIsNone(self.client.get('/broadcast/emoji-overlay').get_json()['comments'][0]['avatar_url'])

    def test_mute_validation_and_sanitization(self):
        for data in ({'size':900},{'max_emojis':0},{'enabled':'yes'},{'direction':'bad'},{'canvas_format':'auto'},[]):
            self.assertEqual(self.client.post('/emoji-overlay',json=data).status_code,400)
        self.r.production.settings['emergency']=True
        self.assertEqual(self.client.get('/broadcast/emoji-overlay').get_json()['comments'],[])
        self.r.production.settings['emergency']=False
        self.r.production.sanitize=lambda d:{**d,'comments':[]}
        self.assertEqual(self.client.get('/broadcast/emoji-overlay').get_json()['comments'],[])


if __name__=='__main__': unittest.main()
