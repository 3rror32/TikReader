import unittest
from donor_ranking import donor_ranking


class DonorRankingTests(unittest.TestCase):
    def test_orders_coin_values_and_resolves_photos(self):
        rows=donor_ranking({'a':5,'b':100,'unknown':None,'zero':0},{'b':{'avatar_url':'new'}},[{'user':'@b','avatar_url':'old'},{'user':'@a','avatar_url':'a-photo'}])
        self.assertEqual([r['user'] for r in rows],['b','a'])
        self.assertEqual(rows[0]['avatar_url'],'new')
        self.assertEqual(rows[1]['avatar_url'],'a-photo')

    def test_bounds_and_empty_session(self):
        self.assertEqual(len(donor_ranking({str(i):i+1 for i in range(100)}, {}, [])),50)
        self.assertEqual(donor_ranking({}, {}, []),[])
        self.assertEqual([x['user'] for x in donor_ranking({'b':10,'a':10}, {}, [])],['a','b'])


if __name__=='__main__':unittest.main()
