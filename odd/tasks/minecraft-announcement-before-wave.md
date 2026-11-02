# Minecraft Announcement Before Gift Wave

## Objective

Send the Minecraft chat announcement for a gift-triggered durable preset before dispatching any mob or other wave command.

## Problem and Why

The durable effect worker currently emits the `tellraw` announcement only after the final command is confirmed, so the operator learns about a gift after its wave has already run. The announcement should precede the wave while preserving queue durability, pause handling, and retry behavior.

## Scope and Constraints

- Change only the durable gift effect dispatch and its focused regression test.
- Do not touch unrelated pre-existing modifications.
- Do not push or create a pull request.
- Keep announcements from repeating when command dispatch retries.
- Engram mirror `odd/minecraft-announcement-before-wave/tasks` is pending because no memory tools are available.

## Authorized Scope

- `app/minecraft_connector.py`
- `tests/test_minecraft_presets.py`
- `odd/tasks/minecraft-announcement-before-wave.md`

## Route

`delegated direct`; trigger evidence: implementation changes durable queue ordering and requires a focused regression test, with code reading and implementation delegated together.

## Forecast and Delivery

- Forecast: approximately 140 authored changed lines across implementation, test, and task tracking, generated files excluded.
- Delivery strategy: `ask-on-risk`.
- Work-unit commit required on the existing feature branch; no push or PR.

## Task Checklist

- [x] MWA-1: Add a durable-path regression test, observe RED, implement announcement-before-wave ordering, and verify retry behavior.

## Acceptance Criteria

- A durable gift-triggered wave sends its announcement before its first mob command.
- The announcement is not sent again if the wave command path retries.
- Existing pause, persistence, and recovery behavior remains intact.
- Focused verification command passes.

## Verification

- `.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py -q`
- Structural readback confirms announcement-before-first-command ordering and no repeated announcement on retry.

## Progress and Evidence

- Initial state: current branch is `codex/minecraft-simulated-gift-delivery`; unrelated dirty files were present and are outside this task's authorized scope.
- Exploration: `app/server.py:951` forwards gift events to Minecraft; `app/minecraft_connector.py:188-201` admits matching gifts; `app/minecraft_connector.py:531-622` dispatches durable wave commands and announces only after the final confirmation.
- RED: `.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py -q` failed only the new regression test: observed the zombie summon before the expected `tellraw`; 55 tests and 300 subtests passed.
- GREEN: `.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py -q` passed: 56 tests and 300 subtests.
- Implementation: the durable effect records `announcement_sent`, sends the announcement before its first command, persists the flag, retries clean Java connection failures without replaying a completed announcement, and holds ambiguous/failed announcements for review.
- Structural readback: `run_next_effect` calls `_announce_effect` and persists `announcement_sent` before `_effect_object` and command execution; the regression test restores a new connector from the same history store after a retry and verifies it proceeds without announcing again.
- Work-unit commit: `8e482d4` (`fix(minecraft): announce gift wave before commands`).
- Next step: complete; the Engram mirror remains pending because memory tools are unavailable.
