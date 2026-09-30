"""Rank observed coin values without conflating gift units with value."""
def donor_ranking(totals,participants,gifts):
    avatars={str(g.get('user','')).lstrip('@').casefold():g.get('avatar_url') for g in gifts if g.get('avatar_url')}
    avatars.update({str(k).lstrip('@').casefold():v['avatar_url'] for k,v in participants.items() if v.get('avatar_url')})
    ranked=sorted(((u,c) for u,c in totals.items() if c and c>0),key=lambda item:(-item[1],str(item[0]).casefold()))[:50]
    return [dict(user=user,coins=coins,avatar_url=avatars.get(str(user).lstrip('@').casefold())) for user,coins in ranked]
