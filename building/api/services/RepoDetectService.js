/**
 * RepoDetectService — answer "what is this repo, and how does it build?"
 *
 * Pipelines already take a git source, so asking the user to then pick a
 * project type and hand-configure build stages is asking them to repeat
 * what the repository already states. Railpack can read it: language,
 * runtime version, package manager, build command, output directory,
 * start command. This service runs that inspection so pipeline creation
 * can be one field — the repo URL — instead of a form.
 *
 * Detection is a shallow clone plus `railpack prepare`, which only
 * analyses; nothing is built. That keeps it fast enough to run while
 * someone waits on a form, unlike dispatching a Nomad job.
 *
 * The classification that matters downstream:
 *   static    — Railpack lifts a directory out of the build step (dist,
 *               out, build/client). Served from Ceph, no container.
 *   container — Railpack plans a long-running process. Needs an image.
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const pexecFile = promisify(execFile);

const CLONE_TIMEOUT_MS = Number(process.env.DETECT_CLONE_TIMEOUT_MS || 60_000);
const DETECT_TIMEOUT_MS = Number(process.env.DETECT_TIMEOUT_MS || 90_000);

class RepoDetectService {
  constructor({ logger } = {}) {
    this.logger = logger || console;
  }

  /**
   * Inspect a repository and return what SpinForge would do with it.
   *
   * Never throws for "this repo doesn't work" — those come back as
   * { ok: false, error } so the caller can show it on the form. Throws
   * only for programming errors.
   */
  async detect({ url, ref, rootDir = '.', token } = {}) {
    if (!url) return { ok: false, error: 'repo_url_required', message: 'A repository URL is required' };

    const work = await fs.mkdtemp(path.join(os.tmpdir(), 'spinforge-detect-'));
    try {
      const cloned = await this._clone({ url, ref, token, dest: work });
      if (!cloned.ok) return cloned;

      const projectDir = rootDir && rootDir !== '.' ? path.join(work, rootDir) : work;
      if (!this._insideWorkspace(work, projectDir) || !fsSync.existsSync(projectDir)) {
        return {
          ok: false,
          error: 'root_dir_not_found',
          message: `rootDir "${rootDir}" does not exist in this repository`,
        };
      }

      const info = await this._inspect(projectDir);
      if (!info.ok) return info;

      return { ok: true, commit: cloned.commit, ...this._classify(info.plan, info.info) };
    } finally {
      await fs.rm(work, { recursive: true, force: true }).catch(() => {});
    }
  }

  async _clone({ url, ref, token, dest }) {
    // A token in the URL must never reach a log or an error message.
    let cloneUrl = url;
    if (token && /^https?:/i.test(url)) {
      try {
        const u = new URL(url);
        u.username = token;
        cloneUrl = u.toString();
      } catch {
        return { ok: false, error: 'invalid_repo_url', message: 'Repository URL could not be parsed' };
      }
    }

    const args = ['clone', '--depth', '1', '--single-branch'];
    if (ref) args.push('--branch', ref);
    args.push(cloneUrl, dest);

    try {
      await pexecFile('git', args, { timeout: CLONE_TIMEOUT_MS });
    } catch (err) {
      let detail = String(err.stderr || err.message || '');
      if (token) detail = detail.split(token).join('***');
      return {
        ok: false,
        error: 'clone_failed',
        message: detail.trim().slice(0, 300) || 'Could not clone the repository',
      };
    }

    let commit = '';
    try {
      const { stdout } = await pexecFile('git', ['-C', dest, 'rev-parse', 'HEAD']);
      commit = stdout.trim();
    } catch { /* non-fatal */ }

    return { ok: true, commit };
  }

  async _inspect(projectDir) {
    const planPath = path.join(projectDir, '.spinforge-plan.json');
    const infoPath = path.join(projectDir, '.spinforge-info.json');
    try {
      await pexecFile(
        'railpack',
        ['prepare', projectDir, '--plan-out', planPath, '--info-out', infoPath],
        { timeout: DETECT_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      );
    } catch (err) {
      const detail = String(err.stderr || err.message || '').trim();
      return {
        ok: false,
        error: 'detect_failed',
        message: detail.slice(0, 300) || 'Railpack could not analyse this repository',
      };
    }

    const plan = await this._readJson(planPath);
    const info = await this._readJson(infoPath);
    if (!plan) {
      return { ok: false, error: 'detect_failed', message: 'Railpack produced no build plan' };
    }
    return { ok: true, plan, info: info || {} };
  }

  /**
   * Turn a Railpack plan into the fields a pipeline needs.
   *
   * `deploy.inputs` lists what the final image is assembled from. A
   * relative include sourced from the build step is the app's own output
   * (e.g. "dist") — that's a static site. Absolute paths are runtime
   * furniture (the Caddy binary, node_modules), which means a server.
   */
  _classify(plan, info) {
    const deploy = plan.deploy || {};
    const inputs = Array.isArray(deploy.inputs) ? deploy.inputs : [];

    // Static sites are the ones Railpack serves with Caddy — that is the
    // signal, not the shape of the includes.
    //
    // The tempting rule ("a relative include from the build step is the
    // output directory") is wrong: Railpack emits "." to mean "the whole
    // app directory", which every Node server also has. That
    // misclassified a plain Express API as a static site with
    // outputDir ".", which would have deployed an API as a folder of
    // files and served its source.
    const startCommand = deploy.startCommand || '';
    const isStatic = /(^|\/)caddy\b/.test(startCommand)
      || inputs.some((i) => i.step === 'caddy' || i.step === 'packages:caddy');

    let outputDir = null;
    if (isStatic) {
      for (const input of inputs) {
        if (input.step !== 'build' || !Array.isArray(input.include)) continue;
        const rel = input.include.find(
          (p) => typeof p === 'string' && p && p !== '.' && !p.startsWith('/'),
        );
        if (rel) { outputDir = rel; break; }
      }
    }

    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    const commandsOf = (name) => {
      const s = steps.find((x) => x.name === name);
      if (!s || !Array.isArray(s.commands)) return [];
      return s.commands.filter((c) => c && c.cmd).map((c) => c.cmd);
    };

    const meta = info.metadata || {};
    const type = isStatic ? 'static' : 'container';

    return {
      type,
      outputDir,
      startCommand: deploy.startCommand || null,
      installCommands: commandsOf('install'),
      buildCommands: commandsOf('build'),
      runtime: meta.nodeRuntime || null,
      packageManager: meta.nodePackageManager || null,
      providers: info.detectedProviders || [],
      resolvedPackages: info.resolvedPackages || {},
      // Surfaced so the UI can say why it chose static vs container
      // rather than presenting the answer as an oracle.
      reason: isStatic
        ? `Railpack builds this into "${outputDir || 'the output directory'}" and serves it as static files.`
        : 'Railpack plans a long-running process, so this deploys as a container.',
    };
  }

  _insideWorkspace(root, target) {
    const rel = path.relative(path.resolve(root), path.resolve(target));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  }

  async _readJson(p) {
    try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; }
  }
}

module.exports = RepoDetectService;
