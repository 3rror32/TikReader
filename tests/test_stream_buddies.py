from pathlib import Path
import json
import statistics
import threading
import unittest
from types import SimpleNamespace
from flask import Flask
from PIL import Image
from stream_buddies import StreamBuddies


class BuddiesTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'web' / 'templates'))
        self.saved = {}
        self.r = SimpleNamespace(feed_lock=threading.RLock(), feed_session='one',
            gifter_diamonds={'@luna': 10, '@alex': 300, '@unknown': 0},
            comment_history=[dict(id='1', session='one', user='@Alex', comment='hola'),
                             dict(id='2', session='one', user='@Alex', comment='<b>último</b>'),
                             dict(id='3', session='old', user='@Alex', comment='viejo')],
            archive=SimpleNamespace(settings=lambda: self.saved, set_setting=lambda k,v: self.saved.update({k:v})),
            production=SimpleNamespace(settings=dict(emergency=False,scene='talk'), sanitize=lambda d:d))
        self.buddies = StreamBuddies(self.app, self.r)
        self.client = self.app.test_client()

    def test_ranks_coin_value_and_matches_latest_session_comment(self):
        d = self.client.get('/broadcast/stream-buddies').get_json()
        self.assertEqual([x['user'] for x in d['members']], ['@alex','@luna'])
        self.assertEqual(d['members'][0]['comment'], '<b>último</b>')
        self.assertEqual(d['members'][0]['comment_id'], '2')
        self.assertNotIn('@alex', d['members'][0]['id'])

    def test_follow_activity_does_not_replace_latest_comment_bubble(self):
        for kind in ('follow', 'share', 'subscribe', 'super_fan', 'super_fan_join'):
            self.r.comment_history.append(dict(id=kind, session='one', kind=kind, user='@Alex', comment='actividad'))
        member = self.buddies.snapshot()['members'][0]
        self.assertEqual(member['comment'], '<b>último</b>')
        self.assertEqual(member['comment_id'], '2')

    def test_settings_persist_validate_and_limit(self):
        for layout in ('vertical', 'horizontal'):
            self.assertEqual(self.client.post('/stream-buddies',json={'canvas_format':layout}).status_code,200)
            self.buddies.restore()
            self.assertEqual(self.buddies.settings['canvas_format'],layout)
        for layout in ('auto','square'):
            self.assertEqual(self.client.post('/stream-buddies',json={'canvas_format':layout}).status_code,400)
        self.assertEqual(self.client.post('/stream-buddies',json={'max_friends':1,'theme':'mascotas'}).status_code,200)
        self.buddies.restore()
        self.assertEqual(len(self.buddies.snapshot()['members']),1)
        for payload in ({'max_friends':500},{'base_size':250,'max_size':100},{'font':'url(x)'},{'bubbles':'yes'},[]):
            self.assertEqual(self.client.post('/stream-buddies',json=payload).status_code,400)

    def test_pokemon_collection_is_selectable_and_assigns_only_its_roster(self):
        expected = [
            'pokemon-pikachu', 'pokemon-eevee', 'pokemon-charizard', 'pokemon-bulbasaur',
            'pokemon-squirtle', 'pokemon-mewtwo', 'pokemon-gengar', 'pokemon-snorlax',
        ]
        response = self.client.get('/stream-buddies').get_json()
        pokemon = [character for character in response['characters'] if character['theme'] == 'pokemon']
        self.assertEqual([character['id'] for character in pokemon], expected)
        self.assertEqual(self.client.post('/stream-buddies', json={'theme': 'pokemon'}).status_code, 200)
        first = {member['user']: member['character_id'] for member in self.buddies.snapshot()['members']}
        second = {member['user']: member['character_id'] for member in self.buddies.snapshot()['members']}
        self.assertTrue(all(character in expected for character in first.values()))
        self.assertEqual(first, second)
        self.assertEqual(len(set(first.values())), len(first))

    def test_pokemon_walk_and_idle_bounds_follow_ground_line(self):
        root = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'walk-v3'
        names = ('pikachu', 'eevee', 'charizard', 'bulbasaur', 'squirtle', 'mewtwo', 'gengar', 'snorlax')
        credits = json.loads((root / 'pokemon-credits.json').read_text(encoding='utf-8'))
        for name in names:
            with self.subTest(pokemon=name):
                entry = credits['attributions'][f'pokemon-{name}']
                walk = Image.open(root / f'pokemon-{name}.png').convert('RGBA')
                idle = Image.open(root / f'pokemon-{name}-idle.png').convert('RGBA')
                count = entry['source_walk_frame_count']
                boxes = [walk.crop((i * 128, 0, (i + 1) * 128, 128)).getchannel('A').getbbox()
                         for i in range(count)]
                idle_box = idle.getchannel('A').getbbox()
                self.assertTrue(all(boxes) and idle_box)
                self.assertTrue(all(abs(box[3] - 120) <= 2 for box in boxes), 'walk alpha should reach the ground line')
                self.assertLessEqual(abs(idle_box[3] - 120), 2, 'idle alpha should reach the ground line')

    def test_pokemon_walk_and_idle_use_consistent_visible_scale(self):
        root = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'walk-v3'
        names = ('pikachu', 'eevee', 'charizard', 'bulbasaur', 'squirtle', 'mewtwo', 'gengar', 'snorlax')
        credits = json.loads((root / 'pokemon-credits.json').read_text(encoding='utf-8'))
        for name in names:
            with self.subTest(pokemon=name):
                entry = credits['attributions'][f'pokemon-{name}']
                walk = Image.open(root / f'pokemon-{name}.png').convert('RGBA')
                idle = Image.open(root / f'pokemon-{name}-idle.png').convert('RGBA')
                count = entry['source_walk_frame_count']
                boxes = [walk.crop((i * 128, 0, (i + 1) * 128, 128)).getchannel('A').getbbox()
                         for i in range(count)]
                idle_box = idle.getchannel('A').getbbox()
                self.assertTrue(all(boxes) and idle_box)
                for axis in (0, 1):
                    walk_extent = statistics.median(box[axis + 2] - box[axis] for box in boxes)
                    idle_extent = idle_box[axis + 2] - idle_box[axis]
                    ratio = idle_extent / walk_extent
                    self.assertGreaterEqual(ratio, 0.75, 'idle should not shrink relative to walk')
                    self.assertLessEqual(ratio, 1.33, 'idle should not grow relative to walk')

    def test_pokemon_walk_and_idle_silhouettes_have_horizontal_cell_margins(self):
        root = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'walk-v3'
        names = ('pikachu', 'eevee', 'charizard', 'bulbasaur', 'squirtle', 'mewtwo', 'gengar', 'snorlax')
        credits = json.loads((root / 'pokemon-credits.json').read_text(encoding='utf-8'))
        for name in names:
            with self.subTest(pokemon=name):
                entry = credits['attributions'][f'pokemon-{name}']
                walk = Image.open(root / f'pokemon-{name}.png').convert('RGBA')
                idle = Image.open(root / f'pokemon-{name}-idle.png').convert('RGBA')
                frames = [walk.crop((i * 128, 0, (i + 1) * 128, 128))
                          for i in range(entry['source_walk_frame_count'])]
                for kind, cells in (('walk', frames), ('idle', [idle])):
                    for index, cell in enumerate(cells):
                        box = cell.getchannel('A').getbbox()
                        self.assertIsNotNone(box, f'{kind} {index} is empty')
                        self.assertGreaterEqual(box[0], 4, f'{kind} {index} lacks a left margin')
                        self.assertLessEqual(box[2], 124, f'{kind} {index} lacks a right margin')

    def test_scene_emergency_disabled_and_session_reset(self):
        old=self.buddies.snapshot()['members'][0]['id']
        self.r.feed_session='two'
        self.assertNotEqual(self.buddies.snapshot()['members'][0]['id'],old)
        self.assertEqual(self.buddies.snapshot()['members'][0]['comment'],'')
        for key,value in [('scene','pause'),('emergency',True)]:
            self.r.production.settings[key]=value
            self.assertEqual(self.buddies.snapshot()['members'],[])
            self.r.production.settings.update(scene='talk',emergency=False)
        self.buddies.settings['enabled']=False
        self.assertEqual(self.buddies.snapshot()['members'],[])

    def test_widget_and_sanitization(self):
        self.assertEqual(self.client.get('/widget/stream-buddies?preview=1').status_code,200)
        self.r.production.sanitize=lambda d:{**d,'members':[],'sanitized':True}
        self.assertTrue(self.buddies.snapshot()['sanitized'])

    def test_shuffle_bag_and_identity_survive_ranking_and_collection_changes(self):
        self.r.gifter_diamonds = {f'user{i}': i + 1 for i in range(10)}
        first = {m['user']: m['character_id'] for m in self.buddies.snapshot()['members']}
        self.assertEqual(len(set(first.values())), 10)
        self.r.gifter_diamonds['user0'] = 5000
        self.r.gifter_diamonds['user10'] = 6000
        second = {m['user']: m['character_id'] for m in self.buddies.snapshot()['members']}
        self.assertEqual({k: second[k] for k in first}, first)
        self.assertIn(second['user10'], first.values())
        self.buddies.settings['theme'] = 'cyborgs'
        self.assertTrue(all(m['character_id'].startswith('cyborgs-') for m in self.buddies.snapshot()['members']))
        self.buddies.settings['theme'] = 'fantasia'
        self.assertEqual({m['user']: m['character_id'] for m in self.buddies.snapshot()['members']}, second)
        self.r.feed_session = 'new'
        self.r.gifter_diamonds = {'new-user': 1}
        self.buddies.snapshot()
        self.assertEqual(len(self.buddies.assignments), 1)

    def test_old_settings_migrate_and_threshold_persists(self):
        self.saved['stream_buddies'] = dict(theme='todos', base_size=100, max_size=250)
        self.buddies.restore()
        self.assertEqual(self.buddies.settings['theme'], 'fantasia')
        self.assertEqual(self.buddies.settings['max_size'], 112)
        self.assertEqual(self.client.post('/stream-buddies', json={'coins_to_max': 2000}).status_code, 200)
        self.buddies.restore()
        self.assertEqual(self.buddies.settings['coins_to_max'], 2000)
        self.assertEqual(self.client.post('/stream-buddies', json={'coins_to_max': 0}).status_code, 400)


if __name__ == '__main__':
    unittest.main()
