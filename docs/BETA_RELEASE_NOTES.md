# TikReader 1.0.0.9 Beta — release notes draft

This beta feature overview does not certify the installer or real-broadcast integrations. See the known limitations and validation checklist before installation.

## Windows package

Release asset: `TikReader-1.0.0.9-Beta-Setup.exe` for Windows 10/11 x64. The installer includes an isolated Python runtime, PySide6/Qt WebEngine, and the Spanish Vosk caption model. Optional Kokoro voices download separately; custom RVC requires separate preparation.

## Package verification

The supplied installer is **311,463,245 bytes**. Its SHA-256 was recomputed locally and matches the recorded build evidence:

```text
7cb6b5eb1cc0dddddc03aa95d6cda8e2633fa5de7e14438baeb6a9efe34b0946
```

Binary source commit: `6081fcff8090219e60142281d347ea0817dd30c9`. The final compile log records successful installer construction. All 694 checked distributed source files match this runtime candidate. Six packaged-runtime checks passed on the development machine: bundled-runtime startup, Spanish Vosk inclusion, separate data storage, diagnostic fields, full shutdown, and reopening with retained preferences. The independent local general check passed 409 Python tests, 345 Node tests, Ruff, overlay build, and installer checks, with 68% coverage. These are observed local results; final hosted CI verification remains pending. They do not certify clean-Windows installation or a real broadcast.

Verify the downloaded installer using the attached `SHA256SUMS.txt`. Local reports containing private paths are not release attachments.

## Feature overview

- TikTok LIVE chat and observable live events.
- Additional YouTube Live and Twitch chat connectors.
- Voice reading, filters, history, overlays, points, games, and event automations.
- Optional OBS WebSocket scene/source control.
- Experimental Spotify requests, Minecraft Java RCON, and Streamer.bot action bridge.

## Installation and updates

Download the installer attached to the published release, close TikReader, install, and open it from the Start menu. Updates retain personal data. See [installation instructions](https://github.com/3rror32/TikReader/blob/main/docs/BETA_INSTALACION.md).

## Known limitations

- External integrations depend on their services and user-provided configuration. Real-broadcast validation is pending for this release candidate.
- Spotify requires Premium and an active playback device; it does not provide an internal music player.
- RVC is not automatically installed by the basic package.
- The installer is currently unsigned by the author.
- Clean-Windows installation and real-broadcast validation remain pending; development-machine checks do not establish those outcomes.

## Feedback

Report issues with the version, reproduction steps, expected result, and actual result. Remove secrets and participant data. See the [release checklist](https://github.com/3rror32/TikReader/blob/main/docs/BETA_RELEASE_CHECKLIST.md) for outstanding publication work.
