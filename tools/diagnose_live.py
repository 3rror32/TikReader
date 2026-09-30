from pathlib import Path as _BootstrapPath
import sys as _bootstrap_sys
_bootstrap_sys.path.insert(0, str(_BootstrapPath(__file__).resolve().parent.parent / 'app'))
"""Bounded, metadata-only diagnostic of TikTok's incoming event stream."""
import asyncio
import logging
import sys
import traceback
from urllib.parse import urlsplit, parse_qsl
from collections import Counter

from TikTokLive import TikTokLiveClient
from TikTokLive.events import CommentEvent, ConnectEvent


async def main(username):
    if "--encode-uri" in sys.argv:
        from tiktok_transport import install_url_encoding_fix
        install_url_encoding_fix()
    client = TikTokLiveClient(unique_id=username)
    counts = Counter()

    class EventLog(logging.Handler):
        def emit(self, record):
            message = record.getMessage()
            if message.startswith("Built Webcast URI: "):
                uri = message.removeprefix("Built Webcast URI: ")
                parsed = urlsplit(uri)
                print("WS_ENDPOINT", parsed.hostname, parsed.path,
                      "spaces", " " in uri, "query_keys",
                      [key for key, _ in parse_qsl(parsed.query)], flush=True)
            if message.startswith(("Discarded non-msg", "Starting ping", "Received Event")):
                counts[message] += 1
                print(message, flush=True)

    client.logger.setLevel(logging.DEBUG)
    client.logger.handlers = [EventLog()]
    client.logger.propagate = False

    @client.on(ConnectEvent)
    async def connected(event):
        print("CONNECTED", flush=True)

    @client.on(CommentEvent)
    async def comment(event):
        common = event.common
        print("COMMENT", getattr(common, "msg_id", None), getattr(common, "create_time", None), flush=True)

    receiver = None
    try:
        receiver = await asyncio.wait_for(client.start(), timeout=20)
        await asyncio.wait_for(receiver, timeout=35)
    except Exception as exc:
        print(type(exc).__name__, repr(exc), flush=True)
        current = exc.__cause__ or exc.__context__
        while current is not None:
            print("CAUSED_BY", type(current).__name__, repr(current), flush=True)
            current = current.__cause__ or current.__context__
        traceback.print_exception(exc, file=sys.stdout)
    finally:
        if receiver:
            receiver.cancel()
            await asyncio.gather(receiver, return_exceptions=True)
        try:
            await asyncio.wait_for(client.disconnect(), timeout=3)
        except asyncio.CancelledError:
            pass
        finally:
            await client.web.close()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
