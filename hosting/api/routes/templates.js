/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * Licensed under the MIT License
 */

const express = require('express');
const router = express.Router();
const redis = require('redis');

// Create Redis client
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'keydb',
    port: parseInt(process.env.REDIS_PORT || 16378)
  },
  password: process.env.REDIS_PASSWORD || undefined,
  database: parseInt(process.env.REDIS_DB || 1)
});

// Connect to Redis
(async () => {
  await redisClient.connect();
})();

// Get all templates
router.get('/', async (req, res) => {
  try {
    const keys = await redisClient.keys('template:*');
    const templates = [];
    
    for (const key of keys) {
      const template = await redisClient.get(key);
      if (template) {
        templates.push(JSON.parse(template));
      }
    }
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific template
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await redisClient.get(`template:${id}`);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(JSON.parse(template));
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new template
router.post('/', async (req, res) => {
  try {
    const template = {
      id: req.body.id || `template-${Date.now()}`,
      name: req.body.name,
      description: req.body.description,
      category: req.body.category, // 'container', 'proxy', 'static', 'loadbalancer'
      icon: req.body.icon,
      config: req.body.config, // The actual deployment configuration
      variables: req.body.variables || [], // Template variables that can be customized
      tags: req.body.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Validate required fields
    if (!template.name || !template.category || !template.config) {
      return res.status(400).json({ error: 'Name, category, and config are required' });
    }
    
    // Check if template already exists
    const existing = await redisClient.get(`template:${template.id}`);
    if (existing) {
      return res.status(409).json({ error: 'Template with this ID already exists' });
    }
    
    await redisClient.set(`template:${template.id}`, JSON.stringify(template));
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a template
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await redisClient.get(`template:${id}`);
    
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const template = JSON.parse(existing);
    
    // Update fields
    if (req.body.name !== undefined) template.name = req.body.name;
    if (req.body.description !== undefined) template.description = req.body.description;
    if (req.body.category !== undefined) template.category = req.body.category;
    if (req.body.icon !== undefined) template.icon = req.body.icon;
    if (req.body.config !== undefined) template.config = req.body.config;
    if (req.body.variables !== undefined) template.variables = req.body.variables;
    if (req.body.tags !== undefined) template.tags = req.body.tags;
    
    template.updatedAt = new Date().toISOString();
    
    await redisClient.set(`template:${id}`, JSON.stringify(template));
    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await redisClient.get(`template:${id}`);
    
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    await redisClient.del(`template:${id}`);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deploy from template
router.post('/:id/deploy', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await redisClient.get(`template:${id}`);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const templateData = JSON.parse(template);
    const { domain, customerName, deployName, variables = {} } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    
    if (!customerName || !deployName) {
      return res.status(400).json({ error: 'Customer name and deployment name are required' });
    }
    
    // Process the template config with variables
    let config = JSON.parse(JSON.stringify(templateData.config));
    
    // Add system variables that can be used in templates
    const allVariables = {
      ...variables,
      customerName,
      deployName,
      domain,
      namespace: `${customerName}-${deployName}` // Useful for naming resources
    };
    
    // Replace template variables with provided values
    const processVariables = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          // Replace {{variable}} with actual values
          obj[key] = obj[key].replace(/\{\{(\w+)\}\}/g, (match, varName) => {
            return allVariables[varName] || match;
          });
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          processVariables(obj[key]);
        }
      }
    };
    
    processVariables(config);
    
    // Add domain and metadata to config
    config.domain = domain;
    config.enabled = true;
    config.fromTemplate = templateData.id;
    config.customerName = customerName;
    config.deployName = deployName;
    config.customerId = customerName; // For backwards compatibility
    config.createdAt = new Date().toISOString();
    config.updatedAt = new Date().toISOString();
    
    // Deploy based on category
    if (templateData.category === 'container') {
      // For containers, we need to namespace the container name
      // Format: spinforge-{customerName}-{deployName}
      config.containerName = `spinforge-${customerName}-${deployName}`;
      
      // Add container-specific metadata
      if (config.containerConfig) {
        // Namespace volumes and networks
        config.containerConfig.volumeMounts = config.containerConfig.volumeMounts?.map(v => ({
          ...v,
          name: `${customerName}-${deployName}-${v.name || 'data'}`
        })) || [];
        
        // Add labels for organization
        config.containerConfig.labels = {
          ...config.containerConfig.labels,
          'spinforge.customer': customerName,
          'spinforge.deployment': deployName,
          'spinforge.template': templateData.id,
          'spinforge.managed': 'true'
        };
      }
      
      // Use container deployment logic
      const axios = require('axios');
      const response = await axios.post(
        `http://localhost:${process.env.PORT || 8080}/api/containers/deploy`,
        config
      );
      res.json(response.data);
    } else if (templateData.category === 'proxy' || templateData.category === 'static' || templateData.category === 'loadbalancer') {
      // Use site deployment logic
      // Store with customer namespace in Redis
      const siteKey = `site:${domain}`;
      const customerSiteKey = `customer:${customerName}:site:${deployName}`;
      
      // Store both for lookup
      await redisClient.set(siteKey, JSON.stringify(config));
      await redisClient.set(customerSiteKey, JSON.stringify(config));
      
      // Add to customer's site list
      await redisClient.sadd(`customer:${customerName}:sites`, domain);
      
      res.json({ success: true, site: config });
    } else {
      res.status(400).json({ error: 'Unknown template category' });
    }
  } catch (error) {
    console.error('Error deploying from template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize with default templates
router.post('/init-defaults', async (req, res) => {
  try {
    const defaultTemplates = [
      {
        id: 'mongodb',
        name: 'MongoDB',
        description: 'MongoDB NoSQL database server',
        category: 'container',
        icon: '',
        config: {
          type: 'container',
          containerConfig: {
            image: 'mongo:latest',
            port: 27017,
            env: {
              MONGO_INITDB_ROOT_USERNAME: '{{username}}',
              MONGO_INITDB_ROOT_PASSWORD: '{{password}}',
              MONGO_INITDB_DATABASE: '{{database}}'
            },
            restartPolicy: 'unless-stopped',
            volumeMounts: [
              { name: 'data', path: '/data/db' }
            ]
          }
        },
        variables: [
          { name: 'username', label: 'Admin Username', type: 'text', default: 'admin', required: true },
          { name: 'password', label: 'Admin Password', type: 'password', required: true },
          { name: 'database', label: 'Initial Database', type: 'text', default: '{{deployName}}', required: false }
        ],
        tags: ['database', 'nosql', 'mongodb']
      },
      {
        id: 'postgresql',
        name: 'PostgreSQL',
        description: 'PostgreSQL relational database',
        category: 'container',
        icon: '',
        config: {
          type: 'container',
          containerConfig: {
            image: 'postgres:alpine',
            port: 5432,
            env: {
              POSTGRES_USER: '{{username}}',
              POSTGRES_PASSWORD: '{{password}}',
              POSTGRES_DB: '{{database}}'
            },
            restartPolicy: 'unless-stopped'
          }
        },
        variables: [
          { name: 'username', label: 'Database User', type: 'text', default: 'postgres', required: true },
          { name: 'password', label: 'Database Password', type: 'password', required: true },
          { name: 'database', label: 'Database Name', type: 'text', default: 'mydb', required: true }
        ],
        tags: ['database', 'sql', 'postgresql']
      },
      {
        id: 'redis',
        name: 'Redis',
        description: 'Redis in-memory data store',
        category: 'container',
        icon: '',
        config: {
          type: 'container',
          containerConfig: {
            image: 'redis:alpine',
            port: 6379,
            env: {},
            restartPolicy: 'unless-stopped'
          }
        },
        variables: [],
        tags: ['database', 'cache', 'redis']
      },
      {
        id: 'google-proxy',
        name: 'Google Proxy',
        description: 'Proxy to Google search',
        category: 'proxy',
        icon: '',
        config: {
          type: 'proxy',
          target: 'https://www.google.com',
          preserve_host: false,
          websocket_support: false
        },
        variables: [],
        tags: ['proxy', 'google']
      },
      {
        id: 'wordpress',
        name: 'WordPress',
        description: 'WordPress CMS with MySQL',
        category: 'container',
        icon: '',
        config: {
          type: 'container',
          containerConfig: {
            image: 'wordpress:latest',
            port: 80,
            env: {
              WORDPRESS_DB_HOST: '{{db_host}}',
              WORDPRESS_DB_USER: '{{db_user}}',
              WORDPRESS_DB_PASSWORD: '{{db_password}}',
              WORDPRESS_DB_NAME: '{{db_name}}'
            },
            restartPolicy: 'unless-stopped'
          }
        },
        variables: [
          { name: 'db_host', label: 'Database Host', type: 'text', default: 'mysql', required: true },
          { name: 'db_user', label: 'Database User', type: 'text', default: 'wordpress', required: true },
          { name: 'db_password', label: 'Database Password', type: 'password', required: true },
          { name: 'db_name', label: 'Database Name', type: 'text', default: 'wordpress', required: true }
        ],
        tags: ['cms', 'wordpress', 'blog']
      },
      {
        id: 'nginx-static',
        name: 'Nginx Static',
        description: 'Nginx server for static files',
        category: 'container',
        icon: '',
        config: {
          type: 'container',
          containerConfig: {
            image: 'nginx:alpine',
            port: 80,
            env: {},
            restartPolicy: 'unless-stopped'
          }
        },
        variables: [],
        tags: ['webserver', 'static', 'nginx']
      }
    ];
    
    let created = 0;
    for (const template of defaultTemplates) {
      const existing = await redisClient.get(`template:${template.id}`);
      if (!existing) {
        template.createdAt = new Date().toISOString();
        template.updatedAt = new Date().toISOString();
        await redisClient.set(`template:${template.id}`, JSON.stringify(template));
        created++;
      }
    }
    
    res.json({ success: true, message: `Initialized ${created} default templates` });
  } catch (error) {
    console.error('Error initializing default templates:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;