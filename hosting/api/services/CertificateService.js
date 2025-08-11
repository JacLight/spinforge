/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const execAsync = promisify(exec);

class CertificateService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.certsPath = process.env.CERTS_PATH || '/data/certs';
    this.webRootPath = process.env.CERTBOT_WEBROOT || '/data/certbot-webroot';
  }

  async getCertificate(domain) {
    try {
      // Check Redis for certificate info
      const certData = await this.redis.get(`cert:${domain}`);
      if (!certData) return null;

      const cert = JSON.parse(certData);
      
      // Check if certificate files exist
      const certPath = path.join(this.certsPath, 'live', domain, 'fullchain.pem');
      const keyPath = path.join(this.certsPath, 'live', domain, 'privkey.pem');
      
      try {
        await fs.access(certPath);
        await fs.access(keyPath);
        cert.filesExist = true;
      } catch {
        cert.filesExist = false;
      }

      // Check expiry
      if (cert.validTo) {
        const expiryDate = new Date(cert.validTo);
        cert.isExpired = expiryDate < new Date();
        cert.daysUntilExpiry = Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      }

      return cert;
    } catch (error) {
      console.error('Error getting certificate:', error);
      return null;
    }
  }

  async generateLetsEncryptCertificate(domain, email = 'admin@spinforge.local', staging = false) {
    try {
      // Store certificate request in Redis
      const certRequest = {
        id: crypto.randomBytes(16).toString('hex'),
        domain,
        type: 'letsencrypt',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      
      await this.redis.set(`cert:${domain}`, JSON.stringify(certRequest));

      // Run certbot command
      const stagingFlag = staging ? '--staging' : '';
      const command = `docker exec spinforge-certbot certbot certonly --webroot -w /var/www/certbot -d ${domain} --email ${email} --agree-tos --non-interactive ${stagingFlag}`;
      
      console.log('Running certbot command:', command);
      
      try {
        const { stdout, stderr } = await execAsync(command);
        console.log('Certbot output:', stdout);
        if (stderr) console.error('Certbot stderr:', stderr);

        // Fix permissions immediately after certificate creation
        const fixPermsCommand = `docker exec spinforge-certbot sh -c "chmod 644 /etc/letsencrypt/live/${domain}/*.pem"`;
        try {
          await execAsync(fixPermsCommand);
          console.log(`Fixed permissions for ${domain} certificates`);
        } catch (permError) {
          console.error('Failed to fix permissions:', permError);
        }

        // Parse certificate info
        const certInfo = await this.parseCertificateInfo(domain);
        
        // Update certificate status
        const updatedCert = {
          ...certRequest,
          ...certInfo,
          status: 'active',
          issuedAt: new Date().toISOString(),
          autoRenew: true,
        };
        
        await this.redis.set(`cert:${domain}`, JSON.stringify(updatedCert));
        
        // Add to active certificates set
        await this.redis.sAdd('active-certs', domain);
        
        return updatedCert;
      } catch (error) {
        // Update certificate status to error
        const errorCert = {
          ...certRequest,
          status: 'error',
          error: error.message,
          failedAt: new Date().toISOString(),
        };
        
        await this.redis.set(`cert:${domain}`, JSON.stringify(errorCert));
        throw error;
      }
    } catch (error) {
      console.error('Error generating Let\'s Encrypt certificate:', error);
      throw error;
    }
  }

  async uploadManualCertificate(domain, { certificate, privateKey, chain }) {
    try {
      const certId = crypto.randomBytes(16).toString('hex');
      const certDir = path.join(this.certsPath, 'manual', domain);
      
      // Create directory
      await fs.mkdir(certDir, { recursive: true });
      
      // Save certificate files
      await fs.writeFile(path.join(certDir, 'cert.pem'), certificate);
      await fs.writeFile(path.join(certDir, 'privkey.pem'), privateKey);
      if (chain) {
        await fs.writeFile(path.join(certDir, 'chain.pem'), chain);
      }
      
      // Combine cert and chain for fullchain
      const fullchain = chain ? certificate + '\n' + chain : certificate;
      await fs.writeFile(path.join(certDir, 'fullchain.pem'), fullchain);
      
      // Parse certificate info
      const certInfo = await this.parseCertificateFromContent(certificate);
      
      // Store in Redis
      const certData = {
        id: certId,
        domain,
        type: 'manual',
        status: 'active',
        ...certInfo,
        uploadedAt: new Date().toISOString(),
        autoRenew: false,
      };
      
      await this.redis.set(`cert:${domain}`, JSON.stringify(certData));
      await this.redis.sAdd('active-certs', domain);
      
      return certData;
    } catch (error) {
      console.error('Error uploading manual certificate:', error);
      throw error;
    }
  }

  async renewCertificate(domain) {
    try {
      const cert = await this.getCertificate(domain);
      if (!cert) {
        throw new Error('Certificate not found');
      }
      
      if (cert.type !== 'letsencrypt') {
        throw new Error('Only Let\'s Encrypt certificates can be auto-renewed');
      }
      
      // Update status to renewing
      cert.status = 'renewing';
      cert.renewalStarted = new Date().toISOString();
      await this.redis.set(`cert:${domain}`, JSON.stringify(cert));
      
      // Run certbot renew for specific domain
      const command = `docker exec spinforge-certbot certbot renew --cert-name ${domain} --force-renewal`;
      
      try {
        const { stdout, stderr } = await execAsync(command);
        console.log('Certbot renewal output:', stdout);
        if (stderr) console.error('Certbot renewal stderr:', stderr);
        
        // Parse updated certificate info
        const certInfo = await this.parseCertificateInfo(domain);
        
        // Update certificate
        const renewedCert = {
          ...cert,
          ...certInfo,
          status: 'active',
          lastRenewal: new Date().toISOString(),
          nextRenewal: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
        };
        
        await this.redis.set(`cert:${domain}`, JSON.stringify(renewedCert));
        
        return renewedCert;
      } catch (error) {
        // Update status to error
        cert.status = 'error';
        cert.error = error.message;
        cert.renewalFailed = new Date().toISOString();
        await this.redis.set(`cert:${domain}`, JSON.stringify(cert));
        throw error;
      }
    } catch (error) {
      console.error('Error renewing certificate:', error);
      throw error;
    }
  }

  async deleteCertificate(domain) {
    try {
      const cert = await this.getCertificate(domain);
      if (!cert) {
        throw new Error('Certificate not found');
      }
      
      // Delete certificate files
      if (cert.type === 'letsencrypt') {
        const certDir = path.join(this.certsPath, 'live', domain);
        const archiveDir = path.join(this.certsPath, 'archive', domain);
        const renewalFile = path.join(this.certsPath, 'renewal', `${domain}.conf`);
        
        try {
          await fs.rm(certDir, { recursive: true, force: true });
          await fs.rm(archiveDir, { recursive: true, force: true });
          await fs.unlink(renewalFile);
        } catch (error) {
          console.error('Error deleting Let\'s Encrypt files:', error);
        }
      } else if (cert.type === 'manual') {
        const certDir = path.join(this.certsPath, 'manual', domain);
        try {
          await fs.rm(certDir, { recursive: true, force: true });
        } catch (error) {
          console.error('Error deleting manual certificate files:', error);
        }
      }
      
      // Remove from Redis
      await this.redis.del(`cert:${domain}`);
      await this.redis.sRem('active-certs', domain);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting certificate:', error);
      throw error;
    }
  }

  async updateCertificateSettings(domain, settings) {
    try {
      const cert = await this.getCertificate(domain);
      if (!cert) {
        throw new Error('Certificate not found');
      }
      
      // Update settings
      const updatedCert = {
        ...cert,
        ...settings,
        updatedAt: new Date().toISOString(),
      };
      
      await this.redis.set(`cert:${domain}`, JSON.stringify(updatedCert));
      
      return updatedCert;
    } catch (error) {
      console.error('Error updating certificate settings:', error);
      throw error;
    }
  }

  async parseCertificateInfo(domain) {
    try {
      const certPath = path.join(this.certsPath, 'live', domain, 'cert.pem');
      const certContent = await fs.readFile(certPath, 'utf8');
      return await this.parseCertificateFromContent(certContent);
    } catch (error) {
      console.error('Error parsing certificate info:', error);
      return {};
    }
  }

  async parseCertificateFromContent(certContent) {
    try {
      // Use openssl to parse certificate
      const tempFile = `/tmp/cert-${Date.now()}.pem`;
      await fs.writeFile(tempFile, certContent);
      
      const { stdout } = await execAsync(`openssl x509 -in ${tempFile} -noout -subject -issuer -dates`);
      await fs.unlink(tempFile);
      
      const lines = stdout.split('\n');
      const info = {};
      
      for (const line of lines) {
        if (line.startsWith('subject=')) {
          const cn = line.match(/CN\s*=\s*([^,]+)/);
          if (cn) info.commonName = cn[1];
        } else if (line.startsWith('issuer=')) {
          const issuer = line.match(/O\s*=\s*([^,]+)/);
          if (issuer) info.issuer = issuer[1];
        } else if (line.startsWith('notBefore=')) {
          info.validFrom = new Date(line.split('=')[1]).toISOString();
        } else if (line.startsWith('notAfter=')) {
          info.validTo = new Date(line.split('=')[1]).toISOString();
        }
      }
      
      return info;
    } catch (error) {
      console.error('Error parsing certificate content:', error);
      return {};
    }
  }

  async checkAndRenewCertificates() {
    try {
      const activeCerts = await this.redis.sMembers('active-certs');
      
      for (const domain of activeCerts) {
        const cert = await this.getCertificate(domain);
        if (!cert || cert.type !== 'letsencrypt' || !cert.autoRenew) continue;
        
        // Check if certificate needs renewal (30 days before expiry)
        if (cert.daysUntilExpiry && cert.daysUntilExpiry <= 30) {
          console.log(`Certificate for ${domain} expiring in ${cert.daysUntilExpiry} days, renewing...`);
          try {
            await this.renewCertificate(domain);
            console.log(`Successfully renewed certificate for ${domain}`);
          } catch (error) {
            console.error(`Failed to renew certificate for ${domain}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error checking certificates for renewal:', error);
    }
  }

  async getNginxSSLConfig(domain) {
    const cert = await this.getCertificate(domain);
    if (!cert || cert.status !== 'active') return null;
    
    let certPath, keyPath;
    
    if (cert.type === 'letsencrypt') {
      certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
      keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;
    } else if (cert.type === 'manual') {
      certPath = `/etc/letsencrypt/manual/${domain}/fullchain.pem`;
      keyPath = `/etc/letsencrypt/manual/${domain}/privkey.pem`;
    }
    
    return {
      ssl: true,
      sslCertificate: certPath,
      sslCertificateKey: keyPath,
      sslProtocols: 'TLSv1.2 TLSv1.3',
      sslCiphers: 'HIGH:!aNULL:!MD5',
      sslPreferServerCiphers: true,
    };
  }
}

module.exports = CertificateService;