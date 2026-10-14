from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_overlay_templates_use_vite_builds():
    overlay = (ROOT / "web/templates/overlay.html").read_text(encoding="utf-8")
    widget = (ROOT / "web/templates/widget.html").read_text(encoding="utf-8")
    animation = (ROOT / "web/templates/animation_widget.html").read_text(encoding="utf-8")
    assert "/static/build/broadcast.js" in overlay
    assert "/static/build/broadcast.css" in overlay
    assert "/static/build/studio.js" in widget
    assert "/static/build/studio.js" in animation
    assert "/static/overlay_studio.js" not in widget + animation
    assert 'data-overlay="{{ overlay_mode }}"' in overlay


def test_likes_and_gifts_have_independent_public_routes():
    routes = (ROOT / "app/widget_routes.py").read_text(encoding="utf-8")
    production = (ROOT / "app/production.py").read_text(encoding="utf-8")
    workspace = (ROOT / "web/static/workspace.js").read_text(encoding="utf-8")
    assert '@app.get("/overlay/likes")' in routes
    assert '@app.get("/overlay/gifts")' in routes
    assert "'/overlay/'" in production
    assert "Likes separados" in workspace
    assert "Regalos separados" in workspace


def test_overlay_build_outputs_are_packaged_with_web_assets():
    build = ROOT / "web/static/build"
    expected = ("runtime.js", "broadcast.js", "broadcast.css", "studio.js")
    for name in expected:
        path = build / name
        assert path.is_file(), f"Falta compilar {name}: ejecuta npm run build:overlays"
        assert path.stat().st_size > 100


def test_frontend_sources_keep_engines_lazy():
    studio = (ROOT / "frontend/entries/studio.ts").read_text(encoding="utf-8")
    assert 'import("gsap")' in studio
    assert 'import("@tsparticles/engine")' in studio
    assert 'import("matter-js")' in studio
    assert 'import("lottie-web/build/player/lottie_light")' in studio


def test_animation_runtime_uses_one_bounded_accelerated_renderer():
    studio = (ROOT / "frontend/entries/studio.ts").read_text(encoding="utf-8")
    styles = (ROOT / "web/static/overlay_studio.css").read_text(encoding="utf-8")
    cannon = (ROOT / "web/static/gift_cannon.js").read_text(encoding="utf-8")
    emojis = (ROOT / "web/static/chat_emojis.js").read_text(encoding="utf-8")
    assert studio.count('scene.classList.add("studio-pixi")') == 2
    assert ".studio-pixi>.effect-particle{display:none}" in styles
    assert "MAX_BURST=36,MAX_RETAINED=80" in cannon
    assert "getBoundingClientRect();p.width=box.width" in emojis
    assert "p.el.offsetWidth" not in emojis


def test_public_chat_overlay_cannot_show_scrollbars():
    template = (ROOT / "web/templates/widget.html").read_text(encoding="utf-8")
    styles = (ROOT / "web/static/widgets.css").read_text(encoding="utf-8")
    assert 'data-widget="{{ panel }}"' in template
    assert "widgets.css?v=" in template
    assert "html[data-widget=chat] body{position:fixed;inset:0}" in styles
    assert "scrollbar-width:none" in styles
    assert "::-webkit-scrollbar" in styles


def test_overlay_runtime_batches_events_and_gift_alerts_expire():
    transport = (ROOT / "frontend/runtime/transport.ts").read_text(encoding="utf-8")
    broadcast = (ROOT / "frontend/entries/broadcast.ts").read_text(encoding="utf-8")
    runtime = (ROOT / "frontend/entries/runtime.ts").read_text(encoding="utf-8")
    assert "pendingEvents" in transport
    assert "}, 80)" in transport
    assert 'new CustomEvent("event"' in transport
    assert "onEvent(handler" in transport
    assert "this.socket.disconnect()" in transport
    assert "giftQueue" in broadcast
    assert "5200" in broadcast
    assert 'params.has("preview")' in runtime
