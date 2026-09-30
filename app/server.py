"""
TikReader - Servidor Flask + TikTokLive
Transmite comentarios en vivo de TikTok al navegador mediante WebSockets.

REQUISITOS:
    pip install flask flask-socketio TikTokLive --upgrade

Si sigue fallando, forzar la versión más reciente:
    pip install --upgrade --force-reinstall TikTokLive
"""
import sys
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, 'reconfigure'):
        stream.reconfigure(encoding='utf-8', errors='replace')

if __name__ == '__main__':
    from runtime_guard import InstanceGuard
    from app_paths import data_dir
    from app_config import runtime_config as _guard_config
    try:
        _instance_guard=InstanceGuard(data_dir()/'server.lock', _guard_config().port)
    except RuntimeError as exc:
        print(str(exc));raise SystemExit(1)

import asyncio
import threading
import time
import re
from collections import deque, OrderedDict
from uuid import uuid4
from urllib.parse import urlsplit
from importlib.metadata import version as package_version
from flask import Flask, send_from_directory
from history_store import HistoryStore
from user_badges import user_badges
from like_ranking import LikeRanking
like_ranking = LikeRanking()
from pathlib import Path
import sqlite3
from flask_socketio import SocketIO, emit
from app_config import load_or_create_secret, runtime_config
from app_paths import data_dir
from observability import RuntimeMetrics, configure_logging
from runtime_state import RuntimeState
from system_routes import register_system_routes
from core_routes import register_core_routes

# ── TikTokLive imports ──────────────────────────────────────────────────────
TIKTOKLIVE_AVAILABLE = False
TIKTOKLIVE_VERSION = "desconocida"

try:
    from TikTokLive import TikTokLiveClient
    from TikTokLive.events import CommentEvent, ConnectEvent, DisconnectEvent, LikeEvent, GiftEvent, RoomUserSeqEvent, JoinEvent
    try:
        from TikTokLive.events import EmoteChatEvent
    except ImportError:
        EmoteChatEvent = None
    TIKTOKLIVE_AVAILABLE = True

    TIKTOKLIVE_VERSION = package_version("TikTokLive")

    print(f"[INFO] TikTokLive {TIKTOKLIVE_VERSION} cargada correctamente.")
except ImportError as e:
    print(f"[WARN] TikTokLive no disponible ({e}).")

# ── App setup ───────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
app = Flask(__name__, template_folder=str(PROJECT_ROOT / 'web' / 'templates'), static_folder=None)


@app.get('/static/<path:filename>', endpoint='static')
def static_asset(filename):
    # Preserve existing browser-source URLs while resources live in assets/.
    for prefix, folder in (('icons/', 'icons'), ('stream-buddies/', 'sprites')):
        if filename.startswith(prefix):
            return send_from_directory(PROJECT_ROOT / 'assets' / folder, filename[len(prefix):])
    return send_from_directory(PROJECT_ROOT / 'web' / 'static', filename)

app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT']=0
runtime_config_value = runtime_config()
app.config["SECRET_KEY"] = load_or_create_secret()
socketio = SocketIO(app, async_mode="threading")
logger = configure_logging(data_dir() / "logs", runtime_config_value.log_level)
runtime_metrics = RuntimeMetrics()
archive = None
daily_diagnostics = None
studio_state = {"highlight": None, "like_goal": 100, "gift_goal": 10}
gifter_totals = {}
gifter_diamonds = {}
diagnostics = {key: None for key in ("comment", "like", "gift", "viewers", "room")}
viewer_samples = deque(maxlen=720)
last_sample = 0

# Estado global
state = {
    "connected": False,
    "connecting": False,
    "username": "",
    "comment_count": 0,
    "like_count": 0,
    "gift_count": 0,
    "viewer_count": 0,
    "retry_count": 0,
    "retry_in": 0,
    "stats_revision": 0,
    "like_events": 0,
    "last_like_at": None,
    "likes_known": False,
    "viewers_known": False,
    "likes_source": "pending",
    "session_like_units": 0,
    "room_like_count": None,
    "room_like_baseline": None,
}
runtime_state = RuntimeState(state)

tiktok_thread = None
tiktok_client = None
tiktok_loop = None
tiktok_task = None
platform_manager = None
stop_requested = threading.Event()
control_lock = threading.Lock()
feed_lock = threading.RLock()
comment_history = deque(maxlen=200)
seen_comment_ids = OrderedDict()
gift_history = OrderedDict()
recovered_gifts = OrderedDict()
gift_counts = OrderedDict()
seen_like_ids = OrderedDict()
gift_revision = 0
gift_catalog = OrderedDict()
participants = OrderedDict()
recent_joins = deque(maxlen=100)
participants_revision = 0
feed_session = uuid4().hex
session_metrics = None


def begin_session_metrics():
    global session_metrics
    with feed_lock:
        if not session_metrics or session_metrics['session'] != feed_session:
            session_metrics = dict(session=feed_session, started_at=time.time(), peak_viewers=None, finished=False)


def finish_session_metrics():
    with feed_lock:
        if not session_metrics or session_metrics['session'] != feed_session or session_metrics['finished']:
            return
        session_metrics['finished'] = True
        ended = time.time()
        summary = dict(id='session-summary', session=feed_session,
                       started_at=session_metrics['started_at'], ended_at=ended,
                       duration_seconds=max(0, round(ended-session_metrics['started_at'])),
                       comments=state['comment_count'],
                       gifts=sum(g.get('count', 0) for g in gift_history.values()),
                       peak_viewers=session_metrics['peak_viewers'], saved=False)
        if archive:
            try:
                summary['saved'] = True
                archive.save(feed_session, 'summary', summary)
            except (OSError, sqlite3.Error):
                summary['saved'] = False
                print('[Historial] No se pudo guardar el resumen de sesión')
        session_metrics['summary'] = summary
    socketio.emit('session_summary', summary)


def observe_participant(user, source="activity", joined=False):
    """Track users TikTok actually exposes; this is not a complete viewer roster."""
    global participants_revision
    username = getattr(user, "unique_id", None) or getattr(user, "nickname", None)
    if not username:
        return None
    key = str(username).casefold()
    now = time.time()
    with feed_lock:
        previous = participants.get(key, {})
        row = {"user": f"@{username}", "avatar_url": avatar_url(user),
               "badges": user_badges(user),
               "last_seen": now, "source": source,
               "joined_at": previous.get("joined_at")}
        if joined:
            row["joined_at"] = now
            recent_joins.appendleft(dict(row))
        participants[key] = row
        participants.move_to_end(key)
        while len(participants) > 300:
            participants.popitem(last=False)
        participants_revision += 1
        payload = participants_payload()
    socketio.emit("participants_update", payload)
    return row


def participants_payload():
    active = sorted((dict(x) for x in participants.values()), key=lambda x: x["last_seen"], reverse=True)
    return {"session": feed_session, "revision": participants_revision,
            "participants": active[:100], "joins": list(recent_joins)[:50],
            "scope": "Usuarios observados por entradas, comentarios y regalos; TikTok no entrega una lista completa de espectadores."}


def gift_records():
    """Return the complete visible gift feed, including reconnect recovery."""
    with feed_lock:
        combined = OrderedDict((key, dict(item, recovered=True))
                               for key, item in recovered_gifts.items())
        for key, item in gift_history.items():
            # A streak can continue after reconnecting.  Replace its recovered
            # snapshot and move the updated value to the newest position.
            combined.pop(key, None)
            combined[key] = dict(item)
        return [dict(item) for item in reversed(combined.values())]


def publish_gift_history():
    socketio.emit("gift_history", {"session": feed_session, "gift_version": gift_revision,
                                   "gifts": gift_records()})


def identify_live_and_recover(username, live_id):
    """Restore only gifts captured for the exact same TikTok room."""
    global gift_revision
    if not archive or not str(live_id or '').strip():
        return 0
    live_id = str(live_id)
    try:
        previous = archive.gifts_for_live(username, live_id, feed_session)
        archive.save(feed_session, 'live_identity', {
            'id': 'live-identity', 'live_id': live_id, 'username': username,
        })
    except (OSError, sqlite3.Error, ValueError, TypeError) as exc:
        print(f"[Regalos] No se pudo comprobar la sesión del LIVE: {type(exc).__name__}")
        return 0
    restored = []
    with feed_lock:
        for item in reversed(previous):
            key = str(item.get('id') or '')
            if not key or key in recovered_gifts or key in gift_history:
                continue
            count = max(1, int(item.get('count', 1)))
            recovered_gifts[key] = dict(item, recovered=True)
            gift_counts[key] = count
            user = str(item.get('user', '')).lstrip('@')
            gifter_totals[user] = gifter_totals.get(user, 0) + count
            diamonds = item.get('diamonds')
            if isinstance(diamonds, int):
                gifter_diamonds[user] = gifter_diamonds.get(user, 0) + diamonds
            restored.append(recovered_gifts[key])
        if restored:
            state['gift_count'] = sum(max(1, int(x.get('count', 1))) for x in gift_records())
            gift_revision += 1
    if restored:
        interactive.recover_gifts(restored)
        publish_gift_history()
        publish_stats()
    return len(restored)


def feed_snapshot(after=0, session=None, gifts_version=-1):
    with feed_lock:
        comments = list(comment_history)
        cursor = comments[-1]["sequence"] if comments else 0
        if session == feed_session and 0 <= after <= cursor:
            comments = [item for item in comments if item["sequence"] > after]
        result = {"session": feed_session, "cursor": cursor, "comments": comments,
                  "stats": stats_payload(), "gift_version": gift_revision,
                  "participants": participants_payload()}
        if session != feed_session or gifts_version != gift_revision:
            result["gifts"] = gift_records()
        return result



def stats_payload():
    return {"session": feed_session, "revision": state["stats_revision"],
            **live_counters.snapshot()[0],
            "comments": state["comment_count"], "likes": state["like_count"],
            "gifts": state["gift_count"], "viewers": state["viewer_count"],
            "likes_known": state["likes_known"], "viewers_known": state["viewers_known"],
            "likes_source": state["likes_source"],
            "session_like_units": state.get("session_like_units",0),
            "room_like_count": state.get("room_like_count"),
            "like_events": state["like_events"], "last_like_at": state["last_like_at"]}


def publish_stats():
    state["stats_revision"] += 1
    if session_metrics and session_metrics['session'] == feed_session and not session_metrics['finished'] and state['viewers_known']:
        session_metrics['peak_viewers'] = max(session_metrics['peak_viewers'] or 0, state['viewer_count'])
    record_daily_diagnostics()
    socketio.emit("stats_update", stats_payload())


def record_daily_diagnostics():
    if daily_diagnostics is not None:
        with feed_lock:
            daily_diagnostics.record(dict(state), dict(diagnostics), feed_session)


def monitor_daily_diagnostics():
    while True:
        record_daily_diagnostics()
        time.sleep(5 if state['connected'] or state['connecting'] else 30)


def sample_viewers():
    global last_sample
    now = time.time()
    if now - last_sample < 30:
        return
    last_sample = now
    record = {"id": str(int(now)), "at": now, "viewers": state["viewer_count"]}
    viewer_samples.append(record)
    if archive:
        archive.save(feed_session, "sample", record)


def remember_id(cache, key, value=True):
    cache[key] = value
    if len(cache) > 1000:
        cache.popitem(last=False)


def handle_like_event(event):
    with feed_lock:
        message_id = getattr(getattr(event, "common", None), "msg_id", 0)
        if message_id and message_id in seen_like_ids:
            return
        if message_id:
            remember_id(seen_like_ids, message_id)
        total = getattr(event, "total", 0) or 0
        count = getattr(event, "count", 0) or 0
        baseline = state.get("room_like_baseline")
        if total > 0:
            if not isinstance(baseline, int):
                baseline = max(0, int(total) - max(0, count))
                state["room_like_baseline"] = baseline
            room_delta = max(0, int(total) - baseline)
            state["session_like_units"] = max(state.get("session_like_units", 0), room_delta)
        else:
            state["session_like_units"] = state.get("session_like_units", 0) + max(0, count)
            room_delta = 0
        state["like_count"] = max(state["like_count"], state["session_like_units"], room_delta)
        state["like_events"] += 1
        state["likes_known"] = True
        state["likes_source"] = "event"
        state["last_like_at"] = time.strftime("%H:%M:%S")
        diagnostics["like"] = time.time()
        event_key=message_id or uuid4().hex
        like_record={"user":getattr(getattr(event,"user",None),"unique_id",None),
                     "avatar_url":avatar_url(getattr(event, 'user', None))}
        like_ranking.event(feed_session,like_record,count)
        interactive.event("like",like_record,event_key)
        points.event("like",like_record,event_key,max(1,count))
        overlay_animations.event('like', {**like_record, 'count':max(1,count)}, event_key)
        print(f"[Likes] cantidad={count}, total={total}, mostrado={state['like_count']}")
        publish_stats()


def update_room_stats(info):
    with feed_lock:
        diagnostics["room"] = time.time()
        stats = info.get("stats") or {}
        likes = info.get("like_count", stats.get("like_count"))
        viewers = info.get("user_count")
        if isinstance(likes, (int, float)) and likes >= 0:
            state["room_like_count"] = int(likes)
            if state.get("room_like_baseline") is None:
                state["room_like_baseline"] = max(0, int(likes) - state.get("session_like_units", 0))
            room_delta = max(0, int(likes) - state["room_like_baseline"])
            state["like_count"] = max(state["like_count"], state.get("session_like_units", 0), room_delta)
            state["likes_known"] = True
            if state["likes_source"] != "event":
                state["likes_source"] = "room"
        if isinstance(viewers, (int, float)) and viewers >= 0:
            state["viewer_count"] = int(viewers)
            state["viewers_known"] = True
            diagnostics["viewers"] = time.time()
            sample_viewers()
        publish_stats()


async def refresh_room_stats(client):
    while not stop_requested.is_set():
        try:
            info = await asyncio.wait_for(client.web.fetch_room_info(), 10)
            update_room_stats(info)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[Stats] No se pudo consultar la sala: {type(exc).__name__}")
        await asyncio.sleep(30)


def catalog_image(value):
    if isinstance(value,dict):
        for url in value.get('url_list',[]) or []:
            if isinstance(url,str) and url.startswith('https://'):return url
    return image_url(value)


def update_gift_catalog(raw):
    def visit(value):
        if isinstance(value,dict):
            name=value.get('name');gift_id=value.get('id',value.get('gift_id'))
            if name and gift_id is not None and any(k in value for k in ('diamond_count','gift_type','type')):
                gift_catalog[str(gift_id)]={'id':str(gift_id),'name':str(name)[:100],
                    'diamonds':max(0,int(value.get('diamond_count',0) or 0)),
                    'image_url':catalog_image(value.get('image'))}
            for child in value.values():visit(child)
        elif isinstance(value,list):
            for child in value:visit(child)
    visit(raw)
    while len(gift_catalog)>1000:gift_catalog.popitem(last=False)


def gift_catalog_payload():
    gifts=sorted((dict(x) for x in gift_catalog.values()),key=lambda x:(x['diamonds'],x['name'].casefold()))
    return {'gifts':gifts,'count':len(gifts),'connected':state['connected']}


def event_emotes(event):
    """Return the safe image URLs TikTok attaches to custom chat emojis."""
    result=[]
    values=getattr(event,'emotes',None) or getattr(event,'emote_list',None) or []
    for value in values:
        emote=getattr(value,'emote',None) or value
        url=image_url(getattr(emote,'image',None))
        if not url:continue
        raw_index=getattr(value,'index',-1)
        try:index=max(-1,int(raw_index))
        except (TypeError,ValueError):index=-1
        result.append({'id':str(getattr(emote,'emote_id','') or getattr(emote,'uuid',''))[:100],
                       'index':index,'url':url})
        if len(result)>=24:break
    return result


def handle_comment_event(event):
    observe_participant(event.user, "comment")
    common = getattr(event, "common", None)
    message_id = str(getattr(common, "msg_id", "") or uuid4().hex)
    emotes = event_emotes(event)
    comment = str(getattr(event, "comment", None) or getattr(event, "content", None) or "")[:2000]
    payload = {
        "id": message_id,
        "session": feed_session,
        "user": f"@{event.user.unique_id}",
        "avatar_url": avatar_url(event.user),
        "badges": user_badges(event.user),
        "is_follower": follower_status(event.user),
        "emoji": "💬",
        "comment": comment,
        "emotes": emotes,
        "likes": 0,
        "timestamp": time.strftime("%H:%M:%S"),
        "occurred_at": time.time(),
        "platform": "tiktok",
        "platform_label": "TikTok",
        "identity": f"tiktok:{event.user.unique_id}",
    }
    return publish_comment_payload(payload)


def publish_comment_payload(payload):
    """Store and fan out a normalized comment from any live platform."""
    payload = dict(payload)
    message_id = str(payload.get("id") or uuid4().hex)
    payload["id"] = message_id
    payload["session"] = feed_session
    payload["comment"] = str(payload.get("comment") or "")[:2000]
    payload["user"] = str(payload.get("user") or "@Espectador")[:160]
    payload.setdefault("emoji", "💬")
    payload.setdefault("emotes", [])
    payload.setdefault("badges", [])
    payload.setdefault("likes", 0)
    payload.setdefault("timestamp", time.strftime("%H:%M:%S"))
    payload.setdefault("occurred_at", time.time())
    payload.setdefault("platform", "tiktok")
    payload.setdefault("platform_label", payload["platform"].title())
    with feed_lock:
        if message_id in seen_comment_ids:
            return
        seen_comment_ids[message_id] = None
        if len(seen_comment_ids) > 1000:
            seen_comment_ids.popitem(last=False)
        payload["sequence"] = state["comment_count"] + 1
        comment_history.append(payload)
        state["comment_count"] += 1
        diagnostics["comment"] = time.time()
    if archive:
        archive.save(feed_session, "comment", payload)
    production.comment(payload)
    creator_suite.audience_event('comment', payload, message_id)
    interactive.event("comment",payload,message_id)
    overlay_animations.event("comment",payload,message_id)
    points.event("comment",payload,message_id)
    user_info_overlay.command(payload)
    spotify.comment(payload)
    chatbot.comment(payload)
    socketio.emit("new_comment", payload)
    publish_stats()
    return payload


def _external_occurred_at(value):
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            from datetime import datetime
            return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
    return time.time()


def observe_external_participant(platform, data, source="comment"):
    global participants_revision
    username = str(data.get("user") or "Espectador")[:100]
    identity = str(data.get("user_id") or username).casefold()
    key = f"{platform}:{identity}"
    now = time.time()
    with feed_lock:
        previous = participants.get(key, {})
        row = {"user": f"@{username}", "avatar_url": data.get("avatar_url"),
               "badges": list(data.get("badges") or [])[:12], "last_seen": now,
               "source": source, "joined_at": previous.get("joined_at"),
               "platform": platform}
        participants[key] = row
        participants.move_to_end(key)
        while len(participants) > 300:
            participants.popitem(last=False)
        participants_revision += 1
        payload = participants_payload()
    socketio.emit("participants_update", payload)


def handle_external_comment(platform, data):
    """Normalize YouTube/Twitch comments into TikReader's existing pipeline."""
    labels = {"youtube": "YouTube", "twitch": "Twitch"}
    username = str(data.get("user") or "Espectador")[:100]
    identity = str(data.get("user_id") or username).casefold()[:160]
    raw_id = str(data.get("id") or uuid4().hex)
    observe_external_participant(platform, data)
    occurred_at = _external_occurred_at(data.get("occurred_at"))
    return publish_comment_payload({
        "id": f"{platform}:{raw_id}", "user": f"@{username}",
        "avatar_url": data.get("avatar_url"), "badges": list(data.get("badges") or [])[:12],
        "is_follower": None, "comment": data.get("comment"), "timestamp": time.strftime("%H:%M:%S", time.localtime(occurred_at)),
        "occurred_at": occurred_at, "platform": platform,
        "platform_label": labels.get(platform, platform.title()),
        "identity": f"{platform}:{identity}", "event": data.get("event"),
    })


def handle_external_support(platform, data):
    """Represent paid platform interactions without pretending they are TikTok diamonds."""
    global gift_revision
    labels = {"youtube": "YouTube", "twitch": "Twitch"}
    username = str(data.get("user") or "Espectador")[:100]
    raw_id = str(data.get("id") or uuid4().hex)
    key = f"{platform}:support:{raw_id}"
    observe_external_participant(platform, data, "support")
    occurred_at = _external_occurred_at(data.get("occurred_at"))
    amount = str(data.get("display_amount") or "").strip()
    gift_name = "Super Chat" if platform == "youtube" else "Apoyo"
    if amount:
        gift_name += f" · {amount}"
    with feed_lock:
        if key in gift_history:
            return
        record = {"id": key, "user": f"@{username}", "avatar_url": data.get("avatar_url"),
                  "gift": gift_name, "gift_id": gift_name.casefold(), "image_url": None,
                  "count": 1, "diamonds": None, "ongoing": False,
                  "timestamp": time.strftime("%H:%M:%S", time.localtime(occurred_at)),
                  "occurred_at": occurred_at, "platform": platform,
                  "platform_label": labels.get(platform, platform.title()),
                  "identity": f"{platform}:{str(data.get('user_id') or username).casefold()[:160]}"}
        state["gift_count"] += 1
        gift_history[key] = record
        gift_revision += 1
        if archive:
            archive.save(feed_session, "gift", record)
    creator_suite.audience_event("gift", record, key, 1)
    live_counters.event("gift", key, record, 1, None)
    interactive.event("gift", record, key, quantity=1)
    points.event("gift", record, key, 1)
    animation_studio.gift(record, key)
    overlay_animations.event("gift", record, key)
    publish_gift_history()
    if data.get("comment"):
        handle_external_comment(platform, data)
    publish_stats()
    return record


def handle_gift_event(event, update_catalog=True):
    global gift_revision
    user = getattr(event, "user", None)
    gift = getattr(event, "gift", None)
    username = getattr(user, "unique_id", None) or getattr(user, "nickname", None) or "Usuario"
    observe_participant(user, "gift")
    gift_id = getattr(event, "gift_id", 0) or getattr(gift, "id", 0)
    if update_catalog:
        gift_catalog[str(gift_id)]={'id':str(gift_id),'name':getattr(gift,'name',None) or f'Regalo #{gift_id}',
            'diamonds':max(0,int(getattr(gift,'diamond_count',0) or 0)),'image_url':image_url(getattr(gift,'image',None))}
    group_id = getattr(event, "group_id", 0)
    message_id = getattr(getattr(event, "common", None), "msg_id", 0)
    streakable = getattr(gift, "type", 0) == 1
    ongoing = streakable and not bool(getattr(event, "repeat_end", 0))
    # Without a group ID, count only the final streak notification.
    if ongoing and not group_id:
        return
    key = (f"group:{username}:{gift_id}:{group_id}" if streakable and group_id
           else f"message:{message_id or uuid4().hex}")
    count = max(1, getattr(event, "repeat_count", 0) or 1)
    with feed_lock:
        previous = gift_counts.get(key, 0)
        count = max(count, previous)
        remember_id(gift_counts, key, count)
        state["gift_count"] += count - previous
        gifter_totals[username] = gifter_totals.get(username, 0) + count - previous
        diamonds = getattr(gift, "diamond_count", None)
        diamonds = diamonds if isinstance(diamonds, int) and diamonds > 0 else None
        if diamonds is not None:
            gifter_diamonds[username] = gifter_diamonds.get(username, 0) + (count - previous) * diamonds
        diagnostics["gift"] = time.time()
        record = {"id": key, "user": f"@{username}", "avatar_url": avatar_url(user),
                  "gift": getattr(gift, "name", None) or f"Regalo #{gift_id}",
                  "gift_id": str(gift_id),
                  "image_url": image_url(getattr(gift, "image", None)),
                  "count": count, "diamonds": count * diamonds if diamonds is not None else None,
                  "ongoing": ongoing, "timestamp": time.strftime("%H:%M:%S"), "occurred_at": time.time()}
        hotkey_results = []
        if count > previous:
            creator_suite.audience_event('gift', record, f'{key}:{count}', count-previous)
            live_counters.event('gift', f'{key}:{count}', record, count-previous,
                                (count-previous)*diamonds if diamonds is not None else None)
            interactive.event("gift",record,f"{key}:{count}",quantity=count-previous)
            points.event("gift",record,f"{key}:{count}",count-previous)
            hotkey_results = game_hotkeys.gift(record,f"{key}:{count}")
            animation_studio.gift(record,f"{key}:{count}")
            overlay_animations.event('gift',record,f"{key}:{count}")
        gift_history[key] = record
        if archive:
            archive.save(feed_session, "gift", record)
        gift_history.move_to_end(key)
        if len(gift_history) > 100:
            gift_history.popitem(last=False)
        gift_revision += 1
        print(f"[Regalos] id={gift_id}, cantidad={count}, unidades={state['gift_count']}")
        publish_gift_history()
        publish_stats()
        return dict(record=record, hotkeys=hotkey_results)


def image_url(picture):
    for url in getattr(picture, "url_list", []) or []:
        if not isinstance(url, str):
            continue
        try:
            parsed = urlsplit(url)
            if parsed.scheme == "https" and parsed.hostname and not parsed.username:
                return url
        except ValueError:
            continue
    return None


def avatar_url(user):
    for field in ("avatar_thumb", "avatar_medium", "avatar_large"):
        url = image_url(getattr(user, field, None))
        if url:
            return url
    return None


def follower_status(user):
    """Unknown is not a confirmed non-follower; never infer from follower counts."""
    info = getattr(user, "follow_info", None)
    status = getattr(info, "follow_status", None)
    if status in (1, 2):
        return True
    if getattr(user, "is_follower", None) is True:
        return True
    if info is not None and status == 0:
        return False
    return None

RETRY_DELAYS = (2, 5, 10)
RETRYABLE_ERRORS = {"TIMEOUT", "CONNECTION_ERROR", "WEBSOCKET_ERROR"}

CONNECT_TIMEOUT = 20  # segundos máximos esperando conexión a TikTok


# ── Error classifier ──────────────────────────────────────────────────────────
def classify_tiktok_error(e: Exception) -> dict:
    msg = str(e)
    msg_lower = (type(e).__name__ + " " + msg).lower()

    if "useroffline" in msg_lower:
        return {
            "code": "USER_NOT_LIVE",
            "title": "LIVE no activo",
            "detail": "TikTok indica que esta cuenta no tiene una transmisión activa en este momento.",
            "suggestion": "Si acabas de iniciar el LIVE, espera unos segundos y vuelve a conectar.",
        }
    if any(x in msg_lower for x in ["usernotfound", "not capable", "never gone live", "does not exist",
                                    "failedparseroomid", "sigi_state", "captcha"]):
        # A failed HTML lookup followed by user_not_found from the API is
        # ambiguous: TikTokLive documents that a captcha can cause it too.
        return {
            "code": "LIVE_LOOKUP_FAILED",
            "title": "No se pudo consultar el LIVE",
            "detail": "TikTok no devolvió los datos necesarios para localizar la transmisión. Esto no confirma que la cuenta no exista o que esté fuera de línea.",
            "suggestion": "Comprueba el @usuario exacto y abre su LIVE en TikTok. Si allí se ve, espera un momento y vuelve a conectar en TikReader.",
        }
    if any(x in msg_lower for x in ["429", "rate limit", "too many"]):
        return {
            "code": "RATE_LIMITED",
            "title": "Demasiadas solicitudes",
            "detail": "TikTok bloqueó temporalmente las conexiones.",
            "suggestion": "Espera 1-2 minutos e intenta de nuevo.",
        }
    if "timeout" in msg_lower or "timed out" in msg_lower:
        return {
            "code": "TIMEOUT",
            "title": "Tiempo de conexión agotado",
            "detail": "No se recibió respuesta de TikTok a tiempo. No se pudo comprobar el estado del LIVE.",
            "suggestion": "Comprueba que puedes abrir TikTok y vuelve a conectar en unos segundos.",
        }
    if "websocket" in msg_lower:
        return {
            "code": "WEBSOCKET_ERROR",
            "title": "No se pudo abrir la conexión al LIVE",
            "detail": "El servicio rechazó o interrumpió la conexión en tiempo real. Esto no significa que no tengas internet.",
            "suggestion": "Espera un momento y vuelve a conectar. Si persiste, revisa el diagnóstico del programa.",
        }
    if any(x in msg_lower for x in ["connect", "network", "refused", "unreachable"]):
        return {
            "code": "CONNECTION_ERROR",
            "title": "Error de conexión",
            "detail": "No se pudo establecer la conexión con los servicios de TikTok.",
            "suggestion": "Comprueba el acceso a TikTok y los permisos de red del programa; después vuelve a intentarlo.",
        }
    if "sign" in msg_lower or "signature" in msg_lower or "auth" in msg_lower:
        return {
            "code": "AUTH_ERROR",
            "title": "Error de autenticación",
            "detail": "TikTok rechazó la conexión. La librería puede estar desactualizada.",
            "suggestion": "Ejecuta: pip install --upgrade TikTokLive",
        }
    return {
        "code": "UNKNOWN_ERROR",
        "title": "Error inesperado",
        "detail": msg[:200],
        "suggestion": "Revisa la consola del servidor para más detalles.",
    }


# ── TikTok Live mode ─────────────────────────────────────────────────────────
def run_tiktok_live(username: str):
    global tiktok_client, tiktok_loop, tiktok_task
    failure = None

    def report_error(error):
        nonlocal failure
        failure = error["code"]
        from release_support import connection_failures
        connection_failures.append({'code': failure, 'at': int(time.time())})
        if archive:
            archive.save(feed_session,'connection_error',{'id':uuid4().hex,'code':str(error['code'])[:80]})
        socketio.emit("tiktok_error", error)

    async def _run():
        global tiktok_client, tiktok_task
        tiktok_task = asyncio.current_task()
        if stop_requested.is_set():
            return
        connected_event = asyncio.Event()
        client_error = None
        room_stats_task = None

        try:
            from tiktok_transport import install_url_encoding_fix
            install_url_encoding_fix()
            client = TikTokLiveClient(unique_id=username)
        except Exception as e:
            err = classify_tiktok_error(e)
            print(f"[TikTok] Error creando cliente: {e}")
            report_error(err)
            state["connected"] = False
            return

        tiktok_client = client

        @client.on(ConnectEvent)
        async def on_connect(event):
            nonlocal room_stats_task
            if stop_requested.is_set():
                return
            state["connected"] = True
            begin_session_metrics()
            state["connecting"] = False
            state["retry_in"] = 0
            connected_event.set()
            socketio.emit("connected", {"username": username})
            print(f"[TikTok] ✅ Conectado a @{username}")
            try:
                live_id = getattr(client, 'room_id', None)
            except (AttributeError, RuntimeError, ValueError):
                live_id = None
            if live_id:
                identify_live_and_recover(username, live_id)
            if hasattr(client.web, "fetch_room_info") and room_stats_task is None:
                room_stats_task = asyncio.create_task(refresh_room_stats(client))
            async def fetch_catalog():
                try:
                    update_gift_catalog(await asyncio.wait_for(client.web.fetch_gift_list(),10))
                    if archive:archive.set_setting('gift_catalog_cache',list(gift_catalog.values()))
                    socketio.emit('gift_catalog',gift_catalog_payload())
                except Exception as exc:
                    print(f"[Regalos] Catálogo no disponible: {type(exc).__name__}")
            if hasattr(client.web,'fetch_gift_list'):
                asyncio.create_task(fetch_catalog())

        @client.on(RoomUserSeqEvent)
        async def on_viewers(event):
            state["viewer_count"] = max(0, event.total)
            state["viewers_known"] = True
            diagnostics["viewers"] = time.time()
            sample_viewers()
            publish_stats()

        @client.on(DisconnectEvent)
        async def on_disconnect(event):
            state["connected"] = False
            socketio.emit("disconnected", {"reason": "Stream finalizado"})
            print(f"[TikTok] Desconectado de @{username}")

        @client.on(CommentEvent)
        async def on_comment(event):
            handle_comment_event(event)

        if EmoteChatEvent:
            @client.on(EmoteChatEvent)
            async def on_emote_comment(event):
                handle_comment_event(event)

        @client.on(LikeEvent)
        async def on_like(event):
            handle_like_event(event)

        @client.on(GiftEvent)
        async def on_gift(event):
            handle_gift_event(event)

        @client.on(JoinEvent)
        async def on_join(event):
            observe_participant(event.user, "join", joined=True)

        import TikTokLive.events as extra_events
        for battle_name, battle_kind in [('LinkMicBattleEvent','battle'),('LinkMicArmiesEvent','armies')]:
            battle_type=getattr(extra_events,battle_name,None)
            if battle_type:
                async def on_battle(event, kind=battle_kind):
                    try:
                        creator_suite.battles.receive(event,kind)
                    except (ValueError,TypeError,AttributeError,RuntimeError,sqlite3.Error):
                        logger.warning('battle_event_unavailable kind=%s',kind)
                client.on(battle_type)(on_battle)
        for event_name, kind in [('FollowEvent','follow'),('ShareEvent','share'),('SubNotifyEvent','subscribe')]:
            event_type=getattr(extra_events,event_name,None)
            if event_type:
                async def on_extra(event, kind=kind):
                    message_id=getattr(getattr(event,'common',None),'msg_id',0)
                    if message_id:
                        extra_record={"user":getattr(getattr(event,"user",None),"unique_id",None), "avatar_url":avatar_url(getattr(event,"user",None))}
                        live_counters.event(kind,message_id,extra_record)
                        interactive.event(kind,extra_record,message_id)
                        points.event(kind,extra_record,message_id)
                        overlay_animations.event(kind,extra_record,message_id)
                        publish_stats()
                client.on(event_type)(on_extra)

        # ── Correr cliente con timeout de conexión y mejor manejo de errores ──
        async def client_task_with_error_capture():
            nonlocal client_error
            try:
                # start() returns the receiver task; it does not wait for it.
                receiver = await client.start()
                await receiver
                if not connected_event.is_set():
                    raise RuntimeError("La conexión terminó antes de recibir la confirmación de TikTok.")
            except asyncio.CancelledError:
                pass
            except Exception as e:
                client_error = e
                connected_event.set()  # Desbloquear el wait

        try:
            # Lanzar el cliente en background
            task = asyncio.create_task(client_task_with_error_capture())

            try:
                # Esperar a que conecte o que ocurra un error
                await asyncio.wait_for(
                    connected_event.wait(),
                    timeout=CONNECT_TIMEOUT
                )
            except asyncio.TimeoutError:
                # Si después del timeout no conectó, cancelar y reportar
                if not state["connected"]:
                    task.cancel()
                    try:
                        await asyncio.wait_for(task, timeout=2)
                    except (asyncio.TimeoutError, asyncio.CancelledError):
                        pass

                    print(f"[TikTok] ⏱ Timeout esperando conexión a @{username}")
                    report_error({
                        "code": "TIMEOUT",
                        "title": "No se pudo conectar",
                        "detail": (
                            f"No se confirmó la conexión en {CONNECT_TIMEOUT} segundos. "
                            "Esto no confirma que el usuario esté fuera de línea: "
                            "también puede fallar la red, el servicio de firma o el WebSocket."
                        ),
                        "suggestion": "Verifica que el usuario esté transmitiendo en este momento.",
                    })
                    state["connected"] = False
                    return

            # Si hubo error durante la inicialización, reportarlo ahora
            if client_error:
                err = classify_tiktok_error(client_error)
                print(f"[TikTok] Error durante conexión ({err['code']}): {client_error}")
                report_error(err)
                state["connected"] = False
                return

            # Si conectó exitosamente, esperar a que el stream termine
            if not task.done():
                await task
            if client_error:
                print(f"[TikTok] Error recibiendo eventos: {type(client_error).__name__}: {client_error}")
                report_error(classify_tiktok_error(client_error))

        except asyncio.CancelledError:
            pass
        except Exception as e:
            err = classify_tiktok_error(e)
            print(f"[TikTok] Error ({err['code']}): {e}")
            report_error(err)
            state["connected"] = False
        finally:
            if room_stats_task:
                room_stats_task.cancel()
                await asyncio.gather(room_stats_task, return_exceptions=True)
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            try:
                await asyncio.wait_for(client.disconnect(), timeout=3)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                print(f"[TikTok] Error cerrando cliente: {e}")
            finally:
                # TikTokLive 7.0 close() re-enters the running event loop.
                # Close its HTTP session directly after stopping the receiver.
                await client.web.close()
            if tiktok_client is client:
                tiktok_client = None

    loop = asyncio.new_event_loop()
    tiktok_loop = loop
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_run())
    except asyncio.CancelledError:
        pass
    except Exception as e:
        report_error(classify_tiktok_error(e))
        print(f"[TikTok] Error fatal en event loop: {e}")
    finally:
        pending = asyncio.all_tasks(loop)
        for pending_task in pending:
            pending_task.cancel()
        if pending:
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        loop.close()
        tiktok_loop = None
        tiktok_task = None
        state["connected"] = False
        state["connecting"] = False
        socketio.emit("disconnected", {"reason": "Conexión finalizada"})


    return failure


def run_tiktok_session(username):
    """Retry transient failures with a fresh signed connection and bounded backoff."""
    for attempt in range(len(RETRY_DELAYS) + 1):
        if stop_requested.is_set():
            break
        failure = run_tiktok_live(username)
        if stop_requested.is_set() or failure not in RETRYABLE_ERRORS:
            break
        if attempt == len(RETRY_DELAYS):
            break
        delay = RETRY_DELAYS[attempt]
        state.update(connected=False, connecting=True, retry_count=attempt + 1, retry_in=delay)
        socketio.emit("reconnecting", {"username": username, "attempt": attempt + 1,
                                       "delay": delay, "maximum": len(RETRY_DELAYS)})
        if stop_requested.wait(delay):
            break
    state.update(connecting=False, retry_in=0)
    manager = globals().get("platform_manager")
    if not manager or not manager.active():
        finish_session_metrics()


# ── HTTP modules ─────────────────────────────────────────────────────────────
from history_routes import register_history_routes
from studio_routes import register_studio_routes
import widget_routes
from diagnostics_routes import register_diagnostics_routes

WIDGET_DEFAULTS = widget_routes.WIDGET_DEFAULTS
WIDGET_PANELS = widget_routes.WIDGET_PANELS
validate_widget_settings = widget_routes.validate_widget_settings

register_history_routes(app, sys.modules[__name__])
register_studio_routes(app, sys.modules[__name__])
widget_routes.register_widget_routes(app, sys.modules[__name__])
register_diagnostics_routes(app, sys.modules[__name__])


# ── SocketIO events ───────────────────────────────────────────────────────────
@socketio.on("connect")
def handle_connect():
    if not production.local():
        return False
    emit("status", state)
    emit("comment_history", feed_snapshot())
    emit("stats_update", stats_payload())
    manager = globals().get("platform_manager")
    if manager:
        emit("platform_status", manager.snapshot())
    print("[SocketIO] Cliente conectado")


def stop_connection():
    """Cancel on the owning event loop; never disconnect from another loop."""
    stop_requested.set()
    loop, task = tiktok_loop, tiktok_task
    if loop and task and not loop.is_closed():
        try:
            loop.call_soon_threadsafe(task.cancel)
        except RuntimeError:
            pass  # The worker finished between the checks.
    if tiktok_thread and tiktok_thread.is_alive():
        tiktok_thread.join(timeout=5)
        return not tiktok_thread.is_alive()
    return True


def prepare_external_session(platform, channel):
    """Create a feed session when YouTube/Twitch is the first live source."""
    global feed_session, gift_revision, participants_revision, last_sample
    if simulation.active:
        return {"code": "SIMULATION_ACTIVE", "title": "Modo simulación activo",
                "detail": "Desactiva el modo simulación antes de conectar una plataforma."}
    manager = globals().get("platform_manager")
    if state["connected"] or state["connecting"] or (manager and manager.active()):
        return None
    with control_lock:
        with feed_lock:
            feed_session = uuid4().hex
            comment_history.clear()
            seen_comment_ids.clear()
            gift_history.clear()
            recovered_gifts.clear()
            gift_counts.clear()
            seen_like_ids.clear()
            participants.clear()
            recent_joins.clear()
            participants_revision = 0
            gift_revision = 0
            gifter_totals.clear()
            gifter_diamonds.clear()
            viewer_samples.clear()
            last_sample = 0
            for key in diagnostics:
                diagnostics[key] = None
            studio_state["highlight"] = None
            production.reset_session()
            label = f"{platform}:{str(channel)[:100]}"
            if archive:
                archive.start(feed_session, label)
        state.update(connected=False, connecting=False, username=label,
                     comment_count=0, like_count=0, gift_count=0, viewer_count=0,
                     retry_count=0, retry_in=0, stats_revision=0, like_events=0,
                     last_like_at=None, likes_known=False, viewers_known=False,
                     likes_source="pending", session_like_units=0, room_like_count=None,
                     room_like_baseline=None)
        interactive.reset_live_session()
        socketio.emit("comment_history", feed_snapshot())
        publish_stats()
    return None


def external_platform_stopped():
    manager = globals().get("platform_manager")
    if not state["connected"] and not state["connecting"] and (not manager or not manager.active()):
        finish_session_metrics()


def start_connection(username):
    global tiktok_thread, feed_session, gift_revision, participants_revision, last_sample
    username = username.strip().lstrip("@") if isinstance(username, str) else ""
    if not re.fullmatch(r"[A-Za-z0-9_.]{2,24}", username):
        return {
            "code": "INVALID_USERNAME", "title": "Usuario inválido",
            "detail": "Ingresa el usuario de TikTok, no una URL ni el nombre visible.",
            "suggestion": "Usa de 2 a 24 letras, números, puntos o guiones bajos.",
        }
    if not TIKTOKLIVE_AVAILABLE:
        return {
            "code": "LIBRARY_ERROR", "title": "TikTokLive no disponible",
            "detail": "No se pudo cargar la librería de conexión.",
            "suggestion": "Ejecuta: python -m pip install -r requirements.txt",
        }
    with control_lock:
        if simulation.active:
            return {"code":"SIMULATION_ACTIVE", "title":"Modo simulación activo",
                "detail":"Desactiva el modo simulación antes de conectar un LIVE.", "suggestion":"Abre Avanzados → Modo simulación."}
        if (state["username"] == username and tiktok_thread and tiktok_thread.is_alive()
                and not stop_requested.is_set()):
            return None
        if not stop_connection():
            return {
                "code": "STOPPING", "title": "Cerrando conexión anterior",
                "detail": "La conexión anterior aún no terminó.",
                "suggestion": "Espera unos segundos antes de volver a conectar.",
            }
        stop_requested.clear()
        manager = globals().get("platform_manager")
        joining_external = bool(manager and manager.active())
        if not joining_external:
            with feed_lock:
                feed_session = uuid4().hex
                comment_history.clear()
                seen_comment_ids.clear()
                gift_history.clear()
                recovered_gifts.clear()
                gift_counts.clear()
                seen_like_ids.clear()
                participants.clear()
                recent_joins.clear()
                participants_revision = 0
                gift_revision = 0
                gifter_totals.clear()
                gifter_diamonds.clear()
                viewer_samples.clear()
                last_sample = 0
                for key in diagnostics:
                    diagnostics[key] = None
                studio_state["highlight"] = None
                production.reset_session()
                if archive:
                    archive.start(feed_session, username)
            state.update(connected=False, connecting=True, username=username,
                         comment_count=0, like_count=0, gift_count=0, viewer_count=0, retry_count=0, retry_in=0, stats_revision=0, like_events=0, last_like_at=None,
                         likes_known=False, viewers_known=False, likes_source="pending",session_like_units=0,
                         room_like_count=None,room_like_baseline=None)
        else:
            state.update(connected=False, connecting=True, username=username, retry_count=0, retry_in=0)
        if not joining_external:
            interactive.reset_live_session()
        socketio.emit("comment_history", feed_snapshot())
        socketio.emit("connecting", {"username": username})
        publish_stats()
        tiktok_thread = threading.Thread(target=run_tiktok_session, args=(username,), daemon=True)
        tiktok_thread.start()
    return None


@socketio.on("start_live")
def handle_start(data):
    if not production.local():
        return
    username = data.get("username", "") if isinstance(data, dict) else ""
    error = start_connection(username)
    if error:
        emit("tiktok_error", error)


@socketio.on("stop_live")
def handle_stop():
    if not production.local():
        return
    manager = globals().get("platform_manager")
    if manager:
        manager.stop_all()
    stopped = stop_live_connection()
    emit("disconnected", {"reason": "Detenido por el usuario" if stopped else "Cerrando conexión"})


def stop_live_connection():
    with control_lock:
        stopped = stop_connection()
        if stopped:
            state.update(connected=False, connecting=False)
        return stopped


@socketio.on("start_platform")
def handle_start_platform(data):
    if not production.local():
        return
    data = data if isinstance(data, dict) else {}
    error = platform_manager.start(data.get("platform"), data.get("config") or {})
    if error:
        emit("platform_error", error)


@socketio.on("platform_status_request")
def handle_platform_status_request():
    if production.local():
        emit("platform_status", platform_manager.snapshot())


@socketio.on("stop_platform")
def handle_stop_platform(data):
    if not production.local():
        return
    platform = data.get("platform") if isinstance(data, dict) else ""
    platform_manager.stop(platform)
    external_platform_stopped()


from production import Production
production = Production(app, sys.modules[__name__])
from microphone_captions import MicrophoneCaptions
microphone_captions = MicrophoneCaptions(app, sys.modules[__name__])
from points_system import PointsSystem
points = PointsSystem(app, sys.modules[__name__])
from live_counters import LiveCounters
live_counters = LiveCounters(app, sys.modules[__name__])
from minecraft_connector import MinecraftConnector
minecraft = MinecraftConnector(app, sys.modules[__name__])
from interactivity import Interactivity
interactive = Interactivity(app, sys.modules[__name__])
from obs_direct import OBSDirect
obs_direct = OBSDirect(app, sys.modules[__name__])
from chatbot import Chatbot
chatbot = Chatbot(app, sys.modules[__name__])
from game_hotkeys import GameHotkeys
game_hotkeys = GameHotkeys(app, sys.modules[__name__])
from animation_studio import AnimationStudio
animation_studio = AnimationStudio(app, sys.modules[__name__])
from overlay_animations import OverlayAnimations
overlay_animations = OverlayAnimations(app, sys.modules[__name__])
from user_info_overlay import UserInfoOverlay
user_info_overlay = UserInfoOverlay(app, sys.modules[__name__])
from emoji_overlay import EmojiOverlay
emoji_overlay = EmojiOverlay(app, sys.modules[__name__])
from seasonal_overlay import SeasonalOverlay
seasonal = SeasonalOverlay(app, sys.modules[__name__])
from stream_buddies import StreamBuddies
stream_buddies = StreamBuddies(app, sys.modules[__name__])
from spotify_integration import Spotify
spotify = Spotify(app, sys.modules[__name__])
from operator_tools import OperatorTools
operator_tools = OperatorTools(app, sys.modules[__name__])
from live_tools import LiveTools
live_tools = LiveTools(app, sys.modules[__name__])
from reliability import Reliability
reliability = Reliability(app, sys.modules[__name__])
from voice_models import VoiceModels
voice_models = VoiceModels(app, Path(__file__).parent.parent)
from local_tts import LocalTTS
local_tts = LocalTTS(app, Path(__file__).parent.parent)
from voice_downloads import VoiceDownloads
voice_downloads = VoiceDownloads(app, sys.modules[__name__])
from release_support import register_release_routes
register_release_routes(app, sys.modules[__name__])
from simulation import Simulation
simulation = Simulation(app, sys.modules[__name__])
from creator_suite import CreatorSuite
creator_suite = CreatorSuite(app, sys.modules[__name__])
from platform_connectors import PlatformManager
platform_manager = PlatformManager(sys.modules[__name__])
register_system_routes(app, sys.modules[__name__], runtime_config_value, runtime_metrics)
register_core_routes(app, sys.modules[__name__], Path(__file__).parent.parent)

if __name__ == "__main__":
    from daily_diagnostics import DailyDiagnostics
    daily_diagnostics = DailyDiagnostics(data_dir() / 'logs')
    threading.Thread(target=monitor_daily_diagnostics, daemon=True, name='daily-diagnostics').start()
    archive = HistoryStore(data_dir() / "history.sqlite3")
    for cached_gift in archive.settings().get('gift_catalog_cache',[]):
        if isinstance(cached_gift,dict) and cached_gift.get('id') and cached_gift.get('name'):
            gift_catalog[str(cached_gift['id'])]=cached_gift
    if not gift_catalog:
        latest_sessions=archive.sessions()
        if latest_sessions:
            for item in archive.recent_gifts(latest_sessions[0]['username']):
                key='observed:'+str(item.get('gift','')).casefold();count=max(1,int(item.get('count',1)))
                gift_catalog[key]={'id':key,'name':str(item.get('gift') or 'Regalo')[:100],
                    'diamonds':max(0,int((item.get('diamonds') or 0)/count)),'image_url':item.get('image_url')}
    studio_state.update({key: value for key, value in archive.settings().items() if key in ("like_goal", "gift_goal")})
    try:
        interactive.rules=[interactive.validate(r) for r in archive.settings().get("interactive_rules",[])][:50]
    except (ValueError,TypeError):
        print("[Reglas] Configuración inválida; reglas desactivadas")
    interactive.remaining=max(0,min(86400,int(archive.settings().get('timer_checkpoint',0))))
    points.restore()
    live_counters.restore()
    interactive.restore_overlays()
    import bank_storage
    bank_storage.restore(sys.modules[__name__],interactive.overlay_games['drop'], restore_contents=False)
    interactive.overlay_serial=max([int(e['id']) for e in interactive.overlay_games['drop']['contents']]+[0])
    try:chatbot.configure(archive.settings().get('chatbot',{}))
    except (ValueError,TypeError):pass
    minecraft.restore()
    live_tools.effects_mode=archive.settings().get('effects_mode','enqueue')
    if live_tools.effects_mode not in ('enqueue','replace','skip'):live_tools.effects_mode='enqueue'
    interactive.running=False
    reliability.restore()
    game_hotkeys.restore()
    animation_studio.restore()
    overlay_animations.restore()
    stream_buddies.restore()
    seasonal.restore()
    emoji_overlay.restore()
    user_info_overlay.restore()
    microphone_captions.restore()
    interactive.checkpoint_enabled=True
    for rule in interactive.rules:rule['enabled']=False
    saved_production = archive.settings().get('production_config', {})
    if isinstance(saved_production, dict):
        production.settings.update({k:v for k,v in saved_production.items() if k in production.settings})
    production.settings['emergency']=False

    print("=" * 60)
    print("  TikReader – Lector de Comentarios TikTok Live")
    version_text = f"v{TIKTOKLIVE_VERSION}" if TIKTOKLIVE_AVAILABLE else "❌ NO INSTALADA"
    print(f"  TikTokLive: {version_text}")
    if not TIKTOKLIVE_AVAILABLE:
        print("  ⚠️  Ejecuta: pip install TikTokLive --upgrade")
    print(f"  Modo de red: {'LAN explícita' if runtime_config_value.lan_enabled else 'solo este equipo'}")
    print(f"  Servicio local para la ventana y OBS: {runtime_config_value.local_url}")
    print("=" * 60)

    logger.info('server_start host=%s port=%s lan=%s', runtime_config_value.host,
                runtime_config_value.port, runtime_config_value.lan_enabled)
    try:
        socketio.run(app, host=runtime_config_value.host, port=runtime_config_value.port,
                     debug=False, allow_unsafe_werkzeug=True, log_output=False)
    finally:
        platform_manager.stop_all()
        local_tts.close()
        voice_models.unload()
        _instance_guard.close()
