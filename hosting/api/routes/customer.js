/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
const redisClient = require('../utils/redis');
const sitesIndex = require('../utils/sites-index');
const { checkStaticFiles } = require('../utils/site-helpers');
const { STATIC_ROOT, UPLOADS_ROOT } = require('../utils/constants');
const CustomerTokenService = require('../services/CustomerTokenService');
const NomadService = require('../services/NomadService');

const customerTokenService = new CustomerTokenService(redisClient);
const nomad = new NomadService();

// Uploads: same temp dir + 500 MB cap the admin route uses.
if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
const upload = multer({ dest: UPLOADS_ROOT, limits: { fileSize: 500 * 1024 * 1024 } });

// Load a site and assert the caller owns it. Returns the parsed site or
// null; on null the response has already been sent (404).
async function loadOwnedSite(req, res) {
  const { customerId } = req;
  const { domain } = req.params;
  const data = await redisClient.get(`site:${domain}`);
  if (!data) {
    res.status(404).json({ error: 'Site not found' });
    return null;
  }
  const site = JSON.parse(data);
  if (site.customerId !== customerId) {
    res.status(404).json({ error: 'Site not found' });
    return null;
  }
  return site;
}

// Customer authentication middleware. Accepts (in order):
//   1. apitoken:<token>          → legacy short-lived API token from /_auth/customer/login
//   2. session:<token>           → browser session from /_auth/customer/login
//   3. sfc_<token>               → long-lived customer API token from /_api/customer/tokens
const authenticateCustomer = async (req, res, next) => {
  const authToken = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-auth-token'];

  if (!authToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // 1+2. Legacy session/apitoken paths (cheapest, single Redis GET each)
    const tokenData = await redisClient.get(`apitoken:${authToken}`);
    if (tokenData) {
      const token = JSON.parse(tokenData);
      req.customerId = token.customerId;
      req.userId = token.userId;
      req.userEmail = token.email;
    } else {
      const sessionData = await redisClient.get(`session:${authToken}`);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        req.customerId = session.customerId;
        req.userId = session.userId;
        req.userEmail = session.email;
      } else {
        // 3. Long-lived customer API token
        const apiToken = await customerTokenService.validatePlaintext(authToken);
        if (!apiToken) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.customerId = apiToken.customerId;
        req.userId = apiToken.userId;
        req.userEmail = apiToken.userEmail;
        req.apiTokenId = apiToken.tokenId;
      }
    }

    if (!req.customerId) {
      return res.status(401).json({ error: 'Invalid customer token' });
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Apply authentication to all routes
router.use(authenticateCustomer);

// ─── Customer API Tokens ───────────────────────────────────────────────────
// Per-customer long-lived tokens. Each token is scoped to its owning customer
// and grants the same access as that customer's session.

// List the customer's tokens
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await customerTokenService.listTokens(req.customerId);
    res.json({ tokens });
  } catch (error) {
    console.error('Failed to list customer tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new customer API token. Plaintext returned exactly once.
router.post('/tokens', async (req, res) => {
  try {
    const { name, expiry } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Token name is required' });
    }
    const created = await customerTokenService.createToken({
      customerId: req.customerId,
      userId: req.userId,
      userEmail: req.userEmail,
      name,
      expiry,
    });
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 'DUPLICATE_NAME') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Failed to create customer token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk revoke. NOTE: must be defined before /tokens/:id so the parameterized
// route does not capture the bare DELETE on /tokens.
router.delete('/tokens', async (req, res) => {
  try {
    const keepCurrent = req.query.keepCurrent === '1' || req.query.keepCurrent === 'true';
    const exceptId = keepCurrent ? req.apiTokenId : null;
    const revoked = await customerTokenService.deleteAll(req.customerId, { exceptId });
    res.json({
      success: true,
      revoked,
      kept: exceptId ? 1 : 0,
    });
  } catch (error) {
    console.error('Failed to bulk-revoke customer tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

// Revoke a single customer token by id
router.delete('/tokens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (req.apiTokenId === id) {
      return res.status(400).json({
        error: 'A token cannot revoke itself. Use a different token or session.',
      });
    }
    const ok = await customerTokenService.deleteToken(req.customerId, id);
    if (!ok) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete customer token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get customer's own sites/deployments
router.get('/deployments', async (req, res) => {
  try {
    const { customerId } = req;
    const keys = await sitesIndex.listAllSiteKeys();
    const deployments = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const site = JSON.parse(data);
        if (site.customerId === customerId) {
          // Check static files if needed
          const siteWithFiles = checkStaticFiles(site);
          
          deployments.push({
            id: site.domain,
            domain: site.domain,
            type: site.type,
            status: site.enabled ? 'active' : 'inactive',
            createdAt: site.createdAt,
            updatedAt: site.updatedAt,
            config: {
              ...site,
              files_exist: siteWithFiles.files_exist,
              actual_domain: siteWithFiles.actual_domain
            }
          });
        }
      }
    }
    
    // Sort by creation date (newest first)
    deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({
      deployments,
      total: deployments.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer's domains
router.get('/domains', async (req, res) => {
  try {
    const { customerId } = req;
    const keys = await sitesIndex.listAllSiteKeys();
    const domains = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const site = JSON.parse(data);
        if (site.customerId === customerId) {
          domains.push({
            domain: site.domain,
            aliases: site.aliases || [],
            type: site.type,
            enabled: site.enabled !== false,
            ssl: site.ssl || false,
            createdAt: site.createdAt
          });
          
          // Add aliases as separate entries
          if (site.aliases && site.aliases.length > 0) {
            site.aliases.forEach(alias => {
              domains.push({
                domain: alias,
                isPrimary: false,
                primaryDomain: site.domain,
                type: site.type,
                enabled: site.enabled !== false,
                ssl: site.ssl || false,
                createdAt: site.createdAt
              });
            });
          }
        }
      }
    }
    
    res.json({
      domains,
      total: domains.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer's resource usage
router.get('/usage', async (req, res) => {
  try {
    const { customerId } = req;
    const keys = await sitesIndex.listAllSiteKeys();
    
    let siteCount = 0;
    let containerCount = 0;
    let totalBandwidth = 0;
    let totalStorage = 0;
    const siteTypes = {};
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const site = JSON.parse(data);
        if (site.customerId === customerId) {
          siteCount++;
          
          // Count by type
          siteTypes[site.type] = (siteTypes[site.type] || 0) + 1;
          
          if (site.type === 'container') {
            containerCount++;
          }
          
          // Get metrics for this site
          const metricsData = await redisClient.hGetAll(`metrics:${site.domain}`);
          if (metricsData) {
            totalBandwidth += parseInt(metricsData.totalBandwidth || 0);
          }
        }
      }
    }
    
    res.json({
      sites: {
        total: siteCount,
        byType: siteTypes
      },
      containers: {
        total: containerCount,
        running: containerCount // TODO: Check actual container status
      },
      bandwidth: {
        used: totalBandwidth,
        limit: 1000 * 1024 * 1024 * 1024, // 1TB default
        unit: 'bytes'
      },
      storage: {
        used: totalStorage,
        limit: 100 * 1024 * 1024 * 1024, // 100GB default
        unit: 'bytes'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy /deploy entry. Mirrors POST /sites so older clients keep working.
router.post('/deploy', async (req, res) => {
  try {
    const { customerId } = req;
    const { domain, type, config } = req.body;

    if (!domain || !type) {
      return res.status(400).json({ error: 'Domain and type are required' });
    }
    const exists = await redisClient.exists(`site:${domain}`);
    if (exists) return res.status(409).json({ error: 'Domain already exists' });

    const site = {
      domain,
      type,
      customerId,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...config,
    };

    if (type === 'container' || type === 'node') {
      try {
        site.orchestrator = 'nomad';
        const deployed = await nomad.deploySite(site);
        site.nomadJobId = deployed.jobId;
        site.nomadEvalId = deployed.evalId;
      } catch (error) {
        return res.status(500).json({ error: 'Nomad deployment failed', details: error.message });
      }
    }

    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    await sitesIndex.registerSite(domain, customerId);
    require('../utils/auto-cert').maybeAutoIssueCert(site);

    res.status(201).json({
      message: 'Deployment created',
      deployment: {
        id: domain,
        domain,
        type,
        status: site.nomadJobId ? 'scheduled' : 'created',
        createdAt: site.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific deployment
router.get('/deployments/:id', async (req, res) => {
  try {
    const { customerId } = req;
    const { id } = req.params;
    
    const data = await redisClient.get(`site:${id}`);
    if (!data) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    // Check static files if needed
    const siteWithFiles = checkStaticFiles(site);
    
    res.json({
      id: site.domain,
      domain: site.domain,
      type: site.type,
      status: site.enabled ? 'active' : 'inactive',
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
      config: {
        ...site,
        files_exist: siteWithFiles.files_exist,
        actual_domain: siteWithFiles.actual_domain
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy update-by-deployment-id — mirrors PUT /sites/:domain.
router.put('/deployments/:id', async (req, res) => {
  try {
    const { customerId } = req;
    const { id } = req.params;
    const updates = req.body;

    const data = await redisClient.get(`site:${id}`);
    if (!data) return res.status(404).json({ error: 'Deployment not found' });
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    const oldConfig = site.containerConfig;
    const updatedSite = {
      ...site,
      ...updates,
      customerId,
      domain: site.domain,
      updatedAt: new Date().toISOString(),
    };

    const containerChanged =
      (updatedSite.type === 'container' || updatedSite.type === 'node') &&
      JSON.stringify(oldConfig) !== JSON.stringify(updatedSite.containerConfig);

    if (containerChanged) {
      try {
        updatedSite.orchestrator = 'nomad';
        const deployed = await nomad.deploySite(updatedSite);
        updatedSite.nomadJobId = deployed.jobId;
        updatedSite.nomadEvalId = deployed.evalId;
      } catch (error) {
        return res.status(500).json({ error: 'Nomad redeploy failed', details: error.message });
      }
    }

    await redisClient.set(`site:${id}`, JSON.stringify(updatedSite));
    await sitesIndex.registerSite(id, customerId);
    require('../utils/auto-cert').maybeAutoIssueCert(updatedSite);
    
    res.json({
      message: 'Deployment updated',
      deployment: {
        id: updatedSite.domain,
        domain: updatedSite.domain,
        type: updatedSite.type,
        status: updatedSite.enabled ? 'active' : 'inactive',
        updatedAt: updatedSite.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === SITES ENDPOINTS (used by UI) ===

// List customer's sites
router.get('/sites', async (req, res) => {
  try {
    const { customerId } = req;
    const keys = await sitesIndex.listAllSiteKeys();
    const sites = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const site = JSON.parse(data);
        if (site.customerId === customerId) {
          const siteWithFiles = checkStaticFiles(site);
          sites.push({
            ...site,
            files_exist: siteWithFiles.files_exist,
            actual_domain: siteWithFiles.actual_domain
          });
        }
      }
    }
    
    res.json(sites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search sites
router.get('/sites/search', async (req, res) => {
  try {
    const { customerId } = req;
    const { search, type } = req.query;
    const keys = await sitesIndex.listAllSiteKeys();
    const sites = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const site = JSON.parse(data);
        if (site.customerId === customerId) {
          // Apply filters
          if (type && site.type !== type) continue;
          if (search && !site.domain?.toLowerCase().includes(search.toLowerCase())) continue;
          
          const siteWithFiles = checkStaticFiles(site);
          sites.push({
            ...site,
            files_exist: siteWithFiles.files_exist,
            actual_domain: siteWithFiles.actual_domain
          });
        }
      }
    }
    
    res.json({
      data: sites,
      total: sites.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific site
router.get('/sites/:domain', async (req, res) => {
  try {
    const { customerId } = req;
    const { domain } = req.params;
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const siteWithFiles = checkStaticFiles(site);
    res.json({
      ...site,
      files_exist: siteWithFiles.files_exist,
      actual_domain: siteWithFiles.actual_domain
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new site
router.post('/sites', async (req, res) => {
  try {
    const { customerId } = req;
    const siteData = req.body;

    if (!siteData.domain || !siteData.type) {
      return res.status(400).json({ error: 'Domain and type are required' });
    }
    const exists = await redisClient.exists(`site:${siteData.domain}`);
    if (exists) {
      return res.status(409).json({ error: 'Domain already exists' });
    }

    const site = {
      ...siteData,
      customerId,
      enabled: siteData.enabled !== false,
      // SSL is always on. Callers can't opt out — every site is served
      // over HTTPS with a Let's Encrypt cert auto-issued on first request.
      ssl_enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Schedule container/node workloads on Nomad before we write Redis so a
    // deploy failure doesn't leave a dangling site record.
    if (site.type === 'container' || site.type === 'node') {
      try {
        site.orchestrator = 'nomad';
        const deployed = await nomad.deploySite(site);
        site.nomadJobId = deployed.jobId;
        site.nomadEvalId = deployed.evalId;
      } catch (error) {
        return res.status(500).json({ error: 'Nomad deployment failed', details: error.message });
      }
    }

    await redisClient.set(`site:${site.domain}`, JSON.stringify(site));
    await sitesIndex.registerSite(site.domain, customerId);

    // Aliases: every extra domain routes to the primary site's content.
    // Each alias gets an `alias:<domain>` key pointing at the primary, and
    // we kick off ACME for each so custom domains auto-issue certs once
    // DNS resolves to us.
    if (Array.isArray(site.aliases) && site.aliases.length > 0) {
      for (const alias of site.aliases) {
        if (typeof alias === 'string' && alias.trim()) {
          await redisClient.set(`alias:${alias.trim()}`, site.domain);
          if (site.ssl_enabled) {
            require('../utils/auto-cert').maybeAutoIssueCert({
              ...site, domain: alias.trim(),
            });
          }
        }
      }
    }

    // Non-blocking ACME issuance — the renewal scheduler will retry if DNS
    // hasn't propagated yet.
    require('../utils/auto-cert').maybeAutoIssueCert(site);

    // Fire site_created / custom_domain_added notifications. Non-blocking —
    // look up the owning customer's email for the "to" field. If the site
    // uses a *.spinforge.dev subdomain we treat it as a hosted domain (no
    // DNS setup needed) and send `site_created`. Custom domains get the
    // DNS-setup walkthrough instead.
    try {
      const notify = req.app?.locals?.notifications;
      if (notify) {
        const custRaw = await redisClient.get(`customer:${customerId}`);
        const customer = custRaw ? JSON.parse(custRaw) : null;
        const to = customer?.email;
        const isHosted = /\.spinforge\.dev$/i.test(site.domain);
        const event = isHosted ? 'site_created' : 'custom_domain_added';
        const context = {
          name: customer?.name || to || 'there',
          domain: site.domain,
          type: site.type,
          sslStatus: site.ssl_enabled ? 'auto-issuing' : 'disabled',
          edgeIp: process.env.PUBLIC_IP || process.env.BASE_DOMAIN || 'the IP you were given',
        };
        notify.notify(event, { to, context });
      }
    } catch (_) { /* never let notify break the deploy */ }

    res.status(201).json(site);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update site. Accepts partial updates; containerConfig changes trigger a
// Nomad redeploy (new job submission on the existing jobId, rolling update).
router.put('/sites/:domain', async (req, res) => {
  try {
    const { customerId } = req;
    const { domain } = req.params;
    const updates = req.body;

    const site = await loadOwnedSite(req, res);
    if (!site) return;

    const oldConfig = site.containerConfig;
    const updated = {
      ...site,
      ...updates,
      customerId,           // lock: callers cannot change ownership
      domain: site.domain,  // lock: domain is the key, rename would be delete+create
      ssl_enabled: true,    // lock: SSL is always on, partners can't turn it off
      updatedAt: new Date().toISOString(),
    };

    const containerChanged =
      (updated.type === 'container' || updated.type === 'node') &&
      JSON.stringify(oldConfig) !== JSON.stringify(updated.containerConfig);

    if (containerChanged) {
      try {
        updated.orchestrator = 'nomad';
        const deployed = await nomad.deploySite(updated);
        updated.nomadJobId = deployed.jobId;
        updated.nomadEvalId = deployed.evalId;
      } catch (error) {
        return res.status(500).json({ error: 'Nomad redeploy failed', details: error.message });
      }
    }

    await redisClient.set(`site:${domain}`, JSON.stringify(updated));
    await sitesIndex.registerSite(domain, customerId);

    // Diff alias list and reconcile alias:* keys. Caller sends the full
    // desired set of aliases each time (idempotent); we add new ones and
    // remove any that were dropped.
    if (updates.aliases !== undefined) {
      const oldAliases = Array.isArray(site.aliases) ? site.aliases : [];
      const newAliases = Array.isArray(updated.aliases) ? updated.aliases : [];
      const newSet = new Set(newAliases.map((a) => String(a).trim()).filter(Boolean));
      for (const a of oldAliases) {
        if (!newSet.has(String(a).trim())) {
          await redisClient.del(`alias:${String(a).trim()}`);
        }
      }
      for (const a of newSet) {
        await redisClient.set(`alias:${a}`, domain);
        if (updated.ssl_enabled) {
          require('../utils/auto-cert').maybeAutoIssueCert({ ...updated, domain: a });
        }
      }
    }

    require('../utils/auto-cert').maybeAutoIssueCert(updated);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete site — tears down Nomad job, clears Redis index, removes static
// files if any. Container workloads and static files both cleaned up.
router.delete('/sites/:domain', async (req, res) => {
  try {
    const { customerId } = req;
    const { domain } = req.params;
    const site = await loadOwnedSite(req, res);
    if (!site) return;

    if (site.type === 'container' || site.type === 'node') {
      try { await nomad.stopSite(domain, { purge: true }); }
      catch (e) { console.error('nomad teardown failed:', e.message); }
    }

    if (site.type === 'static') {
      const folder = domain.replace(/\./g, '_');
      const staticPath = path.join(STATIC_ROOT, folder);
      try { fs.rmSync(staticPath, { recursive: true, force: true }); } catch (_) {}
    }

    if (Array.isArray(site.aliases)) {
      for (const a of site.aliases) {
        if (a) await redisClient.del(`alias:${String(a).trim()}`);
      }
    }

    await redisClient.del(`site:${domain}`);
    await sitesIndex.unregisterSite(domain, customerId);
    res.json({ message: 'Site deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload static site ZIP. Expects multipart/form-data with field "zipfile".
// Extracts into /data/static/<folder> where folder = domain with dots → _.
router.post('/sites/:domain/upload', upload.single('zipfile'), async (req, res) => {
  try {
    const { domain } = req.params;
    const site = await loadOwnedSite(req, res);
    if (!site) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
      return;
    }
    if (site.type !== 'static') {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
      return res.status(400).json({ error: 'Site is not a static type' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded (field name: zipfile)' });
    }

    const folder = domain.replace(/\./g, '_');
    const staticPath = path.join(STATIC_ROOT, folder);
    try { fs.rmSync(staticPath, { recursive: true, force: true }); } catch (_) {}
    fs.mkdirSync(staticPath, { recursive: true });

    try {
      const zip = new AdmZip(req.file.path);
      zip.extractAllTo(staticPath, true);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid zip file', details: error.message });
    } finally {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }

    site.static_path = staticPath;
    site.lastUploadAt = new Date().toISOString();
    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    res.json({ message: 'Upload complete', path: staticPath });
  } catch (error) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
    res.status(500).json({ error: error.message });
  }
});

// Container readiness — how many allocations are running + healthy.
router.get('/sites/:domain/readiness', async (req, res) => {
  try {
    const site = await loadOwnedSite(req, res);
    if (!site) return;
    if (site.type !== 'container' && site.type !== 'node') {
      return res.json({ ready: true, type: site.type, status: 'n/a' });
    }
    const status = await nomad.getSiteStatus(site.domain);
    if (!status) return res.json({ ready: false, status: 'not_deployed' });
    const allocs = status.allocations || [];
    const running = allocs.filter((a) => a.status === 'running').length;
    const healthy = allocs.filter((a) => a.healthy).length;
    res.json({
      ready: running > 0 && healthy === running,
      status: running > 0 ? (healthy === running ? 'ready' : 'starting') : 'not_running',
      allocations: allocs,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Container health (alias surface used by admin UI).
router.get('/sites/:domain/containers', async (req, res) => {
  try {
    const site = await loadOwnedSite(req, res);
    if (!site) return;
    if (site.type !== 'container' && site.type !== 'node') return res.json({ containers: [] });
    const status = await nomad.getSiteStatus(site.domain);
    res.json({
      jobId: status?.jobId || null,
      status: status?.status || 'not_deployed',
      allocations: status?.allocations || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Container actions: start / stop / restart / rebuild.
router.post('/sites/:domain/container/:action', async (req, res) => {
  try {
    const { action } = req.params;
    if (!['start', 'stop', 'restart', 'rebuild'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    const site = await loadOwnedSite(req, res);
    if (!site) return;
    if (site.type !== 'container' && site.type !== 'node') {
      return res.status(400).json({ error: 'Not a container site' });
    }

    if (action === 'stop') {
      await nomad.stopSite(site.domain, { purge: false });
      return res.json({ message: 'Workload stopped' });
    }
    // start / restart / rebuild all go through a (re)deploy.
    if (action === 'restart') {
      await nomad.stopSite(site.domain, { purge: false }).catch(() => {});
    }
    const deployed = await nomad.deploySite(site);
    site.nomadJobId = deployed.jobId;
    site.nomadEvalId = deployed.evalId;
    site.updatedAt = new Date().toISOString();
    await redisClient.set(`site:${site.domain}`, JSON.stringify(site));
    res.json({ message: `Workload ${action}ed`, jobId: deployed.jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tail the first-running allocation's stdout/stderr.
router.get('/sites/:domain/logs', async (req, res) => {
  try {
    const site = await loadOwnedSite(req, res);
    if (!site) return;
    if (site.type !== 'container' && site.type !== 'node') return res.json({ logs: '' });
    const lines = parseInt(req.query.lines, 10) || 200;
    const type = req.query.stream === 'stderr' ? 'stderr' : 'stdout';
    const result = await nomad.getSiteLogs(site.domain, { lines, type });
    if (!result) return res.json({ logs: '' });
    res.json({ logs: result.body || '', alloc: result.alloc, node: result.node });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy delete-by-deployment-id — id is the domain in this system. Same
// teardown as DELETE /sites/:domain.
router.delete('/deployments/:id', async (req, res) => {
  try {
    const { customerId } = req;
    const { id } = req.params;
    const data = await redisClient.get(`site:${id}`);
    if (!data) return res.status(404).json({ error: 'Deployment not found' });
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (site.type === 'container' || site.type === 'node') {
      try { await nomad.stopSite(id, { purge: true }); }
      catch (e) { console.error('nomad teardown failed:', e.message); }
    }
    if (site.type === 'static') {
      const folder = id.replace(/\./g, '_');
      try { fs.rmSync(path.join(STATIC_ROOT, folder), { recursive: true, force: true }); } catch (_) {}
    }

    await redisClient.del(`site:${id}`);
    await sitesIndex.unregisterSite(id, customerId);
    res.json({ message: 'Deployment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get deployment logs
router.get('/deployments/:id/logs', async (req, res) => {
  try {
    const { customerId } = req;
    const { id } = req.params;
    const { lines = 100 } = req.query;
    
    const data = await redisClient.get(`site:${id}`);
    if (!data) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    // Get logs from Redis
    const logsKey = `logs:${site.domain}`;
    const logs = await redisClient.lRange(logsKey, 0, parseInt(lines) - 1);
    
    res.json({
      logs: logs.map(log => {
        try {
          return JSON.parse(log);
        } catch (e) {
          return { message: log };
        }
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get deployment metrics
router.get('/deployments/:id/metrics', async (req, res) => {
  try {
    const { customerId } = req;
    const { id } = req.params;
    
    const data = await redisClient.get(`site:${id}`);
    if (!data) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    const site = JSON.parse(data);
    if (site.customerId !== customerId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    // Get metrics from Redis
    const metricsData = await redisClient.hGetAll(`metrics:${site.domain}`);
    
    res.json({
      domain: site.domain,
      metrics: {
        requests: parseInt(metricsData.requests || 0),
        errors: parseInt(metricsData.errors || 0),
        bandwidth: parseInt(metricsData.totalBandwidth || 0),
        avgResponseTime: parseFloat(metricsData.avgResponseTime || 0),
        lastUpdated: metricsData.lastUpdated || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;