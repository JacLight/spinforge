/**
 * SpinForge - Operations Routes
 * Admin operations for system maintenance
 */

const express = require('express');
const router = express.Router();
const ContainerIPResolver = require('../resolve-container-ips');

/**
 * Resolve container IPs - updates Redis with current container IPs
 * POST /api/operations/resolve-ips
 * Body: { domain?: string } - optional specific domain, otherwise resolves all
 */
router.post('/resolve-ips', async (req, res) => {
    try {
        const { domain } = req.body;
        const resolver = new ContainerIPResolver();
        
        await resolver.connect();
        
        let result;
        if (domain) {
            // Resolve specific domain
            console.log(`API: Resolving IP for domain: ${domain}`);
            const success = await resolver.resolveDomain(domain);
            result = {
                success,
                domain,
                message: success ? `IP resolved for ${domain}` : `Failed to resolve IP for ${domain}`
            };
        } else {
            // Resolve all containers
            console.log('API: Resolving all container IPs...');
            const stats = await resolver.resolveAllContainers();
            result = {
                success: true,
                ...stats,
                message: `Resolved IPs: ${stats.updated} updated, ${stats.failed} failed`
            };
        }
        
        await resolver.disconnect();
        
        res.json(result);
    } catch (error) {
        console.error('Error resolving container IPs:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get IP resolution status
 * GET /api/operations/ip-status
 */
router.get('/ip-status', async (req, res) => {
    try {
        const resolver = new ContainerIPResolver();
        await resolver.connect();
        
        const keys = await resolver.client.keys('site:*');
        const status = [];
        
        for (const key of keys) {
            const siteData = await resolver.client.get(key);
            if (!siteData) continue;
            
            const site = JSON.parse(siteData);
            if (site.type === 'container' || site.containerName) {
                status.push({
                    domain: site.domain,
                    target: site.target,
                    containerName: site.containerName,
                    lastIPUpdate: site.lastIPUpdate || 'never'
                });
            }
        }
        
        await resolver.disconnect();
        
        res.json({
            success: true,
            containers: status,
            total: status.length
        });
    } catch (error) {
        console.error('Error getting IP status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;