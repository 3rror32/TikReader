import base64
import io
import json
import sys
import unittest
import wave
from unittest.mock import Mock, patch

import local_tts_worker


class LocalWorkerTests(unittest.TestCase):
    def test_worker_reuses_model_and_recovers_after_invalid_job(self):
        model=Mock();model.create.return_value=([0],24000)
        kokoro=Mock();kokoro.Kokoro.from_session.return_value=model
        samples=Mock();samples.__mul__=Mock(return_value=samples)
        samples.astype.return_value.tobytes.return_value=b'\x00\x00'*100
        numpy=Mock();numpy.clip.return_value=samples
        jobs='invalid\n'+json.dumps({'text':'Prueba','voice':'ef_dora','speed':1,'lang':'es'})+'\n'
        output=io.StringIO()
        with patch.dict(sys.modules,{'numpy':numpy,'onnxruntime':Mock(),'kokoro_onnx':kokoro}), \
                patch.object(sys,'argv',['worker','assets']),patch.object(sys,'stdin',io.StringIO(jobs)), \
                patch.object(sys,'stdout',output),patch.object(sys,'stderr',io.StringIO()), \
                patch.object(local_tts_worker.socket,'create_connection'),patch.object(local_tts_worker.socket.socket,'connect'), \
                patch.object(local_tts_worker.socket.socket,'connect_ex'),patch.object(local_tts_worker.socket,'getaddrinfo'):
            local_tts_worker.main()
        replies=[json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(replies[0],{'ready':True})
        self.assertIn('error',replies[1])
        with wave.open(io.BytesIO(base64.b64decode(replies[2]['audio']))) as audio:
            self.assertEqual((audio.getnchannels(),audio.getsampwidth(),audio.getframerate(),audio.getnframes()),(1,2,24000,100))
        kokoro.Kokoro.from_session.assert_called_once()

    def test_offline_guard_rejects_network(self):
        with self.assertRaisesRegex(RuntimeError,'conexiones de red'):
            local_tts_worker.deny_network('example.com',443)
