import unittest
from like_ranking import LikeRanking


class LikeRankingTests(unittest.TestCase):
    def test_accumulates_by_user_and_orders(self):
        r=LikeRanking()
        r.event('a',{'user':'@Luna','avatar_url':'photo'},5)
        r.event('a',{'user':'luna'},8)
        r.event('a',{'user':'Alex'},10)
        rows=r.snapshot('a')
        self.assertEqual([x['likes'] for x in rows],[13,10])
        self.assertEqual(rows[0]['avatar_url'],'photo')

    def test_unknown_users_and_session_reset(self):
        r=LikeRanking()
        r.event('a',{},500)
        r.event('a',{'user':'Luna'},0)
        self.assertEqual(r.snapshot('a'),[])
        r.event('a',{'user':'Luna'},20)
        self.assertEqual(r.snapshot('b'),[])


if __name__=='__main__':unittest.main()
