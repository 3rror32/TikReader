"""Offline code packages. No downloads; apply only trusted packages, with server stopped."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import socket
import time
import uuid
import zipfile
import os
from app_paths import data_dir, installed

ROOT=Path(__file__).resolve().parent.parent
ROOT_FILES={'animation_studio.py','server.py','core_routes.py','history_routes.py','studio_routes.py','widget_routes.py','diagnostics_routes.py','production.py','interactivity.py','operator_tools.py','live_tools.py','reliability.py','voice_models.py','rvc_gpu_runner.py','setup_rvc.py','runtime_guard.py','runtime_state.py','system_routes.py','observability.py','app_config.py','preflight.py','game_hotkeys.py','spotify_integration.py','history_store.py','launcher.py','maintenance.py','organize_diagnostics.py','requirements.txt','requirements-dev.txt','pyproject.toml','.gitignore','README.md','INSTRUCCIONES.md','VALIDACION_FISICA.md','Iniciar TikReader.cmd','Instalar TikReader.cmd','Actualizar o recuperar TikReader.cmd'}
ROOT_FILES.update({'daily_diagnostics.py','live_counters.py','minecraft_connector.py','points_system.py','user_badges.py','data_recovery.py','Respaldar o recuperar datos.cmd','RECUPERACION.md'})

def organized_name(name):
    if name.startswith('static/icons/'):return name.replace('static/icons/', 'assets/icons/', 1)
    if name.startswith('static/stream-buddies/'):return name.replace('static/stream-buddies/', 'assets/sprites/', 1)
    if name.startswith(('static/', 'templates/')):return 'web/' + name
    if '/' not in name:
        if name.endswith('.py'):return ('tools/' if name in ('setup_rvc.py', 'organize_diagnostics.py') else 'app/') + name
        if name.endswith('.md'):return 'docs/' + name
        if name.endswith('.cmd') and name != 'Iniciar TikReader.cmd':return 'tools/' + name
    return name


ROOT_FILES = {organized_name(name) for name in ROOT_FILES}
ROOT_FILES.update('app/' + p.name for p in (ROOT / 'app').glob('*.py'))
ROOT_FILES.add('tools/create_shortcut.ps1')
ROOT_FILES.add('docs/ESTRUCTURA.md')


def allowed(name):
    p=PurePosixPath(name)
    safe = '\\' not in name and ':' not in name and not p.is_absolute() and '..' not in p.parts
    resource = len(p.parts) >= 2 and '/'.join(p.parts[:2]) in ('web/static', 'web/templates', 'assets/icons', 'assets/sprites')
    extension = p.suffix.lower() in ('.js', '.css', '.html', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.webmanifest', '.json', '.md', '.glsl', '.ts', '.txt')
    return safe and (name in ROOT_FILES or resource and (extension or p.name in ('LICENSE', 'NOTICE')))

def snapshot(root=ROOT):
    files={}
    candidates=[root/n for n in ROOT_FILES]+[p for folder in ('web/static','web/templates','assets/icons','assets/sprites') for p in (root/folder).rglob('*')]
    for p in candidates:
        if p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(root.resolve()) and allowed(p.relative_to(root).as_posix()):files[p.relative_to(root).as_posix()]=p.read_bytes()
    folder=data_dir(root)/'code-backups';folder.mkdir(parents=True,exist_ok=True)
    path=folder/(time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]+'.zip')
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        manifest={n:hashlib.sha256(b).hexdigest() for n,b in files.items()}
        z.writestr('manifest.json',json.dumps({'version':1,'files':manifest}))
        for n,b in files.items():z.writestr(n,b)
    return path

def read_package(path):
    with zipfile.ZipFile(path) as z:
        info=z.infolist()
        if len(info)>5000 or sum(x.file_size for x in info)>500*1024*1024:raise ValueError('Paquete demasiado grande')
        if len({x.filename for x in info})!=len(info):raise ValueError('Archivos duplicados')
        manifest=json.loads(z.read('manifest.json'))
        if manifest.get('version')!=1 or not isinstance(manifest.get('files'),dict):raise ValueError('Manifest inválido')
        names=manifest['files']
        if 'app/server.py' not in names or any(not allowed(n) for n in names):raise ValueError('Paquete incompatible: se requiere la estructura app/web/assets')
        if set(z.namelist())!=set(names)|{'manifest.json'}:raise ValueError('Contenido no declarado')
        files={n:z.read(n) for n in names}
        if any(hashlib.sha256(b).hexdigest()!=names[n] for n,b in files.items()):raise ValueError('Checksum incorrecto')
        return files

def apply(path,root=ROOT):
    from runtime_guard import InstanceGuard
    if installed(root):
        raise ValueError('Actualiza esta instalación ejecutando el nuevo instalador de TikReader.')
    guard=InstanceGuard(data_dir(root)/'server.lock',port=None)
    try:return apply_stopped(path,root)
    finally:guard.close()

def apply_stopped(path,root=ROOT):
    # Refuse any listening service. Never stop processes automatically.
    with socket.socket() as probe:
        probe.settimeout(1)
        from app_config import _port
        if probe.connect_ex(('127.0.0.1',_port()))==0:raise ValueError('Cierra TikReader antes de actualizar/restaurar código')
    files=read_package(path)
    for name in files:
        target=root/name
        if target.is_symlink() or not target.resolve().is_relative_to(root.resolve()):raise ValueError('Destino inseguro')
    backup=snapshot(root);previous={n:(root/n).read_bytes() if (root/n).exists() else None for n in files}
    try:
        for n,b in files.items():
            target=root/n;target.parent.mkdir(parents=True,exist_ok=True)
            temp=target.with_name(target.name+'.update-tmp');temp.write_bytes(b);os.replace(temp,target)
    except Exception:
        for n,b in previous.items():
            target=root/n
            if b is None:target.unlink(missing_ok=True)
            else:target.write_bytes(b)
        raise
    return backup

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['backup','apply']);parser.add_argument('package',nargs='?');args=parser.parse_args()
    try:
        if args.action=='backup':print('Paquete creado:',snapshot())
        else:
            if not args.package:args.package=input('Ruta del paquete ZIP: ').strip().strip(chr(34))
            print('Solo aplica paquetes de código de confianza. Un checksum no es una firma del autor.')
            if input('Escribe ACTUALIZAR para confirmar: ')!='ACTUALIZAR':raise ValueError('Cancelado')
            print('Aplicado. Respaldo anterior:',apply(Path(args.package)))
    except Exception as exc:
        print('No se completó:',exc);raise SystemExit(1)
