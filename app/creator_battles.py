"""Conservative adapter for installed TikTokLive battle events and manual scoreboards."""
import copy
import hashlib
import time


def number(value):
    try:
        return max(0, min(10**12, int(value)))
    except (ValueError, TypeError, OverflowError):
        return 0


class BattleTracker:
    def __init__(self, suite):
        self.suite = suite
        self.latest = None
        self.session = None
        self.seen = set()

    def receive(self, event, kind):
        """Read protobuf attributes explicitly; never treat gift totals as battle points."""
        bid = str(getattr(event, 'battle_id', '') or '')
        if not bid:
            return
        if kind=='battle' and number(getattr(event,'action',0)) not in (4,5,6):
            return
        common = getattr(event, 'common', None)
        message = str(getattr(common, 'msg_id', '') or '')
        at = number(getattr(common, 'create_time', 0))
        if at > 10**11:
            at /= 1000
        with self.suite.lock:
            if self.session != self.suite.r.feed_session:
                self.latest = None
                self.session = self.suite.r.feed_session
                self.seen.clear()
            if message and (kind, message) in self.seen:
                return
            if message:
                self.seen.add((kind, message))
                if len(self.seen) > 2000:
                    self.seen = {(kind, message)}
            if self.latest and self.latest['external_id'] != bid and at and at < self.latest.get('event_at', 0):
                return
            if not self.latest or self.latest['external_id'] != bid:
                creator=self.suite.r.state.get('username','')
                key='tiktok-'+hashlib.sha256((creator.casefold()+':'+bid).encode()).hexdigest()[:32]
                prior=self.suite.read('battles')['items'].get(key) if self.suite.r.archive else None
                self.latest = copy.deepcopy(prior) if prior else dict(id=key, external_id=bid, creator=creator,
                    source='tiktok', status='observed', started_at=time.time(), updated_at=time.time(),
                    event_at=0, ends_at=None, sides={}, result='unknown', bonus=None)
            b = self.latest
            if at and at < b.get('event_at', 0):
                return
            b['event_at'] = at or b.get('event_at', 0)
            b['updated_at'] = time.time()
            settings = getattr(event, 'battle_settings', None)
            if settings:
                start = number(getattr(settings, 'start_time_ms', 0)) / 1000
                end = number(getattr(settings, 'end_time_ms', 0)) / 1000
                duration = number(getattr(settings, 'duration', 0))
                if start:
                    b['started_at'] = start
                if end or (start and duration):
                    b['ends_at'] = end or start + duration
            if kind == 'battle':
                action = number(getattr(event, 'action', 0))
                if action == 4 and b['status'] not in ('finished', 'interrupted'):
                    b['status'] = 'live'
                elif action in (5, 6):
                    b['status'] = 'finished' if action == 5 else 'interrupted'
                for wrapper in getattr(event,'anchors_info',[]) or []:
                    key=str(getattr(wrapper,'key',''))
                    user=getattr(getattr(wrapper,'value',None),'user',None)
                    name=getattr(user,'nickname','') if user else ''
                    if key and name:
                        side=b['sides'].setdefault(key,dict(id=key,score=None,supporters=[]))
                        side['user']=str(name)[:100]
                for sid, value in (getattr(event, 'battle_result', {}) or {}).items():
                    key = str(sid)
                    side = b['sides'].setdefault(key, dict(id=key, user='Anfitrión ' + key, supporters=[]))
                    side['score'] = number(getattr(value, 'score', 0))
                    side['result_code'] = number(getattr(value, 'result', 0))
            if kind == 'armies' and b['status'] not in ('finished', 'interrupted'):
                for sid, value in (getattr(event, 'armies', {}) or {}).items():
                    key = str(sid)
                    supporters = [dict(user=str(getattr(p, 'nickname', '') or 'Participante')[:100],
                        score=number(getattr(p, 'score', 0))) for p in (getattr(value, 'user_armies', []) or [])]
                    b['sides'][key] = dict(id=key, user=b['sides'].get(key, {}).get('user', 'Anfitrión ' + key),
                        score=number(getattr(value, 'hostscore', 0)),
                        supporters=sorted(supporters, key=lambda p: -p['score'])[:5])
            if self.suite.r.archive:
                state = self.suite.read('battles')
                # One persisted row per battle, updated in place. Never restore it as live after restart.
                state['items'][b['id']] = copy.deepcopy(b)
                self.suite.write('battles', state)

    def snapshot(self):
        if self.session != self.suite.r.feed_session:
            return None
        return copy.deepcopy(self.latest)
