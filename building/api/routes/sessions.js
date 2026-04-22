/**
 * Session VM HTTP surface for Vibe Studio / session-manager.
 *
 * Called by session-manager when a user opens a new workspace. Returns a
 * handle (tailscaleIp + port once the VM reports ready). session-manager
 * tunnels Socket.IO through Tailscale to the advertised port.
 *
 * SECURITY: same O4 caveat as jobs routes — no auth wired yet. Trust
 * model is session-manager-to-building-api over the private mesh.
 */

const express = require('express');

const router = express.Router();

// ─── POST /api/sessions ──────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { userId, template, metadata } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const session = await req.app.locals.sessions.allocate({
      userId,
      template,
      metadata: metadata || {},
    });
    res.status(201).json(session);
  } catch (err) { next(err); }
});

// ─── GET /api/sessions ───────────────────────────────────────────────
// Without `?userId=` returns every session in the cluster (admin UI).
// With `?userId=` filters to that user's sessions (session-manager).
router.get('/', async (req, res, next) => {
  try {
    const userId = req.query.userId;
    const limit  = Math.min(500, parseInt(req.query.limit, 10) || 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const sessions = userId
      ? await req.app.locals.sessions.listByUser(userId, { limit, offset })
      : await req.app.locals.sessions.listAll({ limit, offset });
    res.json({ userId: userId || null, sessions, total: sessions.length });
  } catch (err) { next(err); }
});

// ─── GET /api/sessions/:id ───────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const s = await req.app.locals.sessions.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'session_not_found' });
    res.json(s);
  } catch (err) { next(err); }
});

// ─── DELETE /api/sessions/:id ────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const s = await req.app.locals.sessions.destroy(req.params.id);
    if (!s) return res.status(404).json({ error: 'session_not_found' });
    res.json(s);
  } catch (err) { next(err); }
});

// ─── POST /api/sessions/:id/ready ────────────────────────────────────
// Called by the VM once it's up (cloud-init hook, dockerfile CMD) to
// surface its Tailscale IP + listening port. Not admin-facing.
router.post('/:id/ready', async (req, res, next) => {
  try {
    const { tailscaleIp, port, metadata } = req.body || {};
    const s = await req.app.locals.sessions.reportReady(req.params.id, {
      tailscaleIp,
      port,
      metadata: metadata || {},
    });
    if (!s) return res.status(404).json({ error: 'session_not_found' });
    res.json(s);
  } catch (err) { next(err); }
});

module.exports = router;
