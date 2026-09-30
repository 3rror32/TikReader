"""Operator tools: private diagnostics, safe profiles and manual controls."""
import copy
import json
import time
import re
from flask import request,jsonify,Response

class OperatorTools:
    def __init__(self,app,r):
        self.r=r;self.manual_last={};self.register(app)

    def audit(self):
        i=self.r.interactive
        with i.lock:
            rules=copy.deepcopy(i.rules);issues=[]
            for rule in rules:
                try:i.validate(rule)
                except (ValueError,TypeError) as exc:issues.append(dict(rule=rule['name'],problem=str(exc)))
            conflicts=[]
            for n,a in enumerate(rules):
                for b in rules[n+1:]:
                    if a['enabled'] and b['enabled'] and a['event']==b['event'] and (not a['match'] or not b['match'] or a['match'].casefold() in b['match'].casefold() or b['match'].casefold() in a['match'].casefold()):
                        conflicts.append([a['name'],b['name']])
            return dict(active=sum(r['enabled'] for r in rules),issues=issues,possible_conflicts=conflicts,external_enabled=i.external,pending=len(i.pending),
                        omissions=dict(i.omissions),connected=self.r.state['connected'],archive=self.r.archive is not None,
                        spotify_connected=bool(self.r.spotify.tokens),muted=self.r.production.settings['emergency'])

    def profile_settings(self):
        saved=self.r.archive.settings() if self.r.archive else {}
        return dict(animation_templates=copy.deepcopy(self.r.animation_studio.templates),
            overlay_goals=copy.deepcopy(self.r.live_counters.goals),points_config=dict(self.r.points.config),
            minecraft_config=copy.deepcopy(self.r.minecraft.config),
            widget_customizations=saved.get('widget_customizations',{}),
            interactive_overlay_games=copy.deepcopy(self.r.interactive.overlay_games),
            creator_scenes={sid:copy.deepcopy(row['draft']) for sid,row in saved.get('creator_scenes',{}).get('items',{}).items()})

    def validate_settings(self, data):
        if not isinstance(data,dict):raise ValueError('Ajustes de perfil inválidos')
        out={}
        if 'creator_scenes' in data:
            incoming=data['creator_scenes']
            if not isinstance(incoming,dict) or len(incoming)>40:raise ValueError('Escenas de perfil inválidas')
            state=self.r.creator_suite.read('scenes') if self.r.archive else dict(revision=0,items={})
            for sid,scene in incoming.items():
                if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}',sid):raise ValueError('Identificador de escena inválido')
                row=state['items'].setdefault(sid,{})
                row['draft']=self.r.creator_suite.scene(scene)
            if len(state['items'])>40:raise ValueError('Máximo 40 escenas')
            state['revision']+=1
            out['creator_scenes']=state
        if 'animation_templates' in data:
            rows=data['animation_templates']
            if not isinstance(rows,list) or len(rows)>30:raise ValueError('Alertas inválidas')
            out['animation_templates']=[self.r.animation_studio.validate(dict(x,enabled=False)) for x in rows]
        if 'points_config' in data:out['points_config']=self.r.points.validate(data['points_config'])
        if 'minecraft_config' in data:out['minecraft_config']=self.r.minecraft.validate(data['minecraft_config'])
        for key in ('widget_customizations','overlay_goals'):
            if key not in data:continue
            rows=data[key]
            if not isinstance(rows,dict) or any(p not in self.r.WIDGET_PANELS for p in rows):raise ValueError('Panel inválido')
            out[key]={}
            for panel,value in rows.items():
                if key=='widget_customizations':out[key][panel]=self.r.validate_widget_settings(value)
                else:
                    if not isinstance(value,dict) or not panel.startswith(('goal-','countdown-','gift-counter-')):raise ValueError('Meta inválida')
                    out[key][panel]=dict(title=str(value.get('title',''))[:80],gift=str(value.get('gift',''))[:100],
                        goal=max(1,min(10000000,int(value.get('goal',100)))),value=max(0,min(10000000,int(value.get('value',0)))))
        if 'interactive_overlay_games' in data:
            games=data['interactive_overlay_games']
            if not isinstance(games,dict):raise ValueError('Juegos inválidos')
            out['interactive_overlay_games']={}
            for game,ranges in {'wheel':{'duration':(2,12),'turns':(2,12)},'drop':{'speed':(1.5,12),'size':(36,120),'density':(1,20)}}.items():
                if game not in games:continue
                row=games[game]
                if not isinstance(row,dict):raise ValueError('Juego inválido')
                clean={'title':str(row.get('title',''))[:80]}
                for k,(lo,hi) in ranges.items():
                    v=float(row[k])
                    if not lo<=v<=hi:raise ValueError('Valor de juego inválido')
                    clean[k]=v if k in ('duration','speed') else int(v)
                flag='show_result' if game=='wheel' else 'show_score';clean[flag]=row.get(flag,True) is True
                if game=='wheel':
                    options=row.get('options')
                    if not isinstance(options,list) or not 2<=len(options)<=12 or any(not isinstance(x,str) or not x.strip() or len(x)>80 for x in options):raise ValueError('Opciones inválidas')
                    clean['options']=options
                out['interactive_overlay_games'][game]=clean
        return out

    def apply_settings(self, settings):
        if 'animation_templates' in settings:self.r.animation_studio.templates=settings['animation_templates'];self.r.animation_studio.events.clear()
        if 'overlay_goals' in settings:self.r.live_counters.goals=settings['overlay_goals']
        if 'points_config' in settings:self.r.points.config=settings['points_config']
        if 'minecraft_config' in settings:
            self.r.minecraft.authorized=False;self.r.minecraft.revision+=1;self.r.minecraft.password=''
            self.r.minecraft.config=settings['minecraft_config']
        for game,row in settings.get('interactive_overlay_games',{}).items():self.r.interactive.overlay_games[game].update(row)

    def register(self,app):
        @app.get('/operator/audit')
        def audit():return jsonify(self.audit())

        @app.route('/operator/profile',methods=['GET','POST'])
        def profile():
            i=self.r.interactive
            with self.r.feed_lock,self.r.creator_suite.lock,i.lock:
                if request.method=='GET':return jsonify(rules=copy.deepcopy(i.rules),production={k:v for k,v in self.r.production.settings.items() if k not in ('revision','emergency')},extras={k:v for k,v in self.r.reliability.snapshot().items() if k in ('effects_mode','media_labels','global_limit','external_ttl')},game_hotkeys=copy.deepcopy(self.r.game_hotkeys.mappings),game_hotkey_profiles=list(self.r.game_hotkeys.profiles),game_hotkey_active_profile=self.r.game_hotkeys.active_profile,settings=self.profile_settings())
                data=request.get_json(silent=True)
                try:
                    if not isinstance(data,dict) or not isinstance(data.get('rules'),list) or len(data['rules'])>50:raise ValueError('Perfil inválido')
                    rules=[i.validate(dict(x,enabled=False)) for x in data['rules']]
                    if len({r['id'] for r in rules})!=len(rules):raise ValueError('IDs duplicados')
                    prod=data.get('production',{})
                    if not isinstance(prod,dict):raise ValueError('Perfil inválido')
                    config=dict(self.r.production.settings)
                    for key in ('hide_names','hide_photos','redact'):
                        if key in prod and isinstance(prod[key],bool):config[key]=prod[key]
                    config['announcement']=str(prod.get('announcement',''))[:500]
                    config['emergency']=True;config['scene']='talk';config['revision']+=1
                    extras=self.r.reliability.validate(dict(self.r.reliability.snapshot(),**data.get('extras',{})))
                    gh_profiles=data.get('game_hotkey_profiles',['General']);gh=[self.r.game_hotkeys.validate(dict(x,enabled=False)) for x in data.get('game_hotkeys',[])]
                    if not isinstance(gh_profiles,list) or not gh_profiles or any(x['profile'] not in gh_profiles for x in gh):raise ValueError('Perfil de hotkeys inválido')
                    active=data.get('game_hotkey_active_profile',gh_profiles[0])
                    if active not in gh_profiles:raise ValueError('Perfil activo inválido')
                    settings=self.validate_settings(data.get('settings',{}))
                    if self.r.archive:
                        with self.r.archive.connect() as db:
                            db.executemany('INSERT OR REPLACE INTO settings VALUES (?,?)', [('interactive_rules',json.dumps(rules)),('production_config',json.dumps(config)),('game_hotkeys',json.dumps(gh)),('game_hotkey_profiles',json.dumps(gh_profiles))]+[(k,json.dumps(extras[k])) for k in ('effects_mode','media_labels','global_limit','external_ttl')]+[(k,json.dumps(v)) for k,v in settings.items()])
                    self.r.production.settings=config
                    self.apply_settings(settings)
                    i.rules=rules;i.pending.clear();i.effects.clear();i.external=False
                    self.r.production.settings=config
                    self.r.game_hotkeys.mappings=gh;self.r.game_hotkeys.profiles=gh_profiles;self.r.game_hotkeys.active_profile=active;self.r.game_hotkeys.authorized=False;self.r.game_hotkeys.revision+=1
                    self.r.live_tools.effects_mode=extras['effects_mode'];i.global_limit=extras['global_limit'];i.external_ttl=extras['external_ttl']
                except (ValueError,TypeError,KeyError,OverflowError) as exc:return jsonify(error=str(exc)),400
            return jsonify(ok=True,notice='Perfil cargado con reglas desactivadas y emisión silenciada. Revisa y restaura manualmente.')

        @app.post('/operator/preview')
        def preview():
            data=request.get_json(silent=True) or {}
            if not isinstance(data,dict):return jsonify(error='Datos inválidos'),400
            with self.r.interactive.lock:
                rule=next((r for r in self.r.interactive.rules if r['id']==data.get('id')),None)
                if not rule:return jsonify(error='Regla no encontrada'),404
                # No event/dispatch call: this response is visible only to the requesting operator.
                return jsonify(name=rule['name'],steps=[{k:s.get(k) for k in ('action','value','delay','amount')} for s in [rule]+rule.get('steps',[])],private=True)

        @app.post('/operator/trigger')
        def trigger():
            data=request.get_json(silent=True) or {}
            if not isinstance(data,dict) or data.get('confirmation')!='EJECUTAR':return jsonify(error='Confirma EJECUTAR'),400
            i=self.r.interactive
            with i.lock:
                rule=next((r for r in i.rules if r['id']==data.get('id')),None)
                if not rule or not rule['enabled']:return jsonify(error='Regla inexistente o desactivada'),400
                if self.r.production.settings['emergency'] or self.r.production.settings['scene']!='talk':return jsonify(error='Emisión silenciada'),409
                try:i.validate(rule)
                except (ValueError,TypeError):return jsonify(error='Regla inválida o archivo ausente'),400
                # Normal event path enforces cooldown, budget and dedupe; isolate the selected rule.
                existing=i.rules
                try:
                    i.rules=[rule]
                    i.event(rule['event'],{'user':'operator-manual','gift':rule['match'],'comment':rule['match']},'manual-'+str(time.time_ns()))
                finally:i.rules=existing
            return jsonify(ok=True,notice='Solicitud procesada; consulta el registro por límites u omisiones.')

        @app.get('/operator/summary/<session>')
        def summary(session):
            records=self.r.archive.records(session) if self.r.archive else []
            comments=[x for x in records if x['kind']=='comment'];gifts=[x for x in records if x['kind']=='gift'];samples=[x for x in records if x['kind']=='sample']
            result=dict(comments=len(comments),participants=len({x.get('user') for x in comments}),gifts=sum(x.get('count',0) for x in gifts),
                        unanswered_questions=sum(('?' in x.get('comment','') or '¿' in x.get('comment','')) and not x.get('answered') for x in comments),
                        peak_viewers=max((x.get('viewers',0) for x in samples),default=None),
                        connection_errors=sum(x.get('kind')=='connection_error' for x in records))
            result['scope']='Totales observados; sin nombres, comentarios ni identificadores. Errores solo desde esta actualización.'
            result.update(self.r.live_counters.historical(session)[0])
            return Response(json.dumps(result),mimetype='application/json',headers={'Content-Disposition':'attachment; filename=tikreader-resumen-anonimo.json'})
