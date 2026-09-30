"""Private preview and bounded, sanitized chat stream for emoji overlays."""
import math
from flask import jsonify, render_template, request

DEFAULTS = dict(enabled=True,size=54,duration=7,max_emojis=6,direction='up',show_avatar=True,motion='full',canvas_format='horizontal')


class EmojiOverlay:
    def __init__(self,app,runtime):
        self.r=runtime
        self.settings=dict(DEFAULTS)
        self.register(app)

    def validate(self,data):
        if not isinstance(data,dict): raise ValueError('Configuración inválida')
        out={**self.settings,**{k:v for k,v in data.items() if k in DEFAULTS}}
        for k,lo,hi in [('size',20,120),('duration',2,20),('max_emojis',1,12)]:
            v=out[k]
            if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not lo<=v<=hi: raise ValueError('Fuera de rango: '+k)
            out[k]=int(v)
        if out['direction'] not in ('up','left','right') or out['motion'] not in ('full','reduced','system'): raise ValueError('Movimiento inválido')
        if out['canvas_format'] not in ('horizontal','vertical'): raise ValueError('Formato de lienzo inválido')
        if not all(isinstance(out[k],bool) for k in ('enabled','show_avatar')): raise ValueError('Estado inválido')
        return out

    def restore(self):
        try: self.settings=self.validate(self.r.archive.settings().get('emoji_overlay',{})) if self.r.archive else dict(DEFAULTS)
        except (ValueError,TypeError): pass

    def register(self,app):
        @app.route('/emoji-overlay',methods=['GET','POST'])
        def emoji_settings():
            with self.r.feed_lock:
                if request.method=='POST':
                    try: updated=self.validate(request.get_json(silent=True))
                    except ValueError as e: return jsonify(error=str(e)),400
                    if self.r.archive: self.r.archive.set_setting('emoji_overlay',updated)
                    self.settings=updated
                return jsonify(settings=self.settings)

        @app.get('/broadcast/emoji-overlay')
        def emoji_feed():
            with self.r.feed_lock:
                p=self.r.production.settings
                muted=not self.settings['enabled'] or p['emergency'] or p['scene']!='talk'
                comments=[] if muted else [dict(sequence=c.get('sequence',0),comment=str(c.get('comment',''))[:2000],
                    avatar_url=c.get('avatar_url') if self.settings['show_avatar'] else None,
                    emotes=[dict(id=str(e.get('id',''))[:100],index=e.get('index',-1),url=e.get('url'))
                            for e in c.get('emotes',[])[:24] if isinstance(e,dict) and e.get('url')])
                    for c in self.r.comment_history if c.get('session')==self.r.feed_session][-100:]
                return jsonify(self.r.production.sanitize(dict(session=self.r.feed_session,serial=self.r.state['comment_count'],
                    settings=self.settings,muted=muted,comments=comments)))

        @app.get('/widget/chat-emojis')
        def emoji_widget():
            return render_template('emoji_widget.html',settings=self.settings)
