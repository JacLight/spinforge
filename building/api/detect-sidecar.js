#!/usr/bin/env node
/**
 * detect-sidecar — SpinForge's AI project-type detection engine.
 *
 * Runs on a host that already has an authenticated Claude Code (`claude`
 * CLI), so the building-api containers never need the binary or an API key.
 * They POST a project snapshot here; this wraps the authed `claude` and
 * returns the classification. This is the "pipe detection to the Claude
 * that's already logged in" design.
 *
 *   POST /detect   { snapshot: {tree, files}, railpack?: {...} }
 *                  → { ok, type, buildCommand, outputDir, startCommand, ... }
 *   GET  /health   → { ok: true }
 *
 * Bind host/port via SPINFORGE_DETECT_HOST (default 0.0.0.0) and
 * SPINFORGE_DETECT_PORT (default 9095). Model follows the host's Claude Code
 * default unless SPINFORGE_DETECT_MODEL is set.
 */

const http = require('http');
const AiDetectService = require('./services/AiDetectService');

const HOST = process.env.SPINFORGE_DETECT_HOST || '0.0.0.0';
const PORT = Number(process.env.SPINFORGE_DETECT_PORT || 9095);
const MAX_BODY = 8 * 1024 * 1024; // snapshots are small; cap defensively

// Local mode: this process IS the authed host, so no detectUrl — it spawns
// the real `claude` CLI.
const svc = new AiDetectService({ logger: console });

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/_health')) {
    return send(res, 200, { ok: true, service: 'spinforge-detect', claude: svc.available });
  }
  if (req.method !== 'POST' || (req.url || '').split('?')[0] !== '/detect') {
    return send(res, 404, { ok: false, error: 'not_found' });
  }
  let payload;
  try {
    payload = await readJson(req);
  } catch (err) {
    return send(res, 400, { ok: false, error: 'bad_request', message: err.message });
  }
  const { snapshot, railpack } = payload || {};
  if (!snapshot || !snapshot.files) {
    return send(res, 400, { ok: false, error: 'snapshot_required' });
  }
  try {
    const result = await svc.classifySnapshot(snapshot, railpack || null);
    // Always 200 — the result object carries ok:true/false so the caller can
    // fall back to Railpack without treating this as a transport error.
    return send(res, 200, result);
  } catch (err) {
    console.error('[detect-sidecar] classify failed:', err.message);
    return send(res, 200, { ok: false, error: 'classify_failed', message: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[detect-sidecar] listening on ${HOST}:${PORT} (claude available: ${svc.available})`);
});
