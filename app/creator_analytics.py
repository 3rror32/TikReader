"""Community reports from observed events, without reading diagnostic logs."""
import json
from datetime import datetime, timezone, timedelta
from collections import defaultdict


def identity(value):
    return str(value or '').strip().lstrip('@').casefold()[:100]


def event_time(record, started):
    try:
        if record.get('occurred_at'):
            return datetime.fromtimestamp(float(record['occurred_at']), timezone.utc)
        return datetime.fromisoformat(started).replace(tzinfo=timezone.utc)
    except (ValueError, TypeError, OverflowError, OSError):
        return datetime(1970, 1, 1, tzinfo=timezone.utc)


def community_report(archive, creator='', days=0, offset=0, now=None):
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days) if days else datetime(1970, 1, 1, tzinfo=timezone.utc)
    people = {}
    sessions = {}
    gifts = {}
    comments_seen = set()
    creators = set()
    timeline = defaultdict(int)
    slots = defaultdict(lambda: dict(coins=0, sessions=set()))
    unknown_value = 0
    approximate_times = 0
    with archive.connect() as db:
        rows = db.execute("SELECT s.username,s.id,s.started,e.kind,e.payload FROM sessions s JOIN events e ON e.session=s.id WHERE e.kind IN ('gift','comment') ORDER BY e.rowid")
        for owner, session, started, kind, payload in rows:
            owner = identity(owner)
            creators.add(owner)
            if creator and owner != identity(creator):
                continue
            try:
                record = json.loads(payload)
            except (ValueError, TypeError):
                continue
            when = event_time(record, started)
            if when < cutoff:
                continue
            user = identity(record.get('user'))
            if not user:
                continue
            key = owner + ':' + user
            p = people.setdefault(key, dict(key=key, creator=owner, user=user, coins=0,
                gifts=0, comments=0, sessions=set(), last_seen=0, last_gift=0, months={}, gift_types={}))
            p['sessions'].add(session)
            p['last_seen'] = max(p['last_seen'], when.timestamp())
            sessions[session] = started
            eid = str(record.get('id', ''))
            if kind == 'comment':
                if (owner, eid) not in comments_seen:
                    p['comments'] += 1
                    comments_seen.add((owner, eid))
            else:
                # Recovered rachas can occur in two sessions. Keep their largest final snapshot.
                previous = gifts.get((owner, eid))
                if previous is None or int(record.get('count', 0)) >= int(previous[1].get('count', 0)):
                    gifts[(owner, eid)] = (key, record, when, session)
    for key, record, when, session in gifts.values():
        p = people[key]
        count = max(0, int(record.get('count', 0)))
        coins = record.get('diamonds')
        if not isinstance(coins, int) or coins < 0:
            unknown_value += 1
            coins = 0
        p['coins'] += coins
        p['gifts'] += count
        p['last_gift'] = max(p['last_gift'], when.timestamp())
        local = when - timedelta(minutes=offset)
        month = local.strftime('%Y-%m')
        p['months'][month] = p['months'].get(month, 0) + coins
        gift = str(record.get('gift', 'Regalo'))[:100]
        p['gift_types'][gift] = p['gift_types'].get(gift, 0) + count
        timeline[local.strftime('%Y-%m-%d')] += coins
        if record.get('occurred_at'):
            slot = slots[f'{local.weekday()}:{local.hour}']
            slot['coins'] += coins
            slot['sessions'].add(session)
        else:
            approximate_times += 1
    total = sum(p['coins'] for p in people.values())
    result = []
    for p in people.values():
        p['sessions'] = len(p['sessions'])
        p['share'] = round(p['coins'] * 100 / total, 2) if total else 0
        p['inactive_days'] = int((now.timestamp() - p['last_gift']) / 86400) if p['last_gift'] else None
        result.append(p)
    result.sort(key=lambda p: (-p['coins'], -p['comments'], p['user']))
    return dict(people=result, creators=sorted(creators), sessions=len(sessions), coins=total,
        top5_share=round(sum(p['coins'] for p in result[:5]) * 100 / total, 2) if total else 0,
        unknown_value=unknown_value, approximate_times=approximate_times,
        timeline=[dict(day=d, coins=c) for d, c in sorted(timeline.items())],
        slots=[dict(slot=k, coins=v['coins'], sessions=len(v['sessions']),
                    average=round(v['coins']/len(v['sessions']), 1)) for k, v in sorted(slots.items())],
        scope='Solo eventos recibidos y conservados. Monedas observadas; no representan ingresos netos. Los datos antiguos usan la fecha de sesión y no entran en el análisis por hora.')
