"""User settings, shareable diagnostics and explicit desktop shutdown."""
import os
import platform
import threading
import time
import secrets
from collections import deque
from flask import jsonify, request
from app_config import APP_VERSION
from app_paths import data_dir, installed
from platform_credentials import CredentialStoreError, PlatformCredentialStore
from runtime_env import read_runtime_env, write_runtime_env
from readiness import inspect as inspect_readiness

PREFERENCE_KEYS = frozenset('''tikreader.preferences tikreader.profiles tikreader.layout
tikreader.skin tikreader.interfaceMode tikreader.accessibility tikreader.shortcuts
tikreader.voiceWanted tikreader.voiceCharacter tikreader.voiceSource tikreader.voiceVariation
tikreader.kokoroVoice tikreader.localModel tikreader.language tikreader.voiceCharacters
tikreader.voiceVariations tikreader.kokoroSpeed tikreader.voiceLocalModel'''.split())
connection_failures = deque(maxlen=12)


def saved_preferences(runtime):
    stored = runtime.archive.settings().get('browser_preferences', {}) if runtime.archive else {}
    return {key: value for key, value in stored.items() if key in PREFERENCE_KEYS and isinstance(value, str)} if isinstance(stored, dict) else {}


def diagnostic(runtime):
    # Explicit fields only: never serialize config, paths, exceptions or logs.
    return {'application': 'TikReader', 'version': APP_VERSION, 'channel': 'beta',
            'generated_at': int(time.time()), 'python': platform.python_version(),
            'os': platform.system(), 'architecture': platform.machine(),
            'installed': installed(), 'tiktoklive_version': runtime.TIKTOKLIVE_VERSION,
            'connected': bool(runtime.state.get('connected')),
            'connecting': bool(runtime.state.get('connecting')),
            'retry_count': int(runtime.state.get('retry_count', 0)),
            'archive_available': runtime.archive is not None,
            'stats': {k: runtime.state.get(k, 0) for k in ('comment_count', 'gift_count', 'like_count', 'like_events', 'viewer_count')},
            'connection_errors': list(connection_failures),
            'local_voices_ready': runtime.local_tts.ready(),
            'scope': 'Sin comentarios, nombres, perfiles, claves, rutas personales ni registros en bruto.'}


def register_release_routes(app, runtime):
    if not getattr(runtime, 'platform_credentials', None):
        runtime.platform_credentials = PlatformCredentialStore()

    @app.route('/system/runtime-config', methods=['GET', 'POST'])
    def runtime_configuration():
        if not runtime.production.local():
            return jsonify(error='Solo disponible desde este equipo.'), 403
        path = data_dir() / '.env'
        if request.method == 'GET':
            return jsonify(values=read_runtime_env(path), restart_required=False)
        try:
            values = write_runtime_env(path, request.get_json(silent=True))
        except (ValueError, OSError) as exc:
            return jsonify(error=str(exc)), 400
        return jsonify(ok=True, values=values, restart_required=True)

    @app.get('/system/readiness')
    def readiness():
        if not runtime.production.local():
            return jsonify(error='Solo disponible desde este equipo.'), 403
        return jsonify(inspect_readiness(runtime))

    @app.get('/system/control-center')
    def control_center():
        if not runtime.production.local():
            return jsonify(error='Solo disponible desde este equipo.'), 403
        manager = getattr(runtime, 'platform_manager', None)
        platforms = manager.snapshot()['platforms'] if manager else []
        return jsonify(
            readiness=inspect_readiness(runtime),
            components=runtime.voice_downloads.components(),
            backups=runtime.automatic_backups.snapshot(),
            lan=runtime.production.lan_access(),
            operations={
                'production': {'emergency': bool(runtime.production.settings['emergency'])},
                'streamerbot': {'external': bool(runtime.interactive.external)},
                'hotkeys': {'authorized': bool(runtime.game_hotkeys.authorized), 'paused': bool(runtime.game_hotkeys.paused)},
                'spotify': {'connected': bool(runtime.spotify.tokens)},
                'catalog': {'count': len(runtime.gift_catalog)},
                'connection': {'connected': bool(runtime.state['connected']), 'platforms': platforms},
            },
            update={
                'version': APP_VERSION,
                'installed': installed(),
                'rollback_backups': len(list((data_dir() / 'code-backups').glob('*.zip'))),
                'method': 'installer' if installed() else 'verified-package',
            },
        )

    @app.get('/system/lan-access')
    def lan_access():
        if not runtime.production.local():
            return jsonify(error='Solo disponible desde este equipo.'), 403
        return jsonify(runtime.production.lan_access())

    @app.post('/system/lan-access/rotate')
    def rotate_lan_access():
        if not runtime.production.local() or request.get_json(silent=True) != {'confirm': True}:
            return jsonify(error='Confirma la renovación de la clave de red.'), 400
        runtime.production.rotate_view_token()
        return jsonify(ok=True, **runtime.production.lan_access())

    @app.route('/system/preferences', methods=['GET', 'POST'])
    def preferences():
        if not runtime.production.local():
            return jsonify(error='Solo disponible desde este equipo.'), 403
        if request.method == 'GET':
            return jsonify(values=saved_preferences(runtime), keys=sorted(PREFERENCE_KEYS))
        if request.content_length is None or request.content_length > 512 * 1024:
            return jsonify(error='Los ajustes exceden el tamaño permitido.'), 413
        values = request.get_json(silent=True)
        if not isinstance(values, dict) or any(k not in PREFERENCE_KEYS or
                (v is not None and (not isinstance(v, str) or len(v) > 200000)) for k, v in values.items()):
            return jsonify(error='Ajustes inválidos.'), 400
        if not runtime.archive:
            return jsonify(error='El almacenamiento no está disponible.'), 503
        with runtime.feed_lock:
            merged = saved_preferences(runtime)
            for key, value in values.items():
                if value is None:
                    merged.pop(key, None)
                else:
                    merged[key] = value
            runtime.archive.set_setting('browser_preferences', merged)
        return jsonify(ok=True)

    @app.route('/system/platform-credentials', methods=['GET', 'POST', 'DELETE'])
    def platform_credentials():
        if not runtime.production.local():
            return jsonify(error='Solo disponible desde este equipo.'), 403
        store = runtime.platform_credentials
        try:
            if request.method == 'GET':
                return jsonify(store.snapshot())
            values = request.get_json(silent=True)
            if not isinstance(values, dict):
                return jsonify(error='Solicitud inválida.'), 400
            platform = str(values.get('platform') or '').casefold()
            if request.method == 'DELETE':
                manager = getattr(runtime, 'platform_manager', None)
                if manager:
                    manager.stop(platform)
                store.delete(platform)
                return jsonify(ok=True, **store.snapshot())
            config = values.get('credentials')
            if not isinstance(config, dict):
                return jsonify(error='Completa las credenciales.'), 400
            if platform == 'youtube':
                api_key = str(config.get('api_key') or '').strip()
                if not 20 <= len(api_key) <= 300:
                    return jsonify(error='Ingresa una clave válida de YouTube Data API v3.'), 400
                config = {'api_key': api_key}
            elif platform == 'twitch':
                nickname = str(config.get('nickname') or '').strip().lstrip('@').casefold()
                token = str(config.get('token') or '').strip()
                if not 2 <= len(nickname) <= 80 or not 10 <= len(token) <= 500:
                    return jsonify(error='Ingresa el usuario y un token OAuth válido de Twitch.'), 400
                config = {'nickname': nickname, 'token': token}
            elif platform == 'kick':
                client_id = str(config.get('client_id') or '').strip()
                client_secret = str(config.get('client_secret') or '').strip()
                if not 8 <= len(client_id) <= 300 or not 16 <= len(client_secret) <= 500:
                    return jsonify(error='Ingresa el Client ID y Client Secret de tu aplicación de Kick.'), 400
                previous = store.get('kick')
                config = {'client_id': client_id, 'client_secret': client_secret,
                          'webhook_secret': previous.get('webhook_secret') or secrets.token_urlsafe(24)}
            else:
                return jsonify(error='Plataforma inválida.'), 400
            saved = store.save(platform, config)
            return jsonify(ok=True, platform=saved, storage=store.snapshot()['storage'])
        except (CredentialStoreError, OSError) as exc:
            return jsonify(error=str(exc)), 500
        except ValueError as exc:
            return jsonify(error=str(exc)), 400

    @app.post('/webhooks/kick/<secret>')
    def kick_webhook(secret):
        manager = getattr(runtime, 'platform_manager', None)
        if manager is None:
            return jsonify(error='Conector no disponible'), 503
        return manager.receive_kick(secret, request.headers, request.get_data(cache=True))

    @app.post('/system/open-data')
    def open_data():
        if not runtime.production.local() or not request.is_json:
            return jsonify(error='Solicitud no permitida.'), 403
        if os.name != 'nt':
            return jsonify(error='Disponible en Windows.'), 400
        os.startfile(str(data_dir()))
        return jsonify(ok=True)

    @app.post('/system/exit')
    def exit_app():
        if not runtime.production.local() or request.get_json(silent=True) != {'confirm': True}:
            return jsonify(error='Confirma el cierre del programa.'), 400
        if runtime.voice_downloads.busy():
            return jsonify(error='Espera a que termine la instalación de voces.'), 409
        manager = getattr(runtime, 'platform_manager', None)
        if manager:
            manager.stop_all()
        if not runtime.stop_connection():
            return jsonify(error='La conexión sigue cerrándose. Inténtalo de nuevo.'), 409
        def finish():
            time.sleep(1)
            runtime.local_tts.close()
            runtime.voice_models._stop_worker()
            # All HistoryStore operations commit and close their own connection.
            if runtime.archive:
                with runtime.archive.connect() as db:
                    db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            os._exit(0)
        threading.Thread(target=finish, daemon=True).start()
        return jsonify(ok=True)
