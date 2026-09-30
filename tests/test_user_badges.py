import unittest
from types import SimpleNamespace as NS
from user_badges import user_badges


class UserBadgeTests(unittest.TestCase):
    def test_missing_metadata(self):
        self.assertEqual(user_badges(NS()), [])

    def test_combined_badge_and_deduplication(self):
        image = NS(url_list=['https://example.com/badge.png'])
        badge = NS(combine=NS(icon=image, str='22'))
        rows = user_badges(NS(badge_list=[badge, badge]))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['text'], '22')
        self.assertEqual(rows[0]['image_url'], image.url_list[0])

    def test_rejects_unsafe_images_and_caps_payload(self):
        image = NS(url_list=['javascript:alert(1)', 'https://user:pass@example.com/x'])
        self.assertEqual(user_badges(NS(badge_image_list=[image])), [])
        badges = [NS(str=NS(str=str(n))) for n in range(40)]
        self.assertEqual(len(user_badges(NS(badge_list=badges))), 8)

    def test_installed_proto(self):
        from TikTokLive.proto import User, BadgeStruct
        from TikTokLiveProto.v3.webcast.model.base.user import StringBadge
        self.assertEqual(user_badges(User(badge_list=[BadgeStruct(str=StringBadge(str='6'))]))[0]['text'], '6')


if __name__ == '__main__':
    unittest.main()
