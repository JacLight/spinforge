/**
 * Version endpoint to verify deployment
 */
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    api_version: '2.0.0',
    updated: '2025-08-03',
    ssl_structure: 'flat ssl_enabled only',
    features: [
      'Removed nested ssl object',
      'Using ssl_enabled boolean field',
      'No backwards compatibility'
    ]
  });
});

module.exports = router;