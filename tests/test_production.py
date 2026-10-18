import unittest
from unittest.mock import patch
import server
from production import redact, question_key


class ProductionTests(unittest.TestCase):
    def setUp(self):
        self.p = server.production
        self.previous = dict(self.p.settings)
        self.p.settings.update(emergency=False, scene='talk', hide_names=False, hide_photos=False, redact=False)
        self.p.questions.clear(); self.p.seen.clear(); self.p.remote_queue.clear()
        self.client = server.app.test_client()
        self.remote = {'REMOTE_ADDR': '192.0.2.8'}

    def tearDown(self):
        self.p.settings = self.previous
        self.p.token = None

    def test_private_controls_denied_from_network(self):
        for url in ('/', '/feed', '/history', '/production/state', '/studio/state'):
            self.assertEqual(self.client.get(url, environ_overrides=self.remote).status_code, 403)
        self.assertEqual(self.client.get('/moderator', environ_overrides=self.remote).status_code, 200)

    def test_remote_key_revocation_and_scope(self):
        token = self.client.post('/production/pair', json={}).get_json()['token']
        headers = {'Authorization': 'Bearer '+token}
        self.assertEqual(self.client.get('/remote/feed', environ_overrides=self.remote).status_code, 401)
        self.assertEqual(self.client.get('/remote/feed', headers=headers, environ_overrides=self.remote).status_code, 200)
        self.assertEqual(self.client.post('/remote/feed', json={'action':'stop_live'}, headers=headers, environ_overrides=self.remote).status_code, 403)
        self.client.delete('/production/pair')
        self.assertEqual(self.client.get('/remote/feed', headers=headers, environ_overrides=self.remote).status_code, 401)

    def test_remote_key_rotation_and_expiration(self):
        old=self.client.post('/production/pair',json={}).get_json()['token']
        new=self.client.post('/production/pair',json={}).get_json()['token']
        self.assertEqual(self.client.get('/remote/feed',headers={'Authorization':'Bearer '+old}).status_code,401)
        self.assertEqual(self.client.get('/remote/feed',headers={'Authorization':'Bearer '+new}).status_code,200)
        with patch.object(self.p,'token_expires',0):
            self.assertEqual(self.client.get('/remote/feed',headers={'Authorization':'Bearer '+new}).status_code,401)

    def test_pair_explains_network_availability(self):
        result=self.client.post('/production/pair',json={}).get_json()
        self.assertIn('lan_enabled',result)
        self.assertEqual(result['port'],server.runtime_config_value.port)

    def test_moderator_can_prepare_without_duplicate_or_extra_permissions(self):
        token=self.client.post('/production/pair',json={}).get_json()['token']
        headers={'Authorization':'Bearer '+token}
        record={'id':'remote-test','user':'@viewer','comment':'¿Pregunta?','sequence':1}
        with patch.object(server,'comment_history',[record]):
            for _ in range(2):
                result=self.client.post('/remote/feed',json={'action':'prepare','id':'remote-test'},headers=headers,environ_overrides=self.remote)
                self.assertEqual(result.status_code,200)
            self.assertEqual(len(self.p.remote_queue),1)
            self.assertEqual(self.client.post('/remote/feed',json={'action':'prepare','id':'remote-test','like_goal':500},headers=headers,environ_overrides=self.remote).status_code,403)

    def test_question_groups_deduplicate_and_count_people(self):
        for record in [dict(id='q1',user='@one',comment='¿Qué hora es?'), dict(id='q2',user='@two',comment='que hora es?')]:
            self.p.comment(record); self.p.comment(record)
        groups = self.client.get('/production/questions').get_json()['questions']
        self.assertEqual(len(groups),1)
        self.assertEqual(groups[0]['count'],2)
        self.assertEqual(len(groups[0]['users']),2)
        self.assertEqual(question_key('¿Qué hora es?'),question_key('QUE HORA ES?'))

    def test_follow_activity_stays_private_and_has_no_remote_comment_actions(self):
        token = self.client.post('/production/pair', json={}).get_json()['token']
        headers = {'Authorization': 'Bearer ' + token}
        comment = dict(id='comment', user='@viewer', comment='hola', sequence=1)
        follow = dict(id='follow', kind='follow', user='@viewer', comment='empezó a seguirte', sequence=2)
        with patch.object(server, 'comment_history', [comment, follow]):
            self.assertEqual([c['id'] for c in self.client.get('/broadcast/feed').get_json()['comments']], ['comment'])
            self.assertEqual([c['id'] for c in self.client.get('/remote/feed', headers=headers).get_json()['comments']], ['comment'])
            for action in ('prepare', 'highlight'):
                self.assertEqual(self.client.post('/remote/feed', headers=headers, json={'action': action, 'id': 'follow'}).status_code, 404)
            self.assertEqual([c['id'] for c in server.feed_snapshot()['comments']], ['comment', 'follow'])

    def test_public_privacy_does_not_mutate_private_records(self):
        record={'id':'p','user':'@private','comment':'Visita https://example.com o llama 555-123-4567','avatar_url':'https://example.com/a.jpg','sequence':1}
        with patch.object(server,'comment_history',[record]):
            self.client.post('/production/state', json={'hide_names':True,'hide_photos':True,'redact':True})
            public=self.client.get('/broadcast/feed').get_json()['comments'][0]
            self.assertEqual(public['user'],'Participante');self.assertIsNone(public['avatar_url'])
            self.assertNotIn('example.com',public['comment']);self.assertNotIn('555',public['comment'])
            self.assertEqual(record['user'],'@private')

    def test_emergency_and_non_talk_hide_public_messages(self):
        for data in ({'emergency':True},{'emergency':False,'scene':'pause'}):
            self.client.post('/production/state',json=data)
            feed=self.client.get('/broadcast/feed').get_json()
            self.assertEqual(feed['comments'],[]);self.assertEqual(feed['gifts'],[])
        self.assertEqual(self.client.post('/production/state',json={'scene':'invalid'}).status_code,400)

    def test_markers_include_elapsed_and_are_archived(self):
        with patch.object(server,'archive') as archive:
            response=self.client.post('/production/markers',json={'label':'Momento especial'})
            marker=response.get_json()['markers'][0]
            self.assertGreaterEqual(marker['elapsed'],0)
            self.assertEqual(marker['label'],'Momento especial')
            self.assertEqual(archive.save.call_args.args[1],'marker')

    def test_cross_origin_production_writes_rejected(self):
        self.assertEqual(self.client.post('/production/state',json={'emergency':True},headers={'Origin':'https://other.example'}).status_code,403)

    def test_redaction_keeps_ordinary_text(self):
        self.assertEqual(redact('Hola a todos'),'Hola a todos')
        self.assertNotIn('mail@example.com',redact('mail@example.com'))


if __name__ == '__main__':
    unittest.main()
