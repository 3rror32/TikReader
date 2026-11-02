"""Bounded Minecraft Java RCON connector with named, allowlisted commands."""
import ipaddress
import logging
import queue
import re
import socket
import struct
import threading
import time
import uuid
from collections import OrderedDict, deque
from flask import jsonify, request
from minecraft_bedrock import BedrockBridge
from minecraft_presets import PresetJob, catalog, categories, sections, commands_for, announcement_for, mappings, limits, name_format, donor_name, command_cost, is_spawn, pacing_interval

logger = logging.getLogger(__name__)


class AmbiguousMinecraftExecution(OSError):
    """The command may have reached Minecraft, so it must not be replayed automatically."""

class MinecraftConnector:
    def __init__(self, app, runtime):
        self.r = runtime
        self.config = {'host': '127.0.0.1', 'port': 25575, 'commands': {}, 'immediate_effects': False}
        self.edition = 'java'
        self.profiles = {'java': self.config, 'bedrock': {'commands': {}, 'immediate_effects': False}}
        self.password = ''
        self.authorized = False
        self.authorized_generation = None
        self.jobs = queue.Queue()
        self._memory_effects = OrderedDict()
        self._next_object_at = None
        self._last_effect_donor = None
        self._same_donor_count = 0
        self._last_effect_confirmed_at = None
        self._wave_started_at = None
        self._fairness_loaded = False
        self._retry_at = 0
        self._retry_count = 0
        self._effects_paused = None
        self.execution_log = []
        self.current_effect = None
        self.log = []
        self.revision = 0
        self.java_ready_revision = None
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
                    for profile in profiles.values():
                        profile['presets'] = self._canonical_presets(profile.get('presets'))
                    self.profiles, self.edition = profiles, edition
                    self.config = profiles[edition]
                else:
                    self.config = self.validate(saved)
                    self.config['presets'] = self._canonical_presets(self.config.get('presets'))
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
        self.config['presets'] = self._canonical_presets(self.config.get('presets'))
        return dict(config=self.config, edition=self.edition, profiles=self.profiles,
                    authorized=self.authorized_now(), queued=self.pending_effect_count(), log=self.log,
                    effect_queue=self.queue_snapshot(),
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
        if 'immediate_effects' in data:
            immediate_effects = data['immediate_effects']
            if type(immediate_effects) is not bool:
                raise ValueError('La ejecución sin espera debe ser verdadera o falsa')
            config['immediate_effects'] = immediate_effects
        return config

    def _canonical_presets(self, presets, previous=None):
        rows = mappings(presets, previous)
        catalog = getattr(self.r, 'gift_catalog', {})
        for row in rows.values():
            gift = catalog.get(row['gift_id']) if row['gift_id'] else None
            if isinstance(gift, dict) and str(gift.get('id', row['gift_id'])) == row['gift_id']:
                row['gift_name'] = str(gift.get('name') or row['gift_name'])[:100]
        return rows

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
                stable_id = identity[1]
                self.admit_presets(selected, record.get('user'), automatic=True,
                                   gift_count=record.get('count', 1), identity=stable_id,
                                   gift_name=record.get('gift', ''), gift_id=record.get('gift_id', ''))

    def matching_presets(self, gift_id):
        return tuple(key for key, row in mappings(self.config.get('presets')).items()
                     if row['enabled'] and row['gift_id'] == gift_id)

    def enqueue_preset(self, preset_id, automatic=False):
        command_cost(preset_id, None, 1)  # Validate IDs without building commands.
        return self.admit_presets((preset_id,), 'Prueba', automatic,
                                  identity='manual:'+uuid.uuid4().hex)

    def admit_presets(self, selected, donor, automatic=False, gift_count=1, identity=None, gift_name='', gift_id=''):
        with self.preset_lock:
            now = time.monotonic()
            # The general simulator may drain pending queue items and call task_done.
            with self.jobs.mutex:
                abandoned = self.jobs.unfinished_tasks == 0
            if abandoned and not self.running_presets:
                for entry in tuple(self.preset_usage):
                    if entry['finished'] is None:
                        self.finish_reservation(entry['owner'], now)
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
            elif automatic and any(not rows[key]['enabled'] or not rows[key]['gift_id'] for key in selected):
                reason = 'La acción ya no está activa.'
            if reason:
                self.admission_reason = reason
                self.note(reason, outcome='cancelled', alias='regalo', response='')
                return False
            groups = []
            total_commands = 0
            for key in selected:
                sequence = commands_for(key, self.edition, donor, self.config.get('name_format', 'modern'),
                                        quantity=rows[key].get('quantity'))
                repeats = gift_count if is_spawn(key) else 1
                groups.append({'commands':list(sequence), 'labels':[key] * len(sequence), 'repeats':repeats})
                total_commands += len(sequence) * repeats
            commands, labels = [], []
            if total_commands <= 10000:
                for group in groups:
                    for _ in range(group['repeats']):
                        commands.extend(group['commands'])
                        labels.extend(group['labels'])
            identity = str(identity or 'event:'+uuid.uuid4().hex)
            owner = identity
            interval = pacing_interval(self.config.get('limits'))
            scheduled_at = max(now, self.last_preset_at + interval) if self.last_preset_at is not None else now
            job = PresetJob(selected[0], tuple(commands), scheduled_at, getattr(self.r, 'feed_session', None),
                            self.revision, self.edition, self.preset_generation,
                            self.authorized_generation, automatic, tuple(selected), donor_name(donor),
                            owner, tuple(labels), gift_count,
                            tuple((key, rows[key].get('quantity', 1)) for key in selected),
                            tuple(announcement_for(key, self.edition, donor,
                                                   quantity=rows[key].get('quantity'),
                                                   gift_count=gift_count) for key in selected))
            action_names = {row['id']:row['name'] for row in catalog()}
            effect = {'identity':str(identity), 'donor':job.donor, 'gift_name':str(gift_name)[:100],
                      'gift_id':str(gift_id)[:100], 'action_name':action_names.get(job.preset_id, job.preset_id),
                      'preset_id':job.preset_id, 'selected_ids':list(job.selected_ids),
                      'commands':list(job.commands), 'command_labels':list(job.command_labels),
                      'steps':[{'preset_id':key, 'action_name':action_names.get(key, key)}
                               for key in job.command_labels],
                      'command_groups':groups, 'total':total_commands,
                      'announcements':list(job.announcements), 'edition':job.edition,
                      'automatic':bool(automatic), 'session':job.session,
                      'next_index':0, 'status':'pending', 'received_at':time.time(),
                      'gift_count':gift_count}
            try:
                if not self._enqueue_effect(effect):
                    self.admission_reason = ''
                    return True
                self.jobs.put_nowait(job)
            except queue.Full:  # Durable storage remains the source of truth.
                pass
            self.preset_owner = owner
            self.preset_usage.append({'owner': owner, 'cost': cost, 'finished': None})
            self.last_preset_at = scheduled_at
            self.admission_reason = ''
            self.note('Regalo recibido y guardado en la cola de Minecraft', alias=job.preset_id,
                      outcome='queued', identity=str(identity), donor=job.donor,
                      gift=effect['gift_name'], remaining=total_commands)
            return True

    def _enqueue_effect(self, effect):
        was_idle = not self._pending_effects()
        archive = getattr(self.r, 'archive', None)
        if archive and hasattr(archive, 'enqueue_minecraft_effect'):
            queued = archive.enqueue_minecraft_effect(effect)
        elif effect['identity'] in self._memory_effects:
            queued = False
        else:
            self._memory_effects[effect['identity']] = effect
            queued = True
        if queued and was_idle:
            self._set_effect_wave_anchor(time.time())
        return queued

    def _pending_effects(self):
        archive = getattr(self.r, 'archive', None)
        if archive and hasattr(archive, 'pending_minecraft_effects'):
            return archive.pending_minecraft_effects()
        return [effect for effect in self._memory_effects.values() if effect.get('status') == 'pending']

    def pending_effect_count(self):
        return len(self._pending_effects())

    @staticmethod
    def _effect_summary(effect):
        total = effect.get('total', len(effect.get('commands', ())))
        remaining = max(0, total-effect.get('next_index', 0))
        step_index = effect.get('next_index', 0)
        steps = effect.get('steps', ())
        step = steps[step_index] if step_index < len(steps) else {}
        return {'identity':effect['identity'], 'donor':effect['donor'],
                'gift':effect.get('gift_name', ''), 'gift_id':effect.get('gift_id', ''),
                'action':step.get('action_name', effect.get('action_name', effect['preset_id'])),
                'preset_id':step.get('preset_id', effect['preset_id']),
                'quantity':effect.get('gift_count', total),
                'state':effect.get('status', 'pending'), 'remaining':remaining,
                'failures':effect.get('failures', 0)}

    def unconfirmed_effects(self):
        archive = getattr(self.r, 'archive', None)
        if archive and hasattr(archive, 'unconfirmed_minecraft_effects'):
            return archive.unconfirmed_minecraft_effects()
        return [effect for effect in self._memory_effects.values() if effect.get('status') == 'unconfirmed']

    def queue_snapshot(self):
        pending = self._pending_effects()
        unconfirmed = self.unconfirmed_effects()
        connection_ready = self._connection_ready()
        executable = pending if connection_ready else []
        count = len(executable)
        remaining_objects = sum(max(0, row.get('total', len(row.get('commands', ())))-
                                   row.get('next_index', 0)) for row in executable)
        rate = limits(self.config.get('limits'))
        interval = self.pacing_interval()
        objects = rate.get('objects', rate.get('per_minute', 20))
        period = rate.get('period_seconds', 60)
        self._load_effect_fairness()
        now = time.time()
        if executable:
            if self._wave_started_at is None:
                self._set_effect_wave_anchor(now)
            elapsed = max(0, now - self._wave_started_at)
            wave_wait = round(period - (elapsed % period))
        else:
            if self._wave_started_at is not None:
                self._set_effect_wave_anchor(None)
            wave_wait = period
        wait = max(0, self._next_object_at-time.monotonic()) if self._next_object_at is not None else 0
        pressure = 'normal' if count <= 5 else ('accumulating' if count <= 20 else 'saturated')
        ready = [row for row in executable if self._effect_executable(row)]
        next_effect = ready[0] if ready else None
        if ready and self._same_donor_count >= 5:
            next_effect = next((row for row in ready if row['donor'] != self._last_effect_donor), next_effect)
        return {'pending_count':count, 'stored_pending_count':len(pending),
                'held_pending_count':len(pending)-count, 'connection_ready':connection_ready,
                'current':self.current_effect if connection_ready else None,
                'next':self._effect_summary(next_effect) if next_effect else None,
                'pending':[self._effect_summary(row) for row in executable[:20]],
                'objects':objects, 'period_seconds':period, 'interval_seconds':interval,
                'next_object_in_seconds':round(wait, 2) if connection_ready else None,
                'wave_seconds_remaining':round(wave_wait, 2) if connection_ready else None,
                'remaining_objects':remaining_objects,
                'estimated_wait_seconds':round(max(0, remaining_objects-1)*interval+wait, 2) if connection_ready else None,
                'pressure':pressure, 'pressure_thresholds':{'normal_max':5,'accumulating_max':20},
                'failure_count':sum(row.get('failures',0) for row in pending),
                'retry_in_seconds':round(max(0,self._retry_at-time.monotonic()),2),
                'unconfirmed':[self._effect_summary(row) for row in unconfirmed[:20]],
                'unconfirmed_count':len(unconfirmed),
                'paused':self.effects_paused(), 'immediate_effects':bool(self.config.get('immediate_effects', False))}

    def _connection_ready(self):
        if not self.authorized_now():
            return False
        if self.edition == 'java':
            return self.java_ready_revision == self.revision
        return self.bedrock.snapshot()['connected'] and self.connection_check == 'ready'

    def effects_paused(self):
        if self._effects_paused is None:
            archive = getattr(self.r, 'archive', None)
            state = archive.settings() if archive and hasattr(archive, 'settings') else {}
            self._effects_paused = bool(state.get('minecraft_effects_paused', False))
        return self._effects_paused

    def set_effects_paused(self, paused):
        self._effects_paused = bool(paused)
        archive = getattr(self.r, 'archive', None)
        if archive and hasattr(archive, 'set_setting'):
            archive.set_setting('minecraft_effects_paused', self._effects_paused)

    def _effect_executable(self, effect):
        if effect.get('edition') != self.edition:
            return False
        if effect.get('automatic'):
            rows = mappings(self.config.get('presets'))
            if any(not rows[key]['enabled'] or not rows[key]['gift_id']
                   for key in effect.get('selected_ids', (effect['preset_id'],))):
                return False
        return effect.get('next_index', 0) < effect.get('total', len(effect.get('commands', ())))

    def pacing_interval(self):
        return 0 if self.config.get('immediate_effects', False) else pacing_interval(self.config.get('limits'))

    def _confirm_effect_object(self, effect, index):
        archive = getattr(self.r, 'archive', None)
        if archive and hasattr(archive, 'confirm_minecraft_object'):
            confirmed = archive.confirm_minecraft_object(effect['identity'], index)
        else:
            current = self._memory_effects.get(effect['identity'])
            if not current or current.get('next_index') != index:
                return False
            current['next_index'] = index + 1
            current['last_confirmed_at'] = time.time()
            if current['next_index'] >= current.get('total', len(current['commands'])):
                current['status'] = 'complete'
            confirmed = True
        if confirmed and index + 1 >= effect.get('total', len(effect.get('commands', ()))):
            self._finish_effect_reservation(effect['identity'])
        return confirmed

    def _record_effect_failure(self, identity, reason):
        archive = getattr(self.r, 'archive', None)
        if archive and hasattr(archive, 'record_minecraft_failure'):
            archive.record_minecraft_failure(identity, reason)
        else:
            current = self._memory_effects.get(identity)
            if current:
                current['failures'] = current.get('failures', 0) + 1
                current['last_failure'] = str(reason)[:80]

    def _hold_effect_unconfirmed(self, effect, reason):
        held = dict(effect, status='unconfirmed', failures=effect.get('failures', 0) + 1,
                    unconfirmed_reason=str(reason)[:80],
                    unconfirmed_at=time.time())
        step = self._effect_summary(effect)
        archive = getattr(self.r, 'archive', None)
        if archive and hasattr(archive, 'update_minecraft_effect'):
            archive.update_minecraft_effect(held)
        else:
            self._memory_effects[effect['identity']] = held
        self.note(f'Entrega sin confirmar · {step["action"]} · {effect["donor"]}: requiere revisión manual',
                  alias=step['action'], action=step['action'], preset_id=step['preset_id'], outcome='unconfirmed',
                  identity=effect['identity'], donor=effect['donor'], gift=effect.get('gift_name',''))

    def _finish_effect_reservation(self, identity):
        with self.preset_lock:
            self.finish_reservation(identity, time.monotonic())
            if self.preset_owner == identity:
                self.preset_owner = next((entry['owner'] for entry in reversed(self.preset_usage)
                                          if entry['finished'] is None), None)

    def _load_effect_fairness(self):
        if self._fairness_loaded:
            return
        self._fairness_loaded = True
        archive = getattr(self.r, 'archive', None)
        state = archive.minecraft_fairness() if archive and hasattr(archive, 'minecraft_fairness') else {}
        self._last_effect_donor = state.get('last_donor')
        self._same_donor_count = int(state.get('same_donor_count', 0))
        wave_started_at = state.get('wave_started_at')
        if isinstance(wave_started_at, (int, float)) and not isinstance(wave_started_at, bool):
            self._wave_started_at = wave_started_at
        last_at = state.get('last_confirmed_at')
        if isinstance(last_at, (int, float)):
            self._last_effect_confirmed_at = last_at
            wait = max(0, self.pacing_interval() - (time.time() - last_at))
            self._next_object_at = time.monotonic() + wait

    def _set_effect_wave_anchor(self, started_at):
        self._wave_started_at = started_at
        archive = getattr(self.r, 'archive', None)
        if archive and hasattr(archive, 'set_minecraft_fairness'):
            state = archive.minecraft_fairness() if hasattr(archive, 'minecraft_fairness') else {}
            state = dict(state) if isinstance(state, dict) else {}
            state['wave_started_at'] = started_at
            archive.set_minecraft_fairness(state)

    def _save_effect_fairness(self):
        self._last_effect_confirmed_at = time.time()
        archive = getattr(self.r, 'archive', None)
        if archive and hasattr(archive, 'set_minecraft_fairness'):
            archive.set_minecraft_fairness({'last_donor':self._last_effect_donor,
                'same_donor_count':self._same_donor_count,'last_confirmed_at':self._last_effect_confirmed_at,
                'wave_started_at':self._wave_started_at})

    def run_next_effect(self):
        """Execute one confirmed object without removing work during pauses or outages."""
        self._load_effect_fairness()
        if self.effects_paused() or not (self._connection_ready() and not self.r.production.settings.get('emergency') and
                self.r.production.settings.get('scene', 'talk') == 'talk'):
            return False
        if time.monotonic() < self._retry_at:
            return False
        pending = self._pending_effects()
        ready = [row for row in pending if self._effect_executable(row)]
        if not ready:
            return False
        if self._next_object_at is not None:
            while time.monotonic() < self._next_object_at:
                if self.effects_paused() or not self._connection_ready() or self.r.production.settings.get('emergency') or self.r.production.settings.get('scene', 'talk') != 'talk':
                    return False
                time.sleep(min(.1, self._next_object_at-time.monotonic()))
        chosen = ready[0]
        if self._same_donor_count >= 5:
            chosen = next((row for row in ready if row['donor'] != self._last_effect_donor), chosen)
        index = chosen.get('next_index', 0)
        if index >= chosen.get('total', len(chosen.get('commands', ()))):
            return False
        if self.effects_paused() or not self._connection_ready() or not self._effect_executable(chosen):
            return False
        command, alias = self._effect_object(chosen, index)
        step = self._effect_summary(chosen)
        action_name = step['action']
        self.current_effect = {**self._effect_summary(chosen), 'step':index+1,
                               'total':chosen.get('total',len(chosen.get('commands', ())))}
        try:
            if chosen['edition'] == 'java':
                with self.lock:
                    if not self.authorized_now() or self.r.production.settings.get('emergency') or self.r.production.settings.get('scene', 'talk') != 'talk':
                        self.current_effect = None
                        return False
                    response = self.execute(command)
                outcome = self.response_outcome(command, response)
            else:
                generation = self.bedrock.generation
                result = self.bedrock.execute(command, expected_generation=generation)
                response, outcome = result['response'], result['outcome']
        except Exception as exc:
            self.current_effect = None
            outcome = ('connection_error' if chosen['edition'] == 'java' and isinstance(exc, OSError)
                       and not isinstance(exc, AmbiguousMinecraftExecution) else 'unconfirmed')
            response = ''
            self.note(f'Objeto pendiente · {action_name} · {chosen["donor"]}: {type(exc).__name__}',
                      alias=action_name, action=action_name, preset_id=step['preset_id'], outcome=outcome,
                      identity=chosen['identity'], step=index+1,
                      total=chosen.get('total', len(chosen.get('commands', ()))), donor=chosen['donor'])
            self._record_effect_failure(chosen['identity'], type(exc).__name__)
            if outcome == 'unconfirmed':
                self._hold_effect_unconfirmed(chosen, type(exc).__name__)
                return False
            self._retry_count += 1
            self._retry_at = time.monotonic() + min(30, 2 ** min(self._retry_count-1, 5))
            return False
        self.current_effect = None
        total = chosen.get('total', len(chosen.get('commands', ())))
        self.note(f'{"Éxito confirmado" if outcome == "success" else "Sin confirmar"} · {action_name} · {chosen["donor"]} · objeto {index+1}/{total}: {response or "sin respuesta"}',
                  alias=action_name, action=action_name, preset_id=step['preset_id'], outcome=outcome, response=response,
                  identity=chosen['identity'], gift_id=chosen.get('gift_id',''), gift=chosen.get('gift_name',''),
                  quantity=chosen.get('gift_count',1), state=outcome,
                  step=index+1, total=total, donor=chosen['donor'])
        self.execution_log.append({'identity':chosen['identity'],'donor':chosen['donor'],
                                   'command':command,'outcome':outcome,'step':index+1})
        if outcome == 'unconfirmed':
            self._record_effect_failure(chosen['identity'], outcome)
            self._hold_effect_unconfirmed(chosen, outcome)
            return False
        if outcome != 'success':
            self._record_effect_failure(chosen['identity'], outcome)
            self._retry_count += 1
            self._retry_at = time.monotonic() + min(30, 2 ** min(self._retry_count-1, 5))
            return False
        if not self._confirm_effect_object(chosen, index):
            self._hold_effect_unconfirmed(chosen, 'confirmation_not_persisted')
            return False
        self._retry_count = 0
        self._retry_at = 0
        if index + 1 >= chosen.get('total', len(chosen.get('commands', ()))):
            self._announce_effect(chosen)
        if self._last_effect_donor == chosen['donor']:
            self._same_donor_count += 1
        else:
            self._last_effect_donor, self._same_donor_count = chosen['donor'], 1
        if not self._pending_effects():
            self._set_effect_wave_anchor(None)
        self._save_effect_fairness()
        self._next_object_at = time.monotonic()+self.pacing_interval()
        return True

    def _announce_effect(self, effect):
        for index, command in enumerate(effect.get('announcements', ())):
            alias = effect.get('selected_ids', [effect['preset_id']])[index]
            try:
                if effect['edition'] == 'java':
                    with self.lock:
                        if not self.authorized_now():
                            return
                        response = self.execute(command)
                    self.note(f'Anuncio de entrega enviado · {alias} · {effect["donor"]}',
                              alias=alias, outcome='unconfirmed', response=response,
                              donor=effect['donor'], identity=effect['identity'], announcement=True)
                else:
                    result = self.bedrock.execute(command, expected_generation=self.bedrock.generation)
                    self.note(f'Anuncio de entrega · {alias} · {effect["donor"]}: {result["response"] or "sin respuesta"}',
                              alias=alias, outcome=result['outcome'], response=result['response'],
                              donor=effect['donor'], identity=effect['identity'], announcement=True)
            except Exception as exc:
                self.note(f'Anuncio de entrega sin confirmar · {alias} · {type(exc).__name__}',
                          alias=alias, outcome='connection_error' if isinstance(exc, OSError) else 'unconfirmed',
                          response='', donor=effect['donor'], identity=effect['identity'], announcement=True)

    @staticmethod
    def _effect_object(effect, index):
        groups = effect.get('command_groups')
        if groups:
            for group in groups:
                width = len(group['commands']) * group['repeats']
                if index < width:
                    offset = index % len(group['commands'])
                    return group['commands'][offset], group['labels'][offset]
                index -= width
        return effect['commands'][index], effect.get('command_labels', [effect['preset_id']])[index]

    def finish_reservation(self, owner, now):
        # Caller holds preset_lock. Pending/running costs cannot expire before completion.
        for entry in self.preset_usage:
            if entry['owner'] == owner and entry['finished'] is None:
                entry['finished'] = now
                break

    def finish_preset_job(self, job):
        with self.preset_lock:
            self.finish_reservation(job.admission_id, time.monotonic())
            if self.preset_owner == job.admission_id:
                self.preset_owner = next((entry['owner'] for entry in reversed(self.preset_usage)
                                          if entry['finished'] is None), None)

    def _preset_valid(self, job):
        with self.preset_lock:
            rows = mappings(self.config.get('presets'))
            enabled = all(rows[key]['enabled'] and rows[key]['gift_id'] for key in (job.selected_ids or (job.preset_id,)))
            reserved = any(entry['owner'] == job.admission_id and entry['finished'] is None
                           for entry in self.preset_usage)
            return (reserved and self.authorized_now() and job.edition == self.edition and
                    job.revision == self.revision and job.preset_generation == self.preset_generation and
                    job.session == getattr(self.r, 'feed_session', None) and
                    not self.r.production.settings['emergency'] and
                    self.r.production.settings.get('scene', 'talk') == 'talk' and
                    (not job.automatic or enabled) and
                    (job.edition == 'java' or job.transport_generation == self.bedrock.generation))

    def run_preset(self, job):
        while True:
            if not self._preset_valid(job):
                self.note('Acción rápida cancelada antes de ejecutarse', alias=job.preset_id,
                          outcome='cancelled', response='')
                self.finish_preset_job(job)
                return
            delay = job.created - time.monotonic()
            if delay <= 0:
                break
            time.sleep(min(delay, .1))
        with self.preset_lock:
            self.running_presets.add(job.admission_id)
        try:
            self._run_preset(job)
        finally:
            with self.preset_lock:
                self.running_presets.discard(job.admission_id)
            self.finish_preset_job(job)

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
        command_attempted = False
        try:
            with socket.create_connection((config['host'], config['port']), timeout=3) as sock:
                sock.settimeout(3)
                sock.sendall(self.packet(10, 3, password))
                auth_id, kind, _ = self.receive(sock)
                if kind == 0:
                    auth_id, kind, _ = self.receive(sock)
                if auth_id == -1:
                    raise PermissionError('Contraseña RCON rechazada')
                if auth_id != 10 or kind != 2:raise OSError('Autenticación RCON inesperada')
                command_attempted = True
                sock.sendall(self.packet(11, 2, command))
                response_id, kind, response = self.receive(sock)
                if response_id != 11 or kind != 0:
                    raise OSError('Respuesta RCON inesperada')
                return response[:500]
        except Exception as exc:
            self.java_ready_revision = None
            if command_attempted:
                raise AmbiguousMinecraftExecution('Minecraft no confirmó si ejecutó el comando') from exc
            raise

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
            try:
                try:job = self.jobs.get(timeout=.1)
                except queue.Empty:job = None
                if job is not None:
                    try:
                        if not isinstance(job, PresetJob):self.run_job(job)
                    finally:self.jobs.task_done()
                self.run_next_effect()
            except Exception:
                logger.exception('Minecraft durable effect worker iteration failed')
                time.sleep(.5)

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
                        config['presets'] = self._canonical_presets(data['presets'], self.profiles[edition].get('presets'))
                    for key in ('presets', 'limits', 'name_format', 'immediate_effects'):
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
                            self.java_ready_revision = None
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
                    self.config['presets'] = self._canonical_presets(data['presets'], self.config.get('presets'))
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
                if not isinstance(data, dict) or set(data) not in (
                        {'edition', 'limits', 'name_format'},
                        {'edition', 'limits', 'name_format', 'immediate_effects'}):
                    raise ValueError('Configuración inválida')
                clean, style = limits(data['limits']), name_format(data['name_format'])
                immediate = data.get('immediate_effects', self.config.get('immediate_effects', False))
                if type(immediate) is not bool:raise ValueError('La ejecución sin espera debe ser verdadera o falsa')
                with self.preset_lock:
                    if data['edition'] != self.edition:return jsonify(error='La edición cambió'),409
                    self.config.update(limits=clean, name_format=style, immediate_effects=immediate)
                    if immediate:
                        self._next_object_at = time.monotonic()
                    elif self._last_effect_confirmed_at is not None:
                        wait = max(0, pacing_interval(clean) - (time.time() - self._last_effect_confirmed_at))
                        self._next_object_at = time.monotonic() + wait
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
                self.set_effects_paused(True)
                now = time.monotonic()
                if self.last_preset_at is not None and self.last_preset_at > now:
                    self.last_preset_at = now - pacing_interval(self.config.get('limits'))
            return jsonify(ok=True)

        @app.post('/minecraft/presets/resume')
        def minecraft_presets_resume():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            data = request.get_json(silent=True)
            if not isinstance(data, dict) or set(data) != {'edition'}:return jsonify(error='Edición inválida'),400
            with self.preset_lock:
                if data['edition'] != self.edition:return jsonify(error='La edición cambió'),409
                self.set_effects_paused(False)
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
                        self.java_ready_revision = None
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
                    self.java_ready_revision = None
                return jsonify(error=f'No se pudo autorizar Minecraft: {type(exc).__name__}'), 400
            with self.preset_lock:
                if edition != self.edition or revision != self.revision:return jsonify(error='La conexión cambió. Autoriza de nuevo.'),409
                if edition == 'bedrock' and (result['outcome'] != 'success' or not self.bedrock.snapshot()['connected'] or generation != self.bedrock.generation):
                    return jsonify(error='Bedrock no confirmó la consulta de jugadores. Revisa la conexión y los permisos.'),400
                self.authorized = True
                self.authorized_generation = generation if edition == 'bedrock' else None
                self.java_ready_revision = revision if edition == 'java' else None
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
                self.java_ready_revision = None
            return jsonify(ok=True)

        @app.post('/minecraft/check')
        def check_connection():
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            edition, revision = self.edition, self.revision
            if edition == 'java' and not self.password:
                self.java_ready_revision = None
                return jsonify(error='Guarda la contraseña RCON primero'),409
            try:
                if edition == 'bedrock':
                    result = self.bedrock.execute('list')
                    if result['outcome'] != 'success':return jsonify(error='Bedrock no confirmó la consulta de jugadores.'),502
                else:self.execute('list')
                with self.preset_lock:
                    if edition != self.edition or revision != self.revision:
                        return jsonify(error='La conexión cambió. Comprueba su estado otra vez.'),409
                    if edition == 'java':self.java_ready_revision = revision
                return jsonify(ok=True,detail='Minecraft respondió a la consulta de jugadores.')
            except (OSError,PermissionError) as exc:
                return jsonify(error=f'Minecraft no confirmó la conexión: {type(exc).__name__}'),502
