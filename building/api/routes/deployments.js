/**
 * Deployment HTTP surface.
 *
 *   POST   /api/deployments         create + drive a deployment
 *   GET    /api/deployments         list (with filters)
 *   GET    /api/deployments/:id     fetch single record
 *   DELETE /api/deployments/:id     soft-cancel (undeploy not implemented)
 *   GET    /api/deployments/:id/download  download signed mobile binary
 *
 * Auth: same admin path as /api/jobs (Bearer JWT or X-API-Key), enforced
 * by the parent /api mount in server.js.
 */

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const CustomerPolicyService = require('../services/CustomerPolicyService');
const { UPLOADS_TMP } = require('../utils/constants');

const router = express.Router();

// Upload cap — deployment uploads include static sites + Dockerfile
// contexts + mobile source trees, so we allow the same 500MB ceiling
// the /api/jobs route uses (see utils/constants.js).
fs.mkdirSync(UPLOADS_TMP, { recursive: true });
const upload = multer({
  dest: UPLOADS_TMP,
  limits: { fileSize: 500 * 1024 * 1024 },
});

const WORKSPACE_ROOT = process.env.DEPLOYMENT_WORKSPACE_ROOT || process.env.WORKSPACE_ROOT || '/data/workspaces';

// ─── POST /api/deployments ─────────────────────────────────────────────
// multipart: workspace=<zip>, manifest=<JSON>
//
// manifest shape:
//   {
//     customerId: string,
//     domain?: string,                 // required for static/container
//     source: {
//       type: 'static' | 'build-static' | 'build-container' | 'build-mobile',
//       workspacePath?: string,        // set by handler, not caller
//       platform?: 'ios'|'android',    // build-mobile only
//       build?: {
//         command?: string,
//         outputDir?: string,
//         framework?: string,
//         env?: Record<string,string>,
//         dockerfile?: string,
//       }
//     },
//     target?: object,
//     metadata?: object,
//   }
// Accept either field name: `workspace` (admin UI) or `source` (external
// callers / the curl example in the runbook). Multer's `.fields()` with
// both names lets either succeed; we pick whichever was uploaded.
router.post('/', upload.fields([{ name: 'workspace', maxCount: 1 }, { name: 'source', maxCount: 1 }]), async (req, res, next) => {
  const uploadedFile = (req.files && (req.files.workspace?.[0] || req.files.source?.[0])) || null;
  let tempPath = uploadedFile && uploadedFile.path;
  try {
    const manifest = JSON.parse(req.body.manifest || '{}');
    const deployments = req.app.locals.deployments;
    const redis = req.app.locals.redis;

    const customerId = manifest.customerId;
    const domain     = manifest.domain;
    const source     = manifest.source || { type: 'build-static' };

    if (!customerId) {
      throw Object.assign(new Error('manifest.customerId is required'), { status: 400, expose: true });
    }
    if (!source.type) {
      throw Object.assign(new Error('manifest.source.type is required'), { status: 400, expose: true });
    }

    // Move uploaded workspace (if any) into a durable per-deployment dir
    // on Ceph so build runners + deploy can read it from any node.
    fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
    const workspaceDir = path.join(WORKSPACE_ROOT, `dep-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    fs.mkdirSync(workspaceDir, { recursive: true });
    if (uploadedFile) {
      const dest = path.join(workspaceDir, 'workspace.zip');
      // rename may cross devices if tempPath is outside DATA_ROOT — fall back to copy.
      try {
        await fsp.rename(tempPath, dest);
      } catch (e) {
        await fsp.copyFile(tempPath, dest);
        await fsp.unlink(tempPath).catch(() => {});
      }
      tempPath = null;
      source.workspacePath = workspaceDir;
    }

    // Policy pre-check. The build phase re-checks via CustomerPolicyService
    // inside JobService.create, so this is just a cheap guard on the
    // hosting dimension (maxSites) the build path doesn't see.
    const policy = await CustomerPolicyService.get(customerId);
    if (domain) {
      const sites = await redis.sCard(`customer:${customerId}:sites`);
      const cap = policy?.hosting?.maxSites;
      if (cap != null && sites >= cap) {
        // Only block if this domain isn't already a site for the customer
        // (re-deploys of an existing domain shouldn't trip the quota).
        const isMember = await redis.sIsMember(`customer:${customerId}:sites`, domain);
        if (!isMember) {
          return res.status(402).json({
            error: 'hosting.maxSites exceeded',
            current: sites,
            limit: cap,
          });
        }
      }
    }

    const dep = await deployments.create({
      customerId,
      domain,
      source,
      target: manifest.target,
      metadata: manifest.metadata,
    });
    res.status(201).json(dep);
  } catch (err) {
    if (tempPath) { fsp.unlink(tempPath).catch(() => {}); }
    next(err);
  }
});

// ─── GET /api/deployments ──────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { customerId, status } = req.query;
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const out = await req.app.locals.deployments.list({
      customerId: customerId || null,
      status: status || null,
      limit,
      offset,
    });
    res.json(out);
  } catch (err) { next(err); }
});

// ─── GET /api/deployments/:id ──────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const d = await req.app.locals.deployments.get(req.params.id);
    if (!d) return res.status(404).json({ error: 'deployment_not_found' });
    res.json(d);
  } catch (err) { next(err); }
});

// ─── DELETE /api/deployments/:id ───────────────────────────────────────
// Soft-cancel only for v1. Proper undeploy (stop Nomad job, remove
// site:<domain>, SREM from sets) is a follow-up.
router.delete('/:id', async (req, res, next) => {
  try {
    const d = await req.app.locals.deployments.get(req.params.id);
    if (!d) return res.status(404).json({ error: 'deployment_not_found' });
    res.json({
      ok: true,
      id: req.params.id,
      note: 'Soft-cancel only; undeploy (remove site:<domain>, stop container) not implemented yet.',
    });
  } catch (err) { next(err); }
});

// ─── GET /api/deployments/:id/download ─────────────────────────────────
// Serve the signed mobile binary. Mobile path is out of scope for this
// cut, but the handler is wired so the URL returned by
// HostingDeployService._deployMobile resolves.
router.get('/:id/download', async (req, res, next) => {
  try {
    const d = await req.app.locals.deployments.get(req.params.id);
    if (!d) return res.status(404).json({ error: 'deployment_not_found' });
    if (d.source.type !== 'build-mobile') {
      return res.status(400).json({ error: 'not_a_mobile_deployment' });
    }
    const ext = d.source.platform === 'ios' ? 'ipa' : 'aab';
    const artifactDir = d.phases?.build?.artifactDir || d.source.workspacePath;
    if (!artifactDir) return res.status(404).json({ error: 'artifact_not_ready' });
    const binaryPath = path.join(artifactDir, `app.${ext}`);
    if (!fs.existsSync(binaryPath)) return res.status(404).json({ error: 'binary_not_found' });
    res.setHeader('Content-Type', ext === 'ipa' ? 'application/octet-stream' : 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${d.id}.${ext}"`);
    fs.createReadStream(binaryPath).pipe(res);
  } catch (err) { next(err); }
});

module.exports = router;
