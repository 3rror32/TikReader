"""Behavioral regression coverage for the frameless startup splash."""
import os
from pathlib import Path
from unittest.mock import Mock

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
os.environ.setdefault("TIKREADER_REDUCE_MOTION", "1")

import pytest
from PySide6.QtCore import QPoint, QPointF, Qt
from PySide6.QtGui import QMouseEvent
from PySide6.QtWidgets import QApplication, QWidget

from startup_splash import StartupSplash


@pytest.fixture
def splash():
    application = QApplication.instance() or QApplication([])
    window = StartupSplash(Path(__file__).resolve().parents[1])
    window.show()
    application.processEvents()
    yield window
    window.close()
    application.processEvents()


def mouse_event(kind, global_position, button, buttons):
    return QMouseEvent(kind, QPointF(20, 20), QPointF(global_position), button, buttons, Qt.KeyboardModifier.NoModifier)


def test_left_press_prefers_native_window_movement(splash, monkeypatch):
    native = Mock()
    native.startSystemMove.return_value = True
    monkeypatch.setattr(splash, "windowHandle", lambda: native)
    splash.mousePressEvent(mouse_event(QMouseEvent.Type.MouseButtonPress, QPoint(100, 100), Qt.MouseButton.LeftButton, Qt.MouseButton.LeftButton))
    native.startSystemMove.assert_called_once_with()
    assert splash._drag_offset is None


def test_manual_fallback_moves_by_pointer_offset_and_stops_on_release(splash, monkeypatch):
    native = Mock()
    native.startSystemMove.return_value = False
    monkeypatch.setattr(splash, "windowHandle", lambda: native)
    splash.move(120, 140)
    splash.mousePressEvent(mouse_event(QMouseEvent.Type.MouseButtonPress, QPoint(150, 180), Qt.MouseButton.LeftButton, Qt.MouseButton.LeftButton))
    splash.mouseMoveEvent(mouse_event(QMouseEvent.Type.MouseMove, QPoint(250, 280), Qt.MouseButton.NoButton, Qt.MouseButton.LeftButton))
    assert splash.pos() == QPoint(220, 240)
    splash.mouseReleaseEvent(mouse_event(QMouseEvent.Type.MouseButtonRelease, QPoint(250, 280), Qt.MouseButton.LeftButton, Qt.MouseButton.NoButton))
    assert splash._drag_offset is None
    splash.mouseMoveEvent(mouse_event(QMouseEvent.Type.MouseMove, QPoint(350, 380), Qt.MouseButton.NoButton, Qt.MouseButton.NoButton))
    assert splash.pos() == QPoint(220, 240)


def test_right_press_does_not_start_movement(splash, monkeypatch):
    native = Mock()
    monkeypatch.setattr(splash, "windowHandle", lambda: native)
    splash.mousePressEvent(mouse_event(QMouseEvent.Type.MouseButtonPress, QPoint(100, 100), Qt.MouseButton.RightButton, Qt.MouseButton.RightButton))
    native.startSystemMove.assert_not_called()
    assert splash._drag_offset is None


def test_passive_content_does_not_intercept_drag_presses(splash):
    card = splash.findChild(QWidget, "splashCard")
    assert card.testAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
    assert splash.childAt(splash.logo.mapTo(splash, splash.logo.rect().center())) is None
    assert splash.childAt(splash.status_label.mapTo(splash, splash.status_label.rect().center())) is None
