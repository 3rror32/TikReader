import threading
import unittest
import io
from urllib.error import HTTPError
from unittest.mock import Mock, patch

import platform_connectors
import server


class PlatformConnectorTests(unittest.TestCase):
    def test_youtube_http_retries_server_failures_but_not_auth_or_quota(self):
        callbacks = platform_connectors.ConnectorCallbacks(Mock(), Mock(), Mock())
        connector = platform_connectors.YouTubeConnector(
            {'api_key': 'A' * 30, 'video': 'dQw4w9WgXcQ'}, callbacks, threading.Event())
        for status, retryable in [(500, True), (502, True), (503, True), (504, True),
                                  (401, False), (403, False), (429, False)]:
            with self.subTest(status=status):
                error = HTTPError('https://example.invalid', status, 'Error', {},
                                  io.BytesIO(b'{"error":{"message":"API failure"}}'))
                with patch.object(platform_connectors, 'urlopen', side_effect=error):
                    with self.assertRaises(platform_connectors.ConnectorError) as caught:
                        connector._get('videos', {})
                self.assertEqual(caught.exception.retryable, retryable)

    def test_stale_callbacks_cannot_publish_after_stop(self):
        callbacks = []
        class Connector:
            def __init__(self, config, cb, stop): callbacks.append(cb)
            def run(self): pass
        runtime = Mock()
        runtime.platform_credentials.get.return_value = {}
        runtime.prepare_external_session.return_value = None
        manager = platform_connectors.PlatformManager(runtime)
        with patch.object(manager, 'CONNECTORS', {'youtube': Connector}), patch.object(threading, 'Thread'):
            manager.start('youtube', {})
            manager.stop('youtube')
            runtime.reset_mock()
            callbacks[0].connected({'channel': 'old'})
            callbacks[0].comment({'id': 'old'})
            callbacks[0].support({'id': 'old'})
        runtime.handle_external_comment.assert_not_called()
        runtime.handle_external_support.assert_not_called()
        runtime.begin_session_metrics.assert_not_called()
        self.assertEqual(manager.statuses['youtube']['state'], 'disconnected')

    def test_transient_failure_retries_once_without_resetting_session(self):
        runs = []
        class Connector:
            def __init__(self, config, cb, stop): self.cb = cb
            def run(self):
                runs.append(self)
                self.cb.connected({'channel': 'live'})
                self.cb.comment({'id': 'same'})
                if len(runs) == 1:
                    raise platform_connectors.ConnectorError('YOUTUBE_NETWORK', 'Offline', 'Retry')
        runtime = Mock()
        runtime.platform_credentials.get.return_value = {}
        runtime.prepare_external_session.return_value = None
        manager = platform_connectors.PlatformManager(runtime)
        with patch.object(manager, 'CONNECTORS', {'youtube': Connector}), patch.object(threading, 'Thread'):
            manager.start('youtube', {})
            worker = manager.workers['youtube']
            worker['stop'].wait = Mock(return_value=False)
            manager._run('youtube', worker)
        self.assertEqual(len(runs), 2)
        self.assertIsNot(runs[0], runs[1])
        runtime.begin_session_metrics.assert_called_once()
        runtime.handle_external_comment.assert_called_once()
        worker['stop'].wait.assert_called_once_with(1)

    def test_retry_budget_cancellation_and_permanent_errors(self):
        for code, cancelled, expected_runs in [('YOUTUBE_NETWORK', False, 5),
                                                ('YOUTUBE_NETWORK', True, 1),
                                                ('YOUTUBE_NOT_LIVE', False, 1),
                                                ('YOUTUBE_API', False, 1)]:
            with self.subTest(code=code, cancelled=cancelled):
                runs = []
                class Connector:
                    def __init__(self, config, cb, stop): pass
                    def run(self):
                        runs.append(1)
                        raise platform_connectors.ConnectorError(code, 'Failure', 'Safe detail')
                runtime = Mock()
                runtime.platform_credentials.get.return_value = {}
                runtime.prepare_external_session.return_value = None
                manager = platform_connectors.PlatformManager(runtime)
                with patch.object(manager, 'CONNECTORS', {'youtube': Connector}), patch.object(threading, 'Thread'):
                    manager.start('youtube', {})
                    worker = manager.workers['youtube']
                    worker['stop'].wait = Mock(return_value=cancelled)
                    manager._run('youtube', worker)
                self.assertEqual(len(runs), expected_runs)
                if expected_runs == 5:
                    self.assertEqual([call.args[0] for call in worker['stop'].wait.call_args_list], [1, 2, 4, 8])
                self.assertFalse(manager.active())

    def test_old_finalizer_does_not_stop_replacement(self):
        class Connector:
            def __init__(self, config, cb, stop): pass
            def run(self): pass
        runtime = Mock()
        runtime.platform_credentials.get.return_value = {}
        runtime.prepare_external_session.return_value = None
        manager = platform_connectors.PlatformManager(runtime)
        with patch.object(manager, 'CONNECTORS', {'youtube': Connector}), patch.object(threading, 'Thread'):
            manager.start('youtube', {})
            old = manager.workers['youtube']
            manager.start('youtube', {})
            runtime.reset_mock()
            manager._run('youtube', old)
        runtime.external_platform_stopped.assert_not_called()
        self.assertTrue(manager.active())

    def test_manager_combines_protected_credentials_with_live_selection(self):
        received = {}

        class Connector:
            def __init__(self, config, callbacks, stop):
                received.update(config)
                self.video_id = config['video']

            def run(self):
                pass

        runtime = Mock()
        runtime.platform_credentials.get.return_value = {'api_key': 'A' * 30}
        runtime.prepare_external_session.return_value = None
        manager = platform_connectors.PlatformManager(runtime)
        with patch.object(manager, 'CONNECTORS', {'youtube': Connector}), patch.object(threading, 'Thread') as thread:
            self.assertIsNone(manager.start('youtube', {'video': 'dQw4w9WgXcQ'}))
        self.assertEqual(received, {'api_key': 'A' * 30, 'video': 'dQw4w9WgXcQ'})
        thread.assert_called_once()

    def test_youtube_video_id_accepts_safe_supported_forms(self):
        video = "dQw4w9WgXcQ"
        self.assertEqual(platform_connectors.youtube_video_id(video), video)
        self.assertEqual(platform_connectors.youtube_video_id(f"https://youtu.be/{video}?t=2"), video)
        self.assertEqual(platform_connectors.youtube_video_id(f"https://www.youtube.com/watch?v={video}"), video)
        self.assertEqual(platform_connectors.youtube_video_id(f"https://youtube.com/live/{video}"), video)
        self.assertEqual(platform_connectors.youtube_video_id("https://example.com/watch?v=" + video), "")

    def test_kick_is_a_supported_opt_in_connector(self):
        manager = platform_connectors.PlatformManager(Mock())
        self.assertIn("kick", manager.CONNECTORS)
        self.assertEqual(manager.snapshot()["platforms"][2]["platform"], "kick")
        callbacks = platform_connectors.ConnectorCallbacks(Mock(), Mock(), Mock())
        connector = platform_connectors.KickConnector({
            "channel": "canal-seguro", "client_id": "client-id-123",
            "client_secret": "s" * 24, "webhook_secret": "w" * 24,
        }, callbacks, threading.Event())
        with self.assertRaisesRegex(ValueError, "Encabezados"):
            connector.receive({}, b"{}")

    def test_twitch_privmsg_keeps_identity_badges_and_text(self):
        line = ("@badges=moderator/1,subscriber/3;display-name=Carlos;id=message-1;"
                "tmi-sent-ts=1700000000000;user-id=42 :carlos!carlos@carlos.tmi.twitch.tv "
                "PRIVMSG #canal :hola desde Twitch")
        record = platform_connectors.parse_twitch_line(line)
        self.assertEqual(record["kind"], "comment")
        self.assertEqual(record["id"], "message-1")
        self.assertEqual(record["user_id"], "42")
        self.assertEqual(record["user"], "Carlos")
        self.assertEqual(record["comment"], "hola desde Twitch")
        self.assertEqual(record["badges"], ["moderator", "subscriber"])

    def test_twitch_subscription_is_normalized(self):
        line = ("@badge-info=subscriber/1;badges=subscriber/0;display-name=Luna;id=n1;login=luna;"
                "msg-id=sub;system-msg=Luna\\ssubscribed!;user-id=7 "
                ":tmi.twitch.tv USERNOTICE #canal")
        record = platform_connectors.parse_twitch_line(line)
        self.assertEqual(record["kind"], "subscribe")
        self.assertEqual(record["user"], "Luna")
        self.assertEqual(record["comment"], "Luna subscribed!")

    def test_youtube_events_are_dispatched_without_exposing_key(self):
        comments, support = [], []
        callbacks = platform_connectors.ConnectorCallbacks(Mock(), comments.append, support.append)
        connector = platform_connectors.YouTubeConnector(
            {"api_key": "A" * 30, "video": "dQw4w9WgXcQ"}, callbacks, threading.Event())
        connector._dispatch({
            "id": "yt1", "snippet": {"type": "textMessageEvent", "displayMessage": "hola"},
            "authorDetails": {"channelId": "channel-1", "displayName": "Ana", "isChatModerator": True},
        })
        connector._dispatch({
            "id": "yt2", "snippet": {"type": "superChatEvent", "superChatDetails": {
                "amountMicros": "5000000", "currency": "MXN", "amountDisplayString": "$5", "userComment": "saludos"}},
            "authorDetails": {"channelId": "channel-2", "displayName": "Luis"},
        })
        self.assertEqual(comments[0]["comment"], "hola")
        self.assertIn("moderator", comments[0]["badges"])
        self.assertEqual(support[0]["display_amount"], "$5")
        self.assertNotIn("api_key", comments[0])
        self.assertNotIn("api_key", support[0])

    def test_external_comment_enters_unified_feed_once(self):
        server.comment_history.clear()
        server.seen_comment_ids.clear()
        server.participants.clear()
        server.state["comment_count"] = 0
        noops = [
            patch.object(server.production, "comment"),
            patch.object(server.creator_suite, "audience_event"),
            patch.object(server.interactive, "event"),
            patch.object(server.overlay_animations, "event"),
            patch.object(server.points, "event"),
            patch.object(server.user_info_overlay, "command"),
            patch.object(server.spotify, "comment"),
            patch.object(server.chatbot, "comment"),
            patch.object(server.socketio, "emit"),
        ]
        for item in noops:
            item.__enter__()
        try:
            data = {"id": "abc", "user_id": "42", "user": "Ana", "comment": "hola"}
            first = server.handle_external_comment("youtube", data)
            duplicate = server.handle_external_comment("youtube", data)
        finally:
            for item in reversed(noops):
                item.__exit__(None, None, None)
        self.assertIsNone(duplicate)
        self.assertEqual(first["platform"], "youtube")
        self.assertEqual(first["identity"], "youtube:42")
        self.assertEqual(server.state["comment_count"], 1)
        self.assertEqual(len(server.comment_history), 1)


if __name__ == "__main__":
    unittest.main()
