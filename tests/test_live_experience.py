import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import server
from history_store import HistoryStore


class LiveExperienceTests(unittest.TestCase):
    def test_summary_persists_peak_duration_and_is_emitted_once(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = HistoryStore(Path(directory) / 'history.sqlite3')
            archive.start('summary-test', 'test')
            state = dict(server.state, comment_count=12, viewers_known=True, viewer_count=55)
            with patch.object(server, 'archive', archive), patch.object(server, 'feed_session', 'summary-test'), patch.object(server, 'state', state), patch.object(server, 'session_metrics', None), patch.object(server, 'gift_history', {'gift':{'count':3}}), patch.object(server.socketio, 'emit') as emit:
                server.begin_session_metrics()
                started = server.session_metrics['started_at']
                server.publish_stats()
                state['viewer_count'] = 4
                server.publish_stats()
                server.begin_session_metrics()
                self.assertEqual(server.session_metrics['started_at'], started)
                server.finish_session_metrics()
                server.finish_session_metrics()
                summaries = [call for call in emit.call_args_list if call.args[0] == 'session_summary']
                self.assertEqual(len(summaries), 1)
                summary = archive.records('summary-test')[0]
                self.assertEqual(summary['peak_viewers'], 55)
                self.assertEqual(summary['comments'], 12)
                self.assertEqual(summary['gifts'], 3)
                self.assertTrue(summary['saved'])
                result = server.app.test_client().get('/history/summary-test/summary').get_json()
                self.assertEqual(result['peak_viewers'], 55)
                self.assertIsNotNone(result['duration_seconds'])

    def test_failed_connection_does_not_produce_summary(self):
        with patch.object(server, 'session_metrics', None), patch.object(server.socketio, 'emit') as emit:
            server.finish_session_metrics()
            emit.assert_not_called()

    def test_answered_chat_question_updates_grouped_pending_count(self):
        from production import question_key
        comment = dict(id='q1', comment='Pregunta?', user='test')
        group = dict(id='group', answered=False)
        with patch.object(server, 'comment_history', [comment]), patch.object(server, 'archive', None), patch.object(server.production, 'questions', {question_key('Pregunta?'):group}):
            client = server.app.test_client()
            self.assertEqual(client.get('/studio/state').get_json()['pending_questions'], 1)
            result = client.post('/studio/state', json={'answered':'q1'})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.get_json()['pending_questions'], 0)


if __name__ == '__main__':
    unittest.main()
