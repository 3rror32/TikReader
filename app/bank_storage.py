"""Durable gift contents and validated, per-image cavity geometry."""
import math
from uuid import uuid4

BANKS = ('cochito', 'cochita', 'pato', 'oso', 'perro', 'gato')

def validate_shape(value):
    if not isinstance(value, dict):
        raise ValueError('Cavidad inválida')
    points, slot = value.get('points'), value.get('slot')
    def pair(p):
        return (isinstance(p, list) and len(p) == 2 and
                all(isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n) and 0 <= n <= 100 for n in p))
    if not isinstance(points, list) or not 6 <= len(points) <= 64 or not all(pair(p) for p in points) or not pair(slot):
        raise ValueError('Usa entre 6 y 64 puntos dentro de la imagen')
    def cross(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    for i, a in enumerate(points):
        b = points[(i+1) % len(points)]
        if math.dist(a, b) < .25:
            raise ValueError('Separa los puntos del contorno')
        for j in range(i+1, len(points)):
            if j == i+1 or (i == 0 and j == len(points)-1):
                continue
            c, d = points[j], points[(j+1) % len(points)]
            if cross(a,b,c)*cross(a,b,d) <= 0 and cross(c,d,a)*cross(c,d,b) <= 0 and max(min(a[0],b[0]),min(c[0],d[0])) <= min(max(a[0],b[0]),max(c[0],d[0])) and max(min(a[1],b[1]),min(c[1],d[1])) <= min(max(a[1],b[1]),max(c[1],d[1])):
                raise ValueError('El contorno no puede cruzarse')
    area = abs(sum(a[0]*points[(i+1)%len(points)][1]-a[1]*points[(i+1)%len(points)][0] for i,a in enumerate(points)))/2
    if area < 100:
        raise ValueError('La cavidad es demasiado pequeña')
    return {'points': points, 'slot': slot}

def restore(runtime, state, restore_contents=True):
    state.update(contents=[], epoch=uuid4().hex, shapes={}, source_counts={})
    saved = runtime.archive.settings().get('bank_contents', {}) if runtime.archive else {}
    if not isinstance(saved, dict):
        return
    state['score'] = 0
    if restore_contents:
        state['contents'] = [e for e in saved.get('contents', [])[-220:] if isinstance(e,dict) and 'id' in e]
        state['score'] = max(0, min(9999999, int(saved.get('score', 0))))
        state['epoch'] = saved.get('epoch') or state['epoch']
        counts = saved.get('source_counts')
        if isinstance(counts, dict):
            state['source_counts'] = {k: v for k, v in counts.items() if isinstance(k, str) and isinstance(v, int) and v >= 0}
        else:
            for event in state['contents']:
                source = event.get('source_id')
                if source:
                    state['source_counts'][source] = state['source_counts'].get(source, 0) + 1
    for key, value in saved.get('shapes', {}).items():
        if key in BANKS:
            try: state['shapes'][key] = validate_shape(value)
            except ValueError: pass

def persist(runtime, state):
    if runtime.archive:
        runtime.archive.set_setting('bank_contents', {key: state.get(key, {}) for key in ('score','contents','epoch','shapes','source_counts')})
