/**
 * SpinForge - declarative hosting manifest
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Turns a single declarative document ("spinforge.json") into the pipeline
 * that SpinForge already knows how to run. The caller describes *what* they
 * want hosted — name, domain, repo, project type — and this service derives
 * the concrete build + deploy stages from the action catalog.
 *
 * The manifest deliberately does NOT carry the stage list. Stage wiring is
 * derived from `type` so the same manifest keeps working when the catalog
 * gains new actions or changes an input name.
 *
 * Ownership is NOT taken from the manifest. The authoritative owner is the
 * customer behind the sfc_ API token on the request — otherwise anyone could
 * claim a domain by typing someone else's address into `owner.email`. The
 * manifest's owner block is recorded as metadata and cross-checked, with a
 * mismatch surfaced as a warning rather than a hard failure (shared team
 * keys are a legitimate pattern).
 *
 * Applying a manifest is idempotent per (customerId, name): the first apply
 * creates the pipeline, later applies update it in place. That makes the
 * manifest safe to run from CI on every push.
 */
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const yaml = require('js-yaml');
const path = require('path');

// Project types a manifest may declare, mapped to the pipeline `type`
// vocabulary in PipelineService (PIPELINE_TYPES).
// DNS suffix for auto-generated domains. Deliberately NOT reusing BASE_DOMAIN
// from .env — that holds the router IP (192.168.88.170), which would produce
// nonsense like "my-app.192.168.88.170".
const BASE_DOMAIN = process.env.MANIFEST_BASE_DOMAIN || 'spinforge.dev';

// How many suffixed candidates to try before giving up on a free name.
const MAX_DOMAIN_ATTEMPTS = 50;

const TYPE_TO_PIPELINE_TYPE = {
  static: 'static-site',
  node: 'node-service',
  container: 'container',
};

const MANIFEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'repo'],
  properties: {
    // Editors resolve `$schema` to offer completion and inline validation.
    // Ignored by the server, but it must be allowed through or every
    // schema-aware manifest would fail additionalProperties.
    $schema: { type: 'string' },
    // Free-form notes. Accepts a string or a list of lines so the shipped
    // templates can carry usage comments in JSON, which has no comments.
    $comment: {
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
    // Human name; also the idempotency key within a customer.
    name: { type: 'string', minLength: 1, maxLength: 100 },
    // Defaults to static. Set explicitly for node or container — with the
    // build/container blocks gone there is nothing else to infer from.
    type: { type: 'string', enum: Object.keys(TYPE_TO_PIPELINE_TYPE), default: 'static' },
    domain: { type: 'string', minLength: 1 },
    aliases: { type: 'array', items: { type: 'string' }, default: [] },
    // Subdirectory within the repo holding this project. For monorepos:
    // the repo is cloned whole, then the build runs from here and output
    // paths resolve relative to it.
    rootDir: { type: 'string', default: '.' },
    owner: {
      type: 'object',
      additionalProperties: false,
      properties: {
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
      },
    },
    repo: {
      type: 'object',
      additionalProperties: false,
      required: ['url'],
      properties: {
        url: { type: 'string', minLength: 1 },
        // HEAD means "clone whatever the repo's default branch is" — the
        // clone runs without --branch. Beats hardcoding main, which breaks
        // on repos still defaulting to master or develop.
        ref: { type: 'string', default: 'HEAD' },
        // A PAT may be passed for private repos. It is stored on the
        // pipeline source (same as a hand-made pipeline) and redacted on
        // emit by BuildService — never echoed back in the apply response.
        token: { type: 'string' },
      },
    },
    // Run a build immediately on apply. CI usually wants this true.
    autoDeploy: { type: 'boolean', default: true },
  },
};

function bad(message, details) {
  const err = new Error(message);
  err.status = 400;
  // `expose` is what the global error handler checks before echoing a
  // message back — without it the caller just gets "internal_error".
  err.expose = true;
  err.code = 'manifest_invalid';
  if (details) err.details = details;
  return err;
}

class ManifestService {
  constructor({ pipelines, builds, actions, handlers, redis, logger } = {}) {
    this.pipelines = pipelines;
    this.builds = builds;
    this.actions = actions;
    // Shared KeyDB (db 1) — the same `site:<domain>` keys the hosting tier
    // writes, so an auto-generated domain can be checked against every site
    // on the platform, not just this customer's.
    this.redis = redis;
    // Same Map BuildService dispatches on — the only accurate answer to
    // "will this stage actually do anything".
    this.handlers = handlers;
    this.logger = logger;

    const ajv = new Ajv({ useDefaults: true, allErrors: true, strict: false });
    addFormats(ajv);
    this._validate = ajv.compile(MANIFEST_SCHEMA);
  }

  /**
   * The JSON Schema manifests are validated against, annotated so editors
   * can show titles and descriptions inline. Served over HTTP so a repo's
   * `$schema` can resolve to the live contract rather than a stale copy.
   */
  schema() {
    return {
      // draft-07 is what ajv 8's default export enforces at runtime. Naming
      // a newer dialect here would advertise rules the server doesn't apply.
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://build.spinforge.dev/_api/customer/manifest/schema',
      title: 'SpinForge deployment manifest',
      description:
        'Declarative hosting configuration. POST to /_api/customer/manifest as ' +
        'JSON or YAML with an sfc_ token to create or update a deployment.',
      ...MANIFEST_SCHEMA,
    };
  }

  /**
   * Accept a manifest as an already-parsed object, or as raw JSON/YAML text.
   *
   * YAML is a superset of JSON, so one parser handles both and callers don't
   * have to declare which they sent. Content-Type is used only to give a
   * better error message when the text is malformed.
   */
  parse(body, contentType = '') {
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;

    const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '');
    if (!text.trim()) throw bad('manifest body is empty');

    const looksJson = text.trimStart().startsWith('{');
    const label = looksJson || /json/i.test(contentType) ? 'JSON' : 'YAML';
    try {
      const parsed = yaml.load(text);
      if (parsed === null || parsed === undefined) throw new Error('document is empty');
      return parsed;
    } catch (err) {
      // js-yaml reports line/column for both JSON and YAML input, which is
      // the single most useful thing to hand back on a parse failure.
      const where = err.mark ? ` at line ${err.mark.line + 1}, column ${err.mark.column + 1}` : '';
      throw bad(`could not parse manifest as ${label}${where}: ${err.reason || err.message}`);
    }
  }

  /**
   * Validate a manifest and return the normalized copy (defaults applied).
   * Accepts an object or raw JSON/YAML text.
   * Throws a 400-shaped error with per-field details when invalid.
   */
  normalize(raw) {
    const source = typeof raw === 'string' || Buffer.isBuffer(raw) ? this.parse(raw) : raw;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw bad('manifest must be a mapping of fields, not a list or scalar');
    }
    const raw2 = source;
    // Ajv mutates in place when useDefaults is on — work on a copy so the
    // caller's object is untouched.
    const manifest = JSON.parse(JSON.stringify(raw2));
    if (!this._validate(manifest)) {
      throw bad(
        'manifest validation failed',
        this._validate.errors.map((e) => ({
          path: e.instancePath || '/',
          message: e.message,
        }))
      );
    }
    return manifest;
  }

  /**
   * Derive the build + deploy stages for a manifest.
   *
   * The repo is NOT a stage — BuildService materializes the workspace from
   * the pipeline-level `source` before any stage runs, so a `source.git`
   * stage here would clone twice.
   */
  toStages(manifest) {
    const deployBase = {
      domain: manifest.domain,
      aliases: manifest.aliases || [],
    };

    // Monorepo support. The repo is cloned whole, so a subdirectory project
    // is expressed by running the build from `rootDir` and resolving output
    // paths against it. Validated to stay inside the clone.
    const root = safeSubPath(manifest.rootDir || '.');
    const inRoot = (p) => safeSubPath(root, p);
    // `cd` first so the command runs where the project's package.json lives.
    const runFrom = (cmd) => (root === '.' ? cmd : `cd ${root} && ${cmd}`);

    switch (manifest.type) {
      case 'static':
        return [
          {
            id: 'build',
            name: 'Build static site',
            action: 'build.static',
            with: {
              command: runFrom('npm ci && npm run build'),
              outputDir: inRoot('dist'),
            },
          },
          {
            id: 'deploy',
            name: 'Deploy static site',
            action: 'deploy.static-site',
            needs: ['build'],
            with: { ...deployBase, artifact: '${stages.build.outputs.artifactPath}' },
          },
        ];

      case 'node':
        return [
          {
            id: 'build',
            name: 'Build Node project',
            action: 'build.node',
            with: {
              install: runFrom('npm ci'),
              command: runFrom('npm run build'),
              outputDir: inRoot('dist'),
            },
          },
          {
            id: 'deploy',
            name: 'Deploy site',
            action: 'deploy.static-site',
            needs: ['build'],
            with: { ...deployBase, artifact: '${stages.build.outputs.artifactZip}' },
          },
        ];

      case 'container':
        return [
          {
            id: 'build',
            name: 'Build image',
            action: 'build.container',
            with: {
              dockerfile: inRoot('Dockerfile'),
              context: inRoot('.'),
            },
          },
          {
            id: 'deploy',
            name: 'Deploy container',
            action: 'deploy.container',
            needs: ['build'],
            with: {
              domain: manifest.domain,
              imageRef: '${stages.build.outputs.imageRef}',
            },
          },
        ];

      default:
        throw bad(`unsupported manifest type "${manifest.type}"`);
    }
  }

  /**
   * Report which of the derived stages have no registered handler. Those
   * stages are skipped at build time (BuildService marks them
   * `skipped_unimplemented`), so a build can "succeed" while deploying
   * nothing. Surfacing it at apply time is far less confusing.
   */
  unsupportedStages(stages) {
    if (!this.handlers || typeof this.handlers.has !== 'function') return [];
    return stages.filter((s) => !this.handlers.has(s.action)).map((s) => s.action);
  }

  /**
   * Decide the domain a manifest deploys to.
   *
   *   1. An explicit `domain` always wins.
   *   2. Otherwise reuse whatever this deployment was assigned last time, so
   *      re-applying never silently moves a live site to a new address.
   *   3. Otherwise derive `<name>.spinforge.dev`, walking a numeric suffix
   *      until an unclaimed one is found.
   *
   * Availability is checked against `site:<domain>` in the shared KeyDB, so a
   * generated domain cannot collide with any site on the platform — including
   * the platform's own (admin, api, grafana…), which are stored the same way.
   */
  async resolveDomain(manifest, { currentDomain } = {}) {
    if (manifest.domain) return manifest.domain;
    if (currentDomain) return currentDomain;

    const slug = slugifyName(manifest.name);
    for (let n = 1; n <= MAX_DOMAIN_ATTEMPTS; n += 1) {
      const candidate = n === 1
        ? `${slug}.${BASE_DOMAIN}`
        : `${slug}-${n}.${BASE_DOMAIN}`;
      if (!(await this.domainTaken(candidate))) return candidate;
    }
    throw bad(
      `could not find a free domain for "${manifest.name}" after ` +
      `${MAX_DOMAIN_ATTEMPTS} attempts — set "domain" explicitly`
    );
  }

  /** True when a site record already exists for this domain. */
  async domainTaken(domain) {
    if (!this.redis) return false;
    return Boolean(await this.redis.get(`site:${domain}`));
  }

  /**
   * Confirm the manifest's declared owner really is the authenticated
   * account. Accepts either the account's own address or the address the
   * token was issued to, so shared team tokens still work.
   *
   * Rejecting here is the point: without it, `owner.email` would be a
   * comment, and a CI job holding the wrong token would deploy into the
   * wrong account with no signal.
   */
  async assertOwner(declaredEmail, { customerId, userEmail } = {}) {
    const declared = String(declaredEmail).trim().toLowerCase();
    const accepted = new Set();
    if (userEmail) accepted.add(String(userEmail).trim().toLowerCase());

    const account = await this.getCustomer(customerId);
    if (account && account.email) accepted.add(String(account.email).trim().toLowerCase());

    // Nothing to compare against (no account record, no token email) — let
    // it through rather than block a deploy on a lookup we couldn't do.
    if (!accepted.size) return;
    if (accepted.has(declared)) return;

    const err = bad(
      `manifest owner.email "${declaredEmail}" does not belong to the ` +
      `authenticated account — check you are using the right API token`
    );
    err.status = 403;
    err.code = 'owner_mismatch';
    throw err;
  }

  /** Load a customer record from the shared KeyDB. Null when unavailable. */
  async getCustomer(customerId) {
    if (!this.redis || !customerId) return null;
    try {
      const raw = await this.redis.get(`customer:${customerId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Create or update the pipeline described by a manifest, optionally
   * kicking off a build. `customerId` and `userEmail` come from the
   * authenticated sfc_ token, never from the manifest body.
   */
  async apply(rawManifest, { customerId, userEmail } = {}) {
    if (!customerId) throw bad('customerId is required to apply a manifest');

    const manifest = this.normalize(rawManifest);
    const warnings = [];

    // Verify the declared owner before doing any work. This is the guard
    // against a CI job configured with the wrong token quietly deploying
    // into someone else's account — the manifest states who it belongs to,
    // and we refuse if the token says otherwise.
    const declaredEmail = manifest.owner && manifest.owner.email;
    if (declaredEmail) {
      await this.assertOwner(declaredEmail, { customerId, userEmail });
    }

    // Reuse a previously assigned domain so re-applying never moves a live
    // site; only a brand-new deployment gets a fresh generated name.
    const existing = await this._findByName(customerId, manifest.name);
    manifest.domain = await this.resolveDomain(manifest, {
      currentDomain: existing && existing.metadata && existing.metadata.domain,
    });

    const stages = this.toStages(manifest);
    const missing = this.unsupportedStages(stages);
    if (missing.length) {
      warnings.push(
        `no handler registered for: ${missing.join(', ')} — ` +
        `these stages will be skipped and nothing will be deployed`
      );
    }

    const spec = {
      customerId,
      name: manifest.name,
      type: TYPE_TO_PIPELINE_TYPE[manifest.type],
      source: pruneUndefined({
        type: 'git',
        url: manifest.repo.url,
        ref: manifest.repo.ref,
        token: manifest.repo.token,
      }),
      stages,
      trigger: { type: 'manifest' },
      metadata: pruneUndefined({
        domain: manifest.domain,
        aliases: manifest.aliases,
        ownerEmail: declaredEmail,
        ownerName: manifest.owner && manifest.owner.name,
        manifestType: manifest.type,
        appliedBy: userEmail,
      }),
    };

    let pipeline;
    let created;
    if (existing) {
      pipeline = await this.pipelines.update(existing.id, {
        type: spec.type,
        source: spec.source,
        stages: spec.stages,
        trigger: spec.trigger,
        metadata: spec.metadata,
      });
      created = false;
    } else {
      pipeline = await this.pipelines.create(spec);
      created = true;
    }

    let build = null;
    if (manifest.autoDeploy !== false) {
      build = await this.builds.create({
        pipelineId: pipeline.id,
        customerId,
        trigger: { type: 'manifest', by: userEmail || null },
      });
    }

    return {
      created,
      pipeline: redactSource(pipeline),
      build: build ? { id: build.id, status: build.status } : null,
      domain: manifest.domain,
      warnings,
    };
  }

  async _findByName(customerId, name) {
    // list() is paged; walk until we find the name or run out. Customers
    // have tens of pipelines, not thousands, so this stays cheap.
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const page = await this.pipelines.list({ customerId, limit: pageSize, offset });
      const items = Array.isArray(page) ? page : page.items || [];
      const hit = items.find((p) => p.name === name);
      if (hit) return hit;
      if (items.length < pageSize) return null;
    }
  }
}

/**
 * Join repo-relative path segments, refusing anything that escapes the clone.
 * Without this, `rootDir: "../../etc"` would let a manifest reach outside its
 * own workspace when the build runs.
 */
function safeSubPath(...parts) {
  const usable = parts.filter((p) => p !== undefined && p !== null && p !== '').map(String);
  const joined = path.posix.join(...(usable.length ? usable : ['.']));
  const normalized = path.posix.normalize(joined);
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
    throw bad(`path "${joined}" must stay inside the repository`);
  }
  return normalized;
}

/**
 * Turn a manifest name into a DNS label: lowercase, alphanumerics and single
 * hyphens, no leading/trailing hyphen, capped at 40 chars to leave room for a
 * numeric suffix inside the 63-char label limit.
 */
function slugifyName(name) {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug || 'app';
}

function pruneUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// Never echo a repo token back to the caller.
function redactSource(pipeline) {
  if (!pipeline || !pipeline.source || !pipeline.source.token) return pipeline;
  return {
    ...pipeline,
    source: { ...pipeline.source, token: '[redacted]' },
  };
}

module.exports = ManifestService;
module.exports.MANIFEST_SCHEMA = MANIFEST_SCHEMA;
