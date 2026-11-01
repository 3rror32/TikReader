"""Bounded Minecraft Java RCON connector with named, allowlisted commands."""
import ipaddress
import logging
import queue
import re
import socket
import struct
import threading
import time
from collections import OrderedDict, deque
from flask import jsonify, request
from minecraft_bedrock import BedrockBridge
from minecraft_presets import PresetJob, catalog, categories, sections, commands_for, announcement_for, mappings, limits, name_format, donor_name, command_cost, is_spawn

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
        self.preset_lock = threading.RLock()
        self.preset_generation = 0
        self.final_gifts = OrderedDict()
        self.preset_owner = None
        self.running_presets = set()
        self.preset_usage = deque()
        self.last_preset_at = None
        self.admission_reason = ''
        self.checked_generation = None
        self.connection_check = 'idle'
        self.bedrock = BedrockBridge(self._bedrock_transport_changed)
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
        # Revocation must never wait for a command's network execution lock.
        with self.preset_lock:
            self.authorized = False
            self.authorized_generation = None
            self.connection_check = 'idle'
            self.revision += 1
            self.preset_generation += 1

    def _bedrock_transport_changed(self):
        self._bedrock_changed()
        with self.preset_lock:
            generation = self.bedrock.generation
            if (self.edition != 'bedrock' or not self.bedrock.snapshot()['connected'] or
                    self.checked_generation == generation):
                return
            self.checked_generation = generation
            self.connection_check = 'checking'
            revision = self.revision
        # The receive callback must return before command responses can arrive.
        threading.Thread(target=self._check_bedrock, args=(generation, revision), daemon=True).start()

    def _check_bedrock(self, generation, revision):
        try:
            success = self.bedrock.execute('list', expected_generation=generation)['outcome'] == 'success'
        except Exception:
            success = False
        with self.preset_lock:
            if (self.edition != 'bedrock' or revision != self.revision or
                    generation != self.bedrock.generation or not self.bedrock.snapshot()['connected']):
                return
            self.connection_check = 'ready' if success else 'failed'
            self.authorized = success
            self.authorized_generation = generation if success else None
            self.note('Minecraft conectado: bedrock' if success else
                      'No se pudo comprobar Bedrock. Desconecta, prepara otra conexión y pega el nuevo comando.')

    def snapshot(self):
        return dict(config=self.config, edition=self.edition, profiles=self.profiles,
                    authorized=self.authorized_now(), queued=self.jobs.qsize(), log=self.log,
                    bedrock=self.bedrock.snapshot(), presets=mappings(self.config.get('presets')),
                    preset_catalog=catalog(), preset_categories=categories(), preset_sections=sections(), authorization_mode='automatic',
                    connection_check=self.connection_check,
                    limits=limits(self.config.get('limits')), name_format=self.config.get('name_format', 'modern'))

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
        config = {'commands': clean} if edition == 'bedrock' else {'host': host, 'port': port, 'commands': clean}
        if 'presets' in data:config['presets'] = mappings(data['presets'])
        if 'limits' in data:config['limits'] = limits(data['limits'])
        if 'name_format' in data:config['name_format'] = name_format(data['name_format'])
        return config

    def _persist(self):
        if self.r.archive:
            self.r.archive.set_setting('minecraft_config', {'edition': self.edition, 'profiles': self.profiles})

    def gift(self, record, event_id):
        if record.get('ongoing'):
            return
        identity = (getattr(self.r, 'feed_session', None), str(record.get('id') or event_id))
        with self.preset_lock:
            if identity in self.final_gifts:return
            self.final_gifts[identity] = True
            while len(self.final_gifts) > 1000:self.final_gifts.popitem(last=False)
            selected = self.matching_presets(str(record.get('gift_id', '')))
            if selected:
                self.admit_presets(selected, record.get('user'), automatic=True, gift_count=record.get('count', 1))

    def matching_presets(self, gift_id):
        return tuple(key for key, row in mappings(self.config.get('presets')).items()
                     if row['enabled'] and row['gift_id'] == gift_id)

    def enqueue_preset(self, preset_id, automatic=False):
        command_cost(preset_id, None, 1)  # Validate IDs without building commands.
        return self.admit_presets((preset_id,), 'Prueba', automatic)

    def admit_presets(self, selected, donor, automatic=False, gift_count=1):
        with self.preset_lock:
            now = time.monotonic()
            settings = limits(self.config.get('limits'))
            # The general simulator may drain pending queue items and call task_done.
            with self.jobs.mutex:
                abandoned = self.jobs.unfinished_tasks == 0
            if abandoned and not self.running_presets:
                self.finish_reservation(self.preset_owner, now)
                self.preset_owner = None
            self.preset_usage = deque(entry for entry in self.preset_usage
                                      if entry['finished'] is None or now - entry['finished'] < 60)
            if type(gift_count) is not int or not 1 <= gift_count <= 1_000_000:
                self.admission_reason = 'Cantidad de regalos inválida. Activación descartada.'
                self.note(self.admission_reason, outcome='cancelled', alias='regalo', response='')
                return False
            rows = mappings(self.config.get('presets'))
            cost = sum(command_cost(key, rows[key].get('quantity'), gift_count) for key in selected)
            reason = ''
            if not selected:reason = 'No hay acciones activas para este regalo.'
            elif (not self.authorized_now() or self.r.production.settings['emergency'] or
                  self.r.production.settings.get('scene', 'talk') != 'talk'):
                reason = 'Conecta Minecraft y revisa la escena y la pausa.'
            elif automatic and any(not rows[key]['enabled'] or not rows[key]['gift_id'] for key in selected):
                reason = 'La acción ya no está activa.'
            elif self.preset_owner is not None or not self.jobs.empty():
                reason = 'Hay una acción pendiente o en ejecución. Regalo descartado.'
            elif self.last_preset_at is not None and now - self.last_preset_at < settings['interval']:
                reason = 'Espera el intervalo mínimo. Regalo descartado.'
            elif sum(entry['cost'] for entry in self.preset_usage) + cost > settings['per_minute']:
                reason = 'Límite de efectos por minuto alcanzado. Regalo descartado.'
            if reason:
                self.admission_reason = reason
                self.note(reason, outcome='cancelled', alias='regalo', response='')
                return False
            commands, labels = [], []
            for key in selected:
                sequence = commands_for(key, self.edition, donor, self.config.get('name_format', 'modern'),
                                        quantity=rows[key].get('quantity'))
                repeats = gift_count if is_spawn(key) else 1
                commands.extend(sequence * repeats)
                labels.extend([key] * (len(sequence) * repeats))
            owner = object()
            job = PresetJob(selected[0], tuple(commands), now, getattr(self.r, 'feed_session', None),
                            self.revision, self.edition, self.preset_generation,
                            self.authorized_generation, automatic, tuple(selected), donor_name(donor),
                            owner, tuple(labels), gift_count,
                            tuple((key, rows[key].get('quantity', 1)) for key in selected),
                            tuple(announcement_for(key, self.edition, donor,
                                                   quantity=rows[key].get('quantity'),
                                                   gift_count=gift_count) for key in selected))
            try:
                self.jobs.put_nowait(job)
            except queue.Full:
                self.admission_reason = 'Cola llena. Regalo descartado.'
                self.note(self.admission_reason, outcome='cancelled', alias='regalo', response='')
                return False
            self.preset_owner = owner
            self.preset_usage.append({'owner': owner, 'cost': cost, 'finished': None})
            self.last_preset_at = now
            self.admission_reason = ''
            return True

    def finish_reservation(self, owner, now):
        # Caller holds preset_lock. Pending/running costs cannot expire before completion.
        for entry in self.preset_usage:
            if entry['owner'] is owner and entry['finished'] is None:
                entry['finished'] = now
                break

    def _preset_valid(self, job):
        with self.preset_lock:
            rows = mappings(self.config.get('presets'))
            enabled = all(rows[key]['enabled'] and rows[key]['gift_id'] for key in (job.selected_ids or (job.preset_id,)))
            return (job.admission_id is self.preset_owner and self.authorized_now() and job.edition == self.edition and
                    job.revision == self.revision and job.preset_generation == self.preset_generation and
                    job.session == getattr(self.r, 'feed_session', None) and time.monotonic()-job.created <= 10 and
                    not self.r.production.settings['emergency'] and
                    self.r.production.settings.get('scene', 'talk') == 'talk' and
                    (not job.automatic or enabled) and
                    (job.edition == 'java' or job.transport_generation == self.bedrock.generation))

    def run_preset(self, job):
        with self.preset_lock:
            self.running_presets.add(job.admission_id)
        try:
            self._run_preset(job)
        finally:
            with self.preset_lock:
                self.running_presets.discard(job.admission_id)
                self.finish_reservation(job.admission_id, time.monotonic())
                if self.preset_owner is job.admission_id:
                    self.preset_owner = None

    def _run_preset(self, job):
        all_actions_confirmed = True
        for step, command in enumerate(job.commands, 1):
            alias = job.command_labels[step-1] if job.command_labels else job.preset_id
            if not self._preset_valid(job):
                self.note(f'Acción rápida cancelada antes del paso {step}/{len(job.commands)}',
                          alias=job.preset_id, outcome='cancelled', response='')
                return
            try:
                if job.edition == 'java':
                    with self.lock:
                        if not self._preset_valid(job):
                            self.note('Acción rápida cancelada antes de ejecutar', alias=job.preset_id,
                                      outcome='cancelled', response='')
                            return
                        response = self.execute(command)
                        outcome = self.response_outcome(command, response)
                else:
                    result = self.bedrock.execute(command, expected_generation=job.transport_generation)
                    response, outcome = result['response'], result['outcome']
                label = {'success': 'Éxito confirmado', 'rejected': 'Comando rechazado',
                         'unconfirmed': 'Sin confirmar'}[outcome]
                self.note(f'{label} · {alias} · {job.donor} · paso {step}/{len(job.commands)}: {response or "sin respuesta"}',
                          alias=alias, outcome=outcome, response=response,
                          step=step, total=len(job.commands), donor=job.donor)
                if outcome == 'rejected':return
                all_actions_confirmed = all_actions_confirmed and outcome == 'success'
            except Exception as exc:
                self.note(f'Acción rápida sin confirmar · paso {step}/{len(job.commands)}: {type(exc).__name__}',
                          alias=job.preset_id, outcome='connection_error' if isinstance(exc, OSError) else 'unconfirmed', response='')
                return
        if not all_actions_confirmed:
            return
        for index, command in enumerate(job.announcements):
            alias = job.selected_ids[index] if index < len(job.selected_ids) else job.preset_id
            if not self._preset_valid(job):
                return
            try:
                if job.edition == 'java':
                    with self.lock:
                        if not self._preset_valid(job):return
                        response = self.execute(command)
                    # RCON does not provide a bounded success signal for tellraw.
                    self.note(f'Anuncio de entrega enviado · {alias} · {job.donor}',
                              alias=alias, outcome='unconfirmed', response=response,
                              donor=job.donor, announcement=True)
                else:
                    result = self.bedrock.execute(command, expected_generation=job.transport_generation)
                    self.note(f'Anuncio de entrega · {alias} · {job.donor}: {result["response"] or "sin respuesta"}',
                              alias=alias, outcome=result['outcome'], response=result['response'],
                              donor=job.donor, announcement=True)
            except Exception as exc:
                self.note(f'Anuncio de entrega sin confirmar · {alias} · {type(exc).__name__}',
                          alias=alias, outcome='connection_error' if isinstance(exc, OSError) else 'unconfirmed',
                          response='', donor=job.donor, announcement=True)

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
        if verb == 'execute' and re.match(r'^execute\s+at\s+@p\s+run\s+summon\s+', command):
            verb = 'summon'
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
        if isinstance(job, PresetJob):
            self.run_preset(job)
            return
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
                    if 'presets' in data:
                        config['presets'] = mappings(data['presets'], self.profiles[edition].get('presets'))
                    for key in ('presets', 'limits', 'name_format'):
                        if key not in config and key in self.profiles[edition]:
                            config[key] = self.profiles[edition][key]
                except (TypeError, ValueError) as exc:
                    return jsonify(error=str(exc)), 400
                with self.control_lock:
                    self.bedrock.close()
                    with self.lock:
                        with self.preset_lock:
                            self.authorized = False
                            self.authorized_generation = None
                            self.revision += 1
                            self.preset_generation += 1
                            self.profiles[self.edition] = self.config
                            if edition != self.edition:self.password = ''
                            self.profiles[edition] = config
                            self.edition, self.config = edition, config
                        if edition == 'java' and 'password' in data:
                            self.password = str(data['password'])[:200]
                    if self.r.archive:
                        self.r.archive.set_setting('minecraft_config', {'edition': self.edition, 'profiles': self.profiles})
            return jsonify(self.snapshot())

        @app.post('/minecraft/presets')
        def minecraft_presets():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            data = request.get_json(silent=True)
            try:
                if not isinstance(data, dict) or set(data) != {'edition', 'presets'}:
                    raise ValueError('Configuración de acciones inválida')
                with self.preset_lock:
                    if data['edition'] != self.edition:return jsonify(error='La edición cambió. Actualiza antes de guardar.'),409
                    self.config['presets'] = mappings(data['presets'], self.config.get('presets'))
                    self.profiles[self.edition] = self.config
                    self.preset_generation += 1
                self._persist()
                return jsonify(self.snapshot())
            except (TypeError, ValueError) as exc:return jsonify(error=str(exc)),400

        @app.post('/minecraft/presets/test')
        def minecraft_preset_test():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            data = request.get_json(silent=True)
            if not isinstance(data, dict) or set(data) != {'edition', 'id'}:return jsonify(error='Acción inválida'),400
            with self.preset_lock:
                if data['edition'] != self.edition:return jsonify(error='La edición cambió'),409
                try:accepted = self.enqueue_preset(data['id'])
                except (TypeError, ValueError):return jsonify(error='Acción inválida'),400
            if not accepted:return jsonify(error=self.admission_reason),409
            return jsonify(ok=True)

        @app.post('/minecraft/presets/simulate')
        def minecraft_simulate():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            data = request.get_json(silent=True)
            if (not isinstance(data, dict) or set(data) != {'edition', 'gift_id', 'user'} or
                    not isinstance(data['gift_id'], str) or not 1 <= len(data['gift_id'].strip()) <= 100 or
                    not isinstance(data['user'], str) or not 1 <= len(data['user'].strip()) <= 200):
                return jsonify(error='Selecciona un regalo y un nombre de hasta 200 caracteres'),400
            with self.preset_lock:
                if data['edition'] != self.edition:return jsonify(error='La edición cambió'),409
                selected = self.matching_presets(data['gift_id'])
                if not selected:return jsonify(accepted=False, detail='No hay acciones activas para este regalo.')
                accepted = self.admit_presets(selected, donor_name(data['user'], 'Prueba'), automatic=True)
                if not accepted:return jsonify(error=self.admission_reason),409
            return jsonify(accepted=True, detail='Simulación admitida. Revisa el registro.')

        @app.post('/minecraft/presets/settings')
        def minecraft_preset_settings():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            data = request.get_json(silent=True)
            try:
                if not isinstance(data, dict) or set(data) != {'edition', 'limits', 'name_format'}:
                    raise ValueError('Configuración inválida')
                clean, style = limits(data['limits']), name_format(data['name_format'])
                with self.preset_lock:
                    if data['edition'] != self.edition:return jsonify(error='La edición cambió'),409
                    self.config.update(limits=clean, name_format=style)
                    self.preset_generation += 1
                self._persist()
                return jsonify(self.snapshot())
            except (TypeError, ValueError) as exc:return jsonify(error=str(exc)),400

        @app.post('/minecraft/presets/stop')
        def minecraft_presets_stop():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            data = request.get_json(silent=True)
            if not isinstance(data, dict) or set(data) != {'edition'}:return jsonify(error='Edición inválida'),400
            with self.preset_lock:
                if data['edition'] != self.edition:return jsonify(error='La edición cambió'),409
                self.preset_generation += 1
            return jsonify(ok=True)

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
            if (not isinstance(data, dict) or set(data) != {'edition', 'enabled'} or
                    type(data.get('enabled')) is not bool):
                return jsonify(error='Indica si permites comandos de Minecraft.'),400
            with self.preset_lock:
                if data['edition'] != self.edition:return jsonify(error='La edición cambió. Actualiza antes de continuar.'),409
                self._bedrock_changed()
                edition, revision = data['edition'], self.revision
                generation = self.bedrock.generation
                has_password = bool(self.password)
            if data['enabled'] is False:
                # Revocation is already effective. Do not wait behind an active
                # connection change or close the replacement it may create.
                if not self.control_lock.acquire(blocking=False):
                    return jsonify(error='La conexión está cambiando. Los comandos se desactivaron.'),409
                try:
                    with self.preset_lock:
                        if edition != self.edition or revision != self.revision:
                            return jsonify(error='La conexión cambió. Actualiza su estado.'),409
                        self.password = ''
                    self.bedrock.close()
                finally:
                    self.control_lock.release()
                return jsonify(ok=True, authorized=False)
            if edition == 'java' and not has_password:
                return jsonify(error='Abre Conexión Java y guarda la contraseña RCON.'),400
            try:
                result = self.bedrock.execute('list', expected_generation=generation) if edition == 'bedrock' else self.execute('list')
            except Exception as exc:
                with self.preset_lock:
                    if edition != self.edition or revision != self.revision:
                        return jsonify(error='La conexión cambió. Autoriza de nuevo.'),409
                    self.authorized = False
                return jsonify(error=f'No se pudo autorizar Minecraft: {type(exc).__name__}'), 400
            with self.preset_lock:
                if edition != self.edition or revision != self.revision:return jsonify(error='La conexión cambió. Autoriza de nuevo.'),409
                if edition == 'bedrock' and (result['outcome'] != 'success' or not self.bedrock.snapshot()['connected'] or generation != self.bedrock.generation):
                    return jsonify(error='Bedrock no confirmó la consulta de jugadores. Revisa la conexión y los permisos.'),400
                self.authorized = True
                self.authorized_generation = generation if edition == 'bedrock' else None
            self.note('Minecraft autorizado: '+edition)
            return jsonify(ok=True, authorized=self.authorized_now())

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
