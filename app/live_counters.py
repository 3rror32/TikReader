"""Session totals independent of the bounded visible feed and editable overlay goals."""
import threading
import json
from collections import OrderedDict
from flask import jsonify, request


class LiveCounters:
    def __init__(self, app, runtime):
        self.r = runtime
        self.lock = threading.RLock()
        self.session = None
        self.totals = {}
        self.gifts = {}
        self.seen = OrderedDict()
        self.goals = {}
        self.register(app)

    def restore(self):
        saved = self.r.archive.settings().get('overlay_goals', {}) if self.r.archive else {}
        self.goals = saved if isinstance(saved, dict) else {}

    def ensure(self):
        if self.session != self.r.feed_session:
            self.session = self.r.feed_session
            self.totals, self.gifts = self.historical(self.session)
            self.seen.clear()
            if self.r.archive:
                for row in self.r.archive.records(self.session):
                    if row['kind']=='counter':
                        self.seen[tuple(json.loads(row['id']))]=True
                        if len(self.seen)>10000:self.seen.popitem(last=False)

    def historical(self, session):
        totals=dict(shares=0, follows=0, subscribers=0, coins=0);gifts={}
        for row in self.r.archive.records(session) if self.r.archive else []:
            if row['kind']!='counter':continue
            metric=dict(share='shares',follow='follows',subscribe='subscribers').get(row['event'])
            if metric:totals[metric]+=1
            if row['event']=='gift':
                name=row['gift'];gifts[name]=gifts.get(name,0)+row['units']
                totals['coins']+=row.get('coins') or 0
        return totals,gifts

    def event(self, kind, event_id, record=None, units=1, coins=None):
        with self.lock:
            self.ensure()
            key = (kind, str(event_id))
            if key in self.seen:return
            if self.r.archive:
                if not self.r.archive.save_once(self.session,'counter',dict(id=json.dumps(key),event=kind,
                    gift=str((record or {}).get('gift','')).casefold(),units=units,coins=coins)):return
            self.seen[key] = True
            if len(self.seen) > 10000:self.seen.popitem(last=False)
            metric = dict(share='shares', follow='follows', subscribe='subscribers').get(kind)
            if metric:self.totals[metric] += 1
            if kind == 'gift':
                name = str((record or {}).get('gift', '')).casefold()
                self.gifts[name] = self.gifts.get(name, 0) + units
                if coins is not None:self.totals['coins'] += coins

    def snapshot(self):
        with self.lock:
            self.ensure()
            return dict(self.totals), dict(self.gifts)

    def register(self, app):
        @app.get('/live-counters/<session>')
        def history(session):
            if not self.r.production.local():return jsonify(error='Solo disponible desde este equipo'),403
            totals,gifts=self.historical(session)
            return jsonify(session=session,totals=totals,gifts=gifts)

        @app.route('/overlay-goals/<panel>', methods=['GET', 'POST'])
        def goals(panel):
            allowed = panel.startswith(('goal-', 'countdown-', 'gift-counter-'))
            if not allowed or panel not in self.r.WIDGET_PANELS:
                return jsonify(error='Objetivo desconocido'), 404
            with self.lock:
                current = self.goals.get(panel, dict(title='', goal=100, value=0, gift=''))
                if request.method == 'POST':
                    data = request.get_json(silent=True)
                    try:
                        if not isinstance(data, dict):raise ValueError('Datos inválidos')
                        current = dict(title=str(data.get('title', ''))[:80],
                                       gift=str(data.get('gift', ''))[:100],
                                       goal=max(1,min(10000000,int(data.get('goal',100)))),
                                       value=max(0,min(10000000,int(data.get('value',0)))))
                    except (TypeError, ValueError, OverflowError):
                        return jsonify(error='Objetivo o valor inválido'), 400
                    next_goals = dict(self.goals, **{panel:current})
                    if self.r.archive:self.r.archive.set_setting('overlay_goals', next_goals)
                    self.goals = next_goals
                return jsonify(settings=current)
