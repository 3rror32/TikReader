"""Small local HTTP client used by the native desktop window."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


class DesktopApiError(RuntimeError):
    def __init__(self, message: str, *, unreachable: bool = False):
        super().__init__(message)
        self.unreachable = unreachable


class DesktopApi:
    def __init__(self, base_url: str, timeout: float = 5):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _request(self, path: str, method: str = "GET", payload=None) -> bytes:
        data = None
        headers = {"Accept": "application/json", "User-Agent": "TikReader-Desktop/1"}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return response.read()
        except HTTPError as exc:
            try:
                detail = json.loads(exc.read().decode("utf-8")).get("error")
            except (ValueError, UnicodeDecodeError, AttributeError):
                detail = None
            raise DesktopApiError(detail or f"El servicio respondió con el código {exc.code}") from exc
        except (URLError, OSError) as exc:
            raise DesktopApiError("No se pudo comunicar con el servicio local de TikReader", unreachable=True) from exc

    def json(self, path: str, query: dict | None = None) -> dict:
        if query:
            path += ("&" if "?" in path else "?") + urlencode(query)
        try:
            value = json.loads(self._request(path).decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise DesktopApiError("El servicio local devolvió una respuesta inválida") from exc
        if not isinstance(value, dict):
            raise DesktopApiError("El servicio local devolvió una respuesta inesperada")
        return value

    def post(self, path: str, payload: dict) -> dict:
        try:
            value = json.loads(self._request(path, "POST", payload).decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise DesktopApiError("El servicio local devolvió una respuesta inválida") from exc
        if not isinstance(value, dict):
            raise DesktopApiError("El servicio local devolvió una respuesta inesperada")
        return value

    def start_live(self, username: str) -> dict:
        return self.post("/live/start", {"username": username})

    def stop_live(self) -> dict:
        return self.post("/live/stop", {})

    def feed(self, session: str = "", after: int = 0, gifts_version: int = -1) -> dict:
        return self.json("/feed", {"session": session, "after": after, "gifts_version": gifts_version})

    def save_download(self, path: str, destination: Path, payload: dict | None = None) -> Path:
        body = self._request(path, "POST" if payload is not None else "GET", payload)
        destination.write_bytes(body)
        return destination
