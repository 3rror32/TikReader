from pathlib import Path as _BootstrapPath
import sys as _bootstrap_sys
_bootstrap_sys.path.insert(0, str(_BootstrapPath(__file__).resolve().parent.parent / 'app'))
"""Isolated manual UI checks: no TikTok connection and no real keyboard input."""
import tempfile
from pathlib import Path
import server
import game_hotkeys
from history_store import HistoryStore

if __name__=='__main__':
    with tempfile.TemporaryDirectory(prefix='tikreader-ui-qa-') as folder:
        server.archive=HistoryStore(Path(folder)/'history.sqlite3')
        server.animation_studio.folder=Path(folder)/'alerts'
        server.interactive.folder=Path(folder)/'media'
        game_hotkeys.foreground=lambda:(1,'Juego de prueba local')
        server.game_hotkeys.injector=lambda keys,hold,hwnd:print('QA_KEYS',keys,flush=True)
        server.gift_catalog={'qa':{'id':'qa','name':'Regalo de prueba','diamonds':1}}
        server.socketio.run(server.app,host='127.0.0.1',port=5001,debug=False,allow_unsafe_werkzeug=True)
