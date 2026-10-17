# TikReader 1.0.0.8 Beta — release notes draft

This beta feature overview does not certify the installer or real-broadcast integrations. See the known limitations and validation checklist before installation.

## Windows package

Planned asset: `TikReader-1.0.0.8-Beta-Setup.exe` for Windows 10/11 x64. The installer includes an isolated Python runtime, PySide6/Qt WebEngine, and the Spanish Vosk caption model. Optional Kokoro voices download separately; custom RVC requires separate preparation.

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
- An existing local installer and historical validation report do not certify this candidate. Rebuild and validate the exact release commit before publication.

## Feedback

Report issues with the version, reproduction steps, expected result, and actual result. Remove secrets and participant data. See the [release checklist](https://github.com/3rror32/TikReader/blob/main/docs/BETA_RELEASE_CHECKLIST.md) for outstanding publication work.
