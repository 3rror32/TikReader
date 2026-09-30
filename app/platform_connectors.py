"""Live chat connectors for platforms other than TikTok.

Credentials are read from the protected platform store when a connection starts.
They are never written to history, logs, status payloads, or browser storage.
"""
from __future__ import annotations

import json
import re
import base64
import secrets
import threading
from dataclasses import dataclass
from time import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen
from uuid import uuid4

from platform_credentials import CredentialStoreError


class ConnectorError(RuntimeError):
    """An actionable error safe to show in the local UI."""

    def __init__(self, code: str, title: str, detail: str):
        super().__init__(detail)
        self.code = code
        self.title = title
        self.detail = detail

    def payload(self) -> dict:
        return {"code": self.code, "title": self.title, "detail": self.detail}


def _text(value: object, maximum: int) -> str:
    return str(value or "").strip()[:maximum]


def youtube_video_id(value: object) -> str:
    """Accept a YouTube video ID or the common watch/share/live URL forms."""
    raw = _text(value, 500)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", raw):
        return raw
    try:
        parsed = urlparse(raw if "://" in raw else "https://" + raw)
    except ValueError:
        return ""
    host = (parsed.hostname or "").casefold()
    candidate = ""
    if host in {"youtu.be", "www.youtu.be"}:
        candidate = parsed.path.strip("/").split("/")[0]
    elif host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        if parsed.path == "/watch":
            candidate = (parse_qs(parsed.query).get("v") or [""])[0]
        elif parsed.path.startswith(("/live/", "/shorts/", "/embed/")):
            parts = parsed.path.strip("/").split("/")
            candidate = parts[1] if len(parts) > 1 else ""
    return candidate if re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate) else ""


def parse_irc_tags(value: str) -> dict[str, str]:
    escapes = {"s": " ", ":": ";", "r": "\r", "n": "\n", "\\": "\\"}

    def decode(raw: str) -> str:
        return re.sub(r"\\(.)", lambda match: escapes.get(match.group(1), match.group(1)), raw)

    result = {}
    for part in value.split(";"):
        key, separator, raw = part.partition("=")
        if key:
            result[key] = decode(raw) if separator else ""
    return result


def parse_twitch_line(line: str) -> dict | None:
    """Parse the IRC records used by this read-only connector."""
    tags = {}
    rest = line.rstrip("\r\n")
    if rest.startswith("@"):
        raw_tags, separator, rest = rest[1:].partition(" ")
        if not separator:
            return None
        tags = parse_irc_tags(raw_tags)
    match = re.match(r":([^ ]+) PRIVMSG #([^ ]+) :(.*)$", rest)
    if match:
        login = match.group(1).split("!", 1)[0]
        return {
            "kind": "comment",
            "id": tags.get("id") or uuid4().hex,
            "user_id": tags.get("user-id") or login,
            "user": tags.get("display-name") or login,
            "comment": match.group(3),
            "badges": [part.split("/", 1)[0] for part in tags.get("badges", "").split(",") if part],
            "occurred_at": int(tags.get("tmi-sent-ts", "0") or 0) / 1000 or time(),
        }
    notice = re.match(r":([^ ]+) USERNOTICE #([^ ]+)(?: :(.*))?$", rest)
    if notice and tags.get("msg-id") in {"sub", "resub", "subgift", "anonsubgift"}:
        login = tags.get("login") or tags.get("display-name") or "Espectador"
        return {
            "kind": "subscribe",
            "id": tags.get("id") or uuid4().hex,
            "user_id": tags.get("user-id") or login,
            "user": tags.get("display-name") or login,
            "comment": tags.get("system-msg") or notice.group(3) or "Nueva suscripción",
            "badges": ["subscriber"],
            "occurred_at": time(),
        }
    return None


@dataclass
class ConnectorCallbacks:
    connected: object
    comment: object
    support: object


class YouTubeConnector:
    platform = "youtube"

    def __init__(self, config: dict, callbacks: ConnectorCallbacks, stop: threading.Event):
        self.api_key = _text(config.get("api_key"), 300)
        self.video_id = youtube_video_id(config.get("video"))
        self.callbacks = callbacks
        self.stop = stop
        if len(self.api_key) < 20:
            raise ConnectorError("YOUTUBE_KEY", "Falta la clave de YouTube", "Ingresa una clave de YouTube Data API v3.")
        if not self.video_id:
            raise ConnectorError("YOUTUBE_VIDEO", "Video de YouTube inválido", "Pega la URL o el identificador de 11 caracteres del LIVE.")

    def _get(self, path: str, params: dict) -> dict:
        query = urlencode({**params, "key": self.api_key})
        request = Request(f"https://www.googleapis.com/youtube/v3/{path}?{query}", headers={"Accept": "application/json"})
        try:
            with urlopen(request, timeout=15) as response:
                return json.load(response)
        except HTTPError as exc:
            detail = "La API de YouTube rechazó la solicitud. Revisa la clave, su cuota y que YouTube Data API v3 esté habilitada."
            try:
                body = json.loads(exc.read().decode("utf-8", "replace"))
                detail = _text(body.get("error", {}).get("message"), 300) or detail
            except (ValueError, AttributeError):
                pass
            raise ConnectorError("YOUTUBE_API", "No se pudo consultar YouTube", detail) from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise ConnectorError("YOUTUBE_NETWORK", "YouTube no responde", "Comprueba internet e inténtalo nuevamente.") from exc

    def run(self):
        video = self._get("videos", {"part": "snippet,liveStreamingDetails", "id": self.video_id})
        items = video.get("items") or []
        details = items[0].get("liveStreamingDetails", {}) if items else {}
        chat_id = details.get("activeLiveChatId")
        if not chat_id:
            raise ConnectorError("YOUTUBE_NOT_LIVE", "Chat de YouTube no disponible", "El video no está en vivo o su chat está desactivado.")
        title = _text(items[0].get("snippet", {}).get("title"), 120) or self.video_id
        self.callbacks.connected({"platform": self.platform, "channel": title})
        page_token = None
        first_page = True
        while not self.stop.is_set():
            params = {"part": "id,snippet,authorDetails", "liveChatId": chat_id, "maxResults": 200, "hl": "es-419"}
            if page_token:
                params["pageToken"] = page_token
            response = self._get("liveChat/messages", params)
            if not first_page:
                for item in response.get("items") or []:
                    self._dispatch(item)
            first_page = False
            page_token = response.get("nextPageToken") or page_token
            if response.get("offlineAt"):
                return
            wait_seconds = max(1.0, min(10.0, float(response.get("pollingIntervalMillis", 3000)) / 1000))
            self.stop.wait(wait_seconds)

    def _dispatch(self, item: dict):
        snippet = item.get("snippet") or {}
        author = item.get("authorDetails") or {}
        event_type = snippet.get("type")
        record = {
            "id": item.get("id") or uuid4().hex,
            "user_id": author.get("channelId") or author.get("displayName"),
            "user": author.get("displayName") or "Espectador",
            "avatar_url": author.get("profileImageUrl"),
            "comment": snippet.get("displayMessage") or "",
            "badges": [name for name, active in (("owner", author.get("isChatOwner")), ("moderator", author.get("isChatModerator")), ("member", author.get("isChatSponsor"))) if active],
            "occurred_at": snippet.get("publishedAt") or time(),
        }
        if event_type == "textMessageEvent":
            self.callbacks.comment(record)
        elif event_type == "superChatEvent":
            extra = snippet.get("superChatDetails") or {}
            record.update(amount_micros=extra.get("amountMicros"), currency=extra.get("currency"),
                          display_amount=extra.get("amountDisplayString"), comment=extra.get("userComment") or record["comment"])
            self.callbacks.support(record)
        elif event_type in {"newSponsorEvent", "memberMilestoneChatEvent"}:
            record["comment"] = record["comment"] or "Nueva membresía en YouTube"
            record["event"] = "subscribe"
            self.callbacks.comment(record)


class TwitchConnector:
    platform = "twitch"

    def __init__(self, config: dict, callbacks: ConnectorCallbacks, stop: threading.Event):
        self.channel = _text(config.get("channel"), 80).lstrip("#@").casefold()
        self.nickname = _text(config.get("nickname"), 80).lstrip("@").casefold()
        token = _text(config.get("token"), 500)
        self.token = token if token.startswith("oauth:") else "oauth:" + token
        self.callbacks = callbacks
        self.stop = stop
        self.socket = None
        if not re.fullmatch(r"[a-z0-9_]{2,80}", self.channel):
            raise ConnectorError("TWITCH_CHANNEL", "Canal de Twitch inválido", "Ingresa el nombre del canal, sin URL.")
        if not re.fullmatch(r"[a-z0-9_]{2,80}", self.nickname):
            raise ConnectorError("TWITCH_USER", "Usuario de Twitch inválido", "Ingresa el usuario al que pertenece el token OAuth.")
        if len(self.token) < 12:
            raise ConnectorError("TWITCH_TOKEN", "Falta el token de Twitch", "Se necesita un token OAuth con permiso chat:read.")

    def close(self):
        if self.socket is not None:
            try:
                self.socket.close()
            except OSError:
                pass

    def run(self):
        try:
            from websockets.sync.client import connect
        except ImportError as exc:
            raise ConnectorError("TWITCH_LIBRARY", "Conector de Twitch no disponible", "Reinstala las dependencias de TikReader.") from exc
        try:
            with connect("wss://irc-ws.chat.twitch.tv:443", open_timeout=15, close_timeout=3) as websocket:
                self.socket = websocket
                websocket.send(f"PASS {self.token}\r\nNICK {self.nickname}\r\nCAP REQ :twitch.tv/tags twitch.tv/commands\r\nJOIN #{self.channel}\r\n")
                announced = False
                while not self.stop.is_set():
                    try:
                        packet = websocket.recv(timeout=1)
                    except TimeoutError:
                        continue
                    if packet is None:
                        return
                    for line in str(packet).splitlines():
                        if line.startswith("PING"):
                            websocket.send("PONG" + line[4:] + "\r\n")
                            continue
                        if "Login authentication failed" in line or "Improperly formatted auth" in line:
                            raise ConnectorError("TWITCH_AUTH", "Twitch rechazó el acceso", "Revisa el usuario y genera un token con permiso chat:read.")
                        if not announced and (" 366 " in line or f"JOIN #{self.channel}" in line):
                            announced = True
                            self.callbacks.connected({"platform": self.platform, "channel": self.channel})
                        record = parse_twitch_line(line)
                        if not record:
                            continue
                        kind = record.pop("kind")
                        if kind == "comment":
                            self.callbacks.comment(record)
                        else:
                            record["event"] = kind
                            self.callbacks.comment(record)
        except ConnectorError:
            raise
        except (OSError, TimeoutError) as exc:
            raise ConnectorError("TWITCH_NETWORK", "No se pudo conectar a Twitch", "Comprueba internet, el canal y el token OAuth.") from exc
        finally:
            self.socket = None


class KickConnector:
    """Official Kick API connector. Chat arrives through Kick-signed webhooks."""

    platform = "kick"
    API = "https://api.kick.com/public/v1"
    OAUTH = "https://id.kick.com/oauth/token"

    def __init__(self, config: dict, callbacks: ConnectorCallbacks, stop: threading.Event):
        self.channel = _text(config.get("channel"), 80).lstrip("@/").casefold()
        self.client_id = _text(config.get("client_id"), 300)
        self.client_secret = _text(config.get("client_secret"), 500)
        self.webhook_secret = _text(config.get("webhook_secret"), 200)
        self.callbacks = callbacks
        self.stop = stop
        self.token = ""
        self.public_key = None
        self.seen = set()
        if not re.fullmatch(r"[a-z0-9_-]{2,80}", self.channel):
            raise ConnectorError("KICK_CHANNEL", "Canal de Kick inválido", "Ingresa el slug del canal, sin URL.")
        if len(self.client_id) < 8 or len(self.client_secret) < 16 or len(self.webhook_secret) < 20:
            raise ConnectorError("KICK_AUTH", "Falta configurar Kick", "Guarda el Client ID y Client Secret de tu aplicación de Kick.")

    def _json(self, url, method="GET", payload=None, bearer=None):
        headers = {"Accept": "application/json"}
        data = None
        if payload is not None:
            data = urlencode(payload).encode() if url == self.OAUTH else json.dumps(payload).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded" if url == self.OAUTH else "application/json"
        if bearer:
            headers["Authorization"] = "Bearer " + bearer
        try:
            with urlopen(Request(url, data=data, method=method, headers=headers), timeout=15) as response:
                return json.load(response)
        except HTTPError as exc:
            detail = "Kick rechazó la solicitud. Revisa la aplicación, sus permisos y la URL pública del webhook."
            try:
                body = json.loads(exc.read().decode("utf-8", "replace"))
                detail = _text(body.get("message") or body.get("error"), 300) or detail
            except (ValueError, AttributeError):
                pass
            raise ConnectorError("KICK_API", "No se pudo conectar Kick", detail) from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise ConnectorError("KICK_NETWORK", "Kick no responde", "Comprueba Internet e inténtalo nuevamente.") from exc

    def run(self):
        auth = self._json(self.OAUTH, "POST", {"grant_type": "client_credentials",
                          "client_id": self.client_id, "client_secret": self.client_secret})
        self.token = _text(auth.get("access_token"), 2000)
        if not self.token:
            raise ConnectorError("KICK_AUTH", "Kick no entregó acceso", "Revisa el Client ID y Client Secret.")
        channel_data = self._json(self.API + "/channels?" + urlencode({"slug": self.channel}), bearer=self.token)
        channels = channel_data.get("data") or []
        channel = channels[0] if channels else {}
        broadcaster_id = channel.get("broadcaster_user_id") or channel.get("user_id")
        if not broadcaster_id:
            raise ConnectorError("KICK_CHANNEL", "Canal de Kick no encontrado", "Revisa el slug del canal.")
        events = [{"name": name, "version": 1} for name in
                  ("chat.message.sent", "channel.subscription.new", "channel.subscription.gifts", "kicks.gifted")]
        self._json(self.API + "/events/subscriptions", "POST",
                   {"broadcaster_user_id": int(broadcaster_id), "events": events}, self.token)
        self.callbacks.connected({"platform": self.platform, "channel": self.channel})
        while not self.stop.wait(1):
            pass

    def _key(self):
        if self.public_key is not None:
            return self.public_key
        try:
            from cryptography.hazmat.primitives.serialization import load_pem_public_key
        except ImportError as exc:
            raise ConnectorError("KICK_LIBRARY", "Falta el verificador de Kick", "Reinstala las dependencias de TikReader.") from exc
        response = self._json(self.API + "/public-key", bearer=self.token)
        value = response.get("data")
        if isinstance(value, dict):
            value = value.get("public_key") or value.get("key")
        self.public_key = load_pem_public_key(str(value or "").encode())
        return self.public_key

    def receive(self, headers, body: bytes):
        message_id = _text(headers.get("Kick-Event-Message-Id"), 200)
        timestamp = _text(headers.get("Kick-Event-Message-Timestamp"), 100)
        signature = _text(headers.get("Kick-Event-Signature"), 2000)
        event = _text(headers.get("Kick-Event-Type"), 100)
        if not message_id or not timestamp or not signature or not event:
            raise ValueError("Encabezados de Kick incompletos")
        try:
            from cryptography.exceptions import InvalidSignature
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.asymmetric import padding
        except ImportError as exc:
            raise ConnectorError("KICK_LIBRARY", "Falta el verificador de Kick", "Reinstala las dependencias de TikReader.") from exc
        try:
            self._key().verify(base64.b64decode(signature), message_id.encode() + b"." + timestamp.encode() + b"." + body,
                               padding.PKCS1v15(), hashes.SHA256())
        except (ValueError, InvalidSignature) as exc:
            raise ValueError("Firma de Kick inválida") from exc
        if message_id in self.seen:
            return
        self.seen.add(message_id)
        if len(self.seen) > 5000:
            self.seen = {message_id}
        payload = json.loads(body)
        sender = payload.get("sender") or payload.get("gifter") or {}
        record = {"id": payload.get("message_id") or message_id,
                  "user_id": sender.get("user_id") or sender.get("username"),
                  "user": sender.get("username") or "Espectador",
                  "avatar_url": sender.get("profile_picture"),
                  "comment": payload.get("content") or "", "occurred_at": payload.get("created_at") or time(),
                  "badges": [badge.get("type") for badge in (sender.get("identity") or {}).get("badges", []) if badge.get("type")]}
        if event == "chat.message.sent":
            self.callbacks.comment(record)
        elif event == "kicks.gifted":
            gift = payload.get("gift") or {}
            record.update(gift=gift.get("name") or "KICKs", count=1, diamonds=int(gift.get("amount") or 0),
                          comment=gift.get("message") or "")
            self.callbacks.support(record)
        elif event.startswith("channel.subscription"):
            record.update(event="subscribe", comment="Nueva suscripción en Kick")
            self.callbacks.comment(record)


class PlatformManager:
    """Own one background connector per external platform."""

    CONNECTORS = {"youtube": YouTubeConnector, "twitch": TwitchConnector, "kick": KickConnector}

    def __init__(self, runtime):
        self.runtime = runtime
        self.lock = threading.RLock()
        self.workers: dict[str, dict] = {}
        self.statuses = {name: {"platform": name, "state": "disconnected", "channel": "", "error": None}
                         for name in self.CONNECTORS}

    def snapshot(self) -> dict:
        with self.lock:
            return {"platforms": [dict(self.statuses[name]) for name in self.CONNECTORS]}

    def active(self) -> bool:
        with self.lock:
            return any(item["state"] in {"connecting", "connected"} for item in self.statuses.values())

    def _publish(self):
        self.runtime.socketio.emit("platform_status", self.snapshot())

    def start(self, platform: str, config: dict) -> dict | None:
        platform = str(platform or "").casefold()
        connector_type = self.CONNECTORS.get(platform)
        if connector_type is None:
            return {"code": "PLATFORM_UNKNOWN", "title": "Plataforma no compatible", "detail": "Elige YouTube, Twitch o Kick."}
        if not isinstance(config, dict):
            return {"code": "PLATFORM_CONFIG", "title": "Configuración inválida", "detail": "Completa los datos de conexión."}
        stored = getattr(self.runtime, "platform_credentials", None)
        try:
            protected = stored.get(platform) if stored else {}
        except CredentialStoreError:
            return {"code": "PLATFORM_CREDENTIALS", "title": "No se pudieron abrir las credenciales",
                    "detail": "Ve a Configuración › Canales externos, elimina la credencial y vuelve a guardarla."}
        config = {**protected, **{key: value for key, value in config.items() if value not in (None, "")}}
        self.stop(platform)
        stop = threading.Event()
        callbacks = ConnectorCallbacks(
            connected=lambda data: self._connected(platform, data),
            comment=lambda data: self.runtime.handle_external_comment(platform, data),
            support=lambda data: self.runtime.handle_external_support(platform, data),
        )
        try:
            connector = connector_type(config, callbacks, stop)
            preparation_error = self.runtime.prepare_external_session(
                platform, getattr(connector, "channel", getattr(connector, "video_id", "")))
            if preparation_error:
                return preparation_error
        except ConnectorError as exc:
            return exc.payload()
        with self.lock:
            self.statuses[platform] = {"platform": platform, "state": "connecting", "channel": "", "error": None}
            thread = threading.Thread(target=self._run, args=(platform, connector, stop), daemon=True,
                                      name=f"{platform}-live-chat")
            self.workers[platform] = {"thread": thread, "stop": stop, "connector": connector}
            thread.start()
        self._publish()
        return None

    def _connected(self, platform: str, data: dict):
        self.runtime.begin_session_metrics()
        with self.lock:
            self.statuses[platform] = {"platform": platform, "state": "connected",
                                       "channel": _text(data.get("channel"), 120), "error": None}
        self._publish()

    def _run(self, platform: str, connector, stop: threading.Event):
        error = None
        try:
            connector.run()
        except ConnectorError as exc:
            error = exc.payload()
        except Exception:
            error = {"code": "PLATFORM_ERROR", "title": f"Falló la conexión con {platform.title()}",
                     "detail": "El conector terminó inesperadamente. Intenta conectarlo de nuevo."}
        finally:
            with self.lock:
                current = self.workers.get(platform)
                if current and current.get("stop") is stop:
                    self.workers.pop(platform, None)
                    self.statuses[platform] = {"platform": platform, "state": "error" if error else "disconnected",
                                               "channel": "", "error": error}
            self._publish()
            self.runtime.external_platform_stopped()

    def stop(self, platform: str) -> bool:
        platform = str(platform or "").casefold()
        with self.lock:
            worker = self.workers.pop(platform, None)
        if not worker:
            return False
        worker["stop"].set()
        close = getattr(worker["connector"], "close", None)
        if close:
            close()
        if worker["thread"] is not threading.current_thread():
            worker["thread"].join(timeout=4)
        with self.lock:
            self.statuses[platform] = {"platform": platform, "state": "disconnected", "channel": "", "error": None}
        self._publish()
        self.runtime.external_platform_stopped()
        return True

    def stop_all(self):
        for platform in tuple(self.CONNECTORS):
            self.stop(platform)

    def receive_kick(self, secret, headers, body):
        with self.lock:
            worker = self.workers.get("kick")
            connector = worker.get("connector") if worker else None
        if not connector or not secrets.compare_digest(str(secret), connector.webhook_secret):
            return {"error": "Webhook de Kick no disponible"}, 404
        try:
            connector.receive(headers, body)
        except (ConnectorError, ValueError, json.JSONDecodeError) as exc:
            return {"error": str(exc)}, 401
        return {"ok": True}, 202
