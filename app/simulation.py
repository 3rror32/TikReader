"""Offline events delivered through the LIVE handlers, with real configured actions."""
import math
import queue
import threading
import time
from collections import deque
from types import SimpleNamespace as S
from uuid import uuid4

from flask import jsonify, request


class Simulation:
    def __init__(self, app, runtime):
        self.r = runtime
        self.lock = threading.RLock()
        self.active = False
        self.instance = uuid4().hex
        self.generation = 0
        self.cancel = threading.Event()
        self.batch = None
        self.events = deque(maxlen=200)
        self.started = 0
        self.register(app)

    def new_session(self, label):
        r = self.r
        with r.feed_lock:
            r.feed_session = uuid4().hex
            for name in ('comment_history', 'seen_comment_ids', 'gift_history', 'recovered_gifts',
                         'gift_counts', 'seen_like_ids', 'participants', 'recent_joins',
                         'gifter_totals', 'gifter_diamonds', 'viewer_samples'):
                getattr(r, name).clear()
            r.gift_revision = r.participants_revision = r.last_sample = 0
            r.session_metrics = None
            r.state.update(connected=False, connecting=False, username=label,
                comment_count=0, like_count=0, gift_count=0, viewer_count=0, retry_count=0,
                retry_in=0, stats_revision=0, like_events=0, last_like_at=None,
                likes_known=False, viewers_known=False, likes_source='pending',
                session_like_units=0, room_like_count=None, room_like_baseline=None)
            r.diagnostics.update({key: None for key in r.diagnostics})
            r.studio_state['highlight'] = None
            r.production.reset_session()
            r.interactive.reset_live_session()
            if r.archive and label:
                r.archive.start(r.feed_session, label)
            r.socketio.emit('comment_history', r.feed_snapshot())
            r.publish_stats()

    def clear_actions(self):
        """Invalidate queued jobs without changing configured rules or their limits."""
        self.cancel.set()
        self.generation += 1
        r = self.r
        with r.game_hotkeys.lock:
            r.game_hotkeys.revision += 1
        r.minecraft.revision += 1
        for module in (r.game_hotkeys, r.minecraft, r.obs_direct, r.interactive):
            while True:
                try:
                    module.jobs.get_nowait()
                    module.jobs.task_done()
                except queue.Empty:
                    break
        with r.interactive.lock:
            r.interactive.pending.clear()
            r.interactive.effects.clear()
            r.interactive.overlay_games['drop'].update(events=[], event=None)
            r.interactive.overlay_games['wheel']['spinning'] = False
        for module in (r.animation_studio, r.overlay_animations):
            with module.lock:
                module.events.clear()
                module.epoch = uuid4().hex
        if self.batch and self.batch['running']:
            self.batch.update(running=False, status='Detenida')

    def stop(self):
        self.clear_actions()
        # Emergency is the common cancellation contract for external workers too.
        self.r.production.settings['emergency'] = True
        self.r.production.settings['revision'] += 1
        self.r.socketio.emit('production_state', self.r.production.snapshot())
        self.publish()

    def snapshot(self):
        r = self.r
        with r.game_hotkeys.lock:
            games = dict(profile=r.game_hotkeys.active_profile,
                authorized=r.game_hotkeys.authorized, paused=r.game_hotkeys.paused,
                mappings=[dict(name=m['name'], window=m['window'], enabled=m['enabled'],
                    gift=m['gift'], target=m['target'], keys=[s['keys'] for s in m['sequence']])
                    for m in r.game_hotkeys.mappings if m['profile'] == r.game_hotkeys.active_profile],
                log=[dict(x) for x in r.game_hotkeys.log if x['at'] >= self.started][:40])
        with r.interactive.lock:
            traces = [dict(x) for x in r.interactive.trace if x['at'] >= self.started][:60]
        return dict(active=self.active, instance=self.instance, generation=self.generation, session=r.feed_session,
            batch=dict(self.batch) if self.batch else None, events=list(self.events), games=games,
            traces=traces, muted=r.production.settings['emergency'] or r.production.settings['scene'] != 'talk',
            connected=r.state['connected'] or r.state['connecting'])

    def publish(self):
        self.r.socketio.emit('simulation_state', dict(active=self.active, instance=self.instance, generation=self.generation))

    @staticmethod
    def number(data, key, default, low, high, integer=False):
        value = data.get(key, default)
        if isinstance(value, bool):
            raise ValueError('Número inválido: ' + key)
        try:
            value = float(value)
        except (ValueError, TypeError):
            raise ValueError('Número inválido: ' + key)
        if not math.isfinite(value) or not low <= value <= high or (integer and not value.is_integer()):
            raise ValueError(f'{key}: usa un valor entre {low} y {high}')
        return int(value) if integer else value

    def validate(self, data):
        kind = data.get('kind', 'comment')
        if kind not in ('comment', 'gift'):
            raise ValueError('Selecciona comentario o regalo')
        mode = data.get('mode', 'streak')
        if mode not in ('streak', 'separate'):
            raise ValueError('Selecciona racha o envíos separados')
        user = str(data.get('user', 'simulador')).strip().lstrip('@')
        if not user or len(user) > 24 or not all(c.isalnum() or c in '._' for c in user):
            raise ValueError('Usuario: usa hasta 24 letras, números, puntos o guiones bajos')
        text = str(data.get('text', '')).strip()
        if kind == 'comment' and not 1 <= len(text) <= 400:
            raise ValueError('Escribe un comentario de 1 a 400 caracteres')
        count = self.number(data, 'count', 1, 1, 9999, True) if kind == 'gift' else 1
        interval = self.number(data, 'interval', .5, .1, 60)
        delay = self.number(data, 'delay', 5, 0, 60)
        if delay + count * interval > 3600:
            raise ValueError('La secuencia debe durar como máximo una hora')
        gift = str(data.get('gift', 'Rose')).strip()
        if kind == 'gift' and not 1 <= len(gift) <= 100:
            raise ValueError('Selecciona o escribe el nombre del regalo')
        catalog = next((g for g in self.r.gift_catalog.values() if g['name'].casefold() == gift.casefold()), {})
        return dict(kind=kind, mode=mode, user=user, text=text, count=count, interval=interval,
            delay=delay, gift=catalog.get('name', gift), gift_id=catalog.get('id', 'simulation-'+gift),
            diamonds=catalog.get('diamonds', self.number(data, 'diamonds', 1, 0, 100000, True)),
            image=catalog.get('image_url'))

    def deliver(self, spec, index, group, final=False):
        r = self.r
        user = S(unique_id=spec['user'], nickname=spec['user'])
        message = 'simulation:' + uuid4().hex
        if spec['kind'] == 'comment':
            r.handle_comment_event(S(user=user, comment=spec['text'], common=S(msg_id=message)))
            self.events.append(dict(id=message, at=time.time(), user='@'+spec['user'],
                kind='comment', text=spec['text'], hotkeys=[]))
        else:
            streak = spec['mode'] == 'streak'
            gift = S(id=spec['gift_id'], name=spec['gift'], diamond_count=spec['diamonds'],
                type=1 if streak else 0, image=S(url_list=[spec['image']] if spec['image'] else []))
            result = r.handle_gift_event(S(user=user, gift=gift, gift_id=spec['gift_id'],
                group_id=group if streak else 0, common=S(msg_id=message),
                repeat_count=index if streak else 1, repeat_end=final or not streak), update_catalog=False)
            self.events.append(dict(id=message, at=time.time(), user='@'+spec['user'], kind='gift',
                text=f"{spec['gift']} × {index if streak else 1}" + (' · fin de racha' if final else ''),
                hotkeys=result['hotkeys']))

    def run(self, spec, cancellation, generation):
        try:
            if cancellation.wait(spec['delay']):
                return
            group = uuid4().hex
            for index in range(1, spec['count'] + 1):
                with self.lock:
                    if cancellation.is_set() or not self.active or generation != self.generation:
                        return
                    if self.r.production.settings['emergency']:
                        self.batch.update(running=False, status='Detenida por pausa de emisión')
                        return
                    self.deliver(spec, index, group)
                    self.batch.update(sent=index, status='Enviando')
                if index < spec['count'] and cancellation.wait(spec['interval']):
                    return
            with self.lock:
                if cancellation.is_set() or generation != self.generation:
                    return
                if spec['kind'] == 'gift' and spec['mode'] == 'streak':
                    self.deliver(spec, spec['count'], group, final=True)
                self.batch.update(running=False, status='Envío terminado')
        except Exception as exc:
            with self.lock:
                if generation == self.generation:
                    self.batch.update(running=False, status='Error: '+str(exc)[:200])
        finally:
            self.publish()

    def register(self, app):
        @app.route('/simulation', methods=['GET', 'POST'])
        def simulation_state():
            with self.r.control_lock, self.lock:
                if request.method == 'POST':
                    data = request.get_json(silent=True)
                    if not isinstance(data, dict):
                        return jsonify(error='Datos inválidos'), 400
                    action = data.get('action')
                    if action == 'activate':
                        if not self.active:
                            if (self.r.state['connected'] or self.r.state['connecting'] or
                                    (self.r.tiktok_thread and self.r.tiktok_thread.is_alive())):
                                return jsonify(error='Desconecta el LIVE antes de activar la simulación.'), 409
                            self.clear_actions()
                            self.started = time.time()
                            self.events.clear()
                            self.batch = None
                            self.new_session('MODO_SIMULACION')
                            self.active = True
                    elif action == 'deactivate':
                        if self.active:
                            self.stop()
                            self.active = False
                            self.generation += 1
                            self.new_session('')
                    elif action == 'stop' and self.active:
                        self.stop()
                    else:
                        return jsonify(error='Acción no disponible'), 400
                    self.publish()
                response = jsonify(self.snapshot())
                response.headers['Cache-Control'] = 'no-store'
                return response

        @app.post('/simulation/events')
        def simulation_events():
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return jsonify(error='Datos inválidos'), 400
            with self.lock:
                if not self.active:
                    return jsonify(error='Activa el modo simulación primero'), 409
                if self.batch and self.batch['running']:
                    return jsonify(error='Espera a que termine el envío o pulsa Detener acciones'), 409
                if self.r.production.settings['emergency']:
                    return jsonify(error='La emisión está pausada. Pulsa Reanudar voz y efectos antes de enviar.'), 409
                try:
                    spec = self.validate(data)
                except (ValueError, TypeError, OverflowError) as exc:
                    return jsonify(error=str(exc)), 400
                self.cancel = threading.Event()
                self.batch = dict(running=True, sent=0, count=spec['count'], status='Esperando',
                    starts_at=time.time()+spec['delay'])
                threading.Thread(target=self.run, args=(spec, self.cancel, self.generation),
                    daemon=True, name='simulation-events').start()
                return jsonify(self.snapshot()), 202
