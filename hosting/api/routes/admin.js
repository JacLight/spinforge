/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');
const CustomerService = require('../services/CustomerService');
const { adminService, adminTokenService, authenticateAdmin } = require('../utils/admin-auth');
const sitesIndex = require('../utils/sites-index');
const PartnerService = require('../services/PartnerService');

const partnerService = new PartnerService(redisClient);
const certificatesRouter = require('./certificates');

// Initialize services
const customerService = new CustomerService(redisClient);

const {
  validateSetupToken,
  clearSetupToken,
} = require('../utils/admin-bootstrap');
const { rateLimit } = require('../utils/rate-limit');

// Surface whether first-run setup is needed so the admin UI can redirect
// to the setup screen instead of showing a login form nobody can use.
router.get('/setup/status', async (req, res) => {
  try {
    const admins = await adminService.getAllAdmins();
    res.json({ setupRequired: admins.length === 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// First-run admin bootstrap. Consumes the one-time token written to
// /data/admin/first-run-token.txt and creates the initial super-admin.
// Fails once an admin already exists — this endpoint never edits an
// existing account.
router.post('/setup', rateLimit({ name: 'admin-setup', max: 5, windowSec: 60 }), async (req, res) => {
  try {
    const { setupToken, username, password, email } = req.body || {};

    const admins = await adminService.getAllAdmins();
    if (admins.length > 0) {
      return res.status(409).json({ error: 'Admin already provisioned' });
    }

    if (!validateSetupToken(setupToken)) {
      return res.status(401).json({ error: 'Invalid or expired setup token' });
    }
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (password.length < 10) {
      return res.status(400).json({ error: 'password must be at least 10 characters' });
    }

    const admin = await adminService.createAdmin({
      username,
      password,
      email: email || 'admin@spinforge.local',
      isSuperAdmin: true,
    });
    clearSetupToken();

    res.json({ message: 'Admin created. Log in at /_admin/login.', admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public admin routes (no auth required)
router.post('/login', rateLimit({ name: 'admin-login', max: 5, windowSec: 60 }), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await adminService.login(username, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply authentication to all routes below
router.use(authenticateAdmin);

// Mount certificate routes
router.use('/certificates', certificatesRouter);

// Admin logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers['x-admin-token'];
    await adminService.logout(token);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer management endpoints
router.get('/customers', async (req, res) => {
  try {
    const filter = {
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await customerService.getAllCustomers(filter);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await customerService.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/customers', async (req, res) => {
  try {
    if (!req.admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can create customers' });
    }

    const { name, email, metadata, limits } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const customer = await customerService.createCustomer({
      name,
      email,
      metadata,
      limits
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/customers/:id', async (req, res) => {
  try {
    if (!req.admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can update customers' });
    }

    const customer = await customerService.updateCustomer(req.params.id, req.body);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/customers/:id', async (req, res) => {
  try {
    if (!req.admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can delete customers' });
    }

    const success = await customerService.deleteCustomer(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer routes/sites
router.get('/customers/:customerId/routes', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Get domains owned by this customer from the maintained index.
    const domains = await sitesIndex.listDomainsForCustomer(customerId);
    const siteKeys = domains.map((d) => `site:${d}`);
    const routes = [];
    
    for (const key of siteKeys) {
      const siteData = await redisClient.get(key);
      if (siteData) {
        const site = JSON.parse(siteData);
        if (site.customerId === customerId) {
          routes.push({
            domain: site.domain,
            customerId: site.customerId,
            spinletId: site.domain,
            buildPath: site.static_path || '/',
            framework: site.type,
            config: {
              type: site.type,
              target: site.target,
              enabled: site.enabled !== false
            }
          });
        }
      }
    }
    
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin user management endpoints
router.get('/admins', async (req, res) => {
  try {
    const admins = await adminService.getAllAdmins();
    res.json({
      admins,
      total: admins.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admins/:id', async (req, res) => {
  try {
    const admin = await adminService.getAdmin(req.params.id);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admins', async (req, res) => {
  try {
    if (!req.admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can create other admins' });
    }

    const { username, password, email, isSuperAdmin } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await adminService.createAdmin({
      username,
      password,
      email,
      isSuperAdmin
    });

    res.status(201).json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/admins/:id', async (req, res) => {
  try {
    if (!req.admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can update other admins' });
    }

    const admin = await adminService.updateAdmin(req.params.id, req.body);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admins/:id', async (req, res) => {
  try {
    if (!req.admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can delete other admins' });
    }

    if (req.admin.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    const success = await adminService.deleteAdmin(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Profile endpoints (for current logged-in admin)
router.get('/profile', async (req, res) => {
  try {
    const admin = await adminService.getAdmin(req.admin.id);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const { username, email } = req.body;
    const updates = {};
    
    if (username) updates.username = username;
    if (email !== undefined) updates.email = email;
    
    const admin = await adminService.updateAdmin(req.admin.id, updates);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/profile/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    // Verify current password
    const isValid = await adminService.verifyPassword(req.admin.id, currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Update password
    const admin = await adminService.updateAdmin(req.admin.id, { password: newPassword });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings endpoints
router.get('/settings', async (req, res) => {
  try {
    const settingsData = await redisClient.get('system:settings');
    const settings = settingsData ? JSON.parse(settingsData) : {
      build: {
        deploymentPath: '/deployments',
        buildPath: '/build',
        webRootPath: '/var/www/static',
        startupTimeoutMs: 30000,
        buildTimeout: 300,
        idleTimeout: 300,
        enableBuildCache: true,
        maxConcurrentBuilds: 5
      },
      resources: {
        idleTimeoutMs: 300000,
        memoryLimit: '512Mi',
        cpuLimit: '1',
        portRange: {
          start: 4000,
          end: 5000
        },
        defaultMemory: '256Mi',
        defaultCpu: '0.5',
        maxMemory: '1Gi',
        maxCpu: '2'
      },
      networking: {
        bindHost: '0.0.0.0',
        publicUrl: 'http://localhost:8080',
        corsOrigins: ['*'],
        portRangeStart: 4000,
        portRangeEnd: 5000,
        reverseProxyUrl: 'http://localhost:80',
        defaultDomainSuffix: '.spinforge.local'
      },
      security: {
        adminToken: true,
        enableRateLimit: true,
        rateLimit: 100,
        enableSSL: false,
        allowedFrameworks: ['nodejs', 'static', 'python', 'php'],
        enableAuth: true,
        requireAuth: false,
        allowedOrigins: ['*']
      },
      notifications: {
        emailNotifications: false,
        notificationEmail: 'admin@spinforge.local',
        slackWebhook: '',
        webhookUrl: '',
        alertChannels: ['console']
      },
      maintenance: {
        autoBackup: false,
        backupInterval: 'daily',
        autoCleanup: true,
        cleanupAge: 7,
        logRetention: 7,
        metricsRetention: 30,
        cleanupInterval: 3600,
        maxLogSize: '100Mi'
      }
    };
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    if (!req.admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can update settings' });
    }

    const currentSettingsData = await redisClient.get('system:settings');
    const currentSettings = currentSettingsData ? JSON.parse(currentSettingsData) : {};
    
    const updatedSettings = {
      ...currentSettings,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.admin.username
    };
    
    await redisClient.set('system:settings', JSON.stringify(updatedSettings));
    
    res.json({ settings: updatedSettings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats for admin
router.get('/stats', async (req, res) => {
  try {
    // Get customer count
    const customerResult = await customerService.getAllCustomers({ limit: 0 });
    
    // Get site count
    const siteDomains = await sitesIndex.listAllDomains();
    const siteKeys = siteDomains.map((d) => `site:${d}`);
    
    // Get admin count
    const admins = await adminService.getAllAdmins();
    
    // Count sites by type
    const sitesByType = {
      static: 0,
      proxy: 0,
      container: 0,
      loadbalancer: 0
    };
    
    for (const key of siteKeys) {
      const siteData = await redisClient.get(key);
      if (siteData) {
        const site = JSON.parse(siteData);
        if (sitesByType[site.type] !== undefined) {
          sitesByType[site.type]++;
        }
      }
    }
    
    res.json({
      totalCustomers: customerResult.total,
      totalSites: siteKeys.length,
      totalAdmins: admins.length,
      sitesByType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Admin API Tokens ──────────────────────────────────────────────────────
// Multi-token API access for admin users. Used by automation/CI to call
// admin-gated endpoints (/api/* and /_admin/*) without holding a JWT session.

// List all admin API tokens
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await adminTokenService.listTokens();
    res.json({ tokens });
  } catch (error) {
    console.error('Failed to list admin tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new admin API token. The plaintext is returned exactly once.
router.post('/tokens', async (req, res) => {
  try {
    const { name, expiry, role } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Token name is required' });
    }

    const created = await adminTokenService.createToken({
      name,
      expiry,
      role,
      createdBy: req.admin?.username || 'admin',
    });

    res.status(201).json(created);
  } catch (error) {
    if (error.code === 'DUPLICATE_NAME') {
      return res.status(409).json({ error: error.message });
    }
    if (/Invalid role/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to create admin token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Revoke ALL admin API tokens. Used for incident response.
//   ?keepCurrent=1  → preserve the calling token if the request is using one
// IMPORTANT: this route MUST be defined before /tokens/:id so the /:id matcher
// does not capture the bare /tokens DELETE as if "tokens" were the id.
router.delete('/tokens', async (req, res) => {
  try {
    const keepCurrent = req.query.keepCurrent === '1' || req.query.keepCurrent === 'true';
    const exceptId = keepCurrent ? req.admin?.tokenId : null;

    const revoked = await adminTokenService.deleteAll({ exceptId });

    res.json({
      success: true,
      revoked,
      kept: exceptId ? 1 : 0,
      message: exceptId
        ? `Revoked ${revoked} tokens. Your current token was preserved.`
        : `Revoked ${revoked} tokens.`,
    });
  } catch (error) {
    console.error('Failed to bulk-revoke admin tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Third-party Partners ──────────────────────────────────────────────────
// Partner registration lives under /_admin/partners/*. Partner keys grant
// access to the public /_partners/exchange endpoint, which lets partner
// backends trade a customer token (from their own auth system) for a
// SpinForge customer token scoped to that customer.

// List all partners
router.get('/partners', async (req, res) => {
  try {
    const partners = await partnerService.listPartners();
    res.json({ partners });
  } catch (error) {
    console.error('Failed to list partners:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new partner. The plaintext API key is returned EXACTLY ONCE.
router.post('/partners', async (req, res) => {
  try {
    const created = await partnerService.createPartner(req.body || {});
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 'DUPLICATE_NAME') {
      return res.status(409).json({ error: error.message });
    }
    if (/required|valid/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to create partner:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get one partner
router.get('/partners/:id', async (req, res) => {
  try {
    const partner = await partnerService.getPartner(req.params.id);
    if (!partner) return res.status(404).json({ error: 'Partner not found' });
    res.json(partnerService.toPublic(partner));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a partner (name, validation URL, method, headers, enabled flag, etc.)
router.put('/partners/:id', async (req, res) => {
  try {
    const updated = await partnerService.updatePartner(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Partner not found' });
    res.json(updated);
  } catch (error) {
    if (error.code === 'DUPLICATE_NAME') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Rotate the partner's API key. Returns the new plaintext key (shown once).
router.post('/partners/:id/rotate-key', async (req, res) => {
  try {
    const rotated = await partnerService.rotateApiKey(req.params.id);
    if (!rotated) return res.status(404).json({ error: 'Partner not found' });
    res.json(rotated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a partner (invalidates their API key immediately)
router.delete('/partners/:id', async (req, res) => {
  try {
    const ok = await partnerService.deletePartner(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Partner not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Email templates + send history ───────────────────────────────────
//
// Operators edit the transactional email copy used by the api's
// notification hooks. All templates are seeded on first boot (see
// services/email-templates.default.js) so this endpoint can't create
// brand-new events — it only updates existing ones. Send-test hits SES
// directly using the current template content so edits can be verified
// before the real event fires.

const EmailTemplateService = require('../services/EmailTemplateService');
const NotificationService  = require('../services/NotificationService');
const { sendEmail, mailerStatus } = require('../utils/ses');
const emailTemplates = new EmailTemplateService(redisClient);

router.get('/email-templates', async (req, res) => {
  try {
    const templates = await emailTemplates.list();
    res.json({ templates, mailer: mailerStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/email-templates/:event', async (req, res) => {
  try {
    const tmpl = await emailTemplates.get(req.params.event);
    if (!tmpl) return res.status(404).json({ error: 'Template not found' });
    res.json(tmpl);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/email-templates/:event', async (req, res) => {
  try {
    const allowed = ['subject', 'html', 'text', 'enabled', 'variables'];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    const updated = await emailTemplates.update(req.params.event, patch);
    res.json(updated);
  } catch (error) {
    const status = /not found/i.test(error.message) ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Render + send the current template against arbitrary context, straight
// to SES (no queue, no retries) so operators can iterate on copy without
// waiting for real events.
router.post('/email-templates/:event/test', async (req, res) => {
  try {
    const { to, context = {} } = req.body || {};
    if (!to) return res.status(400).json({ error: '"to" is required' });
    const tmpl = await emailTemplates.get(req.params.event);
    if (!tmpl) return res.status(404).json({ error: 'Template not found' });

    const rendered = emailTemplates.render(tmpl, context);
    const messageId = await sendEmail({
      to,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });
    res.json({ sent: true, messageId, rendered });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recent send log (bounded list maintained by EmailWorker).
router.get('/email-templates/log/recent', async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    const notifications = new NotificationService(redisClient);
    const entries = await notifications.recentLog(limit);
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Revoke an admin API token by id
router.delete('/tokens/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Don't let an API token revoke itself — that would lock the caller out
    // mid-request and confuse downstream code that may still rely on req.admin.
    if (req.admin?.tokenId === id) {
      return res.status(400).json({
        error: 'A token cannot revoke itself. Use a different token or session.',
      });
    }

    const ok = await adminTokenService.deleteToken(id);
    if (!ok) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete admin token:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;