"""Desktop window for TikReader's complete studio.

Qt WebEngine carries the existing visual studios inside the application, so no
external browser is required. OBS keeps using the same local overlay URLs.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable

from PySide6.QtCore import QObject, QRunnable, QThreadPool, QTimer, Qt, QUrl, Signal, Slot
from PySide6.QtGui import QFont, QIcon
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile, QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import (
    QApplication, QCheckBox, QComboBox, QFileDialog, QFrame, QGridLayout,
    QHBoxLayout, QHeaderView, QLabel, QLineEdit, QListWidget, QListWidgetItem,
    QMainWindow, QMessageBox, QPushButton, QScrollArea, QSpinBox,
    QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget,
)

from app_config import APP_VERSION
from app_paths import data_dir
from desktop_api import DesktopApi, DesktopApiError


ROOT = Path(__file__).resolve().parent.parent
WINDOWS_APP_ID = "3rror32.TikReader.Desktop"


def _set_windows_app_identity() -> None:
    """Keep Windows from grouping the native window under python/pythonw."""
    if sys.platform != "win32":
        return
    try:
        import ctypes

        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(WINDOWS_APP_ID)
    except (AttributeError, OSError):
        pass


_set_windows_app_identity()

COLORS = {
    "canvas": "#090b12", "rail": "#10131d", "panel": "#151927",
    "raised": "#1c2232", "line": "#293246", "text": "#f4f7fb",
    "muted": "#8f9bad", "teal": "#36e4c6", "pink": "#ff4d78",
    "gold": "#f7c95c", "purple": "#9a7cff",
}


STYLE = f"""
* {{ font-family: "Segoe UI", sans-serif; font-size: 10pt; color: {COLORS['text']}; }}
QMainWindow, QWidget#root {{ background: {COLORS['canvas']}; }}
QLabel#brand {{ font-size: 19pt; font-weight: 800; letter-spacing: -1px; }}
QLabel#brandMark {{ background: transparent; color: white; border-radius: 9px;
    font-size: 15pt; font-weight: 900; padding: 0; }}
QLabel#eyebrow {{ color: {COLORS['teal']}; font: 700 8pt "Consolas"; letter-spacing: 1px; }}
QLabel#pageTitle {{ font-size: 22pt; font-weight: 750; }}
QLabel#muted, QLabel.muted {{ color: {COLORS['muted']}; }}
QLabel#signal {{ padding: 7px 12px; border: 1px solid {COLORS['line']}; border-radius: 12px;
    background: {COLORS['panel']}; color: {COLORS['muted']}; font-weight: 650; }}
QLabel#signal[mode="live"] {{ color: {COLORS['teal']}; border-color: #237e72; background: #102a29; }}
QLabel#signal[mode="busy"] {{ color: {COLORS['gold']}; border-color: #75642f; background: #2b2618; }}
QLabel#signal[mode="error"] {{ color: {COLORS['pink']}; border-color: #7d3045; background: #2c1720; }}
QPushButton {{ background: {COLORS['raised']}; border: 1px solid {COLORS['line']}; border-radius: 8px;
    padding: 9px 14px; font-weight: 650; }}
QPushButton:hover {{ border-color: {COLORS['teal']}; }}
QPushButton:focus {{ border: 2px solid {COLORS['teal']}; }}
QPushButton:disabled {{ color: #596275; background: #141824; }}
QPushButton#primary {{ background: {COLORS['teal']}; color: #07120f; border: none; }}
QPushButton#danger {{ color: {COLORS['pink']}; }}
QPushButton#danger:disabled {{ color: #596275; }}
QPushButton#nav {{ text-align: left; border: none; background: transparent; color: {COLORS['muted']};
    padding: 10px 14px; }}
QPushButton#nav:hover {{ background: {COLORS['panel']}; color: {COLORS['text']}; }}
QPushButton#nav[selected="true"] {{ background: #17262b; color: {COLORS['teal']};
    border-left: 3px solid {COLORS['teal']}; }}
QFrame#card {{ background: {COLORS['panel']}; border: 1px solid {COLORS['line']}; border-radius: 12px; }}
QLabel#statValue {{ font: 750 22pt "Segoe UI"; }}
QLabel#statLabel {{ color: {COLORS['muted']}; font: 650 8pt "Consolas"; letter-spacing: 1px; }}
QLineEdit, QSpinBox, QComboBox {{ background: {COLORS['panel']}; border: 1px solid {COLORS['line']};
    border-radius: 8px; padding: 9px 11px; selection-background-color: {COLORS['purple']}; }}
QLineEdit:focus, QSpinBox:focus, QComboBox:focus {{ border: 2px solid {COLORS['teal']}; }}
QListWidget, QTableWidget {{ background: {COLORS['panel']}; alternate-background-color: #121622;
    border: 1px solid {COLORS['line']}; border-radius: 10px; gridline-color: {COLORS['line']}; }}
QListWidget::item {{ border-bottom: 1px solid {COLORS['line']}; }}
QListWidget::item:selected, QTableWidget::item:selected {{ background: #213d41; }}
QHeaderView::section {{ background: {COLORS['raised']}; color: {COLORS['muted']}; border: none;
    border-bottom: 1px solid {COLORS['line']}; padding: 8px; font-weight: 700; }}
QScrollBar:vertical {{ background: {COLORS['panel']}; width: 10px; margin: 2px; }}
QScrollBar::handle:vertical {{ background: #3a455c; min-height: 24px; border-radius: 4px; }}
QCheckBox {{ spacing: 9px; }}
"""


class TaskSignals(QObject):
    result = Signal(object)
    error = Signal(str)
    finished = Signal()


class ApiTask(QRunnable):
    def __init__(self, operation: Callable[[], object]):
        super().__init__()
        self.operation = operation
        self.signals = TaskSignals()

    def run(self):
        try:
            result = self.operation()
        except Exception as exc:  # Presented in the window; worker must not die silently.
            try:
                self.signals.error.emit(str(exc))
            except RuntimeError:
                pass  # The window was already closed.
        else:
            try:
                self.signals.result.emit(result)
            except RuntimeError:
                pass
        try:
            self.signals.finished.emit()
        except RuntimeError:
            pass


class StatCard(QFrame):
    def __init__(self, label: str, accent: str):
        super().__init__()
        self.setObjectName("card")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 12, 14, 12)
        caption = QLabel(label.upper())
        caption.setObjectName("statLabel")
        self.value = QLabel("0")
        self.value.setObjectName("statValue")
        self.value.setStyleSheet(f"color: {accent};")
        layout.addWidget(caption)
        layout.addWidget(self.value)

    def set_value(self, value):
        if isinstance(value, int):
            self.value.setText(f"{value:,}".replace(",", " "))
        else:
            self.value.setText(str(value))


class NativeVoiceBridge(QObject):
    """Read with Windows voices without invoking Chromium speech synthesis."""

    started = Signal()
    finished = Signal()
    failed = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.engine = None
        self._active = False
        self._started = False

    def _ensure_engine(self):
        from PySide6.QtTextToSpeech import QTextToSpeech

        if self.engine is None:
            self.engine = QTextToSpeech(self)
            self.engine.stateChanged.connect(self._state_changed)
            self.engine.errorOccurred.connect(self._error_occurred)
        return self.engine

    def _select_voice(self, voice_label: str) -> None:
        engine = self._ensure_engine()
        requested_name, _, requested_locale = voice_label.partition(" · ")
        requested_name = requested_name.strip().casefold()
        requested_locale = requested_locale.strip().replace("-", "_").casefold()
        voices = engine.availableVoices()
        selected = next((voice for voice in voices if voice.name().strip().casefold() == requested_name), None)
        if selected is None and requested_locale:
            selected = next(
                (voice for voice in voices if voice.locale().name().casefold().startswith(requested_locale)),
                None,
            )
        if selected is None:
            selected = next(
                (voice for voice in voices if voice.locale().name().casefold().startswith("es")),
                None,
            )
        if selected is not None:
            engine.setVoice(selected)

    @Slot(str, float, float, float, str)
    def speak(self, text: str, rate: float, volume: float, pitch: float, voice_label: str) -> None:
        clean_text = str(text).strip()[:400]
        if not clean_text:
            self.failed.emit("El texto de la prueba está vacío.")
            return
        engine = self._ensure_engine()
        self._active = False
        engine.stop()
        self._select_voice(str(voice_label))
        engine.setRate(max(-1.0, min(1.0, float(rate) - 1.0)))
        engine.setVolume(max(0.0, min(1.0, float(volume))))
        engine.setPitch(max(-1.0, min(1.0, float(pitch) - 1.0)))
        self._active = True
        self._started = False
        engine.say(clean_text)

    @Slot()
    def stop(self) -> None:
        self._active = False
        self._started = False
        if self.engine is not None:
            self.engine.stop()

    @Slot()
    def pause(self) -> None:
        if self._active and self.engine is not None:
            self.engine.pause()

    @Slot()
    def resume(self) -> None:
        if self._active and self.engine is not None:
            self.engine.resume()

    def _state_changed(self, state) -> None:
        from PySide6.QtTextToSpeech import QTextToSpeech

        if state == QTextToSpeech.State.Speaking and self._active and not self._started:
            self._started = True
            self.started.emit()
        elif state == QTextToSpeech.State.Ready and self._active:
            self._active = False
            self._started = False
            self.finished.emit()

    def _error_occurred(self, _reason, error_string: str) -> None:
        if not self._active:
            return
        self._active = False
        self._started = False
        self.failed.emit(error_string or "La voz del sistema no está disponible.")


class StudioWebView(QWebEngineView):
    """Web studio hosted by TikReader itself, including native popup windows."""

    def __init__(self, profile: QWebEngineProfile, parent=None):
        super().__init__(parent)
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)
        self._profile = profile
        self._popups: list[QMainWindow] = []
        page = QWebEnginePage(profile, self)
        self.setPage(page)
        from PySide6.QtWebChannel import QWebChannel

        self._web_channel = QWebChannel(page)
        self._native_voice = NativeVoiceBridge(self._web_channel)
        self._web_channel.registerObject("nativeVoice", self._native_voice)
        page.setWebChannel(self._web_channel)
        self._loaded_once = False
        self._renderer_recovery = QTimer(self)
        self._renderer_recovery.setSingleShot(True)
        self._renderer_recovery.setInterval(400)
        self._renderer_recovery.timeout.connect(self._reload_after_renderer_failure)
        self.loadFinished.connect(self._remember_successful_load)
        page.renderProcessTerminated.connect(self._recover_renderer)
        settings = self.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.PlaybackRequiresUserGesture, False)
        if hasattr(page, "featurePermissionRequested"):
            page.featurePermissionRequested.connect(self._grant_local_permission)

    def _remember_successful_load(self, loaded: bool) -> None:
        if loaded:
            self._loaded_once = True

    def _recover_renderer(self, _termination_status, _exit_code) -> None:
        if self._loaded_once and not self._renderer_recovery.isActive():
            self._loaded_once = False
            self._renderer_recovery.start()

    def _reload_after_renderer_failure(self) -> None:
        if self.url().isValid():
            self.reload()

    def _grant_local_permission(self, origin, feature):
        local = origin.host() in {"127.0.0.1", "localhost"}
        policy = (QWebEnginePage.PermissionPolicy.PermissionGrantedByUser if local else
                  QWebEnginePage.PermissionPolicy.PermissionDeniedByUser)
        self.page().setFeaturePermission(origin, feature, policy)

    def createWindow(self, _window_type):
        popup = QMainWindow(self.window())
        popup.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose)
        popup.setWindowTitle("TikReader · Vista separada")
        popup.resize(960, 640)
        icon = ROOT / "assets" / "icons" / "tikreader.ico"
        if icon.is_file():
            popup.setWindowIcon(QIcon(str(icon)))
        view = StudioWebView(self._profile, popup)
        popup.setCentralWidget(view)
        popup.destroyed.connect(lambda: self._popups.remove(popup) if popup in self._popups else None)
        self._popups.append(popup)
        popup.show()
        return view


class MainWindow(QMainWindow):
    def __init__(self, base_url: str):
        super().__init__()
        self.api = DesktopApi(base_url)
        self.base_url = base_url.rstrip("/")
        self.pool = QThreadPool.globalInstance()
        self.busy: set[str] = set()
        self.session = ""
        self.cursor = 0
        self.gift_version = -1
        self.seen_comments: set[str] = set()
        self.closing = False

        web_data = data_dir() / "qt-webengine"
        web_data.mkdir(parents=True, exist_ok=True)
        self.web_profile = QWebEngineProfile("TikReader", self)
        self.web_profile.setPersistentStoragePath(str(web_data / "storage"))
        self.web_profile.setCachePath(str(web_data / "cache"))
        self.web_profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.AllowPersistentCookies)
        self.web_profile.downloadRequested.connect(self.download_requested)

        self.setWindowTitle(f"TikReader {APP_VERSION}")
        self.setMinimumSize(1060, 680)
        self.resize(1360, 860)
        icon = ROOT / "assets" / "icons" / "tikreader.ico"
        if icon.is_file():
            self.setWindowIcon(QIcon(str(icon)))
        self.setStyleSheet(STYLE)
        self._build()

        self.poll = QTimer(self)

    def _build(self):
        root = QWidget()
        root.setObjectName("root")
        self.setCentralWidget(root)
        shell = QVBoxLayout(root)
        shell.setContentsMargins(0, 0, 0, 0)
        shell.setSpacing(0)
        shell.addWidget(self._complete_studio_page(), 1)

    def page(self, title: str, subtitle: str) -> tuple[QWidget, QVBoxLayout]:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(28, 24, 28, 24)
        layout.setSpacing(15)
        eyebrow = QLabel("ESTUDIO NATIVO")
        eyebrow.setObjectName("eyebrow")
        heading = QLabel(title)
        heading.setObjectName("pageTitle")
        description = QLabel(subtitle)
        description.setObjectName("muted")
        description.setWordWrap(True)
        layout.addWidget(eyebrow)
        layout.addWidget(heading)
        layout.addWidget(description)
        return widget, layout

    def _complete_studio_page(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        self.studio = StudioWebView(self.web_profile, page)
        self.studio.setUrl(QUrl(self.base_url))
        layout.addWidget(self.studio, 1)
        return page

    def _live_page(self):
        page, layout = self.page("En vivo", "Conecta una transmisión y sigue la actividad sin abrir un navegador.")
        controls = QHBoxLayout()
        self.username = QLineEdit()
        self.username.setPlaceholderText("Usuario de TikTok, sin @")
        self.username.setClearButtonEnabled(True)
        self.username.returnPressed.connect(self.start_live)
        self.connect_button = QPushButton("Conectar LIVE")
        self.connect_button.setObjectName("primary")
        self.connect_button.clicked.connect(self.start_live)
        self.stop_button = QPushButton("Detener")
        self.stop_button.setObjectName("danger")
        self.stop_button.clicked.connect(self.stop_live)
        self.stop_button.setEnabled(False)
        controls.addWidget(self.username, 1)
        controls.addWidget(self.connect_button)
        controls.addWidget(self.stop_button)
        layout.addLayout(controls)
        self.live_status = QLabel("Preparando el servicio local…")
        self.live_status.setObjectName("muted")
        layout.addWidget(self.live_status)

        stats = QHBoxLayout()
        self.stats = {}
        for key, label, color in (
            ("comments", "Comentarios", COLORS["teal"]), ("likes", "Me gusta", COLORS["pink"]),
            ("gifts", "Regalos", COLORS["gold"]), ("viewers", "Espectadores", COLORS["purple"]),
        ):
            card = StatCard(label, color)
            self.stats[key] = card
            stats.addWidget(card, 1)
        layout.addLayout(stats)

        columns = QHBoxLayout()
        comment_box = QVBoxLayout()
        title_row = QHBoxLayout()
        title_row.addWidget(QLabel("Comentarios"))
        title_row.addStretch()
        clear = QPushButton("Limpiar vista")
        clear.clicked.connect(self.clear_comments)
        title_row.addWidget(clear)
        comment_box.addLayout(title_row)
        self.comments = QListWidget()
        self.comments.setAlternatingRowColors(True)
        self.comments.setMinimumWidth(480)
        comment_box.addWidget(self.comments)
        gift_box = QVBoxLayout()
        gift_box.addWidget(QLabel("Regalos recientes"))
        self.gifts = QTableWidget(0, 3)
        self.gifts.setHorizontalHeaderLabels(["Usuario", "Regalo", "Cantidad"])
        self.gifts.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.gifts.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.gifts.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self.gifts.verticalHeader().hide()
        self.gifts.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        gift_box.addWidget(self.gifts)
        columns.addLayout(comment_box, 3)
        columns.addLayout(gift_box, 2)
        layout.addLayout(columns, 1)
        return page

    def _history_page(self):
        page, layout = self.page("Historial", "Las sesiones continúan guardándose en la misma base de datos de TikReader.")
        actions = QHBoxLayout()
        refresh = QPushButton("Actualizar")
        refresh.clicked.connect(self.load_history)
        backup = QPushButton("Crear respaldo")
        backup.setObjectName("primary")
        backup.clicked.connect(self.backup_history)
        actions.addWidget(refresh)
        actions.addWidget(backup)
        actions.addStretch()
        layout.addLayout(actions)
        self.history = QTableWidget(0, 3)
        self.history.setHorizontalHeaderLabels(["Usuario", "Inicio", "Sesión"])
        self.history.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.history.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self.history.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.history.verticalHeader().hide()
        self.history.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.history.setAlternatingRowColors(True)
        layout.addWidget(self.history, 1)
        return page

    def _overlays_page(self):
        page, layout = self.page("Overlays de OBS", "El servidor de overlays sigue funcionando en segundo plano; copia estas direcciones en OBS.")
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        body = QWidget()
        body_layout = QVBoxLayout(body)
        body_layout.setContentsMargins(0, 0, 8, 0)
        for name, route, size in (
            ("Chat", "/widget/chat", "480 × 800"), ("Contadores", "/widget/stats", "600 × 260"),
            ("Metas", "/widget/goals", "480 × 280"), ("Regalos", "/overlay/gifts", "Flexible"),
            ("Me gusta", "/overlay/likes", "Flexible"), ("Overlay completo", "/overlay", "1920 × 1080"),
        ):
            card = QFrame()
            card.setObjectName("card")
            row = QHBoxLayout(card)
            copy = QVBoxLayout()
            label = QLabel(name)
            label.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
            url = QLabel(self.base_url + route)
            url.setObjectName("muted")
            copy.addWidget(label)
            copy.addWidget(url)
            size_label = QLabel(size)
            size_label.setObjectName("muted")
            button = QPushButton("Copiar URL")
            button.clicked.connect(lambda checked=False, value=self.base_url + route: self.copy_url(value))
            row.addLayout(copy, 1)
            row.addWidget(size_label)
            row.addWidget(button)
            body_layout.addWidget(card)
        body_layout.addStretch()
        scroll.setWidget(body)
        layout.addWidget(scroll, 1)
        return page

    def _settings_page(self):
        page, layout = self.page("Configuración", "Estos valores se guardan en el archivo .env de datos y sobreviven a las actualizaciones.")
        form = QFrame()
        form.setObjectName("card")
        grid = QGridLayout(form)
        grid.setContentsMargins(18, 18, 18, 18)
        grid.setHorizontalSpacing(18)
        grid.setVerticalSpacing(14)
        grid.addWidget(QLabel("Puerto local"), 0, 0)
        self.port = QSpinBox()
        self.port.setRange(1, 65535)
        self.port.setValue(5000)
        grid.addWidget(self.port, 0, 1)
        grid.addWidget(QLabel("Nivel de registro"), 1, 0)
        self.log_level = QComboBox()
        self.log_level.addItems(["DEBUG", "INFO", "WARNING", "ERROR"])
        grid.addWidget(self.log_level, 1, 1)
        self.lan = QCheckBox("Permitir controles desde la red local")
        grid.addWidget(self.lan, 2, 0, 1, 2)
        lan_note = QLabel("Déjalo apagado salvo que necesites un moderador en otro equipo de confianza.")
        lan_note.setObjectName("muted")
        lan_note.setWordWrap(True)
        grid.addWidget(lan_note, 3, 0, 1, 2)
        layout.addWidget(form)
        actions = QHBoxLayout()
        save = QPushButton("Guardar cambios")
        save.setObjectName("primary")
        save.clicked.connect(self.save_settings)
        open_data = QPushButton("Abrir carpeta de datos")
        open_data.clicked.connect(self.open_data)
        actions.addWidget(save)
        actions.addWidget(open_data)
        actions.addStretch()
        layout.addLayout(actions)
        self.settings_status = QLabel("Los cambios de red se aplican al reiniciar TikReader.")
        self.settings_status.setObjectName("muted")
        layout.addWidget(self.settings_status)
        layout.addStretch()
        return page

    def _about_page(self):
        page, layout = self.page("Acerca de TikReader", "Aplicación nativa para controlar tus transmisiones de TikTok Live.")
        card = QFrame()
        card.setObjectName("card")
        content = QVBoxLayout(card)
        content.setContentsMargins(20, 20, 20, 20)
        self.about_version = QLabel(f"TikReader {APP_VERSION} Beta")
        self.about_version.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        self.about_runtime = QLabel("Consultando componentes…")
        self.about_runtime.setObjectName("muted")
        self.about_runtime.setWordWrap(True)
        content.addWidget(self.about_version)
        content.addWidget(self.about_runtime)
        layout.addWidget(card)
        note = QLabel("TikReader incluye su propio motor visual Qt. No necesita abrir Chrome, Edge ni Firefox. El servicio HTTP local se conserva para comunicar la ventana y los overlays de OBS.")
        note.setWordWrap(True)
        note.setObjectName("muted")
        layout.addWidget(note)
        exit_button = QPushButton("Cerrar TikReader completamente")
        exit_button.setObjectName("danger")
        exit_button.clicked.connect(self.request_close)
        layout.addWidget(exit_button, 0, Qt.AlignmentFlag.AlignLeft)
        layout.addStretch()
        return page

    def download_requested(self, download):
        suggested = download.downloadFileName() or "tikreader-descarga"
        filename, _ = QFileDialog.getSaveFileName(self, "Guardar archivo", suggested)
        if not filename:
            download.cancel()
            return
        destination = Path(filename)
        download.setDownloadDirectory(str(destination.parent))
        download.setDownloadFileName(destination.name)
        download.accept()

    def task(self, key: str, operation: Callable[[], object], success: Callable[[object], None], *, quiet=False):
        if key in self.busy:
            return
        self.busy.add(key)
        task = ApiTask(operation)
        task.signals.result.connect(success)
        if not quiet:
            task.signals.error.connect(lambda message: self.show_error(message))
        else:
            task.signals.error.connect(self.service_error)
        task.signals.finished.connect(lambda: self.busy.discard(key))
        self.pool.start(task)

    def refresh_live(self):
        self.task("status", lambda: self.api.json("/status"), self.apply_status, quiet=True)
        self.task("feed", lambda: self.api.feed(self.session, self.cursor, self.gift_version), self.apply_feed, quiet=True)

    def service_error(self, message: str):
        self.signal.setText("●  Servicio sin respuesta")
        self.set_signal_mode("error")
        self.live_status.setText(message)

    def set_signal_mode(self, mode: str):
        self.signal.setProperty("mode", mode)
        self.signal.style().unpolish(self.signal)
        self.signal.style().polish(self.signal)

    def apply_status(self, state):
        self.signal.setText("●  Servicio local activo")
        connected = bool(state.get("connected"))
        connecting = bool(state.get("connecting"))
        self.set_signal_mode("live" if connected else "busy" if connecting else "")
        self.connect_button.setEnabled(not connected and not connecting)
        self.stop_button.setEnabled(connected or connecting)
        self.username.setEnabled(not connected and not connecting)
        username = state.get("username") or ""
        if connected:
            self.live_status.setText(f"En directo con @{username}")
        elif connecting:
            retries = int(state.get("retry_count") or 0)
            self.live_status.setText(f"Reconectando con @{username} · intento {retries}" if retries else f"Conectando con @{username}…")
        else:
            self.live_status.setText("Servicio listo. Ingresa el usuario de una transmisión activa.")

    def apply_feed(self, snapshot):
        new_session = str(snapshot.get("session") or "")
        if new_session != self.session:
            self.session = new_session
            self.cursor = 0
            self.gift_version = -1
            self.seen_comments.clear()
            self.comments.clear()
        for comment in snapshot.get("comments") or []:
            identity = str(comment.get("id") or f"{comment.get('sequence')}:{comment.get('user')}")
            if identity in self.seen_comments:
                continue
            self.seen_comments.add(identity)
            self.add_comment(comment)
        self.cursor = max(self.cursor, int(snapshot.get("cursor") or 0))
        stats = snapshot.get("stats") or {}
        for key in self.stats:
            value = stats.get(key, 0)
            if key == "likes" and not stats.get("likes_known") and not stats.get("like_events"):
                value = "—"
            self.stats[key].set_value(value)
        if "gifts" in snapshot:
            self.populate_gifts(snapshot.get("gifts") or [])
        self.gift_version = max(self.gift_version, int(snapshot.get("gift_version") or 0))

    def add_comment(self, data):
        user = str(data.get("user") or "Usuario")
        text = str(data.get("comment") or "")
        timestamp = str(data.get("timestamp") or "")
        item = QListWidgetItem()
        widget = QWidget()
        row = QHBoxLayout(widget)
        row.setContentsMargins(10, 8, 10, 8)
        avatar = QLabel((user.lstrip("@")[:1] or "?").upper())
        avatar.setAlignment(Qt.AlignmentFlag.AlignCenter)
        avatar.setFixedSize(34, 34)
        avatar.setStyleSheet(f"background:{COLORS['purple']};color:white;border-radius:17px;font-weight:800;")
        body = QVBoxLayout()
        name = QLabel(user)
        name.setFont(QFont("Segoe UI", 9, QFont.Weight.Bold))
        comment = QLabel(text)
        comment.setTextFormat(Qt.TextFormat.PlainText)
        comment.setWordWrap(True)
        meta = QLabel(timestamp)
        meta.setObjectName("muted")
        body.addWidget(name)
        body.addWidget(comment)
        body.addWidget(meta)
        row.addWidget(avatar, 0, Qt.AlignmentFlag.AlignTop)
        row.addLayout(body, 1)
        item.setSizeHint(widget.sizeHint())
        self.comments.addItem(item)
        self.comments.setItemWidget(item, widget)
        while self.comments.count() > 200:
            self.comments.takeItem(0)
        self.comments.scrollToBottom()

    def clear_comments(self):
        self.comments.clear()
        self.seen_comments.clear()

    def populate_gifts(self, gifts):
        self.gifts.setRowCount(len(gifts))
        for row, gift in enumerate(gifts):
            values = [gift.get("user", ""), gift.get("gift", ""), f"×{gift.get('count', 1)}"]
            for column, value in enumerate(values):
                self.gifts.setItem(row, column, QTableWidgetItem(str(value)))

    def start_live(self):
        username = self.username.text().strip().lstrip("@")
        if not username:
            self.show_error("Ingresa el usuario de TikTok, sin @.")
            return
        self.live_status.setText(f"Solicitando conexión con @{username}…")
        self.connect_button.setEnabled(False)
        self.task("control", lambda: self.api.start_live(username), lambda _: self.refresh_live())

    def stop_live(self):
        self.stop_button.setEnabled(False)
        self.task("control", self.api.stop_live, lambda _: self.refresh_live())

    def load_history(self):
        self.task("history", lambda: self.api.json("/history"), self.apply_history)

    def apply_history(self, payload):
        sessions = payload.get("sessions") or []
        self.history.setRowCount(len(sessions))
        for row, session in enumerate(sessions):
            for column, value in enumerate((session.get("username", ""), session.get("started", ""), session.get("id", ""))):
                self.history.setItem(row, column, QTableWidgetItem(str(value)))

    def backup_history(self):
        suggested = f"tikreader-respaldo-{APP_VERSION.replace('.', '-')}.sqlite3"
        filename, _ = QFileDialog.getSaveFileName(self, "Guardar respaldo", suggested, "Base de datos SQLite (*.sqlite3)")
        if not filename:
            return
        destination = Path(filename)
        self.task("backup", lambda: self.api.save_download("/history/backup", destination, {}),
                  lambda path: self.show_info(f"Respaldo guardado en:\n{path}"))

    def copy_url(self, value: str):
        QApplication.clipboard().setText(value)
        self.show_info("URL copiada. Pégala como fuente de navegador en OBS.")

    def load_settings(self):
        self.task("settings", lambda: self.api.json("/system/runtime-config"), self.apply_settings)

    def apply_settings(self, payload):
        values = payload.get("values") or {}
        self.port.setValue(int(values.get("TIKREADER_PORT", 5000)))
        self.lan.setChecked(str(values.get("TIKREADER_LAN", "0")).lower() in {"1", "true", "yes", "on"})
        level = str(values.get("TIKREADER_LOG_LEVEL", "INFO")).upper()
        index = self.log_level.findText(level)
        self.log_level.setCurrentIndex(max(0, index))

    def save_settings(self):
        values = {"TIKREADER_PORT": str(self.port.value()), "TIKREADER_LAN": "1" if self.lan.isChecked() else "0",
                  "TIKREADER_LOG_LEVEL": self.log_level.currentText()}
        self.task("settings-save", lambda: self.api.post("/system/runtime-config", values), self.settings_saved)

    def settings_saved(self, _):
        self.settings_status.setText("Cambios guardados en .env. Reinicia TikReader para aplicarlos.")
        self.settings_status.setStyleSheet(f"color:{COLORS['teal']};")

    def open_data(self):
        self.task("open-data", lambda: self.api.post("/system/open-data", {}), lambda _: None)

    def load_version(self):
        self.task("version", lambda: self.api.json("/version"), self.apply_version, quiet=True)

    def apply_version(self, payload):
        available = "disponible" if payload.get("tiktoklive_available") else "no disponible"
        self.about_runtime.setText(f"TikTokLive {payload.get('tiktoklive_version', 'desconocida')} · Motor {available}\nServicio: {self.base_url}")

    def show_error(self, message: str):
        QMessageBox.critical(self, "TikReader", message)

    def show_info(self, message: str):
        QMessageBox.information(self, "TikReader", message)

    def request_close(self):
        self.close()

    def closeEvent(self, event):
        if self.closing:
            event.accept()
            return
        answer = QMessageBox.question(self, "Cerrar TikReader", "¿Quieres cerrar TikReader y desconectar el LIVE?",
                                      QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                                      QMessageBox.StandardButton.No)
        if answer != QMessageBox.StandardButton.Yes:
            event.ignore()
            return
        try:
            self.api.post("/system/exit", {"confirm": True})
        except DesktopApiError as exc:
            if exc.unreachable:
                self.closing = True
                self.poll.stop()
                event.accept()
                return
            self.show_error(str(exc))
            event.ignore()
            return
        self.closing = True
        self.poll.stop()
        event.accept()


def run(base_url: str) -> int:
    app = QApplication.instance() or QApplication(sys.argv)
    app.setApplicationName("TikReader")
    app.setApplicationDisplayName("TikReader")
    app.setOrganizationName("3rror32")
    icon = ROOT / "assets" / "icons" / "tikreader.ico"
    if icon.is_file():
        app.setWindowIcon(QIcon(str(icon)))
    window = MainWindow(base_url)
    window.show()
    return app.exec()
