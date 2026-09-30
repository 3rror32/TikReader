"""Bounded Minecraft Java RCON connector with named, allowlisted commands."""
import ipaddress
import queue
import socket
import struct
import threading
import time
from flask import jsonify, request


class MinecraftConnector:
    def __init__(self, app, runtime):
        self.r = runtime
        self.config = {'host': '127.0.0.1', 'port': 25575, 'commands': {}}
        self.password = ''
        self.authorized = False
        self.jobs = queue.Queue(maxsize=30)
        self.log = []
        self.revision = 0
        self.lock = threading.RLock()
        threading.Thread(target=self.worker, daemon=True).start()
        self.register(app)

    def restore(self):
        saved = self.r.archive.settings().get('minecraft_config', {}) if self.r.archive else {}
        if isinstance(saved, dict):
            try:
                self.config = self.validate(saved)
            except (TypeError, ValueError):
                pass

    @staticmethod
    def validate(data):
        if not isinstance(data, dict):raise ValueError('Configuración inválida')
        host = str(data.get('host', '127.0.0.1')).strip()
        if host != 'localhost':
            try:
                address = ipaddress.ip_address(host)
            except ValueError as exc:
                raise ValueError('Usa localhost o una dirección IP privada') from exc
            if not (address.is_private or address.is_loopback):
                raise ValueError('RCON solo puede conectarse a una red privada')
        port = int(data.get('port', 25575))
        if not 1 <= port <= 65535:
            raise ValueError('Puerto inválido')
        commands = data.get('commands', {})
        if not isinstance(commands, dict) or len(commands) > 50:
            raise ValueError('Máximo 50 comandos')
        clean = {}
        for name, command in commands.items():
            name, command = str(name).strip()[:50], str(command).strip()[:300]
            if not name or not command or any(x in command for x in ('\n', '\r', '\x00')):
                raise ValueError('Comando inválido')
            clean[name] = command.lstrip('/')
        return {'host': host, 'port': port, 'commands': clean}

    @staticmethod
    def packet(request_id, kind, payload):
        body = struct.pack('<ii', request_id, kind) + payload.encode('utf-8') + b'\0\0'
        return struct.pack('<i', len(body)) + body

    @staticmethod
    def receive(sock):
        size_raw = b''
        while len(size_raw) < 4:
            chunk = sock.recv(4-len(size_raw))
            if not chunk:raise OSError('Respuesta RCON incompleta')
            size_raw += chunk
        size = struct.unpack('<i', size_raw)[0]
        if not 10 <= size <= 1024*1024:
            raise OSError('Respuesta RCON inválida')
        data = b''
        while len(data) < size:
            chunk = sock.recv(size-len(data))
            if not chunk:
                raise OSError('Conexión RCON cerrada')
            data += chunk
        request_id, kind = struct.unpack('<ii', data[:8])
        if data[-2:] != b'\0\0':raise OSError('Terminador RCON inválido')
        return request_id, kind, data[8:-2].decode('utf-8', 'replace')

    def execute(self, command):
        config, password = dict(self.config), self.password
        with socket.create_connection((config['host'], config['port']), timeout=3) as sock:
            sock.settimeout(3)
            sock.sendall(self.packet(10, 3, password))
            auth_id, kind, _ = self.receive(sock)
            if kind == 0:
                auth_id, kind, _ = self.receive(sock)
            if auth_id == -1:
                raise PermissionError('Contraseña RCON rechazada')
            if auth_id != 10 or kind != 2:raise OSError('Autenticación RCON inesperada')
            sock.sendall(self.packet(11, 2, command))
            response_id, kind, response = self.receive(sock)
            if response_id != 11 or kind != 0:
                raise OSError('Respuesta RCON inesperada')
            return response[:500]

    def enqueue(self, alias, context=None):
        if not self.authorized or alias not in self.config['commands'] or self.r.production.settings['emergency'] or self.r.production.settings.get('scene','talk') != 'talk':
            self.note('Minecraft bloqueado: conector o alias no autorizado')
            return False
        command = self.config['commands'][alias]
        values = {k: str(v).replace('\n', ' ').replace('\r', ' ').replace('\x00','')[:80] for k,v in (context or {}).items()}
        for key in ('user', 'gift', 'count'):
            command = command.replace('{'+key+'}', values.get(key, ''))
        try:
            self.jobs.put_nowait((alias, command, time.monotonic(),getattr(self.r,'feed_session',None),self.revision))
            return True
        except queue.Full:
            self.note('Minecraft: cola llena')
            return False

    def note(self, text):
        self.log.insert(0, {'at': time.time(), 'text': text})
        del self.log[50:]

    def run_job(self, job):
        alias, command, created, session, revision = job
        with self.lock:
            try:
                if not self.authorized or revision != self.revision or session != getattr(self.r,'feed_session',None) or time.monotonic()-created > 10:
                    self.note('Minecraft: acción cancelada o caducada')
                elif self.r.production.settings['emergency'] or self.r.production.settings.get('scene','talk') != 'talk':
                    self.note('Minecraft: acción cancelada por emergencia')
                else:
                    response = self.execute(command)
                    self.note(f'Minecraft aceptó {alias}: {response or "sin respuesta"}')
            except Exception as exc:
                self.note(f'Minecraft no confirmó {alias}: {type(exc).__name__}')

    def worker(self):
        while True:
            job = self.jobs.get()
            try:self.run_job(job)
            finally:self.jobs.task_done()

    def register(self, app):
        @app.route('/minecraft', methods=['GET', 'POST'])
        def minecraft():
            if request.method == 'POST':
                if not self.r.production.local():
                    return jsonify(error='Solo disponible desde este equipo'), 403
                data = request.get_json(silent=True) or {}
                try:
                    config = self.validate(data)
                except (TypeError, ValueError) as exc:
                    return jsonify(error=str(exc)), 400
                self.authorized = False
                self.revision += 1
                self.config = config
                if self.r.archive:
                    self.r.archive.set_setting('minecraft_config', config)
                if 'password' in data:
                    self.password = str(data['password'])[:200]
                    self.authorized = False
            return jsonify(config=self.config, authorized=self.authorized, queued=self.jobs.qsize(), log=self.log)

        @app.post('/minecraft/authorize')
        def minecraft_authorize():
            if not self.r.production.local():
                return jsonify(error='Solo disponible desde este equipo'), 403
            data = request.get_json(silent=True) or {}
            if not isinstance(data, dict):return jsonify(error='Datos inválidos'),400
            if data.get('confirmation') != 'AUTORIZAR MINECRAFT' or not self.password:
                return jsonify(error='Guarda la contraseña y escribe AUTORIZAR MINECRAFT'), 400
            try:
                revision = self.revision
                self.execute('list')
            except Exception as exc:
                self.authorized = False
                return jsonify(error=f'No se pudo autorizar RCON: {type(exc).__name__}'), 400
            if revision != self.revision:return jsonify(error='La configuración cambió. Autoriza de nuevo.'),409
            self.authorized = True
            self.note('Minecraft RCON autorizado')
            return jsonify(ok=True)

        @app.post('/minecraft/run')
        def run_command():
            if not self.r.production.local():
                return jsonify(error='Solo disponible desde este equipo'), 403
            data=request.get_json(silent=True)
            if not isinstance(data,dict):return jsonify(error='Datos inválidos'),400
            alias = str(data.get('alias', ''))
            if not self.enqueue(alias, {'user': 'prueba', 'gift': 'Rosa', 'count': '1'}):
                return jsonify(error='Conector o comando no autorizado'), 409
            return jsonify(ok=True)

        @app.post('/minecraft/disconnect')
        def minecraft_disconnect():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            self.authorized = False
            self.revision += 1
            self.password = ''
            return jsonify(ok=True)

        @app.post('/minecraft/check')
        def check_connection():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            if not self.password:return jsonify(error='Guarda la contraseña RCON primero'),409
            try:
                self.execute('list')
                return jsonify(ok=True,detail='RCON respondió a la consulta de jugadores.')
            except (OSError,PermissionError) as exc:
                return jsonify(error=f'RCON no confirmó la conexión: {type(exc).__name__}'),502
