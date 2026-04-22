# SpinBuild — testing quickstart

End-to-end bring-up on a home-network cluster. Assumes SpinForge (main
`docker-compose.yml`) is already running and KeyDB is reachable.

## 0. Prerequisites

- `docker-compose.yml` (main SpinForge stack) up and healthy.
- Nomad + Consul reachable at `NOMAD_ADDR` / `CONSUL_HTTP_ADDR`.
- Ceph mount under `${SPINFORGE_DATA_ROOT}` visible on all nodes.
- Two Macs on the home network, reachable over Tailscale from the
  Proxmox hosts.

## 1. Start Vault + building-api

```
docker compose \
  -f docker-compose.yml \
  -f docker-compose.building.yml \
  up -d vault building-api
```

Vault starts in dev mode with root token `spinforge-dev-root` (override
via `VAULT_DEV_ROOT_TOKEN` env). In production, switch to file/raft
backend — see `building/vault/README.md`.

Initial setup:

```
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=spinforge-dev-root

# (dev mode already has KV v2 at secret/. In production mode run
#  `vault secrets enable -path=secret kv-v2` first.)

vault policy write signing-profile building/vault/signing-profile.hcl

# Set the api's token (in dev, the root works; tighten to a scoped
# 'spinbuild-api' policy before prod):
echo "VAULT_TOKEN=spinforge-dev-root" >> .env

# Restart building-api so it picks up the token:
docker compose -f docker-compose.building.yml restart building-api
```

Verify:

```
curl http://localhost:8090/health
# { "status": "ok", "keydb": "ok", "events": "ready", ... }
```

## 2. Build the runner images

```
docker build -t spinforge/builder-linux:latest   building/runners/linux
docker build -t spinforge/builder-android:latest building/runners/android
```

Push to a registry Nomad client nodes can pull, or use `docker save` +
`docker load` to pre-seed each node.

## 3. Submit a Linux/web test build

```
cd /tmp
mkdir test-web && cd test-web
cat > package.json <<EOF
{ "name": "test", "scripts": { "build": "mkdir -p dist && echo '<h1>hello</h1>' > dist/index.html" } }
EOF
zip -qr ../test-web.zip .

curl -F workspace=@/tmp/test-web.zip \
  -F 'manifest={"customerId":"cust_test","platform":"web","buildCommand":"npm run build","outputDir":"dist"}' \
  http://localhost:8090/api/jobs
# { "jobId": "job_01H...", "status": "queued", ... }
```

Watch the stream:

```
curl -N http://localhost:8090/api/jobs/job_01H.../stream
```

Expected events: `job.created` → `step.unzip.ok` → `step.build.ok` →
`step.collect_artifacts.ok` → `job.succeeded`. Artifact ends up at
`${SPINFORGE_DATA_ROOT}/artifacts/<jobId>/index.html`.

## 4. Install Mac runners

On each Mac:

```
# Prereqs:
brew install node
brew install --cask tailscale
brew install fastlane       # optional, auto-installed by install.sh

# Checkout this repo on the Mac (or rsync just building/runners/macos + building/fastlane):
cd ~/projects
git clone <spinforge-repo>
cd spinforge/building/runners/macos

# Register with Tailscale on the cluster tailnet:
open /Applications/Tailscale.app
# (login, join tailnet)

# Install the runner:
./install/install.sh

# Edit config for this Mac:
$EDITOR ~/.spinforge-runner/config.json
# Set: runnerId (unique), redisUrl (over Tailscale), apiUrl (over Tailscale),
#      tailscaleIp (this Mac's own), capabilities.

# The LaunchAgent is loaded by install.sh. Verify it's running:
tail -f /var/log/spinforge-runner.log
```

On the control side, the Mac should appear:

```
docker exec -it spinforge-keydb keydb-cli -p 16378 -n 1 \
  KEYS 'platform:runner:mac:*'
```

## 5. Submit an unsigned iOS build

```
# Prepare a workspace zip containing an .xcodeproj + source. Must build
# with `xcodebuild archive -scheme ...` cleanly.
zip -qr /tmp/myapp.zip MyApp.xcodeproj MyApp/

curl -F workspace=@/tmp/myapp.zip \
  -F 'manifest={"customerId":"cust_test","platform":"ios","xcodeScheme":"MyApp","outputDir":"build"}' \
  http://localhost:8090/api/jobs
```

Dispatch goes to the Mac. `curl -N /api/jobs/<id>/stream` should show:
`job.created` → `job.assigned` (with `runnerId: "mac-mini-1"`) →
`workspace.fetched` → `step.unzip.ok` → `step.build.ok` →
`artifacts.collected` → `artifacts.uploaded` → `job.succeeded`.

Artifact lands at `/data/artifacts/<jobId>/<MyApp.xcarchive>` on Ceph.

## 6. Signed iOS build with TestFlight upload

First, upload signing material:

```
# Base64-encode your cert + profile + ASC API key:
CERT_B64=$(base64 -i MyApp.p12)
PROFILE_B64=$(base64 -i MyApp.mobileprovision)
ASC_KEY_B64=$(base64 -i AuthKey_XYZ.p8)

curl -X POST http://localhost:8090/api/signing-profiles \
  -F 'meta={"customerId":"cust_test","platform":"ios","label":"MyApp Prod"}' \
  -F "cert=$CERT_B64" \
  -F "certPassword=p12-password-here" \
  -F "profile=$PROFILE_B64" \
  -F "appStoreConnectApiKey=$ASC_KEY_B64" \
  -F "appStoreConnectKeyId=XYZABC1234" \
  -F "appStoreConnectIssuerId=00000000-0000-0000-0000-000000000000" \
  -F "teamId=ABCDE12345" \
  -F "bundleId=com.example.myapp"
# → { "id": "sp_01H...", ... }
```

Then submit with signing + publish target:

```
curl -F workspace=@/tmp/myapp.zip \
  -F 'manifest={"customerId":"cust_test","platform":"ios","xcodeScheme":"MyApp","signingProfileId":"sp_01H...","publishTargets":["testflight"]}' \
  http://localhost:8090/api/jobs
```

The stream shows additional `signing.ready` → `step.build.ok` (signed) →
`step.publish.testflight.ok` events.

## 7. Tear down

```
docker compose -f docker-compose.yml -f docker-compose.building.yml down
launchctl unload ~/Library/LaunchAgents/dev.spinforge.buildrunner.plist  # on each Mac
```

## Troubleshooting

- **`no mac runner available`** — check `platform:runner:mac:*` keys in
  KeyDB. If empty, the Mac agent isn't heartbeating. Check
  `/var/log/spinforge-runner.err`.
- **`vault mint failed`** — confirm `VAULT_TOKEN` is set in
  `building-api`'s env and the `signing-profile` policy is loaded.
- **Nomad eval error 500** — image not present on the Nomad client.
  Either push to a registry the client can reach, or
  `docker save | docker -H <client> load`.
- **SSE hangs** — your proxy is buffering. `openresty/nginx.conf` should
  set `proxy_buffering off` for the `/api/jobs/:id/stream` path once
  wired (see `building/docs/edge-integration.md`).
