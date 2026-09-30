import threading
import unittest
from unittest.mock import Mock, patch

import platform_connectors
import server


class PlatformConnectorTests(unittest.TestCase):
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
