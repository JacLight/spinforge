/**
 * AiDetectService — classify "what is this project and how does it build?"
 * by having Claude read the project's actual files, not just infer from a
 * single toolchain heuristic.
 *
 * Why this exists: Railpack's static-vs-container signal is the presence of
 * a Caddy start step. That misses real-world shapes — a Node/Express app
 * with a `build` script looks static; a Vite SPA with a custom server looks
 * like a server; a monorepo confuses it entirely. The result was Node
 * projects deployed as static React bundles. Claude reads package.json, the
 * file tree, and the framework config files and returns a structured
 * classification the pipeline can act on.
 *
 * Backend: the `claude` CLI (Claude Code) in headless print mode, not the
 * REST SDK. That reuses the machine's existing Claude Code auth instead of
 * requiring a separately-provisioned ANTHROPIC_API_KEY, and gives us
 * schema-constrained output for free via `--json-schema`.
 *
 * This is a FALLBACKABLE enhancement: if the CLI isn't present or the call
 * fails, callers fall back to Railpack's deterministic classification. The
 * service never throws for "couldn't classify" — it returns { ok: false }.
 *
 * Cost/latency: one CLI call per detect (~5-10s). Detect runs while a human
 * waits on a form, or once per build trigger, so that's fine. Model is
 * configurable via SPINFORGE_DETECT_MODEL (default claude-haiku-4-5 — the
 * cheapest that classifies these shapes reliably); the CLI's own system
 * prompt dominates cost, so a bigger model buys little here.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Files whose full contents materially change the classification. Kept small
// and capped so the prompt stays cheap. Order is roughly signal-strength.
const KEY_FILES = [
  'package.json',
  'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
  'next.config.js', 'next.config.ts', 'next.config.mjs',
  'nuxt.config.js', 'nuxt.config.ts',
  'svelte.config.js', 'astro.config.mjs', 'astro.config.js',
  'remix.config.js', 'angular.json', 'gatsby-config.js',
  'Dockerfile', 'docker-compose.yml', 'Procfile',
  'requirements.txt', 'pyproject.toml', 'Pipfile',
  'go.mod', 'Cargo.toml', 'Gemfile', 'composer.json',
  'index.html', 'netlify.toml', 'vercel.json', 'railpack.json',
  'tsconfig.json', '.nvmrc', 'nixpacks.toml',
];

const MAX_FILE_BYTES = 4 * 1024;   // per key file
const MAX_TREE_ENTRIES = 200;      // file-tree listing cap
const CALL_TIMEOUT_MS = Number(process.env.SPINFORGE_DETECT_TIMEOUT_MS || 90_000);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', '.cache', 'vendor', '__pycache__', '.venv']);

// Schema handed to `claude --json-schema`, so the model's output is
// constrained to exactly the fields we consume.
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'reason', 'confidence'],
  properties: {
    type: { type: 'string', enum: ['static', 'container'] },
    framework: { type: ['string', 'null'] },
    installCommand: { type: ['string', 'null'] },
    buildCommand: { type: ['string', 'null'] },
    startCommand: { type: ['string', 'null'] },
    outputDir: { type: ['string', 'null'] },
    runtime: { type: ['string', 'null'] },
    packageManager: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    reason: { type: 'string' },
  },
};

class AiDetectService {
  constructor({ logger, claudeBin, model, detectUrl } = {}) {
    this.logger = logger || console;
    this.claudeBin = claudeBin || process.env.SPINFORGE_CLAUDE_BIN || 'claude';
    // Remote sidecar: an authed Claude Code on a host that has credentials.
    // building-api containers set this and never carry the CLI or a key.
    this.detectUrl = detectUrl || process.env.SPINFORGE_DETECT_URL || null;
    // Model: default to the host's own Claude Code default (most capable) by
    // leaving it unset — SPINFORGE_DETECT_MODEL can pin a cheaper one.
    this.model = model || process.env.SPINFORGE_DETECT_MODEL || null;
    this._resolvedBin = undefined; // memoized path or null
  }

  // Whether AI detection can run at all: a remote sidecar is configured, or
  // the local claude CLI is reachable. Callers fall back to Railpack when false.
  get available() {
    if (this.detectUrl) return true;
    if (this._resolvedBin !== undefined) return !!this._resolvedBin;
    this._resolvedBin = this._resolveBin();
    return !!this._resolvedBin;
  }

  _resolveBin() {
    // Absolute/relative path that exists — use as-is.
    if (this.claudeBin.includes('/')) {
      return fs.existsSync(this.claudeBin) ? this.claudeBin : null;
    }
    // Bare name — probe PATH plus the usual install locations.
    const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    const extra = [path.join(process.env.HOME || '', '.local/bin'), '/usr/local/bin', '/usr/bin'];
    for (const d of [...dirs, ...extra]) {
      const p = path.join(d, this.claudeBin);
      try { if (fs.existsSync(p)) return p; } catch { /* skip */ }
    }
    return null;
  }

  /**
   * Classify a checked-out project directory.
   *
   * @param {object}  opts
   * @param {string}  opts.projectDir   directory to inspect (already cloned/extracted)
   * @param {object}  [opts.railpack]   Railpack's own classification, passed as a hint
   * @returns {Promise<object>} { ok, type, framework, installCommand, buildCommand,
   *                              startCommand, outputDir, runtime, packageManager,
   *                              reason, confidence } or { ok:false, error }
   */
  async classify({ projectDir, railpack } = {}) {
    if (!this.available) return { ok: false, error: 'ai_detect_unavailable' };
    if (!projectDir || !fs.existsSync(projectDir)) {
      return { ok: false, error: 'project_dir_missing' };
    }

    let snapshot;
    try {
      snapshot = this._snapshot(projectDir);
    } catch (err) {
      return { ok: false, error: 'snapshot_failed', message: err.message };
    }

    // Remote: hand the snapshot to the authed sidecar. Local: run claude here.
    return this.detectUrl
      ? this._classifyRemote(snapshot, railpack)
      : this.classifySnapshot(snapshot, railpack);
  }

  /**
   * Classify from an already-built snapshot by calling the local `claude`
   * CLI. This is what the detection sidecar runs (on the authed host); the
   * containers reach it via _classifyRemote.
   */
  async classifySnapshot(snapshot, railpack) {
    if (!snapshot || !snapshot.files) return { ok: false, error: 'snapshot_missing' };
    const prompt = this._buildPrompt(snapshot, railpack);

    let envelope;
    try {
      envelope = await this._runClaude(prompt);
    } catch (err) {
      this.logger.warn(`[ai-detect] claude cli failed: ${err.message}`);
      return { ok: false, error: 'ai_call_failed', message: err.message };
    }
    if (envelope.is_error) {
      this.logger.warn(`[ai-detect] claude reported error: ${String(envelope.result).slice(0, 200)}`);
      return { ok: false, error: 'ai_reported_error' };
    }

    // Prefer the pre-parsed structured_output; fall back to parsing `result`.
    const parsed = (envelope.structured_output && typeof envelope.structured_output === 'object')
      ? envelope.structured_output
      : this._parseJson(envelope.result);

    if (!parsed || (parsed.type !== 'static' && parsed.type !== 'container')) {
      this.logger.warn(`[ai-detect] unusable response: ${String(envelope.result).slice(0, 200)}`);
      return { ok: false, error: 'ai_bad_response' };
    }
    return this._normalize(parsed);
  }

  // POST the snapshot to the sidecar (authed Claude Code on the host).
  async _classifyRemote(snapshot, railpack) {
    // eslint-disable-next-line global-require
    const axios = require('axios');
    try {
      const res = await axios.post(
        this.detectUrl,
        { snapshot, railpack: railpack || null },
        { timeout: CALL_TIMEOUT_MS, validateStatus: (s) => s < 500 },
      );
      if (res.status >= 400 || !res.data) {
        this.logger.warn(`[ai-detect] sidecar ${res.status}`);
        return { ok: false, error: 'ai_sidecar_error', status: res.status };
      }
      return res.data; // sidecar already returns a normalized result
    } catch (err) {
      this.logger.warn(`[ai-detect] sidecar unreachable: ${err.message}`);
      return { ok: false, error: 'ai_sidecar_unreachable', message: err.message };
    }
  }

  _normalize(parsed) {
    return {
      ok: true,
      source: 'ai',
      type: parsed.type,
      framework: str(parsed.framework),
      installCommand: str(parsed.installCommand),
      buildCommand: str(parsed.buildCommand),
      startCommand: str(parsed.startCommand),
      outputDir: parsed.type === 'static' ? str(parsed.outputDir) : null,
      runtime: str(parsed.runtime),
      packageManager: str(parsed.packageManager),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
      reason: str(parsed.reason) || `Classified as ${parsed.type} by AI detection.`,
    };
  }

  // Spawn `claude -p --output-format json --json-schema <schema>` and feed the
  // prompt on stdin. Returns the parsed JSON envelope.
  _runClaude(prompt) {
    return new Promise((resolve, reject) => {
      const args = [
        '-p',
        '--output-format', 'json',
        '--json-schema', JSON.stringify(OUTPUT_SCHEMA),
      ];
      // Only pin a model when explicitly configured; otherwise use the host's
      // Claude Code default (the most capable model available to it).
      if (this.model) args.push('--model', this.model);
      const child = spawn(this._resolvedBin, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        // Detection is self-contained in the prompt; nothing to read from cwd.
        cwd: process.env.HOME || '/tmp',
      });

      let out = '';
      let err = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`claude cli timed out after ${CALL_TIMEOUT_MS}ms`));
      }, CALL_TIMEOUT_MS);

      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { err += d; });
      child.on('error', (e) => { clearTimeout(timer); reject(e); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          return reject(new Error(`claude exited ${code}: ${err.trim().slice(0, 200)}`));
        }
        try { resolve(JSON.parse(out)); }
        catch (e) { reject(new Error(`could not parse claude output: ${e.message}`)); }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  // Build a compact, token-cheap picture of the project.
  _snapshot(projectDir) {
    const tree = this._tree(projectDir);
    const files = {};
    for (const name of KEY_FILES) {
      const p = path.join(projectDir, name);
      try {
        const st = fs.statSync(p);
        if (!st.isFile()) continue;
        let content = fs.readFileSync(p, 'utf8');
        if (content.length > MAX_FILE_BYTES) {
          content = content.slice(0, MAX_FILE_BYTES) + '\n… (truncated)';
        }
        files[name] = content;
      } catch { /* absent — skip */ }
    }
    return { tree, files };
  }

  // Shallow-ish recursive listing, breadth-capped, dot/heavy dirs pruned.
  _tree(root) {
    const out = [];
    const walk = (dir, prefix, depth) => {
      if (out.length >= MAX_TREE_ENTRIES || depth > 3) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const e of entries) {
        if (out.length >= MAX_TREE_ENTRIES) break;
        if (e.name.startsWith('.') && e.name !== '.nvmrc') continue;
        if (e.isDirectory() && IGNORE_DIRS.has(e.name)) { out.push(`${prefix}${e.name}/ (pruned)`); continue; }
        if (e.isDirectory()) {
          out.push(`${prefix}${e.name}/`);
          walk(path.join(dir, e.name), `${prefix}${e.name}/`, depth + 1);
        } else {
          out.push(`${prefix}${e.name}`);
        }
      }
    };
    walk(root, '', 0);
    return out;
  }

  _buildPrompt(snapshot, railpack) {
    const parts = [];
    parts.push(
      'You are a build-system classifier for a hosting platform. Given a snapshot of a ' +
      'project (file tree + key files), decide how it should be deployed. Distinguish a ' +
      'STATIC site (built to a folder of files and served by a web server: plain HTML, or ' +
      'an SPA like React/Vue/Svelte/Astro-static with a build output dir and NO long-running ' +
      'server) from a CONTAINER app (needs a long-running process: Express/Fastify/Nest, ' +
      'Next.js/Nuxt/Remix in SSR mode, a Python/Go/Ruby server, anything with a start ' +
      'command that serves requests). When a Node project has both a build step and a ' +
      'server entrypoint (e.g. "start":"node server.js"), it is a CONTAINER.\n'
    );
    parts.push('# File tree');
    parts.push('```');
    parts.push(snapshot.tree.join('\n') || '(empty)');
    parts.push('```');
    for (const [name, content] of Object.entries(snapshot.files)) {
      parts.push(`\n# ${name}`);
      parts.push('```');
      parts.push(content);
      parts.push('```');
    }
    if (railpack && (railpack.type || railpack.startCommand)) {
      parts.push('\n# Railpack heuristic (a hint, may be wrong)');
      parts.push(JSON.stringify({
        type: railpack.type || null,
        startCommand: railpack.startCommand || null,
        outputDir: railpack.outputDir || null,
        reason: railpack.reason || null,
      }));
    }
    parts.push(
      '\n# Task\nClassify this project. outputDir is the built static directory (only ' +
      'meaningful when type="static"). startCommand is the long-running serve command (only ' +
      'meaningful when type="container"). runtime is like "node:20" or "python:3.12". ' +
      'confidence is 0..1. reason is one sentence.'
    );
    return parts.join('\n');
  }

  // Tolerant extraction: grab the outermost {...} and parse it.
  _parseJson(text) {
    if (!text) return null;
    if (typeof text === 'object') return text;
    const cleaned = String(text).replace(/```json\s*|\s*```/g, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)); }
    catch { return null; }
  }
}

function str(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s && s.toLowerCase() !== 'null' ? s : null;
}

module.exports = AiDetectService;
module.exports.OUTPUT_SCHEMA = OUTPUT_SCHEMA;
