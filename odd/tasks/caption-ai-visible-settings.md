# Visible AI caption settings

## Objective

Make the existing external-AI caption correction controls immediately discoverable on the **Subtítulos del micrófono** screen instead of hiding them inside a collapsed advanced section.

## Problem and why

The integration already works, but the provider, model, API key, instruction, and connection test are nested under **03 — Avanzado**. Users can reasonably conclude that AI caption correction is not available.

## Authorized scope

- Reposition the existing AI controls as a visible settings section.
- Preserve the current save, load, protected-key, test-connection, refinement, and fallback behavior.
- Update focused structural checks for the new placement.

## Constraints

- Do not change backend behavior or credential handling.
- Keep provider fields hidden until AI correction is enabled.
- Preserve unrelated worktree changes.
- UI copy remains Spanish and explains that only text, not audio, is sent externally.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: under 100 authored changed lines, excluding this task document.
- Route: delegated direct; the writer trigger applies because JavaScript and CSS both require non-trivial changes, with the focused test updated alongside them.
- Engram mirror: pending because no Engram memory tools are available in this session.

## Tasks

- [x] **CAP-AI-1** — Promote AI caption correction to a visible settings section and update focused structural coverage.
  - Acceptance: the AI toggle is visible without expanding a disclosure; provider fields appear only when enabled; existing save/test/refine behavior remains wired; privacy copy remains visible when configured.
  - Checks: `node tests/test_microphone_captions.cjs`.
  - Verification evidence: `node tests/test_microphone_captions.cjs` failed first on the new visible-section assertion, then passed with `microphone captions frontend checks passed`; scoped `git diff --check` passed.
  - Commit: `6687a27` (`feat(captions): surface AI correction settings`).
  - Review assessment: pending; receipt-driven development status command is unavailable in this environment, so assessment is currently unknown.

## Progress

- Exploration completed using CodeGraph and a bounded read-only UI map.
- AI settings now appear directly below the signal path and before “Contenido y ritmo”; provider fields retain their existing enabled-only visibility and Spanish privacy copy.
- The structural check verifies the AI section sits outside `<details>` and remains before the content controls.

## Next step

CAP-AI-1 is complete. The Engram mirror remains pending because no memory tools are available in this session; native review assessment also remains unknown in this environment.
