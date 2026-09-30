"""OS-held workspace lock plus an existing-listener check; never kill another process."""
from pathlib import Path
import os
import socket

class InstanceGuard:
    def __init__(self, path, port=5000):
        self.file=None
        path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
        f=path.open('a+b')
        try:
            f.seek(0);f.write(b'0');f.flush();f.seek(0)
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(f.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)
            self.file=f
            if port:
                with socket.socket() as sock:
                    sock.settimeout(.3)
                    if sock.connect_ex(('127.0.0.1',port))==0:
                        raise RuntimeError('Ya hay un servidor en el puerto 5000. Abre http://localhost:5000; no inicies otra copia.')
        except Exception as exc:
            f.close();self.file=None
            raise RuntimeError('TikReader ya está abierto o no se pudo reservar su instancia. '+str(exc)) from exc
    def close(self):
        if self.file:self.file.close();self.file=None
