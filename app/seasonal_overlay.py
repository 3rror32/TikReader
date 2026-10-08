"""Continuous atmospheric overlays, independent of TikTok event traffic."""
import math
import re
from flask import jsonify, render_template, request

KINDS = ('snow', 'leaves', 'wind', 'rain', 'rain-original', 'fireflies', 'aurora', 'fog',
         'embers', 'stars', 'petals', 'bubbles', 'digital-rain')
DEFAULTS = dict(enabled=True, density=70, size=12, speed=30, direction=0, wind=15, opacity=80,
    motion='full', thickness=1, glass_count=45, glass_speed=25, background_image='',
    background_visible=True, primary_color='#f0f8ff', secondary_color='#8bdcff', canvas_format='horizontal',
    fog_style='low', fog_clear_zone='center')
KIND_DEFAULTS = {
    'leaves': dict(size=26, primary_color='#d9823b', secondary_color='#f3c969'),
    'wind': dict(density=18, primary_color='#e9e5d4', secondary_color='#b9e8ff'),
    'rain': dict(primary_color='#ccecff', secondary_color='#78bce8'),
    'rain-original': dict(density=10, size=60, glass_count=2000, opacity=100),
    'fireflies': dict(density=55, size=9, speed=18, wind=4, opacity=88, primary_color='#ffd86b', secondary_color='#72ffbd'),
    'aurora': dict(density=7, size=52, speed=8, direction=12, wind=0, opacity=58, primary_color='#52f2c5', secondary_color='#826cff'),
    'fog': dict(density=18, size=45, speed=12, direction=90, wind=0, opacity=45, primary_color='#d9e4ef', secondary_color='#91a9bf'),
    'embers': dict(density=105, size=9, speed=32, direction=180, wind=7, opacity=90, primary_color='#ffcf7a', secondary_color='#ff481f'),
    'stars': dict(density=95, size=6, speed=8, direction=90, wind=0, opacity=82, primary_color='#fff4cf', secondary_color='#8fc7ff'),
    'petals': dict(density=52, size=18, speed=24, direction=0, wind=10, opacity=85, primary_color='#ff9fc8', secondary_color='#ffe0ed'),
    'bubbles': dict(density=46, size=20, speed=25, direction=180, wind=3, opacity=62, primary_color='#b9f4ff', secondary_color='#ffffff'),
    'digital-rain': dict(density=58, size=18, speed=46, direction=0, wind=0, opacity=75, primary_color='#65ff9a', secondary_color='#d7ffe3'),
}


class SeasonalOverlay:
    def __init__(self, app, runtime):
        self.r = runtime
        self.settings = {k: {**DEFAULTS, **KIND_DEFAULTS.get(k, {})} for k in KINDS}
        self.register(app)

    def validate(self, key, data):
        if not isinstance(data, dict):
            raise ValueError('Configuración inválida')
        out = {**self.settings[key], **{k: v for k, v in data.items() if k in DEFAULTS}}
        for k, low, high in [('density',5,180),('size',3,120 if key == 'rain-original' else 70),('speed',1,120),('direction',-180,180),('wind',-100,100),('opacity',10,100),('thickness',0.3,5),('glass_count',0,2000 if key == 'rain-original' else 180),('glass_speed',1,120)]:
            v = out[k]
            if isinstance(v, bool) or not isinstance(v, (int,float)) or not math.isfinite(v) or not low <= v <= high:
                raise ValueError('Fuera de rango: '+k)
            out[k] = float(v) if k == 'thickness' else int(v)
        if not isinstance(out['enabled'],bool) or out['motion'] not in ('full','reduced','system'):
            raise ValueError('Estado o movimiento inválido')
        if out['canvas_format'] not in ('horizontal','vertical'):
            raise ValueError('Formato de lienzo inválido')
        if out['fog_style'] not in ('low','enveloping','cinematic'):
            raise ValueError('Estilo de niebla inválido')
        if out['fog_clear_zone'] not in ('none','left','center','right'):
            raise ValueError('Zona despejada inválida')
        if not isinstance(out['background_visible'], bool):
            raise ValueError('Visibilidad de fondo inválida')
        for field in ('primary_color', 'secondary_color'):
            if not isinstance(out[field], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', out[field]):
                raise ValueError('Color inválido: '+field)
            out[field] = out[field].lower()
        image = out['background_image']
        if not isinstance(image, str) or len(image) > 4000000 or (image and not image.startswith(('data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,'))):
            raise ValueError('Imagen de fondo inválida (máximo 3 MB)')
        return out

    def restore(self):
        saved = self.r.archive.settings().get('seasonal_overlays', {}) if self.r.archive else {}
        if not isinstance(saved,dict): return
        for key in KINDS:
            try: self.settings[key] = self.validate(key,saved.get(key,{}))
            except (ValueError,TypeError): pass

    def register(self, app):
        @app.route('/seasonal-overlays/<key>',methods=['GET','POST'])
        def seasonal_settings(key):
            if key not in KINDS: return jsonify(error='Ambiente desconocido'),404
            with self.r.feed_lock:
                if request.method == 'POST':
                    try: updated = {**self.settings,key:self.validate(key,request.get_json(silent=True))}
                    except ValueError as e: return jsonify(error=str(e)),400
                    if self.r.archive: self.r.archive.set_setting('seasonal_overlays',updated)
                    self.settings = updated
                return jsonify(settings=self.settings[key])

        @app.get('/broadcast/seasonal/<key>')
        def seasonal_state(key):
            if key not in KINDS: return jsonify(error='Ambiente desconocido'),404
            with self.r.feed_lock:
                p = self.r.production.settings
                return jsonify(settings=self.settings[key],muted=not self.settings[key]['enabled'] or p['emergency'] or p['scene']!='talk')

        @app.get('/widget/seasonal-<key>')
        def seasonal_widget(key):
            if key not in KINDS: return 'Ambiente desconocido',404
            return render_template('rain_original_widget.html' if key == 'rain-original' else 'seasonal_widget.html',key=key,settings=self.settings[key])
