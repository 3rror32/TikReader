"""Command replies and timed chat messages, disabled until configured locally."""
import queue
import re
import threading
import time
from collections import deque
from flask import request, jsonify

class Chatbot:
    def __init__(self,app,runtime):
        self.r=runtime;self.lock=threading.RLock();self.enabled=False;self.api_key='';self.oauth_token=''
        self.commands=[];self.message='';self.interval=300;self.bot_user='';self.last={};self.seen=deque(maxlen=1000)
        self.recent=deque(maxlen=30);self.log=deque(maxlen=100);self.jobs=queue.Queue(20);self.next_timer=time.monotonic()+300;self.last_send=-1e9;self.generation=0
        saved=runtime.archive.settings().get('chatbot',{}) if runtime.archive else {}
        try:self.configure(saved)
        except (ValueError,TypeError):pass
        self.register(app);threading.Thread(target=self.worker,daemon=True).start()

    def configure(self,d):
        commands=d.get('commands',[])
        if not isinstance(commands,list) or len(commands)>50:raise ValueError('Máximo 50 comandos')
        checked=[]
        for c in commands:
            if not isinstance(c,dict):raise ValueError('Comando inválido')
            trigger=str(c.get('command','')).strip().casefold();reply=str(c.get('reply','')).strip()
            if not re.fullmatch(r'![\w-]{1,30}',trigger) or not 1<=len(reply)<=150:raise ValueError('Usa un comando como !hola y una respuesta de hasta 150 caracteres')
            cooldown=int(c.get('cooldown',30))
            if not 10<=cooldown<=3600:raise ValueError('Intervalo de comando: 10 a 3600 segundos')
            checked.append(dict(command=trigger,reply=reply,cooldown=cooldown))
        if len({c['command'] for c in checked})!=len(checked):raise ValueError('Hay comandos repetidos')
        interval=int(d.get('interval',300));message=str(d.get('message','')).strip()
        if not 60<=interval<=3600 or len(message)>150:raise ValueError('Mensaje de hasta 150 caracteres e intervalo de 60 a 3600 segundos')
        self.commands=checked;self.interval=interval;self.message=message;self.bot_user=str(d.get('bot_user','')).strip().lstrip('@').casefold()[:80]
        self.next_timer=time.monotonic()+interval

    def public(self):
        return dict(commands=self.commands,message=self.message,interval=self.interval,bot_user=self.bot_user,enabled=self.enabled,credentials_set=bool(self.api_key and self.oauth_token),log=list(self.log))

    def note(self,text):
        with self.lock:self.log.appendleft({'at':time.time(),'text':text})

    def ready(self):
        return (self.enabled and self.api_key and self.oauth_token and self.r.state.get('connected') and
                not self.r.production.settings['emergency'] and self.r.production.settings['scene']=='talk')

    def reply_for(self,text,user):
        command=next((c for c in self.commands if c['command']==text.strip().casefold()),None)
        return command, command['reply'].replace('{usuario}',user.lstrip('@'))[:150] if command else ''

    def comment(self,payload):
        with self.lock:
            key=(self.r.feed_session,payload.get('id'))
            if key in self.seen:return
            self.seen.append(key)
            if not self.ready():return
            text=str(payload.get('comment',''));user=str(payload.get('user',''))
            if user.lstrip('@').casefold()==self.bot_user or any(text==s and time.monotonic()-at<120 for s,at in self.recent):return
            command,reply=self.reply_for(text,user)
            if not command:return
            now=time.monotonic();identity=(self.r.feed_session,command['command'])
            if now-self.last.get(identity,-1e9)<command['cooldown']:self.note('Respuesta omitida: intervalo del comando activo');return
            self.last[identity]=now
            if len(self.last)>1000:self.last={identity:now}
            self.enqueue(reply)

    def enqueue(self,text):
        try:self.jobs.put_nowait((text,self.r.feed_session,self.generation,time.monotonic()))
        except queue.Full:self.note('Respuesta omitida: cola de mensajes llena')

    def send(self,text):
        # Fixed provider endpoint; OAuth token never enters URLs, logs or archives.
        import httpx
        from EulerApiSdk import AuthenticatedClient
        from EulerApiSdk.api.tik_tok_live_premium import send_room_chat
        from EulerApiSdk.models.webcast_room_chat_payload import WebcastRoomChatPayload
        client=self.r.tiktok_client
        room=getattr(client,'room_id',None)
        if not room:raise ValueError('Conecta primero un LIVE')
        with AuthenticatedClient(base_url='https://api.eulerstream.com',token=self.api_key,prefix='',auth_header_name='X-Api-Key',verify_ssl=True,timeout=httpx.Timeout(8),follow_redirects=False) as api:
            result=send_room_chat.sync_detailed(client=api,body=WebcastRoomChatPayload(content=text,target_room_id=str(room)),x_oauth_token=self.oauth_token)
        if result.status_code!=200 or not result.parsed or result.parsed.code not in (0,200):
            raise ValueError('Eulerstream no confirmó el mensaje. Revisa el token, el permiso de chat y Premium Routes. No se reintentó.')

    def worker(self):
        while True:
            with self.lock:
                if self.ready() and self.message and time.monotonic()>=self.next_timer:
                    self.next_timer=time.monotonic()+self.interval;self.enqueue(self.message)
            try:text,session,generation,created=self.jobs.get(timeout=1)
            except queue.Empty:continue
            try:
                # Cancel stale responses instead of flooding a reconnected LIVE.
                while time.monotonic()-self.last_send<5:time.sleep(.1)
                with self.lock:
                    if not self.ready() or session!=self.r.feed_session or generation!=self.generation or time.monotonic()-created>20:
                        self.note('Mensaje cancelado por pausa, cambio de sesión o caducidad');continue
                    self.last_send=time.monotonic();self.recent.append((text,self.last_send))
                self.send(text);self.note('TikTok confirmó el mensaje')
            except Exception:
                self.note('Envío sin confirmar. Revisa conexión, token OAuth y permiso Premium Routes de Eulerstream; no se reintenta.')
            finally:self.jobs.task_done()

    def register(self,app):
        @app.route('/chatbot',methods=['GET','POST'])
        def chatbot_config():
            with self.lock:
                if request.method=='POST':
                    d=request.get_json(silent=True)
                    if not isinstance(d,dict):return jsonify(error='Datos inválidos'),400
                    try:
                        self.configure(d)
                        if d.get('forget_credentials'):self.api_key='';self.oauth_token=''
                        for key in ('api_key','oauth_token'):
                            if d.get(key):setattr(self,key,str(d[key])[:4096])
                        if d.get('enabled') and not (self.api_key and self.oauth_token):raise ValueError('Configura la clave de Eulerstream y el token OAuth antes de activar')
                        self.enabled=d.get('enabled') is True;self.generation+=1
                        if self.r.archive:self.r.archive.set_setting('chatbot',{k:self.public()[k] for k in ('commands','message','interval','bot_user')})
                    except (ValueError,TypeError) as exc:return jsonify(error=str(exc)),400
                return jsonify(self.public())

        @app.post('/chatbot/preview')
        def chatbot_preview():
            d=request.get_json(silent=True) or {}
            with self.lock:_,reply=self.reply_for(str(d.get('text','')),str(d.get('user','Espectador')))
            return jsonify(reply=reply or 'Ningún comando coincide',published=False)
