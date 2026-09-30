"""Stream buddies: session donors, private previews and persisted appearance."""
import hashlib
import math
import random
from flask import jsonify, render_template, request

COLLECTIONS = dict(fantasia='Dragones', dinosaurios='Dinosaurios', cyborgs='Robots',
                   mascotas='Mascotas', goblins='Goblins', elfos='Elfos',
                   monstruos='Monstruos', chibis='Personas chibi')
CHARACTERS = [(f'{theme}-{i}', theme, f'{label} {i + 1}')
              for theme, label in COLLECTIONS.items() for i in range(10)]
DEFAULTS = dict(enabled=True, theme='fantasia', canvas_format='horizontal', font='Verdana', font_size=14,
                line_spacing=120, letter_spacing=0, max_friends=20, base_size=56,
                max_size=112, coins_to_max=1000, bubbles=True, speech_duration=4, speed=40, show_names=True)
RANGES = dict(font_size=(10, 64), line_spacing=(80, 200), letter_spacing=(0, 10),
              max_friends=(1, 50), base_size=(32, 160), max_size=(32, 160), coins_to_max=(10, 1000000),
              speech_duration=(1, 20), speed=(0, 150))
FONTS = ['Verdana', 'Arial', 'Georgia', 'Trebuchet MS', 'Courier New', 'system-ui']


class StreamBuddies:
    def __init__(self, app, runtime):
        self.r = runtime
        self.settings = dict(DEFAULTS)
        self.assignment_session = None
        self.assignments = {}
        self.bags = {}
        self.register(app)

    def character(self, session, identity, theme):
        """Session-owned shuffle bags shared by every browser source and preview-free."""
        if self.assignment_session != session:
            self.assignment_session = session
            self.assignments.clear()
            self.bags.clear()
        key = (theme, identity)
        if key not in self.assignments:
            bag = self.bags.setdefault(theme, [])
            if not bag:
                bag.extend(c[0] for c in CHARACTERS if theme == 'todos' or c[1] == theme)
                random.SystemRandom().shuffle(bag)
            self.assignments[key] = bag.pop()
        return self.assignments[key]

    def validate(self, data):
        if not isinstance(data, dict):
            raise ValueError('Configuración inválida')
        out = {**self.settings, **{k: v for k, v in data.items() if k in DEFAULTS}}
        if out['canvas_format'] not in ('vertical', 'horizontal'):
            raise ValueError('Formato de lienzo inválido')
        for k, (low, high) in RANGES.items():
            if isinstance(out[k], bool) or not isinstance(out[k], (int, float)) or not math.isfinite(out[k]) or not low <= out[k] <= high:
                raise ValueError('Fuera de rango: ' + k)
            out[k] = int(out[k])
        for k in ('enabled', 'bubbles', 'show_names'):
            if not isinstance(out[k], bool):
                raise ValueError('Valor inválido: ' + k)
        if out['max_size'] < out['base_size']:
            raise ValueError('El tamaño máximo debe ser mayor o igual al tamaño base')
        if out['font'] not in FONTS or out['theme'] not in ['todos'] + [c[1] for c in CHARACTERS]:
            raise ValueError('Fuente o tema inválido')
        return out

    def restore(self):
        try:
            saved = dict(self.r.archive.settings().get('stream_buddies', {})) if self.r.archive else {}
            if saved.get('canvas_format') == 'auto':
                saved['canvas_format'] = 'horizontal'
            if saved and 'coins_to_max' not in saved:
                # Migrate the oversized static-sprite defaults to the mobile collections.
                saved.update(base_size=56, max_size=112, font_size=14, coins_to_max=1000)
                if saved.get('theme') == 'todos':
                    saved['theme'] = 'fantasia'
            self.settings = self.validate(saved)
        except (ValueError, TypeError):
            self.settings = dict(DEFAULTS)

    def snapshot(self):
        with self.r.feed_lock:
            settings = dict(self.settings)
            p = self.r.production.settings
            muted = not settings['enabled'] or p['emergency'] or p['scene'] != 'talk'
            session = str(self.r.feed_session)
            # Reserve characters in arrival order, including donors outside the visible ranking.
            for user, coins in self.r.gifter_diamonds.items():
                if coins > 0:
                    self.character(session, str(user).lstrip('@').casefold(), settings['theme'])
            members = []
            if not muted:
                comments = {}
                for c in self.r.comment_history:
                    if str(c.get('session')) == session:
                        comments[str(c.get('user', '')).lstrip('@').casefold()] = c
                ranked = sorted(self.r.gifter_diamonds.items(), key=lambda x: (-x[1], x[0]))
                for user, coins in ranked:
                    if coins <= 0:
                        continue
                    identity = str(user).lstrip('@').casefold()
                    comment = comments.get(identity, {})
                    members.append(dict(id=hashlib.sha256((session+'\0'+identity).encode()).hexdigest()[:24],
                                        sprite_seed=int(hashlib.sha256(identity.encode()).hexdigest()[:8], 16),
                                        character_id=self.character(session, identity, settings['theme']),
                                        user=str(user), coins=coins,
                                        comment=str(comment.get('comment', ''))[:240] if settings['bubbles'] else '',
                                        comment_id=str(comment.get('id', '')) if settings['bubbles'] else ''))
                    if len(members) >= settings['max_friends']:
                        break
            return self.r.production.sanitize(dict(settings=settings, session=session, muted=muted, members=members))

    def register(self, app):
        @app.route('/stream-buddies', methods=['GET', 'POST'])
        def stream_buddies_settings():
            if request.method == 'POST':
                try:
                    with self.r.feed_lock:
                        updated = self.validate(request.get_json(silent=True))
                        if self.r.archive:
                            self.r.archive.set_setting('stream_buddies', updated)
                        self.settings = updated
                except ValueError as exc:
                    return jsonify(error=str(exc)), 400
            return jsonify(settings=self.settings, characters=[dict(id=k, theme=t, name=n) for k, t, n in CHARACTERS])

        @app.route('/broadcast/stream-buddies')
        def stream_buddies_feed():
            return jsonify(self.snapshot())

        @app.route('/widget/stream-buddies')
        def stream_buddies_widget():
            return render_template('stream_buddies.html', settings=self.settings,
                                   characters=[dict(id=k, theme=t, name=n) for k, t, n in CHARACTERS])
