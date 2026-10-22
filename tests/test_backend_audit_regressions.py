"""Exercise backend regressions without booting the live server or connectors."""
import ast
from collections import OrderedDict
from pathlib import Path
import threading
import time
from types import SimpleNamespace
from unittest.mock import Mock, call
from uuid import uuid4

from flask import Flask
import pytest

from core_routes import register_core_routes


ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def support_runtime():
    source = ROOT / "app" / "server.py"
    tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
    handler = next(node for node in tree.body
                   if isinstance(node, ast.FunctionDef) and node.name == "handle_external_support")
    runtime = {
        "gift_history": OrderedDict(), "gift_revision": 0, "state": {"gift_count": 0},
        "feed_lock": threading.RLock(), "feed_session": "isolated-session",
        "time": time, "uuid4": uuid4,
        "_external_occurred_at": lambda value: value,
    }
    for name in ("observe_external_participant", "archive", "creator_suite", "live_counters",
                 "interactive", "points", "animation_studio", "overlay_animations",
                 "publish_gift_history", "handle_external_comment", "publish_stats"):
        runtime[name] = Mock(name=name)
    # Compile the actual handler, retaining its globals and control flow, without server startup.
    exec(compile(ast.Module(body=[handler], type_ignores=[]), str(source), "exec"), runtime)
    return runtime


@pytest.mark.parametrize("platform", ["youtube", "twitch", "kick"])
def test_external_support_evicts_oldest_and_preserves_dispatch(support_runtime, platform):
    runtime = support_runtime
    history = runtime["gift_history"]
    history.update((f"prior:{index}", {"id": f"prior:{index}"}) for index in range(100))
    data = {"id": "newest", "user": "viewer", "user_id": "42", "display_amount": "$5",
            "occurred_at": 1700000000, "comment": "hello"}

    record = runtime["handle_external_support"](platform, data)

    assert list(history) == [f"prior:{index}" for index in range(1, 100)] + [record["id"]]
    assert history[record["id"]] is record
    assert record["platform"] == platform
    assert record["diamonds"] is None
    assert runtime["state"]["gift_count"] == runtime["gift_revision"] == 1
    runtime["archive"].save.assert_called_once_with("isolated-session", "gift", record)
    runtime["creator_suite"].audience_event.assert_called_once_with("gift", record, record["id"], 1)
    runtime["live_counters"].event.assert_called_once_with("gift", record["id"], record, 1, None)
    runtime["interactive"].event.assert_called_once_with("gift", record, record["id"], quantity=1)
    runtime["points"].event.assert_called_once_with("gift", record, record["id"], 1)
    runtime["animation_studio"].gift.assert_called_once_with(record, record["id"])
    runtime["overlay_animations"].event.assert_called_once_with("gift", record, record["id"])
    runtime["publish_gift_history"].assert_called_once_with()
    runtime["handle_external_comment"].assert_called_once_with(platform, data)
    runtime["publish_stats"].assert_called_once_with()

    assert runtime["handle_external_support"](platform, data) is None
    assert len(history) == 100
    assert runtime["state"]["gift_count"] == runtime["gift_revision"] == 1
    runtime["archive"].save.assert_called_once()
    runtime["publish_gift_history"].assert_called_once()
    runtime["publish_stats"].assert_called_once()


def stop_client(*, local=True, stopped=True, manager=True):
    runtime = SimpleNamespace(
        production=SimpleNamespace(local=lambda: local),
        stop_live_connection=Mock(return_value=stopped), socketio=Mock(),
        state={"connected": True, "connecting": True},
    )
    operations = Mock()
    operations.attach_mock(runtime.stop_live_connection, "tiktok")
    if manager:
        runtime.platform_manager = Mock()
        operations.attach_mock(runtime.platform_manager.stop_all, "external")
    app = Flask(__name__)
    register_core_routes(app, runtime, ROOT)
    return app.test_client(), runtime, operations


@pytest.mark.parametrize("stopped", [True, False])
def test_http_stop_stops_external_platforms_before_tiktok(stopped):
    client, runtime, operations = stop_client(stopped=stopped)

    response = client.post("/live/stop")

    assert operations.mock_calls == [call.external(), call.tiktok()]
    assert response.status_code == (200 if stopped else 409)
    if stopped:
        assert response.json["ok"] is True
        assert runtime.state == {"connected": False, "connecting": False}
        runtime.socketio.emit.assert_called_once()
    else:
        assert "error" in response.json
        assert runtime.state == {"connected": True, "connecting": True}
        runtime.socketio.emit.assert_not_called()


def test_http_stop_preserves_local_authorization():
    client, runtime, operations = stop_client(local=False)

    response = client.post("/live/stop")

    assert response.status_code == 403
    assert operations.mock_calls == []
    assert runtime.state == {"connected": True, "connecting": True}
    runtime.socketio.emit.assert_not_called()


@pytest.mark.parametrize("manager", ["absent", "none"])
def test_http_stop_supports_runtime_without_platform_manager(manager):
    client, runtime, operations = stop_client(manager=False)
    if manager == "none":
        runtime.platform_manager = None

    response = client.post("/live/stop")

    assert response.status_code == 200
    assert operations.mock_calls == [call.tiktok()]
    assert runtime.state == {"connected": False, "connecting": False}
