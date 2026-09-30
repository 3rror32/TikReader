"""Capture the running legacy bank before its first persistence upgrade."""
import json
import sys
from pathlib import Path
from urllib.request import urlopen
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'app'))
from history_store import HistoryStore

def main():
    archive=HistoryStore(ROOT/'data'/'history.sqlite3')
    if 'bank_contents' in archive.settings():
        print('El llenado ya tiene almacenamiento; no se reemplazó.');return
    with urlopen('http://127.0.0.1:5000/status',timeout=3) as response:status=json.load(response)
    if status.get('connected') or status.get('connecting'):
        raise RuntimeError('Hay un LIVE conectado; pospón el reinicio.')
    with urlopen('http://127.0.0.1:5000/interactivity/overlays',timeout=3) as response:games=json.load(response)
    drop=games['drop'];backup=ROOT/'data'/'backups'/('bank-before-persistence-'+uuid4().hex+'.json')
    backup.parent.mkdir(exist_ok=True)
    backup.write_text(json.dumps(drop,ensure_ascii=False),encoding='utf-8')
    archive.set_setting('bank_contents',dict(score=drop['score'],contents=drop.get('contents',drop.get('events',[]))[-220:],epoch=drop.get('epoch') or uuid4().hex,shapes=drop.get('shapes',{})))
    print(f"Marcador {drop['score']} y {len(drop.get('events',[]))} regalos recientes guardados antes de actualizar.")

if __name__=='__main__':main()
