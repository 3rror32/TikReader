"""Pure offline validation of persisted shapes consumed during application startup."""
import math

DICT_SETTINGS = frozenset('''automatic_backups browser_preferences chatbot points_config minecraft_config
production_config overlay_goals bank_contents interactive_overlay_games overlay_animations stream_buddies
seasonal_overlays emoji_overlay user_info_overlay microphone_caption_settings media_labels widget_customizations
draft_voice'''.split())
LIST_SETTINGS = frozenset('''gift_catalog_cache interactive_rules game_hotkeys game_hotkey_profiles
game_hotkey_backups animation_templates config_undo'''.split())


def require(condition):
    if not condition:
        raise ValueError('Ajustes guardados incompatibles; no se reemplazaron los datos.')


def number(value, minimum=0, maximum=None, integer=False):
    require(type(value) in ((int,) if integer else (int, float)))
    try:
        require(math.isfinite(value) and value >= minimum and (maximum is None or value <= maximum))
    except OverflowError:
        raise ValueError('Número guardado fuera de rango') from None


def fields(value, numbers=None, booleans=(), strings=()):
    for key, bounds in (numbers or {}).items():
        if key in value:
            number(value[key], *bounds)
    for key in booleans:
        if key in value:
            require(type(value[key]) is bool)
    for key in strings:
        if key in value:
            require(isinstance(value[key], str))


def validate_setting(key, value):
    if key in DICT_SETTINGS:
        require(isinstance(value, dict))
    if key in LIST_SETTINGS:
        require(isinstance(value, list))
    if key in ('like_goal', 'gift_goal'):
        number(value, 1, 10000000, integer=True)
    elif key == 'timer_checkpoint':
        # Checkpoints are floats from timer(); older writers may have accumulated
        # more than a day. Preserve finite nonnegative values without recovery clamping.
        number(value)
    elif key == 'global_limit':
        number(value, 1, 1000, integer=True)
    elif key == 'external_ttl':
        number(value, 1, 60, integer=True)
    elif key == 'effects_mode':
        require(value in ('enqueue', 'replace', 'skip'))
    elif key == 'config_draft':
        require(value is None or isinstance(value, dict))
    elif key == 'game_hotkey_profiles':
        require(all(isinstance(item, str) and item.strip() and len(item) <= 60 for item in value))
    elif key in ('interactive_rules', 'game_hotkeys', 'animation_templates', 'game_hotkey_backups', 'config_undo'):
        require(all(isinstance(item, dict) for item in value))
    elif key == 'gift_catalog_cache':
        for row in value:
            require(isinstance(row, dict))
            if 'id' in row:
                require(type(row['id']) in (str, int))
            fields(row, strings=('name',))
            if row.get('diamonds') is not None:
                number(row['diamonds'])
    elif key == 'production_config':
        fields(value, {'revision': (0, None, True)}, ('emergency', 'hide_names', 'hide_photos', 'redact'), ('announcement',))
        if 'scene' in value:
            require(value['scene'] in ('start', 'talk', 'pause', 'end'))
        require(len(value.get('announcement', '')) <= 500)
    elif key == 'overlay_goals':
        for row in value.values():
            require(isinstance(row, dict))
            fields(row, {'goal': (1, 10000000, True), 'value': (0, 10000000, True)}, strings=('title', 'gift'))
    elif key == 'bank_contents':
        fields(value, {'score': (0, 9999999, True)})
        for name in ('shapes', 'source_counts'):
            if name in value:
                require(isinstance(value[name], dict))
        if 'contents' in value:
            require(isinstance(value['contents'], list))
            for row in value['contents']:
                require(isinstance(row, dict))
                if 'id' in row:
                    identifier = row['id']
                    require(type(identifier) is int and identifier >= 0 or isinstance(identifier, str) and identifier.isascii() and identifier.isdecimal())
    elif key == 'interactive_overlay_games':
        for game, bounds in {'wheel': {'duration': (2, 12), 'turns': (2, 12)},
                             'drop': {'speed': (1.5, 12), 'size': (36, 120), 'density': (1, 20)}}.items():
            if game not in value:
                continue
            row = value[game]
            require(isinstance(row, dict))
            fields(row, bounds, ('show_result', 'show_score'), ('title', 'bank'))
            if 'options' in row:
                require(isinstance(row['options'], list) and 2 <= len(row['options']) <= 12 and
                        all(isinstance(option, str) and option.strip() and len(option) <= 80 for option in row['options']))
    elif key == 'points_config':
        fields(value, {**{field: (0, 100000, True) for field in ('comment', 'like', 'gift', 'follow', 'share', 'subscribe')},
                       'subscriber_multiplier': (1, 10), 'points_per_level': (1, 1000000, True)}, ('enabled',), ('currency',))
    elif key == 'automatic_backups':
        fields(value, {field: (0,) for field in ('last_at', 'last_attempt_at', 'next_at')}, ('enabled',), ('last_file', 'last_error', 'status_error'))
        if 'interval_hours' in value:
            require(type(value['interval_hours']) is int and value['interval_hours'] in (6, 12, 24, 72, 168))
        if 'keep' in value:
            require(type(value['keep']) is int and value['keep'] in (3, 7, 14, 30))
    elif key == 'chatbot':
        fields(value, {'interval': (60, 3600, True)}, strings=('message', 'bot_user'))
        if 'commands' in value:
            require(isinstance(value['commands'], list) and all(isinstance(row, dict) for row in value['commands']))
    elif key == 'browser_preferences':
        require(all(isinstance(item, str) for item in value.values()))
    elif key.startswith('creator_'):
        require(isinstance(value, dict))
        fields(value, {'revision': (0, None, True)})
        if 'items' in value:
            require(isinstance(value['items'], dict))
    # Unrecognized finite JSON values remain compatible and are never rewritten.
