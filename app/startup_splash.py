"""Animated, non-blocking startup presentation for the native TikReader app."""
from __future__ import annotations

import math
import os
import sys
from pathlib import Path

from PySide6.QtCore import (
    QEasingCurve, QElapsedTimer, QEventLoop, QPointF, QPropertyAnimation,
    QRectF, Qt, QTimer,
)
from PySide6.QtGui import (
    QBrush, QColor, QFont, QIcon, QLinearGradient, QPainter, QPainterPath,
    QPen, QPixmap, QRadialGradient,
)
from PySide6.QtWidgets import (
    QApplication, QGraphicsDropShadowEffect, QHBoxLayout, QLabel,
    QVBoxLayout, QWidget,
)


VOID = QColor("#030206")
CYAN = QColor("#00e8ff")
MAGENTA = QColor("#ff2fb3")


def _motion_enabled() -> bool:
    """Allow launchers and accessibility tools to suppress ambient motion."""
    return os.environ.get("TIKREADER_REDUCE_MOTION", "").strip().lower() not in {
        "1", "true", "yes", "on",
    }


class EnergyCard(QWidget):
    """Black glass surface with restrained cyan and magenta signal light."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._phase = 0.0
        self._motion = _motion_enabled()
        self._timer = QTimer(self)
        self._timer.setInterval(33)
        self._timer.timeout.connect(self._advance)
        if self._motion:
            self._timer.start()

    def _advance(self) -> None:
        self._phase = (self._phase + 0.008) % 1.0
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802 - Qt API
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        bounds = QRectF(self.rect()).adjusted(1.5, 1.5, -1.5, -1.5)
        radius = 27.0
        card_path = QPainterPath()
        card_path.addRoundedRect(bounds, radius, radius)
        painter.fillPath(card_path, VOID)

        # Two slow pools of color make the logo feel powered by the side rails.
        phase = self._phase * math.tau
        pulse = 0.5 + 0.5 * math.sin(phase)
        painter.save()
        painter.setClipPath(card_path)

        left_glow = QRadialGradient(
            QPointF(self.width() * (0.24 + 0.025 * math.sin(phase)), self.height() * 0.40),
            self.width() * 0.52,
        )
        left_glow.setColorAt(0.0, QColor(0, 232, 255, int(24 + 11 * pulse)))
        left_glow.setColorAt(0.42, QColor(0, 138, 184, 11))
        left_glow.setColorAt(1.0, QColor(0, 0, 0, 0))
        painter.fillRect(self.rect(), QBrush(left_glow))

        right_glow = QRadialGradient(
            QPointF(self.width() * (0.76 + 0.025 * math.cos(phase)), self.height() * 0.42),
            self.width() * 0.52,
        )
        right_glow.setColorAt(0.0, QColor(255, 47, 179, int(20 + 10 * (1.0 - pulse))))
        right_glow.setColorAt(0.44, QColor(134, 27, 119, 10))
        right_glow.setColorAt(1.0, QColor(0, 0, 0, 0))
        painter.fillRect(self.rect(), QBrush(right_glow))

        # A very dim traveling signal keeps the surface alive without flashing.
        signal_x = -90.0 + (self.width() + 180.0) * self._phase
        signal = QLinearGradient(signal_x - 80.0, 0.0, signal_x + 80.0, 0.0)
        signal.setColorAt(0.0, QColor(255, 255, 255, 0))
        signal.setColorAt(0.5, QColor(205, 243, 255, 8))
        signal.setColorAt(1.0, QColor(255, 255, 255, 0))
        painter.fillRect(QRectF(0.0, 2.0, self.width(), self.height() - 4.0), QBrush(signal))
        painter.restore()

        painter.setPen(QPen(QColor("#273248"), 1.0))
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawPath(card_path)

        left_edge = QPainterPath(QPointF(bounds.left() + radius, bounds.top()))
        left_edge.quadTo(bounds.topLeft(), QPointF(bounds.left(), bounds.top() + radius))
        left_edge.lineTo(bounds.left(), bounds.bottom() - radius)
        left_edge.quadTo(bounds.bottomLeft(), QPointF(bounds.left() + radius, bounds.bottom()))

        right_edge = QPainterPath(QPointF(bounds.right() - radius, bounds.top()))
        right_edge.quadTo(bounds.topRight(), QPointF(bounds.right(), bounds.top() + radius))
        right_edge.lineTo(bounds.right(), bounds.bottom() - radius)
        right_edge.quadTo(bounds.bottomRight(), QPointF(bounds.right() - radius, bounds.bottom()))

        edge_alpha = int(210 + 30 * pulse)
        for path, color in ((left_edge, CYAN), (right_edge, MAGENTA)):
            glow = QColor(color)
            glow.setAlpha(28)
            painter.setPen(QPen(glow, 9.0, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            painter.drawPath(path)
            glow.setAlpha(72)
            painter.setPen(QPen(glow, 3.5, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            painter.drawPath(path)
            edge = QColor(color)
            edge.setAlpha(edge_alpha)
            painter.setPen(QPen(edge, 1.35, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            painter.drawPath(path)


class SignalLogo(QWidget):
    """TikReader mark with a short boot-in and a quiet ambient pulse."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._pixmap = QPixmap()
        self._elapsed = QElapsedTimer()
        self._elapsed.start()
        self._motion = _motion_enabled()
        self.setFixedSize(122, 108)
        self._timer = QTimer(self)
        self._timer.setInterval(33)
        self._timer.timeout.connect(self.update)
        if self._motion:
            self._timer.start()

    def set_logo(self, pixmap: QPixmap) -> None:
        self._pixmap = pixmap
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802 - Qt API
        if self._pixmap.isNull():
            return
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
        elapsed = self._elapsed.elapsed() if self._motion else 900
        intro = min(1.0, elapsed / 620.0)
        eased = 1.0 - (1.0 - intro) ** 3
        ambient = math.sin(elapsed / 1150.0 * math.tau) if self._motion else 0.0
        scale = 0.90 + 0.10 * eased + 0.004 * ambient
        opacity = 0.18 + 0.82 * eased

        size = 96.0 * scale
        target = QRectF(
            (self.width() - size) / 2.0,
            (self.height() - size) / 2.0,
            size,
            size,
        )
        split = max(0.0, 1.0 - elapsed / 520.0) * 3.5
        if split > 0.05:
            painter.setOpacity(0.15 * opacity)
            painter.drawPixmap(target.translated(-split, 0.0), self._pixmap, QRectF(self._pixmap.rect()))
            painter.drawPixmap(target.translated(split, 0.0), self._pixmap, QRectF(self._pixmap.rect()))
        painter.setOpacity(opacity)
        painter.drawPixmap(target, self._pixmap, QRectF(self._pixmap.rect()))


class SignalProgressBar(QWidget):
    """A single custom-painted white rail with chromatic reflected light."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._value = 0.035
        self._target = 0.10
        self._phase = 0.0
        self._completing = False
        self._motion = _motion_enabled()
        self.setFixedHeight(17)
        self.setMinimumWidth(300)
        self._timer = QTimer(self)
        self._timer.setInterval(25)
        self._timer.timeout.connect(self._advance)
        if self._motion:
            self._timer.start()
        else:
            self._value = self._target

    def set_target(self, value: float) -> None:
        self._target = max(self._target, min(1.0, float(value)))
        if not self._motion:
            self._value = self._target
        self.update()

    def complete(self) -> None:
        self._completing = True
        self.set_target(1.0)

    def _advance(self) -> None:
        self._phase = (self._phase + 0.018) % 1.0
        distance = self._target - self._value
        if distance > 0.0005:
            easing = 0.30 if self._completing else 0.075
            minimum_step = 0.008 if self._completing else 0.0012
            self._value += max(minimum_step, distance * easing)
            self._value = min(self._target, self._value)
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802 - Qt API
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        width = float(self.width())
        center_y = self.height() / 2.0
        rail = QRectF(0.0, center_y - 1.5, width, 3.0)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor("#1b222c"))
        painter.drawRoundedRect(rail, 1.5, 1.5)

        fill_width = max(4.0, width * min(self._value, 1.0))
        glow_rect = QRectF(0.0, center_y - 5.0, fill_width, 10.0)
        glow = QLinearGradient(0.0, center_y, max(fill_width, 1.0), center_y)
        glow.setColorAt(0.0, QColor(0, 232, 255, 70))
        glow.setColorAt(0.55, QColor(247, 250, 255, 60))
        glow.setColorAt(1.0, QColor(255, 47, 179, 82))
        painter.setBrush(QBrush(glow))
        painter.drawRoundedRect(glow_rect, 5.0, 5.0)

        core = QRectF(0.0, center_y - 2.0, fill_width, 4.0)
        painter.setBrush(QColor("#f7faff"))
        painter.drawRoundedRect(core, 2.0, 2.0)

        # A restrained shimmer travels only inside the completed portion.
        if fill_width > 22.0:
            shimmer_x = (fill_width + 54.0) * self._phase - 54.0
            shimmer = QLinearGradient(shimmer_x, 0.0, shimmer_x + 54.0, 0.0)
            shimmer.setColorAt(0.0, QColor(255, 255, 255, 0))
            shimmer.setColorAt(0.5, QColor(255, 255, 255, 145))
            shimmer.setColorAt(1.0, QColor(255, 255, 255, 0))
            painter.save()
            painter.setClipRect(core)
            painter.setBrush(QBrush(shimmer))
            painter.drawRoundedRect(core, 2.0, 2.0)
            painter.restore()


class StartupSplash(QWidget):
    """Small branded window that stays responsive while the server starts."""

    MINIMUM_VISIBLE_MS = 950

    def __init__(self, root: Path):
        super().__init__()
        self.root = Path(root)
        self._target = None
        self._finishing = False
        self._shown_for = QElapsedTimer()
        self._shown_for.start()

        self.setObjectName("startupSplash")
        self.setWindowTitle("Iniciando TikReader")
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedSize(500, 300)
        self.setWindowOpacity(0.0)
        self._build()
        self._center()

    def _build(self) -> None:
        outer = QVBoxLayout(self)
        outer.setContentsMargins(16, 16, 16, 16)

        card = EnergyCard()
        card.setObjectName("splashCard")
        card.setStyleSheet("""
            QLabel { background: transparent; }
            QLabel#splashStatus {
                color: #aeb9c6;
                font: 500 9pt "Segoe UI";
            }
            QLabel#creatorPrefix {
                color: #637181;
            }
            QLabel#creatorName {
                color: #dbe4ed;
            }
        """)
        shadow = QGraphicsDropShadowEffect(card)
        shadow.setBlurRadius(50)
        shadow.setOffset(0, 13)
        shadow.setColor(QColor(0, 0, 0, 205))
        card.setGraphicsEffect(shadow)

        content = QVBoxLayout(card)
        content.setContentsMargins(50, 24, 50, 25)
        content.setSpacing(0)

        self.logo = SignalLogo()
        self._load_logo()

        self.status_label = QLabel("Preparando TikReader…")
        self.status_label.setObjectName("splashStatus")
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.progress = SignalProgressBar()

        credit = QWidget()
        credit_row = QHBoxLayout(credit)
        credit_row.setContentsMargins(0, 0, 0, 0)
        credit_row.setSpacing(4)
        creator_prefix = QLabel("Desarrollado por")
        creator_prefix.setObjectName("creatorPrefix")
        creator_name = QLabel("3error32")
        creator_name.setObjectName("creatorName")
        credit_font = QFont("Segoe UI", 8, QFont.Weight.DemiBold)
        credit_font.setLetterSpacing(QFont.SpacingType.PercentageSpacing, 108)
        creator_prefix.setFont(credit_font)
        creator_name.setFont(credit_font)
        credit_row.addWidget(creator_prefix)
        credit_row.addWidget(creator_name)

        content.addWidget(self.logo, 0, Qt.AlignmentFlag.AlignHCenter)
        content.addSpacing(12)
        content.addWidget(self.progress)
        content.addSpacing(5)
        content.addWidget(self.status_label)
        content.addStretch(1)
        content.addWidget(credit, 0, Qt.AlignmentFlag.AlignHCenter)
        outer.addWidget(card)

    def _load_logo(self) -> None:
        """Load the first usable packaged logo and always keep a visible fallback."""
        icon_dir = self.root / "assets" / "icons"
        for filename in ("tikreader-192.png", "tikreader-512.png", "tikreader-original.png", "tikreader.ico"):
            path = icon_dir / filename
            if not path.is_file():
                continue
            pixmap = QPixmap(str(path))
            if pixmap.isNull():
                continue
            self.logo.set_logo(self._remove_dark_matte(pixmap))
            return

    @staticmethod
    def _remove_dark_matte(pixmap: QPixmap) -> QPixmap:
        """Fade the icon's nearly-black matte into the splash's live background."""
        image = pixmap.toImage()
        for y in range(image.height()):
            for x in range(image.width()):
                color = image.pixelColor(x, y)
                level = max(color.red(), color.green(), color.blue())
                if level >= 38:
                    continue
                matte_alpha = max(0.0, min(1.0, (level - 4.0) / 34.0))
                color.setAlpha(round(color.alpha() * matte_alpha))
                image.setPixelColor(x, y, color)
        return QPixmap.fromImage(image)

    def _center(self) -> None:
        screen = QApplication.primaryScreen()
        if screen is None:
            return
        bounds = screen.availableGeometry()
        self.move(
            bounds.x() + (bounds.width() - self.width()) // 2,
            bounds.y() + (bounds.height() - self.height()) // 2,
        )

    def show_animated(self) -> None:
        self.show()
        self.raise_()
        if _motion_enabled():
            self._fade_in = QPropertyAnimation(self, b"windowOpacity", self)
            self._fade_in.setDuration(240)
            self._fade_in.setStartValue(0.0)
            self._fade_in.setEndValue(1.0)
            self._fade_in.setEasingCurve(QEasingCurve.Type.OutCubic)
            self._fade_in.start()
        else:
            self.setWindowOpacity(1.0)
        self.pump()

    def set_status(self, text: str) -> None:
        status = str(text)
        self.status_label.setText(status)
        progress_stages = (
            ("Comprobando", 0.20),
            ("Iniciando", 0.38),
            ("Servicio listo", 0.66),
            ("Cargando", 0.84),
            ("Estudio listo", 1.0),
        )
        for prefix, target in progress_stages:
            if status.startswith(prefix):
                self.progress.set_target(target)
                break
        self.pump()

    def pump(self) -> None:
        QApplication.processEvents(QEventLoop.ProcessEventsFlag.AllEvents, 24)

    def finish(self, target=None) -> None:
        if self._finishing:
            return
        self._finishing = True
        self._target = target
        self.progress.complete()
        remaining = max(0, self.MINIMUM_VISIBLE_MS - self._shown_for.elapsed())
        if _motion_enabled():
            remaining = max(200, remaining)
        QTimer.singleShot(remaining, self._fade_away)

    def _fade_away(self) -> None:
        self._fade_out = QPropertyAnimation(self, b"windowOpacity", self)
        self._fade_out.setDuration(230)
        self._fade_out.setStartValue(self.windowOpacity())
        self._fade_out.setEndValue(0.0)
        self._fade_out.setEasingCurve(QEasingCurve.Type.InCubic)
        self._fade_out.finished.connect(self._complete)
        self._fade_out.start()

    def _complete(self) -> None:
        self.close()
        if self._target is not None:
            self._target.raise_()
            self._target.activateWindow()

    def close_immediately(self) -> None:
        self.close()
        self.pump()


def show_startup_splash(root: Path) -> StartupSplash:
    app = QApplication.instance() or QApplication(sys.argv)
    app.setApplicationName("TikReader")
    app.setApplicationDisplayName("TikReader")
    app.setOrganizationName("3rror32")
    icon = Path(root) / "assets" / "icons" / "tikreader.ico"
    if icon.is_file():
        app.setWindowIcon(QIcon(str(icon)))
    splash = StartupSplash(Path(root))
    splash.show_animated()
    return splash
