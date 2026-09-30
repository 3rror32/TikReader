"""Small, JSON-safe badge payloads from TikTok's optional user metadata."""
from urllib.parse import urlsplit


def image_url(image):
    for value in getattr(image, 'url_list', []) or []:
        if not isinstance(value, str) or len(value) > 4096:
            continue
        try:
            url = urlsplit(value)
            if url.scheme == 'https' and url.hostname and not url.username and not url.password:
                return value
        except ValueError:
            pass
    return None


def user_badges(user):
    """Preserve supplied badge art/text, never infer a level from user activity."""
    result, seen = [], set()

    def add(image=None, text=''):
        url = image_url(image)
        text = text.strip()[:40] if isinstance(text, str) else ''
        key = (url, text)
        if (url or text) and key not in seen and len(result) < 8:
            seen.add(key)
            result.append({'image_url': url, 'text': text, 'label': text or 'Insignia de TikTok'})

    for badge in (getattr(user, 'badge_list', None) or getattr(user, 'badges', []) or [])[:32]:
        combined = getattr(badge, 'combine', None)
        if combined is not None:
            label = getattr(combined, 'str', '') or getattr(getattr(combined, 'text', None), 'default_pattern', '')
            add(getattr(combined, 'icon', None), label)
        image = getattr(badge, 'image', None)
        if image is not None:
            add(getattr(image, 'image', None))
        string = getattr(badge, 'str', None)
        if string is not None:
            add(text=getattr(string, 'str', ''))
        text = getattr(badge, 'text', None)
        if text is not None:
            add(text=getattr(text, 'default_pattern', ''))
    for image in (getattr(user, 'badge_image_list', []) or [])[:16]:
        add(image)
    return result
