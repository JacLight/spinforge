/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const express = require('express');
const router = express.Router();

// Import all route modules
const sitesRoutes = require('./sites');
const containerRoutes = require('./containers');
const metricsRoutes = require('./metrics');
const healthRoutes = require('./health');
const miscRoutes = require('./misc');
const versionRoutes = require('./version');

// Mount routes
router.use('/sites', sitesRoutes);
router.use('/sites', containerRoutes); // Container routes are under /sites/:domain/container
router.use('/containers', containerRoutes); // Also mount at /containers for /containers/stats
router.use('/metrics', metricsRoutes);
router.use('/health', healthRoutes);
router.use('/', miscRoutes);

// Additional metric routes with underscore prefix
router.use('/_metrics', metricsRoutes);
router.use('/_health', healthRoutes);

// Version endpoint
router.use('/version', versionRoutes);

module.exports = router;