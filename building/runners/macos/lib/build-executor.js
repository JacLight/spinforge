/**
 * Build executor — spawns child processes, pipes stdout/stderr line-by-line
 * into the job's log stream, returns on exit.
 *
 * Platform defaults:
 *   ios    → xcodebuild archive for the scheme named in the manifest
 *   macos  → same, different destination
 *
 * The customer's manifest can override BUILD_COMMAND entirely (e.g. for
 * Flutter/RN projects that have their own build scripts).
 */

const { spawn } = require('child_process');
const path = require('path');
const fsp = require('fs/promises');

function defaultBuildCommand(platform, manifest) {
  const scheme = manifest.xcodeScheme || manifest.scheme || 'App';
  const project = manifest.xcodeProject || null; // "MyApp.xcodeproj"
  const workspace = manifest.xcodeWorkspace || null; // "MyApp.xcworkspace"
  const archivePath = '$SCRATCH/build/$SCHEME.xcarchive'.replace('$SCHEME', scheme);

  const target = workspace
    ? `-workspace "${workspace}"`
    : project
      ? `-project "${project}"`
      : '';

  if (platform === 'ios') {
    return [
      'set -e',
      `xcodebuild ${target} -scheme "${scheme}" -configuration Release -destination "generic/platform=iOS" -archivePath "${archivePath}" archive CODE_SIGNING_ALLOWED=NO`,
    ].join(' && ');
  }
  if (platform === 'macos') {
    return [
      'set -e',
      `xcodebuild ${target} -scheme "${scheme}" -configuration Release -destination "generic/platform=macOS" -archivePath "${archivePath}" archive CODE_SIGNING_ALLOWED=NO`,
    ].join(' && ');
  }
  throw new Error(`unsupported Mac platform: ${platform}`);
}

function defaultOutputDir(platform, manifest) {
  // build-executor writes .xcarchive into $SCRATCH/build. The runner
  // globs for .xcarchive (and optional .ipa post-export) in this dir.
  return manifest.outputDir || 'build';
}

async function runBuild({ platform, manifest, scratchDir, state, env = {}, signal }) {
  const buildCommand = manifest.buildCommand || defaultBuildCommand(platform, manifest);

  const fullEnv = {
    ...process.env,
    SCRATCH: scratchDir,
    ...env,
  };

  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', buildCommand], {
      cwd: scratchDir,
      env: fullEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    pipeLines(child.stdout, 'stdout', state);
    pipeLines(child.stderr, 'stderr', state);

    const onAbort = () => {
      try { child.kill('SIGTERM'); } catch (_) {}
      setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 10_000).unref();
    };
    if (signal) signal.addEventListener('abort', onAbort);

    child.on('error', (err) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(err);
    });
    child.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (code === 0) resolve({ code });
      else reject(new Error(`build exited ${code}`));
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
      state.appendLog(label, line).catch(() => {});
    }
  });
  readable.on('end', () => {
    if (buf) state.appendLog(label, buf).catch(() => {});
  });
}

async function collectXcodeArtifacts(scratchBuildDir) {
  const out = [];
  let entries;
  try { entries = await fsp.readdir(scratchBuildDir, { withFileTypes: true }); }
  catch (_) { return out; }

  for (const ent of entries) {
    const name = ent.name;
    const full = path.join(scratchBuildDir, name);
    if (name.endsWith('.xcarchive') || name.endsWith('.ipa') || name.endsWith('.app') || name.endsWith('.dmg') || name.endsWith('.pkg')) {
      out.push({ path: full, name });
    }
  }
  return out;
}

module.exports = { runBuild, collectXcodeArtifacts, defaultOutputDir };
