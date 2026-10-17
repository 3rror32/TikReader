# Beta release checklist

This checklist prepares publication; it does not authorize tags, uploads, or publication. Current target: **1.0.0.9 Beta**, Windows 10/11 x64. The supplied installer hash matches recorded build evidence. Clean-Windows and real-broadcast checks remain pending.

## Candidate and package

- [x] Record binary source commit `6081fcff8090219e60142281d347ea0817dd30c9`; all 694 checked distributed source files match. Select the final main/tag commit separately.
- [x] Confirm app, Inno definition, launcher metadata, distribution metadata, and release-note version agree on 1.0.0.9.
- [x] Observe the independent local general check: 409 Python tests, 345 Node tests, 68% coverage, Ruff, overlay build, and installer checks passed.
- [x] Rebuild `packaging/build_installer.ps1` for the selected runtime commit; version remains 1.0.0.9.
- [ ] Confirm final hosted CI checks for the delivery commit.
- [x] Validate the rebuilt package with all six included-runtime checks on the development machine.
- [ ] Validate installation and operation on clean Windows.
- [ ] Check startup, close/reopen, data retention, overlays, voice output, and optional component installation.
- [ ] Validate external platforms with authorized test accounts; document anything still unverified.
- [ ] Inspect package contents for credentials, history, user models, private media, and development-only files.
- [x] Recompute local installer SHA-256 and match recorded evidence; size 311,463,245 bytes. Prepare sanitized `release/SHA256SUMS.txt`.
- [ ] Verify the uploaded/downloaded file against that checksum.
- [ ] Ensure the documentation is merged into `main` before publishing; release-note links target that branch.
- [ ] Review [release notes](BETA_RELEASE_NOTES.md), screenshots, third-party notices, and unsigned-installer disclosure.

## GitHub release — explicit authorization required

- [ ] Obtain authorization for the repository, tag operation, upload, and authenticated session before remote actions.
- [ ] Confirm Actions is enabled and the release workflow can complete in GitHub's Windows runner.
- [ ] Resolve tag workflow collision before creating the approved tag (suggested `v1.0.0.9-beta.1`; check availability). A pushed `v*` tag rebuilds and may replace a same-name installer asset. Preserve the supplied binary; do not assume API/UI tag creation suppresses workflow execution.
- [ ] Choose either the supplied-binary release path with an explicit workflow guard, or a separately validated CI-built binary. Manual dispatch saves an Actions artifact; tag runs also prepare a draft. Do not let CI silently replace the supplied installer.
- [ ] Confirm the release is **draft** and **prerelease**, attach the intended installer/checksum, and review notes. Automation must not publish automatically.
- [ ] Obtain explicit publication approval, then publish the reviewed prerelease.
- [ ] Verify the public release page and download from a signed-out session. Keep the README linked to the Releases page while beta is the only channel.

Do not use `/releases/latest` as the beta download destination: the stable-latest route does not reliably select a prerelease. Update README links to a concrete published beta tag or asset only after it exists.
