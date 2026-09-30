"""Show a viewer's persisted score on an explicit chat command."""
import math
import re
import time
from collections import OrderedDict
from flask import jsonify,render_template,request

DEFAULTS=dict(enabled=True,command='!score',duration=10,font_size=24,show_avatar=True,show_crown=True,canvas_format='horizontal')


class UserInfoOverlay:
    def __init__(self,app,runtime):
        self.r=runtime
        self.settings=dict(DEFAULTS)
        self.current=None
        self.session=None
        self.recent=OrderedDict()
        self.register(app)

    def validate(self,data):
        if not isinstance(data,dict): raise ValueError('Configuración inválida')
        out={**self.settings,**{k:v for k,v in data.items() if k in DEFAULTS}}
        if not isinstance(out['command'],str) or not re.fullmatch(r'![a-zA-Z0-9_]{1,24}',out['command']): raise ValueError('Usa un comando como !score')
        out['command']=out['command'].lower()
        for k,lo,hi in [('duration',3,30),('font_size',14,64)]:
            v=out[k]
            if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not lo<=v<=hi: raise ValueError('Fuera de rango: '+k)
            out[k]=int(v)
        if not all(isinstance(out[k],bool) for k in ('enabled','show_avatar','show_crown')): raise ValueError('Estado inválido')
        if out['canvas_format'] not in ('horizontal','vertical'): raise ValueError('Formato de lienzo inválido')
        return out

    def restore(self):
        try: self.settings=self.validate(self.r.archive.settings().get('user_info_overlay',{})) if self.r.archive else dict(DEFAULTS)
        except (ValueError,TypeError): pass

    def lookup(self,record):
        user,display=self.r.points.username(record)
        archive=self.r.points._db()
        row=None;rank=None
        if archive:
            with archive.connect() as db:
                row=db.execute('SELECT points,lifetime FROM viewer_points WHERE user=?',(user,)).fetchone()
                if row: rank=1+db.execute('SELECT COUNT(*) FROM viewer_points WHERE points>?',(row[0],)).fetchone()[0]
        return dict(user=display,avatar_url=record.get('avatar_url'),points=row[0] if row else 0,
                    level=1+(row[1] if row else 0)//self.r.points.config['points_per_level'],rank=rank,
                    currency=self.r.points.config['currency'])

    def command(self,record):
        with self.r.feed_lock:
            if self.session!=self.r.feed_session:
                self.session=self.r.feed_session;self.current=None;self.recent.clear()
            p=self.r.production.settings
            if not self.settings['enabled'] or p['emergency'] or p['scene']!='talk': return
            if str(record.get('comment','')).strip().casefold()!=self.settings['command']: return
            user,_=self.r.points.username(record)
            if not user: return
            now=time.monotonic()
            if now-self.recent.get(user,-1e9)<5: return
            self.recent[user]=now;self.recent.move_to_end(user)
            while len(self.recent)>200:self.recent.popitem(last=False)
            self.current=(self.lookup(record),now+self.settings['duration'])

    def register(self,app):
        @app.route('/user-info-overlay',methods=['GET','POST'])
        def user_info_settings():
            with self.r.feed_lock:
                if request.method=='POST':
                    try: updated=self.validate(request.get_json(silent=True))
                    except ValueError as e:return jsonify(error=str(e)),400
                    if self.r.archive:self.r.archive.set_setting('user_info_overlay',updated)
                    self.settings=updated;self.current=None
                return jsonify(settings=self.settings)

        @app.get('/broadcast/user-info')
        def user_info_feed():
            with self.r.feed_lock:
                p=self.r.production.settings
                if self.session!=self.r.feed_session or p['emergency'] or p['scene']!='talk' or not self.settings['enabled']:self.current=None
                info=self.current[0] if self.current and time.monotonic()<self.current[1] else None
                return jsonify(self.r.production.sanitize(dict(settings=self.settings,info=info)))

        @app.get('/widget/user-info')
        def user_info_widget():
            return render_template('user_info_widget.html',settings=self.settings)
