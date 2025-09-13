/**
 * SpinForge - Template Library Management
 * Copyright (c) 2025 Jacob Ajiboye
 * Licensed under the MIT License
 *
 * Pre-built templates for common deployment scenarios
 */

const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');
const logger = require('../utils/logger');

// Built-in template library
const BUILTIN_TEMPLATES = [
  {
    id: 'wordpress-mysql',
    name: 'WordPress with MySQL',
    description: 'Complete WordPress setup with MySQL database',
    category: 'compose',
    icon: '📝',
    tags: ['cms', 'blog', 'php', 'mysql'],
    config: {
      type: 'compose',
      composeConfig: {
        version: '3.8',
        services: {
          wordpress: {
            image: 'wordpress:latest',
            ports: ['8080:80'],
            environment: [
              'WORDPRESS_DB_HOST={{domain}}-db',
              'WORDPRESS_DB_USER={{dbUser}}',
              'WORDPRESS_DB_PASSWORD={{dbPassword}}',
              'WORDPRESS_DB_NAME={{dbName}}'
            ],
            volumes: ['wordpress_data:/var/www/html'],
            depends_on: ['db']
          },
          db: {
            image: 'mysql:8.0',
            environment: [
              'MYSQL_DATABASE={{dbName}}',
              'MYSQL_USER={{dbUser}}',
              'MYSQL_PASSWORD={{dbPassword}}',
              'MYSQL_ROOT_PASSWORD={{rootPassword}}'
            ],
            volumes: ['db_data:/var/lib/mysql']
          }
        },
        volumes: {
          wordpress_data: {},
          db_data: {}
        }
      }
    },
    variables: [
      { name: 'dbUser', description: 'Database username', required: true, defaultValue: 'wordpress' },
      { name: 'dbPassword', description: 'Database password', required: true, defaultValue: '' },
      { name: 'dbName', description: 'Database name', required: true, defaultValue: 'wordpress' },
      { name: 'rootPassword', description: 'MySQL root password', required: true, defaultValue: '' }
    ]
  },
  {
    id: 'nodejs-express',
    name: 'Node.js Express App',
    description: 'Node.js application with Express framework',
    category: 'container',
    icon: '🟢',
    tags: ['nodejs', 'javascript', 'api', 'backend'],
    config: {
      type: 'container',
      containerConfig: {
        image: 'node:18-alpine',
        port: 3000,
        env: [
          { key: 'NODE_ENV', value: '{{environment}}' },
          { key: 'PORT', value: '3000' },
          { key: 'APP_NAME', value: '{{appName}}' }
        ],
        command: ['npm', 'start'],
        volumes: [
          { source: '{{appPath}}', target: '/app' }
        ],
        workingDir: '/app'
      }
    },
    variables: [
      { name: 'environment', description: 'Environment (development/production)', required: true, defaultValue: 'production' },
      { name: 'appName', description: 'Application name', required: true, defaultValue: 'my-app' },
      { name: 'appPath', description: 'Local app path', required: false, defaultValue: './app' }
    ]
  },
  {
    id: 'python-flask',
    name: 'Python Flask App',
    description: 'Python web application with Flask framework',
    category: 'container',
    icon: '🐍',
    tags: ['python', 'flask', 'api', 'backend'],
    config: {
      type: 'container',
      containerConfig: {
        image: 'python:3.11-slim',
        port: 5000,
        env: [
          { key: 'FLASK_APP', value: '{{appFile}}' },
          { key: 'FLASK_ENV', value: '{{environment}}' },
          { key: 'PYTHONUNBUFFERED', value: '1' }
        ],
        command: ['flask', 'run', '--host=0.0.0.0'],
        volumes: [
          { source: '{{appPath}}', target: '/app' }
        ],
        workingDir: '/app'
      }
    },
    variables: [
      { name: 'appFile', description: 'Main Flask application file', required: true, defaultValue: 'app.py' },
      { name: 'environment', description: 'Flask environment', required: true, defaultValue: 'production' },
      { name: 'appPath', description: 'Local app path', required: false, defaultValue: './app' }
    ]
  },
  {
    id: 'nginx-static',
    name: 'Nginx Static Site',
    description: 'High-performance static site with Nginx',
    category: 'container',
    icon: '🌐',
    tags: ['nginx', 'static', 'web', 'frontend'],
    config: {
      type: 'container',
      containerConfig: {
        image: 'nginx:alpine',
        port: 80,
        volumes: [
          { source: '{{contentPath}}', target: '/usr/share/nginx/html' },
          { source: '{{configPath}}', target: '/etc/nginx/conf.d' }
        ]
      }
    },
    variables: [
      { name: 'contentPath', description: 'Static content path', required: true, defaultValue: './public' },
      { name: 'configPath', description: 'Nginx config path', required: false, defaultValue: './nginx' }
    ]
  },
  {
    id: 'postgres-db',
    name: 'PostgreSQL Database',
    description: 'PostgreSQL database server',
    category: 'container',
    icon: '🐘',
    tags: ['database', 'postgresql', 'sql'],
    config: {
      type: 'container',
      containerConfig: {
        image: 'postgres:15-alpine',
        port: 5432,
        env: [
          { key: 'POSTGRES_DB', value: '{{dbName}}' },
          { key: 'POSTGRES_USER', value: '{{dbUser}}' },
          { key: 'POSTGRES_PASSWORD', value: '{{dbPassword}}' }
        ],
        volumes: [
          { source: 'postgres_data', target: '/var/lib/postgresql/data' }
        ]
      }
    },
    variables: [
      { name: 'dbName', description: 'Database name', required: true, defaultValue: 'mydb' },
      { name: 'dbUser', description: 'Database user', required: true, defaultValue: 'postgres' },
      { name: 'dbPassword', description: 'Database password', required: true, defaultValue: '' }
    ]
  },
  {
    id: 'redis-cache',
    name: 'Redis Cache',
    description: 'Redis in-memory data store',
    category: 'container',
    icon: '🔴',
    tags: ['cache', 'redis', 'nosql', 'memory'],
    config: {
      type: 'container',
      containerConfig: {
        image: 'redis:7-alpine',
        port: 6379,
        env: [],
        command: ['redis-server', '--requirepass', '{{password}}'],
        volumes: [
          { source: 'redis_data', target: '/data' }
        ]
      }
    },
    variables: [
      { name: 'password', description: 'Redis password', required: false, defaultValue: '' }
    ]
  },
  {
    id: 'mongodb',
    name: 'MongoDB Database',
    description: 'MongoDB NoSQL database',
    category: 'container',
    icon: '🍃',
    tags: ['database', 'mongodb', 'nosql'],
    config: {
      type: 'container',
      containerConfig: {
        image: 'mongo:6',
        port: 27017,
        env: [
          { key: 'MONGO_INITDB_ROOT_USERNAME', value: '{{rootUser}}' },
          { key: 'MONGO_INITDB_ROOT_PASSWORD', value: '{{rootPassword}}' },
          { key: 'MONGO_INITDB_DATABASE', value: '{{dbName}}' }
        ],
        volumes: [
          { source: 'mongo_data', target: '/data/db' }
        ]
      }
    },
    variables: [
      { name: 'rootUser', description: 'Root username', required: true, defaultValue: 'admin' },
      { name: 'rootPassword', description: 'Root password', required: true, defaultValue: '' },
      { name: 'dbName', description: 'Initial database', required: true, defaultValue: 'mydb' }
    ]
  },
  {
    id: 'react-app',
    name: 'React Application',
    description: 'React single-page application',
    category: 'static',
    icon: '⚛️',
    tags: ['react', 'frontend', 'javascript', 'spa'],
    config: {
      type: 'static',
      defaultContent: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{appTitle}}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 800px; margin: 50px auto; text-align: center; }
        h1 { color: #61dafb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>{{appTitle}}</h1>
        <p>Your React app will be deployed here</p>
    </div>
</body>
</html>`
    },
    variables: [
      { name: 'appTitle', description: 'Application title', required: true, defaultValue: 'My React App' }
    ]
  },
  {
    id: 'loadbalancer-basic',
    name: 'Basic Load Balancer',
    description: 'Simple load balancer with health checks',
    category: 'loadbalancer',
    icon: '⚖️',
    tags: ['loadbalancer', 'proxy', 'scaling'],
    config: {
      type: 'loadbalancer',
      backends: [
        {
          url: 'http://{{backend1}}',
          label: 'primary',
          weight: 50,
          enabled: true,
          healthCheck: {
            path: '/health',
            interval: 10,
            timeout: 5,
            unhealthyThreshold: 3,
            healthyThreshold: 2
          }
        },
        {
          url: 'http://{{backend2}}',
          label: 'secondary',
          weight: 50,
          enabled: true,
          healthCheck: {
            path: '/health',
            interval: 10,
            timeout: 5,
            unhealthyThreshold: 3,
            healthyThreshold: 2
          }
        }
      ],
      stickySessionDuration: 3600
    },
    variables: [
      { name: 'backend1', description: 'Primary backend URL', required: true, defaultValue: 'backend1:3000' },
      { name: 'backend2', description: 'Secondary backend URL', required: true, defaultValue: 'backend2:3000' }
    ]
  },
  {
    id: 'openvscode-server',
    name: 'OpenVSCode Server',
    description: 'Browser-based VS Code development environment',
    category: 'container',
    icon: '💻',
    tags: ['ide', 'development', 'vscode', 'coding'],
    config: {
      type: 'container',
      containerConfig: {
        image: 'gitpod/openvscode-server:latest',
        port: 3000,
        env: [
          { key: 'OPENVSCODE_SERVER_ROOT', value: '/home/workspace' }
        ],
        volumes: [
          { source: 'workspace', target: '/home/workspace' }
        ],
        command: ['sh', '-c', 'exec /home/.openvscode-server/bin/openvscode-server --host 0.0.0.0 --without-connection-token']
      }
    },
    variables: []
  }
];

/**
 * Get all templates (built-in + custom)
 */
router.get('/', async (req, res) => {
  try {
    const { category, tags, search } = req.query;

    // Get custom templates from Redis
    const customKeys = await redisClient.keys('template:*');
    const customTemplates = [];

    for (const key of customKeys) {
      const template = await redisClient.get(key);
      if (template) {
        customTemplates.push(JSON.parse(template));
      }
    }

    // Combine built-in and custom templates
    let allTemplates = [...BUILTIN_TEMPLATES, ...customTemplates];

    // Filter by category
    if (category) {
      allTemplates = allTemplates.filter(t => t.category === category);
    }

    // Filter by tags
    if (tags) {
      const tagList = tags.split(',');
      allTemplates = allTemplates.filter(t =>
        t.tags && tagList.some(tag => t.tags.includes(tag))
      );
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allTemplates = allTemplates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    res.json({
      templates: allTemplates,
      total: allTemplates.length,
      builtIn: BUILTIN_TEMPLATES.length,
      custom: customTemplates.length
    });

  } catch (error) {
    logger.error('Error fetching template library:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get template categories
 */
router.get('/categories', async (req, res) => {
  const categories = [
    { id: 'container', name: 'Container', icon: '🐳', description: 'Single container applications' },
    { id: 'compose', name: 'Compose', icon: '📦', description: 'Multi-container applications' },
    { id: 'static', name: 'Static', icon: '📄', description: 'Static websites' },
    { id: 'proxy', name: 'Proxy', icon: '🔀', description: 'Reverse proxy configurations' },
    { id: 'loadbalancer', name: 'Load Balancer', icon: '⚖️', description: 'Load balancing setups' }
  ];

  res.json(categories);
});

/**
 * Get popular tags
 */
router.get('/tags', async (req, res) => {
  try {
    const tagCount = new Map();

    // Count tags from built-in templates
    BUILTIN_TEMPLATES.forEach(template => {
      if (template.tags) {
        template.tags.forEach(tag => {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
        });
      }
    });

    // Count tags from custom templates
    const customKeys = await redisClient.keys('template:*');
    for (const key of customKeys) {
      const template = await redisClient.get(key);
      if (template) {
        const parsed = JSON.parse(template);
        if (parsed.tags) {
          parsed.tags.forEach(tag => {
            tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
          });
        }
      }
    }

    // Sort by count and format
    const tags = Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));

    res.json(tags);

  } catch (error) {
    logger.error('Error fetching tags:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific template by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check built-in templates first
    const builtIn = BUILTIN_TEMPLATES.find(t => t.id === id);
    if (builtIn) {
      return res.json({ ...builtIn, isBuiltIn: true });
    }

    // Check custom templates
    const custom = await redisClient.get(`template:${id}`);
    if (custom) {
      return res.json({ ...JSON.parse(custom), isBuiltIn: false });
    }

    res.status(404).json({ error: 'Template not found' });

  } catch (error) {
    logger.error('Error fetching template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Preview template configuration
 */
router.post('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { variables = {} } = req.body;

    // Get template
    let template = BUILTIN_TEMPLATES.find(t => t.id === id);
    if (!template) {
      const custom = await redisClient.get(`template:${id}`);
      if (custom) {
        template = JSON.parse(custom);
      }
    }

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Replace variables in config
    let configStr = JSON.stringify(template.config);
    Object.entries(variables).forEach(([key, value]) => {
      configStr = configStr.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    const previewConfig = JSON.parse(configStr);

    res.json({
      template: template.name,
      variables,
      preview: previewConfig
    });

  } catch (error) {
    logger.error('Error previewing template:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;