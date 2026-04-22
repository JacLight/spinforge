# Linux runner

Docker image: `spinforge/builder-linux:latest`

Handles `platform=web` and `platform=linux` jobs. Spawned by
`building/api/services/DispatchService.js` via Nomad's docker driver.

## Build

```
docker build -t spinforge/builder-linux:latest building/runners/linux
```

(Push to a local registry or pre-load on every Nomad client node.)

## Env (injected by DispatchService)

| Var | Purpose |
|---|---|
| `JOB_ID` | ULID-based spinbuild job id |
| `CUSTOMER_ID` | Owning customer |
| `PLATFORM` | `web` \| `linux` |
| `WORKSPACE_PATH` | Path to the uploaded zip on the shared `/data` mount |
| `ARTIFACTS_DIR` | Where to write output files (same mount) |
| `BUILD_COMMAND` | Shell to run in the unzipped workspace (default: `npm ci && npm run build`) |
| `OUTPUT_DIR` | Directory (relative to workspace root) to publish as the artifact (default: `dist`) |
| `REDIS_*` | KeyDB connection |

## Lifecycle

```
(queued by API)  →  assigned  →  running  →  succeeded | failed
```

The agent writes directly to KeyDB — no RPC back to `building-api`. See
`agent.js` for the exact key shape.

## Future

- LXC native driver (once Nomad/LXC plugin is set up on Proxmox).
- Cached `node_modules` volume per customer to avoid `npm ci` cold-start.
- Sandboxing beyond Docker's defaults (seccomp profile, read-only root).
