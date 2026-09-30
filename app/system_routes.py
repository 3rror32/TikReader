"""Rutas y políticas HTTP transversales, separadas del dominio TikTok."""
import time
from flask import jsonify, request


def register_system_routes(app, runtime, config, metrics):
    @app.before_request
    def observe_request():
        request._tikreader_started = time.perf_counter()
        metrics.increment('http_requests')
        # Los controles mutables nunca deben aceptar una navegación cruzada.
        # Origin puede faltar en clientes locales legítimos; Sec-Fetch-Site cubre
        # navegadores modernos sin romper pruebas, scripts o la app de escritorio.
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if request.path.startswith('/system/'):
                origin = request.headers.get('Origin')
                if origin and origin.rstrip('/') != request.host_url.rstrip('/'):
                    return jsonify(error='Origen no permitido'), 403
            fetch_site = request.headers.get('Sec-Fetch-Site', '').lower()
            if fetch_site in ('cross-site', 'same-site'):
                return jsonify(error='Solicitud de otro sitio no permitida'), 403

    @app.after_request
    def security_headers(response):
        elapsed = time.perf_counter() - getattr(request, '_tikreader_started', time.perf_counter())
        if elapsed >= 1:
            metrics.increment('slow_requests')
        if response.status_code >= 500:
            metrics.increment('http_5xx')
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
        response.headers.setdefault('Referrer-Policy', 'no-referrer')
        response.headers.setdefault('Permissions-Policy', 'camera=(), geolocation=()')
        response.headers.setdefault('Cross-Origin-Resource-Policy', 'same-origin')
        if request.path.startswith(('/health', '/status', '/feed', '/studio/', '/history', '/production/')):
            response.headers.setdefault('Cache-Control', 'no-store')
        return response

    @app.get('/health')
    def health():
        archive = getattr(runtime, 'archive', None)
        return jsonify(
            application='TikReader', version=2,
            connected=runtime.state['connected'],
            mode='lan' if config.lan_enabled else 'local',
            archive=archive.health() if archive else {'available': False},
            metrics=metrics.snapshot(),
        )
