"""Rutas y validación de widgets para OBS y programas de streaming."""
from __future__ import annotations

import re

from flask import jsonify, render_template, request

from widget_styles import widget_defaults


WIDGET_PANELS = {
    "chat", "gifts", "ranking", "top-donors", "top-likes", "stats", "goals", "highlight", "announcement",
    "goal-likes", "goal-shares", "goal-follows", "goal-viewers", "goal-coins",
    "goal-subscribers", "goal-custom-1", "goal-custom-2", "goal-custom-3",
    "countdown-likes", "countdown-shares", "countdown-follows", "countdown-viewers",
    "countdown-coins", "countdown-subscribers", "countdown-custom-1",
    "countdown-custom-2", "countdown-custom-3", "top-gift", "top-streak",
    "gift-counter-1", "gift-counter-2", "gift-counter-3", "latest-gifts",
    "latest-comments", "latest-events", "webcam-frame", "talking-banner", "timer", "fortune-wheel", "point-drop",
}
WIDGET_DEFAULTS = dict(
    theme="dark", background="#101925", text_color="#f4f7fc", accent_color="#85dec5",
    border_color="#2c3a4b", font_family="system-ui", font_size=23, title_size=15, radius=16, opacity=93,
    show_background=True, show_avatar=True, show_name=True, show_time=True, show_details=True,
    show_connection=True, max_items=8, alignment="left", layout="stack", animation="fade",
    canvas_format="horizontal",
)


def validate_widget_settings(data, panel=None):
    if not isinstance(data, dict):
        raise ValueError("Configuración inválida")
    result = widget_defaults(WIDGET_DEFAULTS, panel)
    for key in ("theme", "font_family", "alignment", "layout", "animation", "canvas_format"):
        if key in data:
            result[key] = str(data[key])
    if result["theme"] not in ("dark", "light", "neon", "minimal", "custom"):
        raise ValueError("Tema inválido")
    if result["font_family"] not in ("Arial", "Verdana", "Georgia", "Trebuchet MS", "Courier New", "Segoe UI", "system-ui"):
        raise ValueError("Fuente inválida")
    if result["alignment"] not in ("left", "center", "right") or result["layout"] not in ("stack", "grid"):
        raise ValueError("Distribución inválida")
    if result["animation"] not in ("none", "fade", "slide", "pop"):
        raise ValueError("Animación inválida")
    if result["canvas_format"] not in ("horizontal", "vertical"):
        raise ValueError("Formato de lienzo inválido")
    for key in ("background", "text_color", "accent_color", "border_color"):
        value = str(data.get(key, result[key]))
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise ValueError("Color inválido")
        result[key] = value.lower()
    for key, low, high in (("font_size", 12, 64), ("title_size", 10, 36), ("radius", 0, 40), ("opacity", 0, 100), ("max_items", 1, 50)):
        result[key] = max(low, min(high, int(data.get(key, result[key]))))
    for key in ("show_background", "show_avatar", "show_name", "show_time", "show_details", "show_connection"):
        if key in data and type(data[key]) is not bool:
            raise ValueError("Opción inválida")
        result[key] = data.get(key, result[key]) is True
    return result


def register_widget_routes(app, runtime):
    @app.get("/overlay")
    def overlay():
        return render_template("overlay.html", overlay_mode="all")

    @app.get("/overlay/likes")
    def overlay_likes():
        return render_template("overlay.html", overlay_mode="likes")

    @app.get("/overlay/gifts")
    def overlay_gifts():
        return render_template("overlay.html", overlay_mode="gifts")

    @app.get("/widget/<panel>")
    def widget(panel):
        if panel not in WIDGET_PANELS:
            return "Panel no encontrado", 404
        return render_template("widget.html", panel=panel)

    @app.route("/widget-settings/<panel>", methods=["GET", "POST", "DELETE"])
    def widget_settings(panel):
        if panel not in WIDGET_PANELS:
            return jsonify(error="Panel desconocido"), 404
        saved = runtime.archive.settings().get("widget_customizations", {}) if runtime.archive else {}
        if not isinstance(saved, dict):
            saved = {}
        if request.method == "POST":
            try:
                settings = validate_widget_settings(request.get_json(silent=True), panel)
            except (ValueError, TypeError) as exc:
                return jsonify(error=str(exc)), 400
            saved = dict(saved)
            saved[panel] = settings
            if runtime.archive:
                runtime.archive.set_setting("widget_customizations", saved)
            return jsonify(panel=panel, settings=settings)
        if request.method == "DELETE":
            saved = dict(saved)
            saved.pop(panel, None)
            if runtime.archive:
                runtime.archive.set_setting("widget_customizations", saved)
        try:
            settings = validate_widget_settings(saved.get(panel, {}), panel)
        except (ValueError, TypeError):
            settings = widget_defaults(WIDGET_DEFAULTS, panel)
        return jsonify(panel=panel, settings=settings)
