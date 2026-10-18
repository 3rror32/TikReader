"""Production controls. Public streaming views are sanitized; operator controls stay local."""
import copy
import hashlib
import hmac
import secrets
import time
import re
import threading
import unicodedata
from collections import OrderedDict
from flask import jsonify, request, render_template
from app_paths import data_dir
from studio_routes import build_studio_state

MAX_REMOTE_REQUEST_IPS = 1000


def redact(text):
    text = re.sub(r'https?://\S+|www\.\S+', '[enlace oculto]', str(text), flags=re.I)
    text = re.sub(r'\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b', '[correo oculto]', text)
    return re.sub(r'(?<!\w)\+?\d[\d ()-]{6,}\d(?!\w)', '[número oculto]', text)


def question_key(text):
    text = ''.join(c for c in unicodedata.normalize('NFKD', text.lower()) if not unicodedata.combining(c))
    return ' '.join(re.findall(r'\w+', text))


class Production:
    def __init__(self, app, runtime):
        self.r = runtime
        self.settings = dict(emergency=False, scene='talk', hide_names=False, hide_photos=False,
                             redact=False, announcement='', revision=0)
        self.session = None
        self.started = time.time()
        self.questions = OrderedDict()
        self.markers = []
        self.token = None
        self.token_expires = 0
        self.remote_queue = []
        self.seen = set()
        self.view_token_path = data_dir() / '.lan-view-token'
        self.view_token = self._load_view_token(app.config.get('SECRET_KEY', ''))
        self.remote_access_lock = threading.Lock()
        self.remote_readers = OrderedDict()
        self.remote_requests = {}
        self.register(app)

    def _load_view_token(self, fallback):
        try:
            token = self.view_token_path.read_text(encoding='ascii').strip()
        except (OSError, UnicodeError):
            token = ''
        if len(token) < 32:
            token = secrets.token_urlsafe(32)
            try:
                self.view_token_path.parent.mkdir(parents=True, exist_ok=True)
                self.view_token_path.write_text(token, encoding='ascii')
                self.view_token_path.chmod(0o600)
            except OSError:
                secret = str(fallback).encode('utf-8')
                token = hmac.new(secret, b'tikreader-lan-view-v2', hashlib.sha256).hexdigest()[:43]
        return token

    def rotate_view_token(self):
        token = secrets.token_urlsafe(32)
        self.view_token_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.view_token_path.with_suffix('.tmp')
        temporary.write_text(token, encoding='ascii')
        temporary.replace(self.view_token_path)
        with self.remote_access_lock:
            self.view_token = token
            self.remote_readers.clear()
            self.remote_requests.clear()
        return token

    def local(self):
        return request.remote_addr in (None, '127.0.0.1', '::1')

    def valid_view_access(self):
        supplied = request.args.get('access', '') or request.cookies.get('tikreader_lan_view', '')
        with self.remote_access_lock:
            view_token = self.view_token
        return bool(supplied) and secrets.compare_digest(supplied, view_token)

    def lan_access(self):
        config = getattr(self.r, 'runtime_config_value', None)
        with self.remote_access_lock:
            view_token = self.view_token
            readers = list(self.remote_readers.values())
        return {'enabled': bool(config and config.lan_enabled), 'token': view_token,
                'port': getattr(config, 'port', 5000),
                'fingerprint': hashlib.sha256(view_token.encode()).hexdigest()[:8],
                'readers': readers,
                'scope': 'Clave de solo lectura para overlays y datos visibles de la transmisión.'}

    def allow_remote_read(self):
        address = str(request.remote_addr or 'desconocido')[:64]
        now = time.time()
        with self.remote_access_lock:
            for known_address, stamps in list(self.remote_requests.items()):
                recent_stamps = [stamp for stamp in stamps if now - stamp < 60]
                if recent_stamps:
                    self.remote_requests[known_address] = recent_stamps
                else:
                    del self.remote_requests[known_address]
            if address not in self.remote_requests and len(self.remote_requests) >= MAX_REMOTE_REQUEST_IPS:
                del self.remote_requests[next(iter(self.remote_requests))]
            recent = [stamp for stamp in self.remote_requests.get(address, []) if now - stamp < 60]
            if len(recent) >= 300:
                return False
            recent.append(now)
            self.remote_requests[address] = recent
            masked = address if ':' not in address else address.split(':')[0] + ':…'
            self.remote_readers[address] = {'address': masked, 'last_seen': int(now)}
            while len(self.remote_readers) > 20:
                self.remote_readers.popitem(last=False)
            return True

    def reset_session(self):
        if self.session != self.r.feed_session:
            self.session = self.r.feed_session
            self.started = time.time()
            self.questions.clear(); self.markers.clear(); self.remote_queue.clear(); self.seen.clear()

    def comment(self, record):
        with self.r.feed_lock:
            self.reset_session()
            if record['id'] in self.seen:
                return
            self.seen.add(record['id'])
            if len(self.seen) > 2000:
                self.seen = {c['id'] for c in self.r.comment_history}
            text = record['comment']
            if '?' not in text and '¿' not in text:
                return
            key = question_key(text)
            group = self.questions.get(key)
            if group is None:
                group = dict(id=hashlib.sha256(key.encode()).hexdigest()[:20], text=text,
                             comment_id=record['id'], users=[], count=0, answered=False)
                self.questions[key] = group
            group['count'] += 1
            if record['user'] not in group['users']:
                group['users'].append(record['user'])
            if len(self.questions) > 200:
                self.questions.popitem(last=False)

    def snapshot(self):
        return {**self.settings, 'session': self.r.feed_session}

    def answer_question(self, text, answered):
        key = question_key(text)
        group = self.questions.get(key)
        if group:
            group['answered'] = answered
            if self.r.archive:self.r.archive.save(self.r.feed_session, 'question', group)
        for item in list(self.r.comment_history) + self.remote_queue:
            if question_key(item.get('comment', '')) == key:item['answered'] = answered
        if self.r.archive:
            for item in self.r.archive.records(self.r.feed_session):
                if item['kind'] == 'comment' and question_key(item.get('comment', '')) == key:
                    self.r.archive.mark(self.r.feed_session, item['id'], answered)

    def sanitize(self, data):
        data = copy.deepcopy(data)
        def walk(value):
            if isinstance(value, list):
                return [walk(x) for x in value]
            if not isinstance(value, dict):
                return value
            for key, item in value.items():
                if key in ('user', 'username') and self.settings['hide_names']:
                    value[key] = 'Participante'
                elif key == 'avatar_url' and self.settings['hide_photos']:
                    value[key] = None
                elif key in ('comment', 'text', 'announcement') and self.settings['redact']:
                    value[key] = redact(item)
                else:
                    value[key] = walk(item)
            return value
        return walk(data)

    def register(self, app):
        @app.before_request
        def access_control():
            always_public = request.path.startswith(('/static/', '/remote/', '/webhooks/kick/')) or request.path == '/moderator'
            protected_view = request.path.startswith(('/widget/', '/broadcast/', '/overlay/')) or request.path in ('/overlay', '/status')
            if not self.local() and protected_view and not self.valid_view_access():
                return jsonify(error='Esta vista de la transmisión necesita una clave de lectura.'), 401
            if not self.local() and protected_view and not self.allow_remote_read():
                return jsonify(error='Demasiadas solicitudes desde este dispositivo.'), 429
            if not self.local() and not always_public and not protected_view:
                return jsonify(error='Control disponible solo en este equipo. Usa el panel de moderador.'), 403
            if request.method not in ('GET', 'HEAD', 'OPTIONS'):
                origin = request.headers.get('Origin')
                if origin and origin.rstrip('/') != request.host_url.rstrip('/'):
                    return jsonify(error='Origen no permitido'), 403

        @app.after_request
        def no_cache(response):
            if request.path.startswith(('/production/', '/remote/', '/broadcast/')):
                response.headers['Cache-Control'] = 'no-store'
            if not self.local() and request.args.get('access') and self.valid_view_access():
                with self.remote_access_lock:
                    view_token = self.view_token
                response.set_cookie('tikreader_lan_view', view_token, max_age=8 * 3600,
                                    httponly=True, samesite='Strict')
            return response

        @app.route('/production/state', methods=['GET', 'POST'])
        def production_state():
            with self.r.feed_lock:
                if request.method == 'POST':
                    data = request.get_json(silent=True)
                    if not isinstance(data, dict):
                        return jsonify(error='Datos inválidos'), 400
                    for key in ('emergency', 'hide_names', 'hide_photos', 'redact'):
                        if key in data:
                            if not isinstance(data[key], bool):
                                return jsonify(error='Se esperaba un booleano'), 400
                    if 'scene' in data and data['scene'] not in ('start', 'talk', 'pause', 'end'):
                        return jsonify(error='Escena inválida'), 400
                    for key in ('emergency', 'hide_names', 'hide_photos', 'redact', 'scene'):
                        if key in data:
                            self.settings[key] = data[key]
                    if 'announcement' in data:
                        self.settings['announcement'] = str(data['announcement'])[:500]
                    self.settings['revision'] += 1
                    if self.settings['emergency'] or self.settings['scene'] != 'talk':
                        minecraft = getattr(self.r, 'minecraft', None)
                        if minecraft is not None:minecraft.revision += 1
                        interactive = getattr(self.r, 'interactive', None)
                        if interactive is not None:
                            with interactive.lock:
                                interactive.pending.clear()
                                interactive.effects.clear()
                                interactive.overlay_games['drop'].update(events=[],event=None)
                                interactive.overlay_games['wheel']['spinning'] = False
                    if self.r.archive:
                        self.r.archive.set_setting('production_config', self.settings)
                    self.r.socketio.emit('production_state', self.snapshot())
                return jsonify(self.snapshot())

        @app.route('/production/questions', methods=['GET', 'POST'])
        def questions():
            with self.r.feed_lock:
                self.reset_session()
                if request.method == 'POST':
                    data = request.get_json(silent=True) or {}
                    if not isinstance(data, dict):
                        return jsonify(error='Datos inválidos'), 400
                    item = next((g for g in self.questions.values() if g['id'] == data.get('id')), None)
                    if item is None:
                        return jsonify(error='Pregunta no encontrada'), 404
                    self.answer_question(item['text'], bool(data.get('answered', True)))
                return jsonify(questions=list(reversed(self.questions.values())), prepared=list(self.remote_queue))

        @app.route('/production/markers', methods=['GET', 'POST'])
        def markers():
            with self.r.feed_lock:
                self.reset_session()
                if request.method == 'POST':
                    data = request.get_json(silent=True) or {}
                    if not isinstance(data, dict):
                        return jsonify(error='Datos inválidos'), 400
                    record = dict(id=secrets.token_hex(8), at=time.time(), elapsed=round(time.time()-self.started, 1),
                                  label=str(data.get('label', 'Momento marcado'))[:200], comment_id=str(data.get('comment_id', ''))[:100])
                    self.markers.append(record)
                    self.markers = self.markers[-500:]
                    if self.r.archive:
                        self.r.archive.save(self.r.feed_session, 'marker', record)
                return jsonify(markers=list(reversed(self.markers)))

        @app.route('/production/prepared', methods=['POST'])
        def prepared_action():
            data=request.get_json(silent=True) or {}
            if not isinstance(data,dict) or data.get('action') not in ('discard','answered','reopen'):
                return jsonify(error='Acción inválida'),400
            with self.r.feed_lock:
                self.reset_session()
                item=next((c for c in self.remote_queue if c['id']==data.get('id')),None)
                if not item:
                    return jsonify(error='Comentario no encontrado'),404
                if data['action']=='discard':
                    self.remote_queue.remove(item)
                else:
                    item['answered']=data['action']=='answered'
                    self.answer_question(item['comment'],item['answered'])
                return jsonify(prepared=list(self.remote_queue))

        @app.route('/production/pair', methods=['POST', 'DELETE'])
        def pair():
            with self.r.feed_lock:
                self.token = secrets.token_urlsafe(32) if request.method == 'POST' else None
                self.token_expires = time.time()+8*3600 if self.token else 0
                config = getattr(self.r, 'runtime_config_value', None)
                return jsonify(token=self.token, expires=self.token_expires,
                               lan_enabled=bool(config and config.lan_enabled),
                               port=getattr(config, 'port', request.environ.get('SERVER_PORT', 5000)))

        @app.route('/moderator')
        def moderator():
            return render_template('moderator.html')

        @app.route('/remote/feed', methods=['GET', 'POST'])
        def remote_feed():
            token = request.headers.get('Authorization', '').removeprefix('Bearer ')
            if not self.token or time.time() >= self.token_expires or not secrets.compare_digest(token, self.token):
                return jsonify(error='Acceso caducado o clave incorrecta'), 401
            with self.r.feed_lock:
                self.reset_session()
                if request.method == 'POST':
                    data = request.get_json(silent=True) or {}
                    if not isinstance(data, dict) or set(data) - {'action', 'id'} or data.get('action') not in ('highlight', 'prepare'):
                        return jsonify(error='Acción no permitida'), 403
                    item = next((dict(c) for c in self.r.comment_history if c.get('kind') != 'follow' and c['id'] == data.get('id')), None)
                    if item is None:
                        return jsonify(error='Comentario no disponible'), 404
                    if data['action'] == 'highlight':
                        self.r.studio_state['highlight'] = item
                    elif not any(c['id'] == item['id'] for c in self.remote_queue):
                        self.remote_queue.append(item); self.remote_queue = self.remote_queue[-50:]
                return jsonify(session=self.r.feed_session, comments=[c for c in self.r.comment_history if c.get('kind') != 'follow'][-100:], prepared=list(self.remote_queue))

        @app.route('/broadcast/feed')
        def broadcast_feed():
            with self.r.feed_lock:
                data = self.r.feed_snapshot()
                data['comments'] = [c for c in data.get('comments', []) if c.get('kind') != 'follow']
                if self.settings['emergency'] or self.settings['scene'] != 'talk':
                    data['comments'] = []; data['gifts'] = []
                return jsonify(self.sanitize(data))

        @app.route('/broadcast/state')
        def broadcast_state():
            with self.r.feed_lock:
                data = build_studio_state(self.r)
                data['production'] = self.snapshot()
                if self.settings['emergency'] or self.settings['scene'] != 'talk':
                    data['highlight'] = None; data['ranking'] = []; data['donor_ranking'] = []; data['like_ranking'] = []
                return jsonify(self.sanitize(data))

        @app.route('/production/preflight')
        def preflight():
            return jsonify(server=True, tiktok=self.r.state['connected'], archive=self.r.archive is not None,
                           likes_known=self.r.state['likes_known'], viewers_known=self.r.state['viewers_known'],
                           emergency=self.settings['emergency'], scene=self.settings['scene'])
