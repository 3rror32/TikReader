# Operator browser contracts

## Run without a live service

Requires Node 20 or newer and the exact lockfile dependency `@playwright/test@1.63.0`.
Install the browser into the disposable project cache, not a global browser profile:

```powershell
npm.cmd ci
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD 'runtime/playwright-browsers'
npx.cmd playwright install chromium
npm.cmd run test:operator
```

The configuration defaults to that same cache. `runtime/` is already ignored;
browser binaries, HTML reports, attachments, actual images and visual diffs never
belong in source baselines. No application build or real TikReader process is
needed. CI uses Windows and the lockfile's bundled Chromium revision.

## What is real and what is synthetic

The fixture recursively renders the production HTML includes and preserves its
script and stylesheet tags, order, authored scripts and committed bundles. It
serves static assets locally. Only the Socket.IO transport and backend responses
are synthetic: tests deliberately deliver connection/error/stat events, without
pretending a requested connection is a confirmed session.

Every test creates a fresh persistent Chromium context/profile. Bootstrap
preferences are context-local, preference writes are recorded in memory, and
reload assertions exercise the real UI's local persistence. Context-level routing
aborts every non-fixture origin, including frames and new pages. No credentials,
live channels, accounts or external services are required.

## Visual acceptance is explicit

Normal runs fail on missing or changed baselines. To intentionally accept reviewed
images, run exactly:

```powershell
npm.cmd run test:operator:update
npm.cmd run test:operator
```

Inspect the actual images in `runtime/operator-browser/results` before acceptance,
then review the PNG diff. Do not update snapshots in CI. The configuration rejects
direct `--update-snapshots` outside that explicit npm lifecycle.

All 22 theme options receive structural checks for named controls, keyboard focus,
legibility and reload persistence. Pixel baselines cover only TikReader (`original`),
light, dark, broadcast-console, creator-pop, swiss-brutalist and tactile-scrapbook.
Each baseline captures the full browser viewport in a visible classified-error state,
including the complete connection panel, error copy and enabled “Revisar usuario”
recovery action. The test asserts that the panel and the action's complete hit area
fit inside the viewport before taking the screenshot. At native 200% zoom the
physical test viewport is 2560x1800 so the effective CSS layout remains 1280x900;
the extension API still reports 2x zoom and the page reports doubled device pixel
ratio. The viewport PNG dimensions are asserted to prevent element-crop regressions.
The browser fixture routes `/static/icons/` from the production `assets/icons/`
directory and verifies that the TikReader logo request succeeds and renders.
Each run saves a masked review capture to its runtime result directory before the
baseline assertion. Baselines
are Windows/Chromium captures; a different OS, font installation or rendering
environment can legitimately change pixels and requires deliberate review, not
automatic acceptance.

## Startup readiness and recovery

The static operator shell is visible before application scripts finish. Its
controls remain inert until both the navigation shell and local backend/socket
are ready. `document-structure-ready`, `shell-ready`, `backend-ready`, and
`tiktok-live` are separate states; a healthy backend does not claim an active
TikTok connection. If a critical script fails or startup stalls, the visible
status panel offers a retry. A small inline fallback runs before the boot
controller request, so it can report that controller's own load failure; the
fallback watchdog also locks the app and offers retry if the controller never
appears. Retry reloads the page rather than rebinding app listeners in place.
The no-JavaScript markup explains that controls require JavaScript while
retaining the static shell.

The deterministic startup browser tests attach observed cold/warm static asset
request counts and response bytes, DOMContentLoaded and first-contentful-paint
milestones, boot-controller timings, and injected critical-script failure
evidence. These are fixture measurements for comparison, not performance
budgets or measurements of a live production service.

## Keyboard, motion and real zoom

The suite operates real keyboard events, checks destination heading focus,
history/refresh recovery, accessible names and roles, one atomic classified-error
announcement, and preserved recovery input. It checks reachable controls at narrow
and short windows and all representative themes at 200% browser zoom.

An isolated Manifest V3 extension calls `chrome.tabs.setZoom` and `getZoom` in the
persistent context's service worker. Proof requires the browser API's factor 2,
automatic per-tab mode, halved CSS viewport dimensions, doubled device pixel ratio,
and unchanged CSS `zoom: 1`. Resizing, CSS zoom or device scale alone is not proof.

Reduced-motion tests change the OS preference after page load, verify active Web
Animations are cancelled, then change the UI preference and verify reload recovery.
These are browser accessibility contract checks, **not a real screen-reader session**,
complete accessibility certification, or perceptual review of every theme.

## Capture privacy

Use the fixture's `captureOptions()` for every screenshot assertion/capture. It
masks password inputs, client IDs, stored nicknames and the Kick webhook path.
Synthetic secret tests compare pixels with different input values and verify
secrets are absent from local storage and recorded preference state after reload.
That proves capture redaction, not that every product secret-bearing surface is
already hidden; default webhook visibility is a separately scoped product task.

Only synthetic fixture values are allowed. Tracing is intentionally disabled:
DOM snapshots and request bodies can disclose typed secrets even when screenshot
masks are correct. Request attachments record paths/methods only, never payloads.
Do not enable unredacted tracing against real credentials.

## Ownership and rollback

Browser fixtures own transport/state isolation, not application behavior. A failed
UI contract must be investigated rather than hidden by fixture CSS, reordered
scripts, a different browser version or snapshot acceptance. Theme files continue
to own palette/personality; this work does not consolidate their cascade.

This work unit can be rolled back by removing its browser suite/config/baselines,
operator npm scripts/dependency, CI browser steps and this document, without
reverting navigation, status, motion or launcher behavior.

References: [Playwright extensions](https://playwright.dev/docs/chrome-extensions),
[visual comparisons](https://playwright.dev/docs/test-snapshots),
[network isolation](https://playwright.dev/docs/network), and
[Chrome tabs zoom API](https://developer.chrome.com/docs/extensions/reference/api/tabs).
