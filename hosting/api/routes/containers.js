/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * Container/workload management endpoints backed by Nomad. Every operation
 * here reads the authoritative site record from Redis and then delegates to
 * the cluster via NomadService.
 */
const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');
const NomadService = require('../services/NomadService');

const nomad = new NomadService();

async function loadSite(domain) {
  const data = await redisClient.get(`site:${domain}`);
  if (!data) return null;
  return JSON.parse(data);
}

function requireContainerSite(site, res) {
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return false;
  }
  if (site.type !== 'container' && site.type !== 'node') {
    res.status(400).json({ error: 'Not a container/node site' });
    return false;
  }
  return true;
}

router.post('/:domain/container/stop', async (req, res) => {
  try {
    const site = await loadSite(req.params.domain);
    if (!requireContainerSite(site, res)) return;
    await nomad.stopSite(site.domain, { purge: false });
    res.json({ message: 'Workload stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:domain/container/start', async (req, res) => {
  try {
    const site = await loadSite(req.params.domain);
    if (!requireContainerSite(site, res)) return;
    const deployed = await nomad.deploySite(site);
    site.nomadJobId = deployed.jobId;
    site.nomadEvalId = deployed.evalId;
    await redisClient.set(`site:${site.domain}`, JSON.stringify(site));
    res.json({ message: 'Workload started', jobId: deployed.jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:domain/container/restart', async (req, res) => {
  try {
    const site = await loadSite(req.params.domain);
    if (!requireContainerSite(site, res)) return;
    await nomad.stopSite(site.domain, { purge: false }).catch(() => {});
    const deployed = await nomad.deploySite(site);
    site.nomadJobId = deployed.jobId;
    site.nomadEvalId = deployed.evalId;
    await redisClient.set(`site:${site.domain}`, JSON.stringify(site));
    res.json({ message: 'Workload restarted', jobId: deployed.jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:domain/container/rebuild', async (req, res) => {
  try {
    const site = await loadSite(req.params.domain);
    if (!requireContainerSite(site, res)) return;
    const deployed = await nomad.deploySite(site);
    site.nomadJobId = deployed.jobId;
    site.nomadEvalId = deployed.evalId;
    site.updatedAt = new Date().toISOString();
    await redisClient.set(`site:${site.domain}`, JSON.stringify(site));
    res.json({ message: 'Workload redeployed', jobId: deployed.jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:domain/container/logs', async (req, res) => {
  try {
    const site = await loadSite(req.params.domain);
    if (!requireContainerSite(site, res)) return;
    const lines = parseInt(req.query.lines, 10) || 200;
    const type = req.query.stream === 'stderr' ? 'stderr' : 'stdout';
    const result = await nomad.getSiteLogs(site.domain, { lines, type });
    if (!result) return res.json({ logs: '' });
    res.json({ logs: result.body || '', alloc: result.alloc, node: result.node });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:domain/container/health', async (req, res) => {
  try {
    const site = await loadSite(req.params.domain);
    if (!requireContainerSite(site, res)) return;
    const status = await nomad.getSiteStatus(site.domain);
    if (!status) return res.json({ healthy: false, status: 'not_deployed' });
    const allocs = status.allocations || [];
    const running = allocs.filter((a) => a.status === 'running').length;
    const healthy = allocs.filter((a) => a.healthy).length;
    res.json({
      healthy: running > 0 && healthy === running,
      status: status.status,
      allocations: allocs,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:domain/container/stats', async (req, res) => {
  try {
    const site = await loadSite(req.params.domain);
    if (!requireContainerSite(site, res)) return;
    const status = await nomad.getSiteStatus(site.domain);
    res.json(status || { status: 'not_deployed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
