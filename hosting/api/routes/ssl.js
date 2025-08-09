/**
 * SpinForge - SSL Certificate Management Routes
 */

const express = require('express');
const router = express.Router();
const SSLCacheService = require('../services/SSLCacheService');
const redisClient = require('../utils/redis');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);
const sslCache = new SSLCacheService(redisClient);

// Cache a specific certificate
router.post('/cache/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const result = await sslCache.cacheCertificate(domain);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cache all certificates
router.post('/cache-all', async (req, res) => {
  try {
    const results = await sslCache.cacheAllCertificates();
    res.json({
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cache statistics
router.get('/cache-stats', async (req, res) => {
  try {
    const stats = await sslCache.getCacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Evict certificate from cache
router.delete('/cache/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const result = await sslCache.evictCertificate(domain);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all certificates
router.get('/certificates', async (req, res) => {
  try {
    const certsPath = '/data/certs/live';
    const certificates = [];
    
    try {
      const dirs = await fs.readdir(certsPath);
      
      for (const domain of dirs) {
        const certPath = path.join(certsPath, domain, 'cert.pem');
        const keyPath = path.join(certsPath, domain, 'privkey.pem');
        
        try {
          // Check if certificate files exist
          await fs.access(certPath);
          await fs.access(keyPath);
          
          // Get certificate info
          const { stdout } = await execAsync(`openssl x509 -in ${certPath} -noout -dates -subject -issuer 2>/dev/null`);
          
          const validFrom = stdout.match(/notBefore=(.*)/)?.[1];
          const validTo = stdout.match(/notAfter=(.*)/)?.[1];
          const subject = stdout.match(/subject=(.*)/)?.[1];
          
          // Check if it's a wildcard certificate
          const isWildcard = domain.startsWith('*.') || (subject && subject.includes('CN=*.'));
          
          // Determine status
          let status = 'active';
          if (validTo) {
            const expiryDate = new Date(validTo);
            const now = new Date();
            if (expiryDate < now) {
              status = 'expired';
            } else if (expiryDate.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
              status = 'expiring';
            }
          }
          
          certificates.push({
            domain,
            isWildcard,
            status,
            validFrom: validFrom ? new Date(validFrom).toISOString() : null,
            validTo: validTo ? new Date(validTo).toISOString() : null,
            issuer: 'Let\'s Encrypt',
            autoRenew: true,
            type: isWildcard ? 'wildcard' : 'standard'
          });
        } catch (err) {
          // Certificate files don't exist or are invalid
          console.log(`Skipping ${domain}: ${err.message}`);
        }
      }
    } catch (err) {
      console.log('Certificate directory not found:', err.message);
    }
    
    res.json(certificates);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register new certificate
router.post('/certificates', async (req, res) => {
  try {
    const { 
      domain, 
      email, 
      type,
      validationMethod,
      dnsProvider,
      apiKey,
      apiSecret,
      subdomains 
    } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    
    // Prepare the certbot command
    const isWildcard = type === 'wildcard' || domain.startsWith('*.');
    const certDomain = isWildcard && !domain.startsWith('*.') ? `*.${domain}` : domain;
    const baseDomain = certDomain.replace('*.', '');
    
    let command;
    if (isWildcard) {
      // Wildcard certificates require DNS validation
      if (validationMethod === 'automatic' && dnsProvider) {
        // Automatic DNS validation using provider APIs
        try {
          // Store DNS provider credentials temporarily for certbot hooks
          await redisClient.setex(`dns:creds:${baseDomain}`, 3600, JSON.stringify({
            provider: dnsProvider,
            apiKey,
            apiSecret
          }));
          
          // Build domains list including wildcard, base domain, and additional subdomains
          const domains = [certDomain, baseDomain]; // Include both wildcard and base domain
          if (subdomains && subdomains.length > 1) {
            // Add additional subdomains (skip the wildcard itself)
            subdomains.slice(1).forEach(sub => {
              if (sub && sub !== '*') {
                domains.push(`${sub}.${baseDomain}`);
              }
            });
          }
          
          // Use DNS plugins based on provider
          let dnsPlugin = '';
          let credentials = '';
          
          switch (dnsProvider) {
            case 'cloudflare':
              dnsPlugin = 'dns-cloudflare';
              // Create cloudflare credentials file
              const cfCreds = `dns_cloudflare_api_token = ${apiKey}`;
              await fs.writeFile(`/tmp/cloudflare-${baseDomain}.ini`, cfCreds, { mode: 0o600 });
              credentials = `--dns-cloudflare-credentials /tmp/cloudflare-${baseDomain}.ini`;
              break;
              
            case 'route53':
              dnsPlugin = 'dns-route53';
              // AWS credentials would be set as environment variables
              process.env.AWS_ACCESS_KEY_ID = apiKey;
              process.env.AWS_SECRET_ACCESS_KEY = apiSecret;
              break;
              
            case 'digitalocean':
              dnsPlugin = 'dns-digitalocean';
              const doCreds = `dns_digitalocean_token = ${apiKey}`;
              await fs.writeFile(`/tmp/digitalocean-${baseDomain}.ini`, doCreds, { mode: 0o600 });
              credentials = `--dns-digitalocean-credentials /tmp/digitalocean-${baseDomain}.ini`;
              break;
              
            default:
              // For GoDaddy, Namecheap, etc., we'd need custom hooks
              dnsPlugin = 'manual';
              break;
          }
          
          if (dnsPlugin !== 'manual') {
            command = `docker exec spinforge-certbot certbot certonly ` +
                      `--${dnsPlugin} ${credentials} ` +
                      `--email ${email || `admin@${baseDomain}`} ` +
                      `--agree-tos --no-eff-email ` +
                      `--domains "${domains.join(',')}" ` +
                      `--cert-name "${baseDomain}-wildcard"`;
          } else {
            // Fallback to manual with custom hooks for unsupported providers
            command = `docker exec spinforge-certbot certbot certonly ` +
                      `--manual --preferred-challenges dns ` +
                      `--manual-auth-hook "/scripts/dns-auth-${dnsProvider}.sh" ` +
                      `--manual-cleanup-hook "/scripts/dns-cleanup-${dnsProvider}.sh" ` +
                      `--email ${email || `admin@${baseDomain}`} ` +
                      `--agree-tos --no-eff-email ` +
                      `--domains "${domains.join(',')}" ` +
                      `--cert-name "${baseDomain}-wildcard"`;
          }
          
          // Execute certbot command
          const { stdout, stderr } = await execAsync(command);
          
          // Clean up credentials
          if (dnsProvider === 'cloudflare') {
            await fs.unlink(`/tmp/cloudflare-${baseDomain}.ini`).catch(() => {});
          } else if (dnsProvider === 'digitalocean') {
            await fs.unlink(`/tmp/digitalocean-${baseDomain}.ini`).catch(() => {});
          }
          
          // Cache the new certificate
          await sslCache.cacheCertificate(baseDomain);
          
          return res.json({
            success: true,
            message: 'Certificate registered successfully with automatic DNS validation',
            domain: certDomain,
            provider: dnsProvider,
            output: stdout
          });
          
        } catch (err) {
          console.error('Automatic DNS validation failed:', err);
          // Fall back to manual validation
          validationMethod = 'manual';
        }
      }
      
      if (validationMethod === 'manual' || !dnsProvider) {
        // Manual DNS validation
        // Generate a validation token for tracking
        const validationToken = require('crypto').randomBytes(16).toString('hex');
        
        // Store validation info in Redis
        await redisClient.setex(`dns:validation:${baseDomain}`, 3600, JSON.stringify({
          domain: certDomain,
          token: validationToken,
          status: 'pending',
          created: new Date().toISOString()
        }));
        
        // For manual validation, we need to run certbot in manual mode
        // This would typically be done with --manual-public-ip-logging-ok flag
        return res.json({
          success: true,
          message: 'Wildcard certificate requires DNS validation',
          validationType: 'manual',
          domain: certDomain,
          baseDomain,
          validationToken,
          instructions: [
            {
              type: 'TXT',
              name: `_acme-challenge.${baseDomain}`,
              value: 'Will be provided by Let\'s Encrypt',
              ttl: 300
            }
          ],
          nextStep: 'Add the DNS TXT record above and call POST /api/ssl/certificates/:domain/validate',
          type: 'wildcard'
        });
      }
    } else {
      // Standard certificates use HTTP validation
      command = `docker exec spinforge-certbot certbot certonly ` +
                `--webroot -w /var/www/certbot ` +
                `--email ${email || `admin@${domain}`} ` +
                `--agree-tos --no-eff-email ` +
                `-d ${domain}`;
      
      // Execute certbot command
      const { stdout, stderr } = await execAsync(command);
      
      // Cache the new certificate
      await sslCache.cacheCertificate(domain);
      
      res.json({
        success: true,
        message: 'Certificate registered successfully',
        domain,
        output: stdout
      });
    }
  } catch (error) {
    console.error('Error registering certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload existing certificate
router.post('/certificates/upload', async (req, res) => {
  try {
    const { domain, certificate, privateKey, chain } = req.body;
    
    if (!domain || !certificate || !privateKey) {
      return res.status(400).json({ 
        error: 'Domain, certificate, and private key are required' 
      });
    }
    
    // Validate certificate format
    if (!certificate.includes('BEGIN CERTIFICATE') || !certificate.includes('END CERTIFICATE')) {
      return res.status(400).json({ 
        error: 'Invalid certificate format. Must be in PEM format.' 
      });
    }
    
    if (!privateKey.includes('BEGIN') || !privateKey.includes('END')) {
      return res.status(400).json({ 
        error: 'Invalid private key format. Must be in PEM format.' 
      });
    }
    
    // Create directory for the certificate
    const certDir = `/data/certs/live/${domain}`;
    await fs.mkdir(certDir, { recursive: true });
    
    // Write certificate files
    await fs.writeFile(path.join(certDir, 'cert.pem'), certificate);
    await fs.writeFile(path.join(certDir, 'privkey.pem'), privateKey);
    
    // Write chain if provided
    if (chain) {
      await fs.writeFile(path.join(certDir, 'chain.pem'), chain);
      // Create fullchain by combining cert and chain
      await fs.writeFile(path.join(certDir, 'fullchain.pem'), certificate + '\n' + chain);
    } else {
      // If no chain, fullchain is just the cert
      await fs.writeFile(path.join(certDir, 'fullchain.pem'), certificate);
    }
    
    // Cache the uploaded certificate
    await sslCache.cacheCertificate(domain);
    
    // Get certificate info
    try {
      const { stdout } = await execAsync(`openssl x509 -in ${path.join(certDir, 'cert.pem')} -noout -dates -subject 2>/dev/null`);
      
      const validFrom = stdout.match(/notBefore=(.*)/)?.[1];
      const validTo = stdout.match(/notAfter=(.*)/)?.[1];
      
      res.json({
        success: true,
        message: 'Certificate uploaded successfully',
        domain,
        validFrom: validFrom ? new Date(validFrom).toISOString() : null,
        validTo: validTo ? new Date(validTo).toISOString() : null,
        isWildcard: domain.startsWith('*.')
      });
    } catch (certError) {
      // Certificate info extraction failed, but upload succeeded
      res.json({
        success: true,
        message: 'Certificate uploaded successfully',
        domain,
        isWildcard: domain.startsWith('*.')
      });
    }
    
  } catch (error) {
    console.error('Error uploading certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate DNS records for wildcard certificate
router.post('/certificates/:domain/validate', async (req, res) => {
  try {
    const { domain } = req.params;
    const baseDomain = domain.replace('*.', '');
    
    // Check if there's a pending validation
    const validationData = await redisClient.get(`dns:validation:${baseDomain}`);
    if (!validationData) {
      return res.status(404).json({ 
        error: 'No pending validation found for this domain' 
      });
    }
    
    const validation = JSON.parse(validationData);
    
    // Verify DNS records are properly set
    const dns = require('dns').promises;
    const challengeDomain = `_acme-challenge.${baseDomain}`;
    
    try {
      const records = await dns.resolveTxt(challengeDomain);
      
      if (!records || records.length === 0) {
        return res.status(400).json({
          error: 'DNS TXT record not found',
          domain: challengeDomain,
          message: 'Please ensure the DNS TXT record has been added and propagated'
        });
      }
      
      // Update validation status
      validation.status = 'validated';
      validation.validated = new Date().toISOString();
      await redisClient.setex(`dns:validation:${baseDomain}`, 3600, JSON.stringify(validation));
      
      // Now complete the certbot challenge
      const certDomain = validation.domain;
      const command = `docker exec spinforge-certbot certbot certonly ` +
                      `--manual --preferred-challenges dns ` +
                      `--manual-public-ip-logging-ok ` +
                      `--email admin@${baseDomain} ` +
                      `--agree-tos --no-eff-email ` +
                      `--domains "${certDomain}" ` +
                      `--cert-name "${baseDomain}-wildcard"`;
      
      const { stdout, stderr } = await execAsync(command);
      
      // Cache the new certificate
      await sslCache.cacheCertificate(baseDomain);
      
      // Clean up validation data
      await redisClient.del(`dns:validation:${baseDomain}`);
      
      res.json({
        success: true,
        message: 'Certificate validated and issued successfully',
        domain: certDomain,
        output: stdout
      });
      
    } catch (dnsError) {
      console.error('DNS lookup failed:', dnsError);
      return res.status(400).json({
        error: 'Failed to verify DNS records',
        domain: challengeDomain,
        details: dnsError.message,
        message: 'Please ensure the DNS TXT record has been added and propagated'
      });
    }
    
  } catch (error) {
    console.error('Error validating certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Renew certificate
router.post('/certificates/:domain/renew', async (req, res) => {
  try {
    const { domain } = req.params;
    
    // Run certbot renew for specific domain
    const command = `docker exec spinforge-certbot certbot renew --cert-name ${domain}`;
    const { stdout, stderr } = await execAsync(command);
    
    // Re-cache the renewed certificate
    await sslCache.cacheCertificate(domain);
    
    res.json({
      success: true,
      message: 'Certificate renewal initiated',
      domain,
      output: stdout
    });
  } catch (error) {
    console.error('Error renewing certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete certificate
router.delete('/certificates/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    
    // Revoke and delete the certificate
    const command = `docker exec spinforge-certbot certbot revoke --cert-path /etc/letsencrypt/live/${domain}/cert.pem --delete-after-revoke`;
    
    try {
      await execAsync(command);
    } catch (err) {
      // If revoke fails, try to just delete
      await execAsync(`docker exec spinforge-certbot rm -rf /etc/letsencrypt/live/${domain} /etc/letsencrypt/archive/${domain} /etc/letsencrypt/renewal/${domain}.conf`);
    }
    
    // Remove from cache
    await sslCache.evictCertificate(domain);
    
    res.json({
      success: true,
      message: 'Certificate deleted successfully',
      domain
    });
  } catch (error) {
    console.error('Error deleting certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;