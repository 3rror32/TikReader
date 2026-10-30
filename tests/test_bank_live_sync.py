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
    def test_delete_custom_bank_preserves_donations_and_builtin_configuration(self):
        from flask import Flask
        from bank_assets import BankAssetStore
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as folder:
            i=bank();i.running=False;i.remaining=0
            i.overlay_games['wheel']={'spinning':False}
            state=i.overlay_games['drop'];asset='a'*32+'.png'
            state.update(bank='custom',custom_bank_asset=asset,score=17,contents=[{'id':1}],
                         bank_scales={'pato':135,'custom':125},bank_positions={'pato':{'x':20,'y':30},'custom':{'x':31,'y':62}},
                         shapes={'pato':{'slot':[50,10]},'custom':{'slot':[50,16]}})
            app=Flask(__name__);store=BankAssetStore(Path(folder));app.extensions['point_drop_bank_assets']=store
            store.path_for(asset).write_bytes(b'image');i.register(app);client=app.test_client()
            stale=client.post('/interactivity/overlays',json={'game':'drop','action':'delete_custom_bank','expected_asset_id':'../outside'})
            self.assertEqual(stale.status_code,400);self.assertTrue(store.path_for(asset).exists())
            with patch.object(Path,'unlink',side_effect=PermissionError):
                failed=client.post('/interactivity/overlays',json={'game':'drop','action':'delete_custom_bank','expected_asset_id':asset})
            self.assertEqual(failed.status_code,500);self.assertEqual(state['custom_bank_asset'],asset)
            response=client.post('/interactivity/overlays',json={'game':'drop','action':'delete_custom_bank','expected_asset_id':asset})
            self.assertEqual(response.status_code,200,response.get_json());self.assertFalse(store.path_for(asset).exists())
            self.assertEqual(state['bank'],'cochito');self.assertIsNone(state['custom_bank_asset'])
            self.assertEqual((state['score'],state['contents'],state['epoch']),(17,[{'id':1}],'test'))
            self.assertEqual(state['bank_positions'],{'pato':{'x':20,'y':30}})
            self.assertEqual(state['bank_scales'],{'pato':135,'custom':100})
            self.assertEqual(state['shapes'],{'pato':{'slot':[50,10]}})
            saved=dict(i.r.archive.set_setting.call_args_list[-2].args[1]['drop'])
            self.assertIsNone(saved['custom_bank_asset']);self.assertEqual(saved['bank'],'cochito')
            state.update(bank='pato',bank_scale=135,custom_bank_asset=asset)
            again=client.post('/interactivity/overlays',json={'game':'drop','action':'delete_custom_bank','expected_asset_id':asset})
            self.assertEqual(again.status_code,200);self.assertEqual(state['bank'],'pato');self.assertEqual(state['bank_scale'],135)

    def test_model_positions_validate_and_restore_independently(self):
        current = {'bank': 'pato', 'bank_position': {'x': 20, 'y': 30}}
        updated = bank_storage.validate_custom_bank_fields({'bank_positions': {'pato': {'x': 24, 'y': 65}}}, current)
        restored = bank_storage.normalize_custom_bank_fields(updated)
        self.assertEqual(restored['bank_positions'], {'pato': {'x': 24, 'y': 65}})
        self.assertEqual(restored['bank_position'], {'x': 20, 'y': 30})
        self.assertEqual(bank_storage.normalize_custom_bank_fields({})['bank_positions'], {})
        for pair in ({'x': True, 'y': 50}, {'x': float('nan'), 'y': 50}, {'x': float('inf'), 'y': 50}, {'x': -1, 'y': 50}, {'x': 50, 'y': 101}):
            with self.subTest(pair=pair), self.assertRaises(ValueError):
                bank_storage.validate_custom_bank_fields({'bank_positions': {'pato': pair}}, current)
        with self.assertRaises(ValueError):
            bank_storage.validate_custom_bank_fields({'bank_positions': {'unknown': {'x': 50, 'y': 50}}}, current)

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
