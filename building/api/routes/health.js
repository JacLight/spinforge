const express = require('express');
const redis = require('../utils/redis');

const router = express.Router();

router.get('/', async (req, res) => {
  const out = {
    status: 'ok',
    service: 'building-api',
    ts: new Date().toISOString(),
  };
  try {
    const pong = await redis.ping();
    out.keydb = pong === 'PONG' ? 'ok' : 'degraded';
  } catch (err) {
    out.status = 'degraded';
    out.keydb = 'error';
    out.keydbError = err.message;
  }
  out.events = req.app.locals.events ? 'ready' : 'not_initialized';
  out.jobs = req.app.locals.jobs ? 'ready' : 'not_initialized';
  res.json(out);
});

module.exports = router;
