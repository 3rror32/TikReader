# TikReader 1.0.0.9 Beta — release notes draft

This beta feature overview does not certify the installer or real-broadcast integrations. See the known limitations and validation checklist before installation.

## Windows package

Release asset: `TikReader-1.0.0.9-Beta-Setup.exe` for Windows 10/11 x64. The installer includes an isolated Python runtime, PySide6/Qt WebEngine, and the Spanish Vosk caption model. Optional Kokoro voices download separately; custom RVC requires separate preparation.

## Package verification

The supplied installer is **311,474,918 bytes**. Its SHA-256 was recomputed locally and matches the recorded build evidence:

```text
884b86f4e0eba7e3ab686d85d0b95063902814e6097cba8d57aaef1024e0a640
```

Binary source commit: `3567f3816a2c437026cb9b3d6603ed4616a1ea0c`. Commit `310039c` subsequently updates installation-guide wording only. The final compile log records successful installer construction. Recorded development-machine runtime checks passed: bundled-runtime startup, Spanish Vosk inclusion, separate data storage, diagnostic fields, full shutdown, and reopening with retained preferences. Recorded desktop/mobile UI QA also passed. These checks were read from the build evidence, not rerun during release-document preparation. Selected source/payload file identity was recorded; a full source-tree identity audit was not performed.

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
