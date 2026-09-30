from pathlib import Path as _BootstrapPath
import sys as _bootstrap_sys
_bootstrap_sys.path.insert(0, str(_BootstrapPath(__file__).resolve().parent.parent / 'app'))
"""Manual UI QA server: temporary data, no LIVE connection, port 5001."""
import tempfile
from pathlib import Path
import server
from history_store import HistoryStore
with tempfile.TemporaryDirectory(prefix='tikreader-ui-') as folder:
    server.archive=HistoryStore(Path(folder)/'qa.sqlite3')
    server.archive.start('qa','sesion_de_prueba')
    server.archive.save('qa','comment',dict(id='1',user='qa',comment='hola'))
    server.production.settings['emergency']=True
    server.socketio.run(server.app,host='127.0.0.1',port=5001,debug=False,allow_unsafe_werkzeug=True)
