"""WebSocket v5 controls for the local streaming program."""
import base64
import hashlib
import json
import queue
import threading
import time
from uuid import uuid4
from flask import request, jsonify
from websockets.sync.client import connect

def authentication(password, salt, challenge):
    def digest(text):
        return base64.b64encode(hashlib.sha256(text.encode()).digest()).decode()
    return digest(digest(password+salt)+challenge)

class OBSDirect:
    def __init__(self, app, runtime):
        self.r=runtime;self.password='';self.enabled=False;self.port=4455
        self.lock=threading.RLock();self.jobs=queue.Queue(20)
        self.register(app)
        threading.Thread(target=self.worker,daemon=True).start()

    def call(self, kind, data=None):
        with self.lock:
            port,password=self.port,self.password
        try:
            with connect(f'ws://127.0.0.1:{port}',open_timeout=3,close_timeout=1,proxy=None,max_size=1048576) as ws:
                hello=json.loads(ws.recv(timeout=3))
                if hello.get('op')!=0:raise ValueError('Stream requiere WebSocket versión 5')
                identify={'rpcVersion':1,'eventSubscriptions':0}
                auth=hello['d'].get('authentication')
                if auth:identify['authentication']=authentication(password,auth['salt'],auth['challenge'])
                ws.send(json.dumps({'op':1,'d':identify}))
                if json.loads(ws.recv(timeout=3)).get('op')!=2:raise ValueError('Stream no aceptó la conexión')
                rid=uuid4().hex
                ws.send(json.dumps({'op':6,'d':{'requestType':kind,'requestId':rid,'requestData':data or {}}}))
                result=json.loads(ws.recv(timeout=3))
                if result.get('op')!=7 or result['d'].get('requestId')!=rid:raise ValueError('Respuesta inesperada de Stream')
                if not result['d']['requestStatus']['result']:raise ValueError('Stream rechazó la acción: '+str(result['d']['requestStatus'].get('comment','revisa la escena o fuente')))
                return result['d'].get('responseData',{})
        except ValueError:raise
        except Exception as exc:raise ValueError('No se pudo conectar a Stream. Revisa que esté abierto, el puerto y la contraseña de WebSocket.') from exc

    def execute(self, action, value):
        if not self.enabled:raise ValueError('Activa el control de Stream primero')
        if self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk':raise ValueError('Emisión silenciada')
        if action=='obs_scene':return self.call('SetCurrentProgramScene',{'sceneName':value})
        if action not in ('obs_show','obs_hide') or '|' not in value:raise ValueError('Indica Escena|Fuente')
        scene,source=value.split('|',1)
        item=self.call('GetSceneItemId',{'sceneName':scene.strip(),'sourceName':source.strip()})
        return self.call('SetSceneItemEnabled',{'sceneName':scene.strip(),'sceneItemId':item['sceneItemId'],'sceneItemEnabled':action=='obs_show'})

    def enqueue(self, action, value, name, event):
        if not self.enabled:return False
        try:self.jobs.put_nowait((action,value,name,event,self.r.feed_session,time.monotonic()));return True
        except queue.Full:return False

    def worker(self):
        while True:
            action,value,name,event,session,created=self.jobs.get()
            try:
                if session!=self.r.feed_session or time.monotonic()-created>10:raise ValueError('Acción de Stream caducada')
                self.execute(action,value);outcome='Stream confirmó la acción'
            except Exception as exc:outcome=str(exc)
            finally:self.jobs.task_done()
            with self.r.interactive.lock:self.r.interactive.record_trace(name,outcome,event,action)

    def register(self,app):
        @app.route('/obs-direct',methods=['GET','POST'])
        def obs_config():
            if request.method=='POST':
                d=request.get_json(silent=True) or {}
                try:
                    port=int(d.get('port',self.port))
                    if not 1024<=port<=65535:raise ValueError('Puerto inválido')
                    with self.lock:
                        self.port=port;self.enabled=d.get('enabled') is True
                        if d.get('clear_password'):self.password=''
                        elif d.get('password'):self.password=str(d['password'])[:512]
                except (ValueError,TypeError) as exc:return jsonify(error=str(exc)),400
            return jsonify(port=self.port,enabled=self.enabled,password_set=bool(self.password))

        @app.get('/obs-direct/scenes')
        def obs_scenes():
            try:return jsonify(self.call('GetSceneList'))
            except ValueError as exc:return jsonify(error=str(exc)),400

        @app.get('/obs-direct/sources')
        def obs_sources():
            try:return jsonify(self.call('GetSceneItemList',{'sceneName':request.args.get('scene','')}))
            except ValueError as exc:return jsonify(error=str(exc)),400

        @app.post('/obs-direct/action')
        def obs_action():
            d=request.get_json(silent=True) or {}
            try:self.execute(d.get('action'),str(d.get('value',''))[:300]);return jsonify(ok=True)
            except ValueError as exc:return jsonify(error=str(exc)),400
