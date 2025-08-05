/**
 * SpinForge Docker Swarm Manager
 * Enhanced container orchestration for high-density hosting
 * Copyright (c) 2025 Jacob Ajiboye
 * Licensed under the MIT License
 */

const Docker = require('dockerode');
const Redis = require('ioredis');

class SpinForgeSwarmManager {
  constructor(options = {}) {
    this.docker = new Docker(options.docker || {});
    this.redis = new Redis({
      host: options.redis?.host || 'keydb',
      port: options.redis?.port || 16378,
      password: options.redis?.password,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
    
    this.scalingEnabled = options.scaling || true;
    this.sleepEnabled = options.sleep || true;
    this.sleepTimeoutMinutes = options.sleepTimeoutMinutes || 30;
    this.scaleUpCpuThreshold = options.scaleUpCpuThreshold || 70;
    this.scaleDownCpuThreshold = options.scaleDownCpuThreshold || 20;
    
    this.init();
  }

  async init() {
    try {
      // Verify we're in a Swarm cluster
      const swarmInfo = await this.docker.swarm.inspect();
      console.log(`✅ Connected to Docker Swarm: ${swarmInfo.ID}`);
      
      // Start monitoring if enabled
      if (this.scalingEnabled || this.sleepEnabled) {
        this.startAutoScaling();
      }
      
    } catch (error) {
      console.error('❌ Not in a Docker Swarm cluster:', error.message);
      throw new Error('SpinForgeSwarmManager requires Docker Swarm mode');
    }
  }

  /**
   * Deploy a customer application as a Docker Swarm service
   */
  async deployCustomerApp(customerId, config) {
    const serviceName = `customer${customerId}-app`;
    
    try {
      const serviceSpec = {
        Name: serviceName,
        TaskTemplate: {
          ContainerSpec: {
            Image: config.image || 'nginx:alpine',
            Env: this.formatEnvVars(config.env || []),
            Labels: {
              'spinforge.customer.id': customerId.toString(),
              'spinforge.app.type': config.type || 'container',
              'spinforge.created': new Date().toISOString()
            }
          },
          Resources: {
            Limits: {
              MemoryBytes: (config.memory || 256) * 1024 * 1024,
              NanoCPUs: (config.cpu || 0.5) * 1000000000
            },
            Reservations: {
              MemoryBytes: (config.memory || 256) * 1024 * 1024 * 0.5,
              NanoCPUs: (config.cpu || 0.5) * 1000000000 * 0.5
            }
          },
          RestartPolicy: {
            Condition: 'on-failure',
            Delay: 5000000000, // 5 seconds in nanoseconds
            MaxAttempts: 3
          },
          Placement: {
            Constraints: config.placement || ['node.role==worker']
          }
        },
        Mode: {
          Replicated: {
            Replicas: config.replicas || 1
          }
        },
        Networks: [{
          Target: 'spinforge-swarm'
        }],
        EndpointSpec: {
          Ports: config.ports ? this.formatPorts(config.ports) : []
        }
      };

      // Create the service
      const service = await this.docker.createService(serviceSpec);
      
      // Store service metadata in Redis
      await this.redis.hset(`service:${customerId}`, {
        serviceId: service.id,
        serviceName: serviceName,
        customerId: customerId,
        replicas: config.replicas || 1,
        status: 'deploying',
        created: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        config: JSON.stringify(config)
      });

      // Store customer service mapping
      await this.redis.sadd('active-services', serviceName);
      await this.redis.set(`customer:${customerId}:service`, serviceName);

      console.log(`🚀 Deployed service ${serviceName} for customer ${customerId}`);
      return {
        serviceId: service.id,
        serviceName: serviceName,
        status: 'deploying'
      };

    } catch (error) {
      console.error(`❌ Failed to deploy service for customer ${customerId}:`, error.message);
      throw error;
    }
  }

  /**
   * Scale a customer application
   */
  async scaleCustomerApp(customerId, replicas) {
    const serviceName = `customer${customerId}-app`;
    
    try {
      const service = this.docker.getService(serviceName);
      const serviceInfo = await service.inspect();
      
      // Update service with new replica count
      await service.update({
        version: serviceInfo.Version.Index,
        Spec: {
          ...serviceInfo.Spec,
          Mode: {
            Replicated: {
              Replicas: replicas
            }
          }
        }
      });

      // Update Redis metadata
      await this.redis.hset(`service:${customerId}`, {
        replicas: replicas,
        lastScaled: new Date().toISOString()
      });

      console.log(`📈 Scaled service ${serviceName} to ${replicas} replicas`);
      return { serviceName, replicas, status: 'scaling' };

    } catch (error) {
      console.error(`❌ Failed to scale service for customer ${customerId}:`, error.message);
      throw error;
    }
  }

  /**
   * Put a customer application to sleep (0 replicas)
   */
  async sleepCustomerApp(customerId) {
    console.log(`😴 Putting customer ${customerId} app to sleep`);
    const result = await this.scaleCustomerApp(customerId, 0);
    
    // Mark as sleeping in Redis
    await this.redis.hset(`service:${customerId}`, {
      status: 'sleeping',
      sleepTime: new Date().toISOString()
    });
    
    return result;
  }

  /**
   * Wake up a customer application (scale to 1)
   */
  async wakeCustomerApp(customerId) {
    console.log(`⏰ Waking up customer ${customerId} app`);
    const result = await this.scaleCustomerApp(customerId, 1);
    
    // Mark as active in Redis
    await this.redis.hset(`service:${customerId}`, {
      status: 'active',
      wakeTime: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    });
    
    return result;
  }

  /**
   * Delete a customer application
   */
  async deleteCustomerApp(customerId) {
    const serviceName = `customer${customerId}-app`;
    
    try {
      const service = this.docker.getService(serviceName);
      await service.remove();
      
      // Clean up Redis data
      await this.redis.del(`service:${customerId}`);
      await this.redis.srem('active-services', serviceName);
      await this.redis.del(`customer:${customerId}:service`);
      
      console.log(`🗑️  Deleted service ${serviceName} for customer ${customerId}`);
      return { serviceName, status: 'deleted' };
      
    } catch (error) {
      console.error(`❌ Failed to delete service for customer ${customerId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get service status and metrics
   */
  async getServiceStatus(customerId) {
    try {
      const serviceData = await this.redis.hgetall(`service:${customerId}`);
      if (!serviceData.serviceName) {
        return null;
      }

      const service = this.docker.getService(serviceData.serviceName);
      const serviceInfo = await service.inspect();
      const tasks = await service.tasks();
      
      const runningTasks = tasks.filter(task => 
        task.Status.State === 'running'
      );

      return {
        customerId: customerId,
        serviceName: serviceData.serviceName,
        replicas: serviceInfo.Spec.Mode.Replicated.Replicas,
        runningReplicas: runningTasks.length,
        status: serviceData.status,
        created: serviceData.created,
        lastActivity: serviceData.lastActivity,
        tasks: tasks.map(task => ({
          id: task.ID,
          nodeId: task.NodeID,
          state: task.Status.State,
          message: task.Status.Message
        }))
      };
      
    } catch (error) {
      console.error(`❌ Failed to get status for customer ${customerId}:`, error.message);
      return null;
    }
  }

  /**
   * Record customer activity (for sleep/wake decisions)
   */
  async recordActivity(customerId) {
    await this.redis.hset(`service:${customerId}`, {
      lastActivity: new Date().toISOString()
    });
  }

  /**
   * Auto-scaling and sleep management
   */
  startAutoScaling() {
    console.log('🤖 Starting auto-scaling and sleep management');
    
    // Check every 2 minutes
    setInterval(async () => {
      try {
        await this.performAutoScaling();
        await this.performSleepManagement();
      } catch (error) {
        console.error('❌ Auto-scaling error:', error.message);
      }
    }, 120000); // 2 minutes
  }

  async performAutoScaling() {
    if (!this.scalingEnabled) return;
    
    const services = await this.redis.smembers('active-services');
    
    for (const serviceName of services) {
      try {
        const customerId = serviceName.replace('customer', '').replace('-app', '');
        const serviceData = await this.redis.hgetall(`service:${customerId}`);
        
        if (!serviceData.serviceName || serviceData.status === 'sleeping') continue;
        
        // Get service metrics (simplified - you'd integrate with actual monitoring)
        const metrics = await this.getServiceMetrics(serviceName);
        
        if (metrics && metrics.avgCpu > this.scaleUpCpuThreshold) {
          const currentReplicas = parseInt(serviceData.replicas) || 1;
          if (currentReplicas < 3) {
            await this.scaleCustomerApp(customerId, currentReplicas + 1);
            console.log(`📈 Auto-scaled ${serviceName} up to ${currentReplicas + 1} replicas (CPU: ${metrics.avgCpu}%)`);
          }
        } else if (metrics && metrics.avgCpu < this.scaleDownCpuThreshold) {
          const currentReplicas = parseInt(serviceData.replicas) || 1;
          if (currentReplicas > 1) {
            await this.scaleCustomerApp(customerId, currentReplicas - 1);
            console.log(`📉 Auto-scaled ${serviceName} down to ${currentReplicas - 1} replicas (CPU: ${metrics.avgCpu}%)`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Auto-scaling error for ${serviceName}:`, error.message);
      }
    }
  }

  async performSleepManagement() {
    if (!this.sleepEnabled) return;
    
    const services = await this.redis.smembers('active-services');
    
    for (const serviceName of services) {
      try {
        const customerId = serviceName.replace('customer', '').replace('-app', '');
        const serviceData = await this.redis.hgetall(`service:${customerId}`);
        
        if (!serviceData.serviceName || serviceData.status === 'sleeping') continue;
        
        const lastActivity = new Date(serviceData.lastActivity);
        const minutesIdle = (Date.now() - lastActivity.getTime()) / 60000;
        
        if (minutesIdle > this.sleepTimeoutMinutes && parseInt(serviceData.replicas) > 0) {
          await this.sleepCustomerApp(customerId);
          console.log(`😴 Auto-slept ${serviceName} after ${minutesIdle.toFixed(1)} minutes of inactivity`);
        }
        
      } catch (error) {
        console.error(`❌ Sleep management error for ${serviceName}:`, error.message);
      }
    }
  }

  /**
   * Get basic service metrics (integrate with actual monitoring solution)
   */
  async getServiceMetrics(serviceName) {
    try {
      // This is a placeholder - integrate with your actual monitoring
      // In production, you'd get metrics from Prometheus, Docker stats, etc.
      const service = this.docker.getService(serviceName);
      const tasks = await service.tasks();
      
      // Return mock metrics for now
      return {
        avgCpu: Math.random() * 100,
        avgMemory: Math.random() * 100,
        requestCount: Math.floor(Math.random() * 1000),
        runningTasks: tasks.filter(t => t.Status.State === 'running').length
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper methods
   */
  formatEnvVars(envVars) {
    return envVars.map(env => `${env.key}=${env.value}`);
  }

  formatPorts(ports) {
    return ports.map(port => ({
      Protocol: port.protocol || 'tcp',
      TargetPort: port.target,
      PublishedPort: port.published,
      PublishMode: 'ingress'
    }));
  }

  /**
   * Get cluster-wide statistics
   */
  async getClusterStats() {
    try {
      const services = await this.docker.listServices();
      const nodes = await this.docker.listNodes();
      const customerServices = services.filter(s => s.Spec.Name.startsWith('customer'));
      
      const activeServices = customerServices.filter(s => 
        s.Spec.Mode.Replicated.Replicas > 0
      );
      
      const sleepingServices = customerServices.filter(s => 
        s.Spec.Mode.Replicated.Replicas === 0
      );

      return {
        totalNodes: nodes.length,
        totalCustomerServices: customerServices.length,
        activeServices: activeServices.length,
        sleepingServices: sleepingServices.length,
        totalReplicas: activeServices.reduce((sum, s) => 
          sum + s.Spec.Mode.Replicated.Replicas, 0
        ),
        resourceSavings: {
          sleepingServices: sleepingServices.length,
          estimatedMemorySaved: sleepingServices.length * 256, // MB
          estimatedCostSaving: (sleepingServices.length / customerServices.length * 100).toFixed(1) + '%'
        }
      };
    } catch (error) {
      console.error('❌ Failed to get cluster stats:', error.message);
      return null;
    }
  }
}

module.exports = SpinForgeSwarmManager;
