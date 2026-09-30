"""Installed builds keep all mutable files in the Windows user profile.

Source checkouts retain their existing layout; TIKREADER_DATA_DIR also permits
isolated validation without touching the operator's active session.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MICROPHONE_MODEL_NAME = 'vosk-model-small-es-0.42'


def installed(root=ROOT):
    return (Path(root) / 'distribution.json').is_file()


def data_dir(root=ROOT):
    override = os.environ.get('TIKREADER_DATA_DIR')
    if override:
        return Path(override).expanduser().resolve()
    if installed(root):
        base = os.environ.get('LOCALAPPDATA')
        return (Path(base) if base else Path.home() / 'AppData' / 'Local') / 'TikReader'
    return Path(root) / 'data'


def voice_models_dir(root=ROOT):
    return data_dir(root) / 'voice_models' if installed(root) or os.environ.get('TIKREADER_DATA_DIR') else Path(root) / 'assets' / 'voice_models'


def kokoro_assets(root=ROOT):
    return data_dir(root) / 'voices' / 'kokoro' if installed(root) or os.environ.get('TIKREADER_DATA_DIR') else Path(root) / 'assets' / 'kokoro'


def kokoro_runtime(root=ROOT):
    return data_dir(root) / 'runtimes' / 'kokoro' if installed(root) or os.environ.get('TIKREADER_DATA_DIR') else Path(root) / 'runtime' / 'kokoro'


def kokoro_python(root=ROOT):
    folder = kokoro_runtime(root)
    return folder / 'python.exe' if (folder / 'python.exe').is_file() else folder / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')


def microphone_speech_model(root=ROOT):
    """Use an operator-provided model first, then the model bundled with releases."""
    root = Path(root)
    user_model = data_dir(root) / 'speech' / MICROPHONE_MODEL_NAME
    bundled_model = root / 'assets' / 'speech' / MICROPHONE_MODEL_NAME
    for candidate in (user_model, bundled_model):
        if (candidate / 'am' / 'final.mdl').is_file():
            return candidate
    return user_model
