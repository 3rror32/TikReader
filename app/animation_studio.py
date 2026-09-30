"""Local visual gift alerts. Preview stays in the browser; live output is read-only."""
import copy
import re
import threading
import time
from contextlib import nullcontext
from collections import OrderedDict, deque
from uuid import uuid4
from flask import jsonify, request, render_template, send_file


class AnimationStudio:
    def __init__(self, app, runtime):
        self.r=runtime
        self.lock=threading.RLock()
        from app_paths import data_dir
        self.folder=data_dir()/'alert_media'
        self.templates=[]
        self.events=deque(maxlen=30)
        self.fired=OrderedDict()
        self.last={}
        self.session=None
        self.serial=0
        self.epoch=uuid4().hex
        self.register(app)

    def asset_path(self,name):
        if not isinstance(name,str) or not re.fullmatch(r'[a-f0-9]{32}\.(png|jpg|gif|webp|mp4|webm)',name):
            raise ValueError('Archivo de alerta inválido')
        return self.folder/name

    def validate(self, data):
        if not isinstance(data,dict):raise ValueError('Alerta inválida')
        out={k:str(data.get(k,''))[:limit] for k,limit in [('id',64),('name',80),('text',300),('gift',100),('asset',40)]}
        out['id']=out['id'] or uuid4().hex
        if not re.fullmatch(r'[a-zA-Z0-9-]{1,64}',out['id']):raise ValueError('Identificador inválido')
        if not out['name'].strip():raise ValueError('Pon un nombre a la alerta')
        if not out['text'].strip() and not out['asset']:raise ValueError('Agrega texto, una imagen o un video')
        if out['asset'] and not self.asset_path(out['asset']).is_file():raise ValueError('El archivo no existe. Súbelo antes de guardar.')
        out['color']=str(data.get('color','#ffffff'))
        if not re.fullmatch(r'#[a-fA-F0-9]{6}',out['color']):raise ValueError('Color inválido')
        legacy_animation=data.get('animation','pop')
        if legacy_animation=='slide':legacy_animation='slide-up'
        out['enter_animation']=data.get('enter_animation',legacy_animation)
        out['idle_animation']=data.get('idle_animation','none')
        out['exit_animation']=data.get('exit_animation','fade')
        out['motion']=data.get('motion','full')
        out['animation']=out['enter_animation']
        out['position']=data.get('position','center')
        if out['enter_animation'] not in ('fade','slide-up','slide-left','slide-right','pop','bounce','flip','blur','none'):raise ValueError('Animación de entrada inválida')
        if out['idle_animation'] not in ('float','pulse','shake','swing','glow','heartbeat','none'):raise ValueError('Animación continua inválida')
        if out['exit_animation'] not in ('fade','slide-down','slide-left','slide-right','shrink','blur','none'):raise ValueError('Animación de salida inválida')
        if out['motion'] not in ('full','reduced'):raise ValueError('Preferencia de movimiento inválida')
        if out['position'] not in ('top','center','bottom'):raise ValueError('Posición inválida')
        for key,default,low,high in [('size',40,16,96),('duration',5,2,30),('amount',1,1,9999),('cooldown',10,1,3600)]:
            try:out[key]=int(data.get(key,default))
            except (TypeError,ValueError,OverflowError):raise ValueError('Número inválido: '+key)
            if not low<=out[key]<=high:raise ValueError(f'{key}: debe estar entre {low} y {high}')
        out['enabled']=data.get('enabled') is True
        return out

    def persist(self,templates):
        if self.r.archive:self.r.archive.set_setting('animation_templates',templates)
        self.templates=templates

    def restore(self):
        saved=self.r.archive.settings().get('animation_templates',[]) if self.r.archive else []
        self.templates=[]
        for item in saved[:30] if isinstance(saved,list) else []:
            try:self.templates.append(self.validate(dict(item,enabled=False)))
            except (ValueError,TypeError):continue

    def gift(self,record,event_id):
        with self.lock:
            if self.session!=self.r.feed_session:
                self.session=self.r.feed_session;self.last.clear();self.fired.clear();self.events.clear()
            if self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk':return
            now=time.monotonic()
            for template in self.templates:
                if not template['enabled']:continue
                if template['gift'] and template['gift'].strip().casefold()!=str(record.get('gift','')).strip().casefold():continue
                if int(record.get('count',1))<template['amount']:continue
                key=(template['id'],str(event_id).rsplit(':',1)[0])
                if key in self.fired or now-self.last.get(template['id'],-1e9)<template['cooldown']:continue
                self.fired[key]=True;self.last[template['id']]=now
                if len(self.fired)>2000:self.fired.popitem(last=False)
                self.serial+=1
                self.events.append({'id':self.serial,'at':time.time(),'template':copy.deepcopy(template),
                                    'record':{'user':record.get('user','Participante'),'gift':record.get('gift','Regalo'),'count':record.get('count',1)}})


    def register(self,app):
        @app.route('/animation-studio',methods=['GET','POST'])
        def alert_studio_configuration():
            with self.lock:
                if request.method=='POST':
                    try:
                        template=self.validate(request.get_json(silent=True))
                        others=[x for x in self.templates if x['id']!=template['id']]
                        if len(others)>=30:raise ValueError('Máximo 30 alertas')
                        self.persist(others+[template])
                    except (ValueError,TypeError) as exc:return jsonify(error=str(exc)),400
                return jsonify(templates=self.templates,muted=self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk',connected=self.r.state['connected'])

        @app.delete('/animation-studio/templates/<tid>')
        def alert_studio_remove_template(tid):
            with self.lock:self.persist([t for t in self.templates if t['id']!=tid])
            return jsonify(ok=True)

        @app.route('/animation-studio/media',methods=['GET','POST'])
        def alert_studio_media():
            with self.lock:
                if request.method=='POST':
                    if not request.content_length or request.content_length>21*1024*1024:return jsonify(error='Máximo 20 MB por archivo'),413
                    upload=request.files.get('file');data=upload.read(20*1024*1024+1) if upload else b''
                    if len(data)>20*1024*1024:return jsonify(error='Máximo 20 MB por archivo'),413
                    extension=None
                    if data.startswith(b'\x89PNG\r\n\x1a\n'):extension='png'
                    elif data.startswith(b'\xff\xd8\xff'):extension='jpg'
                    elif data.startswith((b'GIF87a',b'GIF89a')):extension='gif'
                    elif data[:4]==b'RIFF' and data[8:12]==b'WEBP':extension='webp'
                    elif len(data)>=12 and data[4:8]==b'ftyp':extension='mp4'
                    if data.startswith(b'\x1a\x45\xdf\xa3') and b'webm' in data[:4096]:extension='webm'
                    if not extension:return jsonify(error='Usa PNG, JPG, GIF, WebP, MP4 o WebM. No se admiten SVG ni HTML.'),400
                    self.folder.mkdir(parents=True,exist_ok=True)
                    if sum(p.stat().st_size for p in self.folder.iterdir() if p.is_file())+len(data)>100*1024*1024:return jsonify(error='Biblioteca llena: máximo 100 MB'),409
                    name=uuid4().hex+'.'+extension;self.asset_path(name).write_bytes(data)
                    return jsonify(name=name)
                return jsonify(files=[p.name for p in self.folder.glob('*') if p.is_file() and re.fullmatch(r'[a-f0-9]{32}\.(png|jpg|gif|webp|mp4|webm)',p.name)])

        @app.delete('/animation-studio/media/<name>')
        def alert_studio_remove_media(name):
            try:path=self.asset_path(name)
            except ValueError:return jsonify(error='Archivo inválido'),400
            suite=getattr(self.r,'creator_suite',None)
            with suite.lock if suite else nullcontext(), self.lock:
                if suite and suite.asset_in_use(name):return jsonify(error='Una escena usa este archivo. Retíralo del borrador y de la escena publicada primero.'),409
                if any(t['asset']==name for t in self.templates) or any(t['asset']==name for t in getattr(getattr(self.r,'overlay_animations',None),'settings',{}).values()):return jsonify(error='Una alerta usa este archivo. Cámbiala o elimínala primero.'),409
                if not path.is_file():return jsonify(error='Archivo no encontrado'),404
                path.unlink()
            return jsonify(ok=True)

        @app.get('/broadcast/alert-media/<name>')
        def alert_studio_asset(name):
            try:path=self.asset_path(name)
            except ValueError:return jsonify(error='Archivo inválido'),404
            if not path.is_file():return jsonify(error='Archivo no encontrado'),404
            response=send_file(path,mimetype={'.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm'}[path.suffix])
            response.headers['X-Content-Type-Options']='nosniff'
            return response

        @app.get('/widget/alerts')
        def alert_studio_overlay():return render_template('alert_widget.html')

        @app.get('/broadcast/alerts')
        def alert_studio_events():
            with self.lock:
                muted=self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk'
                events=[e for e in self.events if time.time()-e['at']<10] if not muted else []
                output=[]
                for event in self.r.production.sanitize(events):
                    record=event.pop('record')
                    values={'usuario':record['user'],'regalo':record['gift'],'cantidad':record['count']}
                    event['text']=re.sub(r'\{(usuario|regalo|cantidad)\}',lambda match:str(values[match[1]]),event['template']['text'])
                    output.append(event)
                return jsonify(epoch=self.epoch,serial=self.serial,muted=muted,events=self.r.production.sanitize(output))
