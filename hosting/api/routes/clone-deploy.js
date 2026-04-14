/**
 * SpinForge - Clone and Template Deployment System
 * Copyright (c) 2025 Jacob Ajiboye
 * Licensed under the MIT License
 *
 * Nomad-backed clone + template deployment. Container workloads are
 * scheduled by the cluster, not by direct docker calls from here.
 */

const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');
const logger = require('../utils/logger');
const crypto = require('crypto');
const NomadService = require('../services/NomadService');

const nomad = new NomadService();

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
      customizations = {},
    } = req.body;

    if (!targetDomain) {
      return res.status(400).json({ error: 'Target domain is required' });
    }

    const sourceData = await redisClient.get(`site:${sourceDomain}`);
    if (!sourceData) {
      return res.status(404).json({ error: 'Source site not found' });
    }

    const sourceSite = JSON.parse(sourceData);

    const targetExists = await redisClient.exists(`site:${targetDomain}`);
    if (targetExists) {
      return res.status(409).json({ error: 'Target domain already exists' });
    }

    const clonedSite = {
      ...sourceSite,
      domain: targetDomain,
      id: targetDomain,
      clonedFrom: sourceDomain,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ssl_enabled: false,
      aliases: [],
      orchestrator: sourceSite.orchestrator === 'nomad' ? 'nomad' : sourceSite.orchestrator,
      nomadJobId: undefined,
      nomadEvalId: undefined,
    };

    if (customizations.env && clonedSite.containerConfig) {
      clonedSite.containerConfig.env = mergeEnvVars(
        includeEnvVars ? clonedSite.containerConfig.env : [],
        customizations.env
      );
    }

    if (customizations.port && clonedSite.containerConfig) {
      clonedSite.containerConfig.port = customizations.port;
    }

    if (clonedSite.type === 'static') {
      await cloneStaticSite(sourceDomain, targetDomain, includeData);
    } else if (clonedSite.type === 'loadbalancer' && clonedSite.backends) {
      clonedSite.backends = clonedSite.backends.map((backend, index) => ({
        ...backend,
        label: `${targetDomain}-backend-${index + 1}`,
      }));
    }

    await redisClient.set(`site:${targetDomain}`, JSON.stringify(clonedSite));

    if (clonedSite.type === 'container' || clonedSite.type === 'node') {
      clonedSite.orchestrator = 'nomad';
      const deployed = await nomad.deploySite(clonedSite);
      clonedSite.nomadJobId = deployed.jobId;
      clonedSite.nomadEvalId = deployed.evalId;
      await redisClient.set(`site:${targetDomain}`, JSON.stringify(clonedSite));
    }

    logger.info(`Cloned ${sourceDomain} to ${targetDomain}`);
    res.json({
      message: 'Deployment cloned successfully',
      source: sourceDomain,
      target: targetDomain,
      site: clonedSite,
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
      enableSSL = false,
    } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const templateData = await redisClient.get(`template:${templateId}`);
    if (!templateData) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = JSON.parse(templateData);

    const exists = await redisClient.exists(`site:${domain}`);
    if (exists) {
      return res.status(409).json({ error: 'Site already exists' });
    }

    let siteConfig = JSON.parse(JSON.stringify(template.config));
    siteConfig = replaceTemplateVariables(siteConfig, { ...variables, domain, customerId });

    const site = {
      ...siteConfig,
      domain,
      id: domain,
      customerId,
      templateId,
      ssl_enabled: enableSSL,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true,
    };

    if (envOverrides && Object.keys(envOverrides).length > 0 && site.containerConfig?.env) {
      site.containerConfig.env = mergeEnvVars(site.containerConfig.env, envOverrides);
    }

    if (site.type === 'static') {
      await createStaticSiteStructure(site);
    }

    if (site.type === 'container' || site.type === 'node') {
      site.orchestrator = 'nomad';
      const deployed = await nomad.deploySite(site);
      site.nomadJobId = deployed.jobId;
      site.nomadEvalId = deployed.evalId;
    }

    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    await incrementTemplateUsage(templateId);

    logger.info(`Deployed ${domain} from template ${templateId}`);
    res.json({ message: 'Deployment from template successful', templateId, domain, site });
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
      extractVariables = true,
    } = req.body;

    const siteData = await redisClient.get(`site:${domain}`);
    if (!siteData) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const site = JSON.parse(siteData);
    let templateConfig = JSON.parse(JSON.stringify(site));

    delete templateConfig.domain;
    delete templateConfig.id;
    delete templateConfig.nomadJobId;
    delete templateConfig.nomadEvalId;
    delete templateConfig.createdAt;
    delete templateConfig.updatedAt;
    delete templateConfig.ssl_enabled;
    delete templateConfig.aliases;
    delete templateConfig.clonedFrom;
    delete templateConfig.templateId;

    let variables = [];
    if (extractVariables) {
      const extracted = extractTemplateVariables(templateConfig);
      templateConfig = extracted.template;
      variables = extracted.variables;
    }

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
      updatedAt: new Date().toISOString(),
    };

    await redisClient.set(`template:${template.id}`, JSON.stringify(template));
    logger.info(`Created template ${template.id} from ${domain}`);
    res.json({ message: 'Template created successfully', template });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

async function cloneStaticSite(sourceDomain, targetDomain, includeData) {
  if (!includeData) return;
  const fs = require('fs').promises;
  const path = require('path');
  const { STATIC_ROOT } = require('../utils/constants');
  const sourcePath = path.join(STATIC_ROOT, sourceDomain);
  const targetPath = path.join(STATIC_ROOT, targetDomain);
  try {
    await fs.cp(sourcePath, targetPath, { recursive: true });
  } catch (error) {
    logger.warn(`Could not copy static files: ${error.message}`);
  }
}

function mergeEnvVars(baseEnv, overrides) {
  const envMap = new Map();
  if (Array.isArray(baseEnv)) {
    baseEnv.forEach((env) => {
      if (typeof env === 'object' && env.key) {
        envMap.set(env.key, env.value);
      } else if (typeof env === 'string') {
        const [key, ...valueParts] = env.split('=');
        envMap.set(key, valueParts.join('='));
      }
    });
  }
  Object.entries(overrides).forEach(([key, value]) => envMap.set(key, value));
  return Array.from(envMap.entries()).map(([key, value]) => ({ key, value }));
}

function replaceTemplateVariables(config, variables) {
  const configStr = JSON.stringify(config);
  const replaced = configStr.replace(/\{\{(\w+)\}\}/g, (match, varName) => variables[varName] || match);
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
      variables.push({ name: varName, description: `Variable ${varName}`, required: true, defaultValue: '' });
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
  const icons = { container: 'container', static: 'static', proxy: 'proxy', loadbalancer: 'lb' };
  return icons[type] || 'app';
}

async function createStaticSiteStructure(site) {
  const fs = require('fs').promises;
  const path = require('path');
  const { STATIC_ROOT } = require('../utils/constants');
  const sitePath = path.join(STATIC_ROOT, site.domain);
  await fs.mkdir(sitePath, { recursive: true });
  if (site.defaultContent) {
    await fs.writeFile(path.join(sitePath, 'index.html'), site.defaultContent);
  }
}

module.exports = router;
