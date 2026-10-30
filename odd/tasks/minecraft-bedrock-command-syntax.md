# Minecraft Bedrock command syntax

## Objective
Make the Minecraft Bedrock `Probar` action execute the selected preset instead of queuing a command that Bedrock rejects.

## Problem and scope
The live command log proves that the button reaches the backend, but Bedrock rejects the generated zombie command with `Error de sintaxis: "@p" inesperado`. The preset builder currently emits Java-style `execute at @p run ...` syntax for Bedrock. Correct Bedrock command generation while preserving Java output and existing admission, authorization, throttling, and queue safeguards.

## Authorized surfaces
- app/minecraft_presets.py
- tests/test_minecraft_presets.py
- odd/tasks/minecraft-bedrock-command-syntax.md

## Plan and acceptance
- [x] MCBS-1: Generate Bedrock-valid preset commands and cover Java/Bedrock behavior with deterministic tests.
  - Route: delegated direct; implementation requires analysis plus coordinated source and test changes.
  - Implementation start: authorized delegated writer; exact route is delegated direct, with a focused test-first regression followed by the narrow builder fix.
  - RED: `$env:PYTHONPATH='app;tests'; python -m unittest test_minecraft_presets.PresetTests.test_name_codecs_are_literal_bounded_and_edition_specific` failed because actual output was `execute at @p run summon minecraft:zombie "Ana" ~2 ~ ~`, while the regression expected Bedrock's legacy execute form.
  - Preserve Java command output and donor-name handling where each edition supports it.
  - Verify the focused preset and Bedrock test modules plus scoped diff checks.

## Verification
From repository root:
- python -m unittest tests.test_minecraft_presets tests.test_minecraft_bedrock
- git diff --check -- app/minecraft_presets.py tests/test_minecraft_presets.py odd/tasks/minecraft-bedrock-command-syntax.md

## Delivery and recovery
- Branch: codex/minecraft-command-results.
- Strategy: single-pr; no push, PR, or merge authorized.
- Forecast: fewer than 80 authored changed lines.
- RDD: unknown because `gentle-ai` is unavailable on PATH; treat assessment as unavailable and use independent verification.
- Engram mirror `odd/minecraft-bedrock-command-syntax/tasks`: pending because Engram tools are unavailable.
- Progress: Bedrock mob and TNT commands now use legacy `execute <target> <position> <command>` ordering, bare Bedrock entity identifiers, and the documented name-tag-before-position summon overload. Java generation remains unchanged. Added quantity-3 coverage for Bedrock and Java; expanded assertions across mob aliases and TNT.
- Verification: `python -m unittest tests.test_minecraft_presets tests.test_minecraft_bedrock` and the same command with `PYTHONPATH=app;.` failed to import because this checkout's `tests` directory is not importable as the `tests` package. `$env:PYTHONPATH='app;tests'; python -m unittest test_minecraft_presets test_minecraft_bedrock` passed (39 tests). `git diff --check -- app/minecraft_presets.py tests/test_minecraft_presets.py odd/tasks/minecraft-bedrock-command-syntax.md` passed. Focused GREEN passed for four preset cases.
- Authored changed lines: 64 (57 additions and 7 deletions, generated files excluded). Engram mirror remains pending because its tools are unavailable.
- Work-unit commit: `63f13af` (`fix(minecraft): generate Bedrock preset commands`); staged paths were exactly the three authorized files. No remote operations were performed.
- Next: synchronize the Engram mirror when its tools are available.
