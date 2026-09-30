"""Synthesize installed Kokoro voices without playing audio or touching the live server."""
import io
import json
from pathlib import Path
import sys
import time
import wave

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'app'))
from flask import Flask
from local_tts import LocalTTS, VOICES


def main():
    engine=LocalTTS(Flask(__name__),ROOT)
    rows=[]
    target=ROOT/'data'/'diagnostics'/'local-voices-validation.json'
    target.parent.mkdir(parents=True,exist_ok=True)
    phrases={'es':'Hola, esta es una prueba de voz.', 'en-us':'Hello, this is a voice test.',
             'en-gb':'Hello, this is a voice test.', 'fr-fr':'Bonjour, ceci est un test.',
             'pt-br':'Olá, este é um teste de voz.', 'it':'Ciao, questa è una prova.',
             'hi':'नमस्ते, यह एक परीक्षण है।'}
    try:
        for voice in VOICES.values():
            started=time.perf_counter()
            row={'voice':voice['id']}
            try:
                data=engine.render(phrases[voice['lang']],voice['id'],1)
                with wave.open(io.BytesIO(data)) as audio:
                    frames=audio.readframes(audio.getnframes())
                    if not audio.getnframes() or not any(frames):
                        raise RuntimeError('Empty or silent WAV')
                    row.update(passed=True,audio_seconds=round(audio.getnframes()/audio.getframerate(),2))
            except Exception as exc:
                row.update(passed=False,error=str(exc))
            row['render_seconds']=round(time.perf_counter()-started,2)
            rows.append(row)
            target.write_text(json.dumps({'finished':False,'voices':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    finally:
        engine.close()
    passed=all(row['passed'] for row in rows) and len(rows)==len(VOICES)
    target.write_text(json.dumps({'finished':True,'passed':passed,'voices':rows,
        'scope':'Generated WAV only; audibility, pronunciation and streaming capture require listening.'},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'passed':passed,'voices':len(rows),'report':str(target)}))
    return 0 if passed else 1


if __name__=='__main__':
    raise SystemExit(main())
