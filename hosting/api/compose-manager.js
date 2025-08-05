/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class ComposeManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.composePath = process.env.COMPOSE_PATH || '/data/compose';
  }

  async deployCompose(domain, composeConfig) {
    const projectName = `spinforge-${domain.replace(/\./g, '-')}`;
    const projectPath = path.join(this.composePath, projectName);
    
    try {
      // Create project directory
      await fs.mkdir(projectPath, { recursive: true });
      
      // Parse and transform compose config
      const transformedConfig = await this.transformComposeConfig(composeConfig, domain, projectName);
      
      // Write docker-compose.yml
      const composeYaml = yaml.dump(transformedConfig);
      await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), composeYaml);
      
      // Deploy using docker compose (v2 command)
      const deployCmd = `cd ${projectPath} && docker compose -p ${projectName} up -d`;
      const { stdout, stderr } = await execAsync(deployCmd);
      
      // Get container info
      const psCmd = `cd ${projectPath} && docker compose -p ${projectName} ps --format json`;
      const { stdout: psOutput } = await execAsync(psCmd);
      
      // Parse container info
      const containers = psOutput.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
      
      // Store service info in Redis
      const serviceInfo = {
        domain,
        type: 'compose',
        projectName,
        projectPath,
        services: {},
        containers: containers.map(c => ({
          name: c.Name,
          service: c.Service,
          state: c.State,
          ports: c.Ports
        })),
        createdAt: new Date().toISOString()
      };
      
      // Extract service endpoints
      for (const service in transformedConfig.services) {
        const serviceConfig = transformedConfig.services[service];
        if (serviceConfig.labels && serviceConfig.labels['spinforge.subdomain']) {
          const subdomain = serviceConfig.labels['spinforge.subdomain'];
          const port = serviceConfig.labels['spinforge.port'] || 80;
          
          // Get container IP
          const container = containers.find(c => c.Service === service);
          if (container) {
            const inspectCmd = `docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${container.Name}`;
            const { stdout: ip } = await execAsync(inspectCmd);
            
            serviceInfo.services[service] = {
              subdomain: `${subdomain}.${domain}`,
              target: `http://${ip.trim()}:${port}`,
              container: container.Name
            };
            
            // Create route for this service
            await this.redis.set(
              `site:${subdomain}.${domain}`,
              JSON.stringify({
                domain: `${subdomain}.${domain}`,
                type: 'proxy',
                target: `http://${ip.trim()}:${port}`,
                composeDomain: domain,
                composeService: service,
                enabled: true
              })
            );
          }
        }
      }
      
      // Store main compose site
      await this.redis.set(`site:${domain}`, JSON.stringify(serviceInfo));
      
      return serviceInfo;
    } catch (error) {
      // Cleanup on error
      try {
        await execAsync(`cd ${projectPath} && docker-compose -p ${projectName} down`);
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
      throw error;
    }
  }

  async transformComposeConfig(config, domain, projectName) {
    const transformed = { ...config };
    
    // Ensure version
    if (!transformed.version) {
      transformed.version = '3.8';
    }
    
    // Add network
    if (!transformed.networks) {
      transformed.networks = {};
    }
    transformed.networks.spinforge = {
      external: true,
      name: 'spinforge_spinforge'
    };
    
    // Transform services
    for (const serviceName in transformed.services) {
      const service = transformed.services[serviceName];
      
      // Add network
      if (!service.networks) {
        service.networks = [];
      }
      if (!service.networks.includes('spinforge')) {
        service.networks.push('spinforge');
      }
      
      // Add labels
      if (!service.labels) {
        service.labels = {};
      }
      service.labels['spinforge.project'] = projectName;
      service.labels['spinforge.domain'] = domain;
      
      // Remove port exposure (internal routing only)
      if (service.ports) {
        // Store original ports as labels for reference
        service.labels['spinforge.ports'] = JSON.stringify(service.ports);
        delete service.ports;
      }
      
      // Add container name
      if (!service.container_name) {
        service.container_name = `${projectName}-${serviceName}`;
      }
    }
    
    return transformed;
  }

  async stopCompose(domain) {
    const projectName = `spinforge-${domain.replace(/\./g, '-')}`;
    const projectPath = path.join(this.composePath, projectName);
    
    try {
      // Get service info
      const siteData = await this.redis.get(`site:${domain}`);
      if (!siteData) {
        throw new Error('Compose project not found');
      }
      
      const site = JSON.parse(siteData);
      
      // Remove service routes
      for (const service in site.services) {
        const serviceInfo = site.services[service];
        await this.redis.del(`site:${serviceInfo.subdomain}`);
      }
      
      // Stop containers
      const stopCmd = `cd ${projectPath} && docker compose -p ${projectName} down`;
      await execAsync(stopCmd);
      
      // Remove project directory
      await fs.rm(projectPath, { recursive: true, force: true });
      
      // Remove from Redis
      await this.redis.del(`site:${domain}`);
      
      return { message: 'Compose project stopped and removed' };
    } catch (error) {
      throw error;
    }
  }

  async getComposeLogs(domain, service = null, lines = 100) {
    const projectName = `spinforge-${domain.replace(/\./g, '-')}`;
    const projectPath = path.join(this.composePath, projectName);
    
    let logsCmd = `cd ${projectPath} && docker compose -p ${projectName} logs --tail ${lines}`;
    if (service) {
      logsCmd += ` ${service}`;
    }
    
    const { stdout } = await execAsync(logsCmd);
    return stdout;
  }

  async scaleService(domain, service, replicas) {
    const projectName = `spinforge-${domain.replace(/\./g, '-')}`;
    const projectPath = path.join(this.composePath, projectName);
    
    const scaleCmd = `cd ${projectPath} && docker compose -p ${projectName} up -d --scale ${service}=${replicas}`;
    const { stdout } = await execAsync(scaleCmd);
    
    return { message: `Scaled ${service} to ${replicas} replicas`, output: stdout };
  }
}

module.exports = ComposeManager;