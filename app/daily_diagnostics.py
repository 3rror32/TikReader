"""Local daily diagnostic snapshots, independent of connected browsers."""
import json
import threading
import time
from datetime import datetime, timedelta, date
from pathlib import Path


class DailyDiagnostics:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.lock = threading.Lock()
        self.previous = None
        self.last_write = 0
        self.last_day = None
        self.failed = False

    def prune(self, today):
        """Only remove this logger's dated files older than 30 days."""
        root = self.directory.resolve()
        for path in self.directory.glob('tikreader-????-??-??.log'):
            if path.is_symlink() or path.resolve().parent != root or not path.is_file():
                continue
            try:
                file_date = date.fromisoformat(path.stem.removeprefix('tikreader-'))
            except ValueError:
                continue
            if file_date < today - timedelta(days=29):
                path.unlink()

    def record(self, state, diagnostics, session):
        now = datetime.now().astimezone()
        day = now.strftime('%Y-%m-%d')
        signature = (session, bool(state['connected']), bool(state['connecting']),
                     state['retry_count'], state['likes_source'],
                     state['likes_known'], state['viewers_known'])
        interval = 60 if state['connected'] or state['connecting'] else 30 * 60
        with self.lock:
            monotonic = time.monotonic()
            if signature == self.previous and day == self.last_day and monotonic - self.last_write < interval:
                return
            source = state['likes_source']
            connection = 'conectado' if state['connected'] else 'conectando' if state['connecting'] else 'sin_live'
            row = {
                'timestamp': now.isoformat(timespec='seconds'), 'session': session,
                'connection': connection, 'retry_count': state['retry_count'],
                'likes_source': source,
                'likes_note': 'Último total observado, recuperado después del reinicio' if source == 'recovered'
                    else 'Total informado por la sala de TikTok; puede diferir de la app' if source == 'room'
                    else 'Eventos recibidos de TikTok' if source == 'event' else 'Esperando datos',
                'likes_known': state['likes_known'], 'viewers_known': state['viewers_known'],
                'counters_current': bool(state['connected']),
                'counts': {key: state[key] for key in ('like_count', 'viewer_count', 'comment_count', 'gift_count', 'like_events')},
                'last_received_at': dict(diagnostics),
            }
            try:
                self.directory.mkdir(parents=True, exist_ok=True)
                with (self.directory / f'tikreader-{day}.log').open('a', encoding='utf-8') as stream:
                    stream.write(json.dumps(row, ensure_ascii=False) + '\n')
                if day != self.last_day:
                    self.prune(now.date())
            except OSError as exc:
                if not self.failed:
                    print(f'[Logs] No se pudo escribir el diagnóstico diario: {type(exc).__name__}', flush=True)
                self.failed = True
                return
            self.failed = False
            self.previous, self.last_day, self.last_write = signature, day, monotonic
