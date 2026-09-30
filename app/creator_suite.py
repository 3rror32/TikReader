"""Local scene composition, community, calendar, starter profiles and audience games."""
import copy
import json
import re
import threading
import time
from datetime import datetime, timezone
from uuid import uuid4
from flask import jsonify, render_template, request, Response
from creator_analytics import community_report, identity
from creator_battles import BattleTracker
from creator_sounds import SOUNDS, sound_bytes


RECIPES = {
    'voice-gift': dict(name='Agradecer regalos por voz', event='gift', action='voice', value='¡Gracias por apoyar el LIVE!', cooldown=20),
    'voice-sub': dict(name='Celebrar una suscripción', event='subscribe', action='voice', value='¡Gracias por suscribirte! Bienvenido a la comunidad.', cooldown=15),
    'welcome': dict(name='Bienvenida a seguidores', event='follow', action='animation', value='¡Un nuevo integrante de la comunidad!', cooldown=10),
    'share': dict(name='Agradecer compartidos', event='share', action='animation', value='¡Gracias por compartir el LIVE!', cooldown=20),
    'wheel': dict(name='Un regalo hace girar la rueda', event='gift', action='wheel', value='', cooldown=15),
    'drop': dict(name='Regalos a la alcancía', event='gift', action='drop', value='', cooldown=2),
    'encore': dict(name='El chat pide otra ronda', event='comment', match='!otra', action='timer', amount=30, cooldown=30),
}
STARTERS = {
    'charla': dict(name='Charla', description='Chat, meta de likes y bienvenida a la comunidad.', widgets=['chat','goal-likes','alerts'], recipes=['welcome','voice-sub']),
    'gaming': dict(name='Gaming', description='Deja libre la partida; muestra regalos y juegos del chat.', widgets=['gifts','top-donors','arena'], recipes=['wheel','drop']),
    'batallas': dict(name='Batallas', description='Marcador de batalla y reconocimiento a los apoyos.', widgets=['battle','top-donors','alerts'], recipes=['voice-gift','share']),
}


def bounded(value, low, high):
    if isinstance(value, bool):
        raise ValueError('Número inválido')
    result = float(value)
    if not low <= result <= high:
        raise ValueError(f'El número debe estar entre {low} y {high}')
    return result


def text(value, limit=100):
    if not isinstance(value, str):
        raise ValueError('Texto inválido')
    return value.strip()[:limit]


def color(value):
    if not isinstance(value, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', value):
        raise ValueError('Color inválido')
    return value


class CreatorSuite:
    def __init__(self, app, runtime):
        self.r = runtime
        self.lock = threading.RLock()
        self.battles = BattleTracker(self)
        self.arena = None
        self.arena_seen = set()
        self.arena_users = {}
        self.arena_answer = ''
        self.register(app)

    def read(self, key):
        if not self.r.archive:
            raise RuntimeError('Historial no disponible. Inicia TikReader normalmente.')
        with self.r.archive.connect() as db:
            row = db.execute('SELECT value FROM settings WHERE key=?', ('creator_' + key,)).fetchone()
        return json.loads(row[0]) if row else dict(revision=0, items={})

    def write(self, key, value):
        value['revision'] += 1
        self.r.archive.set_setting('creator_' + key, value)
        return value

    def widgets(self):
        return sorted(set(self.r.WIDGET_PANELS) | {'alerts','battle','arena','stream-buddies','chat-emojis','user-info',
            'seasonal-snow','seasonal-leaves','seasonal-wind','seasonal-rain','seasonal-rain-original',
            'seasonal-fireflies','seasonal-aurora','seasonal-fog','seasonal-embers','seasonal-stars',
            'seasonal-petals','seasonal-bubbles','seasonal-digital-rain',
            *('animation-' + k for k in self.r.overlay_animations.settings)})

    def scene(self, data):
        if not isinstance(data, dict):
            raise ValueError('Escena inválida')
        w, h = int(bounded(data.get('width',1080),320,3840)), int(bounded(data.get('height',1920),320,3840))
        layers = data.get('layers', [])
        if not isinstance(layers, list) or len(layers) > 16:
            raise ValueError('Máximo 16 capas por escena')
        out = dict(name=text(data.get('name','Mi escena'),80), width=w,height=h,layers=[])
        if not out['name']:
            raise ValueError('Pon un nombre a la escena')
        ids = set()
        for layer in layers:
            if not isinstance(layer,dict):
                raise ValueError('Capa inválida')
            lid = text(layer.get('id',uuid4().hex),64)
            if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}',lid) or lid in ids:
                raise ValueError('Identificador de capa repetido o inválido')
            ids.add(lid)
            kind = layer.get('kind','widget')
            if kind not in ('widget','text','shape','media'):
                raise ValueError('Tipo de capa inválido')
            item = dict(id=lid,kind=kind,name=text(layer.get('name','Capa'),80),
                x=bounded(layer.get('x',0),0,w),y=bounded(layer.get('y',0),0,h),
                width=bounded(layer.get('width',400),20,w),height=bounded(layer.get('height',200),20,h),
                opacity=bounded(layer.get('opacity',1),0,1),visible=layer.get('visible',True) is True,
                locked=layer.get('locked',False) is True)
            if item['x']+item['width']>w+0.1 or item['y']+item['height']>h+0.1:
                raise ValueError('Una capa sale de la escena. Ajusta su posición o tamaño.')
            if kind == 'widget':
                item['widget'] = layer.get('widget','chat')
                if item['widget'] not in self.widgets():
                    raise ValueError('Overlay desconocido')
            elif kind=='media':
                asset=text(layer.get('asset',''),40)
                if not self.r.animation_studio.asset_path(asset).is_file():
                    raise ValueError('Sube primero la imagen o el video')
                item['asset']=asset
            else:
                item.update(text=text(layer.get('text',''),500),color=color(layer.get('color','#ffffff')),
                    background=color(layer.get('background','#243246')),font_size=bounded(layer.get('font_size',48),12,200),
                    radius=bounded(layer.get('radius',16),0,200))
            out['layers'].append(item)
        return out

    def asset_in_use(self, name):
        if not self.r.archive:
            return False
        for scene in self.read('scenes')['items'].values():
            for version in ('draft','published'):
                if any(l.get('asset')==name for l in scene.get(version,{}).get('layers',[])):
                    return True
        return False

    def starter_scene(self, name, horizontal=False):
        config = STARTERS[name]
        w,h = (1920,1080) if horizontal else (1080,1920)
        layers=[]
        for n, widget in enumerate(config['widgets']):
            width,height = (560,260) if horizontal else (960,360)
            x,y = (w-width-40,40+n*320) if horizontal else (60,100+n*550)
            label={'chat':'Chat','goal-likes':'Meta de likes','alerts':'Alertas visuales','gifts':'Regalos','top-donors':'Top donadores','arena':'Juegos del chat','battle':'Marcador de batalla'}[widget]
            layers.append(dict(id=uuid4().hex,kind='widget',widget=widget,name=label,x=x,y=y,width=width,height=height))
        return self.scene(dict(name=config['name'] + (' · Horizontal' if horizontal else ' · Vertical'),width=w,height=h,layers=layers))

    def add_recipes(self, names):
        i=self.r.interactive
        with i.lock:
            rules=copy.deepcopy(i.rules)
            added=[]
            for name in names:
                if name not in RECIPES:
                    raise ValueError('Plantilla desconocida')
                rid='creator-'+name
                if any(r['id']==rid for r in rules):
                    continue
                rule=i.validate(dict(RECIPES[name],id=rid,enabled=False,user_limit=3,budget=60))
                rules.append(rule)
                added.append(rule)
            if len(rules)>50:
                raise ValueError('No caben las plantillas: máximo 50 reglas')
            self.r.archive.set_setting('interactive_rules',rules)
            i.rules=rules
            return added

    def audience_event(self, kind, record, eid, delta=1):
        with self.lock:
            a=self.arena
            if not a or not a['running'] or a['session']!=self.r.feed_session or time.time()>=a['ends_at'] or self.r.production.settings['emergency']:
                return
            key=(kind,str(eid))
            if key in self.arena_seen:
                return
            self.arena_seen.add(key)
            if len(self.arena_seen)>10000:
                a['running']=False
                return
            user=identity(record.get('user'))
            if not user:
                return
            comment=str(record.get('comment','')).strip().casefold()[:300]
            if a['mode']=='trivia':
                if kind=='comment' and comment==self.arena_answer and user not in self.arena_users:
                    self.arena_users[user]='correct'
                    a['winners'].append(user)
                    a['correct']+=1
            else:
                if kind=='comment' and comment in ('!rojo','!azul') and user not in self.arena_users:
                    team=comment[1:]
                    self.arena_users[user]=team
                    a['scores'][team]+=1
                elif kind=='gift' and a['gifts'] and self.arena_users.get(user) in ('rojo','azul'):
                    a['scores'][self.arena_users[user]]+=max(0,int(delta))

    def arena_state(self):
        with self.lock:
            if self.arena and (time.time()>=self.arena['ends_at'] or self.arena['session']!=self.r.feed_session):
                self.arena['running']=False
            out=copy.deepcopy(self.arena)
            if out:
                out['winners']=out['winners'][:10]
            return out

    def register(self, app):
        @app.get('/creator')
        def creator_page():
            return render_template('creator.html')

        @app.before_request
        def creator_request():
            if request.path.startswith('/creator-api/') and request.content_length and request.content_length>1024*1024:
                return jsonify(error='Archivo demasiado grande: máximo 1 MB'),413

        @app.after_request
        def creator_cache(response):
            if request.path.startswith(('/creator','/broadcast/scene','/broadcast/creator')):
                response.headers['Cache-Control']='no-store'
            return response

        def body():
            data=request.get_json(silent=True)
            if not isinstance(data,dict):
                raise ValueError('Se esperaba una configuración')
            return data

        def protect(fn):
            from functools import wraps
            @wraps(fn)
            def wrapper(*args,**kwargs):
                try:
                    return fn(*args,**kwargs)
                except (ValueError,TypeError,KeyError,OverflowError) as exc:
                    return jsonify(error=str(exc)),400
                except RuntimeError as exc:
                    return jsonify(error=str(exc)),503
            return wrapper

        @app.get('/creator-api/catalog')
        @protect
        def catalog():
            return jsonify(widgets=self.widgets(),profiles=STARTERS,recipes=RECIPES,sounds={k:v[0] for k,v in SOUNDS.items()})

        @app.route('/creator-api/scenes',methods=['GET','POST'])
        @protect
        def scenes():
            with self.lock:
                state=self.read('scenes')
                if request.method=='POST':
                    data=body()
                    if data.get('revision')!=state['revision']:
                        return jsonify(error='La lista cambió en otra ventana. Actualiza antes de guardar.'),409
                    sid=text(data.get('id') or uuid4().hex,64)
                    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}',sid):
                        raise ValueError('Identificador inválido')
                    existing=state['items'].get(sid,{})
                    if len(state['items'])>=40 and not existing:
                        raise ValueError('Máximo 40 escenas')
                    if data.get('action')=='publish':
                        if not existing:
                            raise ValueError('Guarda primero el borrador')
                        existing['published']=copy.deepcopy(existing['draft'])
                        existing['published_at']=time.time()
                    elif data.get('action')=='delete':
                        if data.get('confirmation')!='ELIMINAR':
                            raise ValueError('Confirma ELIMINAR')
                        state['items'].pop(sid,None)
                    else:
                        existing['draft']=self.scene(data['scene'])
                    if data.get('action')!='delete':
                        state['items'][sid]=existing
                    self.write('scenes',state)
                    return jsonify(**state,selected=sid)
                return jsonify(state)

        @app.get('/widget/scene/<sid>')
        def scene_widget(sid):
            return render_template('scene_widget.html',scene_id=sid)

        @app.get('/broadcast/scene/<sid>')
        @protect
        def public_scene(sid):
            scene=self.read('scenes')['items'].get(sid,{}).get('published')
            if not scene:
                return jsonify(error='Escena sin publicar'),404
            return jsonify(scene=scene,muted=self.r.production.settings['emergency'])

        @app.get('/creator-api/community')
        @protect
        def community():
            self.read('contacts')
            days=int(bounded(request.args.get('days',0),0,36500))
            offset=int(bounded(request.args.get('offset',0),-840,840))
            return jsonify(community_report(self.r.archive,request.args.get('creator',''),days,offset))

        @app.route('/creator-api/contacts',methods=['GET','POST'])
        @protect
        def contacts():
            with self.lock:
                state=self.read('contacts')
                if request.method=='POST':
                    data=body()
                    if data.get('revision')!=state['revision']:
                        return jsonify(error='Las notas cambiaron. Actualiza e intenta otra vez.'),409
                    key=text(data.get('key',''),210)
                    if ':' not in key:
                        raise ValueError('Selecciona un participante')
                    birthday=text(data.get('birthday',''),5)
                    if birthday:
                        datetime.strptime('2000-'+birthday,'%Y-%m-%d')
                    tags=data.get('tags',[])
                    if not isinstance(tags,list) or len(tags)>8:
                        raise ValueError('Máximo ocho etiquetas')
                    state['items'][key]=dict(notes=text(data.get('notes',''),2000),birthday=birthday,
                        tags=[text(t,30) for t in tags])
                    self.write('contacts',state)
                return jsonify(state)

        @app.route('/creator-api/calendar',methods=['GET','POST'])
        @protect
        def calendar():
            with self.lock:
                state=self.read('calendar')
                if request.method=='POST':
                    data=body()
                    if data.get('revision')!=state['revision']:
                        return jsonify(error='El calendario cambió. Actualiza antes de guardar.'),409
                    eid=text(data.get('id') or uuid4().hex,64)
                    if data.get('action')=='delete':
                        if data.get('confirmation')!='ELIMINAR':
                            raise ValueError('Confirma ELIMINAR')
                        state['items'].pop(eid,None)
                    else:
                        if len(state['items'])>=1000 and eid not in state['items']:
                            raise ValueError('Máximo 1000 eventos')
                        start=bounded(data['start'],0,4102444800)
                        title=text(data.get('title',''),100)
                        if not title:
                            raise ValueError('Escribe el nombre del evento')
                        scene=text(data.get('scene',''),64)
                        if scene and scene not in self.read('scenes')['items']:
                            raise ValueError('La escena ya no existe')
                        profile=text(data.get('profile',''),30)
                        if profile and profile not in STARTERS:
                            raise ValueError('Perfil desconocido')
                        state['items'][eid]=dict(id=eid,title=title,start=start,duration=bounded(data.get('duration',60),5,1440),
                            remind=bounded(data.get('remind',15),0,1440),notes=text(data.get('notes',''),1000),scene=scene,profile=profile)
                    self.write('calendar',state)
                return jsonify(state)

        @app.get('/creator-api/calendar.ics')
        @protect
        def calendar_export():
            def escape(value):
                return str(value).replace('\\','\\\\').replace('\r','').replace('\n','\\n').replace(';','\\;').replace(',','\\,')
            def stamp(value):
                return datetime.fromtimestamp(value,timezone.utc).strftime('%Y%m%dT%H%M%SZ')
            lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TikReader//Calendario local//ES']
            for event in self.read('calendar')['items'].values():
                lines.extend(['BEGIN:VEVENT','UID:'+escape(event['id'])+'@tikreader.local','DTSTAMP:'+stamp(time.time()),
                    'DTSTART:'+stamp(event['start']),'DTEND:'+stamp(event['start']+event['duration']*60),
                    'SUMMARY:'+escape(event['title']),'DESCRIPTION:'+escape(event['notes']),
                    'BEGIN:VALARM','TRIGGER:-PT'+str(int(event['remind']))+'M','ACTION:DISPLAY',
                    'DESCRIPTION:'+escape(event['title']),'END:VALARM','END:VEVENT'])
            lines.append('END:VCALENDAR')
            folded=[]
            for line in lines:
                current=''
                for char in line:
                    if len((current+char).encode('utf-8'))>74:
                        folded.append(current)
                        current=' '
                    current+=char
                folded.append(current)
            return Response('\r\n'.join(folded)+'\r\n',mimetype='text/calendar',headers={'Content-Disposition':'attachment; filename="tikreader-calendario.ics"'})

        @app.post('/creator-api/recipes/<name>')
        @protect
        def add_recipe(name):
            return jsonify(added=self.add_recipes([name]))

        @app.route('/creator-api/sounds/<name>',methods=['GET','POST'])
        @protect
        def sounds(name):
            if name not in SOUNDS:
                raise ValueError('Sonido desconocido')
            if request.method=='GET':
                return Response(sound_bytes(name),mimetype='audio/wav')
            with self.lock,self.r.interactive.lock:
                i=self.r.interactive
                rid='creator-sound-'+name
                if any(r['id']==rid for r in i.rules):
                    return jsonify(added=False)
                if len(i.rules)>=50:
                    raise ValueError('Máximo 50 reglas')
                self.read('sounds')
                filename=uuid4().hex+'.wav'
                i.folder.mkdir(parents=True,exist_ok=True)
                i.media_path(filename).write_bytes(sound_bytes(name))
                try:
                    rule=i.validate(dict(id=rid,name=SOUNDS[name][0],event='gift',action='sound',value=filename,enabled=False,cooldown=15,user_limit=3,budget=60))
                    rules=i.rules+[rule]
                    self.r.archive.set_setting('interactive_rules',rules)
                    i.rules=rules
                except Exception:
                    i.media_path(filename).unlink(missing_ok=True)
                    raise
                return jsonify(added=True,rule=rule)

        @app.route('/creator-api/boosters',methods=['GET','POST'])
        @protect
        def boosters():
            with self.lock:
                state=self.read('boosters')
                if request.method=='POST':
                    data=body()
                    if data.get('revision')!=state['revision']:
                        return jsonify(error='Los potenciadores cambiaron. Actualiza la lista.'),409
                    bid=text(data.get('id') or uuid4().hex,64)
                    if data.get('action')=='used':
                        if bid not in state['items']:
                            raise ValueError('Potenciador no encontrado')
                        state['items'][bid]['used']=True
                    else:
                        if len(state['items'])>=1000 and bid not in state['items']:
                            raise ValueError('Máximo 1000 potenciadores registrados')
                        state['items'][bid]=dict(id=bid,user=text(data.get('user',''),100),
                            name=text(data.get('name',''),80),expires=bounded(data.get('expires'),0,4102444800),used=False)
                    self.write('boosters',state)
                return jsonify(state)

        @app.post('/creator-api/profiles/<name>')
        @protect
        def starter(name):
            if name not in STARTERS:
                raise ValueError('Perfil desconocido')
            data=body()
            previews=[self.starter_scene(name),self.starter_scene(name,True)]
            if data.get('action')!='apply':
                return jsonify(scenes=previews,recipes=[RECIPES[k] for k in STARTERS[name]['recipes']])
            with self.lock:
                state=self.read('scenes')
                # Stable IDs make repeated use idempotent. Preserve edited starter scenes.
                missing=[(f'profile-{name}-{n}',p) for n,p in enumerate(previews) if f'profile-{name}-{n}' not in state['items']]
                if len(state['items'])+len(missing)>40:
                    raise ValueError('No hay espacio para las escenas del perfil')
                added=self.add_recipes(STARTERS[name]['recipes'])
                for sid,p in missing:
                    state['items'][sid]=dict(draft=p)
                self.write('scenes',state)
                return jsonify(scenes=state,added=added,notice='Escenas preparadas como borradores y nuevas reglas desactivadas. Tus ajustes anteriores se conservan.')

        @app.route('/creator-api/battles',methods=['GET','POST'])
        @protect
        def battles():
            with self.lock:
                state=self.read('battles')
                if request.method=='POST':
                    data=body()
                    if data.get('revision')!=state['revision']:
                        return jsonify(error='La batalla recibió datos nuevos. Actualiza antes de guardar.'),409
                    bid=text(data.get('id') or uuid4().hex,64)
                    old=state['items'].get(bid,{})
                    if old.get('source')=='tiktok':
                        old['notes']=text(data.get('notes',''),1000)
                        old['my_side']=text(data.get('my_side',''),40)
                        old['label']=text(data.get('label',''),100)
                        if old['my_side'] and old['my_side'] not in old['sides']:
                            raise ValueError('Selecciona un anfitrión recibido')
                        if self.battles.latest and self.battles.latest['id']==bid:
                            self.battles.latest.update(notes=old['notes'],my_side=old['my_side'],label=old['label'])
                    else:
                        status=data.get('status','live')
                        if status not in ('live','finished','interrupted'):
                            raise ValueError('Estado inválido')
                        mine=int(bounded(data.get('mine',0),0,10**12))
                        rival=int(bounded(data.get('rival',0),0,10**12))
                        old=dict(id=bid,source='manual',creator=self.r.state.get('username',''),status=status,session=self.r.feed_session,
                            started_at=old.get('started_at',time.time()),updated_at=time.time(),
                            ends_at=old.get('ends_at',time.time()+bounded(data.get('duration',300),30,3600)),my_side='me',
                            sides={'me':dict(id='me',user='Mi equipo',score=mine,supporters=[]),
                                'rival':dict(id='rival',user=text(data.get('opponent','Rival'),100),score=rival,supporters=[])},
                            result=('win' if mine>rival else 'loss' if mine<rival else 'draw') if status=='finished' else 'unknown',
                            notes=text(data.get('notes',''),1000),bonus=None)
                    state['items'][bid]=old
                    self.write('battles',state)
                return jsonify(**state,live=self.battles.snapshot(),connected=self.r.state['connected'])

        @app.route('/creator-api/arena',methods=['GET','POST'])
        @protect
        def arena():
            if request.method=='POST':
                data=body()
                with self.lock:
                    if data.get('action')=='stop':
                        if self.arena:
                            self.arena['running']=False
                    else:
                        mode=data.get('mode','race')
                        if mode not in ('race','trivia'):
                            raise ValueError('Juego desconocido')
                        answer=text(data.get('answer',''),300).casefold()
                        if mode=='trivia' and not answer:
                            raise ValueError('Escribe la respuesta correcta')
                        if self.arena and self.arena_state()['running']:
                            raise ValueError('Termina la ronda actual antes de iniciar otra')
                        self.arena=dict(id=uuid4().hex,mode=mode,title=text(data.get('title','Carrera del chat'),200),
                            running=True,session=self.r.feed_session,ends_at=time.time()+bounded(data.get('duration',120),15,1800),
                            scores=dict(rojo=0,azul=0),winners=[],correct=0,gifts=data.get('gifts',False) is True)
                        self.arena_answer=answer
                        self.arena_seen.clear()
                        self.arena_users.clear()
            return jsonify(game=self.arena_state())

        @app.get('/widget/battle')
        @app.get('/widget/arena')
        def creator_widget():
            return render_template('creator_widget.html',kind=request.path.rsplit('/',1)[1])

        @app.get('/broadcast/creator/<kind>')
        @protect
        def creator_broadcast(kind):
            if kind not in ('battle','arena'):
                return jsonify(error='Overlay desconocido'),404
            value=self.arena_state() if kind=='arena' else self.battles.snapshot()
            if kind=='battle' and not value:
                rows=self.read('battles')['items'].values()
                value=max((x for x in rows if x['source']=='manual' and x.get('session')==self.r.feed_session),key=lambda x:x['updated_at'],default=None)
            if value and kind=='battle':
                value={k:v for k,v in value.items() if k in ('id','status','source','sides','ends_at','updated_at','my_side')}
            if value and kind=='arena' and self.r.production.settings['hide_names']:
                value['winners']=['Participante' for _ in value.get('winners',[])]
            return jsonify(data=self.r.production.sanitize(value),muted=self.r.production.settings['emergency'],now=time.time(),connected=self.r.state['connected'])
