"""Persistent viewer points, levels and subscriber bonuses."""
import re
import time
from flask import jsonify, request


class PointsSystem:
    DEFAULTS = {
        'enabled': False, 'currency': 'Puntos', 'comment': 1, 'like': 1,
        'gift': 10, 'follow': 25, 'share': 5, 'subscribe': 100,
        'subscriber_multiplier': 2.0, 'points_per_level': 100,
    }

    def __init__(self, app, runtime):
        self.r = runtime
        self.config = dict(self.DEFAULTS)
        self._ready_path = None
        self.register(app)

    def _db(self):
        archive = self.r.archive
        if archive is None:
            return None
        if self._ready_path != archive.path:
            with archive.connect() as db:
                db.executescript('''
                    CREATE TABLE IF NOT EXISTS viewer_points(
                        user TEXT PRIMARY KEY, display_name TEXT NOT NULL,
                        points INTEGER NOT NULL DEFAULT 0,
                        lifetime INTEGER NOT NULL DEFAULT 0,
                        subscriber INTEGER NOT NULL DEFAULT 0,
                        updated REAL NOT NULL);
                    CREATE TABLE IF NOT EXISTS point_events(
                        event_id TEXT PRIMARY KEY, created REAL NOT NULL);
                ''')
                columns = {row[1] for row in db.execute('PRAGMA table_info(viewer_points)')}
                if 'subscriber_session' not in columns:
                    db.execute("ALTER TABLE viewer_points ADD COLUMN subscriber_session TEXT NOT NULL DEFAULT ''")
            self._ready_path = archive.path
        return archive

    def restore(self):
        if self.r.archive:
            saved = self.r.archive.settings().get('points_config', {})
            if isinstance(saved, dict):
                try:
                    self.config = self.validate(saved)
                except (TypeError, ValueError):
                    self.config = dict(self.DEFAULTS)

    def validate(self, data):
        if not isinstance(data, dict):
            raise ValueError('Configuración inválida')
        result = dict(self.DEFAULTS)
        result['enabled'] = data.get('enabled') is True
        name = str(data.get('currency', result['currency'])).strip()
        if not name or len(name) > 24:
            raise ValueError('El nombre de la moneda debe tener de 1 a 24 caracteres')
        result['currency'] = name
        for key in ('comment', 'like', 'gift', 'follow', 'share', 'subscribe'):
            result[key] = max(0, min(100000, int(data.get(key, result[key]))))
        result['subscriber_multiplier'] = max(1, min(10, float(data.get('subscriber_multiplier', 2))))
        result['points_per_level'] = max(1, min(1000000, int(data.get('points_per_level', 100))))
        return result

    @staticmethod
    def username(record):
        display = str(record.get('user') or '').strip().lstrip('@')
        raw = str(record.get('identity') or display).strip().lstrip('@')
        return raw.casefold()[:80], display[:80]

    def event(self, kind, record, event_id, units=1):
        if not self.config['enabled'] or kind not in self.DEFAULTS:
            return
        user, display = self.username(record)
        if not user or user == 'unknown':
            return
        archive = self._db()
        if archive is None:
            return
        base = self.config.get(kind, 0) * max(1, int(units or 1))
        with archive.connect() as db:
            try:
                db.execute('INSERT INTO point_events(event_id,created) VALUES (?,?)', (str(event_id)[:180], time.time()))
            except Exception as exc:
                if 'UNIQUE' in str(exc).upper():
                    return
                raise
            session = str(getattr(self.r, 'feed_session', 'test'))
            row = db.execute('SELECT subscriber,subscriber_session FROM viewer_points WHERE user=?', (user,)).fetchone()
            subscriber = bool(row and row[0] and row[1] == session) or kind == 'subscribe'
            amount = round(base * (self.config['subscriber_multiplier'] if subscriber and kind != 'subscribe' else 1))
            db.execute('''INSERT INTO viewer_points(user,display_name,points,lifetime,subscriber,updated)
                VALUES (?,?,?,?,?,?) ON CONFLICT(user) DO UPDATE SET
                display_name=excluded.display_name,points=points+excluded.points,
                lifetime=lifetime+excluded.lifetime,subscriber=excluded.subscriber,updated=excluded.updated''',
                (user, display, amount, amount, int(subscriber), time.time()))
            db.execute('UPDATE viewer_points SET subscriber_session=? WHERE user=?', (session if subscriber else '', user))
            db.execute('DELETE FROM point_events WHERE created<?', (time.time()-30*86400,))

    def snapshot(self, query=''):
        archive = self._db()
        if archive is None:
            return []
        with archive.connect() as db:
            if query:
                rows = db.execute('''SELECT user,display_name,points,lifetime,subscriber,updated,subscriber_session FROM viewer_points
                    WHERE instr(lower(display_name),lower(?))>0 ORDER BY points DESC LIMIT 100''', (query[:80],))
            else:
                rows = db.execute('SELECT user,display_name,points,lifetime,subscriber,updated,subscriber_session FROM viewer_points ORDER BY points DESC LIMIT 100')
            return [dict(user=u, display_name=d, points=p, lifetime=l,
                         subscriber=bool(s and session == str(getattr(self.r,'feed_session','test'))),
                         level=1+l//self.config['points_per_level'], updated=t) for u,d,p,l,s,t,session in rows]

    def register(self, app):
        @app.route('/points', methods=['GET', 'POST'])
        def points_config():
            if request.method == 'POST':
                if not self.r.production.local():
                    return jsonify(error='Solo disponible desde este equipo'), 403
                try:
                    config = self.validate(request.get_json(silent=True))
                    if self.r.archive:
                        self.r.archive.set_setting('points_config', config)
                    self.config = config
                except (TypeError, ValueError) as exc:
                    return jsonify(error=str(exc)), 400
            return jsonify(config=self.config, users=self.snapshot(request.args.get('q', '')))

        @app.post('/points/adjust')
        def adjust():
            if not self.r.production.local():
                return jsonify(error='Solo disponible desde este equipo'), 403
            data = request.get_json(silent=True) or {}
            user = str(data.get('user', '')).strip().lstrip('@').casefold()[:80]
            if not re.fullmatch(r'[\w.\-]{1,80}', user, re.UNICODE):
                return jsonify(error='Usuario inválido'), 400
            try:
                amount = max(-1000000, min(1000000, int(data.get('amount', 0))))
            except (TypeError, ValueError):
                return jsonify(error='Cantidad inválida'), 400
            archive = self._db()
            if archive is None:
                return jsonify(error='Historial no disponible'), 503
            with archive.connect() as db:
                db.execute('''INSERT INTO viewer_points(user,display_name,points,lifetime,subscriber,updated)
                    VALUES (?,?,?,?,0,?) ON CONFLICT(user) DO UPDATE SET
                    points=max(0,points+?),lifetime=lifetime+max(0,?),updated=?''',
                    (user, user, max(0, amount), max(0, amount), time.time(), amount, amount, time.time()))
            return jsonify(ok=True, users=self.snapshot(user))

        @app.post('/points/reset')
        def reset():
            if not self.r.production.local():
                return jsonify(error='Solo disponible desde este equipo'), 403
            data = request.get_json(silent=True) or {}
            if data.get('confirmation') != 'RESTABLECER PUNTOS':
                return jsonify(error='Falta la confirmación RESTABLECER PUNTOS'), 400
            archive = self._db()
            if archive:
                with archive.connect() as db:
                    db.execute('DELETE FROM viewer_points')
                    db.execute('DELETE FROM point_events')
            return jsonify(ok=True)
