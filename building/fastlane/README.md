# Fastfile

Shared fastlane config used by:
- Mac runners for iOS / macOS archive + TestFlight + App Store
- Android runners for signed AAB + Play upload

## Lanes

### iOS
- `fastlane ios archive` — build + sign `.ipa` using the runner-installed keychain.
- `fastlane ios testflight_upload` — upload `.ipa` to TestFlight (requires App Store Connect API key).
- `fastlane ios app_store_upload` — upload `.ipa` to the App Store production channel.

### Android
- `fastlane android release_aab` — gradle `bundleRelease` with injected signing props.
- `fastlane android play_internal` — upload AAB to Play Internal Testing.
- `fastlane android play_production` — upload AAB to Play Production.

All env vars the lanes expect are at the top of `Fastfile`. The runner
sets them from the Vault secret it checked out — nothing in this Fastfile
talks to Vault directly.

## Notes

- No `Appfile` — the bundle id and team id come from env, so this config
  is customer-agnostic.
- No `Matchfile` — we don't use match. Signing material comes from the
  per-customer Vault profile, not a shared git repo.
- `fastlane_version` is pinned at the runner level (see
  `building/runners/macos/install/install.sh`) to avoid surprises.
