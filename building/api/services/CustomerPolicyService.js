/**
 * SpinForge — customer policy service.
 *
 * One policy doc per customer at KeyDB key `customer:<id>:policy`.
 * This service is the only writer. Enforcement code elsewhere calls
 * get() at decision points.
 *
 * See building/docs/policy-schema.md for the canonical schema.
 */
const redis = require('../utils/redis');

const KEY = (id) => `customer:${id}:policy`;

const DEFAULT_POLICY = Object.freeze({
  build: {
    concurrentJobs: 1,
    maxJobDurationMin: 15,
    maxJobCpuMhz: 1000,
    maxJobMemoryMB: 2048,
    maxArtifactMB: 100,
    allowedPlatforms: ['web'],
    allowedRunnerClasses: ['lxc'],
    monthlyCpuSeconds: 20000,
    monthlyBuildMinutes: 600,
    // Retention knobs — read by bin/artifact-retention.js (not at dispatch time).
    // Counted in builds / hours, not MB, because the ceiling that matters is
    // "how many crashing debug builds is it worth keeping for" rather than
    // bytes. maxArtifactMB already caps per-job size.
    keepSuccessfulBuilds: 30,
    keepFailedBuildsHours: 24,
    workspaceRetentionHours: 2,
  },
  hosting: {
    maxSites: 3,
    maxCustomDomains: 0,
    maxSslCerts: 0,
    maxSigningProfiles: 0,
    concurrentContainers: 0,
    maxContainerMemoryMB: 256,
    maxContainerCpuMhz: 200,
    maxStaticStorageGB: 1,
    monthlyEgressGB: 10,
    monthlyRequestCount: 100000,
    requestsPerSecond: 10,
  },
  features: {
    signingProfiles: false,
    customDomains: false,
    macBuilds: false,
  },
});

async function get(customerId) {
  if (!customerId) throw new Error('customerId required');
  const raw = await redis.get(KEY(customerId));
  if (!raw) return structuredClone(DEFAULT_POLICY);
  try { return JSON.parse(raw); } catch { return structuredClone(DEFAULT_POLICY); }
}

async function put(customerId, policy) {
  if (!customerId) throw new Error('customerId required');
  validate(policy);                                   // throws on bad shape
  await redis.set(KEY(customerId), JSON.stringify(policy));
  return policy;
}

async function clear(customerId) {
  if (!customerId) throw new Error('customerId required');
  await redis.del(KEY(customerId));
}

function validate(policy) {
  // Minimal runtime check — ensures partners can't set negative quotas or
  // drop required sections. Full JSON Schema validation can layer on top.
  if (!policy || typeof policy !== 'object') throw new Error('policy must be an object');
  for (const section of ['build', 'hosting', 'features']) {
    if (policy[section] && typeof policy[section] !== 'object') {
      throw new Error(`${section} must be object`);
    }
  }
  const nonNeg = (v) => v == null || (typeof v === 'number' && v >= 0);

  if (policy.build) {
    for (const k of [
      'concurrentJobs',
      'maxJobDurationMin',
      'maxJobCpuMhz',
      'maxJobMemoryMB',
      'maxArtifactMB',
      'monthlyCpuSeconds',
      'monthlyBuildMinutes',
      'keepSuccessfulBuilds',
      'keepFailedBuildsHours',
      'workspaceRetentionHours',
    ]) {
      if (policy.build[k] != null && !nonNeg(policy.build[k])) {
        throw new Error(`build.${k} must be a non-negative number`);
      }
    }
    if (policy.build.allowedPlatforms != null && !Array.isArray(policy.build.allowedPlatforms)) {
      throw new Error('build.allowedPlatforms must be an array');
    }
    if (policy.build.allowedRunnerClasses != null && !Array.isArray(policy.build.allowedRunnerClasses)) {
      throw new Error('build.allowedRunnerClasses must be an array');
    }
  }

  if (policy.hosting) {
    for (const k of [
      'maxSites',
      'maxCustomDomains',
      'maxSslCerts',
      'maxSigningProfiles',
      'concurrentContainers',
      'maxContainerMemoryMB',
      'maxContainerCpuMhz',
      'maxStaticStorageGB',
      'monthlyEgressGB',
      'monthlyRequestCount',
      'requestsPerSecond',
    ]) {
      if (policy.hosting[k] != null && !nonNeg(policy.hosting[k])) {
        throw new Error(`hosting.${k} must be a non-negative number`);
      }
    }
  }

  if (policy.features) {
    for (const [k, v] of Object.entries(policy.features)) {
      if (v != null && typeof v !== 'boolean') {
        throw new Error(`features.${k} must be a boolean`);
      }
    }
  }

  return true;
}

/**
 * Decision helper used by the job POST handler.
 *
 * Centralises every pre-dispatch policy check so callers can treat it as
 * a one-liner. Returns either:
 *   { allowed: true, policy }                         — caller may proceed
 *   { allowed: false, status, error, ...details }     — caller should
 *                                                       respond with that
 *                                                       status + payload
 *
 * Checks (in order):
 *   1. allowedPlatforms       — manifest.platform must be listed
 *   2. allowedRunnerClasses   — platform → required runner class must be
 *                               listed (ios/macos → macos, else lxc)
 *   3. maxArtifactMB          — workspace size cap
 *   4. concurrentJobs         — SCARD customer:<id>:active
 *   5. monthlyCpuSeconds      — HGET customer:<id>:usage:<yyyymm> cpu_seconds
 *   6. monthlyBuildMinutes    — build_seconds / 60 from same hash
 *
 * Note: this function is read-only. It does NOT add to the active set;
 * the caller is responsible for that AFTER JobService.create succeeds
 * (so a failed create doesn't leak a slot).
 */
async function checkJobDispatch(customerId, manifest, workspaceBytes) {
  if (!customerId) throw new Error('customerId required');
  if (!manifest || typeof manifest !== 'object') throw new Error('manifest required');

  const policy = await get(customerId);
  const build = (policy && policy.build) || {};

  const platform = manifest.platform;
  if (Array.isArray(build.allowedPlatforms) && !build.allowedPlatforms.includes(platform)) {
    return {
      allowed: false,
      status: 403,
      error: 'platform_not_allowed',
      platform,
      allowed: build.allowedPlatforms,
    };
  }

  const requiredRunner = (platform === 'ios' || platform === 'macos') ? 'macos' : 'lxc';
  if (Array.isArray(build.allowedRunnerClasses) && !build.allowedRunnerClasses.includes(requiredRunner)) {
    return {
      allowed: false,
      status: 403,
      error: 'runner_class_not_allowed',
      required: requiredRunner,
      allowed: build.allowedRunnerClasses,
    };
  }

  if (build.maxArtifactMB != null && workspaceBytes != null) {
    const limitBytes = build.maxArtifactMB * 1024 * 1024;
    if (workspaceBytes > limitBytes) {
      return {
        allowed: false,
        status: 413,
        error: 'artifact_too_large',
        sizeBytes: workspaceBytes,
        limitBytes,
      };
    }
  }

  if (build.concurrentJobs != null) {
    const activeCount = await redis.sCard(`customer:${customerId}:active`);
    if (activeCount >= build.concurrentJobs) {
      return {
        allowed: false,
        status: 429,
        error: 'concurrent_jobs_exceeded',
        current: activeCount,
        limit: build.concurrentJobs,
      };
    }
  }

  if (build.monthlyCpuSeconds != null || build.monthlyBuildMinutes != null) {
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
    const usage = (await redis.hGetAll(`customer:${customerId}:usage:${yyyymm}`)) || {};

    if (build.monthlyCpuSeconds != null) {
      const cpu = parseInt(usage.cpu_seconds || '0', 10);
      if (cpu >= build.monthlyCpuSeconds) {
        return {
          allowed: false,
          status: 402,
          error: 'monthly_cpu_exceeded',
          knob: 'monthlyCpuSeconds',
          current: cpu,
          limit: build.monthlyCpuSeconds,
        };
      }
    }

    if (build.monthlyBuildMinutes != null) {
      const mins = parseInt(usage.build_seconds || '0', 10) / 60;
      if (mins >= build.monthlyBuildMinutes) {
        return {
          allowed: false,
          status: 402,
          error: 'monthly_build_minutes_exceeded',
          knob: 'monthlyBuildMinutes',
          currentMin: mins,
          limitMin: build.monthlyBuildMinutes,
        };
      }
    }
  }

  return { allowed: true, policy };
}

module.exports = { get, put, clear, DEFAULT_POLICY, validate, checkJobDispatch };
