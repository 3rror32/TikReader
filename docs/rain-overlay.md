# Lluvia sobre cristal

Raindrop FX is vendored locally under web/static/vendor/raindrop-fx; see its LICENSE and UPSTREAM.txt for the pinned revision and modifications. No CDN or background photograph is required.

The seasonal overlay draws falling rain in Canvas2D and composites the offscreen WebGL2 water simulation. Controls remain independent: density, speed, length, thickness and wind for falling rain; glass_count (hard cap, including trails) and glass_speed for water on glass; opacity and motion apply to both. The wrapper owns elapsed time, caps simulation steps, preserves a frozen frame and reports a basic-renderer fallback if WebGL2 initialization fails.

The water shader uses transparent highlights and shadows, not refraction of other OBS sources. Browser-source transparency cannot sample other OBS layers.

Verification: run tests/test_seasonal_overlay.py with app on PYTHONPATH. For GPU checks, temporarily serve tests/rain_graphics.html from the app static directory, open it in a browser, and remove the temporary copy afterward. The page checks transparent pixels, visible water, a frozen frame, zero glass count, maximum density/speed and resize. The editor was also checked for preview updates and saving.
