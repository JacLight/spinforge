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
const AdminService = require('../services/AdminService');
const certificatesRouter = require('./certificates');

// Initialize services
const customerService = new CustomerService(redisClient);
const adminService = new AdminService(redisClient);

// Initialize default admin on startup
adminService.initializeDefaultAdmin();

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  const token = req.headers['x-admin-token'];
  
  if (!token) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const admin = await adminService.validateToken(token);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }

  req.admin = admin;
  next();
};

// Public admin routes (no auth required)
router.post('/login', async (req, res) => {
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
    
    // Get all sites and filter by customerId
    const siteKeys = await redisClient.keys('site:*');
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
    const siteKeys = await redisClient.keys('site:*');
    
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

module.exports = router;