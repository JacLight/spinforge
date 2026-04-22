# SpinBuild — Planning Document

> **Status:** pre-scaffold. No code yet. This document is the source of truth
> for vision, constraints, and decisions made so far. If you are reading this
> after a long break, start here before touching code.
>
> **Last updated:** 2026-04-10
> **Author of decisions:** Jacob (via planning sessions with Claude)

---

## 1. TL;DR

SpinBuild is a self-hosted, multi-tenant **build farm** for shipping apps to
every platform — web, iOS, Android, macOS, Windows, Linux desktop, Flutter,
Electron, etc. It sits behind a queue, runs builds on cheap owned hardware
(LXC for Linux/Android, bare-metal Mac minis / MacBook Pros for Apple
platforms), and streams progress + logs back to clients over SSE.

It is **not** part of Vibe Studio. Vibe Studio is a *client* of SpinBuild.
SpinBuild is its own product, peer to SpinForge, and there is an open
question (see §11) of whether SpinBuild should merge into the SpinForge
codebase rather than live as a separate project.

---

## 2. Why this exists (the cost/scale problem)

Hosted CI providers do not work at our target scale.

| Provider | Pricing | Verdict |
|---|---|---|
| **Codemagic** | $0.095/min PAYG, $3,990/yr team, **$12,000/yr enterprise** | Too expensive |
| **Bitrise** | From $89/mo for ~100 builds/mo | Way too small |
| **GitHub Actions** | macOS minutes are 10× Linux minutes; iOS builds chew through quota | Doesn't scale |

**Our target load:**
- 1,000 active users
- 3 builds/user/day
- = **3,000 builds/day**
- = **~90,000 builds/month**

At Codemagic PAYG ($0.095/min × ~10 min avg × 90k) that's **$85,500/mo**.
At Bitrise's tiers, not even possible.

GitHub Actions can technically build iOS without owning a Mac, but the
minute economics still don't work at 90k builds/mo, and we'd be one ToS
change away from being kicked off.

**Conclusion:** owning the hardware is the only viable path. Used Apple
silicon is cheap enough that "buy more macs" is a real scaling lever
($500/used M2 mini was the figure quoted).

---

## 3. Vision

A user clicks "Build for iOS" (or Android, web, etc.) inside Vibe Studio (or
any other client). The client POSTs the workspace to SpinBuild's API.
SpinBuild:

1. Accepts the upload, creates a `job` record, returns a `jobId`
   immediately.
2. Enqueues the job on the right platform queue (`builds:ios`,
   `builds:android`, `builds:web`, ...).
3. A worker on the right kind of host picks it up:
   - Linux/Android/web/Flutter → LXC container on Proxmox
   - iOS/macOS → bare-metal Mac runner over Tailscale
   - Windows → Windows VM (later)
4. The worker streams stdout + structured progress events back via SSE.
5. On success, the worker uploads artifacts (`.ipa`, `.apk`, `.aab`,
   `.app`, static bundle, etc.) to object storage and registers them on
   the job record.
6. The job record exposes: download links, signed-URL artifacts,
   build logs, signing metadata, and (for store-bound builds) a one-click
   "ship to store" action that runs fastlane.

The client (Vibe Studio, a CLI, a CI webhook, anything) only sees the API +
SSE — it doesn't care that the work is happening on a MacBook Pro in an
office in $JOB_LOCATION.

---

## 4. Target platforms (in priority order)

| Platform | Runner | Output | Store path |
|---|---|---|---|
| **Web (static)** | LXC | bundle .zip / dir | SpinForge deploy |
| **Web (vite/next/sveltekit)** | LXC | built bundle | SpinForge deploy |
| **Android APK/AAB** | LXC w/ Android SDK | `.apk` / `.aab` | Play Console upload via fastlane |
| **iOS** | macOS bare-metal | `.ipa` | App Store / TestFlight via fastlane |
| **macOS** | macOS bare-metal | `.app` / `.dmg` / notarized .pkg | direct download / Mac App Store |
| **Flutter (all targets)** | mix of LXC + macOS | per-target artifacts | per-target |
| **Electron** | LXC (linux/win) + macOS | per-target installers | direct download |
| **Linux desktop** | LXC | `.AppImage` / `.deb` / `.rpm` | direct download |
| **Windows desktop** | Windows VM (later) | `.exe` / `.msi` | direct download |

---

## 5. Hardware plan

**Already owned (committed to repurpose):**
- 2× Mac mini (idle, can ship to colo or run from office)
- 2× MacBook Pro 2023 (last Intel model — chosen for capacity headroom)

**Office infrastructure (already paid for, no incremental cost):**
- 5× static public IPs
- 1 Gbps fiber, business line
- Office space (no rack rental)

**Easy expansion lever:**
- Used **M2 Mac minis ~$500 each** — buy more whenever throughput is the
  bottleneck. Quote: *"if we succeed then replacing them is cheap af as we
  now have m4 so m2 machines used are less than $500"*.

**Linux/Android workers:**
- LXC containers on Proxmox host(s). Cheap, dense, fast spin-up. Can run
  on any commodity x86 box in the office or colocated.

**No cloud burst (initially):**
- We are deliberately not using AWS/GCP/Azure for build runners. The
  whole point is escaping per-minute cloud pricing. Cloud may come back
  later as overflow only, never primary.

---

## 6. Legal & cost constraints

**Apple:**
- macOS can ONLY legally run on Apple hardware. This is the entire
  reason for owning Mac minis / MBPs — there is no shortcut.
- Apple Developer Program: **$99/year per signing identity**, mandatory
  for any iOS/Mac App Store distribution. SpinBuild needs to handle
  multi-tenant signing — each customer brings their own Apple ID + cert,
  we never sign with our identity for their app.
- TestFlight is free once you have the Dev Program account.

**Android:**
- Google Play Console: $25 one-time per developer account.
- Customers bring their own keystore + Play credentials.

**Code signing strategy:**
- Customer secrets (signing certs, provisioning profiles, keystores,
  App Store Connect API keys, Play service account JSONs) live in
  **HashiCorp Vault**, never on disk on the runners.
- Runners pull just-in-time via short-lived Vault tokens scoped to a
  single job.
- Logs scrub anything that looks like a key/cert.

**Build tooling:**
- **fastlane** is the standard for both iOS and Android signing + store
  uploads. No need to reinvent.

---

## 7. Stack decisions (provisional, pending fresh SpinForge review)

These are the choices I'd make today, with the explicit caveat that we
will revalidate against the **latest** SpinForge codebase before scaffold
(see §11). The principle is: **mirror SpinForge's stack so ops is one
mental model.**

| Concern | Choice | Why |
|---|---|---|
| Language | Node.js (JS, JSDoc) | SpinForge is JS — single mental model. Revisit TS later if state machines hurt. |
| API framework | Express | SpinForge uses it. Don't introduce Fastify just for taste. |
| State / cache / queue | **KeyDB** (Redis-protocol fork) | SpinForge already runs it. BullMQ on the same KeyDB = no new infra. |
| Edge | OpenResty (nginx + Lua) **or** HAProxy | Whichever the latest SpinForge uses. Likely OpenResty given the existing investment + Lua scripting hint. |
| TLS | certbot sidecar + Let's Encrypt | Same as SpinForge. |
| Object storage (artifacts) | **MinIO** sidecar (S3 API) | Self-host pattern, avoids R2/S3 dependency. R2 stays as overflow option. |
| Secrets | **HashiCorp Vault** sidecar | Per-customer signing material. Non-negotiable. |
| Linux/Android runners | **LXC on Proxmox** | Dense, cheap, fast spin-up. Already in the architectural plan from prior discussion. |
| macOS runners | **Bare-metal Mac mini / MBP**, joined via **Tailscale** | Legal requirement (Apple HW only). Tailscale = private mesh, no public exposure. |
| Job orchestration | **BullMQ** (Node) on KeyDB | Mature, retry/backoff/priority/concurrency built-in. |
| Live progress to clients | **SSE** | Same pattern we already wired for deploy in `session-manager/src/services/deploy-jobs.service.ts`. |
| Admin UI | React, copied from `spinforge/apps/admin-ui` shell | Same look/feel, same auth. |
| Auth | JWT via SpinForge admin gateway | If merged, SpinBuild reuses SpinForge auth. If separate, mirrors it. |
| Container/runner image format | **OCI** (Docker images for LXC; raw fastlane envs for macOS) | Standard, portable. |

### Things SpinForge does NOT have that SpinBuild must add

- A **Job** model: `job:<id>`, `job:<id>:events` (Redis stream for SSE),
  `job:<id>:logs`, `job:<id>:artifacts`.
- **Queues**: `queue:builds:<platform>` via BullMQ.
- **Runner registry**: `runner:<id>` with heartbeats so dead macOS runners
  get fenced off automatically.
- **Artifact storage**: MinIO (or whatever object store the latest
  SpinForge already runs) with signed download URLs.
- **Vault integration**: per-job signing material checkout/checkin.
- **fastlane wrappers**: shared Ruby library for the macOS runners.

---

## 8. High-level architecture sketch

```
                       ┌──────────────────────────────────────────┐
                       │            Clients                       │
                       │  Vibe Studio │ CLI │ webhooks │ etc.     │
                       └────────────────┬─────────────────────────┘
                                        │ HTTPS + SSE
                                        ▼
                       ┌──────────────────────────────────────────┐
                       │   Edge: OpenResty (or HAProxy)           │
                       │   - TLS termination                      │
                       │   - Auth gateway (JWT)                   │
                       │   - Routing to api / static / etc.       │
                       └────────────────┬─────────────────────────┘
                                        ▼
                       ┌──────────────────────────────────────────┐
                       │   API (Node/Express)                     │
                       │   /jobs           POST  upload + enqueue │
                       │   /jobs/:id       GET   status           │
                       │   /jobs/:id/stream SSE  live events      │
                       │   /jobs/:id/logs  GET   tail / range     │
                       │   /jobs/:id/artifacts  GET signed URLs   │
                       │   /runners        admin                  │
                       └─────┬───────────────┬────────────────────┘
                             │               │
                             ▼               ▼
                ┌──────────────────┐  ┌──────────────────┐
                │  KeyDB           │  │  MinIO           │
                │  - Job state     │  │  - Workspace zips│
                │  - BullMQ queues │  │  - Build artifact│
                │  - SSE pub/sub   │  │  - Logs (cold)   │
                │  - Runner heart  │  └──────────────────┘
                │  - Customer mgmt │
                └────────┬─────────┘
                         │
            ┌────────────┼────────────┬──────────────────┐
            ▼            ▼            ▼                  ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐      ┌──────────────┐
      │ LXC      │ │ LXC      │ │ macOS    │  ... │  Vault       │
      │ Linux/   │ │ Android  │ │ Mac mini │      │  per-customer│
      │ web      │ │ SDK      │ │ over     │      │  signing     │
      │ runner   │ │ runner   │ │ Tailscale│      │  material    │
      └──────────┘ └──────────┘ └──────────┘      └──────────────┘
```

**Job lifecycle:**

1. `POST /jobs` — multipart upload of workspace zip + JSON manifest
   (`platform`, `framework`, `targets`, `signingProfileId`, etc.)
2. API streams zip to MinIO, creates `job:<id>`, enqueues on
   `builds:<platform>`, returns `{ jobId }`.
3. Worker on the right host picks up the job, downloads workspace from
   MinIO, checks out signing material from Vault (job-scoped token),
   runs the build.
4. Worker emits step events to a Redis stream `job:<id>:events`. API's
   SSE endpoint tails that stream.
5. On success, worker uploads artifacts to MinIO under
   `artifacts/<jobId>/...` and updates `job:<id>` status.
6. Vault token expires automatically. Workspace + scratch dir wiped.

---

## 9. Relationship to other products

### Vibe Studio (client)
- Vibe Studio is a React/Vite frontend backed by `session-manager`
  (Node + Express + Socket.IO), living at
  `/Users/imzee/projects/agent-zero/`.
- Vibe Studio is a **consumer** of SpinBuild, exactly like it's a
  consumer of SpinForge today.
- Build infrastructure must NEVER live inside Vibe Studio or
  session-manager. This was an explicit instruction:
  > *"hey Vibe Studio is not our build provider, they are not the
  > same project, please do not include the build infrastructure"*
- A previous attempt to add `build.service.ts` to session-manager was
  deleted for this reason.

### SpinForge (sibling, possibly parent)
- SpinForge lives at `/Users/imzee/projects/spinforge` (older copy).
  The deployed/server version is **more robust** than what's in this
  local checkout — assume the local checkout is ~10 months stale and
  re-pull before referencing it.
- SpinForge is a multi-tenant hosting platform: KeyDB-backed,
  OpenResty edge, Lua scripting, certbot TLS, customer/auth model,
  admin UI on its own port.
- We already integrate against SpinForge in
  `session-manager/src/services/deploy.service.ts` via admin token
  auth. The contract is: admin login → `POST /sites` → `POST
  /sites/:domain/upload`.
- SpinForge already owns **routing, customer management, auth,
  domain management, TLS** — all of which SpinBuild needs.

### Vibe Studio integration: Flutter Web only

For Flutter projects, **Vibe Studio supports the Flutter *Web* target
only.** Native iOS / Android / desktop builds go through SpinBuild —
they are not part of the Vibe Studio dev container.

**Why Flutter Web in Vibe Studio:**
- Makes editing easy — files-are-files, AI knows Dart, no special
  workflow.
- Lets the AI share live context during the iteration loop (Claude
  reads the same workspace it's helping the user edit).
- Live preview works in the existing iframe — Flutter Web compiles to
  plain HTML/JS/CanvasKit.
- SpinForge can host the built bundle with the existing static upload
  pipeline — no new deploy path needed.

**Why mobile builds stay out of Vibe Studio:**
- Xcode / Android SDK / signing material don't belong in a per-user
  dev container.
- That's literally what SpinBuild is for.

**What needs to change in Vibe Studio to enable this:**
- Add a **Flutter template** to dev-env creation that uses a base
  image with the Flutter SDK preinstalled. Explicit, predictable,
  faster than lazy-installing Flutter on first run.
- Nothing else. File manager, AI chat, preview iframe, and SpinForge
  deploy all work as-is.

**What Vibe Studio explicitly does NOT do for Flutter:**
- No mobile emulator streaming (too expensive, bad UX, defer
  forever).
- No `.ipa` / `.apk` builds (SpinBuild's job).
- No code signing (SpinBuild's job, via Vault + fastlane).

This keeps Vibe Studio focused on the edit/preview loop and pushes
all the heavy platform-specific work to SpinBuild where it belongs.

---

## 10. Hardware capacity math (back-of-envelope)

Assume 90k builds/month evenly distributed: ~125 builds/hour.

| Build type | Avg duration | Concurrent slots needed at 125/hr |
|---|---|---|
| Web (static/vite) | 2 min | 5 |
| Android | 8 min | 17 |
| iOS | 12 min | 25 |
| Flutter all-targets | 15 min | 32 |

**iOS slot estimate:** ~25 concurrent. A Mac mini can comfortably run
1–2 concurrent iOS builds depending on RAM. Worst case: **~13–25 Mac
minis** for iOS at peak.

We start with: **2 Mac minis + 2 MBP 2023 = 4 Apple runners.** Can serve
~4–8 concurrent iOS builds = ~20–40 iOS builds/hour at 12 min each =
**480–960 iOS builds/day.** That covers iOS at the **early adopter**
phase (couple hundred users, 1 build/day each), not 1k users × 3/day.

**Scaling lever:** add ~$500 used M2 minis as load grows. Revisit when
we cross 200 paying users.

---

## 11. The big open question: merge into SpinForge?

**The case for merging:** SpinForge already has 50%+ of what SpinBuild
needs:
- Customer model
- JWT auth + admin gateway
- Multi-tenant routing
- Domain & TLS management
- KeyDB infra
- Admin UI shell
- Lua-based edge scripting (which the latest SpinForge apparently
  leans on more heavily)
- It's tested and running in production

Building SpinBuild as a separate codebase means re-implementing all of
that from scratch.

**The case against merging:** SpinBuild's core workload (ephemeral
builds, queues, artifact storage, signing material, multi-OS runners) is
very different from SpinForge's (long-lived sites, static hosting,
container hosting). Merging risks:
- Bloating SpinForge's deployment story
- Coupling release cycles of two products that should evolve
  independently
- Confusing the customer model (hosting customer vs. build customer)

**Current lean (Jacob):** merge them. Quote:
> *"I think SpinForge has 50% of what we need and tested working. Also
> SpinForge already has routing and api which SpinBuild will need for
> customer to access build and all the necessary domain and routing
> setup. I think we should merge the project into one codebase, what do
> you think?"*

**Decision direction (Claude's recommendation, 2026-04-10):**
**Monorepo, separate services.** Not "merged into one service," not
"two separate repos." See §11a for the full reasoning.

**Decision status:** direction agreed in principle, **specifics
deferred** until after re-reading the latest SpinForge. The local
checkout is 10 months old; the production version is more robust and
uses Lua scripting more heavily. Re-pull, re-read, then lock the
specific layout.

---

## 11a. Recommended approach: monorepo, separate services

**TL;DR:** One git repo, one ops story, one customer/auth/admin-ui,
but two distinct top-level subsystems that don't import from each
other. Share the *platform layer*; isolate the *workload services*.

### What SpinBuild and SpinForge actually share

| Concern | Same? |
|---|---|
| Customer model | ✅ Same humans, same billing |
| Auth (JWT, admin gateway) | ✅ Identical |
| Admin UI shell | ✅ Want one login, two tabs |
| Edge (OpenResty/Lua, TLS, certbot) | ✅ Traffic lands on the same VIP |
| KeyDB infra | ✅ Same instance, different key prefixes |
| Operational model (compose, backups, monitoring, multi-node clustering) | ✅ One runbook |

### What they don't share

| Concern | SpinForge | SpinBuild |
|---|---|---|
| Workload lifecycle | Long-lived sites | Ephemeral jobs |
| Storage | Static dir + KeyDB | MinIO (artifacts) + KeyDB (job state) |
| Compute | Docker on the API node | LXC pool + bare-metal Macs over Tailscale |
| Queues | None | BullMQ |
| Scaling axis | Sites count, RPS | Concurrent build slots, especially Apple HW |
| Failure blast radius | Site down → one customer | Build crash → just that job |

The shared list is exactly the stuff that's painful to duplicate. The
non-shared list is exactly the stuff that's painful to entangle. So:
**share the platform layer, isolate the workload services.**

### Concrete layout

```
spinforge/                              ← unified repo
  platform/                             ← NEW: shared layer
    auth/                               ← move from hosting/api/routes/auth.js
    customers/                          ← move from hosting/api/services/CustomerService.js
    keydb/                              ← move from hosting/api/utils/redis.js
    edge/                               ← openresty + lua (current location)
    admin-ui/                           ← unified React shell, tabs for both
  hosting/                              ← existing SpinForge
    api/                                ← /sites, /containers, /certificates
    services/
  building/                             ← NEW SpinBuild
    api/                                ← /jobs, /runners, /artifacts
    services/
      JobService.js
      QueueService.js                   ← BullMQ
      RunnerRegistry.js
      ArtifactService.js                ← MinIO client
      VaultService.js                   ← signing material
    workers/
      linux/                            ← LXC entrypoint
      android/                          ← LXC + Android SDK
      macos/                            ← bare-metal, fastlane, runs over Tailscale
  docker-compose.yml                    ← single compose: keydb, openresty,
                                        ← hosting-api, building-api,
                                        ← building-workers, minio, vault, certbot
```

### Hard rules (the only way the monorepo doesn't degenerate)

1. **`platform/` is the only thing `hosting/` and `building/` import.**
   They never import from each other.
2. **Key namespace discipline in KeyDB.**
   - `customer:*` belongs to `platform`
   - `site:*` belongs to `hosting`
   - `job:*`, `runner:*`, `queue:*` belong to `building`
   - No subsystem reads keys outside its namespace.
3. **Customer ID is the only foreign key across subsystems.** A `site`
   references a `customerId`. A `job` references a `customerId`.
   Neither references the other.
4. **Two API binaries, not one.** `hosting-api` and `building-api` are
   separate processes in compose, separate ports behind the edge. So a
   runaway build queue can't OOM the hosting API, and a hosting cert
   renewal storm can't starve build job dispatch.
5. **One admin UI, code-split.** `/admin/hosting/*` and
   `/admin/building/*` are routes in the same React app, sharing the
   auth/nav/customer chrome. Don't ship two SPAs.
6. **Edge config is shared but partitioned.** OpenResty/Lua routes
   `*.spinforge.dev` to `hosting-api`, `*.build.spinforge.dev` (or
   `/api/v1/jobs/*` on the same domain) to `building-api`. One nginx
   config, two upstreams.

### Why monorepo beats two separate repos

- Customer model duplicated → sync hell, billing inconsistency, two
  sources of truth.
- Two auth systems → JWT issued by which? Cross-product login becomes
  federation pain.
- Two admin UIs → two logins, no unified view of "what is customer X
  using."
- Two ops stories → two backup procedures, two monitoring stacks, two
  on-call playbooks.
- The 50% you already have in SpinForge gets re-implemented from
  scratch.

### Why two services beats one merged service

- Build workload is spiky and crash-prone in ways hosting isn't.
  Coupling them means build crashes take down hosting.
- Scaling axis is different. Hosting wants more edge capacity;
  building wants more runners. Merging makes "scale" ambiguous.
- The hosting API codebase is small and clean. Adding queue workers +
  artifact pipelines + runner orchestration would triple its surface
  area for no benefit.
- Code review and ownership get muddier. With separate services it's
  obvious where job code goes vs site code.

### Migration path (NOT a big-bang refactor)

1. **Pull the latest SpinForge.** Mandatory. The 10-month checkout may
   already have moved things around.
2. **Add `building/` as a sibling to `hosting/` without touching
   `hosting/` at all.** New code only. New compose services. New
   routes. Build the first end-to-end Linux build job.
3. **Once `building/` works, extract `platform/`.** Move shared
   modules out of `hosting/api/` into `platform/`. Update `hosting/`
   imports. This is a mechanical refactor, low risk, can be done in
   one PR.
4. **Unify the admin UI.** Add a `building` tab to the existing
   SpinForge admin UI. Don't build a new one.
5. **Promote shared edge config.** Once `building-api` is real, extend
   the OpenResty config to route to it.

Steps 1 and 2 are the only ones blocked on the latest SpinForge
re-read. Steps 3–5 are mechanical and can wait.

### Honest caveat on this recommendation

This recommendation is based on the **10-month-old SpinForge
checkout**. The production version may already have:
- Some of the `platform/` extraction in place (in which case the
  migration is even cheaper).
- Build-like workloads (long-lived containers with lifecycle, not just
  static sites) that blur the hosting/building line — in which case a
  tighter merge might be defensible.

**Confidence levels:**
- **Direction (monorepo, separate services): high.** Robust to
  whatever the latest turns out to be.
- **Specific `platform/` layout: provisional.** Revisit after the
  latest SpinForge re-read.

---

## 12. Reusable pieces from SpinForge (provisional, pre-re-read)

Based on the 10-month-old checkout — **revalidate against latest:**

| Component | Path (old checkout) | SpinBuild use |
|---|---|---|
| Customer model | `hosting/api/services/CustomerService.js` | Build accounts = same customer. |
| Admin auth | `hosting/api/routes/auth.js` + `auth-gateway.js` | Same JWT flow we already use from `deploy.service.ts:198`. |
| KeyDB client | `hosting/api/utils/redis.js` | Reuse verbatim. |
| Admin UI shell | `apps/admin-ui` | Start the SpinBuild admin UI from this skeleton. |
| Upload pipeline | `routes/sites.js` (multer + adm-zip) | Workspace upload pattern. |
| Container recovery | `services/container-recovery.js` | Pattern for runner recovery. |
| docker-compose layout | top-level `docker-compose.yml` | Add `bullmq-worker`, `minio`, `vault` services to it. |
| Edge / Lua routing | `hosting/openresty/` | Reuse for the SpinBuild API edge. The latest version likely has more of this. |
| TLS / certbot | existing certbot sidecar | Free TLS for SpinBuild domains. |

---

## 13. Open decisions (track these)

| # | Decision | Status | Notes |
|---|---|---|---|
| D1 | Merge SpinBuild into SpinForge codebase? | **Direction agreed: monorepo + separate services** (see §11a) | Specifics deferred until after re-reading the latest SpinForge. |
| D2 | JS or TS for SpinBuild code? | **Open** | Default: match SpinForge (JS + JSDoc). Revisit if state machines hurt. |
| D3 | Edge: OpenResty or HAProxy? | **Lean OpenResty** | Whichever the latest SpinForge already runs. |
| D4 | Object storage: MinIO sidecar vs reuse SpinForge's existing storage? | **Open** | Depends on what latest SpinForge ships. |
| D5 | Where do macOS runners physically live? — office vs colo? | **Office (initially)** | 5 static IPs + 1Gbps fiber already paid for. Tailscale removes the need for public exposure. |
| D6 | Customer signing material storage: Vault vs encrypted KeyDB vs filesystem? | **Lean Vault** | Vault is the only one with proper short-lived tokens + audit. |
| D7 | Build orchestrator: BullMQ vs custom vs Temporal? | **Lean BullMQ** | Mature, runs on existing KeyDB, no new infra. |
| D8 | App distribution UI (end-user app catalog) — separate product? | **Out of scope** | This is downstream of SpinBuild, not part of it. Defer. |
| D9 | Cloud burst overflow (AWS/GCP) — yes or never? | **Never (v1)** | Defeats the cost rationale. Revisit if owned HW saturates. |
| D10 | Windows desktop builds — when? | **Defer** | Add Windows VM runner pool after Apple/Linux/Android prove out. |

---

## 14. Discussion log highlights

Chronological notes from the planning session that produced this doc.
Direct quotes preserved where they capture intent.

- **On scope discipline (Vibe Studio ≠ SpinBuild):**
  > *"hey Vibe Studio is not our build provider, they are not the same
  > project, please do not include the build infrastructure"*

  Result: deleted `session-manager/src/services/build.service.ts`.

- **On the cost problem:**
  > *"Codemagic is $3,990/year or pay as you go $0.095/minute and for
  > enterprise probably my category $12,000/year — not viable. Bitrise
  > recommended up to 100 builds/month from $89 — that's too little
  > will not work too expensive. Assume I have 1000 users building 3
  > times daily, 3000 builds a day × 30 days → 90k builds a month."*

- **On owned hardware as the answer:**
  > *"This is fine, this is just POS. If we succeed then replacing
  > them is cheap af as we now have m4, so m2 machines used are less
  > than $500."*

  Confirmed $500 figure for used M2 minis.

- **On existing assets:**
  > *"I have 2 mac minis I don't use I can repurpose and send them to
  > my cloud host provider to hook up to network or I can just host
  > them in my office and give live IP. I already 5 static IPs in
  > office, have 1GB fiber so that already provided. I can just add
  > more macs / easy peasey / I have two MacBook Pro 2023 (the last
  > Intel model made) to increase capacity if needed."*

- **On mac form factor:**
  > *"mac mini or studio or pro (because no need for external UPS)"*

- **On iOS without owning a Mac:**
  > *"so we can publish iOS without Apple device?"*

  Verdict: technically possible via GitHub Actions macOS runners, but
  the per-minute economics break at 90k builds/mo, and we'd be
  ToS-fragile. Owning Mac HW is the only durable answer.

- **On wanting to learn from existing SpinForge before scaffolding:**
  > *"this is the earlier version SpinForge take a look
  > /Users/imzee/projects/spinforge"*

  Then later:
  > *"not this — SpinForge is 10 months old, the one on the server is
  > more robust. Lua script + ... okay I'll pull the latest SpinForge,
  > look again."*

- **On the merge question:**
  > *"I think SpinForge has 50% of what we need and tested working.
  > Also SpinForge already has routing and api which SpinBuild will
  > need for customer to access build and all the necessary domain
  > and routing setup. I think we should merge the project into one
  > codebase, what do you think?"*

- **On documenting before coding:**
  > *"also before look [at the latest SpinForge] do a detailed doc on
  > what we want to achieve with SpinBuild and all our discussions so
  > if we come back in 10 years we can easily continue from where we
  > left off"*

  → This document.

- **On wanting a recommendation between sub-project vs separate:**
  > *"what do you recommend after studying SpinForge on how to proceed
  > with SpinBuild as sub or separate"*

  → §11a: monorepo, separate services. The "share platform, isolate
  workloads" middle path. Direction agreed; specifics deferred until
  the latest SpinForge re-read.

---

## 15. Next steps (when you come back to this)

1. **Pull the latest SpinForge** from the production server (the local
   checkout at `/Users/imzee/projects/spinforge` is ~10 months stale —
   ignore it).
2. **Re-read** `hosting/`, `apps/admin-ui/`, the edge layer (Lua
   scripts especially), and the docker-compose. Pay attention to:
   - What customer model exists today
   - Whether object storage is already integrated
   - How auth is structured now (still admin/admin123 default?
     Multi-tenant?)
   - What the Lua scripts are doing at the edge
3. **Resolve D1** (merge or separate). Update §11 with the decision
   and reasoning.
4. **Resolve D2–D7** based on what's already in latest SpinForge.
5. **Scaffold:** if merged, add a `building/` peer to `hosting/`. If
   separate, create `/Users/imzee/projects/spinbuild/` mirroring
   SpinForge's layout.
6. **First milestone:** end-to-end Linux/web build job. POST workspace
   → enqueue → LXC runner builds → SSE streams events → artifact in
   MinIO → signed download URL. No iOS, no signing, no Vault yet.
7. **Second milestone:** Android APK build (LXC + Android SDK,
   unsigned).
8. **Third milestone:** iOS unsigned build on a Tailscale-joined Mac
   mini. No fastlane, no signing — just `xcodebuild` producing an
   `.app`.
9. **Fourth milestone:** customer signing material via Vault, fastlane
   integration, signed `.ipa` + `.apk`.
10. **Fifth milestone:** store upload via fastlane (TestFlight first,
    then App Store + Play).

Each milestone is "the smallest end-to-end demo of the next layer."
Don't build infra ahead of the next milestone.

---

## 16. Anti-goals (things SpinBuild will NOT do)

- **No source code editor.** That's Vibe Studio's job.
- **No AI code generation.** That's Vibe Studio's job.
- **No project hosting.** That's SpinForge's job (today, separate or
  merged subsystem).
- **No CDN.** Artifacts download from MinIO via signed URLs. If a
  customer wants their own CDN in front, that's their setup.
- **No cloud burst (v1).** See D9.
- **No Windows runners (v1).** See D10.
- **No public app store / catalog UI.** See D8.
- **No GitHub Actions / Codemagic / Bitrise compatibility layer.**
  Customers integrate via the SpinBuild API, not by porting existing
  CI configs. This may change later.

---

*End of document. If you are picking this up cold, also read:*
- *`/Users/imzee/projects/agent-zero/session-manager/src/services/deploy.service.ts`
  — current SpinForge integration, shows the auth + upload contract.*
- *`/Users/imzee/projects/agent-zero/session-manager/src/services/deploy-jobs.service.ts`
  — the SSE / background-job pattern SpinBuild should mirror.*
- *Whatever the latest SpinForge looks like after you pull it.*
