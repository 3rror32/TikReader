import json
import time
import threading
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

    def test_controller_automatically_checks_current_world_and_disconnect_revokes_authority(self):
        from minecraft_connector import MinecraftConnector
        app=Flask(__name__)
        runtime=SimpleNamespace(archive=None,production=SimpleNamespace(local=lambda:True,settings={'emergency':False,'scene':'talk'}))
        connector=MinecraftConnector(app,runtime)
        connector.edition='bedrock';connector.config={'commands':{'probe':'list'}}
        self.bridge.close();self.bridge=connector.bedrock
        self.url=self.bridge.prepare().removeprefix('/wsserver ')
        self.addCleanup(self.bridge.close)
        with self.peer() as ws:
            self.wait_connected()
            packet=json.loads(ws.recv(timeout=1))
            self.assertEqual(packet['body']['commandLine'],'list')
            self.assertFalse(connector.authorized_now())
            self.reply(ws,packet)
            deadline=time.monotonic()+2
            while not connector.authorized_now() and time.monotonic()<deadline:time.sleep(.005)
            self.assertTrue(connector.authorized_now());revision=connector.revision
            queued=('probe','list',time.monotonic(),None,revision)
        self.wait_connected(False)
        self.assertFalse(connector.authorized_now());self.assertGreater(connector.revision,revision)
        with self.peer() as ws:
            self.wait_connected();self.assertFalse(connector.enqueue('probe'))
            packet=json.loads(ws.recv(timeout=1))
            with patch.object(self.bridge,'execute') as execute:
                connector.run_job(queued)
            execute.assert_not_called()
            self.assertEqual(connector.log[0]['outcome'],'cancelled')
            self.reply(ws,packet)

    def test_previous_generation_is_rejected_before_sending(self):
        with self.peer() as ws:
            self.wait_connected()
            with self.assertRaises(OSError):
                self.bridge.execute('give @s diamond',expected_generation=self.bridge.generation-1)
            with self.assertRaises(TimeoutError):ws.recv(timeout=.08)


class HandshakeTests(unittest.TestCase):
    def controller(self):
        from minecraft_connector import MinecraftConnector
        app=Flask(__name__)
        runtime=SimpleNamespace(archive=None,production=SimpleNamespace(local=lambda:True,settings={'emergency':False,'scene':'talk'}))
        connector=MinecraftConnector(app,runtime)
        self.addCleanup(connector.bedrock.close)
        connector.edition='bedrock';connector.config={'commands':{}}
        connector.bedrock.generation=7
        return connector

    def test_failed_connection_checks_do_not_enable_or_retry_commands(self):
        for outcome in ('rejected','unconfirmed','timeout'):
            with self.subTest(outcome=outcome):
                connector=self.controller()
                def execute(*args,**kwargs):
                    if outcome=='timeout':raise TimeoutError()
                    return {'outcome':outcome}
                with patch.object(connector.bedrock,'snapshot',return_value={'connected':True}), \
                     patch.object(connector.bedrock,'execute',side_effect=execute) as query:
                    connector.bedrock.on_change()
                    deadline=time.monotonic()+1
                    while connector.connection_check=='checking' and time.monotonic()<deadline:time.sleep(.005)
                    self.assertEqual(connector.connection_check,'failed')
                    self.assertFalse(connector.authorized_now())
                    for _ in range(3):connector.snapshot()
                    query.assert_called_once_with('list',expected_generation=7)

    def test_pending_check_cannot_authorize_changed_session_configuration_or_edition(self):
        for change in ('disconnect','configuration','edition'):
            with self.subTest(change=change):
                connector=self.controller();started=threading.Event();release=threading.Event();done=threading.Event()
                connected=True
                def execute(*args,**kwargs):
                    started.set();release.wait(1);return {'outcome':'success'}
                original=connector._check_bedrock
                def check(*args):
                    try:original(*args)
                    finally:done.set()
                with patch.object(connector,'_check_bedrock',side_effect=check), \
                     patch.object(connector.bedrock,'snapshot',side_effect=lambda:{'connected':connected}), \
                     patch.object(connector.bedrock,'execute',side_effect=execute):
                    connector.bedrock.on_change();self.assertTrue(started.wait(1))
                    self.assertEqual(connector.connection_check,'checking')
                    if change=='disconnect':
                        connected=False;connector.bedrock.generation+=1
                    elif change=='edition':connector.edition='java'
                    connector._bedrock_changed()
                    release.set();self.assertTrue(done.wait(1))
                    self.assertFalse(connector.authorized_now())

    def test_connected_generation_is_checked_without_manual_authorization(self):
        connector=self.controller()
        checked=threading.Event()
        with patch.object(connector.bedrock,'snapshot',return_value={'connected':True}), \
             patch.object(connector.bedrock,'execute',side_effect=lambda *a,**k:(checked.set() or {'outcome':'success'})) as execute:
            connector.bedrock.on_change()
            self.assertTrue(checked.wait(.2),'connection must automatically request player list')
            deadline=time.monotonic()+1
            while not connector.authorized_now() and time.monotonic()<deadline:time.sleep(.005)
            self.assertTrue(connector.authorized_now())
            execute.assert_called_once_with('list',expected_generation=7)

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
