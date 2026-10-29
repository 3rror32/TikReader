"""Explicit, bounded loopback bridge for a local Bedrock world."""
import atexit
import ipaddress
import json
import logging
import math
import secrets
import threading
from http import HTTPStatus
from uuid import uuid4

from websockets.exceptions import ConnectionClosed
from websockets.sync.server import serve


class BedrockBridge:
    def __init__(self, on_change):
        self.on_change = on_change
        self.lock = threading.RLock()
        self.server = self.connection = None
        self.generation = 0
        self.pending = {}
        self.token = ''
        self.reserved = False
        # Handshake diagnostics may contain the secret URL; never propagate them.
        self.logger = logging.getLogger('minecraft_bedrock.transport')
        self.logger.handlers = [logging.NullHandler()]
        self.logger.propagate = False
        atexit.register(self.close)

    def snapshot(self):
        with self.lock:
            return {'prepared': self.server is not None, 'connected': self.connection is not None}

    def _fail_pending(self):
        for item in self.pending.values():
            item['error'] = OSError('La conexión local de Bedrock terminó')
            item['event'].set()
        self.pending.clear()

    def prepare(self):
        self.close()
        token = secrets.token_urlsafe(32)

        def admit(connection, request):
            try:
                local = ipaddress.ip_address(connection.remote_address[0]).is_loopback
                encrypted = any('com.microsoft.minecraft.wsencrypt' in value
                                for value in request.headers.get_all('Sec-WebSocket-Protocol'))
                with self.lock:
                    if (not local or request.headers.get_all('Origin') or
                            not secrets.compare_digest(request.path, '/'+token) or self.token != token):
                        return connection.respond(HTTPStatus.FORBIDDEN, 'Conexión local no autorizada')
                    if encrypted:
                        return connection.respond(HTTPStatus.BAD_REQUEST, 'Desactiva Require Encrypted Websockets')
                    if self.reserved or self.connection is not None:
                        return connection.respond(HTTPStatus.CONFLICT, 'Ya hay un mundo conectado')
                    self.reserved = True
            except (ValueError, TypeError, IndexError):
                return connection.respond(HTTPStatus.FORBIDDEN, 'Conexión local no autorizada')

        def response(connection, request, result):
            if result.status_code != 101:
                with self.lock:
                    # Only the admitted handshake may release its reservation.
                    if self.token == token and getattr(connection, '_bedrock_admitted', False):
                        self.reserved = False
            return result

        def handshake(connection, request):
            result = admit(connection, request)
            if result is None:
                connection._bedrock_admitted = True
            return result

        with self.lock:
            self.token = token
            try:
                self.server = serve(lambda ws: self._receive(ws, token), '127.0.0.1', 0,
                                    origins=[None], process_request=handshake, process_response=response,
                                    compression=None, max_size=65536, max_queue=4,
                                    open_timeout=3, close_timeout=1, ping_interval=20, ping_timeout=5,
                                    logger=self.logger)
                server = self.server
            except Exception:
                self.token = ''
                self.server = None
                raise OSError('No se pudo preparar la conexión local de Bedrock') from None
        threading.Thread(target=server.serve_forever, daemon=True).start()
        return f'/wsserver ws://127.0.0.1:{server.socket.getsockname()[1]}/{token}'

    def _receive(self, ws, token):
        with self.lock:
            if self.token != token or self.connection is not None:
                ws.close()
                return
            self.reserved = False
            self.connection = ws
            self.generation += 1
            generation = self.generation
        self.on_change()
        try:
            for raw in ws:
                try:
                    packet = json.loads(raw)
                    if not isinstance(packet, dict):
                        continue
                    header, body = packet.get('header'), packet.get('body')
                    if not isinstance(header, dict) or not isinstance(body, dict):
                        continue
                    if header.get('messagePurpose') not in ('commandResponse', 'error'):
                        continue
                    request_id = header.get('requestId')
                    if not isinstance(request_id, str):
                        continue
                    with self.lock:
                        item = self.pending.get(request_id)
                        if (self.connection is not ws or self.generation != generation or
                                not item or item['generation'] != generation or 'result' in item):
                            continue
                        code = body.get('statusCode')
                        numeric = type(code) in (int, float) and math.isfinite(code)
                        outcome = 'unconfirmed'
                        if numeric and code < 0:
                            outcome = 'rejected'
                        elif numeric and code == 0 and header['messagePurpose'] == 'commandResponse':
                            outcome = 'success'
                        message = body.get('statusMessage', '')
                        item['result'] = {'outcome': outcome,
                                          'response': message[:500] if isinstance(message, str) else ''}
                        item['event'].set()
                except (ValueError, TypeError, OverflowError):
                    continue
        except ConnectionClosed:
            pass
        finally:
            with self.lock:
                changed = self.connection is ws
                if changed:
                    self.connection = None
                    self.generation += 1
                    self._fail_pending()
            if changed:
                self.on_change()

    def execute(self, command, timeout=3, expected_generation=None):
        request_id = str(uuid4())
        with self.lock:
            ws = self.connection
            if ws is None:
                raise OSError('Conecta tu mundo local de Bedrock primero')
            if expected_generation is not None and expected_generation != self.generation:
                raise OSError('La conexión de Bedrock cambió')
            if self.pending:
                raise OSError('Bedrock está esperando otra respuesta')
            item = {'generation': self.generation, 'event': threading.Event()}
            self.pending[request_id] = item
        packet = {'header': {'version': 1, 'requestId': request_id, 'messagePurpose': 'commandRequest',
                             'messageType': 'commandRequest'},
                  'body': {'version': 1, 'commandLine': command.lstrip('/'), 'origin': {'type': 'player'}}}
        try:
            ws.send(json.dumps(packet))
            if not item['event'].wait(timeout):
                raise TimeoutError('Bedrock no confirmó el comando; no se reintentó')
            if 'error' in item:
                raise item['error']
            with self.lock:
                if self.connection is not ws or self.generation != item['generation']:
                    raise OSError('La conexión de Bedrock cambió')
            return item['result']
        except ConnectionClosed:
            raise OSError('La conexión local de Bedrock terminó') from None
        finally:
            with self.lock:
                self.pending.pop(request_id, None)

    def close(self):
        with self.lock:
            server, ws = self.server, self.connection
            changed = server is not None or ws is not None
            self.server = self.connection = None
            self.token = ''
            self.reserved = False
            if changed:
                self.generation += 1
                self._fail_pending()
        if ws is not None:
            ws.close()
        if server is not None:
            server.shutdown()
        if changed:
            self.on_change()
