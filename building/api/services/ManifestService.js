/**
 * SpinForge - declarative hosting manifest
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Turns a single declarative document ("spinforge.yaml") into the pipeline
 * that SpinForge already knows how to run. The manifest says which app to
 * deploy and where the code lives; everything else — domain, project type,
 * aliases — is read from the app record, so there is one source of truth.
 *
 * The manifest is a POINTER, never a creator. Apps are created in the
 * control panel, which is the single place quotas, reserved names and domain
 * assignment are enforced. A manifest that names an app you do not own is
 * rejected, so it cannot be used to claim a subdomain.
 *
 * `appId` is opaque and stable. Changing an app's domain updates the app
 * record and the app:<appId> pointer; the committed manifest is untouched.
 *
 * The manifest deliberately does NOT carry the stage list. Stage wiring is
 * derived from the app's type so manifests keep working when the action
 * catalog changes.
 *
 * Applying is idempotent per app: the first apply creates the pipeline,
 * later applies update it in place. Safe to run from CI on every push.
 */
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const yaml = require('js-yaml');
const path = require('path');

// Project types a manifest may declare, mapped to the pipeline `type`
// vocabulary in PipelineService (PIPELINE_TYPES).
// How static builds are produced. 'railpack' detects the toolchain and
// builds via BuildKit (any package manager, correct output dir, warm
// layer cache); 'command' runs the hardcoded npm build. Platform-wide
// switch so it can be rolled forward or back without touching manifests.
const BUILD_MODE_DEFAULT = process.env.BUILD_DEFAULT_MODE || 'command';

const TYPE_TO_PIPELINE_TYPE = {
  static: 'static-site',
  node: 'node-service',
  container: 'container',
};

const MANIFEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['appId', 'repo'],
  properties: {
    // The app this repo deploys to. Created in the control panel first —
    // that is where quotas, reserved names and domain assignment are
    // enforced, so a manifest can only ever point at an app you already own
    // and can never mint a domain.
    //
    // Opaque and stable: renaming the app's domain does not change appId, so
    // the committed manifest keeps working without an edit.
    appId: { type: 'string', pattern: '^app_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' },
    // Editors resolve `$schema` to offer completion and inline validation.
    // Ignored by the server, but it must be allowed through or every
    // schema-aware manifest would fail additionalProperties.
    $schema: { type: 'string' },
    // Free-form notes. Accepts a string or a list of lines so the shipped
    // templates can carry usage comments in JSON, which has no comments.
    $comment: {
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
    // Subdirectory within the repo holding this project. For monorepos:
    // the repo is cloned whole, then the build runs from here and output
    // paths resolve relative to it.
    rootDir: { type: 'string', default: '.' },
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
              rootDir: root,
              // Railpack detects the package manager, toolchain version
              // and output directory per project; the command/outputDir
              // above are the fallback when it's switched off.
              mode: BUILD_MODE_DEFAULT,
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
   * Resolve the app a manifest points at, and prove the caller owns it.
   *
   * `app:<appId>` holds the app's current domain; the site record under
   * `site:<domain>` holds everything else. Two hops rather than one so a
   * domain change only rewrites the pointer, leaving committed manifests
   * valid.
   *
   * A missing app and an app owned by someone else return the SAME error.
   * Distinguishing them would make this endpoint an oracle for probing which
   * appIds exist.
   */
  async resolveApp(appId, { customerId } = {}) {
    if (!this.redis) throw bad('app lookup unavailable');

    const notFound = () => {
      const err = bad(
        `app ${appId} not found, or not owned by this account — create the ` +
        `app in your dashboard and download its manifest`
      );
      err.status = 404;
      err.code = 'app_not_found';
      return err;
    };

    const domain = await this.redis.get(`app:${appId}`);
    if (!domain) throw notFound();

    const raw = await this.redis.get(`site:${domain}`);
    if (!raw) throw notFound();

    let site;
    try { site = JSON.parse(raw); } catch (_) { throw notFound(); }
    if (!site.customerId || site.customerId !== customerId) throw notFound();

    return { appId, domain, site };
  }

  /**
   * Create or update the pipeline described by a manifest, optionally
   * kicking off a build. `customerId` and `userEmail` come from the
   * authenticated sfc_ token, never from the manifest body.
   */
  /**
   * Work out what a manifest would do, without doing it.
   *
   * Everything up to the first write lives here so `apply()` and the
   * /manifest/validate dry run share one implementation. They drifted once
   * already — validate went on calling a resolver that had been renamed and
   * 500'd on every request — and a dry run that computes its answer
   * separately from the real path is worse than no dry run at all.
   */
  async plan(rawManifest, { customerId } = {}) {
    if (!customerId) throw bad('customerId is required to read a manifest');

    const manifest = this.normalize(rawManifest);
    const warnings = [];

    // Resolve the app first — this both finds the domain and proves the
    // caller owns it. Nothing else runs until that passes.
    const { appId, domain, site } = await this.resolveApp(manifest.appId, { customerId });

    // Project type comes from the app record, not the manifest, so the two
    // can never disagree.
    const type = TYPE_TO_PIPELINE_TYPE[site.type] ? site.type : 'static';
    if (!TYPE_TO_PIPELINE_TYPE[site.type]) {
      warnings.push(`app type "${site.type}" is not buildable from a manifest; treating as static`);
    }

    const stages = this.toStages({ ...manifest, type, domain, aliases: site.aliases || [] });
    const missing = this.unsupportedStages(stages);
    if (missing.length) {
      warnings.push(
        `no handler registered for: ${missing.join(', ')} — ` +
        `these stages will be skipped and nothing will be deployed`
      );
    }

    return { manifest, appId, domain, site, type, stages, unsupported: missing, warnings };
  }

  async apply(rawManifest, { customerId, userEmail } = {}) {
    if (!customerId) throw bad('customerId is required to apply a manifest');

    const { manifest, appId, domain, type, stages, warnings } =
      await this.plan(rawManifest, { customerId });

    // Pipelines are keyed on the app, so re-applying updates in place even
    // if the app's domain changed since the last deploy.
    const existing = await this._findByName(customerId, appId);

    const spec = {
      customerId,
      name: appId,
      type: TYPE_TO_PIPELINE_TYPE[type],
      source: pruneUndefined({
        type: 'git',
        url: manifest.repo.url,
        ref: manifest.repo.ref,
        token: manifest.repo.token,
      }),
      stages,
      trigger: { type: 'manifest' },
      metadata: pruneUndefined({
        appId,
        domain,
        appType: type,
        rootDir: manifest.rootDir,
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
      appId,
      domain,
      url: `https://${domain}`,
      pipeline: redactSource(pipeline),
      build: build ? { id: build.id, status: build.status } : null,
      warnings,
    };
  }

  async _findByName(customerId, name) {
    // list() is paged; walk until we find the name or run out. Customers
    // have tens of pipelines, not thousands, so this stays cheap.
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const page = await this.pipelines.list({ customerId, limit: pageSize, offset });
      // PipelineService.list returns { pipelines, total }. This read `items`,
      // which is always undefined — so the lookup found nothing, every apply
      // took the "create" branch, and re-running a manifest piled up a new
      // pipeline per push instead of updating one.
      const items = Array.isArray(page) ? page : (page.pipelines || page.items || []);
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
