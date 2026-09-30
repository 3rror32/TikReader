"""Opt-in gift hotkeys with profiles, sequences, dry runs, limits and foreground safeguards."""
import copy, json, os, queue, re, threading, time, unicodedata
from itertools import count
from uuid import uuid4
from flask import request, jsonify
MODIFIERS={'CTRL':0x11,'ALT':0x12,'SHIFT':0x10,'WIN':0x5B};SPECIAL={'SPACE':0x20,'ENTER':0x0D,'TAB':0x09,'ESC':0x1B,'UP':0x26,'DOWN':0x28,'LEFT':0x25,'RIGHT':0x27}
ALLOWED=set(MODIFIERS)|set(SPECIAL)|{chr(x) for x in range(65,91)}|{str(x) for x in range(10)}|{f'F{x}' for x in range(1,25)}
def normalize(text):return unicodedata.normalize('NFKC',str(text)).strip().casefold()
def window_title(text):
    # mGBA updates its FPS counter continuously; it is not part of the game identity.
    return ' '.join(re.sub(r'\(\s*\d+(?:[.,]\d+)?\s*fps\s*\)', '', normalize(text)).split())
def key_code(key):
    if key not in ALLOWED:raise ValueError('Tecla no permitida')
    if key in MODIFIERS:return MODIFIERS[key]
    if key in SPECIAL:return SPECIAL[key]
    if len(key)>1 and key.startswith('F'):return 0x6F+int(key[1:])
    return ord(key)

def user32():
    """Use pointer-sized window handles on 64-bit Windows."""
    import ctypes
    from ctypes import wintypes
    u=ctypes.windll.user32
    u.GetForegroundWindow.restype=wintypes.HWND
    u.GetWindowTextLengthW.argtypes=[wintypes.HWND]
    u.GetWindowTextW.argtypes=[wintypes.HWND,wintypes.LPWSTR,ctypes.c_int]
    u.IsWindowVisible.argtypes=[wintypes.HWND]
    u.PostMessageW.argtypes=[wintypes.HWND,wintypes.UINT,wintypes.WPARAM,wintypes.LPARAM]
    u.PostMessageW.restype=wintypes.BOOL
    return u
def foreground():
    if os.name!='nt':return 0,''
    import ctypes
    u=user32();h=u.GetForegroundWindow();n=u.GetWindowTextLengthW(h);b=ctypes.create_unicode_buffer(n+1);u.GetWindowTextW(h,b,n+1);return h,b.value
def windows():
    if os.name!='nt':return []
    import ctypes
    u=user32();found=[]
    @ctypes.WINFUNCTYPE(ctypes.c_bool,ctypes.c_void_p,ctypes.c_void_p)
    def each(h,_):
        if u.IsWindowVisible(h):
            n=u.GetWindowTextLengthW(h)
            if n:
                b=ctypes.create_unicode_buffer(n+1);u.GetWindowTextW(h,b,n+1);found.append((h,b.value))
        return True
    u.EnumWindows(each,0);return found
def press_keys(keys,hold_ms=60,hwnd=0):
    if os.name!='nt':raise RuntimeError('Solo disponible en Windows')
    codes=[key_code(k) for k in keys];u=user32();pressed=[]
    def send(code,release=False):
        if hwnd:
            if not u.PostMessageW(hwnd,0x101 if release else 0x100,code,0):
                raise RuntimeError('Windows rechazó la pulsación en segundo plano')
        else:u.keybd_event(code,0,2 if release else 0,0)
    try:
        for code in codes:
            send(code);pressed.append(code)
        time.sleep(max(20,min(2000,hold_ms))/1000)
    finally:
        failure=None
        for code in reversed(pressed):
            try:send(code,True)
            except Exception as exc:failure=exc
        if failure:raise failure
class GameHotkeys:
    def __init__(self,app,r):
        self.revision=0;self.r=r;self.lock=threading.RLock();self.mappings=[];self.profiles=['General'];self.active_profile='General';self.authorized=False;self.paused=False;self.session=None;self.last={};self.usage={};self.fired=set();self.log=[];self.order=count()
        self.jobs=queue.PriorityQueue(maxsize=30);self.injector=press_keys;threading.Thread(target=self.worker,daemon=True).start();self.register(app)
    def restore(self):
        saved=self.r.archive.settings() if self.r.archive else {};raw=saved.get('game_hotkeys',[])
        try:self.mappings=[self.validate(dict(x,enabled=False)) for x in raw][:50]
        except (ValueError,TypeError):self.mappings=[]
        profiles=saved.get('game_hotkey_profiles',['General']);self.profiles=[str(x)[:60] for x in profiles if str(x).strip()][:20] or ['General'];self.active_profile=self.profiles[0];self.authorized=False;self.paused=False
    def combo(self,keys):
        if not isinstance(keys,list):raise ValueError('Combinación inválida')
        keys=[str(k).upper() for k in keys]
        if not 1<=len(keys)<=4 or len(set(keys))!=len(keys) or any(k not in ALLOWED for k in keys):raise ValueError('Combinación inválida')
        main=[k for k in keys if k not in MODIFIERS]
        if len(main)!=1:raise ValueError('Cada paso necesita una tecla principal')
        return [k for k in ('CTRL','ALT','SHIFT','WIN') if k in keys]+main
    def validate(self,x):
        if not isinstance(x,dict):raise ValueError('Configuración inválida')
        gift=str(x.get('gift','')).strip()[:100];window=str(x.get('window','')).strip()[:120]
        if not gift:raise ValueError('Escribe el regalo');
        if len(window)<2:raise ValueError('Escribe la ventana permitida')
        raw=x.get('sequence') or [dict(keys=x.get('keys'),hold_ms=60,delay_ms=0)]
        if not isinstance(raw,list) or not 1<=len(raw)<=10:raise ValueError('La secuencia admite 1–10 pasos')
        sequence=[]
        for step in raw:
            if not isinstance(step,dict):raise ValueError('Paso inválido')
            sequence.append(dict(keys=self.combo(step.get('keys')),hold_ms=max(20,min(2000,int(step.get('hold_ms',60)))),delay_ms=max(0,min(5000,int(step.get('delay_ms',0))))))
        condition=x.get('condition','minimum')
        if condition not in ('minimum','exact','multiple'):raise ValueError('Condición inválida')
        target=x.get('target','foreground')
        if target not in ('foreground','background'):raise ValueError('Destino inválido')
        return dict(id=str(x.get('id') or uuid4().hex)[:64],name=str(x.get('name') or gift)[:80],profile=str(x.get('profile') or 'General')[:60],gift=gift,amount=max(1,min(9999,int(x.get('amount',x.get('minimum',1))))),condition=condition,once_per_streak=x.get('once_per_streak',True) is True,sequence=sequence,window=window,target=target,cooldown=max(1,min(3600,int(x.get('cooldown',10)))),budget=max(1,min(1000,int(x.get('budget',100)))),priority=max(0,min(100,int(x.get('priority',50)))),overlay=x.get('overlay',True) is True,enabled=x.get('enabled') is True and gift!='__prueba_local__')
    def note(self,text,user='',mapping='',outcome=''):
        row=dict(id=uuid4().hex,at=time.time(),text=text,user=str(user)[:80],mapping=str(mapping)[:80],outcome=str(outcome)[:80]);self.log.insert(0,row);del self.log[500:]
        if self.r.archive and self.r.feed_session:
            try:self.r.archive.save(self.r.feed_session,'hotkey',row)
            except Exception:pass
    def matches(self,m,record,streak):
        amount=max(1,int(record.get('count',1)));threshold=m['amount'];condition=m['condition']
        ok=amount>=threshold if condition=='minimum' else amount==threshold if condition=='exact' else amount%threshold==0
        if not ok:return False,'Cantidad no coincide'
        token=(m['id'],streak)
        if m['once_per_streak'] and token in self.fired:return False,'Ya ejecutada en esta racha'
        return True,''
    def gift(self,record,event_id,dry=False):
        with self.lock:
            if self.session!=self.r.feed_session:self.session=self.r.feed_session;self.last.clear();self.usage.clear();self.fired.clear()
            streak=str(event_id).rsplit(':',1)[0];results=[];now=time.monotonic()
            for m in self.mappings:
                if m['profile']!=self.active_profile or normalize(m['gift'])!=normalize(record.get('gift')):continue
                ok,reason=self.matches(m,record,streak)
                if ok and now-self.last.get(m['id'],-1e9)<m['cooldown']:ok=False;reason='Intervalo activo'
                if ok and self.usage.get(m['id'],0)>=m['budget']:ok=False;reason='Límite de sesión'
                if not self.authorized and not dry:ok=False;reason='Sin autorización'
                if self.paused and not dry:ok=False;reason='Pausadas'
                if not dry and (self.r.production.settings['emergency'] or self.r.production.settings.get('scene','talk')!='talk'):ok=False;reason='Emisión pausada: reanuda en escena Charla'
                if not m['enabled']:ok=False;reason='Acción desactivada: activa todos los juegos o esta acción'
                results.append(dict(id=m['id'],name=m['name'],result='Coincide' if ok else reason,sequence=[s['keys'] for s in m['sequence']]))
                if ok and not dry:
                    job=dict(revision=self.revision,mapping=copy.deepcopy(m),session=self.session,created=time.monotonic(),event=str(event_id),user=record.get('user',''))
                    try:self.jobs.put_nowait((-m['priority'],next(self.order),job));self.last[m['id']]=now;self.usage[m['id']]=self.usage.get(m['id'],0)+1;self.fired.add((m['id'],streak));self.note('Hotkey en cola',record.get('user',''),m['name'],'En cola')
                    except queue.Full:self.note('Cola llena',record.get('user',''),m['name'],'Omitida')
            if not results:
                results.append(dict(id='',name='Juegos',result='No hay una acción para este regalo en el perfil activo. Selecciona el mismo regalo en Juegos; Prueba local no responde a regalos.',sequence=[]))
            return results
    def target(self,m):
        front,title=foreground()
        expected=window_title(m['window'])
        if m['target']=='foreground':return (front if expected and expected in window_title(title) else 0),title
        return next(((h,t) for h,t in windows() if expected and expected in window_title(t)),(0,title))
    def job_allowed(self,job):
        m=job['mapping']
        current=next((x for x in self.mappings if x['id']==m['id']),None)
        return (self.authorized and not self.paused and job['session']==self.r.feed_session
                and not self.r.production.settings['emergency']
                and self.r.production.settings.get('scene','talk')=='talk'
                and job.get('revision',self.revision)==self.revision
                and current==m and m['profile']==self.active_profile
                and (m['enabled'] or job.get('event')=='manual'))

    def execute(self,job):
        m=job['mapping']
        with self.lock:
            if not self.job_allowed(job):self.note('Cancelada por estado seguro o regla modificada',job.get('user',''),m['name'],'Cancelada');return False
            if time.monotonic()-job['created']>5:self.note('Caducada',job.get('user',''),m['name'],'Caducada');return False
        hwnd,title=self.target(m)
        if not hwnd:self.note(f"No se pudo enviar: se esperaba {m['window']}; ventana al frente: {title or 'ninguna'}. Usa la espera del simulador para volver al juego.",job.get('user',''),m['name'],'Bloqueada');return False
        try:
            for step in m['sequence']:
                if step['delay_ms']:time.sleep(step['delay_ms']/1000)
                with self.lock:
                    if not self.job_allowed(job):
                        self.note('Cancelada por estado seguro',job.get('user',''),m['name'],'Cancelada');return False
                hwnd,title=self.target(m)
                if not hwnd:
                    self.note(f"El destino {m['window']} dejó de estar disponible; vuelve al juego.",job.get('user',''),m['name'],'Bloqueada');return False
                self.injector(step['keys'],step['hold_ms'],0 if m['target']=='foreground' else hwnd)
        except Exception as exc:self.note('No se pudo pulsar: '+type(exc).__name__,job.get('user',''),m['name'],'Error');return False
        self.note('Hotkey pulsada',job.get('user',''),m['name'],'Ejecutada')
        if m['overlay']:
            with self.r.interactive.lock:
                self.r.interactive.serial+=1;self.r.interactive.effects.append(dict(id=self.r.interactive.serial,at=time.time(),action='animation',value=f"{job.get('user','')} activó {m['name']}"[:300]))
        return True
    def worker(self):
        while True:
            _,_,job=self.jobs.get()
            try:self.execute(job)
            except Exception as exc:self.note('Error de ejecución: '+type(exc).__name__,outcome='Error')
            finally:self.jobs.task_done()
    def payload(self):
        _,title=foreground();return dict(mappings=self.mappings,profiles=self.profiles,active_profile=self.active_profile,authorized=self.authorized,paused=self.paused,foreground=title,log=self.log,queue=self.jobs.qsize(),emergency=self.r.production.settings['emergency'])
    def save(self,mappings,profiles,active):
        checked=[self.validate(x) for x in mappings]
        profiles=[str(x).strip()[:60] for x in profiles if str(x).strip()]
        if not 1<=len(profiles)<=20 or len(set(profiles))!=len(profiles):raise ValueError('Perfiles inválidos')
        if any(m['profile'] not in profiles for m in checked):raise ValueError('Una hotkey usa un perfil inexistente')
        if active not in profiles:raise ValueError('Perfil activo inválido')
        if self.r.archive:
            old=self.r.archive.settings().get('game_hotkeys',[]);backups=self.r.archive.settings().get('game_hotkey_backups',[]);backups=(backups+[dict(at=time.time(),mappings=old)])[-10:]
            with self.r.archive.connect() as db:db.executemany('INSERT OR REPLACE INTO settings VALUES (?,?)',[(k,json.dumps(v)) for k,v in [('game_hotkeys',checked),('game_hotkey_profiles',profiles),('game_hotkey_backups',backups)]])
        self.revision+=1;self.mappings=checked;self.profiles=profiles;self.active_profile=active
    def register(self,app):
        @app.route('/game-hotkeys',methods=['GET','POST'])
        def gh_config():
            with self.lock:
                if request.method=='POST':
                    d=request.get_json(silent=True)
                    try:
                        if not isinstance(d,dict) or not isinstance(d.get('mappings'),list) or len(d['mappings'])>50:raise ValueError('Máximo 50 hotkeys')
                        self.save(d['mappings'],d.get('profiles',self.profiles),d.get('active_profile',self.active_profile))
                    except (ValueError,TypeError) as e:return jsonify(error=str(e)),400
                return jsonify(self.payload())
        @app.post('/game-hotkeys/authorize')
        def gh_authorize():
            d=request.get_json(silent=True)
            if not isinstance(d,dict) or d.get('confirmation')!='AUTORIZAR HOTKEYS':return jsonify(error='Falta autorización explícita'),400
            with self.lock:self.revision+=1;self.authorized=d.get('enabled') is True;self.paused=False if self.authorized else self.paused;self.note('Hotkeys autorizadas' if self.authorized else 'Hotkeys desactivadas')
            return jsonify(self.payload())
        @app.post('/game-hotkeys/all')
        def gh_all():
            d=request.get_json(silent=True)
            if not isinstance(d,dict) or type(d.get('enabled')) is not bool:return jsonify(error='Estado inválido'),400
            if d['enabled'] and d.get('confirmation')!='AUTORIZAR HOTKEYS':return jsonify(error='Falta autorización explícita'),400
            with self.lock:
                enabled=d['enabled']
                if enabled and not self.mappings:return jsonify(error='Primero guarda una acción en Juegos.'),409
                # Revoke before persistence so even a storage failure stops pending jobs.
                if not enabled:self.authorized=False;self.revision+=1
                self.save([dict(m,enabled=enabled and m['gift']!='__prueba_local__') for m in self.mappings],self.profiles,self.active_profile)
                self.authorized=enabled;self.paused=False if enabled else self.paused
                self.note('Todos los juegos activados; responde el perfil seleccionado' if enabled else 'Todos los juegos desactivados')
                return jsonify(self.payload())
        @app.post('/game-hotkeys/pause')
        def gh_pause():
            d=request.get_json(silent=True)
            if not isinstance(d,dict) or type(d.get('paused')) is not bool:return jsonify(error='Estado inválido'),400
            with self.lock:self.paused=d['paused'];self.note('Hotkeys pausadas' if self.paused else 'Hotkeys reanudadas')
            return jsonify(self.payload())
        @app.post('/game-hotkeys/simulate')
        def gh_simulate():
            d=request.get_json(silent=True) or {};record={'gift':str(d.get('gift',''))[:100],'count':max(1,min(9999,int(d.get('count',1)))),'user':'@simulación'}
            return jsonify(dry_run=True,results=self.gift(record,'dry:'+uuid4().hex,dry=True))
        @app.post('/game-hotkeys/test')
        def gh_test():
            d=request.get_json(silent=True)
            if not isinstance(d,dict) or d.get('confirmation')!='PROBAR HOTKEY':return jsonify(error='Confirma PROBAR HOTKEY'),400
            with self.lock:
                m=next((copy.deepcopy(x) for x in self.mappings if x['id']==d.get('id')),None)
                if not m:return jsonify(error='Hotkey no encontrada'),404
                if not self.authorized:return jsonify(error='Autoriza las teclas en el paso 4 antes de probar.'),409
                if self.paused or self.r.production.settings['emergency']:return jsonify(error='Desactiva la pausa o emergencia antes de probar.'),409
                session=self.r.feed_session;revision=self.revision
            # Wait outside the lock so pause, emergency and authorization remain responsive.
            time.sleep(5)
            ok=self.execute(dict(revision=revision,mapping=m,session=session,created=time.monotonic(),event='manual',user='@prueba'))
            return (jsonify(ok=True),200) if ok else (jsonify(ok=False,error='Prueba bloqueada: mantén el juego permitido al frente y comprueba autorización, pausa y emergencia.'),409)
