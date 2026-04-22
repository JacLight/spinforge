# SpinBuild (`building/`)

Build-farm peer to `hosting/` in the SpinForge monorepo.

## What SpinBuild is

SpinBuild is the AI-first microhosting build plane. It accepts a workspace zip +
manifest, dispatches the build to a Nomad-managed runner (Linux LXC, Android LXC,
or a Tailscale-attached Mac), streams stdout back over SSE, parks artifacts on the
shared Ceph mount, and emits metered usage events for partners to bill against.
Every API action is gated by the customer's single `policy` document, which
partners mutate via the admin surface. SpinForge owns policy enforcement + usage
metering; partners own pricing and marketing.

## Layout

```
building/
├── api/                 Node/Express service (building-api, port 8090)
│   ├── server.js
│   ├── routes/          HTTP surface (see "API surface" below)
│   ├── services/        Job + dispatch + artifact + vault + runner registry
│   └── utils/           KeyDB client, logger
├── runners/             Runner images + agents
│   ├── linux/           LXC/Docker image for Linux + web builds
│   ├── android/         Android SDK + JDK + Gradle image
│   ├── macos/           Bare-metal agent for Mac minis / MBPs over Tailscale
│   └── shared/          Common agent logic (heartbeat, command sub, log stream)
├── fastlane/            Shared Ruby lanes for iOS + Android store upload
├── vault/               OpenBao (OSS Vault) policies + bring-up docs
└── docs/                Integration + policy reference
    ├── edge-integration.md
    ├── policy-schema.md     (canonical policy reference)
    └── testing-quickstart.md
```

## Operational model

- **Control plane:** `building-api` runs on all 3 SpinForge control nodes behind
  the shared OpenResty edge. Shares KeyDB + Ceph with `hosting/`. Validates the
  same SpinForge admin JWT via the shared admin-auth middleware.
- **Dispatcher:** Nomad is the single dispatcher. Runners are Nomad clients, not
  a custom registry. `DispatchService` submits a Nomad job spec per build.
- **Storage:** Ceph filesystem at `/data/{workspaces,artifacts}/<jobId>/`.
  Workspaces are the uploaded zip; artifacts are the build outputs.
- **Runners:** LXC on Proxmox for Linux/Android (Nomad `docker` driver on Proxmox
  clients); bare-metal Macs over Tailscale (Nomad `raw_exec` driver on Mac
  clients).
- **Secrets:** Central multi-tenant OpenBao (OSS Vault). Namespace per customer;
  per-job short-lived tokens bound to that namespace.
- **Metering:** Every resource-consuming action emits a usage event to the
  `platform:usage` KeyDB stream. Partners subscribe and bill externally.
- **Policy enforcement:** Every resource decision (dispatch, container start,
  domain bind, cert issue) first reads `customer:<id>:policy` and compares
  against the knob in `building/docs/policy-schema.md`. 402 on exceed.

## Running locally

```
docker compose -f docker-compose.yml -f docker-compose.building.yml up -d building-api
curl http://localhost:8090/health
```

See `building/docs/testing-quickstart.md` for the full end-to-end flow.

## API surface

### Jobs

```
POST  /api/jobs                  multipart: workspace=<file.zip>, manifest=<JSON>
GET   /api/jobs/:id              job record
GET   /api/jobs/:id/events       recent events (snapshot)
GET   /api/jobs/:id/stream       SSE live tail of job:<id>:events
GET   /api/jobs/:id/artifacts    artifact list (paths + sizes)
POST  /api/jobs/:id/cancel       cooperative cancel
```

### Customers (policy + usage)

```
GET   /api/customers/:id/policy  current policy doc
PUT   /api/customers/:id/policy  replace policy (validated against schema)
GET   /api/customers/:id/usage   rolled-up usage for current billing window
GET   /api/customers/:id/usage/months   historical months
GET   /api/customers/:id/usage/active   live counters (concurrent jobs/containers)
```

### Signing

```
GET   /api/signing-profiles              list for caller's customer
POST  /api/signing-profiles              create (uploads material into OpenBao)
GET   /api/signing-profiles/:id
PUT   /api/signing-profiles/:id
DELETE /api/signing-profiles/:id
```

### Runners

```
GET   /api/runners               list registered Nomad clients by class
GET   /api/runners/:id           heartbeat freshness + capacity + last job
```

### Internal (runner <-> API only)

```
GET   /_internal/workspaces/:jobId    signed download of workspace zip
PUT   /_internal/artifacts/:jobId     signed upload of artifact blobs
POST  /_internal/jobs/:id/events      runner-side event append
```

### Admin (operator-only)

```
POST  /api/admin/retention/run   run artifact + workspace sweep now
                                 body: { "dryRun": true|false (default false) }
```

See [Retention](#retention) below for the scheduled sweep.

### Health

```
GET   /health
```

## KeyDB key namespaces (strict)

- `job:<id>` — job record
- `job:<id>:events` — per-job capped event stream (SSE source, MAXLEN ~5000)
- `job:<id>:log` — stdout stream (separate from events to keep event feed lean)
- `queue:builds:<platform>` — dispatch queue (used only if Nomad isn't sufficient)
- `runner:<id>` — Nomad-client supplementary heartbeat (TTL-refreshed)
- `artifact:<id>` — artifact metadata (points at Ceph path)
- `signing:<customerId>:<profileId>` — reference pointer only (actual secrets in OpenBao)
- `customer:<id>:policy` — the single policy document (see docs/policy-schema.md)
- `customer:<id>:usage:<yyyymm>` — rolling monthly usage counters
- `customer:<id>:active` — set of in-flight job IDs for concurrency enforcement
- `platform:usage` — append-only stream of `usage.*` events for partner billing

**Never read keys outside this namespace.** Customer ID is the only FK to
`hosting/` state.

## Ceph paths

- `/data/workspaces/<jobId>.zip` — uploaded source bundle
- `/data/artifacts/<jobId>/<filename>` — build outputs (.apk, .aab, .ipa, dist/)
- `/data/cache/*` — shared build caches, see below
- `/data/logs/jobs/<yyyymm>/<jobId>.ndjson` — archived job log after 24h

### Build caches (`/data/cache/*`)

Shared across all runners. Set these env vars in runner containers to use
them (see `docs/build-caches.md`):

  NPM_CONFIG_CACHE=/data/cache/npm
  YARN_CACHE_FOLDER=/data/cache/yarn
  PIP_CACHE_DIR=/data/cache/pip
  GRADLE_USER_HOME=/data/cache/gradle
  MAVEN_OPTS=-Dmaven.repo.local=/data/cache/maven
  COCOAPODS_CACHE_DIR=/data/cache/cocoapods
  SCCACHE_DIR=/data/cache/sccache

Xcode derived data is per-customer: `/data/cache/xcode-derived-data/<customerId>/<projectId>/`.
Prune with `scripts/prune-caches.sh`.

## Retention

Artifacts and workspaces would otherwise fill Ceph within a week of launch.
`building/api/bin/artifact-retention.js` is the janitor. It runs as a
Nomad `batch` / `periodic` job every night at **03:00 UTC** (see
`infra/nomad/jobs/artifact-retention.nomad.hcl`).

### Knobs (on each customer's policy)

- `build.keepSuccessfulBuilds` — default **30**. Keep the N most-recent
  successful builds' artifacts. Older succeeded artifacts are reclaimed.
- `build.keepFailedBuildsHours` — default **24**. Keep failed /
  timed-out / canceled builds' artifacts for debug for N hours after
  `completedAt`, then sweep.
- `build.workspaceRetentionHours` — default **2**. Delete the uploaded
  workspace this many hours after the job reaches a terminal state.

The job record itself is never deleted. It's rewritten with
`artifactsReclaimed: true` / `workspaceReclaimed: true` so the admin UI
can show "artifacts pruned" instead of returning a 404 on the files.

Non-terminal jobs (`queued`, `assigned`, `running`) are **never touched**
regardless of age — an actively-running job's workspace is still needed
by the runner.

### Manual trigger

```
POST /api/admin/retention/run
Content-Type: application/json
Authorization: Bearer <admin JWT>

{ "dryRun": false }
```

Returns a JSON summary with `artifactsDeletedCount`,
`workspacesDeletedCount`, `bytesReclaimed`, `customersScanned`,
`errors`, `durationMs`.

### Dry run

Set `DRY_RUN=1` in the env (or pass `--dry-run` on the CLI) to log what
*would* be deleted without touching anything. Good for tuning retention
knobs on a live cluster before committing.

```
docker run --rm \
  -v /mnt/cephfs/spinforge/hosting/data:/data \
  -e REDIS_HOST=192.168.88.170 -e REDIS_PORT=16378 -e REDIS_DB=1 \
  -e DRY_RUN=1 \
  192.168.88.170:5000/spinforge/building-api:latest \
  node bin/artifact-retention.js
```

Dry-run runs intentionally skip the `retention.run` publish to
`platform:events` — pretending the sweep ran would distort the timeline.

## Links

- [`docs/policy-schema.md`](docs/policy-schema.md) — canonical policy document reference (every enforceable knob)
- [`../SPINBUILD_PLAN.md`](../SPINBUILD_PLAN.md) — plan of record (architecture, milestones, locked decisions)
- [`docs/edge-integration.md`](docs/edge-integration.md) — OpenResty routing for `build.spinforge.dev`
- [`docs/testing-quickstart.md`](docs/testing-quickstart.md) — end-to-end smoke test
