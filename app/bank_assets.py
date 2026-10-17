"""Validated local storage for custom point-drop bank images."""
import re
from uuid import uuid4

from flask import jsonify, request, send_file
from PySide6.QtCore import QBuffer, QByteArray, QIODevice
from PySide6.QtGui import QImageReader, QImageWriter

from app_paths import data_dir

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_IMAGE_DIMENSION = 4096
MAX_IMAGE_PIXELS = MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION
ASSET_RE = re.compile(r"[a-f0-9]{32}\.(?:png|jpg|webp)\Z")
FORMATS = {
    "png": ("png", "png", "image/png"),
    "jpeg": ("jpg", "jpeg", "image/jpeg"),
    "jpg": ("jpg", "jpeg", "image/jpeg"),
    "webp": ("webp", "webp", "image/webp"),
}
SERVED_MIMES = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}


def valid_asset_id(value):
    return isinstance(value, str) and ASSET_RE.fullmatch(value) is not None


class BankAssetStore:
    def __init__(self, folder):
        self.folder = folder

    def save_upload(self, upload):
        filename = str(upload.filename or "")
        suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        requested = FORMATS.get(suffix)
        if requested is None:
            raise ValueError("Usa una imagen PNG, JPEG o WebP")
        data = upload.stream.read(MAX_UPLOAD_BYTES + 1)
        if not data or len(data) > MAX_UPLOAD_BYTES:
            raise ValueError("La imagen supera el límite de 5 MiB o está vacía")
        if upload.mimetype.lower() != requested[2]:
            raise ValueError("El tipo de archivo no coincide con su contenido")

        source = QByteArray(data)
        buffer = QBuffer(source)
        if not buffer.open(QIODevice.OpenModeFlag.ReadOnly):
            raise ValueError("Imagen inválida")
        reader = QImageReader(buffer)
        reader.setDecideFormatFromContent(True)
        detected = bytes(reader.format()).decode("ascii", errors="ignore").lower()
        actual = FORMATS.get(detected)
        dimensions = reader.size()
        if actual is None or actual[0] != requested[0] or not dimensions.isValid():
            raise ValueError("El contenido no coincide con una imagen PNG, JPEG o WebP")
        width, height = dimensions.width(), dimensions.height()
        if width < 1 or height < 1 or width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION or width * height > MAX_IMAGE_PIXELS:
            raise ValueError("La imagen no puede superar 4096 × 4096 píxeles")
        image = reader.read()
        if image.isNull():
            raise ValueError("No se pudo decodificar la imagen")

        clean = QByteArray()
        output = QBuffer(clean)
        if not output.open(QIODevice.OpenModeFlag.WriteOnly):
            raise ValueError("No se pudo procesar la imagen")
        writer = QImageWriter(output, requested[1].encode("ascii"))
        if requested[0] == "jpeg":
            writer.setQuality(90)
        if not writer.write(image) or clean.size() > MAX_UPLOAD_BYTES:
            raise ValueError("La imagen procesada supera el límite de 5 MiB")

        asset_id = f"{uuid4().hex}.{requested[0]}"
        self.folder.mkdir(parents=True, exist_ok=True)
        path = self.folder / asset_id
        with path.open("xb") as target:
            target.write(bytes(clean))
        return asset_id

    def path_for(self, asset_id):
        if not valid_asset_id(asset_id):
            return None
        return self.folder / asset_id


def register_routes(app):
    store = BankAssetStore(data_dir() / "custom_banks")

    @app.post("/interactivity/bank-assets")
    def upload_bank_asset():
        if request.content_length and request.content_length > MAX_UPLOAD_BYTES + 64 * 1024:
            return jsonify(error="La imagen supera el límite de 5 MiB"), 413
        upload = request.files.get("file")
        if upload is None:
            return jsonify(error="Selecciona una imagen"), 400
        try:
            return jsonify(asset_id=store.save_upload(upload)), 201
        except ValueError as error:
            code = 413 if "5 MiB" in str(error) else 400
            return jsonify(error=str(error)), code

    @app.get("/broadcast/bank-assets/<asset_id>")
    def serve_bank_asset(asset_id):
        path = store.path_for(asset_id)
        if path is None or not path.is_file():
            return jsonify(error="Imagen no encontrada"), 404
        mime = SERVED_MIMES[path.suffix[1:]]
        response = send_file(path, mimetype=mime, conditional=True)
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    app.extensions["point_drop_bank_assets"] = store
    return store
