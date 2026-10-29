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
_CATEGORIES = (
    ('actions', 'Acciones'), ('animals', 'Animales'), ('aquatic', 'Acuáticos'),
    ('helpers', 'Ayudantes'), ('undead', 'No-muertos'), ('hostile', 'Hostiles'),
    ('nether', 'Nether'), ('end', 'End'), ('bosses', 'Jefes'),
)
# Canonical IDs are persisted; only this allowlist resolves edition-specific entity IDs.
_MOBS = {
    'pig': ('Cerdo', 'animals'),
    'cow': ('Vaca', 'animals'),
    'sheep': ('Oveja', 'animals'),
    'chicken': ('Gallina', 'animals'),
    'bee': ('Abeja', 'animals'),
    'armadillo': ('Armadillo', 'animals'),
    'horse': ('Caballo', 'animals'),
    'donkey': ('Burro', 'animals'),
    'mule': ('Mula', 'animals'),
    'camel': ('Camello', 'animals'),
    'rabbit': ('Conejo', 'animals'),
    'cat': ('Gato', 'animals'),
    'wolf': ('Lobo', 'animals'),
    'fox': ('Zorro', 'animals'),
    'ocelot': ('Ocelote', 'animals'),
    'panda': ('Panda', 'animals'),
    'polar_bear': ('Oso polar', 'animals'),
    'goat': ('Cabra', 'animals'),
    'llama': ('Llama', 'animals'),
    'trader_llama': ('Llama del comerciante', 'animals'),
    'mooshroom': ('Champiñaca', 'animals'),
    'parrot': ('Loro', 'animals'),
    'bat': ('Murciélago', 'animals'),
    'sniffer': ('Rastreador', 'animals'),
    'axolotl': ('Ajolote', 'aquatic'),
    'frog': ('Rana', 'aquatic'),
    'tadpole': ('Renacuajo', 'aquatic'),
    'turtle': ('Tortuga', 'aquatic'),
    'dolphin': ('Delfín', 'aquatic'),
    'squid': ('Calamar', 'aquatic'),
    'glow_squid': ('Calamar brillante', 'aquatic'),
    'cod': ('Bacalao', 'aquatic'),
    'salmon': ('Salmón', 'aquatic'),
    'tropical_fish': ('Pez tropical', 'aquatic'),
    'pufferfish': ('Pez globo', 'aquatic'),
    'nautilus': ('Nautilo', 'aquatic'),
    'guardian': ('Guardián', 'aquatic'),
    'elder_guardian': ('Guardián anciano', 'aquatic'),
    'villager': ('Aldeano', 'helpers'),
    'wandering_trader': ('Comerciante ambulante', 'helpers'),
    'allay': ('Allay', 'helpers'),
    'iron_golem': ('Gólem de hierro', 'helpers'),
    'snow_golem': ('Gólem de nieve', 'helpers'),
    'copper_golem': ('Gólem de cobre', 'helpers'),
    'happy_ghast': ('Ghast feliz', 'helpers'),
    'zombie': ('Zombi', 'undead'),
    'skeleton': ('Esqueleto', 'undead'),
    'drowned': ('Ahogado', 'undead'),
    'husk': ('Zombi momificado', 'undead'),
    'zombie_villager': ('Aldeano zombi', 'undead'),
    'zombie_horse': ('Caballo zombi', 'undead'),
    'camel_husk': ('Camello momificado', 'undead'),
    'zombie_nautilus': ('Nautilo zombi', 'undead'),
    'stray': ('Esqueleto glacial', 'undead'),
    'bogged': ('Esqueleto pantanoso', 'undead'),
    'parched': ('Esqueleto reseco', 'undead'),
    'skeleton_horse': ('Caballo esqueleto', 'undead'),
    'creeper': ('Creeper', 'hostile'),
    'spider': ('Araña', 'hostile'),
    'cave_spider': ('Araña de cueva', 'hostile'),
    'slime': ('Slime', 'hostile'),
    'silverfish': ('Lepisma', 'hostile'),
    'phantom': ('Fantasma', 'hostile'),
    'witch': ('Bruja', 'hostile'),
    'pillager': ('Saqueador', 'hostile'),
    'vindicator': ('Vindicador', 'hostile'),
    'evoker': ('Invocador', 'hostile'),
    'vex': ('Vex', 'hostile'),
    'ravager': ('Devastador', 'hostile'),
    'breeze': ('Breeze', 'hostile'),
    'creaking': ('Crujidor', 'hostile'),
    'sulfur_cube': ('Cubo de azufre', 'hostile'),
    'blaze': ('Blaze', 'nether'),
    'ghast': ('Ghast', 'nether'),
    'magma_cube': ('Cubo de magma', 'nether'),
    'hoglin': ('Hoglin', 'nether'),
    'zoglin': ('Zoglin', 'nether'),
    'piglin': ('Piglin', 'nether'),
    'piglin_brute': ('Piglin bruto', 'nether'),
    'zombified_piglin': ('Piglin zombificado', 'nether'),
    'wither_skeleton': ('Esqueleto wither', 'nether'),
    'strider': ('Lavagante', 'nether'),
    'enderman': ('Enderman', 'end'),
    'endermite': ('Endermite', 'end'),
    'shulker': ('Shulker', 'end'),
    'warden': ('Warden', 'bosses'),
    'wither': ('Wither', 'bosses'),
    'ender_dragon': ('Dragón del End', 'bosses'),
}
_BEDROCK_ALIASES = {'evoker': 'evocation_illager', 'zombified_piglin': 'zombie_pigman',
                    'tropical_fish': 'tropicalfish'}
_NOTES = {'ender_dragon': 'La visibilidad del nombre depende de Minecraft.'}
for _entity, (_name, _category) in _MOBS.items():
    if _entity != 'zombie':
        _COMMON[_entity] = (_name, 'Mob con el nombre del donante.', ())
_EFFECTS = {'speed': ('speed', 20), 'jump': ('jump_boost', 20), 'heal': ('instant_health', 1)}


def catalog():
    return [dict(id=key, name=value[0], description=value[1],
                 category=_MOBS[key][1] if key in _MOBS else 'actions',
                 **({'note': _NOTES[key]} if key in _NOTES else {}),
                 **({'quantity_min': 1, 'quantity_max': 20, 'quantity_default': 5 if key == 'tnt_rain' else 1}
                    if is_spawn(key) else {})) for key, value in _COMMON.items()]


def categories():
    return [{'id': key, 'name': name} for key, name in _CATEGORIES]


def is_spawn(preset_id):
    return preset_id == 'tnt_rain' or preset_id in _MOBS


def quantity_for(preset_id, value=None):
    if preset_id not in _COMMON:
        raise ValueError('Acción rápida inválida')
    if value is None:
        return 5 if preset_id == 'tnt_rain' else 1
    if type(value) is not int or not 1 <= value <= (20 if is_spawn(preset_id) else 1):
        raise ValueError('Cantidad: usa un entero entre 1 y 20 para TNT y mobs')
    return value


def command_cost(preset_id, quantity, gift_count):
    quantity = quantity_for(preset_id, quantity)
    return quantity * gift_count if is_spawn(preset_id) else 1


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


def commands_for(preset_id, edition, donor='Prueba', java_format='modern', quantity=None):
    if preset_id not in _COMMON or edition not in ('java', 'bedrock'):
        raise ValueError('Acción rápida inválida')
    amount = quantity_for(preset_id, quantity)
    if preset_id == 'tnt_rain':
        # The fixed five-position pattern repeats; no external coordinates are accepted.
        return tuple('execute at @p run summon minecraft:tnt '+_OFFSETS[i % len(_OFFSETS)] for i in range(amount))
    if preset_id in _MOBS:
        literal = json.dumps(donor_name(donor), ensure_ascii=False)
        entity = _BEDROCK_ALIASES.get(preset_id, preset_id) if edition == 'bedrock' else preset_id
        prefix = 'execute at @p run summon minecraft:'+entity+' '
        if edition == 'bedrock':
            return (prefix + literal + ' ~2 ~ ~',) * amount
        if name_format(java_format) == 'modern':
            component = '{text:' + literal + '}'
        else:
            encoded = json.dumps({'text': donor_name(donor)}, ensure_ascii=False, separators=(',', ':'))
            component = "'" + encoded.replace('\\', '\\\\').replace("'", "\\'") + "'"
        return (prefix + '~2 ~ ~ {CustomName:' + component + ',CustomNameVisible:1b}',) * amount
    if preset_id in _EFFECTS:
        effect, duration = _EFFECTS[preset_id]
        command = f'effect give @p minecraft:{effect}' if edition == 'java' else f'effect @p {effect}'
        return (f'{command} {duration} 1',)
    return _COMMON[preset_id][2]


def mappings(values=None, previous=None):
    if values is None:
        values = {}
    if not isinstance(values, dict) or set(values)-set(_COMMON):
        raise ValueError('Acciones rápidas inválidas')
    result = {}
    for key in _COMMON:
        row = values.get(key, {})
        if not isinstance(row, dict) or set(row)-{'gift_id', 'gift_name', 'enabled', 'quantity'}:
            raise ValueError('Configuración de acción rápida inválida')
        gift_id, name, enabled = row.get('gift_id', ''), row.get('gift_name', ''), row.get('enabled', False)
        if (not isinstance(gift_id, str) or len(gift_id) > 100 or not isinstance(name, str) or
                len(name) > 100 or not isinstance(enabled, bool) or (enabled and not gift_id.strip())):
            raise ValueError('Selecciona un regalo antes de activar la acción')
        result[key] = {'gift_id': gift_id.strip(), 'gift_name': name.strip(), 'enabled': enabled}
        if 'quantity' in row and row['quantity'] is None:
            raise ValueError('Cantidad inválida')
        old_quantity = (previous or {}).get(key, {}).get('quantity')
        amount = quantity_for(key, row.get('quantity', old_quantity))
        if is_spawn(key):result[key]['quantity'] = amount
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
    gift_count: int = 1
    quantities: tuple = ()
