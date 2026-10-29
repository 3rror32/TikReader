"""Fixed vanilla quick actions; gift settings never contain command text."""
from dataclasses import dataclass
import json
import re
import unicodedata


_OFFSETS = ('~ ~8 ~', '~2 ~8 ~', '~-2 ~8 ~', '~ ~8 ~2', '~ ~8 ~-2')
_COMMON = {
    'tnt_rain': ('Lluvia de TNT', '5 TNT sobre el jugador más cercano.',
                 tuple('execute at @p run summon minecraft:tnt '+position for position in _OFFSETS)),
    'zombie': ('Zombi', '1 zombi a dos bloques del jugador más cercano.',
               ('execute at @p run summon minecraft:zombie ~2 ~ ~',)),
    'rain': ('Lluvia', 'Cambia el clima a lluvia.', ('weather rain',)),
    'thunder': ('Tormenta', 'Cambia el clima a tormenta.', ('weather thunder',)),
    'night': ('Noche', 'Cambia la hora a noche.', ('time set night',)),
    'diamonds': ('Diamantes', 'Entrega 5 diamantes al jugador más cercano.', ('give @p minecraft:diamond 5',)),
    'speed': ('Velocidad II', 'Velocidad II durante 20 segundos.', ()),
    'jump': ('Salto II', 'Salto II durante 20 segundos.', ()),
    'heal': ('Curación II', 'Aplica curación instantánea II una vez.', ()),
}
_EFFECTS = {'speed': ('speed', 20), 'jump': ('jump_boost', 20), 'heal': ('instant_health', 1)}


def catalog():
    return [{'id': key, 'name': value[0], 'description': value[1]} for key, value in _COMMON.items()]


def donor_name(value, fallback='Invitado'):
    text = unicodedata.normalize('NFKC', str(value or ''))
    text = re.sub(r'§.', '', text)
    text = ''.join(c for c in text if not unicodedata.category(c).startswith('C') and c not in '§;{}[]')
    text = text.strip().lstrip('@').strip()[:32]
    while len(text.encode('utf-8')) > 128:
        text = text[:-1]
    return text or fallback


def limits(values=None):
    values = {'interval': 3, 'per_minute': 20} if values is None else values
    if (not isinstance(values, dict) or set(values) != {'interval', 'per_minute'} or
            type(values['interval']) is not int or not 1 <= values['interval'] <= 60 or
            type(values['per_minute']) is not int or not 5 <= values['per_minute'] <= 120):
        raise ValueError('Usa un intervalo de 1 a 60 segundos y entre 5 y 120 efectos por minuto')
    return dict(values)


def name_format(value='modern'):
    if value not in ('modern', 'legacy'):
        raise ValueError('Formato de nombre Java inválido')
    return value


def commands_for(preset_id, edition, donor='Prueba', java_format='modern'):
    if preset_id not in _COMMON or edition not in ('java', 'bedrock'):
        raise ValueError('Acción rápida inválida')
    if preset_id == 'zombie':
        literal = json.dumps(donor_name(donor), ensure_ascii=False)
        prefix = 'execute at @p run summon minecraft:zombie '
        if edition == 'bedrock':
            return (prefix + literal + ' ~2 ~ ~',)
        if name_format(java_format) == 'modern':
            component = '{text:' + literal + '}'
        else:
            encoded = json.dumps({'text': donor_name(donor)}, ensure_ascii=False, separators=(',', ':'))
            component = "'" + encoded.replace('\\', '\\\\').replace("'", "\\'") + "'"
        return (prefix + '~2 ~ ~ {CustomName:' + component + ',CustomNameVisible:1b}',)
    if preset_id in _EFFECTS:
        effect, duration = _EFFECTS[preset_id]
        command = f'effect give @p minecraft:{effect}' if edition == 'java' else f'effect @p {effect}'
        return (f'{command} {duration} 1',)
    return _COMMON[preset_id][2]


def mappings(values=None):
    if values is None:
        values = {}
    if not isinstance(values, dict) or set(values)-set(_COMMON):
        raise ValueError('Acciones rápidas inválidas')
    result = {}
    for key in _COMMON:
        row = values.get(key, {})
        if not isinstance(row, dict) or set(row)-{'gift_id', 'gift_name', 'enabled'}:
            raise ValueError('Configuración de acción rápida inválida')
        gift_id, name, enabled = row.get('gift_id', ''), row.get('gift_name', ''), row.get('enabled', False)
        if (not isinstance(gift_id, str) or len(gift_id) > 100 or not isinstance(name, str) or
                len(name) > 100 or not isinstance(enabled, bool) or (enabled and not gift_id.strip())):
            raise ValueError('Selecciona un regalo antes de activar la acción')
        result[key] = {'gift_id': gift_id.strip(), 'gift_name': name.strip(), 'enabled': enabled}
    return result


@dataclass(frozen=True)
class PresetJob:
    preset_id: str
    commands: tuple
    created: float
    session: object
    revision: int
    edition: str
    preset_generation: int
    transport_generation: object
    automatic: bool

    selected_ids: tuple = ()
    donor: str = 'Prueba'
    admission_id: object = None
    command_labels: tuple = ()
