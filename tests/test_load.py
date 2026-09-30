"""Isolated load tests. Never connect to TikTok or modify the running server."""
import unittest
import tempfile
from pathlib import Path
from types import SimpleNamespace as S
from unittest.mock import patch
from collections import OrderedDict
import server
from history_store import HistoryStore


class LoadTests(unittest.TestCase):
    def test_two_thousand_gift_streaks_and_recent_duplicates(self):
        with patch.object(server,'archive',None), patch.object(server,'gift_counts',OrderedDict()), \
             patch.object(server,'gift_history',OrderedDict()), patch.object(server,'gifter_totals',{}), \
             patch.object(server,'gifter_diamonds',{}), patch.object(server,'state',dict(server.state,gift_count=0)), \
             patch.object(server.socketio,'emit'), patch('builtins.print'):
            gift=S(id=1,name='Rosa',type=1,diamond_count=1)
            for group in range(1,2001):
                for count,end in ((1,0),(3,0),(3,1),(3,1)):
                    server.handle_gift_event(S(user=S(unique_id='load'),gift=gift,group_id=group,repeat_count=count,repeat_end=end))
            self.assertEqual(server.state['gift_count'],6000)
            self.assertEqual(server.gifter_diamonds['load'],6000)
            self.assertEqual(len(server.gift_counts),1000)
            self.assertEqual(len(server.gift_history),100)

    def test_five_thousand_like_events_with_duplicates(self):
        with patch.object(server,'seen_like_ids',OrderedDict()), \
             patch.object(server,'state',dict(server.state,like_count=0,like_events=0)), \
             patch.object(server.socketio,'emit'), patch('builtins.print'):
            for i in range(1,5001):
                event=S(common=S(msg_id=i),count=2,total=i*2)
                server.handle_like_event(event);server.handle_like_event(event)
            self.assertEqual(server.state['like_count'],10000)
            self.assertEqual(server.state['like_events'],5000)
            self.assertEqual(len(server.seen_like_ids),1000)

    def test_archive_thousand_messages_survive_reopen(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'load.sqlite3'
            store=HistoryStore(path);store.start('load','test')
            for i in range(1000):
                store.save('load','comment',{'id':str(i),'user':'@test','comment':f'mensaje {i}'})
            reopened=HistoryStore(path)
            self.assertEqual(len(reopened.records('load')),1000)
            self.assertEqual(reopened.records('load')[-1]['comment'],'mensaje 999')


if __name__=='__main__':
    unittest.main()
