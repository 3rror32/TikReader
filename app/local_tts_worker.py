"""Offline-only Kokoro worker. One model stays in memory until stdin closes."""
import base64
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import socket
import sys
import wave
from time import monotonic


def deny_network(*args, **kwargs):
    raise RuntimeError('La síntesis local no permite conexiones de red')


def failure(code, phase, started):
    return {"error": "No se pudo generar la voz local.",
            "diagnostic": {"code": code, "phase": phase, "elapsed_ms": round((monotonic() - started) * 1000)}}


def main():
    socket.create_connection = deny_network
    socket.socket.connect = deny_network
    socket.socket.connect_ex = deny_network
    socket.getaddrinfo = deny_network
    protocol = sys.stdout
    started = monotonic()
    try:
        with redirect_stdout(sys.stderr):
            import numpy as np
            import onnxruntime as ort
            from kokoro_onnx import Kokoro
            assets = Path(sys.argv[1])
            options = ort.SessionOptions()
            options.intra_op_num_threads = 4
            options.inter_op_num_threads = 1
            session = ort.InferenceSession(str(assets / 'kokoro-v1.0.onnx'), options,
                                           providers=['CPUExecutionProvider'])
            model = Kokoro.from_session(session, str(assets / 'voices-v1.0.bin'))
    except Exception:
        print(json.dumps(failure("ENGINE_LOAD", "startup", started)), file=protocol, flush=True)
        return
    print(json.dumps({'ready': True}), file=protocol, flush=True)
    for line in sys.stdin:
        started = monotonic()
        phase = "protocol"
        try:
            job = json.loads(line)
            if not isinstance(job, dict) or not all(key in job for key in ("text", "voice", "speed", "lang")):
                raise ValueError("Invalid job")
            phase = "synthesis"
            with redirect_stdout(sys.stderr):
                audio, rate = model.create(job['text'], voice=job['voice'], speed=job['speed'], lang=job['lang'])
                output = io.BytesIO()
                with wave.open(output, 'wb') as wav:
                    wav.setnchannels(1)
                    wav.setsampwidth(2)
                    wav.setframerate(rate)
                    wav.writeframes((np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes())
            result = {'audio': base64.b64encode(output.getvalue()).decode('ascii')}
        except Exception:
            result = failure("INVALID_JOB" if phase == "protocol" else "SYNTHESIS_FAILED", phase, started)
        print(json.dumps(result), file=protocol, flush=True)


if __name__ == '__main__':
    main()
