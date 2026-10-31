# Native palette repaint stability

## Objective

Stop the intermittent native Qt WebEngine repaint corruption reported on the Configuration view by removing unnecessary recurring DOM mutations from desktop palette synchronization while preserving the themed close confirmation.

## Problem and why

The reported native window intermittently shows black rectangular compositor tiles across the sidebar and partially broken settings paint. A controlled 10-second A/B run with GPU enabled and disabled did not reproduce the visible corruption, so a driver-specific root cause is not proven. The investigation did prove that `MainWindow` executes JavaScript every 750 ms and appends/removes a temporary body element only to cache theme colors. That recurring DOM churn is unnecessary because the close flow already requests the current palette on demand and the load event can seed the fallback cache.

## Authorized scope

- Remove recurring desktop palette polling from `app/desktop_window.py`.
- Preserve one palette refresh after a successful studio load and the on-demand palette request before close confirmation.
- Add focused regression coverage in `tests/test_native_desktop.py`.
- Run repeated native Configuration captures after the change without connecting accounts or sending live/simulation events.

## Constraints

- Preserve the existing themed close dialog and its renderer-timeout fallback.
- Do not introduce a blanket GPU-disable workaround without evidence.
- Do not change web theme appearance or redesign the Configuration view.
- Keep diagnostic outputs under ignored `runtime/` or `.tmp/` paths.
- Engram mirror is pending because no Engram memory tools are available in this session.
- Project-specific skill resolution is unavailable (`skill_resolution: none`).

## Delivery strategy

`exception-ok`: one focused two-file behavioral fix plus its regression test. No pull request or release action is authorized by this work unit.

## Tasks

- [x] `NPRS-01` Replace recurring palette polling with load-time and close-time palette reads, then verify native paint stability.
  - Route: delegated direct.
  - Trigger: implementation and regression test span two non-trivial files; native execution requires delegated verification.
  - Test-first policy: add a deterministic failing regression that proves no repeating palette timer is created while load-time refresh remains connected, then implement and observe GREEN.
  - Acceptance: no 750 ms palette timer remains; close confirmation tests pass; repeated native Configuration captures remain stable; no renderer termination occurs; `git diff --check` passes.
  - Outcome: removed the recurring `_skin_timer`; successful `studio.loadFinished` and on-demand close palette reads remain intact. The regression checks both the missing repeating timer and the connected load refresh.
  - RED: `.venv\Scripts\python.exe -m unittest tests.test_native_desktop.DesktopWindowSafetyTests.test_palette_refresh_is_load_triggered_without_repeating_timer` initially could not import `desktop_api` without `app` on `PYTHONPATH`; rerun with `$env:PYTHONPATH='app'` failed as expected because `_skin_timer` was constructed.
  - GREEN: the same focused test with `$env:PYTHONPATH='app'` passed (`Ran 1 test`, `OK`).
  - Unit suite: `$env:PYTHONPATH='app'; $env:TEMP=(Resolve-Path .tmp).Path; .venv\Scripts\python.exe -m unittest tests.test_native_desktop` passed (`Ran 29 tests`, `OK`). The unadjusted run could not import `desktop_api`, and a run with only `PYTHONPATH` hit sandbox temp-directory permissions; using ignored workspace `.tmp` resolved the environment issue.
  - Native captures: both authorized commands completed with exit code 0 after localhost escalation. Software: `TIKREADER_QA_USE_GPU=0 .venv\Scripts\python.exe -B runtime\qa_native_tiles.py`; GPU: `TIKREADER_QA_USE_GPU=1`, removed `QTWEBENGINE_CHROMIUM_FLAGS`, then the same command. Each ran for 16 seconds, loaded Configuration successfully, and produced 41 image/JSON samples. Each reported zero palette-probe span events; neither emitted renderer-termination output. Screenshot inspection found no black compositor tiles.
  - `git diff --check`: passed. `gentle-ai` was unavailable, so RDD status could not be read; Engram mirror remains pending. No tracked changes outside the authorized task/source/test paths were present.
  - Work-unit commit: `1f43ac1` — `fix(desktop): stop polling palette for native views`.
  - Independent verification: parent-source RED reproduced without changing tracked files; current suite passed 29 tests; both 10-second native runs produced 41 stable frames, zero palette-probe events, one geometry state, and no renderer termination.
  - Limitation: the original intermittent black tiles were not reproduced. The verified outcome is removal of the 750 ms DOM churn and stable observed native runs, not proof that every driver-specific compositor failure is eliminated.

## Evidence

- Screenshot inspection: black rectangular tiles affect sidebar paint while the document remains themed, consistent with compositor tile damage rather than a deliberate CSS overlay.
- Pre-change code evidence: `MainWindow.__init__` created `_skin_timer` at 750 ms and `_desktop_skin_script()` appended/removed a temporary body `<span>` on every tick.
- Pre-change A/B evidence: GPU-disabled and default-GPU diagnostics captured 41 frames each over 10 seconds; all frames were stable and no renderer termination occurred.
- Pre-change DOM evidence: both runs observed 15 temporary palette-probe additions/removals at a median interval of approximately 750 ms.
- Post-change evidence: both modes again captured 41 stable frames over approximately 10 seconds, with zero palette-probe events and no renderer termination.

## Applicable checks

- Focused RED → GREEN regression in `tests/test_native_desktop.py`.
- `.venv\Scripts\python.exe -m unittest tests.test_native_desktop`
- Repeated native Configuration capture for at least 8 seconds.
- `git diff --check`
- Parent spot-check of one reported command.

## Next step

Monitor the installed application during normal use. If the compositor tiles recur, record the approximate timestamp and active view so renderer/GPU logging can be correlated without reintroducing periodic DOM polling.
