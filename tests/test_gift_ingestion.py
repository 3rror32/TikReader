import unittest
from types import SimpleNamespace as NS
from unittest.mock import patch
from contextlib import ExitStack

import server


class GiftIngestionTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        for name in ('observe_participant', 'publish_gift_history', 'publish_stats'):
            self.stack.enter_context(patch.object(server, name))
        for name in ('creator_suite', 'live_counters', 'interactive', 'points',
                     'game_hotkeys', 'animation_studio', 'overlay_animations'):
            self.stack.enter_context(patch.object(server, name))
        self.stack.enter_context(patch.object(server, 'archive', None))
        server.gift_counts.clear()
        server.gift_history.clear()
        server.gifter_totals.clear()
        server.gifter_diamonds.clear()
        server.state['gift_count'] = 0
        server.feed_session = 'test-' + self.id()

    def send(self, count, msg, end=False, group=0, log='', user='viewer'):
        return server.handle_gift_event(NS(
            user=NS(unique_id=user), gift=NS(id=5655, name='Rose', type=1,
            diamond_count=1, image=None), gift_id=5655, group_id=group,
            log_id=log, common=NS(msg_id=msg), repeat_count=count,
            repeat_end=int(end)))

    def test_missing_group_counts_before_final_and_deduplicates(self):
        self.send(1, 1)
        self.assertEqual(server.state['gift_count'], 1)
        self.send(2, 2)
        self.send(2, 2)
        self.send(2, 3, end=True)
        self.send(2, 3, end=True)
        self.send(1, 1)
        self.assertEqual(server.state['gift_count'], 2)
        self.assertEqual(len(server.gift_history), 1)
        self.assertFalse(next(iter(server.gift_history.values()))['ongoing'])

    def test_hotkeys_receive_only_new_gift_units(self):
        self.send(2, 1, group=5)
        self.send(4, 2, group=5)
        self.send(4, 2, group=5)
        self.send(4, 3, end=True, group=5)
        self.assertEqual([call.kwargs['quantity'] for call in server.game_hotkeys.gift.call_args_list], [2, 2])

    def test_new_streak_after_final_counts_again(self):
        self.send(2, 1, end=True)
        self.send(1, 2)
        self.send(1, 3, end=True)
        self.assertEqual(server.state['gift_count'], 3)

    def test_group_identifiers_keep_streaks_separate(self):
        for group, log in ((5, ''), (6, '')):
            self.send(1, str((group, log)), group=group, log=log)
            self.send(2, str((group, log, 'end')), end=True, group=group, log=log)
        self.assertEqual(server.state['gift_count'], 4)

    def test_out_of_order_lower_count_does_not_start_another_streak(self):
        self.send(2, 1)
        self.send(1, 2)
        self.send(2, 3, end=True)
        self.assertEqual(server.state['gift_count'], 2)

    def test_distinct_final_only_messages_count_separate_gifts(self):
        self.send(1, 1, end=True)
        self.send(1, 2, end=True)
        self.send(1, 2, end=True)
        self.assertEqual(server.state['gift_count'], 2)

    def test_session_scopes_group_identity(self):
        self.send(1, 1, group=5)
        server.feed_session += '-next'
        self.send(1, 1, group=5)
        self.assertEqual(server.state['gift_count'], 2)

    def test_changing_log_id_does_not_split_cumulative_streak(self):
        self.send(1, 1, log='a')
        self.send(2, 2, log='b')
        self.send(2, 3, end=True, log='c')
        self.assertEqual(server.state['gift_count'], 2)

    def test_fallback_expires_and_users_stay_separate(self):
        with patch.object(server.time, 'monotonic', return_value=10):
            self.send(1, 1)
            self.send(1, 2, user='another')
        with patch.object(server.time, 'monotonic', return_value=41):
            self.send(1, 3)
        self.assertEqual(server.state['gift_count'], 3)


if __name__ == '__main__':
    unittest.main()
