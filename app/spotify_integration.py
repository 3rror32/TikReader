"""Spotify PKCE; tokens stay only in server memory. Requests require local approval."""
import base64
import hashlib
import json
import re
import secrets
import threading
import time
from functools import wraps
from urllib.parse import urlencode
from urllib.request import Request, build_opener, ProxyHandler
from urllib.error import HTTPError
from flask import request, jsonify, make_response
from interactivity import NoRedirect

class Spotify:
    redirect_uri='http://127.0.0.1:5000/spotify/callback'
    def __init__(self,app,runtime):
        self.r=runtime;self.lock=threading.RLock();self.network_lock=threading.RLock();self.client_id='';self.pending=None;self.tokens={};self.requests=[];self.session=None
        port=getattr(getattr(runtime,'runtime_config_value',None),'port',5000)
        self.redirect_uri=f'http://127.0.0.1:{port}/spotify/callback'
        self.opener=build_opener(ProxyHandler({}),NoRedirect());self.register(app)

    def token_request(self,data):
        req=Request('https://accounts.spotify.com/api/token',data=urlencode(data).encode(),headers={'Content-Type':'application/x-www-form-urlencoded'})
        with self.opener.open(req,timeout=8) as response:result=json.load(response)
        if not result.get('access_token'):raise ValueError('Token inválido')
        result['expires_at']=time.time()+int(result.get('expires_in',3600));self.tokens.update(result)

    def player(self,path,method='POST'):
        if not self.tokens:raise ValueError('Conecta Spotify primero')
        if self.tokens.get('expires_at',0)<time.time()+30:
            self.token_request(dict(grant_type='refresh_token',refresh_token=self.tokens['refresh_token'],client_id=self.client_id))
        req=Request('https://api.spotify.com/v1/me/player'+('/'+path if path else ''),data=b'' if method=='POST' else None,method=method,headers={'Authorization':'Bearer '+self.tokens['access_token']})
        with self.opener.open(req,timeout=8) as response:
            if method=='GET':return json.load(response) if response.status==200 else None
            if response.status!=204:raise ValueError('Spotify no confirmó la operación')

    def reset_session(self):
        if self.session!=self.r.feed_session:
            self.requests=[];self.session=self.r.feed_session

    def network_operation(self, handler):
        @wraps(handler)
        def run(*args, **kwargs):
            if not self.network_lock.acquire(blocking=False):
                return jsonify(error='Spotify está procesando otra operación. Espera a que termine.'),409
            try:return handler(*args, **kwargs)
            finally:self.network_lock.release()
        return run

    def comment(self,record):
        text=record.get('comment','').strip()
        match=re.fullmatch(r'!song\s+(?:https://open\.spotify\.com/track/|spotify:track:)([A-Za-z0-9]{22})(?:\?[^\s]*)?',text)
        if not match:return
        with self.lock:
            self.reset_session()
            if len(self.requests)>=30 or any(x['user']==record['user'] for x in self.requests):return
            self.requests.append(dict(id=secrets.token_hex(8),user=record['user'],track=match[1]))

    def register(self,app):
        @app.get('/spotify/state')
        def state():
            with self.lock:
                self.reset_session()
                return jsonify(connected=bool(self.tokens),requests=self.requests,redirect_uri=self.redirect_uri)

        @app.post('/spotify/check')
        @self.network_operation
        def check():
            with self.network_lock:
                try:
                    playback=self.player('',method='GET')
                    device=(playback or {}).get('device') or {}
                    return jsonify(ok=bool(device.get('is_active')),playing=bool((playback or {}).get('is_playing')),
                                   detail='Dispositivo activo disponible.' if device.get('is_active') else 'Abre Spotify e inicia una canción en el dispositivo que quieres usar.')
                except HTTPError as exc:
                    return jsonify(error=f'Spotify respondió {exc.code}. Reconecta para conceder permiso de consultar reproducción; revisa la cuenta y el dispositivo.'),502
                except (OSError,ValueError,KeyError):return jsonify(error='No se pudo consultar Spotify. Conecta la cuenta y revisa Internet.'),502

        @app.post('/spotify/authorize')
        @self.network_operation
        def authorize():
            data=request.get_json(silent=True) or {}
            if not isinstance(data,dict) or not re.fullmatch(r'[A-Za-z0-9]{32}',str(data.get('client_id',''))):return jsonify(error='Client ID inválido'),400
            with self.network_lock:
                self.client_id=data['client_id'];self.tokens={};verifier=secrets.token_urlsafe(64);state=secrets.token_urlsafe(32);browser=secrets.token_urlsafe(32)
                self.pending=dict(verifier=verifier,state=state,browser=browser,expires=time.time()+600)
                challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
                url='https://accounts.spotify.com/authorize?'+urlencode(dict(client_id=self.client_id,response_type='code',redirect_uri=self.redirect_uri,scope='user-modify-playback-state user-read-playback-state',state=state,code_challenge_method='S256',code_challenge=challenge))
            response=jsonify(url=url);response.set_cookie('spotify_browser',browser,httponly=True,samesite='Lax',max_age=600);return response

        @app.get('/spotify/callback')
        @self.network_operation
        def callback():
            with self.network_lock:
                p=self.pending
                if not p or p['expires']<time.time() or not secrets.compare_digest(request.args.get('state',''),p['state']) or not secrets.compare_digest(request.cookies.get('spotify_browser',''),p['browser']):return 'Autorización inválida o caducada. Inicia desde TikReader en 127.0.0.1.',400
                self.pending=None
                if request.args.get('error') or not request.args.get('code'):return 'Spotify no fue autorizado.',400
                try:self.token_request(dict(grant_type='authorization_code',code=request.args['code'],redirect_uri=self.redirect_uri,client_id=self.client_id,code_verifier=p['verifier']))
                except (OSError,ValueError,KeyError):return 'No se pudo completar Spotify. Vuelve a conectar.',502
            response=make_response('Spotify conectado. Puedes cerrar esta pestaña y volver al estudio.');response.delete_cookie('spotify_browser');response.headers['Cache-Control']='no-store';return response

        @app.post('/spotify/disconnect')
        @self.network_operation
        def disconnect():
            with self.network_lock:
                self.tokens={};self.pending=None
                with self.lock:self.requests=[]
            return jsonify(connected=False)

        @app.post('/spotify/request')
        @self.network_operation
        def operate():
            data=request.get_json(silent=True) or {}
            if not isinstance(data,dict):return jsonify(error='Datos inválidos'),400
            with self.network_lock:
                with self.lock:
                    self.reset_session()
                    item=next((x for x in self.requests if x['id']==data.get('id')),None)
                try:
                    if data.get('action')=='reject':
                        if not item:return jsonify(error='Petición no encontrada'),404
                    elif data.get('action')=='approve':
                        if not item:return jsonify(error='Petición no encontrada'),404
                        self.player('queue?'+urlencode({'uri':'spotify:track:'+item['track']}))
                    elif data.get('action')=='skip':self.player('next')
                    else:return jsonify(error='Acción inválida'),400
                except HTTPError as exc:return jsonify(error=f'Spotify respondió {exc.code}. Revisa la cuenta, el dispositivo y los permisos. No se reintentó.'),502
                except (OSError,ValueError,KeyError):return jsonify(error='Spotify no confirmó la operación. Comprueba la cola o reproducción antes de repetirla.'),502
                with self.lock:
                    if item in self.requests:self.requests.remove(item)
            return jsonify(ok=True)
