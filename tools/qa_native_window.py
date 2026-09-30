"""Launch the complete desktop studio with isolated data and capture a QA image."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import time
import gc
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
PORT = "5199"
URL = f"http://127.0.0.1:{PORT}"


def request(path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    with urlopen(Request(URL + path, data=data, headers=headers), timeout=5) as response:
        return response.read()


def main():
    output = ROOT / "runtime" / "native-studio-qa.png"
    output.parent.mkdir(exist_ok=True)
    folder = ROOT / "runtime" / "native-qa-data"
    folder.mkdir(parents=True, exist_ok=True)
    try:
        environment = {**os.environ, "TIKREADER_DATA_DIR": str(folder), "TIKREADER_PORT": PORT,
                       "TIKREADER_LAN": "0"}
        if os.environ.get("TIKREADER_QA_USE_GPU") != "1":
            environment["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-gpu"
        server = subprocess.Popen([sys.executable, "-B", str(ROOT / "app" / "server.py")], cwd=ROOT,
                                  env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                  creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        try:
            for _ in range(50):
                try:
                    if json.loads(request("/health"))["application"] == "TikReader":
                        break
                except OSError:
                    time.sleep(.2)
            else:
                raise RuntimeError("El servicio aislado no inició")
            os.environ.update({"TIKREADER_DATA_DIR": str(folder), "TIKREADER_PORT": PORT})
            if environment.get("QTWEBENGINE_CHROMIUM_FLAGS"):
                os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = environment["QTWEBENGINE_CHROMIUM_FLAGS"]
            else:
                os.environ.pop("QTWEBENGINE_CHROMIUM_FLAGS", None)
            sys.path.insert(0, str(ROOT / "app"))
            from PySide6.QtCore import QTimer
            from PySide6.QtWidgets import QApplication
            from desktop_window import MainWindow
            app = QApplication([])
            window = MainWindow(URL)
            window.studio.loadFinished.connect(
                lambda ok: print(f"studio-load={'ok' if ok else 'failed'} url={window.studio.url().toString()}")
            )
            window.studio.page().renderProcessTerminated.connect(
                lambda status, code: print(f"studio-renderer={status} code={code}")
            )
            window.show()

            action = os.environ.get("TIKREADER_QA_ACTION", "").strip()
            scripts = {
                "test-voice": "window.Shell?.show('voice'); document.getElementById('tts-test')?.click();",
                "microphone-page": "window.Shell?.show('microphone-captions'); const state=document.getElementById('mic-caption-state'); if(state){state.dataset.state='ready';state.querySelector('span').textContent='Servicio local listo';} const note=document.getElementById('mic-caption-permission');if(note)note.textContent='El reconocimiento ya está preparado. Activa el micrófono para probarlo en tiempo real.';const button=document.getElementById('mic-caption-start');if(button)button.disabled=false;",
                "microphone-preview": "window.Shell?.show('microphone-captions'); setTimeout(()=>{const animation=document.getElementById('mic-caption-animation');if(animation){animation.value='bounce';animation.dispatchEvent(new Event('input',{bubbles:true}));}document.getElementById('mic-caption-test')?.click();},700);",
                "microphone-settings": "window.Shell?.show('microphone-captions'); setTimeout(()=>document.querySelector('.mic-caption-settings')?.scrollIntoView({block:'start'}),1200);",
            }
            if action in scripts:
                QTimer.singleShot(4000, lambda: window.studio.page().runJavaScript(scripts[action]))

            def probe(label):
                script = "(()=>{const word=document.querySelector('.caption-word-animate')||document.querySelector('.mic-caption-word');const style=word?getComputedStyle(word):null;return JSON.stringify({ready:document.readyState,title:document.title,voice:document.getElementById('tts-state')?.textContent||'',body:document.body?.innerText.length||0,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,wordClass:word?.className||'',wordAnimation:style?.animationName||'',wordDuration:style?.animationDuration||''})})()"
                window.studio.page().runJavaScript(script, lambda value: print(f"studio-{label}={value}"))

            QTimer.singleShot(2500, lambda: probe("before"))
            QTimer.singleShot(10000, lambda: probe("after"))

            def capture():
                if not window.grab().save(str(output)):
                    raise RuntimeError("No se pudo guardar la captura")
                window.closing = True
                window.poll.stop()
                window.close()
                app.quit()

            QTimer.singleShot(11000, capture)
            app.exec()
            del capture
            window.web_profile.deleteLater()
            window.deleteLater()
            app.processEvents()
            gc.collect()
            time.sleep(1)
            print(output)
        finally:
            if server.poll() is None:
                try:
                    request("/system/exit", {"confirm": True})
                    server.wait(10)
                except (OSError, subprocess.TimeoutExpired):
                    server.terminate()
                    server.wait(10)
    finally:
        # Qt WebEngine releases its LevelDB files when this QA process exits.
        # The disposable folder is reused on the next run and never contains user data.
        pass


if __name__ == "__main__":
    main()
