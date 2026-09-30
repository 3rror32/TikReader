"""Compatibility for TikTokLive URLs containing unescaped spaces."""
from urllib.parse import quote


def encode_webcast_uri(uri):
    # Preserve existing escapes, signed parameters, separators and duplicate keys.
    return quote(uri, safe=":/?#[]@!$&'()*+,;=%")


def install_url_encoding_fix():
    from TikTokLive.client.ws import ws_connect

    original = ws_connect.build_webcast_uri
    if getattr(original, "_tikreader_encoded", False):
        return

    def build_encoded_uri(*args, **kwargs):
        return encode_webcast_uri(original(*args, **kwargs))

    build_encoded_uri._tikreader_encoded = True
    ws_connect.build_webcast_uri = build_encoded_uri
