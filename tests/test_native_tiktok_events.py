import copy
import unittest
from types import SimpleNamespace as S
from unittest.mock import patch

import server
from TikTokLive.events import QuestionNewEvent, PollEvent
from TikTokLiveProto.v3.webcast.model.message import (
    Question, PollStartContent, PollEndContent, PollUpdateVotesContent, PollOptionInfo,
)
from TikTokLiveProto.v3.webcast.model.base.user import User


class NativeTikTokTests(unittest.TestCase):
    def setUp(self):
        self.p, self.i = server.production, server.interactive
        self.old_questions = copy.deepcopy(self.p.questions)
        self.old_seen = set(self.p.seen)
        self.p.questions.clear(); self.p.seen.clear()
        self.i.reset_native_poll()

    def tearDown(self):
        self.p.questions = self.old_questions; self.p.seen = self.old_seen
        self.i.reset_native_poll()

    def test_native_question_without_punctuation_deduplicates_and_is_moderated(self):
        event = QuestionNewEvent(data=Question(question_id=9007199254740993, content='Tema del siguiente video',
                                              user=User(id=42, display_id='account', nickname='Visible')))
        event.common = S(msg_id=101)
        server.handle_native_question_event(event, server.feed_session)
        server.handle_native_question_event(event, server.feed_session)
        group = next(iter(self.p.questions.values()))
        self.assertEqual(group['source'], 'tiktok')
        self.assertEqual(group['question_id'], '9007199254740993')
        self.assertEqual(group['count'], 1)
        self.assertEqual(group['users'], ['@account'])
        response = server.app.test_client().post('/production/questions', json={'id': group['id'], 'answered': True})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(group['answered'])
        self.p.remove_comments(lambda row: row.get('user_id') == '42')
        self.assertEqual(len(self.p.questions), 0)

    def test_native_poll_totals_merge_zero_index_and_keep_local_poll(self):
        with patch.object(self.i, 'poll', {'question': 'local'}):
            first = PollEvent(poll_id=9007199254740993, message_type=999,
                              start_content=PollStartContent(title='<Tema>', option_list=[PollOptionInfo(option_idx=0, display_content='<Uno>', votes=0)]))
            self.i.native_poll_event(first, server.feed_session)
            update = PollEvent(poll_id=9007199254740993, update_votes_content=PollUpdateVotesContent(option_list=[PollOptionInfo(option_idx=0, votes=4)]))
            self.i.native_poll_event(update, server.feed_session); self.i.native_poll_event(update, server.feed_session)
            poll = self.i.native_poll_snapshot()
            self.assertEqual(poll['id'], '9007199254740993')
            self.assertEqual(poll['options'], [{'index': 0, 'text': '<Uno>', 'votes': 4}])
            self.assertEqual(poll['total_votes'], 4)
            self.assertEqual(self.i.poll['question'], 'local')
            self.i.native_poll_event(PollEvent(poll_id=9007199254740993, end_content=PollEndContent()), server.feed_session)
            self.assertEqual(self.i.native_poll_snapshot()['status'], 'ended')
            self.i.native_poll_event(PollEvent(poll_id=2, start_content=PollStartContent(title='new')), server.feed_session)
            self.i.native_poll_event(PollEvent(poll_id=9007199254740993, end_content=PollEndContent()), server.feed_session)
            self.assertEqual(self.i.native_poll_snapshot()['id'], '2')

    def test_missing_content_stale_session_and_reset(self):
        self.i.native_poll_event(PollEvent(poll_id=1, message_type=1), server.feed_session)
        self.assertIsNone(self.i.native_poll_snapshot())
        self.i.native_poll_event(PollEvent(poll_id=1, start_content=PollStartContent()), 'old-session')
        self.assertIsNone(self.i.native_poll_snapshot())
        server.handle_native_question_event(QuestionNewEvent(), server.feed_session)
        self.assertEqual(len(self.p.questions), 0)
        self.i.native_poll_event(PollEvent(poll_id=1, start_content=PollStartContent()), server.feed_session)
        self.i.reset_native_poll()
        self.assertIsNone(self.i.native_poll_snapshot())

    def test_poll_content_presence_end_last_and_option_bounds(self):
        event = PollEvent(poll_id=1, start_content=PollStartContent(title='x' * 300,
            option_list=[PollOptionInfo(option_idx=0, display_content='A', votes=2)]),
            update_votes_content=PollUpdateVotesContent(option_list=[PollOptionInfo(option_idx=0, votes=5)]),
            end_content=PollEndContent(option_list=[PollOptionInfo(option_idx=0, votes=7)]))
        self.i.native_poll_event(event, server.feed_session)
        poll = self.i.native_poll_snapshot()
        self.assertEqual(poll['status'], 'ended')
        self.assertEqual(poll['options'][0]['votes'], 7)
        self.assertEqual(poll['options'][0]['text'], 'A')
        self.assertEqual(len(poll['title']), 200)
        self.i.reset_native_poll()
        self.i.native_poll_event(PollEvent(poll_id=2, update_votes_content=PollUpdateVotesContent(
            option_list=[PollOptionInfo(option_idx=0, votes=-2), PollOptionInfo(option_idx=-1, votes=8)])), server.feed_session)
        self.assertEqual(self.i.native_poll_snapshot()['options'], [{'index': 0, 'text': '', 'votes': 0}])

    def test_native_question_delete_tombstone_rejects_replay(self):
        from collections import OrderedDict
        event = QuestionNewEvent(data=Question(question_id=10, content='Sin puntuación', user=User(id=42)))
        event.common = S(msg_id=101)
        with patch.object(server, 'moderated_messages', OrderedDict()), patch.object(server, 'moderated_users', OrderedDict()), patch.object(server.socketio, 'emit'):
            server.handle_native_question_event(event, server.feed_session)
            server.handle_moderation_event(S(delete_msg_ids=[101], delete_user_ids=[]), server.feed_session)
            self.assertEqual(len(self.p.questions), 0)
            server.handle_native_question_event(event, server.feed_session)
            self.assertEqual(len(self.p.questions), 0)
