<div align="center">
  <img src="assets/icons/tikreader-192.png" alt="TikReader logo" width="96">
  <h1>TikReader</h1>
  <p><strong>A Windows operator studio for live chat, automation, voice, overlays, and interactive stream control.</strong></p>
  <p>Run TikTok LIVE, YouTube Live, and Twitch events from one local, recoverable workspace.</p>
  <p>
    <a href="https://github.com/3rror32/TikReader/releases"><img src="https://img.shields.io/badge/Windows%20beta-Release%20page-78d9bb?style=for-the-badge&amp;logo=windows" alt="Check the GitHub releases page for a Windows beta"></a>
    <a href="https://ko-fi.com/3rror32"><img src="https://img.shields.io/badge/Support-Buy%20me%20a%20coffee-ff5e5b?style=for-the-badge&amp;logo=kofi&amp;logoColor=white" alt="Support TikReader on Ko-fi"></a>
  </p>
  <p><a href="docs/BETA_INSTALACION.md">Installation guide</a> · <a href="docs/INSTRUCCIONES.md">User manual</a> · <a href="https://github.com/3rror32/TikReader/issues">Report a problem</a></p>
</div>

![TikReader operator workspace with live activity, chat, gifts, and production controls](docs/screenshots/studio-overview-1.0.0.9.png)

## What TikReader does

TikReader turns observable live events into an operator-controlled workflow. The desktop keeps chat, audience activity, automation, overlays, simulation, and recovery tools together so a stream can be prepared, operated, and diagnosed without jumping between separate utilities.

- **Unified live workspace:** Monitor chat, gifts, likes, viewers, highlights, search, and production state from one consistent desktop interface.
- **Safe simulation:** Rehearse comments and gifts before a broadcast using the same saved mappings that handle live events. Tests remain clearly identified as simulated activity.
- **Durable Minecraft automation:** Map gifts to Java or Bedrock actions, preserve each donation in a paced queue, and inspect the donor, gift, action, quantity, progress, and result. Pending work survives pauses, temporary disconnections, and application restarts.
- **Visible pacing and recovery:** See the current effect, the next wave, backlog pressure, failures, and estimated wait. Pause or resume execution without silently discarding valid donations, and hold uncertain command outcomes for operator review instead of replaying them automatically.
- **Local voice tools:** Use installed voices, optional local speech engines, microphone captions, and responsive voice visuals. Local caption processing can stay on this computer; platform connections and optional model downloads still use the network.
- **Overlay studio:** Preview browser-source overlays and animation triggers, then adjust timing, scale, color, sound, and motion before using them on stream.
- **Gift catalog and action mapping:** Search the gift catalog, keep canonical gift identities, choose quantities, and assign each gift directly to the intended action without a second enable switch.
- **Operational safeguards:** Startup readiness, emergency controls, automatic backups, diagnostics, and recovery tools make failures visible and keep the operator in control.

## A practical operator workflow

1. **Prepare:** Review platform credentials, voices, overlays, gift mappings, Minecraft pacing, and safety limits before going live.
2. **Rehearse:** Use Simulation to confirm how comments and gifts appear and which configured actions they trigger. Simulation can execute real local integrations, so keep external targets paused or disconnected unless that effect is intentional.
3. **Operate and recover:** Connect the live channel, watch activity and automation results, pause unsafe execution when needed, and use the local history, diagnostics, and backups to understand what happened.

![Local microphone caption settings and a sample caption preview](docs/screenshots/microphone-captions-1.0.0.9.png)

![Overlay animation preview with editable trigger and visual controls](docs/screenshots/overlay-animation-studio-1.0.0.9.png)

## Install

TikReader is a **Windows 10/11 x64 beta**. The desktop installer includes its Python runtime and embedded web engine; a separate Python installation or browser is not needed for the desktop interface. Live platform connections and optional model downloads require internet access. The current source tree can be ahead of the latest public installer, so the Releases page is the source of truth for downloadable builds.

1. Check the [GitHub Releases page](https://github.com/3rror32/TikReader/releases) for an available Windows beta. README features do not guarantee that a matching public installer has been published.
2. If a release is available, download its `TikReader-<version>-Beta-Setup.exe` asset, close TikReader, and run the installer.
3. Launch **TikReader** from the Start menu, review the startup checks, test a voice and a simulated event, then connect a live channel.

If a public release is not listed, the beta is still being prepared. GitHub’s source ZIP is for developers and is not the Windows installer. See the [installation guide](docs/BETA_INSTALACION.md) for data locations, updates, and optional voices.

## Platforms and integrations

| Integration | TikReader provides | Requirements and status |
| --- | --- | --- |
| TikTok LIVE | Comments, observable gifts, and live events | Availability depends on TikTok, the network, and the connector; restricted streams are not guaranteed. |
| YouTube Live | Chat, observable memberships, and Super Chats | Your own YouTube Data API access and a live video. |
| Twitch | Read channel chat | Twitch account and an authorized chat-read token. |
| OBS Studio | Browser-source overlays and optional scene/source control | Local OBS WebSocket v5 for direct control; explicitly enable changes. |
| TikTok LIVE Studio | Browser-source overlay URLs | Configure compatible sources in your broadcasting setup; this is not direct LIVE Studio control. |
| Spotify | Song-link requests, manual approval, and queue control | Experimental; your Client ID, Premium account, and an active device. Real-account validation remains pending. |
| Minecraft Java / Bedrock | Authorized gift-to-action mappings, durable pacing, activity history, and command outcomes | Experimental; a configured Java RCON server or local Bedrock bridge plus explicit authorization. Transport guarantees differ by edition. |
| Streamer.bot | Local HTTP action bridge | Experimental; a configured action GUID and local HTTP server. Real-instance validation remains pending. |

These connectors are implemented capabilities; this does not mean every external service has been validated during a real broadcast. See [operating instructions](docs/INSTRUCCIONES.md) and [physical validation notes](docs/VALIDACION_FISICA.md). TikReader is an independent project and is not affiliated with the platforms listed above.

## Voice and local processing

Computer voices depend on the voices available on your system. Kokoro is optional; its first download requires internet access, and later synthesis runs locally. The included Spanish Vosk model supports microphone captions. Whisper caption models are also available for local recognition. Custom RVC models and the RVC/CUDA environment require separate setup and compatible hardware.

See [voice requirements and installation](docs/BETA_INSTALACION.md) and [local voice licenses](docs/LOCAL_TTS_LICENSES.md). Platform connections and optional model downloads still use the network.

## Documentation and development

- [Documentation hub](docs/README.md)
- [Studio, audience, and community features](docs/ESTUDIO_Y_COMUNIDAD.md)
- [Simulation](docs/SIMULACION.md) and [recovery](docs/RECUPERACION.md)
- [Project structure](docs/ESTRUCTURA.md) and [overlay architecture](docs/OVERLAYS_VISUALES.md)
- [Beta release notes](docs/BETA_RELEASE_NOTES.md) and [maintainer release checklist](docs/BETA_RELEASE_CHECKLIST.md)

To work from source, follow the documentation hub. For a normal installation, use the Windows installer. Contributions and bug reports should include the app version and steps to reproduce; remove credentials and personal chat data from attachments.

## Support TikReader

If TikReader helps your streams, [buy the project a coffee on Ko-fi](https://ko-fi.com/3rror32). Thank you for supporting its development.

Third-party components retain their own licenses. See the [bundled license information](packaging/licenses/VOICES.md); no project-wide license is asserted here.
