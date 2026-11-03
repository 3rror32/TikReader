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
- [x] MWA-2: Correct Java announcement rejection handling and persist progress after each confirmed announcement.

## Acceptance Criteria

- A durable gift-triggered wave sends its announcement before its first mob command.
- The announcement is not sent again if the wave command path retries.
- Java command rejection or unconfirmed tellraw feedback must not mark the announcement complete or start the wave.
- Multi-action announcement progress survives retries and restart without replaying already confirmed messages.
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
- Review findings for MWA-2: Java `_announce_effect` currently treats any returned RCON response as sent even when `response_outcome` is rejected/unconfirmed; the batch-level `announcement_sent` flag is persisted only after every selected announcement, so a later announcement retry can replay earlier ones.
- Correction scope: add tellraw response classification for confirmed vanilla feedback, require a confirmed Java outcome before advancing, and persist a per-announcement cursor in the existing durable effect JSON. Keep existing effects compatible by mapping legacy `announcement_sent=True` to the end of the announcement list; otherwise default the cursor to zero.
- RED for MWA-2: `.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py -q` failed both new regressions. A rejected tellraw still led to a second command call; after announcement one succeeded and announcement two hit a retryable connection error, the durable cursor remained at zero. The other 56 tests and 300 subtests passed.
- GREEN for MWA-2: `.venv\Scripts\python.exe -m pytest tests/test_minecraft_presets.py -q` passed: 58 tests and 300 subtests.
- Correction rationale: `response_outcome` now recognizes the vanilla tellraw success reply, and `_announce_effect` accepts only `success`; it increments and persists `announcement_index` after each confirmed message. Legacy effects with `announcement_sent=True` and no cursor map to the end of the announcement list, preserving prior behavior without replay.
- Structural readback: `run_next_effect` lines 557-572 holds the effect and returns on an unconfirmed announcement before `_effect_object` at line 573; `_announce_effect` lines 639-680 checks the Java outcome and persists each cursor step; `response_outcome` lines 864-884 classifies tellraw.
- Correction verification: focused suite passed with 58 tests and 300 subtests; both new regression cases pass.
- Running authored change count for this correction: 118 lines (95 insertions + 23 deletions across the three authorized paths; generated files excluded).
- Correction work-unit commit: `7b4037e` (`fix(minecraft): confirm each gift announcement`).
- Next step: deliver the committed correction; no additional code work remains.
