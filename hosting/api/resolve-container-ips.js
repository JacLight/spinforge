#!/usr/bin/env node

/**
 * SpinForge Container IP Resolver
 * Resolves current container IPs and updates Redis targets
 * Can be run on startup or manually triggered
 */

const { execSync } = require('child_process');
const redis = require('redis');

// Configuration
const REDIS_HOST = process.env.REDIS_HOST || '172.18.0.10';
const REDIS_PORT = process.env.REDIS_PORT || 16378;
const REDIS_DB = process.env.REDIS_DB || 1;

class ContainerIPResolver {
    constructor() {
        this.client = null;
    }

    async connect() {
        this.client = redis.createClient({
            socket: {
                host: REDIS_HOST,
                port: REDIS_PORT
            },
            database: REDIS_DB
        });

        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        await this.client.connect();
        console.log(`Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
        }
    }

    /**
     * Get container IP address
     */
    getContainerIP(containerName) {
        try {
            const cmd = `docker inspect ${containerName} --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'`;
            const ip = execSync(cmd, { encoding: 'utf8' }).trim();
            return ip || null;
        } catch (error) {
            console.error(`Failed to get IP for container ${containerName}:`, error.message);
            return null;
        }
    }

    /**
     * Check if container exists and is running
     */
    isContainerRunning(containerName) {
        try {
            const cmd = `docker inspect ${containerName} --format '{{.State.Running}}'`;
            const running = execSync(cmd, { encoding: 'utf8' }).trim();
            return running === 'true';
        } catch (error) {
            return false;
        }
    }

    /**
     * Resolve IPs for all container-type sites
     */
    async resolveAllContainers() {
        console.log('Starting IP resolution for all containers...');
        
        // Get all site keys from Redis
        const keys = await this.client.keys('site:*');
        let updated = 0;
        let failed = 0;

        for (const key of keys) {
            const siteData = await this.client.get(key);
            if (!siteData) continue;

            try {
                const site = JSON.parse(siteData);
                
                // Only process container and proxy types that use container names
                if (site.type === 'container' || 
                    (site.type === 'proxy' && site.containerName)) {
                    
                    const domain = site.domain || key.replace('site:', '');
                    const result = await this.resolveContainer(domain, site);
                    
                    if (result) {
                        updated++;
                    } else {
                        failed++;
                    }
                }
            } catch (error) {
                console.error(`Error processing ${key}:`, error.message);
                failed++;
            }
        }

        console.log(`Resolution complete: ${updated} updated, ${failed} failed`);
        return { updated, failed };
    }

    /**
     * Resolve IP for a specific domain
     */
    async resolveDomain(domain) {
        const key = `site:${domain}`;
        const siteData = await this.client.get(key);
        
        if (!siteData) {
            console.error(`Site not found: ${domain}`);
            return false;
        }

        const site = JSON.parse(siteData);
        return await this.resolveContainer(domain, site);
    }

    /**
     * Resolve and update container IP
     */
    async resolveContainer(domain, site) {
        // Determine container name
        let containerName = site.containerName;
        
        // If no container name, try to derive it from domain
        if (!containerName && site.type === 'container') {
            // SpinForge naming convention: spinforge-<domain-with-dashes>
            containerName = `spinforge-${domain.replace(/\./g, '-')}`;
        }

        if (!containerName) {
            console.log(`No container name for ${domain}, skipping`);
            return false;
        }

        console.log(`Resolving ${domain} -> ${containerName}`);

        // Check if container is running
        if (!this.isContainerRunning(containerName)) {
            console.log(`Container ${containerName} is not running`);
            return false;
        }

        // Get current IP
        const currentIP = this.getContainerIP(containerName);
        if (!currentIP) {
            console.error(`Could not get IP for ${containerName}`);
            return false;
        }

        // Parse current target to get port
        let port = 3000; // default port
        if (site.target) {
            const match = site.target.match(/:(\d+)$/);
            if (match) {
                port = match[1];
            }
        } else if (site.containerConfig && site.containerConfig.port) {
            port = site.containerConfig.port;
        }

        // Update target with new IP
        const newTarget = `http://${currentIP}:${port}`;
        const oldTarget = site.target;

        if (oldTarget !== newTarget) {
            site.target = newTarget;
            site.lastIPUpdate = new Date().toISOString();
            
            // Save back to Redis
            await this.client.set(`site:${domain}`, JSON.stringify(site));
            console.log(`Updated ${domain}: ${oldTarget} -> ${newTarget}`);
            return true;
        } else {
            console.log(`${domain}: IP unchanged (${currentIP})`);
            return false;
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'all';
    
    const resolver = new ContainerIPResolver();
    
    try {
        await resolver.connect();
        
        switch (command) {
            case 'all':
                console.log('Resolving all container IPs...');
                await resolver.resolveAllContainers();
                break;
                
            case 'domain':
                const domain = args[1];
                if (!domain) {
                    console.error('Usage: resolve-container-ips.js domain <domain-name>');
                    process.exit(1);
                }
                console.log(`Resolving IP for domain: ${domain}`);
                const result = await resolver.resolveDomain(domain);
                if (!result) {
                    process.exit(1);
                }
                break;
                
            case 'help':
            default:
                console.log('Usage:');
                console.log('  resolve-container-ips.js [all]     - Resolve all container IPs');
                console.log('  resolve-container-ips.js domain <domain> - Resolve specific domain');
                console.log('  resolve-container-ips.js help      - Show this help');
                break;
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        await resolver.disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = ContainerIPResolver;