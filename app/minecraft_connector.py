"""Bounded Minecraft Java RCON connector with named, allowlisted commands."""
import ipaddress
import logging
import queue
import re
import socket
import struct
import threading
import time
from flask import jsonify, request
from minecraft_bedrock import BedrockBridge

logger = logging.getLogger(__name__)

class MinecraftConnector:
    def __init__(self, app, runtime):
        self.r = runtime
        self.config = {'host': '127.0.0.1', 'port': 25575, 'commands': {}}
        self.edition = 'java'
        self.profiles = {'java': self.config, 'bedrock': {'commands': {}}}
        self.password = ''
        self.authorized = False
        self.authorized_generation = None
        self.jobs = queue.Queue(maxsize=30)
        self.log = []
        self.revision = 0
        self.lock = threading.RLock()
        self.control_lock = threading.RLock()
        self.bedrock = BedrockBridge(self._bedrock_changed)
        threading.Thread(target=self.worker, daemon=True).start()
        self.register(app)

    def restore(self):
        saved = self.r.archive.settings().get('minecraft_config', {}) if self.r.archive else {}
        if isinstance(saved, dict):
            try:
                if 'profiles' in saved:
                    edition = saved.get('edition', 'java')
                    if edition not in ('java', 'bedrock') or not isinstance(saved['profiles'], dict):
                        raise ValueError('Edición inválida')
                    profiles = {key: self.validate({**saved['profiles'].get(key, {}), 'edition': key})
                                for key in ('java', 'bedrock')}
                    self.profiles, self.edition = profiles, edition
                    self.config = profiles[edition]
                else:
                    self.config = self.validate(saved)
                    self.profiles['java'] = self.config
                    self.edition = 'java'
            except (TypeError, ValueError):
                pass

    def _bedrock_changed(self):
        with self.lock:
            self.authorized = False
            self.authorized_generation = None
            self.revision += 1

    def snapshot(self):
        return dict(config=self.config, edition=self.edition, profiles=self.profiles,
                    authorized=self.authorized_now(), queued=self.jobs.qsize(), log=self.log,
                    bedrock=self.bedrock.snapshot())

    def authorized_now(self):
        return self.authorized and (self.edition == 'java' or
                                    self.authorized_generation == self.bedrock.generation)

    @staticmethod
    def validate(data):
        if not isinstance(data, dict):raise ValueError('Configuración inválida')
        edition = data.get('edition', 'java')
        if edition not in ('java', 'bedrock'):
            raise ValueError('Edición inválida')
        host = str(data.get('host', '127.0.0.1')).strip()
        if edition == 'bedrock' and host not in ('127.0.0.1', 'localhost'):
            raise ValueError('Bedrock solo admite mundos de este equipo')
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
        return {'commands': clean} if edition == 'bedrock' else {'host': host, 'port': port, 'commands': clean}

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
        if not self.authorized_now() or alias not in self.config['commands'] or self.r.production.settings['emergency'] or self.r.production.settings.get('scene','talk') != 'talk':
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

    @staticmethod
    def response_outcome(command, response):
        # RCON has no success flag. Recognize narrow vanilla feedback only;
        # localized, plugin-defined, empty or mixed feedback stays unconfirmed.
        text = response.strip()
        if re.match(r'^(?:Unknown or incomplete command|Unknown command|Incorrect argument for command|'
                    r'No player was found|No entity was found|'
                    r'No targets matched selector|You do not have permission)(?:[\s.,:]|$)', text):
            return 'rejected'
        verb = command.strip().split(maxsplit=1)[0] if command.strip() else ''
        patterns = {
            'list': r'There are \d+ of a max of \d+ players online: ?[^\r\n]*',
            'summon': r'Summoned new [^\r\n]+',
            'give': r'Gave \d+ \[[^\r\n]+\] to [^\r\n]+',
            'weather': r'Set the weather to (?:clear|rain|thunder)',
        }
        if verb in patterns and re.fullmatch(patterns[verb], text):
            return 'success'
        return 'unconfirmed'

    def note(self, text, **details):
        self.log.insert(0, {'at': time.time(), 'text': text, **details})
        del self.log[50:]

    def run_job(self, job):
        alias, command, created, session, revision = job
        try:
            with self.lock:
                if not self.authorized_now() or revision != self.revision or session != getattr(self.r,'feed_session',None) or time.monotonic()-created > 10:
                    self.note('Minecraft: acción cancelada o caducada', alias=alias, outcome='cancelled', response='')
                    return
                elif self.r.production.settings['emergency'] or self.r.production.settings.get('scene','talk') != 'talk':
                    self.note('Minecraft: acción cancelada por emergencia', alias=alias, outcome='cancelled', response='')
                    return
                edition = self.edition
                generation = self.authorized_generation
                if edition == 'java':
                    response = self.execute(command)
                    outcome = self.response_outcome(command, response)
            if edition == 'bedrock':
                result = self.bedrock.execute(command, expected_generation=generation)
                response, outcome = result['response'], result['outcome']
            with self.lock:
                if revision != self.revision:
                    self.note('Minecraft: conexión o configuración cambiada', alias=alias, outcome='cancelled', response='')
                else:
                    labels = {'success': 'Éxito confirmado', 'rejected': 'Comando rechazado', 'unconfirmed': 'Sin confirmar'}
                    self.note(f'{labels[outcome]} · {alias}: {response or "sin respuesta"}',
                              alias=alias, outcome=outcome, response=response)
        except Exception as exc:
            logger.exception('Minecraft execution failed for alias %s', alias)
            outcome = 'connection_error' if isinstance(exc, OSError) else 'unconfirmed'
            self.note(f'Minecraft no confirmó {alias}: {type(exc).__name__}',
                      alias=alias, outcome=outcome, response='')

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
                    if not isinstance(data, dict):raise ValueError('Configuración inválida')
                    edition = data.get('edition', 'java')
                    if edition not in ('java', 'bedrock'):raise ValueError('Edición inválida')
                    config = self.profiles[edition] if data.get('select_only') is True else self.validate(data)
                except (TypeError, ValueError) as exc:
                    return jsonify(error=str(exc)), 400
                with self.control_lock:
                    self.bedrock.close()
                    with self.lock:
                        self.authorized = False
                        self.authorized_generation = None
                        self.revision += 1
                        self.profiles[self.edition] = self.config
                        if edition != self.edition:self.password = ''
                        self.profiles[edition] = config
                        self.edition, self.config = edition, config
                        if edition == 'java' and 'password' in data:
                            self.password = str(data['password'])[:200]
                    if self.r.archive:
                        self.r.archive.set_setting('minecraft_config', {'edition': self.edition, 'profiles': self.profiles})
            return jsonify(self.snapshot())

        @app.post('/minecraft/bedrock/prepare')
        def minecraft_bedrock_prepare():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            with self.control_lock:
                if self.edition != 'bedrock':return jsonify(error='Selecciona Bedrock primero'),409
                self._bedrock_changed()
                try:
                    return jsonify(command=self.bedrock.prepare())
                except OSError:
                    return jsonify(error='No se pudo preparar Bedrock. Desconecta y vuelve a preparar.'),502

        @app.post('/minecraft/authorize')
        def minecraft_authorize():
            if not self.r.production.local():
                return jsonify(error='Solo disponible desde este equipo'), 403
            data = request.get_json(silent=True) or {}
            if not isinstance(data, dict):return jsonify(error='Datos inválidos'),400
            if data.get('confirmation') != 'AUTORIZAR MINECRAFT' or (self.edition == 'java' and not self.password):
                return jsonify(error='Guarda la contraseña y escribe AUTORIZAR MINECRAFT'), 400
            try:
                revision = self.revision
                edition = self.edition
                generation = self.bedrock.generation
                result = self.bedrock.execute('list', expected_generation=generation) if edition == 'bedrock' else self.execute('list')
            except Exception as exc:
                self.authorized = False
                return jsonify(error=f'No se pudo autorizar Minecraft: {type(exc).__name__}'), 400
            if revision != self.revision:return jsonify(error='La configuración cambió. Autoriza de nuevo.'),409
            with self.lock:
                if revision != self.revision:return jsonify(error='La conexión cambió. Autoriza de nuevo.'),409
                if edition == 'bedrock' and (result['outcome'] != 'success' or not self.bedrock.snapshot()['connected'] or generation != self.bedrock.generation):
                    return jsonify(error='Bedrock no confirmó la consulta de jugadores. Revisa la conexión y los permisos.'),400
                self.authorized = True
                self.authorized_generation = generation if edition == 'bedrock' else None
            self.note('Minecraft autorizado: '+edition)
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
            with self.control_lock:
                self.bedrock.close()
                self._bedrock_changed()
                self.password = ''
            return jsonify(ok=True)

        @app.post('/minecraft/check')
        def check_connection():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            if self.edition == 'java' and not self.password:return jsonify(error='Guarda la contraseña RCON primero'),409
            try:
                if self.edition == 'bedrock':
                    result = self.bedrock.execute('list')
                    if result['outcome'] != 'success':return jsonify(error='Bedrock no confirmó la consulta de jugadores.'),502
                else:self.execute('list')
                return jsonify(ok=True,detail='Minecraft respondió a la consulta de jugadores.')
            except (OSError,PermissionError) as exc:
                return jsonify(error=f'Minecraft no confirmó la conexión: {type(exc).__name__}'),502
