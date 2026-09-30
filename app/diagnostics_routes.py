"""Acceso local y acotado a los registros de diagnóstico."""
from __future__ import annotations

import os
from datetime import datetime

from flask import jsonify, request, send_file

from app_paths import data_dir


def register_diagnostics_routes(app, runtime):
    @app.get("/diagnostics/logs/today")
    def download_daily_log():
        if not runtime.production.local():
            return jsonify(error="Solo disponible desde este equipo"), 403
        name = "tikreader-" + datetime.now().astimezone().strftime("%Y-%m-%d") + ".log"
        path = data_dir() / "logs" / name
        if not path.is_file():
            return jsonify(error="Aún no hay un registro diario. Reinicia el servidor para activar los logs."), 404
        return send_file(path, as_attachment=True, download_name=name, mimetype="text/plain")

    @app.post("/diagnostics/logs/open-folder")
    def open_daily_log_folder():
        if not runtime.production.local():
            return jsonify(error="Solo disponible desde este equipo"), 403
        origin = request.headers.get("Origin")
        if not request.is_json or (origin and origin.rstrip("/") != request.host_url.rstrip("/")):
            return jsonify(error="Solicitud no autorizada"), 403
        directory = data_dir() / "logs"
        try:
            directory.mkdir(parents=True, exist_ok=True)
            if os.name != "nt":
                return jsonify(error="Abre manualmente la carpeta data/logs"), 400
            os.startfile(str(directory.resolve()))
        except OSError:
            return jsonify(error="No se pudo abrir la carpeta de registros"), 500
        return jsonify(ok=True)
