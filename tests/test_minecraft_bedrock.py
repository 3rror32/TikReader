import json
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from types import SimpleNamespace
from flask import Flask

from websockets.sync.client import connect
from websockets.exceptions import ConnectionClosed, InvalidStatus

from minecraft_bedrock import BedrockBridge


class BedrockTests(unittest.TestCase):
    def setUp(self):
        self.changes = []
        self.bridge = BedrockBridge(lambda: self.changes.append(True))
        self.url = self.bridge.prepare().removeprefix('/wsserver ')
        self.addCleanup(self.bridge.close)

    def peer(self, **kwargs):
        return connect(self.url, proxy=None, open_timeout=2, close_timeout=1, **kwargs)

    def wait_connected(self, expected=True):
        deadline = time.monotonic()+2
        while self.bridge.snapshot()['connected'] != expected and time.monotonic() < deadline:
            time.sleep(.005)
        self.assertEqual(self.bridge.snapshot()['connected'], expected)

    @staticmethod
    def reply(ws, packet, code=0, purpose='commandResponse', **body):
        ws.send(json.dumps({'header': {'version': 16973824, 'requestId': packet['header']['requestId'],
                                    'messagePurpose': purpose},
                            'body': {'statusCode': code, 'statusMessage': '<literal>', **body}}))

    def test_loopback_handshake_rejects_wrong_token_origin_encryption_and_second_peer(self):
        self.assertTrue(self.url.startswith('ws://127.0.0.1:'))
        with self.assertRaises(InvalidStatus):
            connect(self.url+'wrong', proxy=None, open_timeout=1)
        with self.assertRaises(InvalidStatus):
            self.peer(origin='https://example.invalid')
        with self.assertRaises(InvalidStatus):
            self.peer(subprotocols=['com.microsoft.minecraft.wsencrypt'])
        with self.peer():
            self.wait_connected()
            with self.assertRaises(InvalidStatus):
                self.peer()
        self.wait_connected(False)
        self.assertGreaterEqual(len(self.changes), 2)
        self.assertNotIn(self.url.split('/')[-1], json.dumps(self.bridge.snapshot()))

    def test_correlated_requests_and_numeric_status(self):
        with self.peer() as ws, ThreadPoolExecutor(1) as pool:
            self.wait_connected()
            for code, purpose, expected in [(0,'commandResponse','success'),(-1,'commandResponse','rejected'),
                                            (True,'commandResponse','unconfirmed'),('0','commandResponse','unconfirmed'),
                                            (None,'commandResponse','unconfirmed'),(float('nan'),'commandResponse','unconfirmed'),
                                            (1,'commandResponse','unconfirmed'),(0,'error','unconfirmed'),(-4,'error','rejected')]:
                future = pool.submit(self.bridge.execute, '/list')
                packet = json.loads(ws.recv(timeout=1))
                self.assertEqual(packet['body']['commandLine'], 'list')
                self.assertEqual(packet['header']['messageType'], 'commandRequest')
                self.assertEqual(packet['body']['origin'], {'type':'player'})
                wrong = json.loads(json.dumps(packet));wrong['header']['requestId']='wrong'
                self.reply(ws, wrong)
                self.assertFalse(future.done())
                self.reply(ws, packet, code, purpose)
                result = future.result(2)
                self.assertEqual(result['outcome'], expected)
                self.assertEqual(result['response'], '<literal>')

    def test_disconnect_fails_pending_and_new_client_cannot_complete_old_request(self):
        with ThreadPoolExecutor(1) as pool:
            with self.peer() as ws:
                self.wait_connected();generation=self.bridge.generation
                future=pool.submit(self.bridge.execute,'list')
                old=json.loads(ws.recv(timeout=1))
            with self.assertRaises(OSError):future.result(2)
            self.wait_connected(False)
            with self.peer() as ws:
                self.wait_connected();self.assertGreater(self.bridge.generation,generation)
                future=pool.submit(self.bridge.execute,'list');new=json.loads(ws.recv(timeout=1))
                self.reply(ws,old);self.assertFalse(future.done());self.reply(ws,new)
                self.assertEqual(future.result(2)['outcome'],'success')

    def test_timeout_is_not_retried_and_malformed_packets_are_bounded(self):
        with self.peer() as ws, ThreadPoolExecutor(1) as pool:
            self.wait_connected()
            future=pool.submit(self.bridge.execute,'give @s diamond',.08)
            ws.recv(timeout=1)
            ws.send('{broken');ws.send('[]')
            with self.assertRaises(TimeoutError):future.result(2)
            with self.assertRaises(TimeoutError):ws.recv(timeout=.08)
            ws.send('x'*70000)
            with self.assertRaises(ConnectionClosed):ws.recv(timeout=2)

    def test_close_stops_listener_and_wakes_pending_without_deadlock(self):
        with self.peer() as ws, ThreadPoolExecutor(1) as pool:
            self.wait_connected();future=pool.submit(self.bridge.execute,'list');ws.recv(timeout=1)
            self.bridge.close()
            with self.assertRaises(OSError):future.result(2)
        self.assertFalse(self.bridge.snapshot()['prepared'])
        with self.assertRaises(OSError):self.peer()

    def test_controller_authorizes_only_current_world_and_disconnect_revokes_idle_authority(self):
        from minecraft_connector import MinecraftConnector
        app=Flask(__name__)
        runtime=SimpleNamespace(archive=None,production=SimpleNamespace(local=lambda:True,settings={'emergency':False,'scene':'talk'}))
        connector=MinecraftConnector(app,runtime)
        connector.edition='bedrock';connector.config={'commands':{'probe':'list'}}
        connector.bedrock=self.bridge;self.bridge.on_change=connector._bedrock_changed
        with self.peer() as ws, ThreadPoolExecutor(1) as pool:
            self.wait_connected()
            future=pool.submit(lambda:app.test_client().post('/minecraft/authorize',json={'edition':'bedrock','enabled':True}))
            packet=json.loads(ws.recv(timeout=1));self.reply(ws,packet)
            self.assertEqual(future.result(2).status_code,200)
            self.assertTrue(connector.authorized_now());revision=connector.revision
            queued=('probe','list',time.monotonic(),None,revision)
        self.wait_connected(False)
        self.assertFalse(connector.authorized_now());self.assertGreater(connector.revision,revision)
        with self.peer():
            self.wait_connected();self.assertFalse(connector.enqueue('probe'))
            with patch.object(self.bridge,'execute') as execute:
                connector.run_job(queued)
            execute.assert_not_called()
            self.assertEqual(connector.log[0]['outcome'],'cancelled')

    def test_previous_generation_is_rejected_before_sending(self):
        with self.peer() as ws:
            self.wait_connected()
            with self.assertRaises(OSError):
                self.bridge.execute('give @s diamond',expected_generation=self.bridge.generation-1)
            with self.assertRaises(TimeoutError):ws.recv(timeout=.08)


class HandshakeTests(unittest.TestCase):
    def test_nonloopback_peer_is_denied_and_listener_bounds_are_explicit(self):
        server=SimpleNamespace(serve_forever=lambda:None,shutdown=lambda:None,
                               socket=SimpleNamespace(getsockname=lambda:('127.0.0.1',1234)))
        bridge=BedrockBridge(lambda:None)
        with patch('minecraft_bedrock.serve',return_value=server) as serve:
            command=bridge.prepare();token=command.rsplit('/',1)[-1]
            admission=serve.call_args.kwargs['process_request']
            connection=SimpleNamespace(remote_address=('192.168.1.2',5555),respond=lambda status,text:status)
            request=SimpleNamespace(path='/'+token,headers=SimpleNamespace(get_all=lambda name:[]))
            self.assertEqual(admission(connection,request),403)
            self.assertEqual(serve.call_args.args[1],'127.0.0.1')
            self.assertEqual(serve.call_args.kwargs['origins'],[None])
            self.assertLessEqual(serve.call_args.kwargs['max_size'],65536)
            bridge.close()


if __name__ == '__main__':
    unittest.main()
