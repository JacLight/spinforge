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
const { execAsync, execInContainer } = require('../utils/docker');

// Container management endpoints

// Stop container
router.post('/:domain/container/stop', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    await execAsync(`docker stop ${site.containerName}`);
    res.json({ message: 'Container stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start container
router.post('/:domain/container/start', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    await execAsync(`docker start ${site.containerName}`);
    
    // Update container IP address after start
    await new Promise(resolve => setTimeout(resolve, 2000));
    const { stdout: containerIp } = await execAsync(`docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${site.containerName}`);
    site.target = `http://${containerIp.trim()}:${site.containerConfig.port}`;
    
    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    res.json({ message: 'Container started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restart container
router.post('/:domain/container/restart', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    await execAsync(`docker restart ${site.containerName}`);
    
    // Update container IP address after restart
    await new Promise(resolve => setTimeout(resolve, 2000));
    const { stdout: containerIp } = await execAsync(`docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${site.containerName}`);
    site.target = `http://${containerIp.trim()}:${site.containerConfig.port}`;
    
    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    res.json({ message: 'Container restarted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rebuild container with current configuration
router.post('/:domain/container/rebuild', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    if (!site.containerConfig) {
      return res.status(400).json({ error: 'Container configuration not found' });
    }
    
    console.log(`Rebuilding container for ${domain}...`);
    
    // Stop and remove old container
    try {
      await execAsync(`docker stop ${site.containerName}`);
      await execAsync(`docker rm ${site.containerName}`);
      console.log(`Removed old container: ${site.containerName}`);
    } catch (e) {
      console.log('Container cleanup skipped:', e.message);
    }
    
    // Rebuild container with current configuration
    const config = site.containerConfig;
    let dockerCmd = `docker run -d --name ${site.containerName}`;
    dockerCmd += ` --network spinforge_spinforge`;
    dockerCmd += ` --restart ${config.restartPolicy || 'unless-stopped'}`;
    dockerCmd += ` -t`;
    dockerCmd += ` -e TERM=xterm-256color`;
    dockerCmd += ` -e LANG=C.UTF-8`;
    dockerCmd += ` -e LC_ALL=C.UTF-8`;
    
    // Add environment variables
    if (config.env && config.env.length > 0) {
      config.env.forEach(env => {
        dockerCmd += ` -e "${env.key}=${env.value}"`;
      });
    }
    
    // Add volume mounts
    if (config.volumes && config.volumes.length > 0) {
      config.volumes.forEach(vol => {
        dockerCmd += ` -v "${vol.host}:${vol.container}"`;
      });
    }
    
    // Add resource limits
    if (config.memoryLimit) {
      dockerCmd += ` --memory="${config.memoryLimit}"`;
    }
    if (config.cpuLimit) {
      dockerCmd += ` --cpus="${config.cpuLimit}"`;
    }
    
    // Add labels
    dockerCmd += ` --label spinforge.domain="${site.domain}"`;
    dockerCmd += ` --label spinforge.type="container"`;
    dockerCmd += ` --label spinforge.rebuilt="${new Date().toISOString()}"`;
    
    // Add the image
    dockerCmd += ` ${config.image}`;
    
    // Add command override if specified
    if (config.command) {
      dockerCmd += ` ${config.command}`;
    }
    
    console.log('Rebuilding container with command:', dockerCmd);
    const { stdout } = await execAsync(dockerCmd);
    const containerId = stdout.trim();
    
    // Update container ID
    site.containerId = containerId;
    site.updatedAt = new Date().toISOString();
    
    // Wait for container to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get new container IP
    const { stdout: containerIp } = await execAsync(
      `docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${site.containerName}`
    );
    site.target = `http://${containerIp.trim()}:${config.port}`;
    
    // Save updated site with new container info
    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    
    console.log(`Container rebuilt successfully: ${site.containerName} -> ${site.target}`);
    res.json({ 
      message: 'Container rebuilt successfully',
      containerId: containerId,
      target: site.target
    });
  } catch (error) {
    console.error('Container rebuild failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get container logs
router.get('/:domain/container/logs', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    const lines = req.query.lines || 100;
    const { stdout } = await execAsync(`docker logs --tail ${lines} ${site.containerName}`);
    res.json({ logs: stdout });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container stats
router.get('/:domain/container/stats', async (req, res) => {
  try {
    const domain = req.params.domain;
    
    // Just find any container that matches the domain pattern
    const containerName = `spinforge-${domain.replace(/\./g, '-')}`;
    
    // Try direct docker stats
    const { stdout } = await execAsync(`docker stats ${containerName} --no-stream --format "json"`);
    const stats = JSON.parse(stdout);
    res.json(stats);
  } catch (error) {
    // Container doesn't exist or is stopped
    res.json({ error: error.message, status: 'stopped' });
  }
});

// Container health check
router.get('/:domain/container/health', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    // Check if container is running
    try {
      const { stdout } = await execAsync(`docker inspect -f '{{.State.Running}}' ${site.containerName}`);
      const isRunning = stdout.trim() === 'true';
      
      if (!isRunning) {
        return res.json({ healthy: false, status: 'stopped' });
      }
      
      // Get container health status if available
      const { stdout: healthStatus } = await execAsync(`docker inspect -f '{{.State.Health.Status}}' ${site.containerName}`);
      const health = healthStatus.trim();
      
      res.json({ 
        healthy: isRunning && (health === 'healthy' || health === '<no value>'),
        status: isRunning ? 'running' : 'stopped',
        health: health === '<no value>' ? 'no healthcheck' : health
      });
    } catch (error) {
      res.json({ healthy: false, status: 'not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute command in container
router.post('/:domain/container/exec', async (req, res) => {
  try {
    const domain = req.params.domain;
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'container' || !site.containerName) {
      return res.status(400).json({ error: 'Not a container site' });
    }
    
    // Execute command using the helper function
    try {
      const { stdout, stderr } = await execInContainer(site.containerName, command);
      res.json({ 
        output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''),
        stdout,
        stderr,
        exitCode: 0
      });
    } catch (error) {
      // Extract exit code from error
      const exitCode = error.code || 1;
      res.json({ 
        output: error.stdout + (error.stderr ? `\nSTDERR:\n${error.stderr}` : '') + `\nCommand failed with exit code ${exitCode}`,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Multi-container endpoints for compose deployments
router.get('/:domain/containers', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    const containers = [];
    
    if (site.type === 'container' && site.containerName) {
      // Single container deployment
      containers.push({
        name: 'main',
        containerName: site.containerName,
        domain: site.domain
      });
    } else if (site.type === 'compose' && site.containers) {
      // Multi-container compose deployment
      site.containers.forEach(c => {
        containers.push({
          name: c.service,
          containerName: c.name,
          domain: site.services[c.service]?.subdomain || site.domain
        });
      });
    }
    
    // Get detailed stats for each container
    const containersWithStats = await Promise.all(containers.map(async (container) => {
      try {
        // Get container status
        const { stdout: statusOut } = await execAsync(`docker inspect -f '{{.State.Status}}' ${container.containerName}`);
        const status = statusOut.trim();
        
        // Get container stats if running
        let stats = null;
        if (status === 'running') {
          const { stdout: statsOut } = await execAsync(`docker stats ${container.containerName} --no-stream --format "json"`);
          stats = JSON.parse(statsOut);
        }
        
        // Get health check status
        let health = null;
        try {
          const { stdout: healthOut } = await execAsync(`docker inspect -f '{{json .State.Health}}' ${container.containerName}`);
          if (healthOut.trim() !== 'null') {
            health = JSON.parse(healthOut);
          }
        } catch (e) {
          // No health check configured
        }
        
        return {
          ...container,
          status,
          stats,
          health
        };
      } catch (error) {
        return {
          ...container,
          status: 'not found',
          error: error.message
        };
      }
    }));
    
    res.json({ containers: containersWithStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Container-specific operations for multi-container deployments
router.post('/:domain/container/:service/:action', async (req, res) => {
  try {
    const { domain, service, action } = req.params;
    
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    let containerName = null;
    
    if (site.type === 'container' && service === 'main') {
      containerName = site.containerName;
    } else if (site.type === 'compose' && site.containers) {
      const container = site.containers.find(c => c.service === service);
      if (container) {
        containerName = container.name;
      }
    }
    
    if (!containerName) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    await execAsync(`docker ${action} ${containerName}`);
    
    // Update IP address if starting
    if (action === 'start' || action === 'restart') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (site.type === 'container') {
        const { stdout: containerIp } = await execAsync(`docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerName}`);
        site.target = `http://${containerIp.trim()}:${site.containerConfig.port}`;
        await redisClient.set(`site:${domain}`, JSON.stringify(site));
      }
    }
    
    res.json({ message: `Container ${action}ed successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get logs for specific container in multi-container deployment
router.get('/:domain/container/:service/logs', async (req, res) => {
  try {
    const { domain, service } = req.params;
    const lines = req.query.lines || 100;
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    let containerName = null;
    
    if (site.type === 'container' && service === 'main') {
      containerName = site.containerName;
    } else if (site.type === 'compose' && site.containers) {
      const container = site.containers.find(c => c.service === service);
      if (container) {
        containerName = container.name;
      }
    }
    
    if (!containerName) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    const { stdout, stderr } = await execAsync(`docker logs --tail ${lines} ${containerName} 2>&1`);
    res.json({ logs: stdout });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute command in specific container
router.post('/:domain/container/:service/exec', async (req, res) => {
  try {
    const { domain, service } = req.params;
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    const data = await redisClient.get(`site:${domain}`);
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    let containerName = null;
    
    if (site.type === 'container' && service === 'main') {
      containerName = site.containerName;
    } else if (site.type === 'compose' && site.containers) {
      const container = site.containers.find(c => c.service === service);
      if (container) {
        containerName = container.name;
      }
    }
    
    if (!containerName) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    try {
      const { stdout, stderr } = await execInContainer(containerName, command);
      res.json({ 
        output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''),
        stdout,
        stderr,
        exitCode: 0
      });
    } catch (error) {
      const exitCode = error.code || 1;
      res.json({ 
        output: error.stdout + (error.stderr ? `\nSTDERR:\n${error.stderr}` : '') + `\nCommand failed with exit code ${exitCode}`,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get stats for all containers
router.get('/stats', async (req, res) => {
  try {
    // Get all running containers
    const { stdout } = await execAsync('docker stats --no-stream --format "json" --all');
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    const stats = lines.map(line => JSON.parse(line));
    res.json(stats);
  } catch (error) {
    res.json({ error: error.message, stats: [] });
  }
});

module.exports = router;