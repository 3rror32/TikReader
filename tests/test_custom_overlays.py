import io
import json
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from flask import Flask

import custom_overlays
from custom_overlays import CustomOverlays
from production import Production


class CustomOverlayTests(unittest.TestCase):
    def setUp(self):
        test_root = Path(__file__).resolve().parent.parent / "runtime" / "test-temp"
        test_root.mkdir(parents=True, exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=test_root)
        self.addCleanup(self.tmp.cleanup)
        templates = Path(__file__).resolve().parent.parent / "web" / "templates"
        self.app = Flask(__name__, template_folder=str(templates))
        self.runtime = SimpleNamespace()
        self.runtime.production = Production(self.app, self.runtime)
        self.data_patch = patch.object(custom_overlays, "data_dir", return_value=Path(self.tmp.name))
        self.data_patch.start(); self.addCleanup(self.data_patch.stop)
        self.service = CustomOverlays(self.app, self.runtime)
        self.client = self.app.test_client()

    def package(self, manifest=None, files=None, prefix=""):
        manifest = manifest or {
            "name": "Mi alerta",
            "version": "2.1",
            "entry": "index.html",
            "canvas": "responsive",
            "events": ["gift", "follow"],
            "settings": [
                {"key": "accent", "label": "Color", "type": "color", "default": "#65dfc2"},
                {"key": "duration", "label": "Duración", "type": "range", "min": 1, "max": 10, "default": 4},
                {"key": "visible", "label": "Visible", "type": "checkbox", "default": True},
                {"key": "style", "label": "Estilo", "type": "select", "options": ["neon", "clean"]},
            ],
        }
        files = files or {"index.html": "<!doctype html><html><head></head><body>Hola</body></html>", "style.css": "body{background:transparent}"}
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(prefix + "overlay.json", json.dumps(manifest))
            for name, content in files.items():
                archive.writestr(prefix + name, content)
        stream.seek(0)
        return stream

    def install(self, **kwargs):
        response = self.client.post("/custom-overlays", data={"file": (self.package(**kwargs), "overlay.zip")})
        self.assertEqual(response.status_code, 201, response.get_data(as_text=True))
        return response.get_json()["overlay"]

    def test_installs_lists_configures_and_serves_sandboxed_package(self):
        overlay = self.install(prefix="source/")
        overlay_id = overlay["id"]
        self.assertEqual(overlay["settings"]["duration"], 4)
        self.assertEqual(self.client.get("/custom-overlays").get_json()["overlays"][0]["id"], overlay_id)
        saved = self.client.patch(f"/custom-overlays/{overlay_id}", json={
            "enabled": False, "accent": "#ff0066", "duration": 99, "visible": False,
            "style": "clean", "canvas_format": "vertical",
        })
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.get_json()["overlay"]["settings"]["duration"], 10)
        self.assertEqual(saved.get_json()["overlay"]["settings"]["canvas_format"], "vertical")
        self.assertFalse(saved.get_json()["overlay"]["settings"]["enabled"])
        widget = self.client.get(f"/widget/custom/{overlay_id}?preview=1")
        self.assertEqual(widget.status_code, 200)
        self.assertIn(b'sandbox="allow-scripts"', widget.data)
        content = self.client.get(f"/widget/custom/{overlay_id}/content/index.html")
        self.assertEqual(content.status_code, 200)
        self.assertIn(b"custom_overlay_sdk.js", content.data)
        self.assertIn("connect-src 'none'", content.headers["Content-Security-Policy"])

    def test_duplicate_export_and_recoverable_delete(self):
        overlay = self.install()
        duplicated = self.client.post(f"/custom-overlays/{overlay['id']}/duplicate")
        self.assertEqual(duplicated.status_code, 201)
        clone = duplicated.get_json()["overlay"]
        self.assertNotEqual(clone["id"], overlay["id"])
        self.assertIn("copia", clone["manifest"]["name"])
        exported = self.client.get(f"/custom-overlays/{clone['id']}/export")
        self.assertEqual(exported.status_code, 200)
        self.assertTrue(exported.data.startswith(b"PK"))
        deleted = self.client.delete(f"/custom-overlays/{clone['id']}")
        self.assertTrue(deleted.get_json()["recoverable"])
        self.assertEqual(self.client.get(f"/widget/custom/{clone['id']}").status_code, 404)
        self.assertTrue(any((Path(self.tmp.name) / "custom_overlays" / "trash").iterdir()))

    def test_rejects_unsafe_or_invalid_packages_and_settings(self):
        missing = io.BytesIO()
        with zipfile.ZipFile(missing, "w") as archive:
            archive.writestr("index.html", "hello")
        missing.seek(0)
        self.assertEqual(self.client.post("/custom-overlays", data={"file": (missing, "bad.zip")}).status_code, 400)
        executable = self.package(files={"index.html": "ok", "run.exe": "bad"})
        self.assertEqual(self.client.post("/custom-overlays", data={"file": (executable, "bad.zip")}).status_code, 400)
        overlay = self.install()
        invalid = self.client.patch(f"/custom-overlays/{overlay['id']}", json={
            "accent": "red", "duration": 4, "visible": True, "style": "neon", "canvas_format": "horizontal",
        })
        self.assertEqual(invalid.status_code, 400)
        remote = {"REMOTE_ADDR": "192.0.2.5"}
        self.assertEqual(self.client.get("/custom-overlays", environ_overrides=remote).status_code, 403)

    def test_downloadable_template_is_itself_installable(self):
        template = self.client.get("/custom-overlays/template")
        self.assertEqual(template.status_code, 200)
        response = self.client.post("/custom-overlays", data={"file": (io.BytesIO(template.data), "template.zip")})
        self.assertEqual(response.status_code, 201, response.get_data(as_text=True))

    def test_retries_transient_windows_package_rename(self):
        replace = Path.replace
        for winerror in (5, 32, 33):
            with self.subTest(winerror=winerror):
                attempts = []
                error = PermissionError("Transient package rename failure")
                error.winerror = winerror

                def rename(source, destination):
                    if source.name.startswith('.import-'):
                        attempts.append((source, destination))
                        if len(attempts) == 1:
                            raise error
                        # Model completion independently of the transient Windows
                        # primitive; the existing install tests exercise real rename.
                        shutil.copytree(source, destination)
                        shutil.rmtree(source)
                        return destination
                    return replace(source, destination)

                with patch.object(Path, 'replace', autospec=True, side_effect=rename), \
                        patch.object(custom_overlays, 'time', SimpleNamespace(time=custom_overlays.time.time, sleep=Mock())) as clock:
                    overlay = self.install()
                self.assertTrue(self.service._folder(overlay['id']).is_dir())
                self.assertEqual(len(attempts), 2)
                self.assertEqual(attempts[0], attempts[1])
                clock.sleep.assert_called_once_with(0.05)

    def test_exhausted_windows_rename_cleans_unregistered_package(self):
        replace = Path.replace
        attempts = []
        error = PermissionError("Persistent package rename failure")
        error.winerror = 5

        def rename(source, destination):
            if source.name.startswith('.import-'):
                attempts.append((source, destination))
                raise error
            return replace(source, destination)

        with patch.object(Path, 'replace', autospec=True, side_effect=rename), \
                patch.object(custom_overlays, 'time', SimpleNamespace(time=custom_overlays.time.time, sleep=Mock())) as clock:
            response = self.client.post('/custom-overlays', data={'file': (self.package(), 'overlay.zip')})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(attempts), 3)
        self.assertEqual(clock.sleep.call_count, 2)
        self.assertEqual(self.service._read_registry(), {})
        self.assertEqual(list(self.service.packages.iterdir()), [])
        self.assertEqual(list(self.service.root.glob('.import-*')), [])

    def test_unrelated_rename_errors_are_not_retried(self):
        replace = Path.replace
        for error in (PermissionError('Non-Windows denial'), PermissionError('Other Windows denial'), OSError('Other failure')):
            if str(error) != 'Non-Windows denial':
                error.winerror = 87 if isinstance(error, PermissionError) else 5
            with self.subTest(error=str(error)):
                attempts = []

                def rename(source, destination):
                    if source.name.startswith('.import-'):
                        attempts.append((source, destination))
                        raise error
                    return replace(source, destination)

                with patch.object(Path, 'replace', autospec=True, side_effect=rename), \
                        patch.object(custom_overlays, 'time', SimpleNamespace(time=custom_overlays.time.time, sleep=Mock())) as clock:
                    response = self.client.post('/custom-overlays', data={'file': (self.package(), 'overlay.zip')})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(len(attempts), 1)
                clock.sleep.assert_not_called()
                self.assertEqual(self.service._read_registry(), {})
                self.assertEqual(list(self.service.packages.iterdir()), [])
                self.assertEqual(list(self.service.root.glob('.import-*')), [])


if __name__ == "__main__":
    unittest.main()
