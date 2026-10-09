"""Durable gift contents and validated, per-image cavity geometry."""
import math
import re
from uuid import uuid4

BANKS = ('cochito', 'cochita', 'pato', 'oso', 'perro', 'gato', 'custom')
DEFAULT_BANK_SCALES = {bank: 100.0 for bank in BANKS}
CUSTOM_BANK_DEFAULTS = {
    'custom_bank_asset': None,
    'bank_position': {'x': 50.0, 'y': 50.0},
    'bank_scale': 100.0,
    'bank_scales': dict(DEFAULT_BANK_SCALES),
    'entry_point': {'x': 50.0, 'y': 16.0},
}
ASSET_ID = re.compile(r'[a-f0-9]{32}\.(?:png|jpg|webp)\Z')


def _valid_asset_id(value):
    return isinstance(value, str) and ASSET_ID.fullmatch(value) is not None


def _number_in_range(value, low, high):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        number = float(value)
    except (OverflowError, ValueError):
        return False
    return math.isfinite(number) and low <= number <= high


def _valid_pair(value):
    return (isinstance(value, dict) and set(value) == {'x', 'y'} and
            all(_number_in_range(value[key], 0, 100) for key in ('x', 'y')))


def normalize_custom_bank_fields(value):
    """Restore bank settings, migrating a legacy effective scale to its selected model."""
    value = value if isinstance(value, dict) else {}
    asset = value.get('custom_bank_asset')
    position, entry = value.get('bank_position'), value.get('entry_point')
    selected = value.get('bank') if value.get('bank') in BANKS else 'cochito'
    scales = dict(DEFAULT_BANK_SCALES)
    supplied = value.get('bank_scales')
    if isinstance(supplied, dict):
        for bank in BANKS:
            scale = supplied.get(bank)
            if _number_in_range(scale, 25, 200):
                scales[bank] = float(scale)
    legacy = value.get('bank_scale')
    if (not isinstance(supplied, dict) or selected not in supplied) and _number_in_range(legacy, 25, 200):
        scales[selected] = float(legacy)
    return {
        'custom_bank_asset': asset if _valid_asset_id(asset) else None,
        'bank_position': dict(position) if _valid_pair(position) else dict(CUSTOM_BANK_DEFAULTS['bank_position']),
        'bank_scale': scales[selected],
        'bank_scales': scales,
        'entry_point': dict(entry) if _valid_pair(entry) else dict(CUSTOM_BANK_DEFAULTS['entry_point']),
    }


def validate_custom_bank_fields(data, current):
    """Validate provided custom image and percentage fields without mutating state."""
    if not isinstance(data, dict):
        raise ValueError('Configuración de alcancía inválida')
    result = normalize_custom_bank_fields(current)
    selected = data.get('bank', current.get('bank', 'cochito') if isinstance(current, dict) else 'cochito')
    if selected not in BANKS:
        raise ValueError('Alcancía desconocida')
    scales = dict(result['bank_scales'])
    if 'bank_scales' in data:
        supplied = data['bank_scales']
        if not isinstance(supplied, dict) or any(bank not in BANKS for bank in supplied):
            raise ValueError('Tamaños de alcancía inválidos')
        for bank, scale in supplied.items():
            if not _number_in_range(scale, 25, 200):
                raise ValueError('El tamaño de la alcancía debe estar entre 25% y 200%')
            scales[bank] = float(scale)
    asset = data.get('custom_bank_asset', result['custom_bank_asset'])
    if asset is not None and not _valid_asset_id(asset):
        raise ValueError('Imagen de alcancía inválida')
    result['custom_bank_asset'] = asset
    for key in ('bank_position', 'entry_point'):
        if key in data:
            if not _valid_pair(data[key]):
                raise ValueError('Usa coordenadas X e Y entre 0 y 100')
            result[key] = {axis: float(data[key][axis]) for axis in ('x', 'y')}
    if 'bank_scale' in data:
        scale = data['bank_scale']
        if not _number_in_range(scale, 25, 200):
            raise ValueError('El tamaño de la alcancía debe estar entre 25% y 200%')
        scales[selected] = float(scale)
    result['bank_scales'] = scales
    result['bank_scale'] = scales[selected]
    return result

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
