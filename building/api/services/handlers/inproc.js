/**
 * In-process action handlers.
 *
 * Registered with BuildService; each handler receives:
 *   { build, stage, inputs, workspace, logger, emit, log }
 * and returns the outputs object declared by the action's schema.
 *
 * Scope for this cut: the handlers BuildService can run without
 * touching Nomad or a remote runner:
 *   - source.zip       — unpack the upload (if any) into the stage workspace
 *   - source.git       — git clone/pull on the api node
 *   - host.static      — delegate to HostingDeployService
 *   - util.webhook     — HTTP call
 *
 * build.* / sign.* / publish.* actions need runners and are left
 * unregistered — BuildService marks them `skipped_unimplemented` with a
 * clear reason, which is safer than inventing a pretend success.
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const pexecFile = promisify(execFile);

function build({ hostingDeploy, logger }) {
  const handlers = new Map();

  handlers.set('source.zip', async ({ build, stage, inputs, workspace, emit }) => {
    await fs.mkdir(workspace, { recursive: true });
    // Convention: the build route that accepts an upload stashes the
    // zip at <build.workspace>/workspace.zip. If that path is missing
    // (git-only or no-upload pipelines), emit a clear error rather
    // than silently producing an empty workspace.
    const zip = path.join(build.workspace, 'workspace.zip');
    if (!fsSync.existsSync(zip)) {
      throw new Error(`source.zip: no workspace.zip found at ${zip} — caller must upload the pipeline's zip to the build's workspace before triggering, or choose a different source action`);
    }
    emit('info', 'extract', `extracting ${zip}`);
    const args = ['-q', '-o', zip, '-d', workspace];
    await pexecFile('unzip', args);
    // Optional strip of leading directories (GitHub-style "-strip 1").
    if (inputs.strip && Number(inputs.strip) > 0) {
      const n = Number(inputs.strip);
      for (let i = 0; i < n; i++) {
        const entries = await fs.readdir(workspace);
        if (entries.length === 1) {
          const inner = path.join(workspace, entries[0]);
          const st = await fs.stat(inner);
          if (st.isDirectory()) {
            // Move children up one level
            const nested = await fs.readdir(inner);
            for (const child of nested) {
              await fs.rename(path.join(inner, child), path.join(workspace, child));
            }
            await fs.rmdir(inner);
          }
        }
      }
    }
    emit('info', 'finish', `extracted to ${workspace}`);
    return { workspace };
  });

  handlers.set('source.git', async ({ inputs, workspace, emit, log }) => {
    await fs.mkdir(workspace, { recursive: true });
    const { url, ref = 'HEAD', depth = 1, token } = inputs;
    // If a token is provided, splice it into an https URL. We do NOT
    // log the substituted URL — that would leak the PAT. The raw url
    // is safe to print.
    let cloneUrl = url;
    if (token && /^https?:/i.test(url)) {
      const u = new URL(url);
      u.username = token;
      cloneUrl = u.toString();
    }
    emit('info', 'clone', `git clone ${url} @ ${ref} (depth=${depth})`);

    const args = ['clone', '--depth', String(depth), '--single-branch'];
    if (ref && ref !== 'HEAD') args.push('--branch', ref);
    args.push(cloneUrl, workspace);

    try {
      const { stdout, stderr } = await pexecFile('git', args, { timeout: 120_000 });
      if (stdout) log(stdout, 'stdout');
      if (stderr) log(stderr, 'stderr');
    } catch (err) {
      const detail = (err.stderr || err.message || '').toString();
      // Redact the token if it appears in the error surface.
      const redacted = token ? detail.split(token).join('***') : detail;
      throw new Error(`git clone failed: ${redacted.slice(0, 500)}`);
    }

    // Capture the resolved commit so downstream stages and audit logs
    // know exactly what was built.
    let commit = '';
    try {
      const { stdout } = await pexecFile('git', ['-C', workspace, 'rev-parse', 'HEAD']);
      commit = stdout.trim();
    } catch (err) {
      emit('warn', 'inspect', `unable to resolve HEAD commit: ${err.message}`);
    }

    emit('info', 'finish', `cloned to ${workspace} at ${commit.slice(0, 12)}`);
    return { workspace, commit };
  });

  if (hostingDeploy) {
    const staticDeployHandler = async ({ build, inputs, emit }) => {
      const { domain, artifact } = inputs;
      emit('info', 'handoff', `handing ${artifact} to hosting tier for ${domain}`);
      const result = await hostingDeploy.deploy({
        deploymentId: `build:${build.id}`,
        customerId: build.customerId,
        domain,
        // HostingDeployService today keys on source.type — a 'static'
        // directory hand-off is exactly what _deployStatic accepts when
        // the artifact dir already holds the finished site files.
        source: { type: 'static', workspacePath: artifact },
        artifactDir: artifact,
      });
      return { url: result.url };
    };
    // Register under the canonical id (`deploy.static-site`) and its
    // legacy alias (`host.static`). BuildService looks up handlers by
    // the action's canonical id, which is what ActionRegistry.get
    // returns regardless of which alias the pipeline used.
    handlers.set('deploy.static-site', staticDeployHandler);
    handlers.set('host.static', staticDeployHandler);
  }

  handlers.set('util.webhook', async ({ inputs, emit }) => {
    const { url, method = 'POST', headers = {}, body } = inputs;
    emit('info', 'request', `${method} ${url}`);
    const res = await axios.request({
      url, method, headers, data: body,
      timeout: 15_000,
      validateStatus: () => true,
    });
    emit('info', 'response', `status ${res.status}`);
    return { status: res.status, body: typeof res.data === 'object' ? res.data : String(res.data).slice(0, 2000) };
  });

  return handlers;
}

module.exports = { build };
