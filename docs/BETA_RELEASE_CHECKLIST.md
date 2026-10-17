# Beta release checklist

This checklist prepares publication; it does not authorize tags, uploads, or publication. Current target: **1.0.0.8 Beta**, Windows 10/11 x64. Existing local binaries have not been re-certified for this candidate.

## Candidate and package

- [ ] Select and record the exact clean release commit; preserve unrelated development changes.
- [ ] Confirm `app/app_config.py`, `packaging/TikReader.iss`, installer metadata, and release title agree on the version.
- [ ] Run the applicable repository checks and `packaging/build_installer.ps1` on the selected commit.
- [ ] Validate the newly built package with the included-runtime checks and on clean Windows; record observed results.
- [ ] Check startup, close/reopen, data retention, overlays, voice output, and optional component installation.
- [ ] Validate external platforms with authorized test accounts; document anything still unverified.
- [ ] Inspect package contents for credentials, history, user models, private media, and development-only files.
- [ ] Record the final installer size and SHA-256; verify the attached file matches.
- [ ] Ensure the documentation is merged into `main` before publishing; release-note links target that branch.
- [ ] Review [release notes](BETA_RELEASE_NOTES.md), screenshots, third-party notices, and unsigned-installer disclosure.

## GitHub release — explicit authorization required

- [ ] Obtain authorization for the repository, tag operation, upload, and authenticated session before remote actions.
- [ ] Confirm Actions is enabled and the release workflow can complete in GitHub's Windows runner.
- [ ] Create an approved version tag matching `v*` on the chosen commit. Suggested first-beta tag: `v1.0.0.8-beta.1`; confirm it is unused before creation.
- [ ] Wait for checks and installer construction. Manual workflow dispatch only saves an Actions artifact; tag runs also prepare a GitHub Release draft.
- [ ] Confirm the release is **draft** and **prerelease**, attach the intended installer/checksum, and review notes. Automation must not publish automatically.
- [ ] Obtain explicit publication approval, then publish the reviewed prerelease.
- [ ] Verify the public release page and download from a signed-out session. Keep the README linked to the Releases page while beta is the only channel.

Do not use `/releases/latest` as the beta download destination: the stable-latest route does not reliably select a prerelease. Update README links to a concrete published beta tag or asset only after it exists.
