import copy
import queue
import time
import unittest
from unittest.mock import patch

import server


class SimulationTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        self.sim = server.simulation
        self.saved_production = dict(server.production.settings)
        self.patches = [
            patch.object(server, 'archive', None),
            patch.object(server, 'tiktok_thread', None),
            patch.object(server.game_hotkeys, 'mappings', []),
            patch.object(server.game_hotkeys, 'authorized', True),
            patch.object(server.game_hotkeys, 'paused', False),
            patch.object(server.game_hotkeys, 'active_profile', 'General'),
            patch.object(server.game_hotkeys, 'injector'),
            patch.object(server.interactive, 'rules', []),
            patch.object(server.animation_studio, 'templates', []),
            patch.object(server.overlay_animations, 'settings', copy.deepcopy(server.overlay_animations.settings)),
        ]
        for item in self.patches:
            item.start()
        self.sim.active = False
        server.state.update(connected=False, connecting=False)
        server.production.settings.update(emergency=False, scene='talk')

    def tearDown(self):
        self.sim.cancel.set()
        with self.sim.lock:
            self.sim.clear_actions()
            self.sim.active = False
        server.production.settings.update(self.saved_production)
        for item in reversed(self.patches):
            item.stop()

    def activate(self):
        response = self.client.post('/simulation', json={'action': 'activate'})
        self.assertEqual(response.status_code, 200, response.get_json())

    def test_new_simulation_session_resets_feed_identity_tracking(self):
        with patch.object(server, 'feed_cursor', 90), patch.object(server, 'moderation_revision', 4), \
                patch.object(server, 'live_lifecycle', dict(state='ended', revision=3)), \
                patch.object(server, 'moderated_messages', {'101': None}), patch.object(server, 'moderated_users', {'42': None}):
            self.sim.new_session('MODO_SIMULACION')
            self.assertEqual(server.feed_cursor, 0)
            self.assertEqual(server.moderation_revision, 0)
            self.assertEqual(server.moderated_messages, {})
            self.assertEqual(server.moderated_users, {})
            self.assertEqual(server.live_lifecycle['revision'], 0)

    def test_requires_offline_and_blocks_live_until_deactivated(self):
        server.state['connected'] = True
        self.assertEqual(self.client.post('/simulation', json={'action': 'activate'}).status_code, 409)
        server.state['connected'] = False
        self.activate()
        socket = server.socketio.test_client(server.app)
        with patch.object(server, 'run_tiktok_session') as run:
            socket.emit('start_live', {'username': 'tester'})
            self.assertTrue(any(e['name'] == 'tiktok_error' and e['args'][0]['code'] == 'SIMULATION_ACTIVE'
                                for e in socket.get_received()))
            run.assert_not_called()
        socket.disconnect()
        old_session = server.feed_session
        self.client.post('/simulation', json={'action': 'deactivate'})
        self.assertFalse(self.sim.active)
        self.assertNotEqual(server.feed_session, old_session)
        self.assertFalse(server.state['connected'])

    def test_comments_follow_live_rules_and_feed(self):
        self.activate()
        rule = server.interactive.validate(dict(id='sim-rule', name='Respuesta al chat',
            event='comment', match='hola', action='animation', value='Hola desde una regla', enabled=True))
        server.interactive.rules = [rule]
        spec = self.sim.validate({'kind':'comment', 'text':'hola', 'delay':0})
        self.sim.deliver(spec, 1, 'unused')
        self.assertEqual(server.state['comment_count'], 1)
        self.assertEqual(server.comment_history[-1]['comment'], 'hola')
        self.assertEqual(server.interactive.effects[-1]['value'], 'Hola desde una regla')

    def test_streaks_9_10_15_close_without_double_counting_and_use_real_hotkey_path(self):
        for amount in (9, 10, 15):
            with self.subTest(amount=amount):
                self.sim.active = False
                self.activate()
                mapping = server.game_hotkeys.validate(dict(id='sim-key', name='Salto', gift='Rose',
                    window='Juego de prueba', keys=['SPACE'], enabled=True, amount=amount,
                    condition='exact', cooldown=1))
                server.game_hotkeys.mappings = [mapping]
                spec = self.sim.validate({'kind':'gift', 'count':amount, 'gift':'Rose'})
                with patch.object(server.game_hotkeys, 'target', return_value=(123, 'Juego de prueba')):
                    for index in range(1, amount+1):
                        self.sim.deliver(spec, index, 'same-group')
                    self.sim.deliver(spec, amount, 'same-group', final=True)
                    server.game_hotkeys.jobs.join()
                self.assertEqual(server.state['gift_count'], amount)
                self.assertEqual(len(server.gift_history), 1)
                self.assertFalse(next(iter(server.gift_history.values()))['ongoing'])
                server.game_hotkeys.injector.assert_called_once_with(['SPACE'], 60, 0)
                server.game_hotkeys.injector.reset_mock()

    def test_simulated_catalog_gift_reaches_minecraft_preset_with_donor_name(self):
        gift = {'id': 'gg-catalog-42', 'name': 'GG', 'diamonds': 1,
                'image_url': 'https://example.test/gg.png'}
        minecraft = server.minecraft
        saved_presets = copy.deepcopy(minecraft.config.get('presets'))
        saved_authorized = minecraft.authorized
        minecraft.config['presets'] = {'zombie': {
            'gift_id': str(gift['id']), 'gift_name': 'GG', 'enabled': True}}
        minecraft.authorized = True
        try:
            with patch.object(self.sim.r, 'gift_catalog', {gift['id']: gift}), \
                    patch.object(minecraft, 'jobs', queue.Queue()):
                spec = self.sim.validate({'kind': 'gift', 'mode': 'separate', 'gift': 'GG',
                                          'user': 'GGDonor'})
                self.assertEqual(spec['gift_id'], str(gift['id']))
                self.sim.deliver(spec, 1, 'minecraft-gg')
                self.assertEqual(minecraft.jobs.qsize(), 1)
                job = minecraft.jobs.get_nowait()
                self.assertEqual(job.selected_ids, ('zombie',))
                self.assertIn('CustomName:{text:"GGDonor"}', job.commands[0])
        finally:
            minecraft.config.pop('presets', None)
            if saved_presets is not None:
                minecraft.config['presets'] = saved_presets
            minecraft.authorized = saved_authorized

    def test_simulated_unresolved_gift_reaches_unique_saved_minecraft_mapping(self):
        minecraft = server.minecraft
        saved_presets = copy.deepcopy(minecraft.config.get('presets'))
        saved_authorized = minecraft.authorized
        saved_preset_owner = minecraft.preset_owner
        saved_preset_usage = copy.deepcopy(minecraft.preset_usage)
        saved_last_preset_at = minecraft.last_preset_at
        minecraft.config['presets'] = {'zombie': {
            'gift_id': 'saved-gg-id', 'gift_name': 'GG', 'enabled': True}}
        minecraft.authorized = True
        minecraft.preset_owner = None
        minecraft.preset_usage.clear()
        minecraft.last_preset_at = None
        try:
            with patch.object(self.sim.r, 'gift_catalog', {}), \
                    patch.object(minecraft, 'jobs', queue.Queue()):
                spec = self.sim.validate({'kind': 'gift', 'mode': 'streak', 'gift': 'GG',
                                          'user': 'GGDonor', 'count': 3})
                self.assertEqual(spec['gift_id'], 'saved-gg-id')
                self.sim.deliver(spec, 3, 'minecraft-gg', final=True)
                self.assertEqual(minecraft.jobs.qsize(), 1)
                job = minecraft.jobs.get_nowait()
                self.assertEqual(job.selected_ids, ('zombie',))
                self.assertEqual(job.donor, 'GGDonor')
                self.assertEqual(job.gift_count, 3)
        finally:
            minecraft.config.pop('presets', None)
            if saved_presets is not None:
                minecraft.config['presets'] = saved_presets
            minecraft.authorized = saved_authorized
            minecraft.preset_owner = saved_preset_owner
            minecraft.preset_usage = saved_preset_usage
            minecraft.last_preset_at = saved_last_preset_at

    def test_simulated_unresolved_gift_does_not_guess_duplicate_saved_mapping_names(self):
        minecraft = server.minecraft
        saved_presets = copy.deepcopy(minecraft.config.get('presets'))
        minecraft.config['presets'] = {
            'zombie': {'gift_id': 'saved-gg-one', 'gift_name': 'GG', 'enabled': True},
            'diamonds': {'gift_id': 'saved-gg-two', 'gift_name': 'GG', 'enabled': True},
        }
        try:
            with patch.object(self.sim.r, 'gift_catalog', {}):
                with self.assertRaisesRegex(ValueError, 'varias acciones'):
                    self.sim.validate({'kind': 'gift', 'gift': 'GG'})
        finally:
            minecraft.config.pop('presets', None)
            if saved_presets is not None:
                minecraft.config['presets'] = saved_presets

    def test_simulation_preserves_selected_catalog_id_when_names_are_duplicated(self):
        first = {'id': 'rose-standard', 'name': 'Rose', 'diamonds': 1,
                 'image_url': 'https://example.test/rose.png'}
        second = {'id': 'rose-special', 'name': 'Rose', 'diamonds': 5,
                  'image_url': 'https://example.test/rose-special.png'}
        with patch.object(self.sim.r, 'gift_catalog', {first['id']: first, second['id']: second}):
            spec = self.sim.validate({'kind': 'gift', 'gift': 'Rose', 'gift_id': 'rose-special'})
        self.assertEqual(spec['gift_id'], 'rose-special')
        self.assertEqual(spec['diamonds'], 5)
        self.assertEqual(spec['image'], second['image_url'])

    def test_duplicate_catalog_names_require_an_explicit_gift_id(self):
        first = {'id': 'rose-standard', 'name': 'Rose', 'diamonds': 1}
        second = {'id': 'rose-special', 'name': 'Rose', 'diamonds': 5}
        with patch.object(self.sim.r, 'gift_catalog', {first['id']: first, second['id']: second}):
            with self.assertRaisesRegex(ValueError, 'ambigu'):
                self.sim.validate({'kind': 'gift', 'gift': 'Rose'})

    def test_simulation_does_not_guess_between_duplicate_catalog_names(self):
        first = {'id': 'gift-first', 'name': 'Mystery', 'diamonds': 1,
                 'image_url': 'https://example.test/first.png'}
        second = {'id': 'gift-second', 'name': 'Mystery', 'diamonds': 5,
                  'image_url': 'https://example.test/second.png'}
        with patch.object(self.sim.r, 'gift_catalog', {first['id']: first, second['id']: second}):
            with self.assertRaisesRegex(ValueError, 'ambigu'):
                self.sim.validate({'kind': 'gift', 'gift': 'Mystery'})

    def test_simulated_gift_record_has_explicit_origin_flag(self):
        self.activate()
        spec = self.sim.validate({'kind': 'gift', 'mode': 'separate', 'gift': 'Rose'})
        self.sim.deliver(spec, 1, 'simulated-origin')
        record = next(reversed(server.gift_history.values()))
        self.assertIs(record['simulated'], True)

        event = type('LiveGiftEvent', (), {
            'simulated': True,
            'user': type('User', (), {'unique_id': 'live-donor'})(),
            'gift': type('Gift', (), {'id': 'live-gift', 'name': 'Rose', 'diamond_count': 1,
                                      'type': 0, 'image': None})(),
            'gift_id': 'live-gift', 'common': type('Common', (), {'msg_id': 'live-message'})(),
            'repeat_count': 1, 'repeat_end': True,
        })()
        live_record = server.handle_gift_event(event, update_catalog=False)['record']
        self.assertIs(live_record['simulated'], False)

    def test_separate_events_have_distinct_identity_without_cooldown_loss(self):
        self.activate()
        server.game_hotkeys.mappings = [server.game_hotkeys.validate(dict(id='sim-key',
            name='Salto', gift='Rose', window='Juego', keys=['SPACE'], enabled=True, cooldown=30))]
        spec = self.sim.validate({'kind':'gift', 'mode':'separate', 'count':3})
        with patch.object(server.game_hotkeys, 'target', return_value=(123, 'Juego')):
            for index in range(1, 4):
                self.sim.deliver(spec, index, 'unused')
            server.game_hotkeys.jobs.join()
        self.assertEqual(server.state['gift_count'], 3)
        self.assertEqual(len(server.gift_history), 3)
        self.assertEqual(server.game_hotkeys.injector.call_count, 3)
        self.assertEqual(self.sim.events[-1]['hotkeys'][0]['result'], 'Coincide')

    def test_simulated_gift_sends_enter_after_global_activation_and_stops_after_disable(self):
        self.activate()
        server.game_hotkeys.mappings=[server.game_hotkeys.validate(dict(id='sim-enter',name='Pausa',gift='Rose',window='Juego',keys=['ENTER'],enabled=False,cooldown=1))]
        response=self.client.post('/game-hotkeys/all',json={'enabled':True,'confirmation':'AUTORIZAR HOTKEYS'})
        self.assertEqual(response.status_code,200)
        spec=self.sim.validate({'kind':'gift','gift':'Rose','count':1})
        with patch.object(server.game_hotkeys,'target',return_value=(123,'Juego')):
            self.sim.deliver(spec,1,'enter-1');server.game_hotkeys.jobs.join()
            server.game_hotkeys.injector.assert_called_once_with(['ENTER'],60,0)
            self.client.post('/game-hotkeys/all',json={'enabled':False})
            self.sim.deliver(spec,1,'enter-2');server.game_hotkeys.jobs.join()
            server.game_hotkeys.injector.assert_called_once()
        self.assertIn('desactivada',self.sim.events[-1]['hotkeys'][0]['result'])

    def test_simulated_enter_explains_wrong_foreground_window(self):
        self.activate()
        server.game_hotkeys.mappings=[server.game_hotkeys.validate(dict(id='sim-enter',name='Pausa',gift='Rose',window='Juego',keys=['ENTER'],enabled=True))]
        spec=self.sim.validate({'kind':'gift','gift':'Rose','count':1})
        with patch('game_hotkeys.foreground',return_value=(123,'Chrome')):
            self.sim.deliver(spec,1,'wrong-window');server.game_hotkeys.jobs.join()
        server.game_hotkeys.injector.assert_not_called()
        self.assertIn('Chrome',server.game_hotkeys.log[0]['text'])
        self.assertEqual(server.game_hotkeys.log[0]['outcome'],'Bloqueada')

    def test_streak_updates_overlays_and_counter_without_polluting_catalog(self):
        self.activate()
        original = copy.deepcopy(server.gift_catalog)
        server.overlay_animations.settings['coins'].update(enabled=True, gift='SimGift', amount=2)
        server.animation_studio.templates = [server.animation_studio.validate(dict(
            name='Aviso', text='Regalo recibido', gift='SimGift', amount=2, enabled=True))]
        spec = self.sim.validate({'kind':'gift', 'gift':'SimGift', 'count':3, 'diamonds':5})
        for index in (1, 2, 3):
            self.sim.deliver(spec, index, 'overlay-group')
        self.sim.deliver(spec, 3, 'overlay-group', final=True)
        self.assertEqual(len(server.animation_studio.events), 1)
        self.assertEqual(len(server.overlay_animations.events), 1)
        totals, gifts = server.live_counters.snapshot()
        self.assertEqual(totals['coins'], 15)
        self.assertEqual(gifts['simgift'], 3)
        self.assertEqual(server.gift_catalog, original)

    def test_scheduled_streak_completes_and_rejects_unapproved_hotkeys(self):
        self.activate()
        server.game_hotkeys.authorized = False
        server.game_hotkeys.mappings = [server.game_hotkeys.validate(dict(id='blocked-key',
            name='Bloqueada', gift='Rose', window='Juego', keys=['SPACE'], enabled=True))]
        response = self.client.post('/simulation/events', json={'kind':'gift', 'count':3, 'interval':.1, 'delay':0})
        self.assertEqual(response.status_code, 202)
        deadline = time.monotonic()+2
        while self.sim.batch['running'] and time.monotonic() < deadline:
            time.sleep(.02)
        self.assertEqual(self.sim.batch['status'], 'Envío terminado')
        self.assertEqual(server.state['gift_count'], 3)
        self.assertEqual(len(self.sim.events), 4)
        self.assertEqual(self.sim.events[0]['hotkeys'][0]['result'], 'Sin autorización')
        server.game_hotkeys.injector.assert_not_called()

    def test_stop_cancels_scheduled_event_and_survives_state_reload(self):
        self.activate()
        response = self.client.post('/simulation/events', json={'kind':'comment', 'text':'No enviar', 'delay':.2})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(self.client.post('/simulation/events', json={'text':'Segundo'}).status_code, 202)
        self.client.post('/simulation', json={'action':'stop'})
        time.sleep(.25)
        self.assertEqual(server.state['comment_count'], 0)
        payload = self.client.get('/simulation').get_json()
        self.assertTrue(payload['active'])
        self.assertFalse(payload['batch']['running'])
        self.assertTrue(payload['muted'])

    def test_concurrent_submissions_are_delivered_in_order(self):
        self.activate()
        for text, delay in [('First', .1), ('Second', 0), ('Third', 0)]:
            response = self.client.post('/simulation/events', json={'text': text, 'delay': delay})
            self.assertEqual(response.status_code, 202)
        deadline = time.monotonic() + 2
        while len(self.sim.events) < 3 and time.monotonic() < deadline:
            time.sleep(.01)
        self.assertEqual([event['text'] for event in self.sim.events], ['First', 'Second', 'Third'])

    def test_stack_jump_dispatches_every_new_unit_once(self):
        self.activate()
        server.game_hotkeys.mappings = [server.game_hotkeys.validate(dict(id='stack-key',
            gift='Rose', window='Juego', keys=['SPACE'], enabled=True, cooldown=30))]
        spec = self.sim.validate({'kind': 'gift', 'gift': 'Rose', 'count': 4})
        with patch.object(server.game_hotkeys, 'target', return_value=(123, 'Juego')):
            self.sim.deliver(spec, 2, 'stack-jump')
            self.sim.deliver(spec, 4, 'stack-jump')
            self.sim.deliver(spec, 4, 'stack-jump', final=True)
            server.game_hotkeys.jobs.join()
        self.assertEqual(server.game_hotkeys.injector.call_count, 4)

    def test_inputs_are_bounded_and_remote_control_is_rejected(self):
        self.assertEqual(self.client.post('/simulation/events', json={'text':'hola'}).status_code, 409)
        self.activate()
        for data in ({'kind':'gift','count':10000}, {'kind':'gift','count':1.5},
                     {'kind':'gift','interval':0}, {'kind':'gift','count':9999,'interval':60},
                     {'text':''}, {'text':'hola','delay':float('nan')}, {'text':'hola','delay':True}):
            self.assertEqual(self.client.post('/simulation/events', json=data).status_code, 400, data)
        self.assertEqual(self.client.post('/simulation', json={'action':'activate'},
            environ_base={'REMOTE_ADDR':'192.168.1.12'}).status_code, 403)
        self.assertEqual(self.client.post('/simulation', json={'action':'stop'},
            headers={'Origin':'https://example.com'}).status_code, 403)

    def test_simulated_gift_event_includes_catalog_artwork_and_quantity(self):
        rose = {'id': 'rose-catalog-42', 'name': 'Rose', 'diamonds': 1,
                'image_url': 'https://example.test/rose.png'}
        with patch.object(self.sim.r, 'gift_catalog', {rose['id']: rose}), \
                patch.object(server, 'handle_gift_event', return_value={
                    'hotkeys': [], 'record': {'image_url': rose['image_url']}}):
            spec = self.sim.validate({'kind': 'gift', 'mode': 'separate', 'gift': 'Rose'})
            self.sim.deliver(spec, 1, 'artwork-event')
        event = self.sim.events[-1]
        self.assertEqual(event['gift'], 'Rose')
        self.assertEqual(event['count'], 1)
        self.assertEqual(event['image_url'], rose['image_url'])
        self.assertEqual(event['text'], '1 regalo · Rose')

    def test_simulated_gift_event_uses_plural_wording_for_multiple_gifts(self):
        with patch.object(server, 'handle_gift_event', return_value={
                'hotkeys': [], 'record': {'image_url': None}}):
            spec = self.sim.validate({'kind': 'gift', 'mode': 'streak', 'count': 2, 'gift': 'Creeper'})
            self.sim.deliver(spec, 2, 'plural-event')
        self.assertEqual(self.sim.events[-1]['count'], 2)
        self.assertEqual(self.sim.events[-1]['text'], '2 regalos · Creeper')

    def test_simulated_gift_event_uses_validated_catalog_artwork_url(self):
        rose = {'id': 'rose-catalog-unsafe', 'name': 'Rose', 'diamonds': 1,
                'image_url': 'https://user:password@example.test/rose.png'}
        with patch.object(self.sim.r, 'gift_catalog', {rose['id']: rose}), \
                patch.object(server.minecraft, 'gift'):
            spec = self.sim.validate({'kind': 'gift', 'mode': 'separate', 'gift': 'Rose'})
            self.sim.deliver(spec, 1, 'unsafe-artwork')
        self.assertIsNone(self.sim.events[-1]['image_url'])


if __name__ == '__main__':
    unittest.main()
