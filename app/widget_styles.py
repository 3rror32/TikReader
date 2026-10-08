"""Individual overlay palettes, shared by the editor and broadcast output."""

# Background, accent, display font. Saved customizations take precedence.
WIDGET_STYLES = {
    'goals': ('#102b29', '#69e4c0', 'Inter'),
    'goal-likes': ('#351725', '#ff83ae', 'Trebuchet MS'),
    'goal-shares': ('#112c3b', '#65d7ff', 'Arial'),
    'goal-follows': ('#251d40', '#bfa0ff', 'Verdana'),
    'goal-viewers': ('#132d23', '#9de46b', 'Courier New'),
    'goal-coins': ('#382a10', '#ffd166', 'Georgia'),
    'goal-subscribers': ('#341c32', '#f29cdd', 'Georgia'),
    'goal-custom-1': ('#153334', '#55e1d8', 'Trebuchet MS'),
    'goal-custom-2': ('#352114', '#ffa65c', 'Arial'),
    'goal-custom-3': ('#172642', '#8baeff', 'Courier New'),
    'countdown-likes': ('#381823', '#ff7193', 'Trebuchet MS'),
    'countdown-shares': ('#113137', '#63e4de', 'Arial'),
    'countdown-follows': ('#292047', '#c2a4ff', 'Georgia'),
    'countdown-viewers': ('#142b43', '#73c7ff', 'Courier New'),
    'countdown-coins': ('#3a2c13', '#ffda75', 'Georgia'),
    'countdown-subscribers': ('#391c3c', '#f69fe8', 'Verdana'),
    'countdown-custom-1': ('#273313', '#c1e979', 'Courier New'),
    'countdown-custom-2': ('#3d2219', '#ffab7a', 'Trebuchet MS'),
    'countdown-custom-3': ('#182c30', '#9edbd1', 'Georgia'),
    'gifts': ('#33203d', '#d8a2ff', 'Inter'),
    'top-gift': ('#342a12', '#f8d16c', 'Inter'),
    'top-streak': ('#3b201c', '#ff9476', 'Inter'),
    'gift-counter-1': ('#18332d', '#70e0b7', 'Inter'),
    'gift-counter-2': ('#1b2943', '#8fbcff', 'Inter'),
    'gift-counter-3': ('#3a1d30', '#f99cce', 'Inter'),
    'latest-gifts': ('#332716', '#eec578', 'Inter'),
    'latest-comments': ('#18333b', '#78d7ed', 'Inter'),
    'latest-events': ('#28213d', '#baabff', 'Inter'),
    'chat': ('#262626', '#e890d0', 'Arial'),
    'highlight': ('#3a1e2b', '#ff9fba', 'Inter'),
    'webcam-frame': ('#132f3a', '#5de0f1', 'Inter'),
    'talking-banner': ('#2c2044', '#c4a4ff', 'Inter'),
    'announcement': ('#3b2317', '#ffb47c', 'Inter'),
    'timer': ('#111820', '#5db8f3', 'Segoe UI'),
    'fortune-wheel': ('#331d34', '#f19ddb', 'Inter'),
    'point-drop': ('#253049', '#a7bcff', 'Inter'),
    'top-likes': ('#251725', '#ff89bd', 'Arial'),
    'top-donors': ('#202024', '#44b9f0', 'Arial'),
    'ranking': ('#392c15', '#eac975', 'Inter'),
    'stats': ('#173039', '#7dd9e7', 'Inter'),
}


def widget_defaults(base, panel=None):
    defaults = dict(base)
    if panel in WIDGET_STYLES:
        background, accent, font = WIDGET_STYLES[panel]
        defaults.update(background=background, accent_color=accent,
                        border_color=accent, font_family=font)
    if panel == 'chat':
        defaults.update(font_size=18,title_size=18,radius=8,opacity=85,show_time=False,show_connection=False,animation='none')
    if panel in ('top-donors','top-likes'):
        defaults.update(show_background=False,show_connection=False,show_time=False,max_items=10,font_size=18,title_size=19,animation='none')
    if panel == 'timer':
        defaults.update(font_size=64,title_size=14,alignment='center',animation='none',show_connection=False,
                        timer_title='TIEMPO RESTANTE',timer_format='hms',timer_show_label=True,
                        timer_show_state=True,timer_warning_seconds=30,timer_digit_animation='flip',
                        timer_animation_speed=420,timer_glow=True)
    return defaults
