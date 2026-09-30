"""Per-viewer likes actually identified in this live session."""
class LikeRanking:
    def __init__(self):
        self.session=None
        self.users={}

    def ensure(self,session):
        if self.session!=session:
            self.session=session
            self.users.clear()

    def event(self,session,record,count):
        self.ensure(session)
        user=str(record.get('user') or '').strip().lstrip('@')
        if not user or count<=0: return
        key=user.casefold()
        row=self.users.setdefault(key,dict(user=user,likes=0,avatar_url=None))
        row['likes']+=count
        if record.get('avatar_url'):row['avatar_url']=record['avatar_url']

    def snapshot(self,session):
        self.ensure(session)
        return [dict(row) for row in sorted(self.users.values(),key=lambda r:(-r['likes'],r['user'].casefold()))[:50]]
