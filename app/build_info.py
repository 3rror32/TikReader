"""Allowlisted immutable package provenance; no Git or environment probes at runtime."""
from datetime import datetime, timezone
from functools import lru_cache
import json
from pathlib import Path
import re

from app_config import APP_VERSION
from app_paths import ROOT

VERSION = re.compile(r'\d+\.\d+\.\d+\.\d+\Z')
REVISION = re.compile(r'(?:[0-9a-f]{40}|[0-9a-f]{64})\Z')


def valid_identity(info, version, channel):
    required = {'schema','package_id','source_revision','source_dirty','built_at','provenance','release_version','channel'}
    if not isinstance(info, dict) or not required <= info.keys():
        return False
    try:
        stamp = info['built_at']
        parsed = datetime.strptime(stamp, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
        return (info.get('schema') == 1 and type(info.get('schema')) is int and
                isinstance(info.get('package_id'), str) and re.fullmatch('[0-9a-f]{64}', info['package_id']) is not None and
                (info.get('source_revision') is None or isinstance(info['source_revision'], str) and REVISION.fullmatch(info['source_revision']) is not None) and
                (info.get('source_dirty') is None or type(info['source_dirty']) is bool) and
                info.get('provenance') in ('git', 'unavailable') and
                (info['provenance'] != 'unavailable' or info['source_revision'] is None and info['source_dirty'] is None) and
                (info['provenance'] != 'git' or info.get('source_revision') is not None and type(info.get('source_dirty')) is bool) and
                info.get('release_version') == version and info.get('channel') == channel and parsed.year >= 1970)
    except (KeyError, TypeError, ValueError):
        return False


def read_build_info(root=ROOT):
    result = {'mode': 'development', 'status': 'development', 'package_id': None,
              'source_revision': None, 'source_dirty': None, 'built_at': None,
              'provenance': 'unavailable', 'release_version': APP_VERSION, 'channel': 'development'}
    path = Path(root) / 'distribution.json'
    try:
        if not path.exists():
            return result
        result.update(mode='packaged', status='invalid', channel='unknown')
        if path.stat().st_size > 65536:
            return result
        metadata = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(metadata, dict):
            return result
        version, channel = metadata.get('version'), metadata.get('channel')
        if not isinstance(version, str) or VERSION.fullmatch(version) is None:
            return result
        result['release_version'] = version
        if channel not in ('beta', 'stable'):
            return result
        result['channel'] = channel
        if 'build_info' not in metadata:
            result['status'] = 'legacy'
            return result
        info = metadata['build_info']
        if valid_identity(info, version, channel):
            result.update({key: info[key] for key in ('package_id','source_revision','source_dirty','built_at','provenance')})
            result['status'] = 'known'
    except (OSError, ValueError, TypeError):
        result.update(mode='packaged', status='invalid', channel='unknown')
    return result


@lru_cache(maxsize=8)
def load_build_info(root=ROOT):
    return read_build_info(root)


def display_build_info(info):
    if info['mode'] == 'development':
        return 'Desarrollo local · identidad de paquete no disponible.'
    if info['status'] != 'known':
        return 'Identidad de compilación no disponible en este paquete.'
    revision = info['source_revision'][:12] if info['source_revision'] else 'no disponible'
    state = 'con cambios locales' if info['source_dirty'] is True else 'sin cambios locales' if info['source_dirty'] is False else 'estado no disponible'
    return f"Paquete {info['package_id'][:12]} · revisión {revision} · {state} · {info['built_at']}"
