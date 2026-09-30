import unittest
from tiktok_transport import encode_webcast_uri


class TransportTests(unittest.TestCase):
    def test_spaces_are_encoded_without_changing_signed_query(self):
        uri = "wss://example.com/?token=a%2Fb%3D&browser_version=Mozilla/5.0 (Windows NT)&version_code=1&version_code=2"
        self.assertEqual(encode_webcast_uri(uri),
                         uri.replace(" ", "%20"))

    def test_encoding_is_idempotent(self):
        uri = "wss://example.com/?token=a%2Bb&agent=Windows%20NT"
        self.assertEqual(encode_webcast_uri(uri), uri)
