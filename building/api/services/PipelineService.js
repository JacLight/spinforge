/**
 * PipelineService — CRUD on pipeline definitions.
 *
 * A pipeline is a saved ordered list of stages; each stage references an
 * action from the ActionRegistry and carries inputs that will be merged
 * with the action's declared defaults at build time. Pipelines are
 * customer-owned and versioned by update timestamp — a build captures
 * the pipeline snapshot it ran against so later edits don't rewrite
 * history.
 *
 * KeyDB layout:
 *   pipeline:<id>                   JSON pipeline record
 *   pipelines:recent                ZSET score=updatedAt, value=id (global)
 *   customer:<cid>:pipelines        ZSET per customer
 *   pipeline:<id>:builds            ZSET score=startedAt, value=buildId
 *                                   (populated by BuildService, not here)
 */

const { ulid } = require('ulid');

class PipelineService {
  constructor(redis, { logger, actions, events } = {}) {
    this.redis = redis;
    this.logger = logger || console;
    this.actions = actions; // ActionRegistry
    this.events = events || null;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────

  async create({ customerId, name, type, source, stages = [], trigger, metadata = {} } = {}) {
    if (!customerId) throw bad('customerId required');
    if (!name) throw bad('name required');

    const normalizedType = normalizeType(type);
    const normalizedSource = normalizeSource(source);

    const validation = this.validateStages(stages);
    if (!validation.valid) throw badWithDetails('pipeline validation failed', validation.errors);

    const id = 'pl_' + ulid();
    const now = new Date().toISOString();
    const record = {
      id,
      customerId,
      name,
      type: normalizedType,
      source: normalizedSource,
      stages: normalizeStages(stages),
      trigger: trigger || { type: 'manual' },
      metadata,
      createdAt: now,
      updatedAt: now,
    };

    await this.redis.set(`pipeline:${id}`, JSON.stringify(record));
    const score = Date.now();
    await this.redis.zAdd('pipelines:recent', { score, value: id });
    await this.redis.zAdd(`customer:${customerId}:pipelines`, { score, value: id });

    if (this.events) {
      this.events.publish('pipeline.created', id, {
        context: { customerId, name, type: record.type, stageCount: record.stages.length },
      }).catch(() => {});
    }
    return record;
  }

  async update(id, patch = {}) {
    const current = await this.get(id);
    if (!current) throw notFound('pipeline_not_found');

    // Only specific fields are user-editable; customerId is frozen.
    const next = { ...current };
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.type !== undefined) next.type = normalizeType(patch.type);
    if (patch.source !== undefined) next.source = normalizeSource(patch.source);
    if (patch.stages !== undefined) {
      const validation = this.validateStages(patch.stages);
      if (!validation.valid) throw badWithDetails('pipeline validation failed', validation.errors);
      next.stages = normalizeStages(patch.stages);
    }
    if (patch.trigger !== undefined) next.trigger = patch.trigger;
    if (patch.metadata !== undefined) next.metadata = patch.metadata;
    next.updatedAt = new Date().toISOString();

    await this.redis.set(`pipeline:${id}`, JSON.stringify(next));
    // Bump recency so recently-edited pipelines float to the top.
    const score = Date.now();
    await this.redis.zAdd('pipelines:recent', { score, value: id });
    await this.redis.zAdd(`customer:${next.customerId}:pipelines`, { score, value: id });

    if (this.events) {
      this.events.publish('pipeline.updated', id, {
        context: { customerId: next.customerId, name: next.name },
      }).catch(() => {});
    }
    return next;
  }

  async get(id) {
    const raw = await this.redis.get(`pipeline:${id}`);
    return raw ? JSON.parse(raw) : null;
  }

  async delete(id) {
    const current = await this.get(id);
    if (!current) return false;
    await this.redis.del(`pipeline:${id}`);
    await this.redis.zRem('pipelines:recent', id);
    await this.redis.zRem(`customer:${current.customerId}:pipelines`, id);
    // Note: build records + their streams are intentionally kept — audit
    // trail of a now-deleted pipeline is still valuable. Caller can hard-
    // purge via a separate admin route if needed.
    if (this.events) {
      this.events.publish('pipeline.deleted', id, {
        context: { customerId: current.customerId },
      }).catch(() => {});
    }
    return true;
  }

  async list({ customerId = null, limit = 50, offset = 0 } = {}) {
    const indexKey = customerId ? `customer:${customerId}:pipelines` : 'pipelines:recent';
    const total = await this.redis.zCard(indexKey);
    const ids = await this.redis.zRange(
      indexKey,
      -(offset + limit),
      -(offset + 1),
      { REV: true }
    );
    const pipelines = [];
    for (const id of ids) {
      const p = await this.get(id);
      if (p) pipelines.push(p);
    }
    return { pipelines, total };
  }

  // ─── Validation ───────────────────────────────────────────────────────

  /**
   * Validate an array of stage definitions against the action catalog.
   * Returns { valid, errors } shaped for AI repair:
   *   errors: [{ stageIndex, stageId, path, code, message }, ...]
   *
   * Checks:
   *   - each stage references a known action id
   *   - stage ids are unique within the pipeline
   *   - `needs` references exist (DAG integrity)
   *   - inputs satisfy the action's input schema
   */
  validateStages(stages) {
    if (!Array.isArray(stages)) {
      return { valid: false, errors: [{ path: '/stages', code: 'type', message: 'stages must be an array' }] };
    }
    const errors = [];
    const idsSeen = new Set();

    stages.forEach((stage, i) => {
      if (!stage || typeof stage !== 'object') {
        errors.push({ stageIndex: i, path: `/stages/${i}`, code: 'type', message: 'stage must be an object' });
        return;
      }
      if (!stage.id) {
        errors.push({ stageIndex: i, path: `/stages/${i}/id`, code: 'required', message: 'stage.id is required' });
      } else if (idsSeen.has(stage.id)) {
        errors.push({ stageIndex: i, stageId: stage.id, path: `/stages/${i}/id`, code: 'unique', message: `duplicate stage id "${stage.id}"` });
      } else {
        idsSeen.add(stage.id);
      }
      if (!stage.action) {
        errors.push({ stageIndex: i, stageId: stage.id, path: `/stages/${i}/action`, code: 'required', message: 'stage.action is required' });
        return;
      }

      const action = this.actions.get(actionBaseId(stage.action));
      if (!action) {
        errors.push({
          stageIndex: i, stageId: stage.id,
          path: `/stages/${i}/action`, code: 'unknown',
          message: `unknown action "${stage.action}" — GET /api/actions for the catalog`,
        });
        return;
      }

      // Disabled stages are legal even if their inputs are incomplete —
      // the user is staging a recipe and hasn't filled everything in yet.
      // We still validated id-uniqueness and that the action id is known
      // above; needs/inputs checks are what we skip.
      const stageEnabled = stage.enabled !== false;
      if (!stageEnabled) return;

      // Needs: must reference earlier stage ids.
      if (stage.needs !== undefined) {
        if (!Array.isArray(stage.needs)) {
          errors.push({ stageIndex: i, stageId: stage.id, path: `/stages/${i}/needs`, code: 'type', message: 'needs must be an array' });
        } else {
          for (const needId of stage.needs) {
            if (!idsSeen.has(needId)) {
              errors.push({
                stageIndex: i, stageId: stage.id,
                path: `/stages/${i}/needs`, code: 'reference',
                message: `needs "${needId}" does not refer to an earlier stage (DAGs only, no forward refs)`,
              });
            }
          }
        }
      }

      // Inputs: schema validate against the action's declared inputs.
      const res = this.actions.validateInputs(action.id, stage.with || {});
      if (!res.valid) {
        for (const e of res.errors) {
          errors.push({
            stageIndex: i, stageId: stage.id, actionId: action.id,
            path: `/stages/${i}/with${e.path}`,
            code: e.code, message: e.message, params: e.params,
          });
        }
      }
    });

    return { valid: errors.length === 0, errors };
  }
}

// Accept both `"build.node"` and `"build.node@1.0"` in stage specs. Pin
// is recorded on the normalized record; lookup is by base id for now
// (single-version catalog).
function actionBaseId(ref) {
  return String(ref).split('@')[0];
}
function actionPin(ref) {
  const parts = String(ref).split('@');
  return parts[1] || null;
}

function normalizeStages(stages) {
  return stages.map((s) => ({
    id: s.id,
    name: s.name || s.id,
    action: actionBaseId(s.action),
    actionVersion: actionPin(s.action),
    with: s.with || {},
    needs: Array.isArray(s.needs) ? s.needs.slice() : [],
    // `enabled` defaults to true. A pipeline stage that's toggled off in
    // the editor is persisted but skipped at build time — same shape as
    // Jenkins stage skip / CircleCI `when: false`.
    enabled: s.enabled !== false,
    continueOnError: !!s.continueOnError,
    timeoutSec: typeof s.timeoutSec === 'number' ? s.timeoutSec : null,
  }));
}

const PIPELINE_TYPES = new Set([
  'static-site', 'node-service', 'ios-app', 'android-app', 'container', 'custom',
]);

function normalizeType(t) {
  if (t == null || t === '') return 'custom';
  if (!PIPELINE_TYPES.has(t)) {
    throw bad(`invalid pipeline type "${t}" — expected one of: ${[...PIPELINE_TYPES].join(', ')}`);
  }
  return t;
}

function normalizeSource(src) {
  // Default source: zip upload (no pipeline-level config needed). This
  // matches the pre-redesign behavior where every pipeline accepted an
  // uploaded workspace.zip.
  if (src == null) return { type: 'zip' };
  if (typeof src !== 'object') throw bad('source must be an object');
  const type = src.type || 'zip';
  if (type !== 'git' && type !== 'zip') {
    throw bad(`invalid source.type "${type}" — expected "git" or "zip"`);
  }
  if (type === 'zip') return { type: 'zip' };
  // git: url required; ref/depth/token optional with sane defaults.
  if (!src.url || typeof src.url !== 'string') {
    throw bad('source.url is required when source.type is "git"');
  }
  const out = {
    type: 'git',
    url: src.url,
    ref: src.ref || 'main',
    depth: Number.isInteger(src.depth) && src.depth > 0 ? src.depth : 1,
  };
  // token is optional and should pass through as-is; we redact on emit.
  if (src.token) out.token = String(src.token);
  return out;
}

function bad(msg) {
  return Object.assign(new Error(msg), { status: 400, expose: true });
}
function badWithDetails(msg, details) {
  return Object.assign(new Error(msg), { status: 400, expose: true, details });
}
function notFound(msg) {
  return Object.assign(new Error(msg), { status: 404, expose: true });
}

module.exports = PipelineService;
