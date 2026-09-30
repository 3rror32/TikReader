"""Rutas HTTP de lectura del núcleo, desacopladas del proceso TikTok."""
from pathlib import Path

from flask import jsonify, render_template, request

from app_config import APP_VERSION


def register_core_routes(app, runtime, root: Path):
    """Registra la superficie básica usando el módulo runtime como dependencia."""

    @app.get("/")
    def index():
        from release_support import saved_preferences, PREFERENCE_KEYS
        return render_template("index.html", app_version=APP_VERSION,
                               saved_preferences=saved_preferences(runtime), preference_keys=sorted(PREFERENCE_KEYS),
                               lan_enabled=runtime.runtime_config_value.lan_enabled,
                               lan_view_token=runtime.production.view_token)

    @app.get("/status")
    def status():
        return jsonify(runtime.state)

    @app.get("/feed")
    def feed():
        after = request.args.get("after", default=0, type=int)
        response = jsonify(runtime.feed_snapshot(
            max(0, after), request.args.get("session"),
            request.args.get("gifts_version", -1, type=int),
        ))
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/gift-catalog")
    def gift_catalog():
        return jsonify(runtime.gift_catalog_payload())

    @app.get("/version")
    def version():
        asset_folders = (root / "web" / "static", root / "web" / "templates", root / "assets")
        build = max((
            path.stat().st_mtime_ns
            for folder in asset_folders
            for path in folder.rglob("*")
            if path.is_file()
        ), default=0)
        return jsonify(
            app_version=APP_VERSION,
            tiktoklive_available=runtime.TIKTOKLIVE_AVAILABLE,
            tiktoklive_version=runtime.TIKTOKLIVE_VERSION,
            build=build,
        )

    @app.post("/live/start")
    def start_live():
        if not runtime.production.local():
            return jsonify(error="Solo disponible desde este equipo"), 403
        data = request.get_json(silent=True)
        username = data.get("username", "") if isinstance(data, dict) else ""
        error = runtime.start_connection(username)
        if error:
            return jsonify(error=error.get("detail") or error.get("title"), details=error), 400
        return jsonify(ok=True, state=runtime.state)

    @app.post("/live/stop")
    def stop_live():
        if not runtime.production.local():
            return jsonify(error="Solo disponible desde este equipo"), 403
        stopped = runtime.stop_live_connection()
        if stopped:
            runtime.state.update(connected=False, connecting=False)
            runtime.socketio.emit("disconnected", {"reason": "Detenido por el usuario"})
            return jsonify(ok=True, state=runtime.state)
        return jsonify(error="La conexión sigue cerrándose"), 409
