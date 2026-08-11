# Deployment manifest

Developer guide for `spinforge.yaml` / `spinforge.json` — the declarative file
that describes a project's hosting and lets SpinForge clone, build, and deploy
it.

Templates and schema live in `building/api/`:

- `spinforge.example.yaml` — annotated YAML template
- `spinforge.example.json` — the same in JSON
- `spinforge.schema.json` — the JSON Schema, generated from `ManifestService`

---

## Quick start

### 1. Get an API token

A long-lived customer token starting with `sfc_`, created from account settings.
The token identifies the owner of everything you deploy.

### 2. Add a manifest to your repo

Two fields are required.

```yaml
name: my-app
repo:
  url: https://github.com/me/my-app
```

### 3. Apply it

```bash
curl -X POST https://build.spinforge.dev/_api/customer/manifest \
  -H "Authorization: Bearer sfc_your_token" \
  -H "Content-Type: application/yaml" \
  --data-binary @spinforge.yaml
```

SpinForge assigns a domain, creates the pipeline, and starts a build.

---

## YAML or JSON

Both are accepted — YAML is a superset of JSON, so one parser reads either and
validation is identical.

| You send | Content-Type | curl flag |
|---|---|---|
| `spinforge.yaml` | `application/yaml` | `--data-binary @file` |
| `spinforge.json` | `application/json` | `--data @file` |

`text/yaml`, `application/x-yaml`, and `text/x-yaml` also work.

Use `--data-binary` for YAML. Plain `--data` strips newlines and the document
will not parse.

Unknown fields are **rejected, not ignored** — a typo like `domian` fails at
apply time instead of being silently dropped.

---

## Field reference

| Field | Type | Default | Notes |
|---|---|---|---|
| `name` | string | **required** | 1–100 chars. Also the idempotency key. |
| `repo.url` | string | **required** | Git clone URL, HTTPS or SSH. |
| `repo.ref` | string | repo's default branch | Branch, tag, or SHA. |
| `repo.token` | string | — | PAT for private repos. Never returned in a response. |
| `domain` | string | `<name>.spinforge.dev` | Auto-assigned if omitted. |
| `type` | enum | `static` | `static`, `node`, or `container`. |
| `rootDir` | string | `.` | Subdirectory holding the project, for monorepos. |
| `aliases` | string[] | `[]` | Extra domains for the same site. |
| `owner.email` | email | — | Verified against your account. Mismatch is rejected. |
| `owner.name` | string | — | Display name. |
| `autoDeploy` | boolean | `true` | `false` saves config without building. |

`$schema` and `$comment` are accepted and ignored by the server.

There are no build or container tuning fields. Builds use fixed defaults:
`npm ci && npm run build` producing `dist`, and `Dockerfile` at the repo (or
`rootDir`) root for containers. A project that needs different values cannot
express that today — see *Known limits*.

---

## Domains

Omit `domain` and SpinForge assigns `<name>.spinforge.dev`, slugified from the
name. Availability is checked against every `site:<domain>` key in the shared
KeyDB, so a generated domain cannot collide with another customer's site or
with a platform domain (`admin`, `api`, `grafana`…). On a clash it walks a
numeric suffix: `my-app-2`, `my-app-3`, up to 50 attempts.

Once assigned, the domain is **reused on every later apply** — re-running the
manifest never silently moves a live site to a new address.

Set `MANIFEST_BASE_DOMAIN` to change the suffix from `spinforge.dev`. Note this
is deliberately *not* `BASE_DOMAIN`, which holds the router IP.

---

## Monorepos

`rootDir` points at the subdirectory holding the project. The repo is cloned
whole; the build runs from `rootDir` and output paths resolve against it.

```yaml
name: web
rootDir: apps/web
repo:
  url: https://github.com/me/monorepo
```

Produces `cd apps/web && npm ci && npm run build` with output at
`apps/web/dist`. Paths that escape the clone (`../`, absolute) are rejected.

---

## Project types

| Type | Use for | Stages | Status |
|---|---|---|---|
| `static` | Vite, Next export, Astro, plain HTML | `build.static` → `deploy.static-site` | Deploys |
| `node` | Node apps with a build step | `build.node` → `deploy.static-site` | Deploys |
| `container` | Anything with a Dockerfile | `build.container` → `deploy.container` | **Not yet** |

### Container support is incomplete

A `container` manifest validates and saves, but nothing is built or deployed —
neither action has a registered handler, so `BuildService` marks them
`skipped_unimplemented` and the build reports success having done nothing.

Every apply returns a warning naming the skipped stages:

```json
"warnings": ["no handler registered for: build.container, deploy.container — these stages will be skipped and nothing will be deployed"]
```

Use `static` or `node` until the handlers land.

---

## Endpoints

### Apply

```
POST /_api/customer/manifest
```

Creates on first call (`201`), updates on every call after (`200`). Starts a
build unless `autoDeploy` is `false`. Requires auth.

```json
{
  "created": true,
  "domain": "my-app.spinforge.dev",
  "pipeline": { "id": "pl_01J…", "name": "my-app", "stages": [] },
  "build": { "id": "bld_01J…", "status": "queued" },
  "warnings": []
}
```

### Validate (no side effects)

```
POST /_api/customer/manifest/validate
```

Returns the resolved type, the domain it would land on, and the stages that
would run. Requires auth.

### Schema

```
GET /_api/customer/manifest/schema
```

Public — no auth. Mounted before the auth gate so editors resolving `$schema`
can fetch it. Returns `application/schema+json`.

### Authentication

```
Authorization: Bearer sfc_your_token
x-auth-token: sfc_your_token
```

---

## Editor support

JSON:

```json
{
  "$schema": "https://build.spinforge.dev/_api/customer/manifest/schema",
  "name": "my-app"
}
```

YAML, in VS Code with the YAML extension:

```json
"yaml.schemas": {
  "https://build.spinforge.dev/_api/customer/manifest/schema": "spinforge.yaml"
}
```

The schema is draft-07 (what `ajv` enforces at runtime) and is generated from
the same definition the server validates against, so it cannot drift.

---

## Errors

Invalid manifests return `400` with one entry per problem:

```json
{
  "error": "manifest_invalid",
  "message": "manifest validation failed",
  "details": [
    { "path": "/repo", "message": "must have required property 'url'" }
  ]
}
```

A malformed document fails before validation and reports the location:

```json
{
  "error": "manifest_invalid",
  "message": "could not parse manifest as YAML at line 2, column 6: bad indentation of a mapping entry"
}
```

A declared owner that does not match the token returns `403`:

```json
{
  "error": "owner_mismatch",
  "message": "manifest owner.email \"x@y.com\" does not belong to the authenticated account — check you are using the right API token"
}
```

---

## Behavior worth knowing

**The token owns the deployment.** Ownership comes from the `sfc_` token, not
from `owner.email`. When `owner.email` *is* present it is verified against the
account's email or the token's email and rejected on mismatch — that is what
catches a CI job running with the wrong credentials.

**Applying is idempotent.** Keyed on account + `name`. First call creates,
later calls update in place. Two accounts can each have a `my-app`.

**Repo tokens are redacted.** A `repo.token` is stored with the pipeline source
so builds can clone, and stripped from every API response and build log.

**The repo is not a stage.** `BuildService` materializes the workspace from the
pipeline-level `source` before any stage runs, so `repo` maps to `source`, not
to a `source.git` stage.

---

## Known limits

- **No build customization.** Commands, output directory, package manager, and
  Node version are fixed. `yarn`/`pnpm` projects, or ones writing to `build/`
  instead of `dist/`, cannot deploy. Adding a `build` block back is a small
  change when it is needed.
- **No build-time environment variables.**
- **Containers do not deploy** (see above).
- **`type` is not truly inferred** — it defaults to `static` and must be set
  explicitly for `node` or `container`. Real inference would require reading
  the repo, which happens after apply.

---

## Implementation

- `building/api/services/ManifestService.js` — schema, parsing, domain
  assignment, owner verification, stage derivation, apply
- `building/api/routes/customer.js` — apply and validate
- `building/api/server.js` — public schema route, YAML body parsing, wiring

Regenerate `spinforge.schema.json` after changing `MANIFEST_SCHEMA`:

```bash
cd building/api && node -e "
const fs=require('fs');
const M=require('./services/ManifestService');
fs.writeFileSync('spinforge.schema.json',
  JSON.stringify(new M({handlers:new Map()}).schema(),null,2)+'\n');
"
```
