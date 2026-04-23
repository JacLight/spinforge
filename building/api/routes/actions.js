/**
 * Actions catalog — read-only.
 *
 *   GET  /api/actions              list full catalog
 *   GET  /api/actions/:id          one action (full schema)
 *   GET  /api/actions/:id/schema   inputs schema only (AI-friendly shortcut)
 *
 * Intentionally no POST/PUT — actions are code we ship, not user data.
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const all = req.app.locals.actions.list();
  const byCategory = {};
  for (const a of all) {
    (byCategory[a.category] ||= []).push(a);
  }
  res.json({ count: all.length, actions: all, byCategory });
});

router.get('/:id', (req, res) => {
  const action = req.app.locals.actions.get(req.params.id);
  if (!action) return res.status(404).json({ error: 'action_not_found', id: req.params.id });
  const { _validateInputs, _validateOutputs, ...safe } = action;
  res.json(safe);
});

router.get('/:id/schema', (req, res) => {
  const action = req.app.locals.actions.get(req.params.id);
  if (!action) return res.status(404).json({ error: 'action_not_found', id: req.params.id });
  res.json({
    id: action.id,
    version: action.version,
    inputs: action.inputs,
    outputs: action.outputs,
  });
});

module.exports = router;
