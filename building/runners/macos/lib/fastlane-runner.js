/**
 * Thin wrapper around `fastlane <platform> <lane>` for the Mac runner.
 *
 * Streams stdout/stderr into the job's log stream via the state helper.
 * Never logs secrets — the Fastfile gets them from env, and we don't
 * mirror env into the log.
 */

const path = require('path');
const { spawn } = require('child_process');

const FASTLANE_BIN = process.env.SPINFORGE_FASTLANE_BIN || 'fastlane';

async function runLane({ platform, lane, cwd, env = {}, state, signal }) {
  return new Promise((resolve, reject) => {
    const child = spawn(FASTLANE_BIN, [platform, lane], {
      cwd,
      env: { ...process.env, ...env, FASTLANE_SKIP_UPDATE_CHECK: '1', FASTLANE_HIDE_CHANGELOG: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    pipeLines(child.stdout, 'stdout', state);
    pipeLines(child.stderr, 'stderr', state);

    const onAbort = () => { try { child.kill('SIGTERM'); } catch (_) {} };
    if (signal) signal.addEventListener('abort', onAbort);

    child.on('error', reject);
    child.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (code === 0) resolve({ code });
      else reject(new Error(`fastlane ${platform} ${lane} exited ${code}`));
    });
  });
}

function pipeLines(readable, label, state) {
  if (!readable) return;
  let buf = '';
  readable.setEncoding('utf8');
  readable.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      state.appendLog(label, redact(line)).catch(() => {});
    }
  });
  readable.on('end', () => {
    if (buf) state.appendLog(label, redact(buf)).catch(() => {});
  });
}

// Best-effort log scrubbing. Fastlane itself is pretty careful about
// not printing secrets, but cert passwords + JWTs occasionally sneak
// through. The redactor is intentionally aggressive — false positives
// on "password=..." are acceptable; leaked keys are not.
const REDACT_PATTERNS = [
  /(-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----)/g,
  /(Bearer\s+)[A-Za-z0-9_\-.]+/g,
  /(password[=:]\s*)\S+/gi,
  /(token[=:]\s*)\S+/gi,
  /(api[_-]?key[=:]\s*)\S+/gi,
];
function redact(line) {
  let out = line;
  for (const re of REDACT_PATTERNS) out = out.replace(re, '$1[REDACTED]');
  return out;
}

module.exports = { runLane };
