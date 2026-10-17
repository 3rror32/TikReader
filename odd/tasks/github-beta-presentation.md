# GitHub beta presentation

## Objective and scope
Present TikReader clearly on GitHub and prepare a local beta release handoff without publishing, tagging, or uploading files. Preserve unrelated working-tree changes.

## Plan
- [x] GH-1: Create an honest visual README using reviewed existing screenshots and Ko-fi.
- [x] GH-2: Prepare beta notes and a maintainer checklist; make release automation draft-only and prerelease.
- [x] GH-3: Check local links, download destination, release semantics, and changed-file scope.

## Constraints and routing
Delegated direct: one bounded writer handles documentation and workflow changes. Allowed surfaces: README.md, docs/README.md, docs/BETA_RELEASE_NOTES.md, docs/BETA_RELEASE_CHECKLIST.md, .github/workflows/release.yml, this file. Forecast: approximately 220 authored changed lines, excluding existing assets. Delivery: ask-on-risk; no remote operations. Commit pending parent coordination. Engram mirror pending because no memory tool is available.

## Checks
Passive documentation has no meaningful RED test. Visually inspect selected screenshots, check local Markdown/HTML targets, avoid latest links for prereleases, inspect draft/prerelease YAML settings. Installer builds and live integrations remain pending; existing binaries are not re-certified.

## Progress
Exploration found a Windows x64 beta installer and tag-driven release workflow. Project documentation skills were unavailable at registry paths and configured fallback directories. Two screenshots were visually reviewed: voice configuration and external platforms; neither exposes a real credential or personal chat.

## Verification evidence and handoff
- Two chosen existing screenshots were inspected visually; no private chat or real credentials visible.
- PowerShell structural link check: 28 local targets, zero missing.
- README prerelease download target and workflow draft/prerelease textual assertions: PASS.
- Scoped `git diff --check`: PASS (line-ending advisories only).
- Python structural runner unavailable because the WindowsApps Python alias cannot start; equivalent PowerShell checks completed.
- YAML semantic parser unavailable (`yaml` Node module not installed); no dependency installed. Workflow flag structure inspected directly.
- No installer rebuild, clean-Windows validation, real integrations, authenticated remote actions, tags, uploads, or publication performed.
- Commit pending parent coordination; task outcomes and focused checks observed, work-unit commit identity still pending. Engram mirror pending.
- Changes are limited to the authorized README, documentation, workflow, and task document. Existing UI/test changes remain unstaged and untouched by this worker.

## Local delivery
Work-unit commit: `a1181cb` (`docs: prepare GitHub presentation and beta release draft`), 169 additions and 2 deletions across six scoped files. Independent targeted verification closed the release-notes wiring finding. Parent scoped whitespace check passed. Native review assessment is unavailable because gentle-ai is not installed; no native approval is claimed. Engram mirror remains pending.

Next step: rebuild and validate an exact release candidate, then obtain authorization before any remote tag, upload, or publication.

## Independent verification correction
Independent verification requested wiring the prepared release notes into the release action and making their documentation URLs work outside the repository file view. Added `body_path: docs/BETA_RELEASE_NOTES.md`, converted release-body links to absolute main-branch GitHub URLs, and recorded that documentation must be merged before publication. Draft and prerelease flags remain enabled. Native gentle-ai review assessment is unavailable because gentle-ai is not installed; no native review approval is claimed. Full binary and clean-Windows validation remain pending.

## GH-4 — upload updated beta and update main
Authorized outcome: update GitHub main and upload beta 1.0.0.9 using the user-approved session. Delegated route: one writer updates release metadata and sanitized checksum; parent owns GitHub delivery. Forecast: under 100 additional authored documentation lines.
- [x] Update beta notes/checklist to 1.0.0.9 and record observed installer provenance and validation limits.
- [x] Prepare sanitized SHA256SUMS.txt and match the supplied installer hash to recorded evidence.
- [ ] Obtain a usable authorized repository session; current upload is blocked on correct authentication.
- [ ] Reconcile and update main without overwriting remote work; resolve tag-build collision before upload.
- [ ] Upload exact installer and checksum, verify remote assets, and publish within authorization.
- [ ] Record work-unit commit and remote release evidence.
Checks: source/distribution/installer metadata agree on 1.0.0.9; local SHA-256 matches recorded evidence. Existing runtime/UI reports passed on the development machine; clean Windows and real broadcasts remain pending. No raw evidence JSON is intended for upload. Engram mirror remains pending; gentle-ai is unavailable. No remote operation was performed by this worker.
