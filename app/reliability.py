"""Opt-in configuration transactions, bounded rehearsal and support previews."""
import copy
import hashlib
import json
import time
from flask import request, jsonify

class Reliability:
    def __init__(self,app,r):
        self.r=r;self.draft=None;self.undo=[];self.voice={};self.labels={};self.register(app)
    def restore(self):
        saved=self.r.archive.settings() if self.r.archive else {}
        self.r.interactive.global_limit=max(1,min(1000,int(saved.get('global_limit',120))))
        self.r.interactive.external_ttl=max(1,min(60,int(saved.get('external_ttl',10))))
        self.draft=saved.get('config_draft');self.undo=saved.get('config_undo',[])[:10]
    def snapshot(self):
        r=self.r;saved=r.archive.settings() if r.archive else {}
        return dict(rules=copy.deepcopy(r.interactive.rules),production={k:r.production.settings[k] for k in ('hide_names','hide_photos','redact')},effects_mode=r.live_tools.effects_mode,media_labels=saved.get('media_labels',self.labels),global_limit=r.interactive.global_limit,external_ttl=r.interactive.external_ttl,voice=saved.get('draft_voice',self.voice))
    @staticmethod
    def fingerprint(config):return hashlib.sha256(json.dumps(config,sort_keys=True).encode()).hexdigest()
    def validate(self,data):
        if not isinstance(data,dict):raise ValueError('Configuración inválida')
        rules=data.get('rules')
        if not isinstance(rules,list) or len(rules)>50:raise ValueError('Máximo 50 reglas')
        rules=[self.r.interactive.validate(x) for x in rules]
        if len(set(x['id'] for x in rules))!=len(rules):raise ValueError('IDs duplicados')
        prod=data.get('production',{})
        if not isinstance(prod,dict) or any(type(prod.get(k)) is not bool for k in ('hide_names','hide_photos','redact')):raise ValueError('Privacidad inválida')
        mode=data.get('effects_mode','enqueue')
        if mode not in ('enqueue','replace','skip'):raise ValueError('Política inválida')
        labels=data.get('media_labels',{})
        if not isinstance(labels,dict) or len(labels)>1000 or any(not isinstance(k,str) or len(k)>80 or not isinstance(v,str) or len(v)>80 for k,v in labels.items()):raise ValueError('Etiquetas inválidas')
        limit=data.get('global_limit',120);ttl=data.get('external_ttl',10)
        if type(limit) is not int or not 1<=limit<=1000 or type(ttl) is not int or not 1<=ttl<=60:raise ValueError('Límite 1–1000; caducidad 1–60 segundos')
        voice=data.get('voice',{})
        allowed={'blocked-words','antispam','no-emoji','tts-restrict','tts-audience','tts-allowed-users','tts-rate','tts-volume','tts-max-age','tts-priority','priority-users','tts-voice','alert-tone','alert-gift','alert-min'}
        if not isinstance(voice,dict) or any(k not in allowed or not isinstance(v,(str,bool,int,float)) or len(str(v))>2000 for k,v in voice.items()):raise ValueError('Filtros de voz inválidos')
        return dict(rules=rules,production={k:prod[k] for k in ('hide_names','hide_photos','redact')},effects_mode=mode,media_labels=labels,global_limit=limit,external_ttl=ttl,voice=voice)
    def commit(self,config,undo,draft):
        r=self.r;prod=dict(r.production.settings,**config['production']);prod['revision']+=1
        settings=dict(interactive_rules=config['rules'],production_config=prod,effects_mode=config['effects_mode'],media_labels=config['media_labels'],global_limit=config['global_limit'],external_ttl=config['external_ttl'],draft_voice=config['voice'],config_undo=undo,config_draft=draft)
        if r.archive:
            with r.archive.connect() as db:db.executemany('INSERT OR REPLACE INTO settings VALUES (?,?)',[(k,json.dumps(v)) for k,v in settings.items()])
        r.interactive.rules=config['rules'];r.interactive.pending.clear();r.interactive.effects.clear()
        r.production.settings=prod;r.live_tools.effects_mode=config['effects_mode'];r.interactive.global_limit=config['global_limit'];r.interactive.external_ttl=config['external_ttl']
        self.undo=undo;self.draft=draft;self.voice=copy.deepcopy(config['voice']);self.labels=copy.deepcopy(config['media_labels'])
    def rehearse(self,rows,config):
        # All mutable counters belong exclusively to this call. No live dispatcher is used.
        last={};usage={};window=[];results=[];prefs=config['voice']
        for n,row in enumerate(rows[-500:]):
            kind=row.get('kind');text=str(row.get('comment' if kind=='comment' else 'gift',''));user=str(row.get('user','')).lstrip('@').casefold();at=n
            entry={'event':n+1,'kind':kind,'text':text[:400],'voice':False,'rules':[]}
            if kind=='comment':
                blocked=any(w.strip().casefold() in (user+' '+text).casefold() for w in str(prefs.get('blocked-words','')).split(',') if w.strip())
                audience=not prefs.get('tts-restrict') or (prefs.get('tts-audience')=='followers' and row.get('is_follower') is True) or (prefs.get('tts-audience')=='selected' and user in str(prefs.get('tts-allowed-users','')).replace(';',',').replace(' ',',').lower().replace('@','').split(','))
                entry['voice']=bool(text.strip() and not blocked and audience)
            for rule in config['rules']:
                if rule['event']!=kind:continue
                key=rule['id'];count,users=usage.setdefault(key,[0,{}]);reason='Coincide'
                if not rule['enabled']:reason='Desactivada'
                elif rule['match'].casefold() not in text.casefold():reason='Filtro no coincide'
                elif at-last.get(key,-10000)<rule['cooldown']:reason='Intervalo activo'
                elif count>=rule['budget'] or users.get(user,0)>=rule['user_limit']:reason='Límite de regla'
                else:
                    window=[x for x in window if at-x<60];cost=1+len(rule['steps'])
                    if len(window)+cost>config['global_limit']:reason='Límite global'
                    else:window.extend([at]*cost);last[key]=at;usage[key][0]+=1;users[user]=users.get(user,0)+1
                entry['rules'].append(dict(name=rule['name'],result=reason,steps=[s['action'] for s in [rule]+rule['steps']] if reason=='Coincide' else []))
            results.append(entry)
        return dict(private=True,results=results,scope='Simulación de hasta 500 registros, separados por 1 segundo virtual. Calcula filtros, intervalos y límites; no reproduce sonido ni ejecuta efectos. No reproduce tiempos originales, retrasos de pasos ni antispam del navegador.')
    def register(self,app):
        @app.route('/reliability/config',methods=['GET','POST'])
        def reliability_config():
            with self.r.feed_lock,self.r.interactive.lock:
                current=self.snapshot();revision=self.fingerprint(current)
                if request.method=='GET':return jsonify(config=current,revision=revision,draft=self.draft,undo_available=bool(self.undo))
                data=request.get_json(silent=True)
                try:
                    if not isinstance(data,dict):raise ValueError('Datos inválidos')
                    action=data.get('action')
                    if action=='save':
                        config=self.validate(data.get('config'));draft=dict(config=config,base=data.get('base'),at=time.time())
                        if self.r.archive:self.r.archive.set_setting('config_draft',draft)
                        self.draft=draft;return jsonify(ok=True,draft=draft)
                    if action=='publish':
                        if data.get('confirmation')!='PUBLICAR':raise ValueError('Confirma PUBLICAR')
                        if not self.draft:raise ValueError('No hay borrador')
                        if self.draft['base']!=revision:return jsonify(error='La configuración cambió. Carga la versión actual antes de publicar.'),409
                        config=self.validate(self.draft['config']);history=(self.undo+[dict(config=current,after=self.fingerprint(config))])[-10:]
                        self.commit(config,history,None)
                    elif action=='undo':
                        if data.get('confirmation')!='DESHACER':raise ValueError('Confirma DESHACER')
                        if not self.undo:raise ValueError('No hay cambios para deshacer')
                        if self.undo[-1]['after']!=revision:return jsonify(error='Hay cambios posteriores. No se sobrescriben.'),409
                        config=self.validate(self.undo[-1]['config']);self.commit(config,self.undo[:-1],None)
                    else:raise ValueError('Acción inválida')
                    return jsonify(ok=True,config=config,revision=self.fingerprint(config))
                except (ValueError,TypeError,KeyError) as exc:return jsonify(error=str(exc)),400
        @app.get('/reliability/trace')
        def reliability_trace():
            with self.r.interactive.lock:return jsonify(records=list(self.r.interactive.trace),limit=500)
        @app.post('/reliability/rehearse')
        def reliability_rehearse():
            data=request.get_json(silent=True)
            try:
                if not isinstance(data,dict) or not isinstance(data.get('session'),str):raise ValueError('Selecciona una sesión')
                with self.r.feed_lock,self.r.interactive.lock:config=self.validate(data.get('config') or self.snapshot())
                rows=[]
                if self.r.archive:
                    with self.r.archive.connect() as db:
                        rows=[{'kind':kind,**json.loads(payload)} for kind,payload in db.execute('SELECT kind,payload FROM events WHERE session=? ORDER BY rowid DESC LIMIT 500',(data['session'],))][::-1]
                return jsonify(self.rehearse(rows,config))
            except (ValueError,TypeError,KeyError) as exc:return jsonify(error=str(exc)),400
        @app.get('/reliability/support')
        def reliability_support():
            i=self.r.interactive
            with i.lock:return jsonify(version=1,connected=bool(self.r.state['connected']),rules=len(i.rules),pending=len(i.pending),omissions=dict(i.omissions),global_limit=i.global_limit,external_ttl=i.external_ttl,scope='Sin usuarios, comentarios, reglas, rutas, tokens ni archivos. Revisa antes de descargar.')
