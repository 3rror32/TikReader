"""Measure overlay animation pacing in a Chromium DevTools session."""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import urllib.request

import websockets


PATHS = (
    "/widget/animation-hearts?preview=1",
    "/widget/animation-fountain?preview=1",
    "/widget/animation-coins?preview=1",
    "/widget/animation-welcome?preview=1",
    "/widget/animation-celebration?preview=1",
    "/widget/animation-vip-runway?preview=1",
    "/widget/animation-vip-diamonds?preview=1",
    "/widget/animation-vip-hearts?preview=1",
    "/widget/animation-cannon?preview=1",
    "/widget/animation-energy-ring?preview=1",
    "/widget/chat-emojis?preview=1",
    "/widget/stream-buddies?preview=1",
    "/widget/seasonal-snow?preview=1",
    "/widget/seasonal-leaves?preview=1",
    "/widget/seasonal-wind?preview=1",
    "/widget/seasonal-rain?preview=1",
    "/widget/seasonal-rain-original?preview=1",
    "/widget/timer?preview=1",
    "/widget/fortune-wheel?preview=1",
    "/widget/point-drop?preview=1",
)


class DevTools:
    def __init__(self, websocket, origin: str):
        self.websocket = websocket
        self.origin = origin
        self.serial = 0

    async def call(self, method: str, params: dict | None = None) -> dict:
        self.serial += 1
        request_id = self.serial
        await self.websocket.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
        while True:
            message = json.loads(await self.websocket.recv())
            if message.get("id") != request_id:
                continue
            if "error" in message:
                raise RuntimeError(f"{method}: {message['error']}")
            return message.get("result", {})


async def measure(client: DevTools, url: str, seconds: float) -> dict:
    await client.call("Page.navigate", {"url": url})
    await asyncio.sleep(1.0)
    if "fortune-wheel" in url:
        await client.call("Runtime.evaluate", {"expression": """
          (() => {
            const disc=document.querySelector('.overlay-wheel-disc'),pointer=document.querySelector('.overlay-wheel-pointer');
            if(disc&&window.WheelMotion)window.WheelMotion.spin({disc,pointer,startAngle:0,endAngle:2160,duration:2,segments:6,sound:false});
          })()
        """})
    before = await client.call("Performance.getMetrics")
    expression = f"""
      new Promise(resolve => {{
        const intervals = [];
        const started = performance.now();
        let previous = 0;
        function sample(now) {{
          if (previous) intervals.push(now - previous);
          previous = now;
          if (now - started < {seconds * 1000:.0f}) requestAnimationFrame(sample);
          else {{
            const sorted = [...intervals].sort((a,b) => a-b);
            const percentile = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
            resolve({{
              frames: intervals.length,
              mean: intervals.reduce((sum,value) => sum + value, 0) / Math.max(1, intervals.length),
              p95: percentile(.95),
              maximum: sorted.at(-1) || 0,
              longFrames: intervals.filter(value => value > 25).length,
              nodes: document.getElementsByTagName('*').length,
              particles: document.querySelectorAll('.effect-particle,.vip-particle,.like-fountain-particle,.chat-emoji,.buddy,.overlay-drop-token').length,
              canvases: document.querySelectorAll('canvas').length
            }});
          }}
        }}
        requestAnimationFrame(sample);
      }})
    """
    result = await client.call("Runtime.evaluate", {"expression": expression, "awaitPromise": True, "returnByValue": True})
    after = await client.call("Performance.getMetrics")
    values = result["result"]["value"]
    before_metrics = {item["name"]: item["value"] for item in before["metrics"]}
    after_metrics = {item["name"]: item["value"] for item in after["metrics"]}
    task_seconds = max(0.0, after_metrics.get("TaskDuration", 0) - before_metrics.get("TaskDuration", 0))
    values.update(
        url=url,
        fps=1000 / values["mean"] if values["mean"] else 0,
        mainThreadPercent=task_seconds / seconds * 100,
        heapMB=after_metrics.get("JSHeapUsedSize", 0) / 1024 / 1024,
    )
    return values


async def run(port: int, base_url: str, seconds: float, paths: tuple[str, ...]) -> list[dict]:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=5) as response:
        pages = json.load(response)
    page = next(item for item in pages if item.get("type") == "page")
    origin = f"http://127.0.0.1:{port}"
    async with websockets.connect(page["webSocketDebuggerUrl"], origin=origin, max_size=8 * 1024 * 1024) as websocket:
        client = DevTools(websocket, origin)
        await client.call("Page.enable")
        await client.call("Runtime.enable")
        await client.call("Performance.enable")
        await client.call("Emulation.setDeviceMetricsOverride", {"width": 1920, "height": 1080, "deviceScaleFactor": 1, "mobile": False})
        rows = []
        for path in paths:
            rows.append(await measure(client, base_url.rstrip("/") + path, seconds))
        return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=9223)
    parser.add_argument("--base-url", default="http://127.0.0.1:5055")
    parser.add_argument("--seconds", type=float, default=2.0)
    parser.add_argument("--path", action="append", help="Overlay path to measure; repeat to select more than one")
    args = parser.parse_args()
    paths = tuple(args.path) if args.path else PATHS
    rows = asyncio.run(run(args.port, args.base_url, args.seconds, paths))
    print(json.dumps({
        "summary": {
            "overlays": len(rows),
            "medianFps": round(statistics.median(row["fps"] for row in rows), 1),
            "lowestFps": round(min(row["fps"] for row in rows), 1),
            "highestP95Ms": round(max(row["p95"] for row in rows), 1),
            "highestMainThreadPercent": round(max(row["mainThreadPercent"] for row in rows), 1),
        },
        "results": rows,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
