import asyncio
import unittest
import time
from unittest.mock import patch

import server


class FakeClient:
    mode = "comments"
    instance = None
    like_events = []

    def __init__(self, **kwargs):
        self.handlers = {}
        self.closed = False
        self.web = self
        FakeClient.instance = self

    def on(self, event):
        def register(handler):
            self.handlers[event] = handler
            return handler
        return register

    async def start(self):
        async def receive():
            if self.mode == "error":
                raise RuntimeError("WebSocket handshake failed")
            if self.mode == "timeout":
                await asyncio.sleep(10)
                return
            await self.handlers[server.ConnectEvent](None)
            if self.mode == "likes":
                for event in self.like_events:
                    await self.handlers[server.LikeEvent](event)
                return
            await asyncio.sleep(0.01)
            if self.mode == "late_error":
                raise RuntimeError("WebSocket closed unexpectedly")
            from types import SimpleNamespace
            comment = SimpleNamespace(user=SimpleNamespace(unique_id="viewer"), comment="hola")
            if self.mode == "duplicates":
                comment.common = SimpleNamespace(msg_id=123)
                await self.handlers[server.CommentEvent](comment)
            await self.handlers[server.CommentEvent](comment)
            if self.mode == "persistent":
                await asyncio.sleep(10)
        self.receiver = asyncio.create_task(receive())
        return self.receiver

    async def disconnect(self, close_client=False):
        pass

    async def close(self):
        self.closed = True


class LiveLifecycleTests(unittest.TestCase):
    def test_user_lookup_failure_does_not_claim_offline(self):
        from TikTokLive.client.errors import UserNotFoundError
        error = server.classify_tiktok_error(UserNotFoundError('example', 'does not exist'))
        self.assertEqual(error['code'], 'LIVE_LOOKUP_FAILED')
        self.assertIn('Esto no confirma', error['detail'])

    def test_explicit_offline_remains_distinct(self):
        from TikTokLive.client.errors import UserOfflineError
        error = server.classify_tiktok_error(UserOfflineError())
        self.assertEqual(error['code'], 'USER_NOT_LIVE')
        self.assertEqual(error['title'], 'LIVE no activo')

    def test_html_lookup_failure_is_actionable(self):
        from TikTokLive.client.web.routes.fetch_room_id_live_html import FailedParseRoomIdError
        error = server.classify_tiktok_error(FailedParseRoomIdError('captcha-blocked'))
        self.assertEqual(error['code'], 'LIVE_LOOKUP_FAILED')

    def test_websocket_rejection_is_not_reported_as_internet_failure(self):
        error = server.classify_tiktok_error(RuntimeError(
            "server rejected WebSocket connection: HTTP 400"))
        self.assertEqual(error["code"], "WEBSOCKET_ERROR")

    def test_gift_catalog_extracts_real_gift_entries(self):
        server.gift_catalog.clear()
        server.update_gift_catalog({'gifts':[{'id':1,'name':'Rosa','diamond_count':1,'type':0,'image':{'url_list':['https://example.com/rose.png']}},{'name':'No es regalo'}]})
        data=server.app.test_client().get('/gift-catalog').get_json()
        self.assertEqual(data['count'],1);self.assertEqual(data['gifts'][0]['name'],'Rosa')
        self.assertEqual(data['gifts'][0]['image_url'],'https://example.com/rose.png')

    def test_widget_customization_validates_persists_and_resets(self):
        import tempfile
        from pathlib import Path
        from history_store import HistoryStore
        with tempfile.TemporaryDirectory() as directory, patch.object(server,'archive',HistoryStore(Path(directory)/'widgets.sqlite3')):
            client=server.app.test_client();payload=dict(server.WIDGET_DEFAULTS,font_size=34,accent_color='#ff00aa',show_avatar=False)
            saved=client.post('/widget-settings/chat',json=payload)
            self.assertEqual(saved.status_code,200);self.assertEqual(saved.get_json()['settings']['font_size'],34)
            self.assertEqual(client.post('/widget-settings/chat',json={**payload,'canvas_format':'vertical'}).get_json()['settings']['canvas_format'],'vertical')
            self.assertEqual(client.post('/widget-settings/chat',json={**payload,'canvas_format':'auto'}).status_code,400)
            self.assertFalse(client.get('/widget-settings/chat').get_json()['settings']['show_avatar'])
            self.assertEqual(client.post('/widget-settings/chat',json={**payload,'background':'red'}).status_code,400)
            self.assertEqual(client.get('/widget-settings/unknown').status_code,404)
            self.assertEqual(client.delete('/widget-settings/chat').get_json()['settings']['font_size'],18)
            timer=client.post('/widget-settings/timer',json={**payload,'timer_title':'Iniciamos en','timer_format':'ms','timer_show_label':True,'timer_show_state':False,'timer_warning_seconds':45,'timer_digit_animation':'slide','timer_animation_speed':680,'timer_glow':False})
            self.assertEqual(timer.status_code,200);self.assertEqual(timer.get_json()['settings']['timer_format'],'ms')
            self.assertEqual(timer.get_json()['settings']['timer_warning_seconds'],45)
            self.assertEqual(timer.get_json()['settings']['timer_digit_animation'],'slide')
            self.assertEqual(timer.get_json()['settings']['timer_animation_speed'],680)
            self.assertFalse(timer.get_json()['settings']['timer_glow'])
            self.assertEqual(client.post('/widget-settings/timer',json={**payload,'timer_format':'frames'}).status_code,400)
            self.assertEqual(client.post('/widget-settings/timer',json={**payload,'timer_digit_animation':'spin'}).status_code,400)
            self.assertEqual(client.post('/widget-settings/timer',json={**payload,'timer_show_state':'yes'}).status_code,400)

    def test_participants_track_join_and_activity(self):
        from types import SimpleNamespace as S
        server.participants.clear();server.recent_joins.clear();server.participants_revision=0
        with patch.object(server.socketio,'emit') as emitted, patch.object(server.time,'time',side_effect=[100,101]):
            server.observe_participant(S(unique_id='Carlos'), 'join', joined=True)
            server.observe_participant(S(unique_id='Carlos'), 'comment')
        payload=server.participants_payload(now=101)
        self.assertEqual(payload['participants'][0]['user'],'@Carlos')
        self.assertEqual(payload['participants'][0]['source'],'comment')
        self.assertEqual(payload['joins'][0]['joined_at'],100)
        self.assertEqual(payload['revision'],2)
        self.assertEqual(emitted.call_args.args[0],'participants_update')
        self.assertIn('participants',server.feed_snapshot())

    def test_participants_expire_after_recent_activity_window_without_losing_join_history(self):
        from types import SimpleNamespace as S
        server.participants.clear();server.recent_joins.clear();server.participants_revision=0
        with patch.object(server.socketio,'emit'), patch.object(server.time,'time',side_effect=[100,250]):
            server.observe_participant(S(unique_id='Carlos'), 'join', joined=True)
            server.observe_participant(S(unique_id='Carlos'), 'comment')

        refreshed=server.participants_payload(now=429)
        expired=server.participants_payload(now=430)
        self.assertEqual(refreshed['activity_window_seconds'],180)
        self.assertEqual([row['user'] for row in refreshed['participants']],['@Carlos'])
        self.assertEqual(expired['participants'],[])
        self.assertEqual(expired['revision'],3)
        self.assertEqual(expired['joins'][0]['user'],'@Carlos')

    def test_definitive_session_end_emits_empty_participant_snapshot(self):
        from collections import OrderedDict, deque
        from contextlib import ExitStack
        participant={'user':'@Carlos','last_seen':1000,'joined_at':990,'source':'comment'}
        join=dict(participant)
        with ExitStack() as stack:
            for name, value in (
                ('feed_session','end-test'),
                ('participants',OrderedDict(carlos=participant)),
                ('recent_joins',deque([join],maxlen=100)),
                ('participants_revision',12),
                ('session_metrics',None),
            ):
                stack.enter_context(patch.object(server,name,value))
            stack.enter_context(patch.object(server.time,'time',return_value=1000))
            with patch.object(server.socketio,'emit') as emitted:
                server.finish_session_metrics()

        event,payload=emitted.call_args.args
        self.assertEqual(event,'participants_update')
        self.assertEqual(payload['session'],'end-test')
        self.assertEqual(payload['revision'],13)
        self.assertEqual(payload['participants'],[])
        self.assertEqual(payload['joins'][0]['user'],'@Carlos')

    def test_follower_status_is_tristate_and_not_based_on_follower_count(self):
        from types import SimpleNamespace as S
        self.assertIsNone(server.follower_status(S()))
        self.assertIsNone(server.follower_status(S(is_follower=False)))
        for status in (1,2):
            self.assertTrue(server.follower_status(S(follow_info=S(follow_status=status))))
        self.assertFalse(server.follower_status(S(follow_info=S(follow_status=0,follower_count=5000))))
        self.assertTrue(server.follower_status(S(is_follower=True)))

    def test_obs_panels_are_allowlisted_and_use_shared_readonly_view(self):
        client = server.app.test_client()
        # Every panel offered by the overlay gallery must resolve.  Keeping this
        # exhaustive prevents the catalog from silently getting ahead of the
        # server allowlist and showing "Panel no encontrado" inside previews.
        self.assertEqual(len(server.WIDGET_PANELS), 40)
        for panel in sorted(server.WIDGET_PANELS):
            response = client.get('/widget/' + panel)
            self.assertEqual(response.status_code, 200)
            self.assertIn(('data-widget="' + panel + '"').encode(), response.data)
        self.assertEqual(client.get('/widget/unknown').status_code, 404)

    def test_session_summary_counts_streaks_once_and_uses_observed_samples(self):
        import tempfile
        from pathlib import Path
        from history_store import HistoryStore
        with tempfile.TemporaryDirectory() as directory:
            store = HistoryStore(Path(directory) / 'history.sqlite3')
            store.start('summary-test', 'viewer')
            for i in range(3):
                store.save('summary-test','comment',{'id':str(i),'user':'@viewer','comment':'hola'})
            store.save('summary-test','gift',{'id':'g','count':1})
            store.save('summary-test','gift',{'id':'g','count':4})
            store.save('summary-test','sample',{'id':'s','at':100,'viewers':7})
            with patch.object(server,'archive',store):
                summary=server.app.test_client().get('/history/summary-test/summary').get_json()
            self.assertEqual((summary['comments'],summary['gifts'],summary['participants'],summary['peak_viewers']),(3,4,1,7))
            self.assertEqual(summary['active_users'],[{'user':'@viewer','count':3}])

    def test_diamonds_use_only_reported_value_and_streak_delta(self):
        from types import SimpleNamespace
        server.gift_counts.clear();server.gifter_diamonds.clear()
        gift=SimpleNamespace(id=1,name='Rosa',type=1,diamond_count=2)
        event=SimpleNamespace(user=SimpleNamespace(unique_id='sender'),gift=gift,group_id=44,repeat_count=1,repeat_end=0)
        with patch.object(server.socketio,'emit'):
            server.handle_gift_event(event)
            event.repeat_count=3;server.handle_gift_event(event)
            server.handle_gift_event(event)
        self.assertEqual(server.gifter_diamonds['sender'],6)

    def test_viewer_samples_are_throttled_and_diagnostics_are_exposed(self):
        with patch.object(server,'last_sample',0),patch.object(server,'archive',None),patch.object(server.time,'time',return_value=100),patch.object(server.socketio,'emit'):
            server.viewer_samples.clear()
            server.update_room_stats({'user_count':1,'like_count':0})
            server.update_room_stats({'user_count':2,'like_count':0})
            self.assertEqual(len(server.viewer_samples),1)
            data=server.app.test_client().get('/studio/state').get_json()
            self.assertEqual(data['diagnostics']['room'],100)
            self.assertEqual(data['stats']['viewers'],2)

    def test_initial_room_stats_include_one_viewer_and_known_zero_likes(self):
        server.state.update(like_count=0, likes_known=False, viewers_known=False, likes_source="pending",
                            session_like_units=0, room_like_count=None, room_like_baseline=None)
        with patch.object(server.socketio, "emit"):
            server.update_room_stats({"user_count":1, "like_count":0})
        snapshot=server.stats_payload()
        self.assertEqual(snapshot["viewers"],1)
        self.assertTrue(snapshot["viewers_known"])
        self.assertEqual(snapshot["likes"],0)
        self.assertTrue(snapshot["likes_known"])
        with patch.object(server.socketio, "emit"):
            server.update_room_stats({"user_count":0,"like_count":12})
            server.update_room_stats({"like_count":0})
        self.assertEqual(server.state["viewer_count"],0)
        self.assertEqual(server.state["like_count"],12)

    def test_archive_persists_and_exports_safe_csv(self):
        import tempfile
        from pathlib import Path
        from history_store import HistoryStore
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"test.sqlite3"
            store=HistoryStore(path)
            store.start("s1","test")
            store.save("s1","comment",{"id":"c1","user":"@viewer","comment":"=1+1","timestamp":"12:00:00"})
            store.save("s1","gift",{"id":"g1","user":"@viewer","gift":"Rosa","count":2})
            store.mark("s1","c1",True)
            store.set_setting("like_goal",500)
            store.start("s2","test")
            reopened=HistoryStore(path)
            self.assertTrue(reopened.records("s1")[0]["answered"])
            self.assertEqual(reopened.settings()["like_goal"],500)
            with patch.object(server,"archive",reopened):
                client=server.app.test_client()
                self.assertEqual(len(client.get('/history').get_json()["sessions"]),2)
                response=client.get('/history/s1/export?format=csv')
                self.assertIn("'=1+1",response.get_data(as_text=True))
                self.assertEqual(len(client.get('/history/s1/export').get_json()),2)
            self.assertEqual(reopened.recent_gifts('test','s2')[0]['gift'],'Rosa')

    def test_recent_gifts_matches_tiktok_handle_without_case_sensitivity(self):
        import tempfile
        from pathlib import Path
        from history_store import HistoryStore
        with tempfile.TemporaryDirectory() as directory:
            store = HistoryStore(Path(directory) / 'history.sqlite3')
            store.start('previous', 'CreatorName')
            store.save('previous', 'gift', {'id':'gift-1', 'gift':'Rosa', 'count':2})
            self.assertEqual(store.recent_gifts('creatorname')[0]['id'], 'gift-1')

    def test_gift_recovery_requires_the_exact_same_live_room(self):
        import tempfile
        from pathlib import Path
        from history_store import HistoryStore
        with tempfile.TemporaryDirectory() as directory:
            store=HistoryStore(Path(directory)/'test.sqlite3')
            store.start('old','CreatorName')
            store.save('old','live_identity',{'id':'live-identity','live_id':'room-one'})
            store.save('old','gift',{'id':'gift-1','gift':'Rose','count':2})
            store.start('current','creatorname')
            self.assertEqual(store.gifts_for_live('creatorname','room-one','current')[0]['id'],'gift-1')
            self.assertEqual(store.gifts_for_live('creatorname','room-two','current'),[])

    def test_live_identity_restores_gifts_only_after_same_room_is_confirmed(self):
        import tempfile
        from collections import OrderedDict
        from pathlib import Path
        from history_store import HistoryStore
        with tempfile.TemporaryDirectory() as directory:
            store=HistoryStore(Path(directory)/'test.sqlite3')
            store.start('old','creator')
            store.save('old','live_identity',{'id':'live-identity','live_id':'same-room'})
            store.save('old','gift',{'id':'gift-1','user':'@donor','gift':'Rose','count':2,'diamonds':2})
            store.start('current','creator')
            with patch.object(server,'archive',store), patch.object(server,'feed_session','current'), \
                    patch.object(server,'recovered_gifts',OrderedDict()), \
                    patch.object(server,'gift_history',OrderedDict()), \
                    patch.object(server,'gift_counts',OrderedDict()), \
                    patch.object(server,'gifter_totals',{}), patch.object(server,'gifter_diamonds',{}), \
                    patch.object(server,'state',dict(server.state,gift_count=0)), \
                    patch.object(server.interactive,'recover_gifts') as recover, \
                    patch.object(server,'publish_gift_history'), patch.object(server,'publish_stats'):
                self.assertEqual(server.identify_live_and_recover('creator','other-room'),0)
                self.assertEqual(server.state['gift_count'],0)
                self.assertEqual(server.identify_live_and_recover('creator','same-room'),1)
                self.assertEqual(server.state['gift_count'],2)
                recover.assert_called_once()

    def test_highlight_and_answered_state(self):
        server.comment_history.clear()
        server.comment_history.append({"id":"pin1","user":"@u","comment":"Pregunta?","sequence":1})
        client=server.app.test_client()
        result=client.post('/studio/state',json={"highlight":"pin1","answered":"pin1","like_goal":200})
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.get_json()["highlight"]["id"],"pin1")
        self.assertTrue(server.comment_history[0]["answered"])
        self.assertEqual(client.get('/overlay').status_code,200)
        self.assertEqual(client.post('/studio/state',json={"like_goal":20},headers={"Origin":"https://outside.invalid"}).status_code,403)
        server.comment_history.clear()

    def run_mode(self, mode):
        FakeClient.mode = mode
        server.stop_requested.clear()
        server.state["connected"] = False
        with patch.object(server, "TikTokLiveClient", FakeClient), \
                patch.object(server, "CONNECT_TIMEOUT", 0.05), \
                patch.object(server.socketio, "emit") as emit:
            server.run_tiktok_live("test")
        self.assertTrue(FakeClient.instance.closed)
        self.assertTrue(FakeClient.instance.receiver.done())
        return emit.call_args_list

    def test_keeps_receiver_alive_for_comments(self):
        calls = self.run_mode("comments")
        self.assertTrue(any(c.args[0] == "new_comment" for c in calls))

    def test_receiver_error_is_not_misreported_as_timeout(self):
        calls = self.run_mode("error")
        errors = [c.args[1] for c in calls if c.args[0] == "tiktok_error"]
        self.assertEqual([e["code"] for e in errors], ["WEBSOCKET_ERROR"])

    def test_error_after_connect_is_reported(self):
        calls = self.run_mode("late_error")
        self.assertTrue(any(c.args[0] == "tiktok_error" for c in calls))

    def test_timeout_cancels_receiver(self):
        calls = self.run_mode("timeout")
        errors = [c.args[1] for c in calls if c.args[0] == "tiktok_error"]
        self.assertEqual([e["code"] for e in errors], ["TIMEOUT"])

    def test_invalid_payloads_never_start_connection(self):
        with patch.object(server, "TikTokLiveClient", FakeClient), \
                patch.object(server.threading, "Thread") as thread:
            client = server.socketio.test_client(server.app)
            for payload in (None, {}, {"username": ""}, {"username": 123},
                            {"username": "https://tiktok.com/@test"}):
                client.emit("start_live", payload)
                errors = [e for e in client.get_received() if e["name"] == "tiktok_error"]
                self.assertEqual(errors[-1]["args"][0]["code"], "INVALID_USERNAME")
            thread.assert_not_called()
            client.disconnect()

    def test_stop_and_reconnect_through_socket(self):
        FakeClient.mode = "persistent"
        with patch.object(server, "TikTokLiveClient", FakeClient):
            client = server.socketio.test_client(server.app)
            for username in ("first", "second"):
                client.emit("start_live", {"username": username})
                deadline = time.monotonic() + 2
                received = []
                while time.monotonic() < deadline:
                    received.extend(client.get_received())
                    if any(e["name"] == "new_comment" for e in received):
                        break
                    time.sleep(0.01)
                self.assertTrue(any(e["name"] == "new_comment" for e in received))
                worker = server.tiktok_thread
                client.emit("start_live", {"username": username})
                self.assertIs(server.tiktok_thread, worker)
                client.emit("stop_live")
                self.assertFalse(server.tiktok_thread.is_alive())
                self.assertTrue(FakeClient.instance.closed)
                self.assertFalse(server.state["connected"])
            client.disconnect()

    def test_stop_during_connect(self):
        FakeClient.mode = "timeout"
        with patch.object(server, "TikTokLiveClient", FakeClient):
            client = server.socketio.test_client(server.app)
            client.emit("start_live", {"username": "pending"})
            client.emit("stop_live")
            self.assertFalse(server.tiktok_thread.is_alive())
            self.assertFalse(server.state["connecting"])
            client.disconnect()

    def test_page_has_only_real_connection_controls(self):
        page = server.app.test_client().get("/")
        self.assertEqual(page.status_code, 200)
        self.assertNotIn(b"demo", page.data.lower())
        self.assertIn(b"startLive()", page.data)

    def test_like_totals_and_count_fallback(self):
        # Use actual protobuf events: omitted integers are zero, not absent.
        FakeClient.like_events = [
            server.LikeEvent(count=3, total=150),
            server.LikeEvent(count=3, total=150),
            server.LikeEvent(count=2, total=145),
            server.LikeEvent(count=5, total=155),
            server.LikeEvent(count=2),
            server.LikeEvent(),
        ]
        server.state.update(like_count=0, session_like_units=0, room_like_baseline=None)
        calls = self.run_mode("likes")
        totals = [c.args[1]["likes"] for c in calls if c.args[0] == "stats_update"]
        self.assertEqual(totals, [3, 3, 3, 8, 10, 10])

    def test_new_browser_receives_existing_like_count(self):
        server.state["like_count"] = 42
        client = server.socketio.test_client(server.app)
        updates = [e for e in client.get_received() if e["name"] == "stats_update"]
        self.assertEqual(updates[0]["args"][0]["likes"], 42)
        client.disconnect()

    def test_duplicate_tiktok_comments_are_emitted_once_and_recoverable(self):
        server.comment_history.clear()
        server.seen_comment_ids.clear()
        server.state["comment_count"] = 0
        calls = self.run_mode("duplicates")
        comments = [c.args[1] for c in calls if c.args[0] == "new_comment"]
        self.assertEqual(len(comments), 1)
        snapshot = server.app.test_client().get("/feed").get_json()
        self.assertEqual(snapshot["comments"], comments)
        client = server.socketio.test_client(server.app)
        history = [e for e in client.get_received() if e["name"] == "comment_history"]
        self.assertEqual(history[0]["args"][0], snapshot)
        client.disconnect()

    def test_profile_image_selection(self):
        from TikTokLive.proto.custom_proto import ExtendedUser
        from TikTokLiveProto.v3.webcast.model.base import ImageModel
        user = ExtendedUser(avatar_thumb=ImageModel(url_list=["https://example.com/photo.jpg"]))
        self.assertEqual(server.avatar_url(user), "https://example.com/photo.jpg")
        user.avatar_thumb = ImageModel(url_list=["javascript:alert(1)", "http://example.com/image"])
        user.avatar_medium = ImageModel(url_list=["https://example.com/medium.jpg"])
        self.assertEqual(server.avatar_url(user), "https://example.com/medium.jpg")
        self.assertIsNone(server.avatar_url(ExtendedUser()))

    def test_retry_transient_errors_without_resetting_chat(self):
        server.stop_requested.clear()
        before = server.feed_snapshot()
        with patch.object(server, "run_tiktok_live", side_effect=["TIMEOUT", "WEBSOCKET_ERROR", None]) as run, \
                patch.object(server.stop_requested, "wait", return_value=False) as wait, \
                patch.object(server.socketio, "emit"):
            server.run_tiktok_session("test")
        self.assertEqual(run.call_count, 3)
        self.assertEqual([c.args[0] for c in wait.call_args_list], [2, 5])
        self.assertEqual(server.feed_snapshot(), before)

    def test_replayed_comment_after_connection_loss_is_not_emitted_twice(self):
        from types import SimpleNamespace as S
        event=S(user=S(unique_id='test-reconnection'),comment='Prueba',common=S(msg_id=987654321))
        server.stop_requested.clear()
        attempts=[]
        def connection(username):
            attempts.append(username)
            server.handle_comment_event(event)
            return 'CONNECTION_ERROR' if len(attempts)==1 else None
        with patch.object(server,'seen_comment_ids',server.OrderedDict()), \
                patch.object(server,'run_tiktok_live',side_effect=connection), \
                patch.object(server.stop_requested,'wait',return_value=False), \
                patch.object(server.socketio,'emit') as emit:
            server.run_tiktok_session('test')
        self.assertEqual(len(attempts),2)
        self.assertEqual(sum(c.args[0]=='new_comment' for c in emit.call_args_list),1)

    def test_retries_are_bounded_and_stop_is_respected(self):
        server.stop_requested.clear()
        with patch.object(server, "run_tiktok_live", return_value="CONNECTION_ERROR") as run, \
                patch.object(server.stop_requested, "wait", return_value=False), \
                patch.object(server.socketio, "emit"):
            server.run_tiktok_session("test")
        self.assertEqual(run.call_count, 4)
        with patch.object(server, "run_tiktok_live", return_value="TIMEOUT") as run, \
                patch.object(server.stop_requested, "wait", return_value=True), \
                patch.object(server.socketio, "emit"):
            server.run_tiktok_session("test")
        self.assertEqual(run.call_count, 1)

    def test_no_retries_for_offline_auth_or_rate_limit(self):
        server.stop_requested.clear()
        for code in ("USER_NOT_LIVE", "AUTH_ERROR", "RATE_LIMITED", None):
            with patch.object(server, "run_tiktok_live", return_value=code) as run:
                server.run_tiktok_session("test")
            self.assertEqual(run.call_count, 1)

    def test_incremental_feed_and_session_reset(self):
        server.comment_history.clear()
        server.comment_history.extend({"id": str(i), "sequence": i} for i in range(1, 201))
        server.feed_cursor = 200
        client = server.app.test_client()
        full = client.get("/feed").get_json()
        response = client.get("/feed", query_string={"session": full["session"], "after": 199})
        self.assertEqual(response.get_json()["comments"], [{"id": "200", "sequence": 200}])
        empty = client.get("/feed", query_string={"session": full["session"], "after": 200})
        self.assertEqual(empty.get_json()["comments"], [])
        self.assertEqual(empty.get_json()["cursor"], 200)
        reset = client.get("/feed", query_string={"session": "old", "after": 200})
        self.assertEqual(len(reset.get_json()["comments"]), 200)
        self.assertIn("no-store", response.headers["Cache-Control"])
        server.comment_history.clear()

    def test_gifts_count_units_and_complete_streak_without_duplicates(self):
        from TikTokLive.proto.custom_proto import ExtendedGift, ExtendedUser
        from types import SimpleNamespace
        server.gift_history.clear()
        server.gift_counts.clear()
        server.state["gift_count"] = 0
        gift = ExtendedGift(id=1, name="Rosa", type=1)
        user = ExtendedUser(display_id="donante")
        with patch.object(server.socketio, "emit") as emit, patch.object(server.interactive, "event") as bank_event:
            for count, ended in [(1, 0), (3, 0), (3, 1), (3, 1)]:
                server.handle_gift_event(server.GiftEvent(gift=gift, user=user, gift_id=1,
                                                          group_id=123, repeat_count=count, repeat_end=ended))
        self.assertEqual([call.kwargs["quantity"] for call in bank_event.call_args_list], [1, 2])
        self.assertEqual(server.state["gift_count"], 3)
        history = server.feed_snapshot()["gifts"]
        self.assertEqual(len(history), 1)
        self.assertEqual((history[0]["gift"], history[0]["user"], history[0]["count"]), ("Rosa", "@donante", 3))
        self.assertFalse(history[0]["ongoing"])
        self.assertTrue(any(c.args[0] == "stats_update" for c in emit.call_args_list))
        with patch.object(server.socketio, "emit"):
            server.handle_gift_event(SimpleNamespace(user=user, gift=SimpleNamespace(name="Corazón", type=0),
                                                    gift_id=2, common=SimpleNamespace(msg_id=99), repeat_count=2))
        self.assertEqual(server.state["gift_count"], 5)

    def test_like_recovery_snapshot_and_duplicate_event(self):
        from types import SimpleNamespace
        server.seen_like_ids.clear()
        server.state.update(like_count=0, like_events=0, last_like_at=None)
        event = SimpleNamespace(count=7, total=0, common=SimpleNamespace(msg_id=456))
        with patch.object(server.socketio, "emit"):
            server.handle_like_event(event)
            server.handle_like_event(event)
        stats = server.app.test_client().get('/feed').get_json()["stats"]
        self.assertEqual(stats["likes"], 7)
        self.assertEqual(stats["like_events"], 1)
        self.assertTrue(stats["last_like_at"])

    def test_gift_snapshot_omitted_when_unchanged(self):
        snapshot = server.feed_snapshot()
        unchanged = server.feed_snapshot(session=snapshot["session"], gifts_version=snapshot["gift_version"])
        self.assertNotIn("gifts", unchanged)
        self.assertIn("gifts", server.feed_snapshot(session="previous", gifts_version=snapshot["gift_version"]))

    def test_gift_push_keeps_recovered_rows_and_updates_reconnected_streak(self):
        from collections import OrderedDict
        recovered = OrderedDict([
            ('older', {'id':'older', 'gift':'Corazon', 'count':1}),
            ('streak', {'id':'streak', 'gift':'Rosa', 'count':2}),
        ])
        current = OrderedDict([
            ('streak', {'id':'streak', 'gift':'Rosa', 'count':4}),
            ('new', {'id':'new', 'gift':'Dona', 'count':1}),
        ])
        with patch.object(server, 'recovered_gifts', recovered), \
                patch.object(server, 'gift_history', current), \
                patch.object(server.socketio, 'emit') as emit:
            server.publish_gift_history()
        payload = emit.call_args.args[1]
        self.assertEqual([gift['id'] for gift in payload['gifts']], ['new', 'streak', 'older'])
        self.assertEqual(payload['gifts'][1]['count'], 4)
        self.assertNotIn('recovered', payload['gifts'][1])
        self.assertTrue(payload['gifts'][2]['recovered'])

class CommentDisplayNameTests(unittest.TestCase):
    def test_malformed_event_does_not_suppress_next_valid_comment(self):
        from types import SimpleNamespace as S

        class MalformedEvent:
            @property
            def user(self):
                raise ValueError('private malformed payload')

        with patch.object(server, 'diagnostics', {}), \
                patch.object(server, 'logger') as logger, \
                patch.object(server, 'observe_participant'), \
                patch.object(server, 'event_emotes', return_value=[]), \
                patch.object(server, 'avatar_url', return_value=None), \
                patch.object(server, 'user_badges', return_value=[]), \
                patch.object(server, 'follower_status', return_value=None), \
                patch.object(server, 'publish_comment_payload', side_effect=lambda payload: payload) as publish:
            self.assertIsNone(server.handle_comment_event(MalformedEvent()))
            payload = server.handle_comment_event(S(user=S(unique_id='viewer'), comment='Next valid comment'))
            self.assertEqual(payload['comment'], 'Next valid comment')
            self.assertEqual(payload['identity'], 'tiktok:viewer')
            publish.assert_called_once()
            self.assertIn('comment_error', server.diagnostics)
            self.assertNotIn('private malformed payload', str(logger.warning.call_args))

    def publish(self, payload, publisher=None):
        from collections import OrderedDict, deque
        from contextlib import ExitStack

        publisher = publisher or server.publish_comment_payload
        with ExitStack() as stack:
            for name, value in (
                ("feed_session", "display-name-test"),
                ("state", dict(server.state, comment_count=0)),
                ("seen_comment_ids", OrderedDict()),
                ("comment_history", deque(maxlen=10)),
                ("diagnostics", {}),
                ("archive", None),
            ):
                stack.enter_context(patch.object(server, name, value))
            for owner, name in (
                (server.production, "comment"),
                (server.creator_suite, "audience_event"),
                (server.interactive, "event"),
                (server.overlay_animations, "event"),
                (server.points, "event"),
                (server.user_info_overlay, "command"),
                (server.spotify, "comment"),
                (server.chatbot, "comment"),
                (server.socketio, "emit"),
                (server, "publish_stats"),
            ):
                stack.enter_context(patch.object(owner, name))
            return publisher(payload)

    def test_tiktok_comment_uses_nickname_and_keeps_account_username(self):
        from types import SimpleNamespace as S
        user = S(unique_id="account_name", nickname="Visible Profile")
        event = S(user=user, comment="Hola")

        with patch.object(server, "observe_participant"), \
                patch.object(server, "event_emotes", return_value=[]), \
                patch.object(server, "avatar_url", return_value=None), \
                patch.object(server, "user_badges", return_value=[]), \
                patch.object(server, "follower_status", return_value=None), \
                patch.object(server, "publish_comment_payload", side_effect=lambda payload: payload):
            payload = server.handle_comment_event(event)

        self.assertEqual(payload["user"], "@account_name")
        self.assertEqual(payload["display_name"], "Visible Profile")

    def test_tiktok_comment_uses_alternate_public_username(self):
        from types import SimpleNamespace as S
        event = S(user=S(username="alternate_name", nickname="Visible Profile"), comment="Hola")

        with patch.object(server, "observe_participant"), \
                patch.object(server, "event_emotes", return_value=[]), \
                patch.object(server, "avatar_url", return_value=None), \
                patch.object(server, "user_badges", return_value=[]), \
                patch.object(server, "follower_status", return_value=None), \
                patch.object(server, "publish_comment_payload", side_effect=lambda payload: payload):
            payload = server.handle_comment_event(event)

        self.assertEqual(payload["user"], "@alternate_name")
        self.assertEqual(payload["identity"], "tiktok:alternate_name")

    def test_tiktok_comment_without_user_uses_safe_fallback(self):
        from types import SimpleNamespace as S
        event = S(comment="Hola")

        with patch.object(server, "observe_participant"), \
                patch.object(server, "event_emotes", return_value=[]), \
                patch.object(server, "avatar_url", return_value=None), \
                patch.object(server, "user_badges", return_value=[]), \
                patch.object(server, "follower_status", return_value=None), \
                patch.object(server, "publish_comment_payload", side_effect=lambda payload: payload):
            payload = server.handle_comment_event(event)

        self.assertEqual(payload["user"], "@Espectador")
        self.assertEqual(payload["display_name"], "Espectador")
        self.assertEqual(payload["identity"], "tiktok:anonymous")

    def test_tiktok_comment_skips_empty_content_and_records_diagnostic(self):
        from types import SimpleNamespace as S
        event = S(comment="  ")
        diagnostics = {}

        with patch.object(server, "diagnostics", diagnostics), \
                patch.object(server, "publish_comment_payload") as publish, \
                patch.object(server, "logger") as logger:
            result = server.handle_comment_event(event)

        self.assertIsNone(result)
        publish.assert_not_called()
        self.assertIn("comment_error", diagnostics)
        logger.warning.assert_called_once()
        self.assertNotIn("  ", str(logger.warning.call_args))

    def test_tiktok_comment_callback_logs_exception_without_event_content(self):
        from types import SimpleNamespace as S
        secret_comment = "private comment text"
        event = S(comment=secret_comment)

        with patch.object(server, "diagnostics", {}), \
                patch.object(server, "event_emotes", side_effect=RuntimeError(secret_comment)), \
                patch.object(server, "logger") as logger:
            result = server.handle_comment_event(event)

        self.assertIsNone(result)
        logger.warning.assert_called_once()
        self.assertNotIn(secret_comment, str(logger.warning.call_args))

    def test_publish_normalizes_display_name_and_uses_account_fallback(self):
        named = self.publish({"id": "named", "user": "@account", "display_name": "  Visible  "})
        missing = self.publish({"id": "missing", "user": "@account"})
        empty = self.publish({"id": "empty", "user": "@account", "display_name": "  "})

        self.assertEqual(named["display_name"], "Visible")
        self.assertEqual(missing["display_name"], "@account")
        self.assertEqual(empty["display_name"], "@account")

    def test_external_comment_carries_supplied_display_name_and_falls_back(self):
        original_publish = server.publish_comment_payload
        with patch.object(server, "publish_comment_payload", side_effect=lambda payload: self.publish(payload, original_publish)), \
                patch.object(server, "observe_external_participant"):
            supplied = server.handle_external_comment(
                "youtube", {"id": "external-named", "user": "account", "display_name": "Channel Name", "comment": "Hola"}
            )
            missing = server.handle_external_comment(
                "twitch", {"id": "external-missing", "user": "account", "comment": "Hola"}
            )

        self.assertEqual(supplied["display_name"], "Channel Name")
        self.assertEqual(missing["display_name"], "@account")


class FollowFeedTests(unittest.TestCase):
    def test_follow_dedup_recovery_sequence_and_comment_isolation(self):
        for kind in ('follow', 'share', 'subscribe', 'super_fan', 'super_fan_join'):
            with self.subTest(kind=kind):
                self.check_activity_isolation(kind)

    def check_activity_isolation(self, kind):
        from collections import OrderedDict, deque
        from contextlib import ExitStack
        with ExitStack() as stack:
            stack.enter_context(patch.object(server, "comment_history", deque(maxlen=200)))
            stack.enter_context(patch.object(server, "seen_comment_ids", OrderedDict()))
            stack.enter_context(patch.object(server, "state", dict(server.state, comment_count=0)))
            stack.enter_context(patch.object(server, "feed_cursor", 0))
            stack.enter_context(patch.object(server, "archive", None))
            emit = stack.enter_context(patch.object(server.socketio, "emit"))
            spies = [stack.enter_context(patch.object(owner, name)) for owner, name in (
                (server.production, "comment"), (server.creator_suite, "audience_event"),
                (server.interactive, "event"), (server.overlay_animations, "event"),
                (server.points, "event"), (server.user_info_overlay, "command"),
                (server.spotify, "comment"), (server.chatbot, "comment"), (server, "publish_stats"))]
            first = server.publish_comment_payload({"id": "same", "user": "@a", "comment": "hi"})
            publisher = server.publish_follow_payload if kind == 'follow' else lambda record, message_id=None: server.publish_activity_payload(kind, record, message_id)
            follow = publisher({"user": "follower"}, "same")
            self.assertIsNone(publisher({"user": "follower"}, "same"))
            last = server.publish_comment_payload({"id": "last", "user": "@b", "comment": "bye"})
            self.assertEqual([first["sequence"], follow["sequence"], last["sequence"]], [1, 2, 3])
            self.assertEqual(server.state["comment_count"], 2)
            for spy in spies:
                self.assertEqual(spy.call_count, 2)
            self.assertEqual(follow["kind"], kind)
            self.assertEqual(follow["user"], "@follower")
            self.assertEqual(emit.call_count, 3)
            recovered = server.feed_snapshot(session=server.feed_session, after=1)
            self.assertEqual([row["id"] for row in recovered["comments"]], [follow["id"], last["id"]])
            self.assertEqual(recovered["cursor"], 3)
            a = publisher({"user": "anonymous"})
            b = publisher({"user": "anonymous"})
            self.assertNotEqual(a["id"], b["id"])


class NativeModerationTests(unittest.TestCase):
    def test_lifecycle_snapshot_only_applies_to_authoritative_native_phase(self):
        with patch.object(server, 'live_lifecycle', dict(state='disconnected', revision=0)), \
                patch.object(server, 'state', dict(server.state, username='native', connected=False, connecting=False)):
            self.assertIsNone(server.feed_snapshot().get('lifecycle'))
            server.live_lifecycle.update(state='disconnected', revision=2)
            server.state.update(connecting=True, retry_count=1)
            self.assertIsNone(server.feed_snapshot().get('lifecycle'))
            server.state.update(connecting=False, connected=True, username='youtube:channel')
            self.assertIsNone(server.feed_snapshot().get('lifecycle'))
            server.state.update(username='native')
            for value in ('paused', 'ended'):
                server.live_lifecycle['state'] = value
                self.assertEqual(server.feed_snapshot()['lifecycle']['state'], value)

    def test_exact_ids_tombstones_and_monotonic_cursor(self):
        from collections import OrderedDict, deque
        from types import SimpleNamespace as S
        with patch.object(server, 'comment_history', deque(maxlen=200)), patch.object(server, 'feed_cursor', 0), \
                patch.object(server, 'moderated_messages', OrderedDict()), patch.object(server, 'moderated_users', OrderedDict()), \
                patch.object(server.socketio, 'emit'), patch.object(server.production, 'remove_comments'):
            first = server.publish_activity_payload('follow', {'user': 'same'}, 'activity')
            server.comment_history.append(dict(id='10', upstream_id='10', user_id='42', platform='tiktok', user='@same', sequence=2))
            server.feed_cursor = 2
            server.handle_moderation_event(S(delete_msg_ids=[10], delete_user_ids=[]), server.feed_session)
            self.assertEqual([row['id'] for row in server.comment_history], [first['id']])
            self.assertEqual(server.feed_snapshot()['cursor'], 2)
            self.assertIsNone(server.publish_comment_payload(dict(id='10', platform='tiktok', upstream_id='10', comment='replay')))
            third = server.publish_activity_payload('share', {'user': 'other'}, 'next')
            self.assertEqual(third['sequence'], 3)
            server.handle_moderation_event(S(delete_msg_ids=[], delete_user_ids=[42]), server.feed_session)
            self.assertIsNone(server.publish_comment_payload(dict(id='new', platform='tiktok', user_id='42', comment='replay')))

    def test_session_bound_lifecycle_pause_end_and_stale_callbacks(self):
        with patch.object(server, 'live_lifecycle', dict(state='disconnected', revision=0)), \
                patch.object(server, 'tiktok_run_token', 'current'), \
                patch.object(server, 'state', dict(server.state)), patch.object(server.socketio, 'emit'):
            server.set_live_lifecycle('live', server.feed_session, 'current')
            server.set_live_lifecycle('paused', server.feed_session, 'current')
            self.assertTrue(server.state['connected'])
            self.assertIsNone(server.set_live_lifecycle('ended', 'old-session', 'current'))
            self.assertIsNone(server.set_live_lifecycle('ended', server.feed_session, 'old-token'))
            server.set_live_lifecycle('live', server.feed_session, 'current')
            server.set_live_lifecycle('ended', server.feed_session, 'current')
            server.set_live_lifecycle('disconnected', server.feed_session, 'current')
            self.assertEqual(server.live_lifecycle['state'], 'ended')
            self.assertFalse(server.state['connected'])


if __name__ == "__main__":
    unittest.main()



