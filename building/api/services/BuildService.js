/**
 * BuildService — executes a Pipeline as a Build.
 *
 * Relationship to the older JobService / DeploymentService:
 *   Jobs = single Nomad batch run (still used for plain `POST /api/jobs`).
 *   Deployments = hardcoded build+deploy pair (kept for existing static
 *                 demos — do not touch).
 *   Builds = general N-stage execution of a Pipeline. This is the
 *            model we're moving toward.
 *
 * KeyDB layout:
 *   build:<id>                              JSON record (stage-by-stage state)
 *   build:<id>:events                       stream — build-level lifecycle
 *   build:<id>:stage:<stageId>:events       stream — per-stage structured events
 *   build:<id>:stage:<stageId>:log          stream — per-stage stdout/stderr
 *   build:<id>:stage:<stageId>:output       JSON — resolved outputs, for retry/resume
 *   builds:recent                           ZSET global
 *   pipeline:<pid>:builds                   ZSET per pipeline
 *   customer:<cid>:builds                   ZSET per customer
 *
 * Handler contract (runner.kind === 'inproc'):
 *   async handler({ build, stage, inputs, workspace, logger, emit, log })
 *     → returns the outputs object (validated against action.outputs
 *       schema before being committed).
 *   `emit(level, phase, message, ctx)` writes a structured event.
 *   `log(line, stream='stdout')` appends a raw log line.
 *
 * Handler contract (runner.kind === 'nomad' | 'mac-runner'):
 *   For this cut, these are stubbed — BuildService marks the stage as
 *   `skipped_unimplemented` with a clear reason. The executor shape is
 *   the same, so wiring them in later is mechanical.
 */

const { ulid } = require('ulid');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const pexecFile = promisify(execFile);

const STAGE_EVENTS_MAXLEN = 2000;
const STAGE_LOG_MAXLEN = 10_000;
const BUILD_EVENTS_MAXLEN = 2000;

const STAGE_TERMINAL = new Set(['succeeded', 'failed', 'skipped', 'skipped_unimplemented']);
const BUILD_TERMINAL = new Set(['succeeded', 'failed', 'canceled']);

class BuildService {
  constructor(redis, { logger, events, pipelines, actions, handlers } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this.events = events || null;
    this.pipelines = pipelines;
    this.actions = actions;
    // Action-id → async handler function. Supplied from outside so
    // tests can inject stubs and server.js can wire real ones.
    this.handlers = handlers || new Map();
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────

  async create({ pipelineId, trigger = { type: 'manual' }, inputs = {}, customerId } = {}) {
    if (!pipelineId) throw bad('pipelineId required');
    const pipeline = await this.pipelines.get(pipelineId);
    if (!pipeline) throw notFound('pipeline_not_found');

    const id = 'b_' + ulid();
    const now = new Date().toISOString();
    const workspace = path.join(
      process.env.BUILD_WORKSPACE_ROOT || process.env.WORKSPACE_ROOT || '/data/workspaces',
      'builds',
      id,
    );

    // Snapshot the pipeline's stages into the build. Later edits to the
    // pipeline don't rewrite this build's record — audit trail stays
    // pinned to what actually ran.
    const stages = pipeline.stages.map((s) => ({
      id: s.id,
      name: s.name,
      action: s.action,
      actionVersion: s.actionVersion || null,
      with: s.with || {},
      needs: s.needs || [],
      enabled: s.enabled !== false,
      continueOnError: !!s.continueOnError,
      timeoutSec: s.timeoutSec || null,
      // Execution state
      status: 'pending',
      attempt: 0,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      outputs: null,
      error: null,
    }));

    const record = {
      id,
      pipelineId,
      customerId: customerId || pipeline.customerId,
      pipelineSnapshot: {
        name: pipeline.name,
        updatedAt: pipeline.updatedAt,
        // Freeze type + source onto the build too — retries and audit
        // should use the source that was in effect at dispatch time,
        // not whatever the pipeline looks like now.
        type: pipeline.type || 'custom',
        source: pipeline.source || { type: 'zip' },
      },
      // Hoist source to the top level for convenient access in _populateSource
      // without reaching into the snapshot each time.
      source: pipeline.source || { type: 'zip' },
      type: pipeline.type || 'custom',
      trigger,
      inputs,            // build-level inputs, referenceable as ${inputs.foo}
      workspace,
      stages,
      status: 'queued',
      createdAt: now,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
    };

    await this.redis.set(`build:${id}`, JSON.stringify(record));
    const score = Date.now();
    await this.redis.zAdd('builds:recent', { score, value: id });
    await this.redis.zAdd(`pipeline:${pipelineId}:builds`, { score, value: id });
    await this.redis.zAdd(`customer:${record.customerId}:builds`, { score, value: id });

    await this._emitBuild(id, 'build.created', {
      pipelineId, customerId: record.customerId, trigger: trigger.type,
    });

    // Drive it forward. Fire-and-forget: the route returns the queued
    // record and the executor logs each stage to KeyDB streams.
    this._execute(id).catch((err) => {
      this.logger.error(`[build ${id}] executor crashed: ${err.message}`);
    });
    return record;
  }

  async get(id) {
    const raw = await this.redis.get(`build:${id}`);
    return raw ? JSON.parse(raw) : null;
  }

  async list({ customerId = null, pipelineId = null, status = null, limit = 50, offset = 0 } = {}) {
    const indexKey = pipelineId
      ? `pipeline:${pipelineId}:builds`
      : customerId
        ? `customer:${customerId}:builds`
        : 'builds:recent';
    const total = await this.redis.zCard(indexKey);
    const ids = await this.redis.zRange(
      indexKey,
      -(offset + limit),
      -(offset + 1),
      { REV: true }
    );
    const builds = [];
    for (const id of ids) {
      const b = await this.get(id);
      if (!b) continue;
      if (status && b.status !== status) continue;
      builds.push(b);
    }
    return { builds, total };
  }

  // ─── Execution ────────────────────────────────────────────────────────

  async _execute(id) {
    const build = await this.get(id);
    if (!build) return;
    if (BUILD_TERMINAL.has(build.status)) return;

    await fs.mkdir(build.workspace, { recursive: true });

    await this._patchBuild(id, {
      status: 'running',
      startedAt: build.startedAt || new Date().toISOString(),
    });
    await this._emitBuild(id, 'build.running', { workspace: build.workspace });

    // Populate workspace from pipeline source BEFORE any stage runs. If
    // this fails the build fails outright — stages depend on a
    // populated workspace and retrying source is a build-level concern,
    // not a stage concern.
    try {
      await this._populateSource(id);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      await this._emitBuild(id, 'source.failed', {
        type: build.source?.type || 'unknown',
        error: msg,
      });
      const completedAt = new Date().toISOString();
      const durationMs = build.startedAt ? new Date(completedAt) - new Date(build.startedAt) : null;
      await this._patchBuild(id, {
        status: 'failed',
        completedAt,
        durationMs,
        error: `source_failed: ${msg}`,
      });
      return;
    }

    // Mark disabled stages up-front so the DAG scan never considers
    // them. Disabled stages are transparently bypassed — downstream
    // `needs` that reference a disabled stage will observe status
    // `skipped_disabled` and be skipped themselves (since their input
    // templates against ${stages.<disabled>.outputs.*} won't resolve).
    for (const stage of build.stages) {
      if (stage.enabled === false && stage.status === 'pending') {
        await this._markStage(id, stage.id, {
          status: 'skipped',
          error: 'stage disabled in pipeline config',
          completedAt: new Date().toISOString(),
        });
        await this._emitStage(id, stage.id, 'warn', 'stage.disabled',
          'stage skipped — toggled off in the pipeline config',
          { enabled: false });
      }
    }

    // Simple DAG executor — repeated scans picking up stages whose needs
    // are all satisfied. Stops when no stage made progress and something
    // is still pending (means a cycle or a missed dependency, treat as
    // build failure). Concurrency left at 1 for the first cut; going
    // parallel later is safe because stages write to disjoint workspace
    // subdirs keyed by stageId.
    let progressed = true;
    while (progressed) {
      progressed = false;
      const current = await this.get(id);
      if (!current) return;
      if (BUILD_TERMINAL.has(current.status)) return;

      for (const stage of current.stages) {
        if (stage.status !== 'pending') continue;
        if (stage.enabled === false) continue; // already marked skipped

        // Disabled dependencies are treated as transparently bypassed —
        // they count as "satisfied" so downstream stages that don't
        // actually reference the skipped stage's outputs still run. If
        // they DO reference outputs they'll fail post-resolution schema
        // validation, which is the correct signal to the user.
        const needsMet = stage.needs.every((n) => {
          const dep = current.stages.find((s) => s.id === n);
          if (!dep) return false;
          if (dep.enabled === false) return true;
          return dep.status === 'succeeded';
        });
        const needsFailed = stage.needs.some((n) => {
          const dep = current.stages.find((s) => s.id === n);
          if (!dep || dep.enabled === false) return false;
          return dep.status === 'failed';
        });
        const needsSkippedNonDisabled = stage.needs.some((n) => {
          const dep = current.stages.find((s) => s.id === n);
          if (!dep || dep.enabled === false) return false;
          return dep.status === 'skipped';
        });
        if (needsFailed || needsSkippedNonDisabled) {
          await this._markStage(id, stage.id, {
            status: 'skipped',
            error: 'upstream dependency failed or was skipped',
            completedAt: new Date().toISOString(),
          });
          await this._emitStage(id, stage.id, 'error', 'schedule', 'stage skipped — upstream dependency failed');
          progressed = true;
          continue;
        }
        if (!needsMet) continue;

        progressed = true;
        await this._runStage(id, stage.id);
      }
    }

    // Build outcome
    const final = await this.get(id);
    if (!final) return;
    const anyFailed = final.stages.some((s) => s.status === 'failed' && !s.continueOnError);
    const anyPending = final.stages.some((s) => !STAGE_TERMINAL.has(s.status));
    let outcome;
    if (anyFailed) outcome = 'failed';
    else if (anyPending) outcome = 'failed'; // cycle / deadlock
    else outcome = 'succeeded';

    const completedAt = new Date().toISOString();
    const durationMs = final.startedAt ? new Date(completedAt) - new Date(final.startedAt) : null;
    await this._patchBuild(id, {
      status: outcome,
      completedAt,
      durationMs,
      error: outcome === 'failed' && anyPending && !anyFailed
        ? 'dag_deadlock: no runnable stages but some remained pending (check stage.needs)'
        : null,
    });
    await this._emitBuild(id, `build.${outcome}`, {
      durationMs,
      stageCount: final.stages.length,
      failedStages: final.stages.filter((s) => s.status === 'failed').map((s) => s.id),
    });
  }

  async _runStage(buildId, stageId) {
    const buildBefore = await this.get(buildId);
    const stage = buildBefore.stages.find((s) => s.id === stageId);
    const action = this.actions.get(stage.action);
    if (!action) {
      await this._markStage(buildId, stageId, {
        status: 'failed',
        error: `unknown action ${stage.action}`,
        completedAt: new Date().toISOString(),
      });
      await this._emitStage(buildId, stageId, 'error', 'schedule', `unknown action ${stage.action}`);
      return;
    }

    const startedAt = new Date().toISOString();
    await this._markStage(buildId, stageId, {
      status: 'running',
      startedAt,
      attempt: (stage.attempt || 0) + 1,
    });
    await this._emitStage(buildId, stageId, 'info', 'start', `stage started — action ${action.id}@${action.version}`, {
      action: action.id, version: action.version, attempt: (stage.attempt || 0) + 1,
    });

    // Resolve ${stages.X.outputs.Y} and ${inputs.Z} placeholders.
    const resolvedInputs = resolveTemplates(stage.with || {}, {
      inputs: buildBefore.inputs,
      stages: stagesAsContext(buildBefore.stages),
      build: { id: buildId, workspace: buildBefore.workspace },
    });

    // Re-validate against the action schema post-resolution. Catches
    // the case where a template resolved to undefined or the wrong type.
    const validation = this.actions.validateInputs(action.id, resolvedInputs);
    if (!validation.valid) {
      const msg = validation.errors.map((e) => `${e.path} · ${e.code} · ${e.message}`).join('; ');
      await this._markStage(buildId, stageId, {
        status: 'failed',
        error: `input validation failed after template resolution: ${msg}`,
        completedAt: new Date().toISOString(),
      });
      await this._emitStage(buildId, stageId, 'error', 'validate', 'post-resolution input validation failed', {
        errors: validation.errors, resolved: resolvedInputs,
      });
      return;
    }

    let outputs = null;
    let errorMsg = null;
    try {
      const handler = this.handlers.get(action.id);
      if (!handler) {
        // Kind-based fallback for actions we haven't wired a concrete
        // handler for yet. Explicit unimplemented > silent success.
        await this._markStage(buildId, stageId, {
          status: 'skipped_unimplemented',
          completedAt: new Date().toISOString(),
          error: `no handler registered for action ${action.id} (kind=${action.runner?.kind || 'unknown'})`,
        });
        await this._emitStage(buildId, stageId, 'warn', 'skip',
          `skipped — handler for ${action.id} not yet implemented`, { runnerKind: action.runner?.kind });
        return;
      }

      outputs = await handler({
        build: buildBefore,
        stage,
        inputs: resolvedInputs,
        workspace: path.join(buildBefore.workspace, stageId),
        logger: this.logger,
        emit: (level, phase, message, ctx) =>
          this._emitStage(buildId, stageId, level, phase, message, ctx),
        log: (line, streamName = 'stdout') =>
          this._appendStageLog(buildId, stageId, line, streamName),
      }) || {};
    } catch (err) {
      errorMsg = err && err.message ? err.message : String(err);
      await this._emitStage(buildId, stageId, 'error', 'execute', errorMsg, {
        stack: err && err.stack ? err.stack.split('\n').slice(0, 5) : undefined,
      });
    }

    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt) - new Date(startedAt);

    if (errorMsg) {
      await this._markStage(buildId, stageId, {
        status: 'failed',
        error: errorMsg,
        completedAt,
        durationMs,
      });
      return;
    }

    // Validate outputs — handler bugs shouldn't poison downstream stages.
    const ov = this.actions.validateOutputs(action.id, outputs);
    if (!ov.valid) {
      const msg = ov.errors.map((e) => `${e.path} · ${e.code} · ${e.message}`).join('; ');
      await this._markStage(buildId, stageId, {
        status: 'failed',
        error: `handler output did not match schema: ${msg}`,
        completedAt,
        durationMs,
      });
      await this._emitStage(buildId, stageId, 'error', 'validate',
        `handler output did not match declared schema for ${action.id}`, { errors: ov.errors, outputs });
      return;
    }

    await this.redis.set(`build:${buildId}:stage:${stageId}:output`, JSON.stringify(outputs));
    await this._markStage(buildId, stageId, {
      status: 'succeeded',
      outputs,
      completedAt,
      durationMs,
    });
    await this._emitStage(buildId, stageId, 'info', 'finish', `stage succeeded in ${durationMs}ms`, {
      outputs,
    });
  }

  // ─── Source population ────────────────────────────────────────────────
  //
  // Runs once per build, before any stage. Mirrors how Jenkins' "SCM
  // step" and Vercel's "clone source" run outside the pipeline steps —
  // the workspace is a precondition for everything else. Emits
  // `source.populated` on success, `source.failed` on error; source
  // failure fails the build without running any stage.

  async _populateSource(buildId) {
    const build = await this.get(buildId);
    if (!build) return;
    const source = build.source || { type: 'zip' };
    const workspace = build.workspace;
    await fs.mkdir(workspace, { recursive: true });

    if (source.type === 'zip') {
      // Expect a `workspace.zip` to have been placed under the build
      // workspace by the upload route. Once that route exists, this
      // branch will extract it; for now, we just verify presence or
      // emit a neutral "waiting for upload" signal.
      const zip = path.join(workspace, 'workspace.zip');
      if (!fsSync.existsSync(zip)) {
        throw new Error(`zip source: expected workspace.zip at ${zip} (upload route not yet wired; place the archive manually or switch the pipeline to git source)`);
      }
      // Extract in place — stages run under subdirs keyed by stageId,
      // so putting the unpacked project at the workspace root is fine.
      await pexecFile('unzip', ['-q', '-o', zip, '-d', workspace]);
      await this._emitBuild(buildId, 'source.populated', {
        type: 'zip', workspace, zipPath: zip,
      });
      return;
    }

    if (source.type === 'git') {
      const { url, ref = 'main', depth = 1, token } = source;
      if (!url) throw new Error('git source: url is required');
      // Splice token into the clone URL for private repos. We never log
      // the substituted URL and we redact on error.
      let cloneUrl = url;
      if (token && /^https?:/i.test(url)) {
        try {
          const u = new URL(url);
          u.username = token;
          cloneUrl = u.toString();
        } catch {
          // fall back to raw url if URL() can't parse it
          cloneUrl = url;
        }
      }
      const args = ['clone', '--depth', String(depth), '--single-branch'];
      if (ref && ref !== 'HEAD') args.push('--branch', ref);
      args.push(cloneUrl, workspace);

      let commit = '';
      try {
        await pexecFile('git', args, { timeout: 180_000 });
      } catch (err) {
        const detail = (err.stderr || err.message || '').toString();
        const redacted = token ? detail.split(token).join('***') : detail;
        throw new Error(`git clone failed: ${redacted.slice(0, 500)}`);
      }
      try {
        const { stdout } = await pexecFile('git', ['-C', workspace, 'rev-parse', 'HEAD']);
        commit = stdout.trim();
      } catch { /* non-fatal */ }

      await this._emitBuild(buildId, 'source.populated', {
        type: 'git', workspace, url, ref, commit,
      });
      return;
    }

    throw new Error(`unknown source.type "${source.type}"`);
  }

  // ─── Retry / Resume ───────────────────────────────────────────────────

  /**
   * Retry a single stage. Resets that stage (and any of its downstream
   * dependents) to `pending` and restarts the executor. Optional
   * `overrides` patches the stage's `with` inputs before rerun.
   */
  async retryStage(buildId, stageId, { overrides } = {}) {
    const build = await this.get(buildId);
    if (!build) throw notFound('build_not_found');
    const idx = build.stages.findIndex((s) => s.id === stageId);
    if (idx < 0) throw notFound('stage_not_found');

    // Stages to reset: the target + any that transitively need it.
    const resetIds = new Set([stageId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of build.stages) {
        if (resetIds.has(s.id)) continue;
        if ((s.needs || []).some((n) => resetIds.has(n))) {
          resetIds.add(s.id);
          grew = true;
        }
      }
    }

    build.stages = build.stages.map((s) => {
      if (!resetIds.has(s.id)) return s;
      const patch = {
        ...s,
        status: 'pending',
        startedAt: null, completedAt: null, durationMs: null,
        outputs: null, error: null,
      };
      if (s.id === stageId && overrides) {
        patch.with = { ...(s.with || {}), ...overrides };
      }
      return patch;
    });
    build.status = 'queued';
    build.completedAt = null;
    build.error = null;
    await this.redis.set(`build:${buildId}`, JSON.stringify(build));
    await this._emitBuild(buildId, 'build.retried', { stageId, resetIds: [...resetIds] });

    this._execute(buildId).catch((err) => {
      this.logger.error(`[build ${buildId}] retry executor crashed: ${err.message}`);
    });
    return build;
  }

  /** Continue a failed build from the first non-succeeded stage. */
  async resume(buildId) {
    const build = await this.get(buildId);
    if (!build) throw notFound('build_not_found');
    const firstBad = build.stages.find((s) => s.status !== 'succeeded' && s.status !== 'skipped');
    if (!firstBad) throw bad('nothing_to_resume');
    return this.retryStage(buildId, firstBad.id);
  }

  async cancel(buildId, { reason = 'canceled_by_user' } = {}) {
    const build = await this.get(buildId);
    if (!build) throw notFound('build_not_found');
    if (BUILD_TERMINAL.has(build.status)) return build;
    build.status = 'canceled';
    build.completedAt = new Date().toISOString();
    build.error = reason;
    for (const s of build.stages) {
      if (s.status === 'pending' || s.status === 'running') {
        s.status = 'skipped';
        s.completedAt = s.completedAt || build.completedAt;
        s.error = s.error || 'canceled';
      }
    }
    await this.redis.set(`build:${buildId}`, JSON.stringify(build));
    await this._emitBuild(buildId, 'build.canceled', { reason });
    return build;
  }

  // ─── Streams / events ────────────────────────────────────────────────

  async recentBuildEvents(id, limit = 200) {
    return xrev(this.redis, `build:${id}:events`, limit);
  }

  async recentStageEvents(buildId, stageId, limit = 200) {
    return xrev(this.redis, `build:${buildId}:stage:${stageId}:events`, limit);
  }

  async recentStageLog(buildId, stageId, limit = 500) {
    return xrev(this.redis, `build:${buildId}:stage:${stageId}:log`, limit);
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  async _patchBuild(id, patch) {
    const current = await this.get(id);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await this.redis.set(`build:${id}`, JSON.stringify(next));
  }

  async _markStage(buildId, stageId, patch) {
    const current = await this.get(buildId);
    if (!current) return;
    current.stages = current.stages.map((s) => s.id === stageId ? { ...s, ...patch } : s);
    current.updatedAt = new Date().toISOString();
    await this.redis.set(`build:${buildId}`, JSON.stringify(current));
  }

  async _emitBuild(id, type, context = {}) {
    try {
      await this.redis.xAdd(
        `build:${id}:events`, '*',
        { type, ts: new Date().toISOString(), context: safeJson(context) },
        { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: BUILD_EVENTS_MAXLEN } }
      );
    } catch (err) {
      this.logger.warn(`[build ${id}] emitBuild(${type}) failed: ${err.message}`);
    }
    if (this.events) {
      this.events.publish(type, id, { context }).catch(() => {});
    }
  }

  async _emitStage(buildId, stageId, level, phase, message, context = {}) {
    try {
      await this.redis.xAdd(
        `build:${buildId}:stage:${stageId}:events`, '*',
        {
          level: String(level),
          phase: String(phase),
          message: String(message || '').slice(0, 2000),
          ts: new Date().toISOString(),
          context: safeJson(context),
        },
        { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: STAGE_EVENTS_MAXLEN } }
      );
    } catch (err) {
      this.logger.warn(`[build ${buildId}/${stageId}] emitStage(${level},${phase}) failed: ${err.message}`);
    }
  }

  async _appendStageLog(buildId, stageId, line, streamName = 'stdout') {
    if (!line) return;
    try {
      await this.redis.xAdd(
        `build:${buildId}:stage:${stageId}:log`, '*',
        { stream: String(streamName), line: String(line).slice(0, 8000) },
        { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: STAGE_LOG_MAXLEN } }
      );
    } catch (err) {
      this.logger.warn(`[build ${buildId}/${stageId}] appendLog failed: ${err.message}`);
    }
  }
}

// ─── Template resolution ───────────────────────────────────────────────
//
// Supports "${path.into.ctx}" tokens anywhere inside strings or nested
// objects/arrays. Unknown paths resolve to undefined (which will be
// caught by the post-resolution schema validator — better to see a
// schema error than silently substitute empty string).

function resolveTemplates(node, ctx) {
  if (node == null) return node;
  if (typeof node === 'string') return resolveString(node, ctx);
  if (Array.isArray(node)) return node.map((v) => resolveTemplates(v, ctx));
  if (typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = resolveTemplates(v, ctx);
    return out;
  }
  return node;
}

function resolveString(str, ctx) {
  const TOKEN = /\$\{\s*([^}]+)\s*\}/g;
  // If the entire string is a single ${…}, return the raw value so
  // typed fields (numbers, arrays) stay typed.
  const m = str.match(/^\$\{\s*([^}]+)\s*\}$/);
  if (m) return lookup(m[1].trim(), ctx);
  return str.replace(TOKEN, (_, expr) => {
    const v = lookup(expr.trim(), ctx);
    return v === undefined || v === null ? '' : (typeof v === 'string' ? v : JSON.stringify(v));
  });
}

function lookup(expr, ctx) {
  const parts = expr.split('.');
  let cur = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function stagesAsContext(stages) {
  const out = {};
  for (const s of stages) {
    out[s.id] = { outputs: s.outputs || {}, status: s.status };
  }
  return out;
}

// ─── Stream helpers ───────────────────────────────────────────────────

async function xrev(redis, key, limit = 200) {
  try {
    const rows = await redis.xRevRange(key, '+', '-', { COUNT: limit });
    return (rows || []).map((r) => ({ id: r.id, ...r.message })).reverse();
  } catch { return []; }
}

function safeJson(obj) {
  try { return JSON.stringify(obj).slice(0, 4000); }
  catch { return '{}'; }
}

// ─── Errors ───────────────────────────────────────────────────────────

function bad(msg) { return Object.assign(new Error(msg), { status: 400, expose: true }); }
function notFound(msg) { return Object.assign(new Error(msg), { status: 404, expose: true }); }

module.exports = BuildService;
module.exports.STAGE_TERMINAL = STAGE_TERMINAL;
module.exports.BUILD_TERMINAL = BUILD_TERMINAL;
