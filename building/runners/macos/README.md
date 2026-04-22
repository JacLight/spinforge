# Mac runner

Long-lived agent that runs on each bare-metal Mac (Mac mini, MBP, Studio).
Handles `platform=ios` and `platform=macos` builds.

**Topology:** Macs live on the office LAN and join the cluster over
Tailscale. They reach KeyDB and `building-api` via Tailscale IPs only —
never publicly exposed. No Docker on the Mac; native process + launchd.

## Install

```
./install/install.sh
# then edit the generated config:
$EDITOR ~/.spinforge-runner/config.json
# then start:
launchctl kickstart -k gui/$(id -u)/dev.spinforge.buildrunner
```

## Config (`~/.spinforge-runner/config.json`)

See `install/config.example.json`. Every field can also be overridden by
env (`SPINFORGE_RUNNER_ID`, `SPINFORGE_REDIS_URL`, `SPINFORGE_API_URL`,
`SPINFORGE_RUNNER_SLOTS`, `SPINFORGE_RUNNER_CAPS`, `SPINFORGE_SCRATCH_DIR`).

## Lifecycle

1. Boot → register heartbeat at `platform:runner:mac:<runnerId>` (TTL 90s)
2. Subscribe to pubsub `runner:mac:<runnerId>:commands`
3. On `{ op: "build", jobId }`:
   - Fetch workspace zip via `GET /_internal/workspaces/:jobId` (over Tailscale)
   - Unzip to `~/spinforge-scratch/<jobId>/src`
   - Transition `queued → assigned → running`
   - Run `xcodebuild archive` (or `manifest.buildCommand`)
   - Collect `.xcarchive` / `.ipa` / `.app`
   - Upload via `POST /_internal/artifacts/:jobId`
   - Transition `succeeded` | `failed`
4. `{ op: "cancel", jobId }` → SIGTERM the running build

## Signing

**M3 does unsigned builds only.** M5 wires Vault checkout + fastlane:
- On build command, if `job.signingProfileId` is set, the agent calls
  Vault via `building-api` to check out the cert/profile.
- Imports into an ephemeral keychain (`security create-keychain`).
- Runs the signed lane via fastlane.
- Destroys the keychain on job end.

## Capacity

`slots` in config caps concurrent builds per runner. iOS builds are
memory-heavy (Xcode + clang); default `slots: 1`. Dispatcher routes to
the next idle runner when full.

## Security (current)

- Auth to KeyDB + `building-api` relies on Tailscale admission.
- The runner trusts any well-formed command on its channel.
- M4 upgrades to HMAC-signed commands + per-runner Vault tokens.

**Do not route public traffic to this agent.** It's a private mesh peer.
