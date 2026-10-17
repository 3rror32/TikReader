import hashlib
import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

from tools import validate_release

from tools.build_release import _speech_model_sha256

ROOT = Path(__file__).resolve().parents[1]
LINE_ENDING_PATHS = (
    'README',
    'conf/mfcc.conf',
    'conf/model.conf',
    'graph/disambig_tid.int',
    'graph/phones/word_boundary.int',
    'ivector/global_cmvn.stats',
    'ivector/online_cmvn.conf',
    'ivector/splice.conf',
)


class SpeechModelIntegrityTests(unittest.TestCase):
    def test_packaged_version_comes_from_valid_distribution_metadata(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            manifest = Path(folder) / 'distribution.json'
            with patch.object(validate_release, 'PAYLOAD', Path(folder)):
                manifest.write_text(json.dumps({'version': '1.0.0.9'}), encoding='utf-8')
                self.assertEqual(validate_release.packaged_version(), '1.0.0.9')
                for value in (None, 9, '1.0.0', '1.0.0.9-extra'):
                    manifest.write_text(json.dumps({'version': value}), encoding='utf-8')
                    with self.subTest(version=value), self.assertRaises(ValueError):
                        validate_release.packaged_version()

    def test_allowlisted_model_hashes_are_canonical_across_line_endings(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            for relative in LINE_ENDING_PATHS:
                with self.subTest(relative=relative):
                    path = Path(folder) / relative
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(b'first line\nsecond line\n')
                    lf_hash = _speech_model_sha256(path, relative)

                    path.write_bytes(b'first line\r\nsecond line\r\n')
                    crlf_hash = _speech_model_sha256(path, relative)

                    self.assertEqual(lf_hash, crlf_hash)
                    self.assertEqual(lf_hash, hashlib.sha256(b'first line\nsecond line\n').hexdigest())

    def test_binary_model_hash_remains_byte_sensitive(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            for relative, contents in (
                ('am/final.mdl', b'\x00\r\n\xff'),
                ('graph/HCLG.fst', b'\x00\r\n\x01'),
                ('conf/unlisted.conf', b'first line\r\nsecond line\r\n'),
            ):
                with self.subTest(relative=relative):
                    path = Path(folder) / relative
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(contents)
                    crlf_hash = _speech_model_sha256(path, relative)

                    path.write_bytes(contents.replace(b'\r\n', b'\n'))
                    lf_hash = _speech_model_sha256(path, relative)

                    self.assertNotEqual(crlf_hash, lf_hash)
                    self.assertEqual(crlf_hash, hashlib.sha256(contents).hexdigest())


if __name__ == '__main__':
    unittest.main()
