"""Local SQLite archive. JSON payloads preserve images and gift details."""
import json
import sqlite3
from pathlib import Path
from contextlib import contextmanager, closing


class HistoryStore:
    SCHEMA_VERSION = 2

    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = str(path)
        with self.connect() as db:
            db.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, username TEXT, started TEXT DEFAULT CURRENT_TIMESTAMP);
                CREATE TABLE IF NOT EXISTS events(session TEXT, kind TEXT, id TEXT, payload TEXT,
                    PRIMARY KEY(session,kind,id));
                CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
                CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS idx_events_session ON events(session);
                CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started DESC);
            ''')
            db.execute('INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)',
                       ('schema_version', str(self.SCHEMA_VERSION)))

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        try:
            with db:
                yield db
        finally:
            db.close()

    def start(self, session, username):
        with self.connect() as db:
            db.execute('INSERT OR IGNORE INTO sessions(id,username) VALUES (?,?)', (session, username))

    def save(self, session, kind, record):
        with self.connect() as db:
            db.execute('INSERT OR REPLACE INTO events VALUES (?,?,?,?)',
                       (session, kind, record['id'], json.dumps(record, ensure_ascii=False)))

    def sessions(self):
        with self.connect() as db:
            return [dict(zip(('id', 'username', 'started'), row)) for row in
                    db.execute('SELECT id,username,started FROM sessions ORDER BY started DESC LIMIT 100')]

    def save_once(self, session, kind, record):
        with self.connect() as db:
            return bool(db.execute('INSERT OR IGNORE INTO events VALUES (?,?,?,?)',
                (session,kind,record['id'],json.dumps(record,ensure_ascii=False))).rowcount)

    def records(self, session):
        with self.connect() as db:
            return [{'kind': row[0], **json.loads(row[1])} for row in
                    db.execute('SELECT kind,payload FROM events WHERE session=? ORDER BY rowid', (session,))]

    def recent_gifts(self, username, exclude='', hours=8):
        """Return the most recent prior gift set for a likely continuing LIVE."""
        with self.connect() as db:
            rows=db.execute('''SELECT e.payload FROM events e JOIN sessions s ON s.id=e.session
                WHERE e.kind='gift' AND lower(s.username)=lower(?) AND s.id!=?
                AND s.started>=datetime('now',?)
                ORDER BY s.started DESC,e.rowid DESC LIMIT 300''',
                (username,exclude,f'-{max(1,min(24,int(hours)))} hours'))
            found=[];seen=set()
            for row in rows:
                gift=json.loads(row[0]);key=gift.get('id')
                if key in seen:continue
                seen.add(key);found.append(gift)
                if len(found)>=100:break
            return found

    def gifts_for_live(self, username, live_id, exclude=''):
        """Return gifts captured for this exact TikTok LIVE room."""
        if not str(live_id).strip():
            return []
        with self.connect() as db:
            rows = db.execute('''SELECT g.payload FROM events identity
                JOIN sessions s ON s.id=identity.session
                JOIN events g ON g.session=s.id AND g.kind='gift'
                WHERE identity.kind='live_identity'
                AND lower(s.username)=lower(?) AND s.id!=?
                AND json_extract(identity.payload,'$.live_id')=?
                ORDER BY s.started DESC,g.rowid DESC LIMIT 300''',
                (username, exclude, str(live_id))).fetchall()
            found=[];seen=set()
            for row in rows:
                gift=json.loads(row[0]);key=gift.get('id')
                if key in seen:continue
                seen.add(key);found.append(gift)
                if len(found)>=100:break
            return found

    def mark(self, session, comment_id, answered):
        with self.connect() as db:
            row = db.execute("SELECT payload FROM events WHERE session=? AND kind='comment' AND id=?",
                             (session, comment_id)).fetchone()
            if row:
                data = json.loads(row[0]); data['answered'] = answered
                db.execute("UPDATE events SET payload=? WHERE session=? AND kind='comment' AND id=?",
                           (json.dumps(data, ensure_ascii=False), session, comment_id))

    def settings(self):
        with self.connect() as db:
            return {key: json.loads(value) for key, value in db.execute('SELECT key,value FROM settings')}

    def set_setting(self, key, value):
        with self.connect() as db:
            db.execute('INSERT OR REPLACE INTO settings VALUES (?,?)', (key, json.dumps(value)))

    def health(self):
        try:
            with self.connect() as db:
                check = db.execute('PRAGMA quick_check').fetchone()[0]
                version = db.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()
                sessions = db.execute('SELECT count(*) FROM sessions').fetchone()[0]
            return {'available': True, 'integrity': check, 'schema_version': int(version[0]), 'sessions': sessions}
        except (sqlite3.Error, ValueError, TypeError):
            return {'available': False, 'integrity': 'error', 'schema_version': None, 'sessions': None}

    def search(self, query, user='', limit=100):
        # instr performs a literal search; user text never becomes SQL or a LIKE pattern.
        with self.connect() as db:
            rows=db.execute('''SELECT e.session,e.kind,e.payload,s.username,s.started
                FROM events e JOIN sessions s ON s.id=e.session
                WHERE e.kind='comment' AND instr(lower(json_extract(e.payload,'$.comment')),lower(?))>0
                AND instr(lower(json_extract(e.payload,'$.user')),lower(?))>0
                ORDER BY s.started DESC,e.rowid DESC LIMIT ?''', (query,user,min(100,max(1,limit))))
            return [dict(session=s,kind=k,record=json.loads(p),host=h,started=t) for s,k,p,h,t in rows]

    def backup(self, target):
        with self.connect() as source:
            destination=sqlite3.connect(str(target))
            try:
                source.backup(destination)
            finally:
                destination.close()

    def delete_session(self, session):
        with self.connect() as db:
            db.execute('DELETE FROM events WHERE session=?',(session,))
            return db.execute('DELETE FROM sessions WHERE id=?',(session,)).rowcount

    def inspect_backup(self, path):
        # Read only; never execute SQL or settings supplied by an uploaded file.
        with closing(sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro', uri=True)) as db:
            db.execute('PRAGMA trusted_schema=OFF')
            if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                raise ValueError('Respaldo dañado')
            for table in ('sessions', 'events'):
                if db.execute("SELECT type FROM sqlite_master WHERE name=?", (table,)).fetchone() != ('table',):
                    raise ValueError('Formato de respaldo inválido')
            sessions=db.execute('SELECT id,username,started FROM sessions').fetchall()
            events=db.execute('SELECT session,kind,id,payload FROM events').fetchall()
            ids={row[0] for row in sessions}
            for sid,kind,eid,payload in events:
                value=json.loads(payload)
                if sid not in ids or not isinstance(value,dict) or value.get('id')!=eid:
                    raise ValueError('Eventos inválidos en respaldo')
            return sessions,events

    def restore(self, path, protected):
        sessions,events=self.inspect_backup(path)
        with self.connect() as db:
            before=db.total_changes
            db.executemany('INSERT OR IGNORE INTO sessions(id,username,started) VALUES (?,?,?)',
                           [r for r in sessions if r[0]!=protected])
            db.executemany('INSERT OR IGNORE INTO events(session,kind,id,payload) VALUES (?,?,?,?)',
                           [r for r in events if r[0]!=protected])
            return db.total_changes-before

    def retention(self, days, protected, delete=False):
        with self.connect() as db:
            ids=[r[0] for r in db.execute("SELECT id FROM sessions WHERE started < datetime('now',?) AND id != ?",
                                        (f'-{days} days',protected))]
            if delete:
                db.executemany('DELETE FROM events WHERE session=?',[(s,) for s in ids])
                db.executemany('DELETE FROM sessions WHERE id=?',[(s,) for s in ids])
            return len(ids)
