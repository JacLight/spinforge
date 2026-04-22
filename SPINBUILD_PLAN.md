# SpinForge Platform Plan — AI-first Microhosting

> **Last updated:** 2026-04-20
> **Owner:** Jacob
> **Scope:** `hosting/` (SpinForge) and `building/` (SpinBuild) as peers in one monorepo, one control plane, one customer model.

---

## 0. Current status snapshot

### Built

- **SpinBuild API** (`building/api/`) — routes: `jobs`, `signing`, `sessions`, `customers`, `runners`, `internal`, `health`. Services: `JobService`, `DispatchService`, `DispatchRouter`, `VaultService`, `SigningProfileService`, `SessionService`, `EventStream`.
- **Runners**: Linux Docker image (`spinforge/builder-linux:latest`), Android image (SDK 34 + JDK 17), macOS agent with launchd + keychain signing + fastlane.
- **Fastlane**: iOS (archive / testflight / app_store) + Android (release_aab / play_internal / play_production).
- **Local dev**: port-shifted docker-compose, `.env.local.example`, scratch area under `local-dev/`.
- **SpinForge hosting**: 3-node Proxmox cluster with Consul+Nomad quorum, KeyDB multi-master, Ceph filesystem, HAProxy edge, OpenResty router, admin UI with platform pages (Nodes, Workloads, Nomad, HAProxy, Storage, Topology).

### Pending

- Strip `PlanService`, `BillingService`, `ProxmoxDispatchService`, `RunnerRegistry` from `building/api/services/`; replace with `CustomerPolicyService` + `UsageEventEmitter`.
- Deploy `building-api` as a Nomad job reachable at `build.spinforge.dev`.
- Shared admin-auth middleware across `hosting/api` and `building/api`.
- OpenBao Nomad job for multi-tenant secrets.
- LXC + Mac runners registered as Nomad clients.
- Ceph-backed shared build cache mounts.
- End-to-end build on real runners.

---

## 1. Positioning

**AI-first microhosting.** SpinForge exposes resources, metrics, and policy enforcement. Partners (Vibe Studio, other AI IDEs, agencies) price, package, and market. SpinForge runs the infrastructure. Big jobs go elsewhere.

- No tiers in code. No `free` / `indie` / `team` / `scale` / `enterprise`.
- Every customer has a single **policy document** attached to their profile — a wallet of limits and flags.
- Partners mutate the policy when they onboard, upsell, promo, or offboard their customer.
- SpinForge emits usage events. Partners subscribe, apply their price book, bill customers. SpinForge itself never invoices.

This is deliberate. We don't know what a good "Starter tier" looks like in 2026, and we don't need to. The partner running the storefront does. Our job is to answer one question fast: _given this policy, is this resource request allowed, and what did it consume?_

---

## 2. Architecture

```
                     ┌──────────────────────────┐
                     │  Vibe Studio (partner)   │
                     │  AI IDE, owns UX+pricing │
                     └────────────┬─────────────┘
                                  │ HTTPS + ADMIN_TOKEN_SECRET JWT
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
        ┌─────────────────────┐     ┌─────────────────────┐
        │   build.spinforge   │     │    api.spinforge    │
        │   SpinBuild API     │     │    SpinForge API    │
        │   (Nomad job)       │     │    (Nomad job)      │
        └──────────┬──────────┘     └──────────┬──────────┘
                   │                           │
                   ▼                           ▼
        ┌─────────────────────────────────────────────────┐
        │  Control plane: Nomad + Consul + KeyDB quorum   │
        │  Storage: Ceph filesystem (cache + artifacts)   │
        │  Secrets: OpenBao (Nomad job, Ceph-backed)      │
        │  Edge: HAProxy → OpenResty (shared)             │
        └─────────────────────────────────────────────────┘
                   │                           │
        ┌──────────┴──────────┐     ┌──────────┴──────────┐
        │  Nomad clients:     │     │  Nomad clients:     │
        │  LXC builders,      │     │  hosting nodes      │
        │  Mac minis (Tailnet)│     │  (static + containers)
        └─────────────────────┘     └─────────────────────┘
```

Both APIs speak to the same Nomad, the same KeyDB, the same customer records, the same OpenBao. `building/` and `hosting/` are peers — not separate products glued together.

---

## 3. Locked decisions

1. **Single dispatcher: Nomad.** The parallel `ProxmoxDispatchService` code path is deleted. When a job placement is too slow we tune Nomad constraints, spread, or spawn more clients. We do not fork the dispatcher.
2. **Runners are Nomad clients.** LXC boxes run `nomad agent -client`. Mac minis run `nomad agent -client` over Tailscale. `nomad node status` **is** the runner registry. `RunnerRegistry.js` and the `runner:<id>:heartbeat` KeyDB keys are removed. The `runners` API calls the Nomad HTTP API.
3. **Central multi-tenant Vault: OpenBao.** OSS fork of HashiCorp Vault, same API surface, and namespaces are available in OSS. Deployed as a Nomad job with Ceph-backed file storage. One namespace per customer. Used by SpinForge for code-signing secrets and used by customers for their own app secrets.
4. **Policy model: one document per customer.** Stored at `customer:<id>:policy`. Mutated via `PUT /api/customers/:id/policy` (admin JWT only). Evaluated on every resource decision: job dispatch, container start, domain attach, cert issuance. No composition, no priority stacking, no scheduled mutations. The partner writes the whole doc when they want to change anything.
5. **Metering via Redis stream.** Jobs and containers emit usage events to the `platform:usage` KeyDB stream. Schema is stable. Partners consume the stream with their own stream-consumer group, multiply by their price book, and bill their customers. SpinForge has no billing code, no invoices, no Stripe.
6. **Shared admin auth.** `hosting/api` and `building/api` both load the same middleware, which validates JWTs signed by `ADMIN_TOKEN_SECRET`. `building-api` does not accept anonymous requests in any environment.
7. **Ceph-backed build caches.** Mounted read-write into every runner at:
   ```
   /mnt/cephfs/spinforge/hosting/data/cache/npm
   /mnt/cephfs/spinforge/hosting/data/cache/pnpm
   /mnt/cephfs/spinforge/hosting/data/cache/gradle
   /mnt/cephfs/spinforge/hosting/data/cache/maven
   /mnt/cephfs/spinforge/hosting/data/cache/cocoapods
   /mnt/cephfs/spinforge/hosting/data/cache/sccache
   /mnt/cephfs/spinforge/hosting/data/cache/xcode-derived-data/<customer-id>
   ```
   Xcode-derived-data is keyed per customer because Xcode is not safe to share. Everything else is shared across the fleet.
8. **No `PlanService`, no `BillingService`, no tier cards in admin UI.** Gone. The Build section of admin UI keeps Jobs, Signing Profiles, Runners, and a Policy editor — nothing else.

---

## 4. Policy model and enforceable knobs

One JSON document at `customer:<id>:policy`. Every field has a default (usually `0` or `false`) so a missing policy means "nothing allowed."

### Build quotas

| Knob | Unit | Enforced in |
|---|---|---|
| `concurrentJobs` | int | JobService before dispatch |
| `maxJobDurationMin` | minutes | JobService watchdog |
| `maxJobCpuMhz` | MHz | Nomad task resources |
| `maxJobMemoryMB` | MB | Nomad task resources |
| `maxArtifactMB` | MB | artifact upload |
| `allowedPlatforms[]` | `ios|android|web|electron|...` | JobService.validate |
| `allowedRunnerClasses[]` | `linux|android|macos` | Nomad constraint |
| `monthlyCpuSeconds` | seconds | usage stream aggregator |
| `monthlyBuildMinutes` | minutes | usage stream aggregator |

### Hosting quotas

| Knob | Unit | Enforced in |
|---|---|---|
| `maxSites` | int | site create |
| `maxCustomDomains` | int | domain attach |
| `maxSslCerts` | int | cert issue |
| `concurrentContainers` | int | container start |
| `maxContainerMemoryMB` | MB | Nomad task resources |
| `maxContainerCpuMhz` | MHz | Nomad task resources |
| `maxStaticStorageGB` | GB | periodic Ceph audit |
| `monthlyEgressGB` | GB | HAProxy log aggregator |
| `monthlyRequestCount` | requests | OpenResty Prometheus counter |
| `requestsPerSecond` | rps | OpenResty rate limit |

### Feature flags

| Flag | Effect |
|---|---|
| `signingProfiles` | allows creating/using iOS/Android signing profiles |
| `customDomains` | allows attaching non-`spinforge.app` hostnames |
| `macBuilds` | allows dispatch to `macos` runner class |

### Explicit non-knobs

- **Per-container disk IOPS limits.** Ceph RBD QoS works but adds ops burden; until a customer actually causes noisy-neighbor disk trouble, not worth it.
- **Memory spike detection.** cgroups already OOM-kill on the hard cap. Detecting "spiky but under cap" is a profiler product, not a hosting control.
- **Fair-share CPU preemption across customers.** Linux CFS shares are coarse; real preemption needs a custom scheduler. Our containers are small enough that overprovisioning + horizontal spread handles contention.
- **Per-site ingress traffic shaping.** HAProxy can do it. The operational complexity of per-customer traffic profiles is not worth the handful of customers that would benefit.
- **Per-customer build cache quota.** Cache is shared; worst case is eviction. Tracking per-customer cache size on Ceph is expensive and the payoff is low.
- **Deep packet inspection.** Wrong product. Customers who need WAF rules use Cloudflare in front of us.

Each of these is a "skip because the cheaper stack we already run doesn't do it well, and the product we're selling doesn't require it."

---

## 5. Data model (KeyDB key namespaces)

```
customer:<id>:profile            JSON  { id, email, partnerId, createdAt }
customer:<id>:policy             JSON  (section 4 schema)
customer:<id>:sites              SET   of siteId
customer:<id>:containers         SET   of allocId
customer:<id>:signing-profiles   SET   of profileId

site:<id>                        JSON  { customerId, hostname, origin, ... }
container:<id>                   JSON  { customerId, nomadJobId, image, ... }
signing-profile:<id>             JSON  { customerId, platform, bundleId, vaultPath }

job:<id>                         JSON  { customerId, platform, manifest, ... }
job:<id>:events                  LIST  (append-only log)
job:<id>:artifacts               SET   of artifact paths on Ceph

platform:usage                   STREAM  usage events (see section 1 + 3)
```

Nomad, Consul, and OpenBao hold their own state. We do not duplicate node or allocation records in KeyDB.

### Usage event schema

Every event posted to `platform:usage`:

```json
{
  "ts": 1745155200,
  "customerId": "cus_abc",
  "kind": "build.completed" | "container.tick" | "egress.tick" | "request.tick",
  "resource": { "jobId": "...", "allocId": "...", "siteId": "..." },
  "amount": { "cpuSeconds": 42, "memoryMBSeconds": 18000, "egressBytes": 0, "requests": 0 }
}
```

Partners consume with a consumer group. The only consumer SpinForge runs is the aggregator that decrements `monthlyCpuSeconds` / `monthlyBuildMinutes` / `monthlyEgressGB` / `monthlyRequestCount` for quota enforcement.

---

## 6. Edge routing

Same OpenResty that serves `api.spinforge.dev` and the admin UI. Add one upstream:

- `build.spinforge.dev` → Nomad service discovery → `building-api` Nomad job.
- Admin JWT required at the edge (same Lua middleware that guards `api.spinforge.dev`).
- Server-sent events pass through without buffering (already configured for hosting job logs).
- `/_internal/*` on `building-api` is firewalled at OpenResty and only reachable from Nomad clients on the Tailscale network.

No new nginx container. No new TLS cert flow. One `server { }` block.

---

## 7. API surface

### SpinForge core (`hosting/api`)

```
GET    /api/customers                        list
POST   /api/customers                        create
GET    /api/customers/:id                    get
PUT    /api/customers/:id/policy             replace policy document
GET    /api/customers/:id/policy             read policy document
GET    /api/customers/:id/usage?month=YYYY-MM   aggregated usage
GET    /api/sites                            list
POST   /api/sites                            create (policy-checked)
GET    /api/containers                       list
POST   /api/containers                       create (policy-checked)
GET    /api/platform/nodes                   Nomad nodes passthrough
GET    /api/platform/jobs                    Nomad jobs passthrough
```

### SpinBuild (`building/api`)

```
POST   /api/jobs                             create build (policy-checked, dispatches to Nomad)
GET    /api/jobs/:id                         status
GET    /api/jobs/:id/events                  SSE live log
GET    /api/jobs/:id/artifacts               list + signed URLs
POST   /api/signing-profiles                 create
GET    /api/signing-profiles                 list
DELETE /api/signing-profiles/:id             delete (purges OpenBao material)
GET    /api/runners                          Nomad node passthrough, filtered to builder clients
POST   /api/sessions                         Vibe Studio session VM allocation
GET    /_internal/workspaces/:jobId          runner pulls workspace tarball
POST   /_internal/artifacts/:jobId           runner uploads artifacts
```

Both APIs share the admin-auth middleware. `/_internal/*` takes a short-lived job-scoped token minted during dispatch, not the admin JWT.

---

## 8. Milestone order

1. Rewrite docs: this file, `building/README.md`, `building/docs/policy-schema.md`. _In progress._
2. Rip `PlanService`, `BillingService`, `ProxmoxDispatchService`, `RunnerRegistry` from `building/api/services/`. Add `CustomerPolicyService` and `UsageEventEmitter`.
3. Deploy `building-api` as a Nomad job, service-registered as `building-api`, reachable at `build.spinforge.dev` through the existing OpenResty.
4. Wire the shared admin-auth middleware into `building/api` and delete the anonymous-local codepath.
5. Hook `CustomerPolicyService.check()` into `JobService.dispatch()`, `SiteService.create()`, `ContainerService.start()`, `DomainService.attach()`.
6. Deploy OpenBao as a Nomad job with Ceph storage backend. Create namespace-per-customer provisioning flow. Migrate `SigningProfileService` to OpenBao namespaces.
7. Instrument `JobService` and `ContainerService` with Prometheus counters and the `platform:usage` stream writer.
8. Convert LXC + Mac runners from custom agent to `nomad agent -client`. Delete `RunnerRegistry` code paths. Update runner Dockerfiles.
9. Mount Ceph build caches into runner jobs via Nomad `volume` + `volume_mount` stanzas.
10. Artifact retention cleanup job: Nomad periodic job that walks `job:*:artifacts` and prunes past the policy-defined retention.
11. End-to-end test: real customer policy, real LXC runner, real iOS build on a Mac mini, real artifact download, real usage events on the stream.

---

## 9. Out of scope

- **Cloud burst to AWS / GCP / Azure.** Defeats the cost rationale. If a customer needs burst, they aren't our customer.
- **GitHub Actions / Codemagic YAML compatibility.** We take a manifest, not someone else's workflow schema.
- **Public app catalog / marketplace UI.** Partner product, not ours.
- **Windows build runners.** After iOS and Android prove out. Not soon.
- **Per-customer Stripe integration.** Partners bill. We emit events.
- **Custom scheduler on top of Nomad.** Nomad does placement. We do policy.
