"""Safe local storage for custom piggy-bank raster images."""
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
import sys
from unittest.mock import patch

from flask import Flask
from PySide6.QtCore import QBuffer, QByteArray, QIODevice
from PySide6.QtGui import QImage, QImageWriter

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
import bank_assets


class BankAssetTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.data_path = Path(self.temp.name)
        with patch('bank_assets.data_dir', return_value=self.data_path):
            self.app = Flask(__name__)
            bank_assets.register_routes(self.app)
        self.client = self.app.test_client()

    @staticmethod
    def image_bytes(image_format='PNG', size=(4, 4)):
        image = QImage(*size, QImage.Format.Format_RGBA8888)
        image.fill(0xFF3366CC)
        data = QByteArray()
        buffer = QBuffer(data)
        if not buffer.open(QIODevice.OpenModeFlag.WriteOnly):
            raise AssertionError('Could not open image buffer')
        writer = QImageWriter(buffer, image_format.encode('ascii'))
        if not writer.write(image):
            raise unittest.SkipTest(f'{image_format} writer is unavailable')
        return bytes(data)

    def upload(self, data, filename='bank.png', content_type='image/png'):
        return self.client.post(
            '/interactivity/bank-assets',
            data={'file': (BytesIO(data), filename, content_type)},
            content_type='multipart/form-data',
        )

    def test_decoded_raster_formats_are_saved_with_opaque_ids_and_safe_headers(self):
        formats = (('PNG', 'png', 'image/png'), ('JPEG', 'jpg', 'image/jpeg'),
                   ('WEBP', 'webp', 'image/webp'))
        for index, (image_format, extension, mime) in enumerate(formats, start=1):
            with self.subTest(image_format=image_format):
                response = self.upload(self.image_bytes(image_format), f'custom.{extension}', mime)
                self.assertEqual(response.status_code, 201, response.get_json())
                asset_id = response.get_json()['asset_id']
                self.assertRegex(asset_id, r'^[a-f0-9]{32}\.(png|jpg|webp)$')
                self.assertNotIn('custom', asset_id)
                served = self.client.get(f'/broadcast/bank-assets/{asset_id}')
                self.assertEqual(served.status_code, 200)
                self.assertEqual(served.mimetype, mime)
                self.assertEqual(served.headers['X-Content-Type-Options'], 'nosniff')
                self.assertEqual(len(list((self.data_path / 'custom_banks').iterdir())), index)

    def test_valid_png_is_decoded_through_the_upload_storage_path(self):
        payload = self.image_bytes('PNG')
        response = self.upload(payload)
        self.assertEqual(response.status_code, 201, response.get_json())
        asset_id = response.get_json()['asset_id']
        stored = (self.data_path / 'custom_banks' / asset_id).read_bytes()
        self.assertTrue(stored.startswith(b'\x89PNG\r\n\x1a\n'))

    def test_spoofed_types_svg_and_html_are_rejected(self):
        valid_png = self.image_bytes('PNG')
        self.assertEqual(self.upload(valid_png, 'bank.jpg', 'image/jpeg').status_code, 400)
        self.assertEqual(self.upload(valid_png, 'bank.png', 'image/jpeg').status_code, 400)
        self.assertEqual(self.upload(b'<svg></svg>', 'bank.svg', 'image/svg+xml').status_code, 400)
        self.assertEqual(self.upload(b'<html>no</html>', 'bank.png', 'image/png').status_code, 400)

    def test_size_and_decoded_dimensions_are_bounded(self):
        oversized = b'\x89PNG\r\n\x1a\n' + b'x' * (bank_assets.MAX_UPLOAD_BYTES + 1)
        self.assertEqual(self.upload(oversized).status_code, 413)
        too_wide = self.image_bytes('PNG', (4097, 1))
        self.assertEqual(self.upload(too_wide).status_code, 400)

    def test_asset_route_rejects_paths_and_unknown_ids(self):
        self.assertEqual(self.client.get('/broadcast/bank-assets/../secret').status_code, 404)
        self.assertEqual(self.client.get('/broadcast/bank-assets/' + '0' * 32 + '.png').status_code, 404)


if __name__ == '__main__':
    unittest.main()
