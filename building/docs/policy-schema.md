# Customer Policy Schema

**Purpose.** The single document attached to a customer's profile that SpinForge
enforces at every resource decision. There are no tiers inside SpinForge —
partners encode their pricing model as a `policy` JSON doc per customer and
SpinForge enforces it at every dispatch, start, bind, and issue decision.

**Shape.** One JSON document keyed on `customer:<id>:policy` in KeyDB. Partners
mutate via `PUT /api/customers/:id/policy`. SpinForge reads it on every
resource decision.

**How to set.**
```
PUT /api/customers/:id/policy
Authorization: Bearer <partner-admin-jwt>
Content-Type: application/json

<body validated against the schema below>
```

**How to read.**
```
GET /api/customers/:id/policy  →  200 application/json
```

## Schema fragment

```json
{
  "version": 1,
  "build": {
    "concurrentJobs":        2,
    "maxJobDurationMin":     30,
    "maxJobCpuMhz":          4000,
    "maxJobMemoryMB":        4096,
    "maxArtifactMB":         500,
    "allowedPlatforms":      ["web", "linux", "android", "flutter", "electron"],
    "allowedRunnerClasses":  ["lxc", "linux"],
    "monthlyCpuSeconds":     36000,
    "monthlyBuildMinutes":   600,
    "keepSuccessfulBuilds":  30,
    "keepFailedBuildsHours": 24,
    "workspaceRetentionHours": 2
  },
  "hosting": {
    "maxSites":              10,
    "maxCustomDomains":      5,
    "maxSslCerts":           5,
    "maxSigningProfiles":    2,
    "concurrentContainers":  3,
    "maxContainerMemoryMB":  1024,
    "maxContainerCpuMhz":    2000,
    "maxStaticStorageGB":    10,
    "monthlyEgressGB":       100,
    "monthlyRequestCount":   1000000,
    "requestsPerSecond":     50
  },
  "features": {
    "signingProfiles":  true,
    "customDomains":    true,
    "macBuilds":        false
  }
}
```

All numeric knobs are hard ceilings — `0` means disallowed, absence means the
default-deny policy applies and the customer cannot use that capability.

---

## Build knobs

### `build.concurrentJobs`

- **What:** maximum number of in-flight build jobs per customer at any moment.
- **How measured:** `SCARD customer:<id>:active` — each job SADDs its ID on
  dispatch and SREMs on terminal status.
- **Where enforced:** `JobService.create()` → `BillingService.assertUnderConcurrency()`
  — pre-allocation check in `POST /api/jobs`.
- **On exceed:** `402 { error: "policy_exceeded", knob: "build.concurrentJobs", current: 2, limit: 2 }`.

### `build.maxJobDurationMin`

- **What:** wall-clock cap per build job before forced termination.
- **How measured:** runner agent tracks start time; `building-api` cross-checks
  via Nomad API `GET /v1/allocation/<allocId>` `CreateTime` vs current time.
- **Where enforced:** `DispatchService.submit()` sets Nomad `kill_timeout` +
  `task.resources.time`; watchdog loop in `JobService.watchdogTick()` cancels
  any job exceeding cap.
- **On exceed:** job transitions to `status: "timeout"`, event `job.timeout`
  emitted. Follow-up `POST /api/jobs` with identical manifest returns
  `402 { error: "policy_exceeded", knob: "build.maxJobDurationMin" }` only if
  the requested manifest's estimated duration exceeds the cap.

### `build.maxJobCpuMhz`

- **What:** per-job CPU allocation ceiling in MHz (Nomad's native unit).
- **How measured:** manifest-declared `resources.cpu` and runner-observed
  Nomad alloc `Resources.CPU`.
- **Where enforced:** `DispatchService.submit()` — rejects any job spec whose
  `resources.cpu > policy.build.maxJobCpuMhz` before calling Nomad.
- **On exceed:** `402 { error: "policy_exceeded", knob: "build.maxJobCpuMhz", current: <requested>, limit: <policy> }`.

### `build.maxJobMemoryMB`

- **What:** per-job memory allocation ceiling in MiB.
- **How measured:** manifest-declared `resources.memory`, enforced at Nomad
  alloc time (`Resources.MemoryMB`).
- **Where enforced:** `DispatchService.submit()` — rejects any job spec whose
  `resources.memory > policy.build.maxJobMemoryMB`. Nomad backstops with an
  OOM kill at the cgroup level.
- **On exceed:** `402 { error: "policy_exceeded", knob: "build.maxJobMemoryMB", current: <requested>, limit: <policy> }`.

### `build.maxArtifactMB`

- **What:** maximum summed size of all artifacts produced by one job.
- **How measured:** `du -sb /data/artifacts/<jobId>/` after `job.succeeded` is
  fired by the runner, before the final status commit.
- **Where enforced:** `JobService.finalizeArtifacts()` — runs `du` at the
  post-build hook. Oversized results mark job `failed` with
  `reason: "artifact_too_large"`.
- **On exceed:** job finalized as `failed`; next job submit returns
  `402 { error: "policy_exceeded", knob: "build.maxArtifactMB", current: <MB>, limit: <policy> }`
  only if the manifest declares a larger expected artifact.

### `build.allowedPlatforms`

- **What:** whitelisted platform strings the customer may request in a manifest.
  Values: `web`, `linux`, `android`, `ios`, `macos`, `flutter`, `electron`.
- **How measured:** `manifest.platform` string match.
- **Where enforced:** `JobService.create()` — first validation after schema
  parse, before workspace persistence.
- **On exceed:** `402 { error: "policy_exceeded", knob: "build.allowedPlatforms", current: "ios", limit: ["web","android"] }`.

### `build.allowedRunnerClasses`

- **What:** whitelisted Nomad client classes the job may be placed on. Values:
  `lxc`, `macos`, `linux`. Controls whether a customer may schedule onto Mac
  hardware regardless of platform.
- **How measured:** Nomad client `node.class` from `GET /v1/nodes`.
- **Where enforced:** `DispatchService.buildConstraints()` — adds a
  `${node.class}` regex constraint matching only allowed classes before
  submitting to Nomad.
- **On exceed:** if the resulting constraint set has no matching clients,
  Nomad returns `no nodes were eligible`, SpinForge maps to
  `402 { error: "policy_exceeded", knob: "build.allowedRunnerClasses", current: "macos", limit: ["lxc"] }`.

### `build.monthlyCpuSeconds`

- **What:** cumulative CPU-seconds consumed by builds in the current calendar
  month, across all jobs.
- **How measured:** runner reports `cpu_seconds` in the final `job.metrics`
  event; `BillingService.record()` does `HINCRBY customer:<id>:usage:<yyyymm> cpu_seconds <n>`.
- **Where enforced:** `JobService.create()` — pre-dispatch check reads
  `HGET customer:<id>:usage:<yyyymm> cpu_seconds` and adds a conservative
  estimate of the new job's CPU budget.
- **On exceed:** `402 { error: "policy_exceeded", knob: "build.monthlyCpuSeconds", current: 35800, limit: 36000 }`.

### `build.monthlyBuildMinutes`

- **What:** cumulative wall-clock build minutes in the current calendar month.
- **How measured:** `duration_sec` from `job.metrics`; `BillingService.record()`
  does `HINCRBY customer:<id>:usage:<yyyymm> build_minutes <n>` (converted from seconds).
- **Where enforced:** `JobService.create()` — pre-dispatch check.
- **On exceed:** `402 { error: "policy_exceeded", knob: "build.monthlyBuildMinutes", current: 598, limit: 600 }`.

### `build.keepSuccessfulBuilds`

- **What:** number of most-recent succeeded builds per customer whose artifacts
  (and on-disk workspace) are preserved on Ceph. Older succeeded-build
  artifacts are garbage-collected. The job record itself is kept for
  history — only the big files under `/data/artifacts/<jobId>/` are
  reclaimed.
- **How measured:** `job:by-customer:<id>` ZSET, filtered to `status:
  "succeeded"`, sorted by `completedAt` desc. Everything past the first N
  is eligible for sweep.
- **Where enforced:** `bin/artifact-retention.js` — standalone script run
  nightly as a Nomad `batch` `periodic` job. Also reachable on demand via
  `POST /api/admin/retention/run`.
- **On exceed:** silent cleanup. The job record is rewritten with
  `artifactsReclaimed: true` and an empty `artifacts: []` list; GET
  `/api/jobs/:id/artifacts` will subsequently 404 on the files.

### `build.keepFailedBuildsHours`

- **What:** how long failed build artifacts are kept so customers /
  operators can inspect the debug output before they're swept. Measured in
  hours from `completedAt`.
- **How measured:** `bin/artifact-retention.js` scans
  `job:by-customer:<id>` for jobs with status `failed` / `timeout` /
  `canceled` and `completedAt < now - keepFailedBuildsHours`. The per-hour
  horizon is independent of the per-customer `keepSuccessfulBuilds` count.
- **Where enforced:** same script as above; runs daily at 03:00 UTC.
- **On exceed:** same cleanup semantics as succeeded jobs — artifacts gone,
  job record kept with `artifactsReclaimed: true`.

### `build.workspaceRetentionHours`

- **What:** how long the uploaded workspace (`/data/workspaces/<jobId>.zip`
  or `/data/workspaces/<jobId>/`) is kept after the job terminates.
  Workspaces are large (full project source) and are only needed during
  the build itself; once the runner has cloned them they're dead weight
  on Ceph. Default is aggressive — 2 hours gives a short re-dispatch
  window for transient runner failures without letting the dir grow
  unbounded.
- **How measured:** `bin/artifact-retention.js` walks `job:by-customer:<id>`
  and for each job whose terminal timestamp (`completedAt || createdAt`)
  is older than the threshold, removes the workspace path. Jobs still in
  non-terminal states are skipped regardless of age.
- **Where enforced:** same script, same cadence.
- **On exceed:** workspace file/dir removed. The `workspaceUri` on the job
  record is left as-is (points at a gone path); GET `/_internal/workspaces/:jobId`
  will 404 after the sweep.

---

## Hosting knobs

### `hosting.maxSites`

- **What:** maximum number of `site:<id>` records owned by the customer.
- **How measured:** `SCARD customer:<id>:sites`.
- **Where enforced:** `hosting-api`'s `SiteService.create()` — pre-create check.
- **On exceed:** `402 { error: "policy_exceeded", knob: "hosting.maxSites", current: 10, limit: 10 }`.

### `hosting.maxCustomDomains`

- **What:** number of non-default (`*.spinforge.dev`) hostnames bound to the
  customer's sites.
- **How measured:** `SCARD customer:<id>:domains`.
- **Where enforced:** `hosting-api`'s `DomainService.bind()` — pre-bind check.
- **On exceed:** `402 { error: "policy_exceeded", knob: "hosting.maxCustomDomains", current: 5, limit: 5 }`.

### `hosting.maxSslCerts`

- **What:** number of live Let's Encrypt certs issued for this customer.
- **How measured:** `SCARD customer:<id>:certs`, counting only certs in
  `active` state (not `expired`, not `revoked`).
- **Where enforced:** `hosting-api`'s `AcmeService.requestIssue()` — pre-order
  check. ACME order is refused, no HTTP-01 challenge is posted.
- **On exceed:** `402 { error: "policy_exceeded", knob: "hosting.maxSslCerts", current: 5, limit: 5 }`.

### `hosting.maxSigningProfiles`

- **What:** number of `signing_profile` documents the customer owns (each maps
  to one OpenBao path).
- **How measured:** `SCARD customer:<id>:signing-profiles`.
- **Where enforced:** `SigningProfileService.create()` — pre-create check.
- **On exceed:** `402 { error: "policy_exceeded", knob: "hosting.maxSigningProfiles", current: 2, limit: 2 }`.

### `hosting.concurrentContainers`

- **What:** live running containers owned by the customer across the fleet.
- **How measured:** Nomad API `GET /v1/jobs?prefix=cust-<id>-` filtered to
  `Status: running` allocations (counted across all clients).
- **Where enforced:** `hosting-api`'s `ContainerService.start()` — pre-start
  check before `nomad job run`.
- **On exceed:** `402 { error: "policy_exceeded", knob: "hosting.concurrentContainers", current: 3, limit: 3 }`.

### `hosting.maxContainerMemoryMB`

- **What:** per-container memory ceiling in MiB.
- **How measured:** container spec `resources.memory` in the Nomad job.
- **Where enforced:** `hosting-api`'s `ContainerService.start()` — clamps or
  rejects job specs whose memory exceeds policy.
- **On exceed:** `402 { error: "policy_exceeded", knob: "hosting.maxContainerMemoryMB", current: <requested>, limit: <policy> }`.

### `hosting.maxContainerCpuMhz`

- **What:** per-container CPU ceiling in MHz.
- **How measured:** container spec `resources.cpu`.
- **Where enforced:** `hosting-api`'s `ContainerService.start()`.
- **On exceed:** `402 { error: "policy_exceeded", knob: "hosting.maxContainerCpuMhz", current: <requested>, limit: <policy> }`.

### `hosting.maxStaticStorageGB`

- **What:** sum of bytes under `/data/sites/<customerId>/**` on Ceph.
- **How measured:** `du -sb /data/sites/<customerId>` run nightly + maintained
  by `hosting-api` on every upload (adds/subtracts `file_size`).
- **Where enforced:** `hosting-api`'s `SiteUploadService.receive()` — checked
  before accepting the multipart upload.
- **On exceed:** `402 { error: "policy_exceeded", knob: "hosting.maxStaticStorageGB", current: 9.8, limit: 10 }`.

### `hosting.monthlyEgressGB`

- **What:** bytes sent by the edge on behalf of this customer in the current
  calendar month.
- **How measured:** OpenResty `log_by_lua` hook emits
  `INCRBY customer:<id>:usage:<yyyymm> egress_bytes <$bytes_sent>` on every
  request. `$bytes_sent` is the native OpenResty variable.
- **Where enforced:** OpenResty `access_by_lua` reads the counter; if over
  policy, returns `402` directly from the edge with
  `{error:"policy_exceeded",knob:"hosting.monthlyEgressGB",...}`.
- **On exceed:** edge-level 402 (no upstream hop).

### `hosting.monthlyRequestCount`

- **What:** HTTP request count in the current calendar month.
- **How measured:** OpenResty `log_by_lua` does
  `HINCRBY customer:<id>:usage:<yyyymm> req_count 1` on every request.
- **Where enforced:** OpenResty `access_by_lua` — edge-level 402 when over.
- **On exceed:** edge-level `402 { error: "policy_exceeded", knob: "hosting.monthlyRequestCount", current: <n>, limit: <m> }`.

### `hosting.requestsPerSecond`

- **What:** per-customer rate ceiling across the edge.
- **How measured:** OpenResty `lua-resty-limit-req` zone keyed by customer ID,
  with rate = `policy.hosting.requestsPerSecond`.
- **Where enforced:** OpenResty `access_by_lua` — in-edge rate limit. No KeyDB
  round-trip on hot path (shared dict).
- **On exceed:** `429 { error: "rate_limit", knob: "hosting.requestsPerSecond", limit: 50 }`
  with `Retry-After` header. (429 not 402 because it's recoverable.)

---

## Feature toggles

### `features.signingProfiles`

- **What:** whether this customer may create signing profiles at all.
- **How measured:** boolean read from policy.
- **Where enforced:** `SigningProfileService.create()` — rejects at step 0
  with `403 { error: "feature_disabled", feature: "signingProfiles" }`. Also
  gates the admin UI's signing-profile tab visibility.
- **On exceed:** `403` (not 402 — it's a capability, not a quota).

### `features.customDomains`

- **What:** whether this customer may bind non-`*.spinforge.dev` hostnames.
- **How measured:** boolean read from policy.
- **Where enforced:** `DomainService.bind()` — rejects non-default hostnames
  when `false`.
- **On exceed:** `403 { error: "feature_disabled", feature: "customDomains" }`.

### `features.macBuilds`

- **What:** whether this customer may dispatch to Mac runners (i.e. build iOS
  or macOS artifacts). Overlaps with `build.allowedRunnerClasses` and
  `build.allowedPlatforms` — this is the single boolean partners flip for
  go/no-go rather than editing two arrays.
- **How measured:** boolean read from policy.
- **Where enforced:** `JobService.create()` — rejects when
  `manifest.platform in ("ios","macos")` and `features.macBuilds === false`,
  regardless of what `allowedPlatforms` says.
- **On exceed:** `403 { error: "feature_disabled", feature: "macBuilds" }`.

---

## Non-knobs — things deliberately NOT in the schema

| Not-a-knob | Why not |
|---|---|
| `perContainerIOPS` | Too expensive to meter per-job; cgroup v2 IO stats would need a collector per node and the data isn't useful enough to justify it. |
| `memorySpikeDetection` | The Linux OOM killer is enough. Don't double-up. |
| `fairCpuPreemption` | Nomad doesn't expose preemption signals, and adding fair-share on top is complexity for no partner demand. |
| `perSiteIngressShaping` | Needs `tc`/`iptables` per container; operational burden outweighs value. Cloudflare does this better upstream. |
| `buildCacheQuotaPerCustomer` | Defeats the shared-cache speedup; caches are mostly hot-path-identical across customers (npm/Gradle/CocoaPods). Evict by LRU, not by quota. |
| `deepPacketInspection` | Cloudflare WAF is the right layer for DPI-grade inspection. SpinForge is not an IDS. |
| `tieredStorageSLA` | Ceph gives one SLA. No tier story until second-region Ceph exists. |
| `geoRestriction` | Edge-layer concern; do it at Cloudflare or at the origin app, not in policy. |

---

## Example policies

### 1. Generous free plan

```json
{
  "version": 1,
  "build": {
    "concurrentJobs":       1,
    "maxJobDurationMin":    15,
    "maxJobCpuMhz":         2000,
    "maxJobMemoryMB":       2048,
    "maxArtifactMB":        100,
    "allowedPlatforms":     ["web"],
    "allowedRunnerClasses": ["lxc"],
    "monthlyCpuSeconds":    3600,
    "monthlyBuildMinutes":  60,
    "keepSuccessfulBuilds":  10,
    "keepFailedBuildsHours": 12,
    "workspaceRetentionHours": 1
  },
  "hosting": {
    "maxSites":             1,
    "maxCustomDomains":     0,
    "maxSslCerts":          0,
    "maxSigningProfiles":   0,
    "concurrentContainers": 0,
    "maxContainerMemoryMB": 0,
    "maxContainerCpuMhz":   0,
    "maxStaticStorageGB":   1,
    "monthlyEgressGB":      5,
    "monthlyRequestCount":  100000,
    "requestsPerSecond":    5
  },
  "features": {
    "signingProfiles": false,
    "customDomains":   false,
    "macBuilds":       false
  }
}
```

### 2. Pro tier

```json
{
  "version": 1,
  "build": {
    "concurrentJobs":       4,
    "maxJobDurationMin":    60,
    "maxJobCpuMhz":         8000,
    "maxJobMemoryMB":       8192,
    "maxArtifactMB":        1024,
    "allowedPlatforms":     ["web", "linux", "android", "flutter", "electron"],
    "allowedRunnerClasses": ["lxc", "linux"],
    "monthlyCpuSeconds":    360000,
    "monthlyBuildMinutes":  6000,
    "keepSuccessfulBuilds":  50,
    "keepFailedBuildsHours": 48,
    "workspaceRetentionHours": 4
  },
  "hosting": {
    "maxSites":             50,
    "maxCustomDomains":     25,
    "maxSslCerts":          25,
    "maxSigningProfiles":   10,
    "concurrentContainers": 10,
    "maxContainerMemoryMB": 4096,
    "maxContainerCpuMhz":   4000,
    "maxStaticStorageGB":   100,
    "monthlyEgressGB":      1000,
    "monthlyRequestCount":  50000000,
    "requestsPerSecond":    200
  },
  "features": {
    "signingProfiles": true,
    "customDomains":   true,
    "macBuilds":       false
  }
}
```

### 3. Agency

```json
{
  "version": 1,
  "build": {
    "concurrentJobs":       16,
    "maxJobDurationMin":    120,
    "maxJobCpuMhz":         16000,
    "maxJobMemoryMB":       16384,
    "maxArtifactMB":        4096,
    "allowedPlatforms":     ["web", "linux", "android", "ios", "macos", "flutter", "electron"],
    "allowedRunnerClasses": ["lxc", "macos", "linux"],
    "monthlyCpuSeconds":    3600000,
    "monthlyBuildMinutes":  60000,
    "keepSuccessfulBuilds":  200,
    "keepFailedBuildsHours": 168,
    "workspaceRetentionHours": 8
  },
  "hosting": {
    "maxSites":             500,
    "maxCustomDomains":     500,
    "maxSslCerts":          500,
    "maxSigningProfiles":   100,
    "concurrentContainers": 50,
    "maxContainerMemoryMB": 16384,
    "maxContainerCpuMhz":   8000,
    "maxStaticStorageGB":   1000,
    "monthlyEgressGB":      10000,
    "monthlyRequestCount":  1000000000,
    "requestsPerSecond":    1000
  },
  "features": {
    "signingProfiles": true,
    "customDomains":   true,
    "macBuilds":       true
  }
}
```

---

## Error shape

Every policy violation returns the same envelope so partners and the admin UI
can render a uniform "over-quota" state:

```json
{
  "error":   "policy_exceeded",
  "knob":    "<dot.path.to.knob>",
  "current": <number|string|array>,
  "limit":   <number|string|array>
}
```

HTTP status is `402` for quota knobs, `403` for feature toggles, `429` for the
rate-limit knob. The `knob` field is the exact JSON path into the policy doc —
partners can surface it directly in their UI.
