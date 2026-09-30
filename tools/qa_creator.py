"""Isolated browser QA. All writes use a disposable database and media directory."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'app'))
import tempfile
import time
import server
from history_store import HistoryStore

if __name__=='__main__':
    @server.app.after_request
    def qa_error_trace(response):
        if response.mimetype=='text/html':
            hook="<script>addEventListener('error',e=>{if(e.error)console.error('QA stack: '+e.error.stack)});</script>"
            response.set_data(response.get_data(as_text=True).replace('<head>','<head>'+hook,1))
        return response
    with tempfile.TemporaryDirectory(prefix='creator-qa-') as folder:
        server.archive=HistoryStore(Path(folder)/'history.sqlite3')
        server.interactive.folder=Path(folder)/'media'
        server.feed_session='qa-session'
        server.state['username']='ejemplo_qa'
        server.archive.start('qa-session','ejemplo_qa')
        for n in range(12):
            server.archive.save('qa-session','gift',dict(id='qa-'+str(n),user='@ejemplo_'+str(n%4),gift='Rosa',count=n+1,diamonds=(n+1)*10,occurred_at=time.time()-n*86400))
        print('QA aislada: http://127.0.0.1:5012/creator',flush=True)
        server.socketio.run(server.app,host='127.0.0.1',port=5012,debug=False,allow_unsafe_werkzeug=True)
