import unittest
from unittest.mock import patch
import server

class SpotifyTests(unittest.TestCase):
    def setUp(self):
        self.s=server.spotify;self.s.tokens={};self.s.pending=None;self.s.requests=[]
        self.c=server.app.test_client()
    def test_authorize_pkce_and_reject_bad_callback(self):
        r=self.c.post('/spotify/authorize',json={'client_id':'a'*32})
        self.assertEqual(r.status_code,200);self.assertIn('code_challenge_method=S256',r.get_json()['url'])
        self.assertNotIn(self.s.pending['verifier'],r.get_json()['url'])
        self.assertEqual(self.c.get('/spotify/callback?state=invalid&code=x').status_code,400)
    def test_request_requires_approval_and_is_bounded(self):
        for i in range(40):self.s.comment({'user':str(i),'comment':'!song https://open.spotify.com/track/'+'a'*22})
        self.assertEqual(len(self.s.requests),30)
        with patch.object(self.s,'player') as player:
            self.assertFalse(player.called)
            r=self.c.post('/spotify/request',json={'action':'approve','id':self.s.requests[0]['id']})
            self.assertEqual(r.status_code,200);player.assert_called_once()
        self.assertEqual(len(self.s.requests),29)
    def test_remote_denied_and_tokens_not_exposed(self):
        self.s.tokens={'access_token':'secret'}
        self.assertNotIn('secret',self.c.get('/spotify/state').text)
        self.assertEqual(self.c.get('/spotify/state',environ_overrides={'REMOTE_ADDR':'192.0.2.1'}).status_code,403)
        self.c.post('/spotify/disconnect');self.assertEqual(self.s.tokens,{})
    def tearDown(self):self.s.tokens={};self.s.pending=None;self.s.requests=[]
