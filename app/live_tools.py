"""Read-only live checks, rule templates and local media catalogue."""
import time
from uuid import uuid4
from flask import request,jsonify

class LiveTools:
    def __init__(self,app,r):
        self.r=r;self.guided=None;self.effects_mode='enqueue';self.register(app)

    def assets(self):
        i=self.r.interactive
        labels=self.r.archive.settings().get('media_labels',{}) if self.r.archive else {}
        rows=[]
        with i.lock:
            steps=[s for rule in i.rules for s in [rule]+rule.get('steps',[])]
            for p in sorted(i.folder.glob('*')):
                if p.suffix not in ('.wav','.mp4') or not p.is_file() or p.is_symlink():continue
                used=sum(p.name in [x.strip() for x in s.get('value','').split(',')] for s in steps if s['action'] in ('sound','random_sound','video'))
                rows.append(dict(name=p.name,label=labels.get(p.name,p.name),bytes=p.stat().st_size,used_by=used,type=p.suffix[1:]))
        return rows

    def register(self,app):
        @app.route('/live-tools/effects',methods=['GET','POST'])
        def lt_effects():
            if request.method=='POST':
                data=request.get_json(silent=True)
                if not isinstance(data,dict) or data.get('mode') not in ('enqueue','replace','skip'):return jsonify(error='Modo inválido'),400
                self.effects_mode=data['mode']
                if self.r.archive:self.r.archive.set_setting('effects_mode',self.effects_mode)
            return jsonify(mode=self.effects_mode)

        @app.get('/live-tools/state')
        def lt_state():
            with self.r.feed_lock:
                return jsonify(session=self.r.feed_session,connected=self.r.state['connected'],connecting=self.r.state['connecting'],
                    stats=self.r.stats_payload(),diagnostics=dict(self.r.diagnostics),audit=self.r.operator_tools.audit(),at=time.time())

        @app.route('/live-tools/guided',methods=['GET','POST'])
        def lt_guided():
            with self.r.feed_lock:
                if request.method=='POST':
                    data=request.get_json(silent=True)
                    if not isinstance(data,dict):return jsonify(error='Datos inválidos'),400
                    if data.get('action')=='start':
                        self.guided=dict(id=uuid4().hex,session=self.r.feed_session,started=time.time(),baseline=self.r.stats_payload(),manual={})
                    elif data.get('action')=='mark':
                        if not self.guided:return jsonify(error='Inicia una prueba primero'),400
                        if data.get('check') not in ('audio','likes_match','viewers_match','reconnect') or type(data.get('passed')) is not bool:return jsonify(error='Comprobación inválida'),400
                        self.guided['manual'][data['check']]=dict(passed=data['passed'],at=time.time())
                    elif data.get('action')=='save':
                        if not self.guided:return jsonify(error='No hay prueba'),400
                        pass # Saved after refreshing observations below.
                    else:return jsonify(error='Acción inválida'),400
                if not self.guided and request.method=='GET' and self.r.archive:self.guided=self.r.archive.settings().get('last_guided_test')
                if not self.guided:return jsonify(test=None)
                current=self.r.stats_payload();base=self.guided['baseline'];same=self.r.feed_session==self.guided['session']
                observed={key:same and current.get(key,0)>base.get(key,0) for key in ('comments','like_events','gifts')}
                self.guided['observed']=observed;self.guided['same_session']=same;self.guided['last_checked']=time.time()
                if request.method=='POST' and data.get('action')=='save' and self.r.archive:self.r.archive.set_setting('last_guided_test',self.guided)
                return jsonify(test=self.guided,connected=self.r.state['connected'])

        @app.get('/live-tools/templates')
        def lt_templates():return jsonify(templates=[
            dict(id='thanks',name='Agradecer un regalo',description='Muestra un agradecimiento cuando llega un regalo.'),
            dict(id='command',name='Responder a !hola',description='Muestra una respuesta en el panel; no publica en TikTok.'),
            dict(id='timer',name='Regalo añade 30 segundos',description='Amplía el temporizador, con límites por usuario.')])

        @app.post('/live-tools/templates/<name>')
        def lt_use_template(name):
            choices={'thanks':dict(event='gift',action='animation',value='¡Gracias por tu regalo!',name='Agradecer un regalo'),
                     'command':dict(event='comment',match='!hola',action='animation',value='¡Bienvenido al LIVE!',name='Responder a !hola'),
                     'timer':dict(event='gift',action='timer',amount=30,name='Regalo añade 30 segundos')}
            if name not in choices:return jsonify(error='Plantilla desconocida'),404
            i=self.r.interactive
            with i.lock:
                if len(i.rules)>=50:return jsonify(error='Máximo 50 reglas'),409
                rule=i.validate(dict(choices[name],enabled=False,cooldown=10,user_limit=5,budget=100))
                rules=i.rules+[rule]
                if self.r.archive:self.r.archive.set_setting('interactive_rules',rules)
                i.rules=rules
                return jsonify(rule=rule)

        @app.route('/live-tools/assets',methods=['GET','POST','DELETE'])
        def lt_media():
            if request.method=='GET':return jsonify(files=self.assets())
            data=request.get_json(silent=True)
            if not isinstance(data,dict):return jsonify(error='Datos inválidos'),400
            i=self.r.interactive;name=data.get('name','')
            try:path=i.video_path(name) if str(name).endswith('.mp4') else i.media_path(name)
            except ValueError:return jsonify(error='Archivo inválido'),400
            with i.lock:
                if not path.is_file() or path.is_symlink():return jsonify(error='No encontrado'),404
                if request.method=='DELETE':
                    row=next((x for x in self.assets() if x['name']==name),None)
                    if row and row['used_by']:return jsonify(error='Retira el archivo de las reglas antes de eliminarlo'),409
                    if data.get('confirmation')!='ELIMINAR':return jsonify(error='Confirma ELIMINAR'),400
                    path.unlink()
                else:
                    label=str(data.get('label','')).strip()[:80]
                    if not label:return jsonify(error='Escribe un nombre'),400
                    if not self.r.archive:return jsonify(error='Almacenamiento no disponible'),503
                    labels=self.r.archive.settings().get('media_labels',{});labels[name]=label
                    self.r.archive.set_setting('media_labels',labels)
                return jsonify(ok=True)
