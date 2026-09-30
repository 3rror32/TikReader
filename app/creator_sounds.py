"""Small original synthesized WAV cues; no network or downloaded sound assets."""
import io
import math
import struct
import wave
from functools import lru_cache

SOUNDS={'chime':('Campana suave',(660,880)), 'level':('Subir de nivel',(440,554,659,880)),
        'victory':('Celebración',(523,659,784,1046))}


@lru_cache(maxsize=3)
def sound_bytes(key):
    frequencies=SOUNDS[key][1]
    rate=22050
    samples=[]
    for hz in frequencies:
        for n in range(int(rate*.18)):
            t=n/rate
            envelope=min(1,t/.015)*max(0,1-t/.18)**2
            samples.append(struct.pack('<h',int(8500*envelope*math.sin(2*math.pi*hz*t))))
    output=io.BytesIO()
    with wave.open(output,'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(b''.join(samples))
    return output.getvalue()
