const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.spinforge-runner', 'config.json');

function loadConfig() {
  const configPath = process.env.SPINFORGE_RUNNER_CONFIG || DEFAULT_CONFIG_PATH;

  let fromFile = {};
  if (fs.existsSync(configPath)) {
    try {
      fromFile = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      throw new Error(`config at ${configPath} is not valid JSON: ${err.message}`);
    }
  }

  // Env wins over file; file wins over built-in defaults. Per the runbook
  // it's normal to keep secrets in env and non-secret params in the file.
  const cfg = {
    runnerId:
      process.env.SPINFORGE_RUNNER_ID || fromFile.runnerId || os.hostname(),
    redisUrl:
      process.env.SPINFORGE_REDIS_URL
      || fromFile.redisUrl
      || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 16378}/${process.env.REDIS_DB || 1}`,
    redisPassword:
      process.env.SPINFORGE_REDIS_PASSWORD
      || fromFile.redisPassword
      || process.env.REDIS_PASSWORD
      || '',
    apiUrl:
      process.env.SPINFORGE_API_URL
      || fromFile.apiUrl
      || 'http://localhost:8090',
    slots: Number(process.env.SPINFORGE_RUNNER_SLOTS || fromFile.slots || 1),
    capabilities:
      (process.env.SPINFORGE_RUNNER_CAPS && process.env.SPINFORGE_RUNNER_CAPS.split(','))
      || fromFile.capabilities
      || ['ios', 'macos'],
    scratchDir:
      process.env.SPINFORGE_SCRATCH_DIR
      || fromFile.scratchDir
      || path.join(os.homedir(), 'spinforge-scratch'),
    xcodePath:
      process.env.SPINFORGE_XCODE_PATH
      || fromFile.xcodePath
      || '/Applications/Xcode.app',
    tailscaleIp:
      process.env.SPINFORGE_TAILSCALE_IP || fromFile.tailscaleIp || null,
    heartbeatIntervalMs: Number(fromFile.heartbeatIntervalMs || 30_000),
    heartbeatTtlSec: Number(fromFile.heartbeatTtlSec || 90),
  };

  return cfg;
}

module.exports = { loadConfig, DEFAULT_CONFIG_PATH };
