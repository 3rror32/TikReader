"""Event-driven overlay effects with private previews and bounded delivery."""
import copy
import threading
import time
from collections import OrderedDict, deque
from uuid import uuid4
from flask import jsonify, request, render_template

KINDS = {'energy-ring': 'gift', 'hearts': 'like', 'coins': 'gift', 'welcome': 'follow', 'celebration': 'goal', 'custom': 'gift', 'cannon':'gift', 'fountain':'like', 'vip-runway':'subscribe', 'vip-diamonds':'subscribe', 'vip-hearts':'subscribe'}


class OverlayAnimations:
    def __init__(self, app, runtime):
        self.r = runtime
        self.lock = threading.RLock()
        self.settings = {key: dict(enabled=False, trigger=trigger, duration=8 if key=='cannon' else 5, size=48,
            cooldown=10, amount=1, gift='', sound='none', volume=30, asset='', goal='goal-likes', motion='full',
            canvas_format='horizontal')
            for key, trigger in KINDS.items()}
        self.settings['energy-ring'].update(size=80, accent='#647cff', secondary='#bc62ff', tertiary='#35efff', speed=5, glow=65, show_avatar=True, show_name=True)
        self.settings['fountain'].update(cooldown=0, color='#ff75b5', position='center', show_avatar=True)

        self.settings['welcome'].update(message='Bienvenido TikReader')
        for key in ('vip-runway','vip-diamonds','vip-hearts'):
            self.settings[key].update(duration=10,cooldown=1,message='¡Gracias por suscribirte!',accent='#36dcc4',text_size=36,density=45,show_avatar=True)
        self.session = None
        self.epoch = uuid4().hex
        self.serial = 0
        self.events = deque(maxlen=60)
        self.seen = OrderedDict()
        self.last = {}
        self.goal_state = {}
        self.register(app)

    def ensure(self):
        if self.session != self.r.feed_session:
            self.session = self.r.feed_session
            self.epoch = uuid4().hex
            self.events.clear(); self.seen.clear(); self.last.clear(); self.goal_state.clear()

    def validate(self, key, data):
        if not isinstance(data, dict): raise ValueError('Configuración inválida')
        out = {**self.settings[key], **{k: v for k, v in data.items() if k in self.settings[key]}}

        if out['canvas_format'] not in ('horizontal','vertical'): raise ValueError('Formato de lienzo inválido')
        for field, low, high in [('duration',2,30), ('size',20,120), ('cooldown',0 if key=='fountain' else 1,3600), ('amount',1,100000), ('volume',0,100)]:
            try: out[field] = int(out[field])
            except (ValueError, TypeError, OverflowError): raise ValueError('Número inválido: '+field)
            if not low <= out[field] <= high: raise ValueError('Fuera de rango: '+field)
        if key == 'fountain':
            import re
            out['trigger'] = 'like'
            if not isinstance(out['color'], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', out['color']): raise ValueError('Color inválido')
            out['position'] = 'center'
            out['show_avatar'] = out['show_avatar'] is True
        if key.startswith('vip-'):
            import re
            if not isinstance(out['accent'],str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',out['accent']): raise ValueError('Color inválido')
            out['message']=str(out['message'])[:160]
            for field,lo,hi in [('text_size',18,72),('density',10,100)]:
                try: out[field]=int(out[field])
                except (ValueError,TypeError,OverflowError): raise ValueError('Número inválido')
                if not lo<=out[field]<=hi: raise ValueError('Fuera de rango')
            out['show_avatar']=out['show_avatar'] is True
        if key == 'welcome':

            out['message']=str(out.get('message','')).strip()[:160] or 'Bienvenido TikReader'

        if key == 'energy-ring':
            import re
            for field in ('accent','secondary','tertiary'):
                if not isinstance(out[field],str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',out[field]): raise ValueError('Color inválido')
            for field,lo,hi in [('speed',1,10),('glow',0,100)]:
                try: out[field]=int(out[field])
                except (ValueError,TypeError,OverflowError): raise ValueError('Número inválido')
                if not lo<=out[field]<=hi: raise ValueError('Fuera de rango')
            for field in ('show_avatar','show_name'): out[field]=out[field] is True
        if out['trigger'] not in ('like','gift','follow','goal','subscribe','comment'): raise ValueError('Evento inválido')
        if out['sound'] not in ('none','bell','sparkle'): raise ValueError('Sonido inválido')
        if out['motion'] not in ('full','reduced','system'): raise ValueError('Movimiento inválido')
        if out['goal'] not in ['goal-'+x for x in ('likes','shares','follows','viewers','coins','subscribers','custom-1','custom-2','custom-3')]: raise ValueError('Meta inválida')
        out['enabled'] = out['enabled'] is True
        out['gift'] = str(out['gift'])[:100]
        if out['asset']:
            if not self.r.animation_studio.asset_path(out['asset']).is_file(): raise ValueError('Sube el archivo antes de guardar')
        if key == 'custom' and out['enabled'] and not out['asset']: raise ValueError('Sube un GIF o video para activar esta animación')
        return out

    def restore(self):
        saved = self.r.archive.settings().get('overlay_animations', {}) if self.r.archive else {}
        if not isinstance(saved, dict): return
        for key in KINDS:
            try: self.settings[key] = self.validate(key, saved.get(key, {}))
            except (ValueError, TypeError): pass

    def muted(self):
        p = self.r.production.settings
        return p['emergency'] or p['scene'] != 'talk'

    def event(self, kind, record, event_id):
        with self.lock:
            self.ensure()
            if self.muted(): return
            now = time.monotonic()
            for key, config in self.settings.items():
                if not config['enabled'] or config['trigger'] != kind: continue
                if kind == 'goal' and record.get('goal') != config['goal']: continue
                if kind == 'gift' and config['gift'] and config['gift'].strip().casefold() != str(record.get('gift','')).strip().casefold(): continue
                if kind in ('gift','like') and record.get('count',1) < config['amount']: continue
                identity = str(event_id).rsplit(':',1)[0] if kind == 'gift' else str(event_id)
                dedup = (key, kind, identity)
                if dedup in self.seen or now-self.last.get(key,-1e9) < config['cooldown']: continue
                self.seen[dedup] = True
                if len(self.seen)>4000: self.seen.popitem(last=False)
                self.last[key] = now
                self.serial += 1
                self.events.append(dict(id=self.serial, at=time.time(), key=key, settings=copy.deepcopy(config),
                    record={k:record.get(k) for k in ('user','avatar_url','gift','image_url','count','title')}))

    def check_goals(self):
        # Acquire counters before the effects lock, matching event ingestion order.
        totals, _ = self.r.live_counters.snapshot()
        totals.update(likes=self.r.state.get('like_count',0), viewers=self.r.state.get('viewer_count',0))
        with self.lock:
            self.ensure()
            for key, config in self.settings.items():
                if not config['enabled'] or config['trigger'] != 'goal': continue
                panel = config['goal']; metric = panel[5:]
                goal = self.r.live_counters.goals.get(panel,{})
                target = goal.get('goal', self.r.studio_state.get('like_goal',100) if metric=='likes' else 100)
                value = goal.get('value',0) if metric.startswith('custom-') else totals.get(metric,0)
                reached = value >= target
                previous = self.goal_state.get(key)
                self.goal_state[key] = (panel,target,reached)
                if previous == (panel,target,False) and reached:
                    self.event('goal',dict(goal=panel,title=goal.get('title') or '¡Meta completada!',count=value),uuid4().hex)

    def register(self, app):
        @app.route('/overlay-animations/<key>', methods=['GET','POST'])
        def animation_settings(key):
            if key not in KINDS: return jsonify(error='Animación desconocida'),404
            with self.lock:
                if request.method == 'POST':
                    try: config = self.validate(key,request.get_json(silent=True))
                    except (ValueError,TypeError): return jsonify(error='Revisa el archivo y los valores de configuración'),400
                    updated = {**self.settings,key:config}
                    if self.r.archive: self.r.archive.set_setting('overlay_animations',updated)
                    self.settings = updated
                    self.goal_state.pop(key,None)
                    self.events = deque((e for e in self.events if e['key'] != key),maxlen=60)
                return jsonify(settings=self.settings[key])

        @app.get('/widget/animation-<key>')
        def animation_widget(key):
            if key not in KINDS: return 'Animación desconocida',404
            return render_template('animation_widget.html',key=key)

        @app.get('/broadcast/animations/<key>')
        def animation_events(key):
            if key not in KINDS: return jsonify(error='Animación desconocida'),404
            self.check_goals()
            with self.lock:
                self.ensure()
                muted = self.muted() or not self.settings[key]['enabled']
                if self.muted(): self.events.clear()
                events = [] if muted else [e for e in self.events if e['key']==key and time.time()-e['at']<12]
                return jsonify(epoch=self.epoch, serial=self.serial, muted=muted,
                    events=self.r.production.sanitize(events))
