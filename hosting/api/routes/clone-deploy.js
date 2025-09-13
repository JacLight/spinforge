/**
 * SpinForge - Clone and Template Deployment System
 * Copyright (c) 2025 Jacob Ajiboye
 * Licensed under the MIT License
 */

const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');
const Docker = require('dockerode');
const logger = require('../utils/logger');
const crypto = require('crypto');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 * Clone an existing deployment
 * POST /api/clone/:sourceDomain
 */
router.post('/:sourceDomain', async (req, res) => {
  try {
    const { sourceDomain } = req.params;
    const {
      targetDomain,
      includeData = false,
      includeEnvVars = true,
      includeVolumes = false,
      customizations = {}
    } = req.body;

    // Validate inputs
    if (!targetDomain) {
      return res.status(400).json({ error: 'Target domain is required' });
    }

    // Get source site configuration
    const sourceData = await redisClient.get(`site:${sourceDomain}`);
    if (!sourceData) {
      return res.status(404).json({ error: 'Source site not found' });
    }

    const sourceSite = JSON.parse(sourceData);

    // Check if target already exists
    const targetExists = await redisClient.exists(`site:${targetDomain}`);
    if (targetExists) {
      return res.status(409).json({ error: 'Target domain already exists' });
    }

    // Create cloned configuration
    const clonedSite = {
      ...sourceSite,
      domain: targetDomain,
      id: targetDomain,
      clonedFrom: sourceDomain,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      containerId: null,
      containerName: null,
      ssl_enabled: false, // Reset SSL for new domain
      aliases: []
    };

    // Apply customizations
    if (customizations.env) {
      if (clonedSite.containerConfig) {
        clonedSite.containerConfig.env = mergeEnvVars(
          includeEnvVars ? clonedSite.containerConfig.env : [],
          customizations.env
        );
      }
    }

    if (customizations.port) {
      if (clonedSite.containerConfig) {
        clonedSite.containerConfig.port = customizations.port;
      }
      if (clonedSite.target) {
        clonedSite.target = clonedSite.target.replace(/:\d+$/, `:${customizations.port}`);
      }
    }

    // Handle different deployment types
    switch (clonedSite.type) {
      case 'container':
        await cloneContainer(sourceSite, clonedSite, includeData, includeVolumes);
        break;

      case 'static':
        await cloneStaticSite(sourceDomain, targetDomain, includeData);
        break;

      case 'proxy':
        // Proxy sites just need the configuration
        break;

      case 'loadbalancer':
        // Update backend labels if needed
        if (clonedSite.backends) {
          clonedSite.backends = clonedSite.backends.map((backend, index) => ({
            ...backend,
            label: `${targetDomain}-backend-${index + 1}`
          }));
        }
        break;

      case 'compose':
        await cloneComposeDeployment(sourceDomain, targetDomain, clonedSite);
        break;
    }

    // Save the cloned site configuration
    await redisClient.set(`site:${targetDomain}`, JSON.stringify(clonedSite));

    // If it's a container deployment, start the container
    if (clonedSite.type === 'container' && clonedSite.containerConfig) {
      const containerResult = await deployContainer(clonedSite);
      clonedSite.containerId = containerResult.containerId;
      clonedSite.containerName = containerResult.containerName;
      clonedSite.target = containerResult.target;

      // Update with container info
      await redisClient.set(`site:${targetDomain}`, JSON.stringify(clonedSite));
    }

    logger.info(`Successfully cloned ${sourceDomain} to ${targetDomain}`);
    res.json({
      message: 'Deployment cloned successfully',
      source: sourceDomain,
      target: targetDomain,
      site: clonedSite
    });

  } catch (error) {
    logger.error('Error cloning deployment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create deployment from template
 * POST /api/deploy-template/:templateId
 */
router.post('/deploy-template/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const {
      domain,
      customerId = 'default',
      variables = {},
      envOverrides = {},
      enableSSL = false
    } = req.body;

    // Validate inputs
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Get template
    const templateData = await redisClient.get(`template:${templateId}`);
    if (!templateData) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = JSON.parse(templateData);

    // Check if site already exists
    const exists = await redisClient.exists(`site:${domain}`);
    if (exists) {
      return res.status(409).json({ error: 'Site already exists' });
    }

    // Process template configuration with variables
    let siteConfig = JSON.parse(JSON.stringify(template.config));
    siteConfig = replaceTemplateVariables(siteConfig, { ...variables, domain, customerId });

    // Create site from template
    const site = {
      ...siteConfig,
      domain,
      id: domain,
      customerId,
      templateId,
      ssl_enabled: enableSSL,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true
    };

    // Apply environment overrides
    if (envOverrides && Object.keys(envOverrides).length > 0) {
      if (site.containerConfig && site.containerConfig.env) {
        site.containerConfig.env = mergeEnvVars(site.containerConfig.env, envOverrides);
      }
    }

    // Deploy based on type
    switch (site.type) {
      case 'container':
        const containerResult = await deployContainer(site);
        site.containerId = containerResult.containerId;
        site.containerName = containerResult.containerName;
        site.target = containerResult.target;
        break;

      case 'static':
        await createStaticSiteStructure(site);
        break;

      case 'compose':
        await deployComposeFromTemplate(site, template);
        break;
    }

    // Save site configuration
    await redisClient.set(`site:${domain}`, JSON.stringify(site));

    // Track template usage
    await incrementTemplateUsage(templateId);

    logger.info(`Deployed ${domain} from template ${templateId}`);
    res.json({
      message: 'Deployment from template successful',
      templateId,
      domain,
      site
    });

  } catch (error) {
    logger.error('Error deploying from template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save existing deployment as template
 * POST /api/save-as-template/:domain
 */
router.post('/save-as-template/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const {
      templateName,
      description,
      category,
      icon,
      tags = [],
      extractVariables = true
    } = req.body;

    // Get site configuration
    const siteData = await redisClient.get(`site:${domain}`);
    if (!siteData) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const site = JSON.parse(siteData);

    // Create template configuration
    let templateConfig = JSON.parse(JSON.stringify(site));

    // Remove deployment-specific data
    delete templateConfig.domain;
    delete templateConfig.id;
    delete templateConfig.containerId;
    delete templateConfig.containerName;
    delete templateConfig.createdAt;
    delete templateConfig.updatedAt;
    delete templateConfig.ssl_enabled;
    delete templateConfig.aliases;
    delete templateConfig.clonedFrom;
    delete templateConfig.templateId;

    // Extract variables if requested
    let variables = [];
    if (extractVariables) {
      const extracted = extractTemplateVariables(templateConfig);
      templateConfig = extracted.template;
      variables = extracted.variables;
    }

    // Create template
    const template = {
      id: `template-${crypto.randomBytes(8).toString('hex')}`,
      name: templateName || `${site.type} Template`,
      description: description || `Template created from ${domain}`,
      category: category || site.type,
      icon: icon || getDefaultIcon(site.type),
      config: templateConfig,
      variables,
      tags,
      sourceDeployment: domain,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save template
    await redisClient.set(`template:${template.id}`, JSON.stringify(template));

    logger.info(`Created template ${template.id} from ${domain}`);
    res.json({
      message: 'Template created successfully',
      template
    });

  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions

async function cloneContainer(sourceSite, clonedSite, includeData, includeVolumes) {
  if (!sourceSite.containerConfig) return;

  const sourceContainerName = sourceSite.containerName;
  const targetContainerName = `spinforge-${clonedSite.domain.replace(/\./g, '-')}`;

  clonedSite.containerName = targetContainerName;

  // If includeData is true, create a new image from the source container
  if (includeData && sourceContainerName) {
    try {
      const sourceContainer = docker.getContainer(sourceContainerName);
      const commitResult = await sourceContainer.commit({
        repo: `spinforge-clone/${clonedSite.domain.replace(/\./g, '-')}`,
        tag: 'latest'
      });

      // Update the cloned site to use the new image
      clonedSite.containerConfig.image = `${commitResult.Id.substr(7, 12)}`;
      clonedSite.containerConfig.clonedWithData = true;
    } catch (error) {
      logger.warn(`Could not clone container data: ${error.message}`);
    }
  }

  // Handle volume cloning if requested
  if (includeVolumes && sourceSite.containerConfig.volumes) {
    clonedSite.containerConfig.volumes = await cloneVolumes(
      sourceSite.containerConfig.volumes,
      targetContainerName
    );
  }
}

async function cloneStaticSite(sourceDomain, targetDomain, includeData) {
  if (!includeData) return;

  const fs = require('fs').promises;
  const path = require('path');
  const { STATIC_ROOT } = require('../utils/constants');

  const sourcePath = path.join(STATIC_ROOT, sourceDomain);
  const targetPath = path.join(STATIC_ROOT, targetDomain);

  try {
    // Copy static files
    await fs.cp(sourcePath, targetPath, { recursive: true });
    logger.info(`Copied static files from ${sourcePath} to ${targetPath}`);
  } catch (error) {
    logger.warn(`Could not copy static files: ${error.message}`);
  }
}

async function cloneComposeDeployment(sourceDomain, targetDomain, clonedSite) {
  const fs = require('fs').promises;
  const path = require('path');
  const yaml = require('js-yaml');

  const sourceProject = `spinforge-${sourceDomain.replace(/\./g, '-')}`;
  const targetProject = `spinforge-${targetDomain.replace(/\./g, '-')}`;

  const sourcePath = path.join('/data/compose', sourceProject);
  const targetPath = path.join('/data/compose', targetProject);

  try {
    // Copy compose files
    await fs.cp(sourcePath, targetPath, { recursive: true });

    // Update compose file with new project name
    const composeFile = path.join(targetPath, 'docker-compose.yml');
    const composeContent = await fs.readFile(composeFile, 'utf8');
    const compose = yaml.load(composeContent);

    // Update service names and labels
    if (compose.services) {
      for (const serviceName in compose.services) {
        const service = compose.services[serviceName];
        if (service.labels) {
          service.labels = service.labels.map(label =>
            label.replace(sourceDomain, targetDomain)
          );
        }
      }
    }

    await fs.writeFile(composeFile, yaml.dump(compose));
    clonedSite.composeProject = targetProject;

  } catch (error) {
    logger.warn(`Could not clone compose deployment: ${error.message}`);
  }
}

async function deployContainer(site) {
  const containerName = `spinforge-${site.domain.replace(/\./g, '-')}`;
  const config = site.containerConfig;

  // Create container
  const container = await docker.createContainer({
    Image: config.image,
    name: containerName,
    Env: formatEnvVars(config.env),
    ExposedPorts: { [`${config.port}/tcp`]: {} },
    HostConfig: {
      RestartPolicy: { Name: config.restartPolicy || 'unless-stopped' },
      NetworkMode: 'spinforge_spinforge',
      Volumes: config.volumes
    },
    Labels: {
      'spinforge.domain': site.domain,
      'spinforge.type': 'container'
    }
  });

  await container.start();

  // Get container IP
  const containerInfo = await container.inspect();
  const containerIP = containerInfo.NetworkSettings.Networks.spinforge_spinforge?.IPAddress ||
                      containerInfo.NetworkSettings.Networks.spinforge?.IPAddress;

  return {
    containerId: container.id,
    containerName,
    target: `http://${containerIP || containerName}:${config.port}`
  };
}

function mergeEnvVars(baseEnv, overrides) {
  const envMap = new Map();

  // Add base environment variables
  if (Array.isArray(baseEnv)) {
    baseEnv.forEach(env => {
      if (typeof env === 'object' && env.key) {
        envMap.set(env.key, env.value);
      } else if (typeof env === 'string') {
        const [key, ...valueParts] = env.split('=');
        envMap.set(key, valueParts.join('='));
      }
    });
  }

  // Apply overrides
  Object.entries(overrides).forEach(([key, value]) => {
    envMap.set(key, value);
  });

  // Convert back to array format
  return Array.from(envMap.entries()).map(([key, value]) => ({ key, value }));
}

function formatEnvVars(env) {
  if (!env) return [];

  if (Array.isArray(env)) {
    return env.map(e => {
      if (typeof e === 'object' && e.key) {
        return `${e.key}=${e.value}`;
      }
      return e;
    });
  }

  return Object.entries(env).map(([key, value]) => `${key}=${value}`);
}

function replaceTemplateVariables(config, variables) {
  const configStr = JSON.stringify(config);
  const replaced = configStr.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] || match;
  });
  return JSON.parse(replaced);
}

function extractTemplateVariables(config) {
  const variables = [];
  const variableSet = new Set();

  const configStr = JSON.stringify(config);
  const matches = configStr.matchAll(/\{\{(\w+)\}\}/g);

  for (const match of matches) {
    const varName = match[1];
    if (!variableSet.has(varName)) {
      variableSet.add(varName);
      variables.push({
        name: varName,
        description: `Variable ${varName}`,
        required: true,
        defaultValue: ''
      });
    }
  }

  return { template: config, variables };
}

async function incrementTemplateUsage(templateId) {
  try {
    const templateData = await redisClient.get(`template:${templateId}`);
    if (templateData) {
      const template = JSON.parse(templateData);
      template.usageCount = (template.usageCount || 0) + 1;
      template.lastUsed = new Date().toISOString();
      await redisClient.set(`template:${templateId}`, JSON.stringify(template));
    }
  } catch (error) {
    logger.warn(`Could not increment template usage: ${error.message}`);
  }
}

function getDefaultIcon(type) {
  const icons = {
    container: '🐳',
    static: '📄',
    proxy: '🔀',
    loadbalancer: '⚖️',
    compose: '📦'
  };
  return icons[type] || '🚀';
}

async function createStaticSiteStructure(site) {
  const fs = require('fs').promises;
  const path = require('path');
  const { STATIC_ROOT } = require('../utils/constants');

  const sitePath = path.join(STATIC_ROOT, site.domain);
  await fs.mkdir(sitePath, { recursive: true });

  // Create default index.html if template includes it
  if (site.defaultContent) {
    await fs.writeFile(
      path.join(sitePath, 'index.html'),
      site.defaultContent
    );
  }
}

async function deployComposeFromTemplate(site, template) {
  const fs = require('fs').promises;
  const path = require('path');
  const yaml = require('js-yaml');
  const { execAsync } = require('../utils/docker');

  const projectName = `spinforge-${site.domain.replace(/\./g, '-')}`;
  const projectPath = path.join('/data/compose', projectName);

  await fs.mkdir(projectPath, { recursive: true });

  // Write compose file
  const composeContent = typeof site.composeConfig === 'string'
    ? site.composeConfig
    : yaml.dump(site.composeConfig);

  await fs.writeFile(
    path.join(projectPath, 'docker-compose.yml'),
    composeContent
  );

  // Deploy with docker-compose
  await execAsync(`cd ${projectPath} && docker-compose up -d`);

  site.composeProject = projectName;
}

async function cloneVolumes(sourceVolumes, targetContainerName) {
  // This would implement volume cloning logic
  // For now, return modified volume configuration
  return sourceVolumes.map(vol => ({
    ...vol,
    source: vol.source.replace(/spinforge-[^\/]+/, targetContainerName)
  }));
}

module.exports = router;