/**
 * ActionRegistry — the catalog of primitive pipeline actions.
 *
 * An action is a named, versioned unit of work with a declared JSON
 * Schema for inputs and outputs. Pipelines compose actions; builds
 * execute them. The catalog lives in-process (seed file + runtime
 * register()), not in KeyDB — actions are code we ship, not customer
 * data.
 *
 * AI friendliness is load-bearing: customers will author pipelines with
 * an LLM, so every action is introspectable via GET /api/actions and
 * GET /api/actions/:id/schema. Validation errors carry the JSON Pointer
 * path so the LLM can repair its own output.
 *
 * Handlers are deliberately NOT stored here. Execution is a BuildService
 * concern — some actions run in-process on the api (file-shuffle, keydb
 * ops), some dispatch to Nomad (builds), some hit a signing runner
 * (mac). Keeping the catalog side effect-free means tests and
 * validation don't drag execution in.
 */
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: true });
addFormats(ajv);

class ActionRegistry {
  constructor({ logger } = {}) {
    this.logger = logger || console;
    this.byId = new Map();
    // Alias id → canonical id. get(alias) transparently redirects so
    // pipelines saved with a legacy action name (e.g. `host.static`)
    // keep working after we rename the canonical id (e.g.
    // `deploy.static-site`). Aliases are strictly name redirects — they
    // don't get their own entry in list().
    this.aliases = new Map();
  }

  /**
   * Register an action. Pass `aliases: string[]` on the action def to
   * record alternate ids that should resolve to this action. Registering
   * an alias that already points elsewhere overwrites silently — last
   * writer wins, deliberate for catalog hot-reload later.
   */
  register(action) {
    if (!action || !action.id) throw new Error('action.id is required');
    if (!action.version) throw new Error(`action ${action.id}: version is required`);
    if (!action.inputs) action.inputs = { type: 'object', additionalProperties: false, properties: {} };
    if (!action.outputs) action.outputs = { type: 'object', additionalProperties: true, properties: {} };

    // Pre-compile validators so repeated pipeline saves don't re-parse.
    try {
      action._validateInputs  = ajv.compile(action.inputs);
      action._validateOutputs = ajv.compile(action.outputs);
    } catch (err) {
      throw new Error(`action ${action.id}: schema compile failed: ${err.message}`);
    }

    this.byId.set(action.id, action);

    // Aliases: record each alternate → canonical so get() redirects.
    if (Array.isArray(action.aliases)) {
      for (const alias of action.aliases) {
        if (!alias || alias === action.id) continue;
        this.aliases.set(alias, action.id);
      }
    }
    return action;
  }

  get(id) {
    if (!id) return null;
    if (this.byId.has(id)) return this.byId.get(id);
    const canonical = this.aliases.get(id);
    if (canonical) return this.byId.get(canonical) || null;
    return null;
  }

  list() {
    // Shallow copy, strip compiled validator refs so this is JSON-safe.
    return Array.from(this.byId.values()).map(stripInternal);
  }

  /**
   * Validate a set of stage inputs against the action's input schema.
   * Returns { valid, errors } where errors are shaped for LLM repair:
   *   [{ path: '/bundleId', code: 'required', message: '...' }, ...]
   *
   * The caller is expected to have already resolved the action id; this
   * method throws if the id is unknown because that's an upstream bug.
   */
  validateInputs(actionId, inputs) {
    const action = this.get(actionId);
    if (!action) throw new Error(`unknown action: ${actionId}`);
    const ok = action._validateInputs(inputs || {});
    if (ok) return { valid: true, errors: [] };
    return { valid: false, errors: formatErrors(action._validateInputs.errors) };
  }

  validateOutputs(actionId, outputs) {
    const action = this.get(actionId);
    if (!action) throw new Error(`unknown action: ${actionId}`);
    const ok = action._validateOutputs(outputs || {});
    if (ok) return { valid: true, errors: [] };
    return { valid: false, errors: formatErrors(action._validateOutputs.errors) };
  }
}

function stripInternal(action) {
  // aliases is kept in the output — external callers may want to know
  // which ids resolve to this action.
  const { _validateInputs, _validateOutputs, ...rest } = action;
  return rest;
}

// AJV errors are verbose; flatten to what an AI (or a human) can act on.
function formatErrors(errors) {
  if (!Array.isArray(errors)) return [];
  return errors.map((e) => ({
    path: e.instancePath || '',
    code: e.keyword,
    message: e.message,
    params: e.params,
  }));
}

module.exports = ActionRegistry;
