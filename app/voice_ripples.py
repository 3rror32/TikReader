"""Ephemeral amplitude transport; microphone audio never leaves the browser."""
import math
import re
import threading
import time
from flask import jsonify, render_template, request


class VoiceRipples:
    def __init__(self, app, runtime):
        self.lock = threading.Lock()
        self.updated = 0
        self.amplitude = 0
        self.bands = [0] * 16
        self.settings = {'color': '#60d9e8', 'sensitivity': 2, 'style': 'ripples', 'intensity': 1, 'speed': 1, 'avatar': '🎙️'}

        @app.route('/voice-ripples', methods=['GET', 'POST'])
        def voice_ripples():
            if request.method == 'POST':
                if request.content_length is None or request.content_length > 2048:
                    return jsonify(error='El límite es 2 KB'), 413
                data = request.get_json(silent=True)
                if not isinstance(data, dict):
                    return jsonify(error='Datos inválidos'), 400
                try:
                    for key, low, high in [('amplitude', 0, 1), ('sensitivity', .5, 8), ('intensity', .25, 2), ('speed', .25, 2)]:
                        if key in data and (isinstance(data[key], bool) or not isinstance(data[key], (float, int)) or not low <= data[key] <= high or not math.isfinite(data[key])):
                            raise ValueError('Nivel o sensibilidad inválidos')
                    if 'color' in data and (not isinstance(data['color'], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', data['color'])):
                        raise ValueError('Color inválido')
                    if 'style' in data and data['style'] not in ('ripples', 'halo', 'particles', 'equalizer', 'silk', 'smoke', 'aura', 'avatar', 'lightning', 'camera-flashes', 'butterflies'):
                        raise ValueError('Estilo inválido')
                    if 'avatar' in data and (not isinstance(data['avatar'], str) or not 1 <= len(data['avatar'].strip()) <= 32):
                        raise ValueError('Avatar inválido')
                    if 'bands' in data:
                        if 'amplitude' not in data or not isinstance(data['bands'], list) or len(data['bands']) != 16:
                            raise ValueError('Frecuencias inválidas')
                        for value in data['bands']:
                            if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 1 or not math.isfinite(value):
                                raise ValueError('Frecuencias inválidas')
                    with self.lock:
                        if 'amplitude' in data:
                            self.amplitude = data['amplitude']
                            self.bands = data.get('bands', [0] * 16)
                            self.updated = time.monotonic()
                        self.settings.update({key: data[key] for key in self.settings if key in data})
                except (ValueError, OverflowError, TypeError) as exc:
                    return jsonify(error=str(exc)), 400
            return jsonify(self.snapshot())

        @app.get('/widget/voice-ripples')
        def voice_ripple_widget():
            return render_template('voice_ripple_widget.html')

    def snapshot(self):
        with self.lock:
            fresh = time.monotonic() - self.updated < 1
            return dict(self.settings, amplitude=self.amplitude if fresh else 0, bands=list(self.bands) if fresh else [0] * 16)
