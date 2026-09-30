"""Offline-only Kokoro worker. One model stays in memory until stdin closes."""
import base64
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import socket
import sys
import wave


def deny_network(*args, **kwargs):
    raise RuntimeError('La síntesis local no permite conexiones de red')


def main():
    socket.create_connection = deny_network
    socket.socket.connect = deny_network
    socket.socket.connect_ex = deny_network
    socket.getaddrinfo = deny_network
    protocol = sys.stdout
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
    print(json.dumps({'ready': True}), file=protocol, flush=True)
    for line in sys.stdin:
        try:
            job = json.loads(line)
            with redirect_stdout(sys.stderr):
                audio, rate = model.create(job['text'], voice=job['voice'], speed=job['speed'], lang=job['lang'])
                output = io.BytesIO()
                with wave.open(output, 'wb') as wav:
                    wav.setnchannels(1)
                    wav.setsampwidth(2)
                    wav.setframerate(rate)
                    wav.writeframes((np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes())
            result = {'audio': base64.b64encode(output.getvalue()).decode('ascii')}
        except Exception as exc:
            print(type(exc).__name__ + ': ' + str(exc), file=sys.stderr, flush=True)
            result = {'error': 'No se pudo generar la voz local.'}
        print(json.dumps(result), file=protocol, flush=True)


if __name__ == '__main__':
    main()
