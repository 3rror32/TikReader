"""Bounded local event rules. External actions are explicit and disabled by default."""
import json
import time
import threading
import queue
import heapq
import random
import bank_storage
from collections import OrderedDict, deque, Counter
from uuid import uuid4, UUID
from urllib.request import Request, build_opener, ProxyHandler, HTTPRedirectHandler
from flask import request, jsonify, send_file, render_template

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

class Interactivity:
    def __init__(self, app, runtime):
        self.r=runtime; self.lock=threading.RLock(); self.rules=[]; self.seen=OrderedDict(); self.last={}
        self.trace=deque(maxlen=500);self.global_times=deque();self.global_limit=120;self.external_ttl=10
        self.omissions=Counter();self.checkpoint_enabled=False;self.checkpoint_at=0;self.usage={}; self.audio_owner=None; self.audio_until=0; self.session=None; self.log=deque(maxlen=100); self.effects=deque(maxlen=50); self.serial=0
        self.pending=[]; self.order=0; self.poll=None; self.remaining=0; self.running=False; self.tick=time.monotonic(); self.external=False
        self.overlay_serial=0
        self.overlay_games={
            'wheel':{'serial':0,'options':['Reto sorpresa','+1 minuto','El chat elige','Giro extra','Saludo especial','Sin premio'],'winner':'','winner_index':-1,'angle':0,'spin_start_angle':0,'spin_delta':0,'spinning':False,'duration':4.8,'turns':5,'title':'RUEDA DE LA FORTUNA','show_result':True},
            'drop':{'serial':0,'score':0,'event':None,'events':[],'title':'LLUVIA DE PUNTOS','speed':4.2,'size':64,'density':8,'show_score':True,'bank':'cochito',**bank_storage.CUSTOM_BANK_DEFAULTS}
        }
        self.restore_overlays()
        bank_storage.restore(self.r, self.overlay_games['drop'])
        self.overlay_serial=max([int(e['id']) for e in self.overlay_games['drop']['contents']]+[0])
        from app_paths import data_dir
        self.jobs=queue.Queue(maxsize=20); self.folder=data_dir()/'media'
        threading.Thread(target=self.worker,daemon=True).start()
        threading.Thread(target=self.scheduler,daemon=True).start()
        self.register(app)

    def restore_overlays(self):
        try:
            saved=(self.r.archive.settings().get('interactive_overlay_games',{}) if self.r.archive else {})
            if isinstance(saved,dict):
                for game,keys in {'wheel':('options','duration','turns','title','show_result'),'drop':('speed','size','density','title','show_score','bank',*bank_storage.CUSTOM_BANK_DEFAULTS)}.items():
                    if isinstance(saved.get(game),dict):self.overlay_games[game].update({k:saved[game][k] for k in keys if k in saved[game]})
                if self.overlay_games['drop']['title']=='LLUVIA DE DONACIONES':self.overlay_games['drop']['title']='LLUVIA DE PUNTOS'
                state=self.overlay_games['drop']
                if not isinstance(saved.get('drop'),dict) or 'bank_scales' not in saved['drop']:state.pop('bank_scales',None)
                state.update(bank_storage.normalize_custom_bank_fields(state))
                if state.get('bank')=='custom' and not state['custom_bank_asset']:state['bank']='cochito'
                state['bank_scale']=state['bank_scales'].get(state['bank'],100.0)
        except Exception:pass

    def reset_live_session(self):
        """Start a LIVE with an empty bank while preserving its appearance."""
        with self.lock:
            state = self.overlay_games['drop']
            self.overlay_serial += 1
            state.update(score=0, event=None, events=[], contents=[],
                         source_counts={}, epoch=uuid4().hex,
                         serial=self.overlay_serial)
            bank_storage.persist(self.r, state)

    def overlay_action(self, game, action, record=None):
        state = self.overlay_games[game]
        self.finish_wheel()
        if self.r.production.settings['emergency'] or self.r.production.settings['scene'] != 'talk':
            raise ValueError('Emisión silenciada')
        if game == 'wheel' and action == 'spin':
            if state['spinning']:
                raise ValueError('La rueda ya está girando')
            winner = random.randrange(len(state['options']))
            start = state['angle']; center = (winner + .5) * 360 / len(state['options'])
            delta = state['turns'] * 360 + (-center - start % 360) % 360
            state.update(angle=start+delta, spin_start_angle=start, spin_delta=delta,
                         winner=state['options'][winner], winner_index=winner, spinning=True,
                         ends_at=time.time()+state['duration'])
        elif game == 'drop' and action == 'launch':
            self.deposit_gifts(record)
        else:
            raise ValueError('Acción inválida')
        self.overlay_serial += 1
        state['serial'] = self.overlay_serial

    def deposit_gifts(self, record=None, quantity=1):
        """Store each new LIVE unit once; visual capacity is independent of totals."""
        state = self.overlay_games['drop']
        record = record or {}
        gift = record.get('gift') or 'Rose'
        image = record.get('image_url')
        gift_id = record.get('gift_id') or ('5655' if not record.get('gift') else None)
        if not image:
            names = {'rosa', 'rose'} if gift.casefold() in ('rosa', 'rose') else {gift.casefold()}
            match = next((g for g in getattr(self.r, 'gift_catalog', {}).values()
                          if (gift_id and str(g.get('id')) == str(gift_id)) or
                          str(g.get('name', '')).casefold() in names), {})
            image = match.get('image_url')
            gift_id = gift_id or match.get('id')
        quantity = max(0, int(quantity))
        if not quantity:
            return
        state['score'] = min(9999999, state['score'] + quantity)
        first = self.overlay_serial + 1
        self.overlay_serial += quantity
        events = [dict(id=first+i, drift=random.randint(-55,55),
                       rotation=random.randint(420,690), at=time.time(),
                       gift=gift, gift_id=gift_id, image_url=image,
                       user=record.get('user'), source_id=record.get('id'))
                  for i in range(max(0, quantity-220), quantity)]
        state['event'] = events[-1]
        state['events'] = (state['events'] + events)[-220:]
        state['contents'] = (state.get('contents', []) + events)[-220:]
        state['serial'] = self.overlay_serial
        source = record.get('id')
        if source:
            counts = state.setdefault('source_counts', {})
            counts[source] = counts.get(source, 0) + quantity
        bank_storage.persist(self.r, state)

    def recover_gifts(self, records):
        """Backfill received gifts without replaying units already deposited."""
        with self.lock:
            state = self.overlay_games['drop']
            counts = state.setdefault('source_counts', {})
            for record in records:
                source = record.get('id')
                if not source:
                    continue
                missing = max(0, int(record.get('count') or 1) - counts.get(source, 0))
                if missing:
                    self.deposit_gifts(record, missing)

    def finish_wheel(self):
        wheel = self.overlay_games['wheel']
        if wheel['spinning'] and time.time() >= wheel.get('ends_at', 0):
            wheel['spinning'] = False

    def note(self, text):
        self.log.appendleft({'at':time.time(),'text':text})

    def record_trace(self, rule, outcome, event=None, action=None):
        self.trace.appendleft(dict(at=time.time(),rule=str(rule)[:80],outcome=outcome,event=str(event or '')[:100],action=action))

    def timer(self):
        now=time.monotonic()
        if self.running:
            self.remaining=max(0,self.remaining-(now-self.tick))
            if self.remaining==0:self.running=False
        self.tick=now
        return round(self.remaining)

    def validate(self, rule):
        if not isinstance(rule,dict): raise ValueError('Regla inválida')
        result={'id':str(rule.get('id') or uuid4().hex)[:64], 'enabled':rule.get('enabled') is True}
        for key,limit in [('name',80),('match',100),('value',300)]: result[key]=str(rule.get(key,''))[:limit]
        result['event']=rule.get('event');result['action']=rule.get('action')
        if result['event'] not in ('comment','gift','like','follow','share','subscribe'): raise ValueError('Evento inválido')
        if result['action'] not in ('animation','sound','timer','streamerbot','minecraft','voice','video','random_sound','wheel','drop','obs_scene','obs_show','obs_hide'): raise ValueError('Acción inválida')
        if result['action']=='obs_scene' and not result['value'].strip():raise ValueError('Indica el nombre de la escena de Stream')
        if result['action'] in ('obs_show','obs_hide') and ('|' not in result['value'] or not all(p.strip() for p in result['value'].split('|',1))):raise ValueError('Indica Escena|Fuente para Stream')
        result['delay']=max(0,min(60,int(rule.get('delay',0))))
        result['cooldown']=max(1,min(3600,int(rule.get('cooldown',10))))
        result['amount']=max(1,min(3600,int(rule.get('amount',30))))
        if result['action']=='streamerbot': UUID(result['value'])
        if result['action']=='sound' and not self.media_path(result['value']).is_file(): raise ValueError('Selecciona un sonido subido')
        if result['action']=='video' and not self.video_path(result['value']).is_file():raise ValueError('Selecciona un video subido')
        if result['action']=='random_sound':
            names=result['value'].split(',')
            if not 1<=len(names)<=5 or any(not self.media_path(n.strip()).is_file() for n in names):raise ValueError('Selecciona de uno a cinco WAV separados por coma')
        result['user_limit']=max(1,min(1000,int(rule.get('user_limit',5))))
        result['budget']=max(1,min(10000,int(rule.get('budget',100))))
        steps=rule.get('steps',[])
        if not isinstance(steps,list) or len(steps)>5:raise ValueError('Máximo cinco pasos adicionales')
        result['steps']=[]
        for step in steps:
            if not isinstance(step,dict):raise ValueError('Paso inválido')
            checked=self.validate(dict(step,event=result['event'],steps=[]))
            result['steps'].append({k:checked[k] for k in ('action','value','amount','delay')})
        return result

    def media_path(self, name):
        if not isinstance(name,str) or len(name)!=36 or name[-4:]!='.wav': raise ValueError('Archivo inválido')
        UUID(hex=name[:-4]);return self.folder/name

    def event(self, kind, record, event_id, quantity=None):
        with self.lock:
            if self.session!=self.r.feed_session:
                self.session=self.r.feed_session;self.seen.clear();self.last.clear();self.effects.clear();self.usage.clear();self.pending.clear();self.poll=None
            key=(kind,str(event_id))
            if key in self.seen:
                self.record_trace('Evento','Duplicado: ya recibido',event_id,kind);return
            self.seen[key]=True
            if len(self.seen)>2000:self.seen.popitem(last=False)
            bank_synced = kind == 'gift' and quantity is not None
            if bank_synced:
                self.deposit_gifts(record, quantity)
            if self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk':
                self.record_trace('Evento','Omitido: emisión silenciada',event_id,kind);return
            if not any(r['enabled'] and r['event']==kind for r in self.rules):
                self.record_trace('Evento','Sin reglas activas para este evento',event_id,kind)
            if kind=='comment' and self.poll and self.poll['active']:
                user=str(record.get('identity') or record.get('user') or '').strip().lstrip('@').casefold()
                vote=str(record.get('comment','')).strip()
                if user and vote.isdigit() and 1<=int(vote)<=len(self.poll['options']) and user not in self.poll['voters'] and len(self.poll['voters'])<10000:
                    self.poll['voters'].add(user);self.poll['counts'][int(vote)-1]+=1
            now=time.monotonic()
            for rule in self.rules:
                if not rule['enabled'] or rule['event']!=kind:continue
                text=str(record.get('gift' if kind=='gift' else 'comment','')).casefold()
                if rule['match'] and rule['match'].casefold() not in text:self.omissions['Filtro no coincide']+=1;self.record_trace(rule['name'],'Filtro no coincide',event_id);continue
                if now-self.last.get(rule['id'],-1e9)<rule['cooldown']:self.omissions['Intervalo activo']+=1;self.record_trace(rule['name'],'Intervalo activo',event_id);continue
                self.last[rule['id']]=now
                user=str(record.get('identity') or record.get('user') or 'unknown').strip().lstrip('@').casefold()
                usage=self.usage.setdefault(rule['id'],{'total':0,'users':{}})
                if usage['total']>=rule.get('budget',100) or usage['users'].get(user,0)>=rule.get('user_limit',5):
                    self.omissions['Límite por usuario o presupuesto']+=1;self.note('Límite alcanzado: '+rule['name']);self.record_trace(rule['name'],'Límite por usuario o presupuesto',event_id);continue
                usage['total']+=1;usage['users'][user]=usage['users'].get(user,0)+1
                sequence=[rule]+rule.get('steps',[])
                if len(self.pending)+len(sequence)>200:
                    self.omissions['Cola llena']+=1;self.note('Secuencia omitida: cola de pasos llena');self.record_trace(rule['name'],'Cola llena',event_id);continue
                self.record_trace(rule['name'],'Secuencia aceptada',event_id)
                due=now
                for step in sequence:
                    step=dict(step,_event_id=str(event_id),_bank_synced=bank_synced,_context={
                        'user':str(record.get('user') or '').lstrip('@')[:80],
                        'gift':str(record.get('gift') or '')[:80],
                        'gift_id':record.get('gift_id'),
                        'image_url':record.get('image_url'),
                        'count':str(record.get('count') or 1)[:20]})
                    due+=step.get('delay',0)
                    if due<=now:self.dispatch(step,rule['name'])
                    else:
                        self.order+=1;heapq.heappush(self.pending,(due,self.order,self.session,rule['id'],dict(step),rule['name']))
                        self.record_trace(rule['name'],f'En espera: {due-now:.1f} s',event_id,step['action'])
                self.note('Regla ejecutada: '+rule['name'])

    def video_path(self,name):
        if not isinstance(name,str) or len(name)!=36 or not name.endswith('.mp4'):raise ValueError('Video inválido')
        UUID(hex=name[:-4]);return self.folder/name

    def dispatch(self,step,name):
        if step['action'] == 'drop' and step.get('_bank_synced'):
            return  # LIVE gifts are already deposited, independently of rule limits.
        now=time.monotonic()
        while self.global_times and now-self.global_times[0]>=60:self.global_times.popleft()
        if len(self.global_times)>=self.global_limit:
            self.omissions['Límite global por minuto']+=1;self.record_trace(name,'Omitida: límite global',step.get('_event_id'),action=step['action']);return
        self.global_times.append(now)
        action=step['action']
        if action in ('wheel', 'drop'):
            try:self.overlay_action(action, 'spin' if action == 'wheel' else 'launch', step.get('_context'))
            except ValueError as exc:
                self.note(str(exc));self.record_trace(name,str(exc),action=action);return
        elif action.startswith('obs_'):
            accepted=self.r.obs_direct.enqueue(action,step['value'],name,step.get('_event_id'))
            self.record_trace(name,'En cola de Stream' if accepted else 'Stream desactivado o cola llena',step.get('_event_id'),action)
            return
        elif action=='timer':
            self.timer();self.remaining=min(86400,self.remaining+step['amount'])
        elif action=='streamerbot':
            if not self.external:self.note('Streamer.bot bloqueado: conector desactivado');self.record_trace(name,'Conector desactivado',action=action);return
            try:self.jobs.put_nowait((step['value'],self.session,time.monotonic(),name))
            except queue.Full:self.note('Acción omitida: cola externa llena');self.record_trace(name,'Cola externa llena',action=action);return
        elif action=='minecraft':
            if not self.r.minecraft.enqueue(step['value'],step.get('_context')):
                self.note('Minecraft bloqueado: revisa conexión y alias');self.record_trace(name,'Minecraft bloqueado',action=action);return
        else:
            value=step['value'] or name
            if action=='random_sound':action='sound';value=random.choice([n.strip() for n in value.split(',')])
            self.serial+=1;self.effects.append(dict(id=self.serial,at=time.time(),action=action,value=value))

        self.record_trace(name,'Enviada a cola externa' if action in ('streamerbot','minecraft') else 'Ejecutada localmente',step.get('_event_id'),action=action)

    def run_due(self):
        with self.lock:
            self.finish_wheel()
            if self.session!=self.r.feed_session or self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk':
                for _,_,_,_,step,name in self.pending:
                    self.record_trace(name,'Cancelada por pausa o cambio de sesión',step.get('_event_id'),step['action'])
                self.pending.clear();return
            while self.pending and self.pending[0][0]<=time.monotonic():
                _,_,session,rid,step,name=heapq.heappop(self.pending)
                if session==self.r.feed_session and any(r['id']==rid and r['enabled'] for r in self.rules):self.dispatch(step,name)

    def scheduler(self):
        while True:
            time.sleep(.1)
            self.run_due()
            if self.checkpoint_enabled and time.monotonic()-self.checkpoint_at>10 and self.r.archive:
                try:
                    with self.lock:remaining=self.timer()
                    self.r.archive.set_setting('timer_checkpoint',remaining)
                    self.checkpoint_at=time.monotonic()
                except Exception:
                    self.checkpoint_at=time.monotonic()


    def poll_snapshot(self):
        if not self.poll:return None
        return {k:v for k,v in self.poll.items() if k!='voters'}

    def send_external(self,opener,job):
        action,session,created,name=job
        try:
            if not self.external or session!=self.r.feed_session or self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk':
                with self.lock:self.record_trace(name,'Cancelada por estado de emisión',action='streamerbot')
                return
            if time.monotonic()-created>self.external_ttl:
                with self.lock:self.record_trace(name,'Caducada antes del envío',action='streamerbot')
                return
            body=json.dumps({'action':{'id':action}}).encode()
            with opener.open(Request('http://127.0.0.1:7474/DoAction',data=body,headers={'Content-Type':'application/json'}),timeout=3) as response:
                if response.status!=204:raise ValueError('Respuesta inesperada')
            with self.lock:self.note('Streamer.bot aceptó la acción');self.record_trace(name,'Aceptada por Streamer.bot',action='streamerbot')
        except Exception:
            with self.lock:self.note('Streamer.bot no confirmó la acción; no se reintenta para evitar duplicados');self.record_trace(name,'Sin confirmación externa; no se reintenta',action='streamerbot')

    def worker(self):
        opener=build_opener(ProxyHandler({}),NoRedirect())
        while True:
            job=self.jobs.get()
            try:self.send_external(opener,job)
            finally:self.jobs.task_done()

    def register(self,app):
        @app.route('/interactivity',methods=['GET','POST'])
        def config():
            with self.lock:
                if request.method=='POST':
                    data=request.get_json(silent=True)
                    try:
                        if not isinstance(data,dict) or not isinstance(data.get('rules'),list) or len(data['rules'])>50:raise ValueError('Máximo 50 reglas')
                        rules=[self.validate(r) for r in data['rules']]
                        if len({r['id'] for r in rules})!=len(rules):raise ValueError('IDs duplicados')
                        if self.r.archive:self.r.archive.set_setting('interactive_rules',rules)
                        self.rules=rules
                    except (ValueError,TypeError) as exc:return jsonify(error=str(exc)),400
                return jsonify(mode=self.r.live_tools.effects_mode,rules=self.rules,external=self.external,log=list(self.log),remaining=self.timer(),running=self.running,poll=self.poll_snapshot(),pending=len(self.pending),serial=self.serial,muted=self.r.production.settings["emergency"] or self.r.production.settings["scene"]!="talk",
                    effects=list(self.effects) if not self.r.production.settings['emergency'] and self.r.production.settings['scene']=='talk' else [])

        @app.get('/widget/interactive')
        def interactive_widget():
            return render_template('interactive_widget.html')

        @app.get('/broadcast/interactive')
        def interactive_public():
            with self.lock:
                muted=self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk'
                effects=[e for e in self.effects if e['action'] in ('animation','video') and time.time()-e['at']<10] if not muted else []
                return jsonify(mode=self.r.live_tools.effects_mode,serial=self.serial,muted=muted,remaining=0 if muted else self.timer(),
                    effects=self.r.production.sanitize(effects),poll=None if muted else self.r.production.sanitize(self.poll_snapshot()))

        @app.route('/interactivity/overlays',methods=['GET','POST'])
        def overlay_games():
            with self.lock:
                self.finish_wheel()
                if request.method=='POST':
                    data=request.get_json(silent=True)
                    if not isinstance(data,dict):return jsonify(error='Datos inválidos'),400
                    game=data.get('game');action=data.get('action')
                    if game not in self.overlay_games:return jsonify(error='Overlay desconocido'),404
                    state=self.overlay_games[game]
                    try:
                        if action=='configure':
                            if game=='wheel':
                                options=data.get('options',state['options'])
                                if not isinstance(options,list) or not 2<=len(options)<=12 or any(not isinstance(x,str) or not x.strip() for x in options):raise ValueError('Agrega de 2 a 12 opciones')
                                turns=data.get('turns',state['turns'])
                                if isinstance(turns,bool) or not isinstance(turns,(int,float)) or not float(turns).is_integer():raise ValueError('Las vueltas deben ser un número entero')
                                state.update(options=[x.strip()[:40] for x in options],duration=max(2,min(12,float(data.get('duration',state['duration'])))),turns=max(2,min(12,int(turns))),title=str(data.get('title',state['title'])).strip()[:50] or 'RUEDA DE LA FORTUNA',show_result=data.get('show_result',state['show_result']) is True)
                            else:
                                bank=data.get('bank',state.get('bank','cochito'))
                                custom=bank_storage.validate_custom_bank_fields(data,state)
                                if bank not in bank_storage.BANKS:raise ValueError('Alcancía desconocida')
                                if bank=='custom' and not custom['custom_bank_asset']:raise ValueError('Sube una imagen para usar la alcancía personalizada')
                                configured={'speed':max(1.5,min(12,float(data.get('speed',state['speed'])))),
                                            'size':max(36,min(120,int(data.get('size',state['size'])))),
                                            'density':max(1,min(20,int(data.get('density',state['density'])))),
                                            'title':str(data.get('title',state['title'])).strip()[:50] or 'LLUVIA DE PUNTOS',
                                            'show_score':data.get('show_score',state['show_score']) is True}
                                state.update(custom,bank=bank,**configured)
                            if self.r.archive:
                                self.r.archive.set_setting('interactive_overlay_games',{name:{k:v for k,v in value.items() if k in ('options','duration','turns','title','show_result','speed','size','density','show_score','bank',*bank_storage.CUSTOM_BANK_DEFAULTS)} for name,value in self.overlay_games.items()})
                        elif (game,action) in (('wheel','spin'),('drop','launch')):
                            self.overlay_action(game,action)
                        elif game=='wheel' and action=='finish':self.finish_wheel()
                        elif game=='drop' and action=='reset':
                            self.reset_live_session()
                        elif game=='drop' and action=='shape':
                            bank=data.get('bank')
                            if bank not in bank_storage.BANKS:raise ValueError('Alcancía desconocida')
                            shape=bank_storage.validate_shape(data['shape']) if data.get('shape') is not None else None
                            custom=None
                            if bank=='custom' and any(key in data for key in bank_storage.CUSTOM_BANK_DEFAULTS):
                                custom=bank_storage.validate_custom_bank_fields(data,state)
                            if custom:state.update(custom)
                            if shape is None:state['shapes'].pop(bank,None)
                            else:state['shapes'][bank]=shape
                            if custom and self.r.archive:
                                self.r.archive.set_setting('interactive_overlay_games',{name:{k:v for k,v in value.items() if k in ('options','duration','turns','title','show_result','speed','size','density','show_score','bank',*bank_storage.CUSTOM_BANK_DEFAULTS)} for name,value in self.overlay_games.items()})
                            bank_storage.persist(self.r,state)
                        else:raise ValueError('Acción inválida')
                    except (ValueError,TypeError) as exc:return jsonify(error=str(exc) or 'Configuración inválida'),400
                    self.overlay_serial+=1;state['serial']=self.overlay_serial
                return jsonify(timer={'remaining':self.timer(),'running':self.running},wheel=self.overlay_games['wheel'],drop=self.overlay_games['drop'])

        @app.get('/broadcast/overlay-games')
        def overlay_games_public():
            with self.lock:
                self.finish_wheel()
                muted=self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk'
                if muted:return jsonify(muted=True)
                return jsonify(muted=False,timer={'remaining':self.timer(),'running':self.running},wheel=self.overlay_games['wheel'],drop=self.overlay_games['drop'])

        @app.get('/broadcast/video/<name>')
        def video_file(name):
            try:path=self.video_path(name)
            except ValueError:return jsonify(error='Video inválido'),404
            if not path.is_file():return jsonify(error='No encontrado'),404
            return send_file(path,mimetype='video/mp4')

        @app.post('/interactivity/video')
        def upload_video():
            if not request.content_length or request.content_length>20*1024*1024:return jsonify(error='Máximo 20 MB'),413
            upload=request.files.get('file');data=upload.read() if upload else b''
            if len(data)<12 or data[4:8]!=b'ftyp':return jsonify(error='Solo MP4'),400
            with self.lock:
                self.folder.mkdir(parents=True,exist_ok=True)
                if sum(p.stat().st_size for p in self.folder.glob('*.mp4'))+len(data)>100*1024*1024:return jsonify(error='Límite de videos: 100 MB'),409
                name=uuid4().hex+'.mp4';(self.folder/name).write_bytes(data)
            return jsonify(name=name)

        @app.post('/interactivity/poll')
        def configure_poll():
            data=request.get_json(silent=True)
            if not isinstance(data,dict):return jsonify(error='Datos inválidos'),400
            with self.lock:
                if data.get('action')=='stop':
                    if self.poll:self.poll['active']=False
                elif data.get('action')=='start':
                    options=data.get('options')
                    if not isinstance(options,list) or not 2<=len(options)<=6 or any(not isinstance(x,str) or not x.strip() for x in options):return jsonify(error='Elige de 2 a 6 opciones'),400
                    if self.session!=self.r.feed_session:
                        self.seen.clear();self.last.clear();self.usage.clear();self.pending.clear();self.effects.clear()
                    self.session=self.r.feed_session
                    self.poll=dict(question=str(data.get('question',''))[:150],options=[x[:80] for x in options],counts=[0]*len(options),voters=set(),active=True)
                else:return jsonify(error='Acción inválida'),400
                return jsonify(poll=self.poll_snapshot())

        @app.post('/interactivity/simulate')
        def simulate():
            data=request.get_json(silent=True)
            if not isinstance(data,dict):return jsonify(error='Datos inválidos'),400
            kind=data.get('event');text=str(data.get('text',''))[:500]
            user=str(data.get('user') or 'unknown').strip().lstrip('@').casefold()
            with self.lock:
                results=[]
                for r in self.rules:
                    usage=self.usage.get(r['id'],{'total':0,'users':{}})
                    reason=('Desactivada' if not r['enabled'] else 'Evento distinto' if kind!=r['event'] else
                        'Filtro no coincide' if r['match'].casefold() not in text.casefold() else
                        'Emisión silenciada' if self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk' else
                        'Intervalo activo' if time.monotonic()-self.last.get(r['id'],-1e9)<r['cooldown'] else
                        'Presupuesto agotado' if usage['total']>=r.get('budget',100) else
                        'Límite de usuario' if usage['users'].get(user,0)>=r.get('user_limit',5) else 'Coincide')
                    results.append(dict(name=r['name'],result=reason,actions=[r['action']]+[x['action'] for x in r.get('steps',[])]))
            return jsonify(results=results,dry_run=True)

        @app.post('/interactivity/import')
        def import_rules():
            data=request.get_json(silent=True)
            try:
                if not isinstance(data,dict) or data.get('version')!=1 or not isinstance(data.get('rules'),list):raise ValueError('Formato incompatible')
                if len(data['rules'])>50:raise ValueError('Máximo 50 reglas')
                imported=[self.validate(dict(r,id=uuid4().hex,enabled=False)) for r in data['rules']]
                with self.lock:
                    if len(self.rules)+len(imported)>50:raise ValueError('No hay espacio para todas las reglas')
                    merged=self.rules+imported
                    if self.r.archive:self.r.archive.set_setting('interactive_rules',merged)
                    self.rules=merged
                return jsonify(rules=merged)
            except (ValueError,TypeError) as exc:return jsonify(error=str(exc)),400

        @app.post('/interactivity/audio-lease')
        def audio_lease():
            data=request.get_json(silent=True)
            if not isinstance(data,dict) or not isinstance(data.get('tab'),str) or len(data['tab'])>80:return jsonify(error='Pestaña inválida'),400
            with self.lock:
                now=time.monotonic()
                if data.get('takeover') is True and data.get('confirmation') != 'USAR AUDIO AQUI':
                    return jsonify(error='Confirma el traslado de audio'),400
                if self.audio_until<now or self.audio_owner==data['tab'] or data.get('takeover') is True:
                    self.audio_owner=data['tab'];self.audio_until=now+6
                return jsonify(owner=self.audio_owner==data['tab'])

        @app.delete('/interactivity/media/<name>')
        def delete_media(name):
            try:path=self.media_path(name)
            except ValueError:return jsonify(error='Archivo inválido'),400
            with self.lock:
                if any(step['action'] in ('sound','random_sound') and name in [x.strip() for x in step['value'].split(',')] for r in self.rules for step in [r]+r.get('steps',[])):
                    return jsonify(error='El audio está referenciado por una regla; retíralo de ella primero'),409
                if not path.is_file():return jsonify(error='No encontrado'),404
                path.unlink()
            return jsonify(deleted=True)

        @app.post('/interactivity/connector')
        def connector():
            data=request.get_json(silent=True) or {}
            if not isinstance(data,dict) or data.get('confirmation')!='AUTORIZAR STREAMERBOT':return jsonify(error='Falta autorización explícita'),400
            with self.lock:self.external=data.get('enabled') is True
            return jsonify(enabled=self.external)

        @app.post('/interactivity/timer')
        def timer():
            data=request.get_json(silent=True) or {}
            with self.lock:
                try:
                    action=data.get('action');self.timer()
                    if action=='set':self.remaining=max(0,min(86400,int(data['seconds'])))
                    elif action=='start':self.running=True
                    elif action=='pause':self.running=False
                    else:raise ValueError()
                except (ValueError,TypeError,KeyError,AttributeError):return jsonify(error='Temporizador inválido'),400
                return jsonify(remaining=self.timer(),running=self.running)

        @app.route('/interactivity/media',methods=['GET','POST'])
        def media():
            if request.method=='POST':
                if not request.content_length or request.content_length>5*1024*1024:return jsonify(error='Máximo 5 MB'),413
                upload=request.files.get('file');data=upload.read() if upload else b''
                if len(data)<12 or data[:4]!=b'RIFF' or data[8:12]!=b'WAVE':return jsonify(error='Solo audio WAV'),400
                self.folder.mkdir(parents=True,exist_ok=True)
                if sum(p.stat().st_size for p in self.folder.glob('*.wav'))+len(data)>50*1024*1024:return jsonify(error='Biblioteca llena (50 MB)'),409
                name=uuid4().hex+'.wav';(self.folder/name).write_bytes(data)
                return jsonify(name=name)
            return jsonify(files=[p.name for p in self.folder.glob('*.wav')])

        @app.get('/interactivity/media/<name>')
        def media_file(name):
            try:path=self.media_path(name)
            except ValueError:return jsonify(error='Archivo inválido'),404
            if not path.is_file():return jsonify(error='No encontrado'),404
            return send_file(path,mimetype='audio/wav')
