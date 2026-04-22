/**
 * Internal transport endpoints used by bare-metal runners that can't
 * read/write Ceph directly (notably the Mac runners — they live over
 * Tailscale and don't mount the SpinForge data volume).
 *
 * Not for public use. Routed only on the trusted private mesh.
 *
 * SECURITY v1: no auth. Tailscale admission is the auth layer.
 * M4 upgrades this with per-runner HMAC signatures + short-lived Vault
 * tokens. Do NOT expose this mount outside Tailscale.
 */

const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const multer = require('multer');
const logger = require('../utils/logger');
const {
  WORKSPACES_ROOT,
  ARTIFACTS_ROOT,
  UPLOADS_TMP,
  MAX_UPLOAD_BYTES,
} = require('../utils/constants');

const router = express.Router();

fs.mkdirSync(UPLOADS_TMP, { recursive: true });

// ─── GET /_internal/workspaces/:jobId ────────────────────────────────
// Streams the workspace zip to the runner. Range header supported so the
// runner can retry a partial download.
router.get('/workspaces/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  if (!isSafeJobId(jobId)) return res.status(400).json({ error: 'bad_job_id' });

  const filePath = path.join(WORKSPACES_ROOT, `${jobId}.zip`);
  try {
    const st = await fsp.stat(filePath);
    if (!st.isFile()) return res.status(404).json({ error: 'workspace_not_found' });

    res.set('Content-Type', 'application/zip');
    res.set('Content-Length', String(st.size));
    res.set('X-Workspace-Size', String(st.size));
    fs.createReadStream(filePath)
      .on('error', (err) => {
        logger.error(`[internal] workspace stream for ${jobId}: ${err.message}`);
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
      })
      .pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'workspace_not_found' });
    logger.error(`[internal] workspace stat ${jobId}: ${err.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── POST /_internal/artifacts/:jobId ────────────────────────────────
// Runner uploads one or more artifact files. Form fields:
//   files: one or more file attachments (multipart)
//   kind:  optional classification ("ipa", "xcarchive", "apk", etc.)
const upload = multer({
  dest: UPLOADS_TMP,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});
router.post('/artifacts/:jobId', upload.array('files', 20), async (req, res, next) => {
  const jobId = req.params.jobId;
  if (!isSafeJobId(jobId)) return res.status(400).json({ error: 'bad_job_id' });

  const kind = typeof req.body.kind === 'string' ? req.body.kind : null;
  const dest = path.join(ARTIFACTS_ROOT, jobId);
  const cleanup = [];

  try {
    await fsp.mkdir(dest, { recursive: true });
    const recorded = [];

    for (const file of req.files || []) {
      const safeName = path.basename(file.originalname).replace(/[^A-Za-z0-9._-]/g, '_');
      if (!safeName) continue;
      const finalPath = path.join(dest, safeName);
      // tempPath and finalPath both on Ceph — same-device rename.
      await fsp.rename(file.path, finalPath);
      const st = await fsp.stat(finalPath);
      const entry = {
        path: finalPath,
        name: safeName,
        bytes: st.size,
        kind,
        createdAt: new Date().toISOString(),
      };
      recorded.push(entry);

      // Append to the job record so GET /api/jobs/:id/artifacts sees it.
      try {
        await req.app.locals.jobs.recordArtifact(jobId, {
          path: `file://${finalPath}`,
          bytes: st.size,
          kind,
        });
      } catch (err) {
        logger.warn(`[internal] recordArtifact failed for ${jobId}: ${err.message}`);
      }
    }

    res.status(201).json({ jobId, artifacts: recorded });
  } catch (err) {
    for (const p of cleanup) fsp.unlink(p).catch(() => {});
    next(err);
  }
});

function isSafeJobId(id) {
  return typeof id === 'string' && /^job_[A-Za-z0-9]{10,}$/.test(id);
}

module.exports = router;
