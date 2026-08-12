# Deployment manifest

Developer guide for `spinforge.yaml` / `spinforge.json` — the file you commit to
a repository to say "this repo deploys to that app."

A manifest **points at an app that already exists**. It cannot create one, claim
a domain, or change who owns it. You create the app in the control panel — where
quotas and domain assignment are enforced — and the panel hands you a pre-filled
manifest carrying the app's `appId`.

Templates and schema live in `building/api/`:

- `spinforge.example.yaml` — annotated YAML template
- `spinforge.example.json` — the same in JSON
- `spinforge.schema.json` — the JSON Schema, generated from `ManifestService`

---

## Quick start

### 1. Create the app

In the customer dashboard, create the app and pick its domain.

### 2. Download its manifest

Open the app → **Deploy** tab → set your repository URL, choose YAML or JSON,
then **Download**. You get a file already carrying the right `appId`:

```yaml
appId: app_b5354edd-e287-480f-b750-72b28a39a255
repo:
  url: https://github.com/me/my-app
```

Commit it to your repository root.

### 3. Get an API token

A long-lived customer token starting with `sfc_`, created from account settings.
Keep it in your CI secrets. **It never goes in the manifest** — the manifest is
committed to source control and deliberately contains no secret.

### 4. Apply it

```bash
curl -X POST https://build.spinforge.dev/_api/customer/manifest \
  -H "Authorization: Bearer sfc_your_token" \
  -H "Content-Type: application/yaml" \
  --data-binary @spinforge.yaml
```

SpinForge resolves the app, creates or updates its pipeline, and starts a build.

---

## Why appId and not a name

`appId` is stable. Rename the app's domain and the committed manifest keeps
working — the id resolves to whatever domain the app currently serves on, so no
repo needs re-editing after a move.

It also closes a hole. When manifests carried a `name` and auto-assigned
`<name>.spinforge.dev`, anyone with a token could mint domains in a loop, past
the quota the dashboard enforces. Since a manifest can now only reference an app
that already exists, the panel is the single place apps are created.

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

Unknown fields are **rejected, not ignored** — a typo like `rootDor` fails at
apply time instead of being silently dropped.

---

## Field reference

The whole surface is six fields, two of them required.

| Field | Type | Default | Notes |
|---|---|---|---|
| `appId` | string | **required** | `app_` + UUID. From the app's Deploy tab. |
| `repo.url` | string | **required** | Git clone URL, HTTPS or SSH. |
| `repo.ref` | string | repo's default branch | Branch, tag, or SHA. |
| `repo.token` | string | — | PAT for private repos. Never returned in a response. |
| `rootDir` | string | `.` | Subdirectory holding the project, for monorepos. |
| `autoDeploy` | boolean | `true` | `false` saves config without building. |

`$schema` and `$comment` are accepted and ignored by the server.

There is no `domain`, `name`, `type`, or `owner` field. Domain and project type
come from the app record, so the manifest and the panel can never disagree.
There are no build tuning fields either — see *Known limits*.

---

## Monorepos

`rootDir` points at the subdirectory holding the project. The repo is cloned
whole; the build runs from `rootDir` and output paths resolve against it.

```yaml
appId: app_b5354edd-e287-480f-b750-72b28a39a255
rootDir: apps/web
repo:
  url: https://github.com/me/monorepo
```

Produces `cd apps/web && npm ci && npm run build` with output at
`apps/web/dist`. Paths that escape the clone (`../`, absolute) are rejected.

---

## Project types

Type comes from the app, not the manifest.

| App type | Use for | Stages | Status |
|---|---|---|---|
| `static` | Vite, Next export, Astro, plain HTML | `build.static` → `deploy.static-site` | Deploys |
| `node` | Node apps with a build step | `build.node` → `deploy.static-site` | Deploys |
| `container` | Anything with a Dockerfile | `build.container` → `deploy.container` | **Not yet** |

An app whose type isn't buildable from a manifest is treated as `static`, and
the response says so in `warnings`.

### Container support is incomplete

A container app's manifest validates and saves, but nothing is built or
deployed — neither action has a registered handler, so `BuildService` marks them
`skipped_unimplemented`.

Every apply returns a warning naming the skipped stages:

```json
"warnings": ["no handler registered for: build.container, deploy.container — these stages will be skipped and nothing will be deployed"]
```

Use a `static` or `node` app until the handlers land.

---

## Endpoints

### Apply

```
POST /_api/customer/manifest
```

Creates the pipeline on first call (`201`), updates it on every call after
(`200`). Starts a build unless `autoDeploy` is `false`. Requires auth.

```json
{
  "created": true,
  "appId": "app_b5354edd-e287-480f-b750-72b28a39a255",
  "domain": "my-app.spinforge.dev",
  "url": "https://my-app.spinforge.dev",
  "pipeline": { "id": "pl_01J…", "stages": [] },
  "build": { "id": "b_01J…", "status": "queued" },
  "warnings": []
}
```

### Validate (no side effects)

```
POST /_api/customer/manifest/validate
```

Runs the same resolution and stage derivation a real apply does, stopping short
of the first write — same ownership check, same app-type handling, same stages.
Requires auth.

```json
{
  "valid": true,
  "appId": "app_b5354edd-e287-480f-b750-72b28a39a255",
  "domain": "my-app.spinforge.dev",
  "url": "https://my-app.spinforge.dev",
  "type": "static",
  "stages": [
    { "id": "build",  "action": "build.static" },
    { "id": "deploy", "action": "deploy.static-site" }
  ],
  "unsupported": [],
  "warnings": []
}
```

### Download a manifest

```
GET /_api/customer/sites/<domain>/manifest?format=yaml|json&repo=<url>
```

What the dashboard's Deploy tab calls. Requires auth; returns the file for an
app you own.

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
  "appId": "app_b5354edd-e287-480f-b750-72b28a39a255"
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

An `appId` you don't own returns `404` — the same response a nonexistent app
gives, so the endpoint can't be used to discover which app ids exist:

```json
{
  "error": "app_not_found",
  "message": "app app_… not found, or not owned by this account — create the app in your dashboard and download its manifest"
}
```

---

## Behavior worth knowing

**The token owns the deployment.** Ownership comes from the `sfc_` token. The
manifest carries no identity claim of its own — the `appId` must resolve to an
app that token's account owns, or the apply 404s.

**Applying is idempotent.** Keyed on account + `appId`. First call creates the
pipeline, later calls update it in place. Because the key is the app id and not
the domain, re-applying after a rename updates the existing pipeline instead of
orphaning it.

**Repo tokens are redacted.** A `repo.token` is stored with the pipeline source
so builds can clone, and stripped from every API response and build log.

**The repo is not a stage.** `BuildService` materializes the workspace from the
pipeline-level `source` before any stage runs, so `repo` maps to `source`, not
to a `source.git` stage. The clone is packaged into `workspace.zip` for the
runner, with `.git` excluded.

---

## Known limits

- **No build customization.** Command, output directory, package manager, and
  Node version are fixed at `npm ci && npm run build` → `dist`. `yarn`/`pnpm`
  projects, or ones writing to `build/` instead of `dist/`, cannot deploy.
  `npm ci` also requires a committed lockfile.
- **No build-time environment variables.**
- **Containers do not deploy** (see above).

---

## Implementation

- `building/api/services/ManifestService.js` — schema, parsing, app resolution,
  stage derivation, `plan()` and `apply()`
- `building/api/routes/customer.js` — apply and validate
- `building/api/server.js` — public schema route, YAML body parsing, wiring
- `hosting/api/routes/customer.js` — manifest download, app rename
- `apps/customer-ui/src/components/ApplicationDrawer/tabs/DeployTab.tsx` — the
  dashboard Deploy tab

Regenerate `spinforge.schema.json` after changing `MANIFEST_SCHEMA`:

```bash
cd building/api && node -e "
const fs=require('fs');
const M=require('./services/ManifestService');
fs.writeFileSync('spinforge.schema.json',
  JSON.stringify(new M({handlers:new Map()}).schema(),null,2)+'\n');
"
```
