# Native compositor video fix

## Objective
Prevent transient one-frame black compositor tiles in the Windows desktop WebEngine view by disabling GPU compositing by default, while retaining an explicit environment-variable fallback.

## Problem and evidence
The supplied video (`2026-11-02 12-59-43.mp4`) shows one-frame black compositor tiles across the sidebar and header at 6.93 and 7.57 seconds; each is restored in the next frame. The existing 750 ms palette timer fix is already present. Qt WebEngine documents that Chromium composes the final image and accepts `QTWEBENGINE_CHROMIUM_FLAGS`; Chromium recognizes `--disable-gpu-compositing`.

## Scope and constraints
- Change only `app/launcher.py` and `tests/test_source_launcher.py`.
- Apply the workaround only on Windows and before importing `desktop_window` / initializing Qt WebEngine.
- Preserve existing `QTWEBENGINE_CHROMIUM_FLAGS`; append the flag only when absent.
- Support opt-out with `TIKREADER_GPU_COMPOSITING=1`.
- Do not disable other GPU features or change web CSS/JavaScript.
- Engram mirror is pending because the memory provider is unavailable.

## Tasks and checks
- [x] NATIVE-COMP-1: Add focused launcher tests and observe RED before implementation. Three initial cases failed before the helper existed.
- [x] NATIVE-COMP-2: Configure the Windows Chromium compositing flag and opt-out before desktop window import; observe GREEN. Follow-up coverage verifies opt-out with unrelated flags, pre-existing flag deduplication, and non-Windows no-op.

## Route and progress
- Route: delegated direct, one bounded writer. Trigger: implementation plus focused test changes span two non-trivial files.
- Authorized scope: `app/launcher.py`, `tests/test_source_launcher.py`, and this task document.
- Forecast: approximately 80 authored changed lines.
- Checks: `.venv\Scripts\python.exe -m pytest tests/test_source_launcher.py -q`; `PYTHONPATH=app .venv\Scripts\python.exe -m unittest tests.test_native_desktop`; `git diff --check`; bounded native startup smoke with GPU enabled.
- Progress: task record created before source/test changes; behavior implemented. Focused pytest passed 31 cases and the desktop suite passed 29 after setting `PYTHONPATH=app`. The native smoke confirmed `--disable-gpu-compositing` before importing `desktop_window`, loaded Studio successfully, reached `ready=complete`, and rendered a stable final screenshot. `git diff --check` passed. The native smoke did not reproduce the intermittent artifact, so elimination on the affected machine remains to be confirmed in normal use. The original `unittest tests.test_source_launcher` command discovered zero tests because that module uses pytest functions. Work-unit commit: `b4f9543 fix(desktop): avoid Windows GPU compositor glitches`.
- Delivery: local `main` advanced from `589e78c` to `b4f9543` after a verified fast-forward ancestry check. Remote `origin/main` was not updated. Native RDD review and Engram mirroring are unavailable in this environment.
- Next step: monitor the affected Windows app for recurrence; if black tiles remain, compare with `TIKREADER_GPU_COMPOSITING=1` and capture WebEngine compositor logs.
