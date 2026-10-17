"""Portable, sandboxed overlay packages managed by the operator."""
from __future__ import annotations

import io
import json
import re
import shutil
import threading
import time
import zipfile
from pathlib import Path, PurePosixPath
from uuid import uuid4

from flask import Response, jsonify, render_template, request, send_file, send_from_directory

from app_paths import data_dir


MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
MAX_EXPANDED_BYTES = 100 * 1024 * 1024
MAX_FILES = 500
MAX_PACKAGES = 100
ALLOWED_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".json", ".txt", ".map",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
    ".mp4", ".webm", ".mp3", ".wav", ".ogg",
    ".woff", ".woff2", ".ttf", ".otf",
}
FIELD_TYPES = {"text", "textarea", "number", "range", "color", "checkbox", "select"}
KEY_RE = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,39}\Z")
PACKAGE_RE = re.compile(r"[a-f0-9]{32}\Z")
COLOR_RE = re.compile(r"#[0-9a-fA-F]{6}\Z")


def _text(value, limit, fallback=""):
    value = str(value or fallback).strip()
    return value[:limit]


class CustomOverlays:
    def __init__(self, app, runtime):
        self.r = runtime
        self.lock = threading.RLock()
        self.root = data_dir() / "custom_overlays"
        self.packages = self.root / "packages"
        self.trash = self.root / "trash"
        self.registry_path = self.root / "registry.json"
        self.register(app)

    def _read_registry(self):
        try:
            value = json.loads(self.registry_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError):
            value = {}
        return value if isinstance(value, dict) else {}

    def _write_registry(self, value):
        self.root.mkdir(parents=True, exist_ok=True)
        temporary = self.registry_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.registry_path)

    def _folder(self, overlay_id):
        if not PACKAGE_RE.fullmatch(str(overlay_id)):
            raise ValueError("Overlay inválido")
        return self.packages / overlay_id

    def _normalize_field(self, raw, seen):
        if not isinstance(raw, dict):
            raise ValueError("Cada control de overlay debe ser un objeto")
        key = str(raw.get("key", ""))
        if not KEY_RE.fullmatch(key) or key in seen:
            raise ValueError("Cada control necesita una clave única, por ejemplo: colorPrincipal")
        seen.add(key)
        kind = str(raw.get("type", "text"))
        if kind not in FIELD_TYPES:
            raise ValueError(f"Tipo de control no admitido: {kind}")
        field = {"key": key, "label": _text(raw.get("label"), 80, key), "type": kind}
        if raw.get("help"):
            field["help"] = _text(raw["help"], 240)
        if kind in ("number", "range"):
            try:
                low = float(raw.get("min", 0)); high = float(raw.get("max", 100))
                if low > high:
                    low, high = high, low
                step = max(0.000001, float(raw.get("step", 1)))
                default = min(high, max(low, float(raw.get("default", low))))
            except (TypeError, ValueError, OverflowError):
                raise ValueError(f"Los límites de {key} no son válidos") from None
            field.update(min=low, max=high, step=step, default=default)
        elif kind == "checkbox":
            field["default"] = raw.get("default") is True
        elif kind == "color":
            default = str(raw.get("default", "#ffffff"))
            if not COLOR_RE.fullmatch(default):
                raise ValueError(f"El color inicial de {key} no es válido")
            field["default"] = default.lower()
        elif kind == "select":
            options = []
            for option in raw.get("options", []):
                if isinstance(option, dict):
                    value, label = option.get("value"), option.get("label", option.get("value"))
                elif isinstance(option, (list, tuple)) and len(option) == 2:
                    value, label = option
                else:
                    value = label = option
                value = _text(value, 120)
                if value and value not in {item["value"] for item in options}:
                    options.append({"value": value, "label": _text(label, 80, value)})
            if not options or len(options) > 100:
                raise ValueError(f"El selector {key} necesita entre 1 y 100 opciones")
            allowed = {item["value"] for item in options}
            default = _text(raw.get("default"), 120)
            field.update(options=options, default=default if default in allowed else options[0]["value"])
        else:
            limit = 5000 if kind == "textarea" else 500
            field.update(default=_text(raw.get("default"), limit), max_length=limit)
            if raw.get("placeholder"):
                field["placeholder"] = _text(raw["placeholder"], 160)
        return field

    def _manifest(self, raw, fallback_name):
        if not isinstance(raw, dict):
            raise ValueError("overlay.json debe contener un objeto JSON")
        name = _text(raw.get("name"), 80, fallback_name)
        if not name:
            raise ValueError("Pon un nombre en overlay.json")
        entry = str(raw.get("entry", "index.html")).replace("\\", "/")
        entry_path = PurePosixPath(entry)
        if entry_path.is_absolute() or ".." in entry_path.parts or entry_path.suffix.lower() not in (".html", ".htm"):
            raise ValueError("La entrada del overlay debe ser un archivo HTML del paquete")
        canvas = str(raw.get("canvas", "responsive"))
        if canvas not in ("horizontal", "vertical", "responsive"):
            raise ValueError("canvas debe ser horizontal, vertical o responsive")
        settings = raw.get("settings", [])
        if not isinstance(settings, list) or len(settings) > 50:
            raise ValueError("Un overlay admite hasta 50 controles")
        seen = {"enabled", "canvas_format"}
        fields = [self._normalize_field(field, seen) for field in settings]
        events = raw.get("events", ["gift", "comment", "follow", "share", "subscribe", "stats"])
        if not isinstance(events, list):
            raise ValueError("events debe ser una lista")
        events = list(dict.fromkeys(_text(item, 40) for item in events if _text(item, 40)))[:30]
        return {
            "name": name,
            "description": _text(raw.get("description"), 300, "Overlay personalizado"),
            "version": _text(raw.get("version"), 30, "1.0.0"),
            "author": _text(raw.get("author"), 80),
            "entry": str(entry_path),
            "canvas": canvas,
            "events": events,
            "settings": fields,
        }

    def _settings(self, manifest, raw):
        if not isinstance(raw, dict):
            raise ValueError("Configuración inválida")
        enabled = raw.get("enabled", True)
        if type(enabled) is not bool:
            raise ValueError("El estado del overlay debe estar activado o desactivado")
        result = {"enabled": enabled}
        for field in manifest["settings"]:
            key, kind = field["key"], field["type"]
            value = raw.get(key, field["default"])
            if kind == "checkbox":
                if type(value) is not bool:
                    raise ValueError(f"{field['label']} debe estar activado o desactivado")
            elif kind in ("number", "range"):
                try:
                    value = min(field["max"], max(field["min"], float(value)))
                except (TypeError, ValueError, OverflowError):
                    raise ValueError(f"{field['label']} debe ser un número") from None
            elif kind == "color":
                value = str(value)
                if not COLOR_RE.fullmatch(value):
                    raise ValueError(f"{field['label']} debe ser un color hexadecimal")
                value = value.lower()
            elif kind == "select":
                value = str(value)
                if value not in {item["value"] for item in field["options"]}:
                    raise ValueError(f"Selecciona una opción válida para {field['label']}")
            else:
                value = _text(value, field["max_length"])
            result[key] = value
        canvas = str(raw.get("canvas_format", manifest["canvas"]))
        if canvas == "responsive":
            canvas = "horizontal"
        if canvas not in ("horizontal", "vertical"):
            raise ValueError("Formato de lienzo inválido")
        result["canvas_format"] = canvas
        return result

    def _public(self, overlay_id, item):
        folder = self._folder(overlay_id)
        size = sum(path.stat().st_size for path in folder.rglob("*") if path.is_file()) if folder.is_dir() else 0
        return {
            "id": overlay_id,
            "manifest": item["manifest"],
            "settings": item["settings"],
            "installed_at": item.get("installed_at", 0),
            "size": size,
            "url": f"/widget/custom/{overlay_id}",
        }

    def _zip_members(self, archive):
        files = []
        for info in archive.infolist():
            if info.is_dir():
                continue
            parts = PurePosixPath(info.filename.replace("\\", "/")).parts
            if "__MACOSX" in parts or (parts and parts[-1] == ".DS_Store"):
                continue
            files.append(info)
        if not files or len(files) > MAX_FILES:
            raise ValueError(f"El paquete debe contener entre 1 y {MAX_FILES} archivos")
        if sum(info.file_size for info in files) > MAX_EXPANDED_BYTES:
            raise ValueError("El paquete ocupa más de 100 MB al descomprimirse")
        clean = []
        for info in files:
            name = info.filename.replace("\\", "/")
            path = PurePosixPath(name)
            mode = info.external_attr >> 16
            if path.is_absolute() or not path.parts or any(part in ("", ".", "..") for part in path.parts):
                raise ValueError("El ZIP contiene una ruta no permitida")
            if mode & 0o170000 == 0o120000:
                raise ValueError("No se admiten enlaces simbólicos")
            if Path(path.name).suffix.lower() not in ALLOWED_EXTENSIONS:
                raise ValueError(f"Tipo de archivo no admitido: {path.name}")
            if info.file_size > 30 * 1024 * 1024:
                raise ValueError(f"{path.name} supera 30 MB")
            clean.append((info, path))
        roots = {path.parts[0] for _, path in clean}
        prefix = next(iter(roots)) if len(roots) == 1 and all(len(path.parts) > 1 for _, path in clean) else None
        normalized = [(info, PurePosixPath(*path.parts[1:]) if prefix else path) for info, path in clean]
        if not any(str(path).casefold() == "overlay.json" for _, path in normalized):
            raise ValueError("Falta overlay.json en la raíz del paquete")
        return normalized

    def install(self, upload):
        if not upload or not str(upload.filename or "").lower().endswith(".zip"):
            raise ValueError("Selecciona un paquete ZIP")
        data = upload.read(MAX_ARCHIVE_BYTES + 1)
        if len(data) > MAX_ARCHIVE_BYTES:
            raise ValueError("El ZIP supera 50 MB")
        try:
            archive = zipfile.ZipFile(io.BytesIO(data))
            members = self._zip_members(archive)
            manifest_member = next(info for info, path in members if str(path).casefold() == "overlay.json")
            raw_manifest = json.loads(archive.read(manifest_member).decode("utf-8"))
        except (zipfile.BadZipFile, UnicodeError, json.JSONDecodeError, KeyError):
            raise ValueError("El ZIP o su overlay.json no es válido") from None
        manifest = self._manifest(raw_manifest, Path(upload.filename).stem)
        if not any(str(path) == manifest["entry"] for _, path in members):
            raise ValueError(f"No se encontró {manifest['entry']}")
        with self.lock:
            registry = self._read_registry()
            if len(registry) >= MAX_PACKAGES:
                raise ValueError("La biblioteca admite hasta 100 overlays")
            overlay_id = uuid4().hex
            temporary = self.root / (".import-" + overlay_id)
            temporary.mkdir(parents=True, exist_ok=False)
            try:
                for info, path in members:
                    target = temporary.joinpath(*path.parts)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(info) as source, target.open("wb") as destination:
                        shutil.copyfileobj(source, destination)
                self.packages.mkdir(parents=True, exist_ok=True)
                for attempt in range(3):
                    try:
                        temporary.replace(self._folder(overlay_id))
                        break
                    except PermissionError as error:
                        if getattr(error, 'winerror', None) not in (5, 32, 33) or attempt == 2:
                            raise
                        time.sleep(0.05 * (attempt + 1))
            except Exception:
                shutil.rmtree(temporary, ignore_errors=True)
                raise
            item = {"manifest": manifest, "settings": self._settings(manifest, {}), "installed_at": int(time.time())}
            registry[overlay_id] = item
            self._write_registry(registry)
            return self._public(overlay_id, item)

    def template_zip(self):
        manifest = {
            "name": "Saludo de ejemplo", "version": "1.0.0", "author": "Tu nombre",
            "description": "Una tarjeta animada que responde a eventos del LIVE.",
            "entry": "index.html", "canvas": "responsive", "events": ["gift", "follow", "comment"],
            "settings": [
                {"key": "accent", "label": "Color principal", "type": "color", "default": "#65dfc2"},
                {"key": "message", "label": "Mensaje", "type": "text", "default": "¡Gracias por participar!"},
                {"key": "duration", "label": "Duración", "type": "range", "min": 1, "max": 12, "step": 1, "default": 5},
                {"key": "showAvatar", "label": "Mostrar foto", "type": "checkbox", "default": True},
            ],
        }
        index = """<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"stylesheet\" href=\"style.css\"></head><body><main id=\"card\"><small>EVENTO DEL LIVE</small><strong id=\"user\">Tu comunidad</strong><p id=\"message\">¡Gracias por participar!</p></main><script src=\"script.js\"></script></body></html>"""
        style = """html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif}body{display:grid;place-items:center;color:#fff}#card{padding:28px 34px;border:2px solid var(--tikreader-accent,#65dfc2);background:#09151ddd;box-shadow:0 18px 60px #0008;transform:translateY(25px);opacity:0;transition:.45s ease}#card.show{transform:none;opacity:1}small{display:block;color:var(--tikreader-accent,#65dfc2);letter-spacing:.14em}strong{display:block;font-size:42px;margin-top:8px}p{margin:8px 0 0;font-size:22px}"""
        script = """const card=document.querySelector('#card'),user=document.querySelector('#user'),message=document.querySelector('#message');let timer;function show(data={}){user.textContent=data.user||'Tu comunidad';card.classList.remove('show');requestAnimationFrame(()=>card.classList.add('show'));clearTimeout(timer);timer=setTimeout(()=>card.classList.remove('show'),Number(TikReaderOverlay.settings.duration||5)*1000)}TikReaderOverlay.on('ready',event=>{message.textContent=event.detail.settings.message;show()});for(const type of ['gift','follow','comment','new_comment','gift_history'])TikReaderOverlay.on(type,event=>show(event.detail.data||{}));"""
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("overlay.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            archive.writestr("index.html", index)
            archive.writestr("style.css", style)
            archive.writestr("script.js", script)
        output.seek(0)
        return output

    def register(self, app):
        def fail(exc, status=400):
            return jsonify(error=str(exc)), status

        @app.route("/custom-overlays", methods=["GET", "POST"])
        def custom_overlay_collection():
            if request.method == "POST":
                if request.content_length and request.content_length > MAX_ARCHIVE_BYTES + 1024 * 1024:
                    return jsonify(error="El ZIP supera 50 MB"), 413
                try:
                    item = self.install(request.files.get("file"))
                except (ValueError, OSError) as exc:
                    return fail(exc)
                return jsonify(overlay=item), 201
            with self.lock:
                registry = self._read_registry()
                overlays = [self._public(key, value) for key, value in registry.items() if self._folder(key).is_dir()]
            overlays.sort(key=lambda item: (-item["installed_at"], item["manifest"]["name"].casefold()))
            return jsonify(overlays=overlays, maximum=MAX_PACKAGES)

        @app.get("/custom-overlays/template")
        def custom_overlay_template():
            return send_file(self.template_zip(), mimetype="application/zip", as_attachment=True,
                             download_name="plantilla-overlay-tikreader.zip")

        @app.route("/custom-overlays/<overlay_id>", methods=["GET", "PATCH", "DELETE"])
        def custom_overlay_item(overlay_id):
            try:
                folder = self._folder(overlay_id)
            except ValueError as exc:
                return fail(exc, 404)
            with self.lock:
                registry = self._read_registry(); item = registry.get(overlay_id)
                if not item or not folder.is_dir():
                    return jsonify(error="Overlay no encontrado"), 404
                if request.method == "PATCH":
                    try:
                        item["settings"] = self._settings(item["manifest"], request.get_json(silent=True))
                    except ValueError as exc:
                        return fail(exc)
                    registry[overlay_id] = item; self._write_registry(registry)
                elif request.method == "DELETE":
                    self.trash.mkdir(parents=True, exist_ok=True)
                    target = self.trash / f"{overlay_id}-{int(time.time())}"
                    folder.replace(target); registry.pop(overlay_id, None); self._write_registry(registry)
                    return jsonify(ok=True, recoverable=True)
                return jsonify(overlay=self._public(overlay_id, item))

        @app.post("/custom-overlays/<overlay_id>/duplicate")
        def duplicate_custom_overlay(overlay_id):
            try:
                folder = self._folder(overlay_id)
            except ValueError as exc:
                return fail(exc, 404)
            with self.lock:
                registry = self._read_registry(); item = registry.get(overlay_id)
                if not item or not folder.is_dir():
                    return jsonify(error="Overlay no encontrado"), 404
                if len(registry) >= MAX_PACKAGES:
                    return jsonify(error="La biblioteca admite hasta 100 overlays"), 409
                clone_id = uuid4().hex; clone = json.loads(json.dumps(item))
                clone["manifest"]["name"] = _text(clone["manifest"]["name"] + " · copia", 80)
                clone["installed_at"] = int(time.time())
                self.packages.mkdir(parents=True, exist_ok=True)
                shutil.copytree(folder, self._folder(clone_id)); registry[clone_id] = clone; self._write_registry(registry)
                return jsonify(overlay=self._public(clone_id, clone)), 201

        @app.get("/custom-overlays/<overlay_id>/export")
        def export_custom_overlay(overlay_id):
            try:
                folder = self._folder(overlay_id)
            except ValueError as exc:
                return fail(exc, 404)
            if not folder.is_dir():
                return jsonify(error="Overlay no encontrado"), 404
            output = io.BytesIO()
            with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
                for path in folder.rglob("*"):
                    if path.is_file():
                        archive.write(path, path.relative_to(folder).as_posix())
            output.seek(0)
            return send_file(output, mimetype="application/zip", as_attachment=True,
                             download_name=f"tikreader-overlay-{overlay_id[:8]}.zip")

        @app.get("/widget/custom/<overlay_id>")
        def custom_overlay_widget(overlay_id):
            try:
                folder = self._folder(overlay_id)
            except ValueError:
                return "Overlay no encontrado", 404
            with self.lock:
                item = self._read_registry().get(overlay_id)
            if not item or not folder.is_dir():
                return "Overlay no encontrado", 404
            return render_template("custom_overlay_widget.html", overlay_id=overlay_id,
                                   manifest=item["manifest"], settings=item["settings"])

        @app.get("/widget/custom/<overlay_id>/content/<path:filename>")
        def custom_overlay_content(overlay_id, filename):
            try:
                folder = self._folder(overlay_id)
            except ValueError:
                return "Archivo no encontrado", 404
            path = PurePosixPath(str(filename).replace("\\", "/"))
            if path.is_absolute() or ".." in path.parts or Path(path.name).suffix.lower() not in ALLOWED_EXTENSIONS:
                return "Archivo no encontrado", 404
            response = send_from_directory(folder, str(path), conditional=True)
            if path.suffix.lower() in (".html", ".htm"):
                response.direct_passthrough = False
                html = response.get_data(as_text=True)
                sdk = '<script src="/static/custom_overlay_sdk.js"></script>'
                html = re.sub(r"</head\s*>", sdk + "</head>", html, count=1, flags=re.I)
                if sdk not in html:
                    html = sdk + html
                response = Response(html, status=response.status_code, content_type="text/html; charset=utf-8")
            origin = request.host_url.rstrip("/")
            response.headers["Content-Security-Policy"] = (
                f"default-src {origin} data: blob:; script-src {origin} 'unsafe-inline' 'unsafe-eval'; "
                f"style-src {origin} 'unsafe-inline'; img-src {origin} data: blob:; media-src {origin} data: blob:; "
                f"font-src {origin} data:; connect-src 'none'; frame-src 'none'; object-src 'none'; "
                "base-uri 'none'; form-action 'none'"
            )
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["Cache-Control"] = "no-cache"
            return response
