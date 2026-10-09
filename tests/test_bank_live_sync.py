"""LIVE bank accounting without connecting to TikTok or writing user data."""
import threading
from collections import OrderedDict, Counter, deque
from types import SimpleNamespace
from unittest.mock import Mock
import unittest
from interactivity import Interactivity
import bank_storage


def bank():
    i = Interactivity.__new__(Interactivity)
    archive = SimpleNamespace(set_setting=Mock())
    i.r = SimpleNamespace(feed_session='test', archive=archive, gift_catalog={},
                          production=SimpleNamespace(settings={'emergency': False, 'scene': 'talk'}))
    i.lock = threading.RLock()
    i.session = 'test'
    i.seen = OrderedDict()
    i.rules = []
    i.trace = deque()
    i.poll = None
    i.overlay_serial = 0
    i.overlay_games = {'drop': dict(score=0, events=[], contents=[], epoch='test', shapes={},
                                    custom_bank_asset=None, bank_position={'x': 50.0, 'y': 50.0},
                                    bank_scale=100.0, entry_point={'x': 50.0, 'y': 16.0})}
    i.last = {}
    i.usage = {}
    i.pending = []
    i.omissions = Counter()
    i.log = deque()
    return i


class BankLiveSyncTests(unittest.TestCase):
    def test_legacy_bank_scale_migrates_only_to_selected_bank_and_validates_ids(self):
        restored = bank_storage.normalize_custom_bank_fields({'bank': 'pato', 'bank_scale': 137})
        self.assertEqual(restored['bank_scale'], 137)
        self.assertEqual(restored['bank_scales']['pato'], 137)
        self.assertEqual(restored['bank_scales']['cochito'], 100)
        self.assertNotIn('../outside', restored['bank_scales'])

    def test_bank_scale_updates_selected_model_and_rejects_arbitrary_map_keys(self):
        current = {'bank': 'pato', 'bank_scale': 137, 'bank_scales': {'pato': 137, 'custom': 85}}
        updated = bank_storage.validate_custom_bank_fields({'bank': 'oso', 'bank_scale': 155}, current)
        self.assertEqual(updated['bank_scale'], 155)
        self.assertEqual(updated['bank_scales']['oso'], 155)
        self.assertEqual(updated['bank_scales']['pato'], 137)
        with self.assertRaises(ValueError):
            bank_storage.validate_custom_bank_fields({'bank_scales': {'../outside': 100}}, current)

    def test_new_live_clears_bank_but_preserves_visual_configuration(self):
        i = bank()
        i.overlay_games['drop'].update(score=7, contents=[{'id': 1}], events=[{'id': 1}],
                                       event={'id': 1}, source_counts={'gift': 7},
                                       shapes={'cochito': {'points': [], 'slot': [50, 10]}},
                                       custom_bank_asset='a'*32+'.png',
                                       bank_position={'x': 24.0, 'y': 76.0}, bank_scale=125.0,
                                       entry_point={'x': 52.0, 'y': 18.0})
        old_epoch = i.overlay_games['drop']['epoch']
        i.reset_live_session()
        state = i.overlay_games['drop']
        self.assertEqual((state['score'], state['contents'], state['events'], state['event']),
                         (0, [], [], None))
        self.assertEqual(state['source_counts'], {})
        self.assertNotEqual(state['epoch'], old_epoch)
        self.assertIn('cochito', state['shapes'])
        self.assertEqual(state['custom_bank_asset'], 'a'*32+'.png')
        self.assertEqual(state['bank_position'], {'x': 24.0, 'y': 76.0})
        self.assertEqual(state['bank_scale'], 125.0)
        self.assertEqual(state['entry_point'], {'x': 52.0, 'y': 18.0})
        i.r.archive.set_setting.assert_called_once()

    def test_combo_deltas_duplicates_and_other_gifts(self):
        i = bank()
        rose = dict(id='combo', gift='Rose', gift_id='5655', user='@donor', count=1)
        i.event('gift', rose, 'combo:1', quantity=1)
        rose = dict(rose, count=3)
        i.event('gift', rose, 'combo:3', quantity=2)
        i.event('gift', rose, 'combo:3', quantity=2)
        i.event('gift', dict(gift='Heart', gift_id='9'), 'message:9', quantity=2)
        d = i.overlay_games['drop']
        assert d['score'] == 5
        assert [e['gift'] for e in d['contents']] == ['Rose'] * 3 + ['Heart'] * 2
        assert len({e['id'] for e in d['contents']}) == 5


    def test_gift_drop_rule_does_not_deposit_twice(self):
        i = bank()
        i.rules = [dict(id='r', name='old drop', event='gift', action='drop', enabled=True,
                        match='', cooldown=60, delay=0)]
        for count in (1, 3):
            i.event('gift', dict(gift='Rose', count=count), f'combo:{count}', quantity=1 if count == 1 else 2)
        assert i.overlay_games['drop']['score'] == 3


    def test_hidden_broadcast_keeps_received_gifts(self):
        settings = {"emergency": True, "scene": "talk"}
        i = bank()
        i.r.production.settings = settings
        i.event('gift', dict(gift='Rose'), 'muted:1', quantity=4)
        assert i.overlay_games['drop']['score'] == 4
        assert len(i.overlay_games['drop']['contents']) == 4
        i.r.archive.set_setting.assert_called_once()


    def test_large_combo_retains_total_with_bounded_visual_contents(self):
        i = bank()
        i.event('gift', dict(gift='Rose'), 'big:1000', quantity=1000)
        d = i.overlay_games['drop']
        assert d['score'] == 1000
        assert len(d['contents']) == 220
        assert d['contents'][-1]['id'] == 1000

    def test_recovery_fills_existing_gifts_once_then_adds_combo_difference(self):
        i = bank()
        records = [dict(id='a', gift='Rose', count=3), dict(id='b', gift='Heart', count=5)]
        i.recover_gifts(records)
        assert i.overlay_games['drop']['score'] == 8
        i.recover_gifts(records)
        assert i.overlay_games['drop']['score'] == 8
        i.event('gift', dict(records[0], count=4), 'a:4', quantity=1)
        i.recover_gifts([dict(records[0], count=4), records[1]])
        assert i.overlay_games['drop']['score'] == 9

    def test_recovery_after_restart_uses_saved_counts_even_when_tokens_are_capped(self):
        import bank_storage
        i = bank()
        records = [dict(id='big', gift='Rose', count=1000)]
        i.recover_gifts(records)
        saved = i.r.archive.set_setting.call_args.args[1]
        restored = bank()
        restored.r.archive.settings = Mock(return_value={'bank_contents': saved})
        bank_storage.restore(restored.r, restored.overlay_games['drop'])
        restored.recover_gifts(records)
        assert restored.overlay_games['drop']['score'] == 1000
        assert len(restored.overlay_games['drop']['contents']) == 220
