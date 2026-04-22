const { PLATFORMS } = require('./constants');

/**
 * Validate + normalize a job manifest. Returns the normalized object or
 * throws an error with .status = 400 and a helpful message.
 *
 * Accepts both an object and a JSON string (multipart form fields arrive
 * as strings).
 */
function parseManifest(input) {
  let m = input;
  if (typeof m === 'string') {
    try {
      m = JSON.parse(m);
    } catch (err) {
      throw bad('manifest is not valid JSON');
    }
  }
  if (!m || typeof m !== 'object') throw bad('manifest is required');

  if (!m.customerId || typeof m.customerId !== 'string') {
    throw bad('manifest.customerId is required');
  }
  if (!m.platform || typeof m.platform !== 'string') {
    throw bad('manifest.platform is required');
  }
  if (!PLATFORMS.has(m.platform)) {
    throw bad(
      `manifest.platform "${m.platform}" is not supported. Known: ${[...PLATFORMS].join(', ')}`
    );
  }

  const targets = Array.isArray(m.targets) ? m.targets.map(String) : [];
  const framework = typeof m.framework === 'string' ? m.framework : null;
  const signingProfileId =
    typeof m.signingProfileId === 'string' ? m.signingProfileId : null;

  const buildCommand = typeof m.buildCommand === 'string' ? m.buildCommand : null;
  const outputDir = typeof m.outputDir === 'string' ? m.outputDir : null;
  const env = m.env && typeof m.env === 'object' ? sanitizeEnv(m.env) : {};

  // Optional project scoping. Matches Vibe Studio's .vibe/project.json
  // shape (orgId maps to our customerId, projectName → projectId).
  // Used for multi-level usage aggregation and customer dashboards.
  const projectId = typeof m.projectId === 'string'
    ? m.projectId
    : typeof m.projectName === 'string' ? m.projectName : null;

  return {
    customerId: m.customerId,
    projectId,
    platform: m.platform,
    targets,
    framework,
    signingProfileId,
    buildCommand,
    outputDir,
    env,
    source: typeof m.source === 'string' ? m.source : 'api',
  };
}

function sanitizeEnv(env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof k !== 'string') continue;
    if (!/^[A-Z][A-Z0-9_]*$/.test(k)) continue;
    out[k] = v == null ? '' : String(v).slice(0, 4_000);
  }
  return out;
}

function bad(message) {
  const err = new Error(message);
  err.status = 400;
  err.expose = true;
  return err;
}

module.exports = { parseManifest };
